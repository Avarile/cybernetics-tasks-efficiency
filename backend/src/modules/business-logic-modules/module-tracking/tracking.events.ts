import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { IActivityEventEntity } from './tracking.interface';

export const ACTIVITY_EVENT_EMITTED = 'activity_event.emitted';

export interface ActivityEventEmitted {
  event: IActivityEventEntity;
  ctx: IDBConfigOptions;
}
