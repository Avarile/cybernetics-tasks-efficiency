import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/infra/queue/queue.constants';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileStorageService } from './file.storage.service';
import { FileRepository } from './file.repo';
import { FileCropProcessor } from './file.crop.processor';
import { storageAdapterProvider } from './plugins/storage.provider';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.FILE_CROP })],
  controllers: [FileController],
  providers: [FileRepository, FileService, FileStorageService, FileCropProcessor, storageAdapterProvider],
  exports: [FileService, FileStorageService],
})
export class FileManagementModule {}
