/**
 * Vertex AI Imagen Adapter - Image generation using Google Vertex AI
 */

import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { google } from '@google-cloud/aiplatform/build/protos/protos.js';
import { logger } from '../core/logger.js';

interface GenerateImagesParams {
  prompts: string[];
  model?: string;
  aspectRatio?: string;
}

interface GeneratedImage {
  prompt: string;
  imageUrl: string;
  imageData?: Buffer;
}

/**
 * Get authenticated Vertex AI client
 */
function getVertexAIClient(): { client: PredictionServiceClient; projectId: string; location: string } {
  const projectId = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  
  if (!projectId) {
    throw new Error('VERTEX_PROJECT_ID not configured in environment variables');
  }
  
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured in environment variables');
  }
  
  // Parse service account JSON
  let credentials;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch (error) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format. Must be valid JSON.');
  }
  
  // Initialize client with credentials
  const client = new PredictionServiceClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId,
  });
  
  return { client, projectId, location };
}

/**
 * Generate images from text prompts using Vertex AI Imagen
 */
export async function generateImages(params: GenerateImagesParams): Promise<GeneratedImage[]> {
  const { prompts, model = 'imagegeneration@006', aspectRatio = '1:1' } = params;
  
  logger.info(`Generating ${prompts.length} images with Vertex AI Imagen`);
  
  if (!prompts || prompts.length === 0) {
    throw new Error('No prompts provided for image generation');
  }
  
  const { client, projectId, location } = getVertexAIClient();
  const results: GeneratedImage[] = [];
  
  // Process each prompt sequentially to avoid quota issues
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    logger.info(`Generating image ${i + 1}/${prompts.length} for prompt: ${prompt}`);
    
    try {
      // Construct endpoint path
      const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${model}`;
      
      // Prepare prediction request
      const instanceValue = {
        prompt: prompt,
      };
      
      const parametersValue = {
        sampleCount: 1,
        aspectRatio: aspectRatio,
        safetyFilterLevel: 'block_some',
        personGeneration: 'allow_adult',
        negativePrompt: 'blurry, low quality, deformed hands, extra fingers, mutated hands, bad anatomy, ugly, disfigured'
      };
      
      const instance = {
        structValue: {
          fields: {
            prompt: {
              stringValue: instanceValue.prompt,
            },
          },
        },
      };
      
      const parameters = {
        structValue: {
          fields: {
            sampleCount: {
              numberValue: parametersValue.sampleCount,
            },
            aspectRatio: {
              stringValue: parametersValue.aspectRatio,
            },
            safetyFilterLevel: {
              stringValue: parametersValue.safetyFilterLevel,
            },
            negativePrompt: {
              stringValue: parametersValue.negativePrompt,
            },
            personGeneration: {
              stringValue: parametersValue.personGeneration,
            },
          },
        },
      };
      
      // Make prediction request
      const [response] = await client.predict({
        endpoint,
        instances: [instance as google.protobuf.IValue],
        parameters: parameters as google.protobuf.IValue,
      });
      
      // Extract image data from response
      if (!response.predictions || response.predictions.length === 0) {
        logger.warn(`No image generated for prompt: ${prompt}`);
        continue;
      }
      
      const prediction = response.predictions[0];
      
      // Extract base64 image data
      let base64Image: string | null = null;
      
      if (prediction.structValue?.fields?.bytesBase64Encoded?.stringValue) {
        base64Image = prediction.structValue.fields.bytesBase64Encoded.stringValue;
      }
      
      if (!base64Image) {
        logger.warn(`No image data in response for prompt: ${prompt}`);
        continue;
      }
      
      // Convert base64 to Buffer
      const imageBuffer = Buffer.from(base64Image, 'base64');
      
      logger.info(`Image ${i + 1} generated successfully. Size: ${imageBuffer.length} bytes`);
      
      results.push({
        prompt,
        imageUrl: '', // URL will be set after WordPress upload
        imageData: imageBuffer,
      });
      
    } catch (error) {
      logger.error(`Error generating image for prompt "${prompt}":`, error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('quota')) {
          throw new Error('Vertex AI quota exceeded. Please check your project quota.');
        }
        if (error.message.includes('authentication') || error.message.includes('permission')) {
          throw new Error('Vertex AI authentication failed. Check service account credentials.');
        }
        if (error.message.includes('safety')) {
          logger.warn(`Image generation blocked by safety filters for prompt: ${prompt}`);
          continue; // Skip this image, continue with others
        }
      }
      
      // For other errors, log and continue with remaining prompts
      logger.warn(`Skipping image ${i + 1} due to error, continuing with remaining prompts`);
    }
  }
  
  if (results.length === 0) {
    throw new Error('Failed to generate any images. All attempts failed.');
  }
  
  logger.info(`Successfully generated ${results.length} out of ${prompts.length} images`);
  return results;
}

export async function upscaleImage(_imageData: Buffer): Promise<Buffer> {
  // TODO: Implement image upscaling
  console.log('Upscaling image with Vertex AI');
  return Buffer.from('');
}
