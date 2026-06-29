import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from 'src/infra/queue/base.processor';
import { QueueName } from 'src/infra/queue/queue.constants';
import { DbContextService } from 'src/infra/application-db/db-context';
import { FileRepository } from './file.repo';
import { FileStorageService } from './file.storage.service';
import { isImage } from './file.util';

export interface IFileCropJob {
  bucket: string;
  token: string;
  path: string;
  mimetype: string;
  height?: number | null;
  userId: number;
}

@Processor(QueueName.FILE_CROP)
export class FileCropProcessor extends BaseProcessor {
  constructor(
    private readonly repo: FileRepository,
    private readonly storage: FileStorageService,
    private readonly dbContext: DbContextService,
  ) {
    super();
  }

  async handle(job: Job<IFileCropJob>): Promise<void> {
    const { bucket, token, path, mimetype, height, userId } = job.data;
    const ctx = this.dbContext.forUser(userId);

    const existing = await this.repo.findByToken(token, ctx);
    if (!existing) {
      this.logger.warn(`crop: attachment ${token} not found`);
      return;
    }
    if (existing.thumbnailPath) return;

    // v1: images only. PDF first-page rendering is a documented follow-up
    // (needs a native canvas dep); non-image types are intentionally skipped.
    if (!isImage(mimetype) || !height) {
      this.logger.debug(`crop: ${token} (${mimetype}) not eligible for thumbnails`);
      return;
    }

    const { sm, lg } = await this.storage.cropImageThumbnails(bucket, path, height);
    await this.repo.setThumbnailPath(token, JSON.stringify({ sm, lg }), ctx);
  }
}
