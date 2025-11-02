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
  const systemPrompt = `You are an expert web editor for WordPress. Your task is to format text into clean, well-structured HTML.

FORMATTING RULES:
- Break text into short paragraphs using <p> tags
- Use <h2> and <h3> for structure
- Format lists as <ul> or <ol>
- Create clean, readable HTML

IMAGE INSERTION RULES (CRITICAL):
1. Insert the provided images at logically appropriate places in the text
2. EACH image MUST be wrapped in a <figure> tag with these CSS classes:
   <figure class="wp-block-image aligncenter size-large">
3. The <img> tag MUST have:
   - src attribute with the image URL
   - alt attribute based on the image's prompt (in English)
   - class="aligncenter size-large" for styling
4. Add a <figcaption> tag inside the <figure>
5. The <figcaption> text MUST be:
   - SHORT (maximum 50 characters)
   - IN RUSSIAN LANGUAGE
   - Describe what the image shows for the reader
   - DO NOT use the English generation prompt as caption

EXAMPLE IMAGE FORMAT:
<figure class="wp-block-image aligncenter size-large">
  <img src="https://example.com/image.jpg" alt="massage therapist demonstrating technique" class="aligncenter size-large" />
  <figcaption>Специалист демонстрирует технику массажа.</figcaption>
</figure>

OUTPUT CONSTRAINTS (VERY IMPORTANT):
- Output ONLY the body HTML content
- DO NOT include <html>, <body>, <head> tags
- DO NOT wrap output in markdown code blocks
- DO NOT add any prefixes like "\`\`\`html"
- The output must start directly with content tags like <h2>, <p>, or <figure>
- The final HTML must be clean and ready for WordPress editor`;
  
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
    logger.info('Article formatting completed successfully');
    
    return cleanedContent;
    
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
