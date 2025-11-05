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
  wpMediaId?: number;
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
  const blockTypes: string[] = []; // Track block types for AI
  
  // Parse all block-level elements including tables
  $('h1, h2, h3, h4, p, li, blockquote, table').each((_, element) => {
    const $elem = $(element);
    const tagName = $elem.prop('tagName')?.toLowerCase() || 'p';
    
    // For tables, get the complete table HTML
    if (tagName === 'table') {
      const tableHtml = $.html($elem);
      if (tableHtml && tableHtml.trim().length > 0) {
        blocks.push(tableHtml.trim());
        blockTypes.push('table');
      }
    } else {
      const htmlContent = $elem.html();
      if (htmlContent && htmlContent.trim().length > 0) {
        blocks.push(htmlContent.trim());
        blockTypes.push(tagName);
      }
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
  
  // Log table count
  const tableCount = blockTypes.filter(t => t === 'table').length;
  if (tableCount > 0) {
    logger.info(`Found ${tableCount} table(s) in content`);
  }
  
  // === STAGE 2: Request structure analysis from AI ===
  const client = getOpenAIClient();
  const model = 'gpt-4o'; // Using more powerful model for complex structural analysis
  
  // Build numbered block listing for AI (show first 150 chars for context)
  const blockListing = blocks
    .map((block, index) => `${index}: "${block.substring(0, 150)}..."`)
    .join('\n');
  
  // System prompt: Define structural analysis task
  const systemPrompt = `You are a structural analyzer. Your task is to analyze content blocks and determine their semantic type (p, h2, h3, li, table) and where to insert images.
Return a JSON object with a single key "structure", which is an array of objects.
Each object represents a content block and must have a "type".

- For a regular paragraph: { "type": "p", "blockIndex": N }
- For a heading: { "type": "h2", "blockIndex": N } or { "type": "h3", ... }
- For a list item: { "type": "li", "blockIndex": N }
- For a table: { "type": "table", "blockIndex": N }
- To insert an image: { "type": "image", "imageIndex": M }

N is the original index of the block (from 0).
M is the index of the image to insert (from 1).

CRITICAL REQUIREMENTS:
1. You MUST use ALL block indexes from 0 to ${blocks.length - 1} exactly once
2. You MUST insert ALL ${images.length} images (imageIndex 1 through ${images.length})
3. Distribute images evenly throughout the content:
   - First image after ~30% of content
   - Second image after ~60% of content  
   - Third image after ~85% of content
4. NEVER place images at the very beginning or very end
5. Place images after complete sections, not in the middle of lists or tables`;
  
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
    
    // Log table count in structure
    const tableItems = structure.filter((item: any) => item.type === 'table');
    if (tableItems.length > 0) {
      logger.info(`AI included ${tableItems.length} table(s) in structure`);
    } else if (tableCount > 0) {
      logger.warn(`AI did NOT include any tables in structure, but ${tableCount} were found in blocks`);
    }
    
    // Validate that ALL images are included
    const imageItems = structure.filter((item: any) => item.type === 'image');
    const usedImageIndexes = imageItems.map((item: any) => item.imageIndex);
    const missingImages: number[] = [];
    
    for (let i = 1; i <= images.length; i++) {
      if (!usedImageIndexes.includes(i)) {
        missingImages.push(i);
      }
    }
    
    if (missingImages.length > 0) {
      logger.warn(`AI missed ${missingImages.length} image(s): ${missingImages.join(', ')}. Auto-inserting them.`);
      
      // Auto-insert missing images at strategic positions
      const contentBlocks = structure.filter((item: any) => item.type === 'p' || item.type === 'h2' || item.type === 'h3');
      const totalBlocks = contentBlocks.length;
      
      missingImages.forEach((imageIndex, idx) => {
        // Calculate position: distribute evenly
        const position = Math.floor(totalBlocks * (0.3 + (idx * 0.3)));
        const insertAfterBlock = contentBlocks[position];
        
        if (insertAfterBlock) {
          // Find position in original structure
          const structureIndex = structure.indexOf(insertAfterBlock);
          if (structureIndex >= 0) {
            structure.splice(structureIndex + 1, 0, { type: 'image', imageIndex });
            logger.info(`Auto-inserted image ${imageIndex} after block at position ${structureIndex}`);
          }
        }
      });
    }
    
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
        
        case 'table':
          // Wrap table in Gutenberg HTML block to preserve it in WordPress
          if (item.blockIndex !== undefined && item.blockIndex < blocks.length) {
            finalHtml += `
<!-- wp:html -->
${blocks[item.blockIndex]}
<!-- /wp:html -->
`;
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
              
              // Gutenberg-совместимый блок изображения с ограничением размера
              const imageId = image.wpMediaId || 0;
              finalHtml += `
<!-- wp:image {"align":"center","id":${imageId},"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image aligncenter size-large" style="max-width: 600px; margin: 20px auto;">
  <img src="${image.source_url}" alt="${caption}" class="wp-image-${imageId}" style="max-width: 100%; height: auto;"/>
  <figcaption style="text-align: center; font-style: italic; font-size: 0.9em; color: #555;">${caption}</figcaption>
</figure>
<!-- /wp:image -->
`;
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
