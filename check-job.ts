import { prisma } from './dist/db/prisma.js';

async function main() {
  const jobId = process.argv[2];
  
  if (!jobId) {
    console.log('Usage: npx tsx check-job.ts <jobId>');
    process.exit(1);
  }
  
  const job = await prisma.job.findFirst({
    where: { id: jobId },
    include: { artifacts: true },
  });
  
  if (!job) {
    console.log('Job not found');
    process.exit(1);
  }
  
  console.log('=== JOB INFO ===');
  console.log('ID:', job.id);
  console.log('Status:', job.status);
  console.log('Post ID:', job.postId);
  console.log('Post Link:', job.postEditLink);
  
  console.log('\n=== ARTIFACTS ===');
  job.artifacts.forEach(artifact => {
    console.log(`\n- ${artifact.kind}`);
    const content = artifact.content as any;
    
    if (artifact.kind === 'RAW_CONTENT') {
      console.log('  Keys:', Object.keys(content));
      console.log('  Text length:', content.text?.length || 0);
      console.log('  HTML length:', content.html?.length || 0);
    }
    
    if (artifact.kind === 'IMAGE_META') {
      console.log('  Images count:', content.images?.length || 0);
      content.images?.forEach((img: any, i: number) => {
        console.log(`  Image ${i + 1}: ${img.url}`);
      });
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
