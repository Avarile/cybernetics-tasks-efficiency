export enum QueueName {
  EXAMPLE = 'example',
  FILE_CROP = 'file-crop',
}

export const FILE_CROP_JOB = 'crop_image';

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
