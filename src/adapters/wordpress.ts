/**
 * WordPress Adapter - WordPress REST API client
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { logger } from '../core/logger.js';

interface CreatePostParams {
  title: string;
  content: string;
  status: string;
  featuredMedia?: number;
  categories?: number[];
  tags?: number[];
}

interface CreatePostResponse {
  id: number;
  editLink: string;
}

interface UploadMediaResponse {
  id: number;
  url: string;
}

/**
 * Get authenticated WordPress API client
 */
function getWordPressClient(): AxiosInstance {
  const wpSiteUrl = process.env.WP_SITE_URL;
  const wpUsername = process.env.WP_USERNAME;
  const wpAppPassword = process.env.WP_APP_PASSWORD;

  if (!wpSiteUrl || !wpUsername || !wpAppPassword) {
    throw new Error('WordPress credentials not configured. Required: WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD');
  }

  // Create base64 encoded credentials for Basic Auth
  const credentials = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');

  return axios.create({
    baseURL: wpSiteUrl,
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function createPost(params: CreatePostParams): Promise<CreatePostResponse> {
  const client = getWordPressClient();
  
  const response = await client.post('/wp-json/wp/v2/posts', {
    title: params.title,
    content: params.content,
    status: params.status,
    featured_media: params.featuredMedia,
    categories: params.categories,
    tags: params.tags,
  });

  return {
    id: response.data.id,
    editLink: response.data.link || '',
  };
}

export async function uploadMedia(
  fileBuffer: Buffer,
  filename: string
): Promise<UploadMediaResponse> {
  logger.info(`Uploading media to WordPress: ${filename}`);
  
  const wpSiteUrl = process.env.WP_SITE_URL;
  const wpUsername = process.env.WP_USERNAME;
  const wpAppPassword = process.env.WP_APP_PASSWORD;

  if (!wpSiteUrl || !wpUsername || !wpAppPassword) {
    throw new Error('WordPress credentials not configured. Required: WP_SITE_URL, WP_USERNAME, WP_APP_PASSWORD');
  }
  
  // Validate buffer
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File buffer is empty');
  }
  
  logger.info(`File buffer size: ${fileBuffer.length} bytes`);
  
  // Create FormData object
  const formData = new FormData();
  
  // Append file to form data
  // The file field name must be 'file' for WordPress
  formData.append('file', fileBuffer, {
    filename: filename,
    contentType: 'image/png', // Vertex AI generates PNG images
  });
  
  // Create base64 encoded credentials for Basic Auth
  const credentials = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');
  
  try {
    // Upload to WordPress
    const response = await axios.post(
      `${wpSiteUrl}/wp-json/wp/v2/media`,
      formData,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          ...formData.getHeaders(), // This includes Content-Type with boundary
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    
    logger.info(`Media uploaded successfully. ID: ${response.data.id}, URL: ${response.data.source_url}`);
    
    return {
      id: response.data.id,
      url: response.data.source_url,
    };
    
  } catch (error) {
    logger.error('Error uploading media to WordPress:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('WordPress authentication failed. Check WP_USERNAME and WP_APP_PASSWORD.');
      }
      if (error.response?.status === 413) {
        throw new Error('File size too large for WordPress. Check server upload limits.');
      }
      if (error.response?.data?.message) {
        throw new Error(`WordPress upload failed: ${error.response.data.message}`);
      }
    }
    
    throw error;
  }
}

export async function updatePost(postId: number, params: Partial<CreatePostParams>): Promise<void> {
  // TODO: Implement post update
  console.log(`Updating post ${postId}:`, params);
}
