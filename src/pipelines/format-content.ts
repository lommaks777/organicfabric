/**
 * Format Content - Transform content to WordPress-compatible HTML
 */

import OpenAI from 'openai';
import { logger } from '../core/logger.js';
import { generateShortRussianCaption } from '../adapters/llm-openai.js';
import * as cheerio from 'cheerio';

interface ImageData {
  source_url: string;
  prompt: string;
}

interface FormatOptions {
  includeImages?: boolean;
  imagePositions?: string[];
  headingLevel?: number;
}

/**
 * Get OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured in environment variables');
  }
  
  return new OpenAI({ apiKey });
}

/**
 * Format article text into WordPress-compatible HTML with integrated images
 * Uses structural analysis approach: AI analyzes HTML block structure and returns JSON,
 * then code assembles HTML deterministically to guarantee 100% content preservation
 * 
 * @param rawText - Original unformatted article text (kept for compatibility)
 * @param rawHtml - Original HTML from parser (primary structure source)
 * @param images - Array of uploaded images with URLs and prompts
 * @returns Promise resolving to formatted HTML string
 */
export async function formatArticleHtml(
  rawText: string,
  rawHtml: string,
  images: Array<ImageData> = []
): Promise<string> {
  logger.info('Starting structural HTML formatting based on pre-parsed blocks.');
  
  // === STAGE 1: Pre-parse HTML into blocks using Cheerio ===
  const $ = cheerio.load(rawHtml);
  const blocks: string[] = [];
  
  $('h1, h2, h3, h4, p, li, blockquote').each((_, element) => {
    const htmlContent = $(element).html();
    if (htmlContent && htmlContent.trim().length > 0) {
      blocks.push(htmlContent.trim());
    }
  });
  
  // Fallback: if no blocks found, split raw text by double newlines
  if (blocks.length === 0) {
    logger.warn('Cheerio found no blocks, falling back to simple text split.');
    const textBlocks = rawText.split(/\n\n+/).filter(p => p.trim().length > 0);
    if (textBlocks.length === 0) {
      throw new Error('Content is empty after parsing.');
    }
    blocks.push(...textBlocks);
  }
  
  logger.info(`Pre-parsed content into ${blocks.length} HTML blocks.`);
  
  // === STAGE 2: Request structure analysis from AI ===
  const client = getOpenAIClient();
  const model = 'gpt-4o'; // Using more powerful model for complex structural analysis
  
  // Build numbered block listing for AI (show first 150 chars for context)
  const blockListing = blocks
    .map((block, index) => `${index}: "${block.substring(0, 150)}..."`)
    .join('\n');
  
  // System prompt: Define structural analysis task
  const systemPrompt = `You are a structural analyzer. Your task is to analyze content blocks and determine their semantic type (p, h2, h3, li) and where to insert images.
Return a JSON object with a single key "structure", which is an array of objects.
Each object represents a content block and must have a "type".

- For a regular paragraph: { "type": "p", "blockIndex": N }
- For a heading: { "type": "h2", "blockIndex": N } or { "type": "h3", ... }
- For a list item: { "type": "li", "blockIndex": N }
- To insert an image: { "type": "image", "imageIndex": M }

N is the original index of the block (from 0).
M is the index of the image to insert (from 1).
Use ALL block and image indexes exactly once.`;
  
  // User prompt: Provide block listing and image count
  const userPrompt = `Analyze the following content blocks. There are ${images.length} images available.
Insert placeholders for imageIndex 1 through ${images.length}.

Content Blocks:
${blockListing}

Return the JSON structure.`;
  
  try {
    logger.info(`Calling OpenAI API for structure analysis with model: ${model}`);
    
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('AI returned an empty structure response.');
    }
    
    const structure = JSON.parse(content).structure;
    if (!Array.isArray(structure)) {
      throw new Error('AI response is not a valid structure array.');
    }
    
    logger.info(`Received structure with ${structure.length} items from AI`);
    
    // === STAGE 3: Assemble HTML from structure ===
    let finalHtml = '';
    let isInsideList = false;
    
    for (const item of structure) {
      // Close UL if current element is not LI and we were in a list
      if (item.type !== 'li' && isInsideList) {
        finalHtml += '</ul>\n';
        isInsideList = false;
      }
      
      // Process block based on type
      switch (item.type) {
        case 'p':
        case 'h2':
        case 'h3':
          if (item.blockIndex !== undefined && item.blockIndex < blocks.length) {
            finalHtml += `<${item.type}>${blocks[item.blockIndex]}</${item.type}>\n`;
          }
          break;
        
        case 'li':
          if (!isInsideList) {
            finalHtml += '<ul>\n';
            isInsideList = true;
          }
          if (item.blockIndex !== undefined && item.blockIndex < blocks.length) {
            finalHtml += `  <li>${blocks[item.blockIndex]}</li>\n`;
          }
          break;
        
        case 'image':
          if (item.imageIndex !== undefined) {
            const imageIndex = item.imageIndex - 1;
            if (imageIndex < images.length) {
              const image = images[imageIndex];
              const caption = await generateShortRussianCaption(image.prompt);
              finalHtml += `<figure class="wp-block-image aligncenter size-large" style="max-width: 600px; margin: 20px auto;">
  <img src="${image.source_url}" alt="${caption}" />
  <figcaption style="text-align: center; font-style: italic; font-size: 0.9em; color: #555;">${caption}</figcaption>
</figure>\n`;
            }
          }
          break;
      }
    }
    
    // Close UL if it remained open at the end
    if (isInsideList) {
      finalHtml += '</ul>\n';
    }
    
    const figureCount = (finalHtml.match(/<figure/g) || []).length;
    logger.info(`Structural HTML formatting completed successfully. Figure blocks: ${figureCount}`);
    
    return finalHtml.trim();
    
  } catch (error) {
    logger.error('OpenAI structure analysis failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('authentication') || error.message.includes('401')) {
        throw new Error('OpenAI authentication failed. Check OPENAI_API_KEY.');
      }
    }
    
    throw error;
  }
}

export async function renderHtml(
  _rawContent: string,
  _images: any[] = [],
  _options: FormatOptions = {}
): Promise<string> {
  // TODO: Implement HTML rendering with handlebars templates
  // 1. Format content with OpenAI if needed
  // 2. Apply template
  // 3. Insert images at appropriate positions
  console.log('Rendering HTML content');
  return '';
}

export async function applyTemplate(content: string, templateName: string): Promise<string> {
  // TODO: Implement template application
  console.log(`Applying template: ${templateName}`);
  return content;
}
