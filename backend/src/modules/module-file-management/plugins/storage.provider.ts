import type { Provider } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import env from 'src/utils/env';
import { STORAGE_ADAPTER } from './adapter';
import { LocalStorage } from './local';
import { MinioStorage } from './minio';

export const storageAdapterProvider: Provider = {
  provide: STORAGE_ADAPTER,
  useFactory: () => {
    Logger.log(`[Storage provider]: ${env.FILE_STORAGE_PROVIDER}`, 'FileManagement');
    return env.FILE_STORAGE_PROVIDER === 'minio' ? new MinioStorage() : new LocalStorage();
  },
};
