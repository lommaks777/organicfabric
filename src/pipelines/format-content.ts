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

/**
 * Format article text into WordPress-compatible HTML with integrated images
 * Uses OpenAI GPT to transform raw text into structured HTML
 * 
 * @param rawText - Original unformatted article text
 * @param images - Array of uploaded images with URLs and prompts
 * @returns Promise resolving to formatted HTML string
 */
export async function formatArticleHtml(
  rawText: string,
  images: Array<ImageData> = []
): Promise<string> {
  logger.info('Starting article HTML formatting');
  
  // Validate input
  if (!rawText || rawText.trim().length === 0) {
    throw new Error('Raw text is empty or invalid');
  }
  
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  // System prompt: Define GPT's role and instructions
  const systemPrompt = `You are an expert web editor. Your task is to format raw text into clean HTML for WordPress.

Instructions:
- Use <p>, <h2>, <h3>, <ul>, <ol> for structure.
- You will be given a number of available images.
- At logically appropriate places in the text, you MUST insert special placeholders for these images.
- The placeholders look like this: <!-- IMAGE_PLACEHOLDER_1 -->, <!-- IMAGE_PLACEHOLDER_2 -->, etc.
- Use ALL available image placeholders. If 3 images are available, you must insert all 3 placeholders.

Constraints:
- DO NOT output <img> or <figure> tags yourself. Only use the placeholders.
- Output ONLY body HTML content (no <html>, <body>, <head>).`;
  
  // User prompt: Include raw text and available images
  const userPrompt = `Format the following text. You have ${images.length} images available. Please insert the placeholders <!-- IMAGE_PLACEHOLDER_1 --> through <!-- IMAGE_PLACEHOLDER_${images.length} --> into the text at logical points.

Raw text:
${rawText}`;
  
  try {
    logger.info(`Calling OpenAI API with model: ${model}`);
    
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    });
    
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('OpenAI returned empty response');
    }
    
    // Clean up common artifacts from LLM responses
    let cleanedContent = content.trim();
    
    // Remove markdown code blocks if present
    cleanedContent = cleanedContent.replace(/^```html\s*\n/i, '').replace(/\n```$/i, '');
    cleanedContent = cleanedContent.replace(/^```\s*\n/i, '').replace(/\n```$/i, '');
    
    // Remove wrapping <html>, <body>, <head> tags if present (both standalone and in paragraphs)
    cleanedContent = cleanedContent.replace(/<p>\s*<html[^>]*>\s*<head[^>]*>.*?<\/head>\s*<body[^>]*>\s*<\/p>/gis, '');
    cleanedContent = cleanedContent.replace(/<p>\s*<html[^>]*>\s*<\/p>/gi, '');
    cleanedContent = cleanedContent.replace(/<p>\s*<body[^>]*>\s*<\/p>/gi, '');
    cleanedContent = cleanedContent.replace(/<\/body>\s*<\/html>/gi, '');
    cleanedContent = cleanedContent.replace(/^<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '');
    cleanedContent = cleanedContent.replace(/^<head[^>]*>.*?<\/head>\s*/is, '');
    cleanedContent = cleanedContent.replace(/^<body[^>]*>\s*/i, '').replace(/<\/body>\s*$/i, '');
    
    // Clean up quotes that might be added
    cleanedContent = cleanedContent.replace(/^["']|["']$/g, '');
    
    cleanedContent = cleanedContent.trim();
    
    logger.info(`Received formatted HTML from OpenAI, length: ${cleanedContent.length} bytes`);
    
    // Replace placeholders with actual figure blocks
    let finalHtml = cleanedContent;
    
    for (let index = 0; index < images.length; index++) {
      const image = images[index];
      const placeholder = `<!-- IMAGE_PLACEHOLDER_${index + 1} -->`;
      
      // Generate short Russian caption for this image
      const shortCaption = await generateShortRussianCaption(image.prompt);
      
      const figureHtml = `
    <figure class="wp-block-image aligncenter size-large" style="max-width: 600px; margin: 20px auto;">
      <img src="${image.source_url}" alt="${image.prompt}" />
      <figcaption style="text-align: center; font-style: italic;">${shortCaption}</figcaption>
    </figure>`;
      
      // Replace placeholder with HTML block
      finalHtml = finalHtml.replace(placeholder, figureHtml);
    }
    
    logger.info('Article formatting completed successfully');
    
    return finalHtml;
    
  } catch (error) {
    logger.error('OpenAI formatting failed:', error);
    
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
