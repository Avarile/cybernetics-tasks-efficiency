import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InitiativeService } from './initiative.service';
import {
  NewInitiativeDTO,
  UpdateInitiativeDTO,
  QueryInitiativeDTO,
  FindInitiativeByIdDTO,
  FindInitiativeBySlugDTO,
  LinkKeyResultDTO,
} from './initiative.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { subject } from '@casl/ability';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';
import { AppException } from 'src/utils/exception.provider';

@ApiTags('initiatives')
@Controller('initiatives')
export class InitiativeController {
  private readonly logger = new Logger(InitiativeController.name);

  constructor(
    private readonly initiativeService: InitiativeService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Initiative'))
  @ApiOperation({ summary: 'Create a new initiative' })
  @ApiResponse({ status: 201, description: 'Initiative created successfully' })
  async createInitiative(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewInitiativeDTO,
  ): Promise<IBaseResponse> {
    const result = await this.initiativeService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Initiative created successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Initiative'))
  @ApiOperation({ summary: 'Soft-delete an initiative' })
  async deleteInitiative(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindInitiativeByIdDTO,
  ): Promise<IBaseResponse> {
    const existing = await this.initiativeService.requireById(params.id, this.ctx.forUser(user.id));
    if (ability.cannot('delete', subject('Initiative', existing as unknown as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot delete this initiative');
    }
    await this.initiativeService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Initiative deleted successfully');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Initiative'))
  @ApiOperation({ summary: 'Update an initiative' })
  async updateInitiative(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindInitiativeByIdDTO,
    @Body() dto: UpdateInitiativeDTO,
  ): Promise<IBaseResponse> {
    const existing = await this.initiativeService.requireById(params.id, this.ctx.forUser(user.id));
    if (ability.cannot('update', subject('Initiative', existing as unknown as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot update this initiative');
    }
    const updated = await this.initiativeService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Initiative updated successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Initiative'))
  @ApiOperation({ summary: 'Fetch all non-deleted initiatives' })
  async getAllInitiatives(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.initiativeService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} initiatives`);
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Initiative'))
  @ApiOperation({ summary: 'Search initiatives with filters' })
  async searchInitiatives(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryInitiativeDTO,
  ): Promise<IBaseQueryResult> {
    return this.initiativeService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('slug/:slug')
  @CheckPolicies((a) => a.can('read', 'Initiative'))
  @ApiOperation({ summary: 'Get an initiative by slug' })
  async getInitiativeBySlug(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindInitiativeBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.initiativeService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    if (ability.cannot('read', subject('Initiative', result as unknown as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot view this initiative');
    }
    return buildOk(result, 'Initiative found');
  }

  @Post(':slug/key-results')
  @CheckPolicies((a) => a.can('update', 'Initiative'))
  @ApiOperation({ summary: 'Link a key result to an initiative' })
  async linkKeyResult(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LinkKeyResultDTO,
  ): Promise<IBaseResponse> {
    const ini = await this.initiativeService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.initiativeService.linkKeyResult(ini.id, dto.keyResultId, this.ctx.forUser(user.id));
    return buildOk(null, 'Key result linked successfully');
  }

  @Delete(':slug/key-results/:keyResultId')
  @CheckPolicies((a) => a.can('update', 'Initiative'))
  @ApiOperation({ summary: 'Unlink a key result from an initiative' })
  async unlinkKeyResult(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Param('keyResultId') keyResultId: string,
  ): Promise<IBaseResponse> {
    const ini = await this.initiativeService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.initiativeService.unlinkKeyResult(ini.id, Number(keyResultId), this.ctx.forUser(user.id));
    return buildOk(null, 'Key result unlinked successfully');
  }

  @Get(':slug/key-results')
  @CheckPolicies((a) => a.can('read', 'Initiative'))
  @ApiOperation({ summary: 'Get key result IDs for an initiative' })
  async findKeyResultIds(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const ini = await this.initiativeService.requireBySlug(slug, this.ctx.forUser(user.id));
    const ids = await this.initiativeService.findKeyResultIds(ini.id, this.ctx.forUser(user.id));
    return buildOk(ids, 'Key result IDs fetched successfully');
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Initiative'))
  @ApiOperation({ summary: 'Get an initiative by ID' })
  async getInitiativeById(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindInitiativeByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.initiativeService.requireById(params.id, this.ctx.forUser(user.id));
    if (ability.cannot('read', subject('Initiative', result as unknown as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot view this initiative');
    }
    return buildOk(result, 'Initiative found');
  }
}
