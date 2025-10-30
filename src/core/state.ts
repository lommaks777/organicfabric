/**
 * State Management - Job lifecycle and state transitions
 */

import { prisma } from '../db/prisma.js';

interface JobCreateParams {
  fileId: string;
  revisionId: string;
}

interface JobUpdateParams {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  postId?: number;
  postEditLink?: string;
}

export async function createJob(params: JobCreateParams): Promise<any> {
  const job = await prisma.job.create({
    data: {
      fileId: params.fileId,
      revisionId: params.revisionId,
      status: 'NEW',
    },
  });

  return job;
}

export async function updateJobStatus(
  jobId: string,
  status: string,
  metadata?: Partial<JobUpdateParams>
): Promise<any> {
  const updateData: any = {
    status,
  };

  // Merge metadata fields if provided
  if (metadata) {
    if (metadata.errorCode !== undefined) updateData.errorCode = metadata.errorCode;
    if (metadata.errorMessage !== undefined) updateData.errorMessage = metadata.errorMessage;
    if (metadata.postId !== undefined) updateData.postId = metadata.postId;
    if (metadata.postEditLink !== undefined) updateData.postEditLink = metadata.postEditLink;
  }

  // Update finishedAt timestamp for terminal states
  if (status === 'DONE' || status === 'ERROR') {
    updateData.finishedAt = new Date();
  }

  const job = await prisma.job.update({
    where: { id: jobId },
    data: updateData,
  });

  return job;
}

export async function getJob(jobId: string): Promise<any> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  return job;
}
