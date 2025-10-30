/**
 * WordPress Adapter - WordPress REST API client
 */

import axios, { AxiosInstance } from 'axios';

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
  _fileBuffer: Buffer,
  filename: string
): Promise<UploadMediaResponse> {
  // TODO: Implement WordPress media upload
  console.log(`Uploading media: ${filename}`);
  return {
    id: 0,
    url: '',
  };
}

export async function updatePost(postId: number, params: Partial<CreatePostParams>): Promise<void> {
  // TODO: Implement post update
  console.log(`Updating post ${postId}:`, params);
}
