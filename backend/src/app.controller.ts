import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { AppException } from 'src/utils/exception.provider';

// Health probes stay unversioned (/api/health) so orchestrators have a stable
// path independent of the API version.
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly db: ApplicationDBProvider) {}

  /** Liveness: the process is up and serving requests. */
  @Get()
  health() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies (the database) are reachable. */
  @Get('ready')
  async ready() {
    try {
      await this.db.ping();
    } catch {
      AppException.throw('SERVICE_UNAVAILABLE', 'Database not reachable');
    }
    return { status: 'ready', db: 'up' };
  }
}
