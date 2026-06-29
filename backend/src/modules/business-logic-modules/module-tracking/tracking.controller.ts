import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { subject } from '@casl/ability';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { DbContextService } from 'src/infra/application-db/db-context';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk } from 'src/utils/shared/response.factory';
import { AppException } from 'src/utils/exception.provider';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { InitiativeRepository } from '../module-initiative/initiative.repo';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import { TaskRepository } from '../module-task/task.repo';
import { ActivityEventRepository } from './activity-event.repo';
import { TrackingService } from './tracking.service';
import {
  LogTimeDTO,
  RecordReasonDTO,
  RecordOutcomeDTO,
  MeasureKeyResultDTO,
  LifecyclePayloadDTO,
} from './tracking.dto';

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(
    private readonly trackingService: TrackingService,
    private readonly initiativeRepo: InitiativeRepository,
    private readonly keyResultRepo: KeyResultRepository,
    private readonly activityEventRepo: ActivityEventRepository,
    private readonly ctx: DbContextService,
    private readonly taskRepo: TaskRepository,
  ) {}

  private async resolveInitiative(slug: string, ctx: ReturnType<DbContextService['forUser']>) {
    const ini = await this.initiativeRepo.findBySlug(slug, ctx);
    if (!ini) AppException.notFound('Initiative', slug);
    return ini!;
  }

  private async resolveKeyResult(slug: string, ctx: ReturnType<DbContextService['forUser']>) {
    const kr = await this.keyResultRepo.findBySlug(slug, ctx);
    if (!kr) AppException.notFound('KeyResult', slug);
    return kr!;
  }

  private async resolveTask(slug: string, ctx: ReturnType<DbContextService['forUser']>) {
    const t = await this.taskRepo.findBySlug(slug, ctx);
    if (!t) AppException.notFound('Task', slug);
    return t!;
  }

  // -------------------------------------------------------------------------
  // Initiative lifecycle
  // -------------------------------------------------------------------------

  @Post('initiatives/:slug/start')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Start an initiative' })
  async start(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.start(ini.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Initiative started');
  }

  @Post('initiatives/:slug/pause')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Pause an initiative' })
  async pause(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.pause(ini.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Initiative paused');
  }

  @Post('initiatives/:slug/resume')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Resume an initiative' })
  async resume(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.resume(ini.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Initiative resumed');
  }

  @Post('initiatives/:slug/block')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Block an initiative' })
  async block(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.block(ini.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Initiative blocked');
  }

  @Post('initiatives/:slug/unblock')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Unblock an initiative' })
  async unblock(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.unblock(ini.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Initiative unblocked');
  }

  @Post('initiatives/:slug/complete')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Complete an initiative' })
  async complete(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.complete(ini.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Initiative completed');
  }

  @Post('initiatives/:slug/cancel')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Cancel an initiative' })
  async cancel(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.cancel(ini.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Initiative cancelled');
  }

  // -------------------------------------------------------------------------
  // Time + reason + outcome
  // -------------------------------------------------------------------------

  @Post('initiatives/:slug/time')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Log time on an initiative' })
  async logTime(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LogTimeDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.logTime(ini.id, user.id, dto.minutes, tenancy);
    return buildOk(event, 'Time logged');
  }

  @Post('initiatives/:slug/reason')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Record a reason on an initiative' })
  async recordReason(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: RecordReasonDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.recordReason(
      'initiative',
      ini.id,
      user.id,
      { reason: dto.reason, reasonClass: dto.reasonClass },
      tenancy,
    );
    return buildOk(event, 'Reason recorded');
  }

  @Post('initiatives/:slug/outcome')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Record outcome on an initiative' })
  async recordOutcome(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: RecordOutcomeDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const event = await this.trackingService.recordOutcome(ini.id, user.id, { result: dto.result }, tenancy);
    return buildOk(event, 'Outcome recorded');
  }

  // -------------------------------------------------------------------------
  // Initiative timeline
  // -------------------------------------------------------------------------

  @Get('initiatives/:slug/timeline')
  @CheckPolicies((a) => a.can('read', 'ActivityEvent'))
  @ApiOperation({ summary: 'Get activity timeline for an initiative' })
  async getTimeline(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const ini = await this.resolveInitiative(slug, tenancy);
    const events = await this.activityEventRepo.listBySubject('initiative', ini.id, tenancy);
    return buildOk(events, 'Timeline retrieved');
  }

  // -------------------------------------------------------------------------
  // Key result measurement
  // -------------------------------------------------------------------------

  @Post('key-results/:slug/measure')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Measure a key result' })
  async measureKeyResult(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: MeasureKeyResultDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const kr = await this.resolveKeyResult(slug, tenancy);
    const event = await this.trackingService.measureKeyResult(kr.id, user.id, dto.value, tenancy);
    return buildOk(event, 'Key result measured');
  }

  // -------------------------------------------------------------------------
  // Task lifecycle
  // -------------------------------------------------------------------------

  @Post('tasks/:slug/start')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Start a task' })
  async startTask(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.startTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task started');
  }

  @Post('tasks/:slug/pause')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Pause a task' })
  async pauseTask(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.pauseTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task paused');
  }

  @Post('tasks/:slug/resume')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Resume a task' })
  async resumeTask(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.resumeTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task resumed');
  }

  @Post('tasks/:slug/block')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Block a task' })
  async blockTask(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.blockTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task blocked');
  }

  @Post('tasks/:slug/unblock')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Unblock a task' })
  async unblockTask(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.unblockTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task unblocked');
  }

  @Post('tasks/:slug/complete')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Complete a task' })
  async completeTask(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.completeTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task completed');
  }

  @Post('tasks/:slug/cancel')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Cancel a task' })
  async cancelTask(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.cancelTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task cancelled');
  }

  @Post('tasks/:slug/time')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Log time on a task' })
  async logTaskTime(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LogTimeDTO,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.logTaskTime(t.id, user.id, dto.minutes, tenancy);
    return buildOk(event, 'Time logged');
  }

  @Get('tasks/:slug/timeline')
  @CheckPolicies((a) => a.can('read', 'ActivityEvent'))
  @ApiOperation({ summary: 'Get activity timeline for a task' })
  async getTaskTimeline(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const events = await this.activityEventRepo.listBySubject('task', t.id, tenancy);
    return buildOk(events, 'Timeline retrieved');
  }
}
