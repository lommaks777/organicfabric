/**
 * Format Content - Transform content to WordPress-compatible HTML
 */

import OpenAI from 'openai';
import { logger } from '../core/logger.js';
import { generateShortRussianCaption } from '../adapters/llm-openai.js';

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

interface StructureBlock {
  type: 'p' | 'h2' | 'h3' | 'li' | 'image';
  paragraphIndex?: number;
  imageIndex?: number;
}

interface StructureResponse {
  structure: StructureBlock[];
}

/**
 * Format article text into WordPress-compatible HTML with integrated images
 * Uses structural analysis approach: AI analyzes text structure and returns JSON,
 * then code assembles HTML deterministically to guarantee 100% content preservation
 * 
 * @param rawText - Original unformatted article text
 * @param images - Array of uploaded images with URLs and prompts
 * @returns Promise resolving to formatted HTML string
 */
export async function formatArticleHtml(
  rawText: string,
  images: Array<ImageData> = []
): Promise<string> {
  logger.info('Starting structural article HTML formatting');
  
  // Validate input
  if (!rawText || rawText.trim().length === 0) {
    throw new Error('Raw text is empty or invalid');
  }
  
  // Step 1: Split text into paragraphs programmatically
  const paragraphs = rawText
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  logger.info(`Split text into ${paragraphs.length} paragraphs`);
  
  if (paragraphs.length === 0) {
    throw new Error('No valid paragraphs found in text');
  }
  
  // Step 2: Request structure analysis from AI
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  // Build numbered paragraph listing for AI
  const paragraphListing = paragraphs
    .map((text, index) => `${index}: "${text}"`)
    .join('\n');
  
  // System prompt: Define structural analysis task
  const systemPrompt = `You are a structural analyzer for articles. Your task is to analyze the provided text, which is split into numbered paragraphs, and determine the type of each paragraph (e.g., 'p', 'h2', 'h3', 'li') and decide where to insert images.

You MUST return a JSON object with a single key "structure", which is an array of objects.
Each object in the array represents a block of content and must have a "type" field.

- For a regular paragraph, use: { "type": "p", "paragraphIndex": N }
- For a heading, use: { "type": "h2", "paragraphIndex": N } or { "type": "h3", ... }
- For a list item, use: { "type": "li", "paragraphIndex": N }
- To insert an image, use: { "type": "image", "imageIndex": M }

N is the original index of the paragraph (from 0).
M is the index of the image to insert (from 1).

Use ALL paragraph and image indexes exactly once. Do not skip or reorder them.`;
  
  // User prompt: Provide paragraph listing and image count
  const userPrompt = `Analyze the following content. There are ${images.length} images available for insertion.

Paragraphs:
${paragraphListing}

Return the JSON structure.`;
  
  try {
    logger.info(`Calling OpenAI API for structure analysis with model: ${model}`);
    
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }
    
    logger.info('Received structure analysis from OpenAI');
    
    // Parse JSON response
    let structureData: StructureResponse;
    try {
      structureData = JSON.parse(content);
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON, applying default structure');
      // Fallback: treat all paragraphs as regular paragraphs
      structureData = {
        structure: paragraphs.map((_, index) => ({
          type: 'p',
          paragraphIndex: index
        }))
      };
    }
    
    if (!structureData.structure || !Array.isArray(structureData.structure)) {
      throw new Error('Invalid structure format from AI');
    }
    
    logger.info(`Processing ${structureData.structure.length} structure blocks`);
    
    // Step 3: Assemble HTML from structure
    let finalHtml = '';
    let inList = false;
    const usedParagraphs = new Set<number>();
    const usedImages = new Set<number>();
    
    for (let i = 0; i < structureData.structure.length; i++) {
      const block = structureData.structure[i];
      
      // Handle list closing
      if (inList && block.type !== 'li') {
        finalHtml += '\n</ul>\n';
        inList = false;
      }
      
      // Process block based on type
      switch (block.type) {
        case 'p':
        case 'h2':
        case 'h3': {
          if (block.paragraphIndex === undefined) {
            logger.warn(`Block type ${block.type} missing paragraphIndex, skipping`);
            break;
          }
          const text = paragraphs[block.paragraphIndex];
          if (text === undefined) {
            logger.warn(`Paragraph index ${block.paragraphIndex} out of range, skipping`);
            break;
          }
          usedParagraphs.add(block.paragraphIndex);
          finalHtml += `<${block.type}>${text}</${block.type}>\n`;
          break;
        }
        
        case 'li': {
          if (block.paragraphIndex === undefined) {
            logger.warn('List item missing paragraphIndex, skipping');
            break;
          }
          const text = paragraphs[block.paragraphIndex];
          if (text === undefined) {
            logger.warn(`Paragraph index ${block.paragraphIndex} out of range, skipping`);
            break;
          }
          usedParagraphs.add(block.paragraphIndex);
          
          // Open list if needed
          if (!inList) {
            finalHtml += '<ul>\n';
            inList = true;
          }
          
          finalHtml += `  <li>${text}</li>\n`;
          break;
        }
        
        case 'image': {
          if (block.imageIndex === undefined) {
            logger.warn('Image block missing imageIndex, skipping');
            break;
          }
          const imageArrayIndex = block.imageIndex - 1;
          const image = images[imageArrayIndex];
          if (!image) {
            logger.warn(`Image index ${block.imageIndex} out of range, skipping`);
            break;
          }
          usedImages.add(block.imageIndex);
          
          // Generate short Russian caption
          const shortCaption = await generateShortRussianCaption(image.prompt);
          
          const figureHtml = `<figure class="wp-block-image aligncenter size-large" style="max-width: 600px; margin: 20px auto;">
  <img src="${image.source_url}" alt="${shortCaption}" />
  <figcaption style="text-align: center; font-style: italic; font-size: 0.9em; color: #555;">${shortCaption}</figcaption>
</figure>\n`;
          
          finalHtml += figureHtml;
          break;
        }
        
        default:
          logger.warn(`Unknown block type: ${block.type}`);
      }
    }
    
    // Close list if still open at end
    if (inList) {
      finalHtml += '</ul>\n';
    }
    
    // Validation: Check for unused paragraphs
    for (let i = 0; i < paragraphs.length; i++) {
      if (!usedParagraphs.has(i)) {
        logger.warn(`Paragraph ${i} was not used in structure, appending at end`);
        finalHtml += `<p>${paragraphs[i]}</p>\n`;
      }
    }
    
    // Validation: Check for unused images
    for (let i = 1; i <= images.length; i++) {
      if (!usedImages.has(i)) {
        logger.warn(`Image ${i} was not used in structure, appending at end`);
        const image = images[i - 1];
        const shortCaption = await generateShortRussianCaption(image.prompt);
        const figureHtml = `<figure class="wp-block-image aligncenter size-large" style="max-width: 600px; margin: 20px auto;">
  <img src="${image.source_url}" alt="${shortCaption}" />
  <figcaption style="text-align: center; font-style: italic; font-size: 0.9em; color: #555;">${shortCaption}</figcaption>
</figure>\n`;
        finalHtml += figureHtml;
      }
    }
    
    logger.info('Structural article formatting completed successfully');
    
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
