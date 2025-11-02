import 'dotenv/config';
import { prisma } from './dist/db/prisma.js';

async function main() {
  const lastJob = await prisma.job.findFirst({
    where: { status: 'DONE' },
    orderBy: { finishedAt: 'desc' }
  });
  
  if (lastJob) {
    console.log('📌 Последняя задача:');
    console.log(`   Job ID: ${lastJob.id}`);
    console.log(`   File ID: ${lastJob.fileId}`);
    console.log(`   Post ID: ${lastJob.postId}`);
    console.log(`   Status: ${lastJob.status}`);
  } else {
    console.log('❌ Нет завершенных задач');
  }
  
  await prisma.$disconnect();
}

main();
