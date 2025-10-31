/**
 * Format Content - Transform content to WordPress-compatible HTML
 */

import OpenAI from 'openai';
import { logger } from '../core/logger.js';

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
  const systemPrompt = `You are an expert web editor for WordPress content.

Your task is to format text into clean, well-structured HTML for WordPress.

Formatting rules:
- Break text into short paragraphs using <p> tags
- Use <h2> and <h3> headings to structure the content
- Format lists as <ul> or <ol> where appropriate
- IMPORTANT: Insert provided images at logical positions in the text
- Wrap each image in a <figure> element
- Include <img> tag with src and alt attributes
- Add <figcaption> with descriptive text based on the image prompt

Constraints:
- Output ONLY body HTML content
- Do NOT include <html>, <body>, or <head> tags
- Content must be ready for WordPress editor
- Use semantic HTML5 elements

Return clean, properly formatted HTML suitable for direct insertion into WordPress.`;
  
  // User prompt: Include raw text and available images
  let userPrompt = `Format the following article text into WordPress HTML:\n\n${rawText}`;
  
  if (images.length > 0) {
    const imagesJson = JSON.stringify(
      images.map(img => ({
        source_url: img.source_url,
        prompt: img.prompt,
      })),
      null,
      2
    );
    userPrompt += `\n\nAvailable images to insert at logical positions:\n${imagesJson}`;
  }
  
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
    
    logger.info(`Received formatted HTML from OpenAI, length: ${content.length} bytes`);
    logger.info('Article formatting completed successfully');
    
    return content;
    
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
