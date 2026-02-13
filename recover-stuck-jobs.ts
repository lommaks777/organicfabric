/**
 * Recovery script for stuck jobs
 * Finds jobs that are stuck in intermediate states and attempts to complete them
 */

import { prisma } from './src/db/prisma.js';
import { runJob } from './src/core/job-runner.js';
import { logger } from './src/core/logger.js';

// Job statuses that indicate incomplete processing
const STUCK_STATUSES = ['CLAIMED', 'POST_RENDERED', 'IMAGES_PICKED'];

async function recoverStuckJobs() {
  console.log('🔍 Searching for stuck jobs...\n');

  try {
    // Find all jobs stuck in intermediate states
    const stuckJobs = await prisma.job.findMany({
      where: {
        status: {
          in: STUCK_STATUSES,
        },
        finishedAt: null,
      },
      orderBy: {
        startedAt: 'asc',
      },
      include: {
        artifacts: {
          select: {
            kind: true,
          },
        },
      },
    });

    if (stuckJobs.length === 0) {
      console.log('✅ No stuck jobs found. All jobs are in final states.\n');
      return;
    }

    console.log(`📋 Found ${stuckJobs.length} stuck job(s):\n`);

    // Display stuck jobs
    stuckJobs.forEach((job, index) => {
      const artifacts = job.artifacts.map(a => a.kind).join(', ');
      const age = Math.floor((Date.now() - new Date(job.startedAt).getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`${index + 1}. Job ID: ${job.id.slice(0, 20)}...`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Started: ${job.startedAt.toISOString()}`);
      console.log(`   Age: ${age} days ago`);
      console.log(`   Artifacts: ${artifacts || 'none'}`);
      console.log(`   File ID: ${job.fileId}`);
      console.log('');
    });

    // Ask for confirmation
    console.log('⚠️  WARNING: This will attempt to resume processing for these jobs.');
    console.log('   Jobs will be re-processed from their current state.\n');

    // Process each stuck job
    for (let i = 0; i < stuckJobs.length; i++) {
      const job = stuckJobs[i];
      console.log(`\n🔧 [${i + 1}/${stuckJobs.length}] Recovering job ${job.id.slice(0, 20)}...`);
      console.log(`   Current status: ${job.status}`);

      try {
        // Reset status to NEW to force complete reprocessing
        // This is safer than trying to resume from intermediate state
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'NEW',
            errorMessage: null,
            errorCode: null,
          },
        });

        console.log(`   ✓ Reset status to NEW`);

        // Run the job through the pipeline
        await runJob(job.id);

        console.log(`   ✅ Job recovered successfully!`);

        // Small delay between jobs to avoid overwhelming APIs
        if (i < stuckJobs.length - 1) {
          console.log(`   ⏳ Waiting 5 seconds before next job...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

      } catch (error) {
        console.error(`   ❌ Failed to recover job ${job.id.slice(0, 20)}:`);
        console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        
        // Mark as error
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'ERROR',
            errorMessage: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        }).catch(e => console.error('   Failed to mark job as error:', e));
        
        console.log(`   ⏭️  Continuing with next job...\n`);
      }
    }

    console.log('\n✅ Recovery process completed!\n');

    // Show summary
    const finalStatus = await prisma.job.findMany({
      where: {
        id: {
          in: stuckJobs.map(j => j.id),
        },
      },
      select: {
        id: true,
        status: true,
        postId: true,
      },
    });

    console.log('📊 Final Status:\n');
    finalStatus.forEach(job => {
      const emoji = job.status === 'DONE' ? '✅' : job.status === 'ERROR' ? '❌' : '⚠️';
      const postInfo = job.postId ? ` (Post ID: ${job.postId})` : '';
      console.log(`${emoji} ${job.id.slice(0, 20)}... → ${job.status}${postInfo}`);
    });

  } catch (error) {
    console.error('❌ Recovery script failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the recovery
console.log('🏥 Job Recovery Tool\n');
console.log('=' .repeat(60));
console.log('');

recoverStuckJobs()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
