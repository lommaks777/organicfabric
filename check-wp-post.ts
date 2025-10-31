import 'dotenv/config';
import axios from 'axios';

async function main() {
  const postId = process.argv[2] || '37241';
  
  const wpSiteUrl = process.env.WP_SITE_URL;
  const wpUsername = process.env.WP_USERNAME;
  const wpAppPassword = process.env.WP_APP_PASSWORD;
  
  const credentials = Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');
  
  try {
    const response = await axios.get(
      `${wpSiteUrl}/wp-json/wp/v2/posts/${postId}`,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      }
    );
    
    console.log('Post ID:', response.data.id);
    console.log('Title:', response.data.title.rendered);
    console.log('Status:', response.data.status);
    console.log('Featured Media:', response.data.featured_media);
    console.log('\nContent length:', response.data.content.rendered?.length || 0);
    console.log('Content preview (first 1000 chars):');
    console.log(response.data.content.rendered?.substring(0, 1000));
    
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
