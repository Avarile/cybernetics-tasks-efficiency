import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { ReadinessService } from 'src/infra/health/readiness.service';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    return this.readiness.check();
  }
}
