/**
 * OpenAI LLM Adapter - Content formatting using OpenAI
 */

import OpenAI from 'openai';
import { logger } from '../core/logger.js';

interface FormatContentParams {
  rawText: string;
  instructions: string;
  model?: string;
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
 * Truncate text to approximately 500-700 words to stay within token limits
 */
function truncateText(text: string, wordLimit: number = 700): string {
  const words = text.trim().split(/\s+/);
  
  if (words.length <= wordLimit) {
    return text;
  }
  
  return words.slice(0, wordLimit).join(' ');
}

/**
 * Generate image prompts from article text using OpenAI
 * Analyzes the text and creates visual scene descriptions suitable for image generation
 */
export async function generateImagePrompts(
  articleText: string,
  count: number = 3
): Promise<string[]> {
  logger.info(`Generating ${count} image prompts from article text`);
  
  // Validate input
  if (!articleText || articleText.trim().length < 100) {
    throw new Error('Article text too short for meaningful image prompt generation (minimum 100 characters)');
  }
  
  if (count < 1 || count > 5) {
    throw new Error('Image count must be between 1 and 5');
  }
  
  // Truncate text to stay within token limits
  const truncatedText = truncateText(articleText, 700);
  logger.info(`Truncated article text to ${truncatedText.split(/\s+/).length} words`);
  
  const client = getOpenAIClient();
  
  const systemPrompt = `You are an expert at creating vivid, visual scene descriptions for AI image generation. 
Your task is to analyze article text and suggest compelling visual scenes that would make great illustrations.
Each scene should be:
- Described in English
- 1-2 sentences long
- Concrete and visual (not abstract concepts)
- Relevant to the article content
- Suitable for photorealistic or artistic image generation

Return your response as a JSON array of strings.`;
  
  const userPrompt = `Analyze this article text and propose ${count} visual scenes for illustrations:

${truncatedText}

Provide exactly ${count} scene descriptions in JSON array format. Example:
["A scientist examining a glowing DNA helix in a dimly lit laboratory", "Abstract visualization of interconnected neural networks with vibrant blue and purple nodes"]`;
  
  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
    
    logger.info('Received response from OpenAI');
    
    // Parse JSON response
    const parsed = JSON.parse(content);
    
    // Handle different possible JSON structures
    let prompts: string[];
    if (Array.isArray(parsed)) {
      prompts = parsed;
    } else if (parsed.prompts && Array.isArray(parsed.prompts)) {
      prompts = parsed.prompts;
    } else if (parsed.scenes && Array.isArray(parsed.scenes)) {
      prompts = parsed.scenes;
    } else {
      // Try to extract first array found in the object
      const firstArray = Object.values(parsed).find(val => Array.isArray(val));
      if (firstArray && Array.isArray(firstArray)) {
        prompts = firstArray;
      } else {
        throw new Error('Unable to extract prompt array from OpenAI response');
      }
    }
    
    // Validate prompts
    if (!prompts || prompts.length === 0) {
      throw new Error('OpenAI returned empty prompts array');
    }
    
    // Take only requested count
    const finalPrompts = prompts.slice(0, count);
    
    logger.info(`Successfully generated ${finalPrompts.length} image prompts`);
    finalPrompts.forEach((prompt, idx) => {
      logger.info(`Prompt ${idx + 1}: ${prompt}`);
    });
    
    return finalPrompts;
    
  } catch (error) {
    logger.error('Error generating image prompts with OpenAI:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('authentication')) {
        throw new Error('OpenAI authentication failed. Check OPENAI_API_KEY.');
      }
    }
    
    throw error;
  }
}

export async function formatContent(params: FormatContentParams): Promise<string> {
  // TODO: Implement OpenAI content formatting
  console.log('Formatting content with OpenAI:', params);
  return '';
}

export async function generatePrompt(_context: string, type: string): Promise<string> {
  // TODO: Implement prompt generation
  console.log(`Generating ${type} prompt for context`);
  return '';
}
