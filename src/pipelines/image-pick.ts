/**
 * Image Pick - Image generation and upload pipeline
 */

import { generateImagePrompts } from '../adapters/llm-openai.js';
import { generateImages } from '../adapters/image-vertex-imagen.js';
import { uploadMedia } from '../adapters/wordpress.js';
import { logger } from '../core/logger.js';

interface ImageMetadata {
  url: string;
  alt: string;
  wpMediaId: number;
  prompt?: string;
}

/**
 * Main orchestrator for image generation and upload workflow
 * Coordinates: text analysis → prompt generation → image generation → WordPress upload
 */
export async function generateAndUploadImages(
  jobId: string,
  content: string,
  imageCount: number = 1
): Promise<ImageMetadata[]> {
  logger.info(`[Job ${jobId}] Starting image generation pipeline for ${imageCount} images`);
  
  try {
    // Step 1: Generate image prompts using OpenAI
    logger.info(`[Job ${jobId}] Step 1: Generating image prompts from content`);
    const prompts = await generateImagePrompts(content, imageCount);
    logger.info(`[Job ${jobId}] Generated ${prompts.length} prompts`);
    
    // Step 2: Generate images using Vertex AI Imagen
    logger.info(`[Job ${jobId}] Step 2: Generating images with Vertex AI`);
    const generatedImages = await generateImages({ prompts });
    logger.info(`[Job ${jobId}] Generated ${generatedImages.length} images`);
    
    // Step 3: Upload each image to WordPress
    logger.info(`[Job ${jobId}] Step 3: Uploading images to WordPress`);
    const uploadedImages: ImageMetadata[] = [];
    
    for (let i = 0; i < generatedImages.length; i++) {
      const image = generatedImages[i];
      
      if (!image.imageData) {
        logger.warn(`[Job ${jobId}] Image ${i + 1} has no data, skipping upload`);
        continue;
      }
      
      try {
        // Generate filename: job-{jobId}-image-{index}.png
        const filename = `job-${jobId}-image-${i + 1}.png`;
        
        logger.info(`[Job ${jobId}] Uploading image ${i + 1}/${generatedImages.length}: ${filename}`);
        
        // Upload to WordPress
        const uploadResult = await uploadMedia(image.imageData, filename);
        
        // Store metadata
        uploadedImages.push({
          url: uploadResult.url,
          alt: '', // Alt text can be generated in future iteration
          wpMediaId: uploadResult.id,
          prompt: image.prompt,
        });
        
        logger.info(`[Job ${jobId}] Image ${i + 1} uploaded successfully. Media ID: ${uploadResult.id}`);
        
      } catch (uploadError) {
        logger.error(`[Job ${jobId}] Failed to upload image ${i + 1}:`, uploadError);
        // Continue with remaining images rather than failing entire pipeline
      }
    }
    
    // Validate we have at least one successful upload
    if (uploadedImages.length === 0) {
      throw new Error('Failed to upload any images to WordPress');
    }
    
    logger.info(`[Job ${jobId}] Image generation pipeline complete. Uploaded ${uploadedImages.length} images`);
    
    // Log summary
    uploadedImages.forEach((img, idx) => {
      logger.info(`[Job ${jobId}] Image ${idx + 1}: ID=${img.wpMediaId}, URL=${img.url}`);
    });
    
    return uploadedImages;
    
  } catch (error) {
    logger.error(`[Job ${jobId}] Image generation pipeline failed:`, error);
    throw error;
  }
}

export async function selectBestImage(
  _images: ImageMetadata[],
  criteria: string
): Promise<ImageMetadata | null> {
  // TODO: Implement image selection logic
  console.log(`Selecting best image based on: ${criteria}`);
  return null;
}
