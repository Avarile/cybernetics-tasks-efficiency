import {
  Body,
  Controller,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from 'src/middleware/auth.guard';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { Role, Roles } from 'src/middleware/roles.decorator';
import { DbContextService } from 'src/infra/application-db/db-context';
import { IBaseResponse } from 'src/utils/shared/interface';
import { AppException, BusinessException } from 'src/utils/exception.provider';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { InitiativeRepository } from '../module-initiative/initiative.repo';
import { KeyResultRepository } from '../module-key-result/key-result.repo';
import { TrackingService } from './tracking.service';
import {
  LogTimeDTO,
  RecordReasonDTO,
  RecordOutcomeDTO,
  MeasureKeyResultDTO,
  LifecyclePayloadDTO,
} from './tracking.dto';

@ApiTags('tracking')
@UseGuards(AuthGuard, RoleControllerGuard)
@Controller('tracking')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(
    private readonly trackingService: TrackingService,
    private readonly initiativeRepo: InitiativeRepository,
    private readonly keyResultRepo: KeyResultRepository,
    private readonly ctx: DbContextService,
  ) {}

  private actor(req: Request): number {
    return ((req as any)['user'] as IUserSession).id;
  }

  private buildResponse(data: unknown, message: string): IBaseResponse {
    return { data, status_code: HttpStatus.OK, message, timestamp: new Date(), error: null };
  }

  private async resolveInitiative(slug: string, ctx: ReturnType<DbContextService['forUser']>) {
    const ini = await this.initiativeRepo.findBySlug(slug, ctx);
    if (!ini) {
      AppException.throw('RESOURCE_NOT_FOUND', `Initiative with slug '${slug}' not found`);
    }
    return ini!;
  }

  private async resolveKeyResult(slug: string, ctx: ReturnType<DbContextService['forUser']>) {
    const kr = await this.keyResultRepo.findBySlug(slug, ctx);
    if (!kr) {
      AppException.throw('RESOURCE_NOT_FOUND', `Key result with slug '${slug}' not found`);
    }
    return kr!;
  }

  // -------------------------------------------------------------------------
  // Initiative lifecycle
  // -------------------------------------------------------------------------

  @Post('initiatives/:slug/start')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Start an initiative' })
  async start(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.start(ini.id, actorId, tenancy, dto.payload);
      return this.buildResponse(event, 'Initiative started');
    } catch (e: any) {
      this.logger.error(`start ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/pause')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Pause an initiative' })
  async pause(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.pause(ini.id, actorId, tenancy, dto.payload);
      return this.buildResponse(event, 'Initiative paused');
    } catch (e: any) {
      this.logger.error(`pause ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/resume')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Resume an initiative' })
  async resume(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.resume(ini.id, actorId, tenancy, dto.payload);
      return this.buildResponse(event, 'Initiative resumed');
    } catch (e: any) {
      this.logger.error(`resume ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/block')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Block an initiative' })
  async block(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.block(ini.id, actorId, tenancy, dto.payload);
      return this.buildResponse(event, 'Initiative blocked');
    } catch (e: any) {
      this.logger.error(`block ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/unblock')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Unblock an initiative' })
  async unblock(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.unblock(ini.id, actorId, tenancy, dto.payload);
      return this.buildResponse(event, 'Initiative unblocked');
    } catch (e: any) {
      this.logger.error(`unblock ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/complete')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Complete an initiative' })
  async complete(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.complete(ini.id, actorId, tenancy, dto.payload);
      return this.buildResponse(event, 'Initiative completed');
    } catch (e: any) {
      this.logger.error(`complete ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/cancel')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Cancel an initiative' })
  async cancel(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LifecyclePayloadDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.cancel(ini.id, actorId, tenancy, dto.payload);
      return this.buildResponse(event, 'Initiative cancelled');
    } catch (e: any) {
      this.logger.error(`cancel ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  // -------------------------------------------------------------------------
  // Time + reason + outcome
  // -------------------------------------------------------------------------

  @Post('initiatives/:slug/time')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Log time on an initiative' })
  async logTime(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LogTimeDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.logTime(ini.id, actorId, dto.minutes, tenancy);
      return this.buildResponse(event, 'Time logged');
    } catch (e: any) {
      this.logger.error(`logTime ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/reason')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Record a reason on an initiative' })
  async recordReason(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: RecordReasonDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.recordReason(
        'initiative',
        ini.id,
        actorId,
        { reason: dto.reason, reasonClass: dto.reasonClass },
        tenancy,
      );
      return this.buildResponse(event, 'Reason recorded');
    } catch (e: any) {
      this.logger.error(`recordReason ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  @Post('initiatives/:slug/outcome')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Record outcome on an initiative' })
  async recordOutcome(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: RecordOutcomeDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const ini = await this.resolveInitiative(slug, tenancy);
      const event = await this.trackingService.recordOutcome(ini.id, actorId, { result: dto.result }, tenancy);
      return this.buildResponse(event, 'Outcome recorded');
    } catch (e: any) {
      this.logger.error(`recordOutcome ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }

  // -------------------------------------------------------------------------
  // Key result measurement
  // -------------------------------------------------------------------------

  @Post('key-results/:slug/measure')
  @Roles(Role.member, Role.manager, Role.admin, Role.executive)
  @ApiOperation({ summary: 'Measure a key result' })
  async measureKeyResult(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: MeasureKeyResultDTO,
  ): Promise<IBaseResponse> {
    try {
      const actorId = this.actor(req);
      const tenancy = this.ctx.forUser(actorId);
      const kr = await this.resolveKeyResult(slug, tenancy);
      const event = await this.trackingService.measureKeyResult(kr.id, actorId, dto.value, tenancy);
      return this.buildResponse(event, 'Key result measured');
    } catch (e: any) {
      this.logger.error(`measureKeyResult ${slug}: ${e.message}`);
      if (e instanceof BusinessException) throw e;
      AppException.throw('SYSTEM_INTERNAL_ERROR', e.message);
    }
  }
}
