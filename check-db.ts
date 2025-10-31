import { prisma } from './src/db/prisma.js';

async function main() {
  const jobs = await prisma.job.findMany({ 
    orderBy: { startedAt: 'desc' }, 
    take: 1, 
    include: { artifacts: true } 
  });
  
  if (jobs.length === 0) {
    console.log('No jobs found');
    return;
  }
  
  const job = jobs[0];
  console.log('=== JOB INFO ===');
  console.log('ID:', job.id);
  console.log('Status:', job.status);
  console.log('Post Edit Link:', job.postEditLink || 'N/A');
  console.log('\n=== ARTIFACTS ===');
  
  for (const artifact of job.artifacts) {
    console.log(`\n--- Artifact: ${artifact.kind} ---`);
    if (artifact.kind === 'HTML') {
      const content = artifact.content as any;
      console.log('HTML length:', JSON.stringify(content).length);
      console.log('First 200 chars:', JSON.stringify(content).substring(0, 200));
    } else if (artifact.kind === 'WIDGET_DECISION') {
      console.log('Widgets:', JSON.stringify(artifact.content, null, 2));
    } else {
      console.log('Content:', JSON.stringify(artifact.content, null, 2).substring(0, 500));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
