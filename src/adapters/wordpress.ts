/**
 * WordPress Adapter - WordPress REST API client
 */

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

export async function createPost(params: CreatePostParams): Promise<CreatePostResponse> {
  // TODO: Implement WordPress post creation
  console.log('Creating WordPress post:', params);
  return {
    id: 0,
    editLink: '',
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
