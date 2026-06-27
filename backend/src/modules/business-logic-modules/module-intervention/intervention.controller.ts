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
import { InterventionService } from './intervention.service';
import {
  NewInterventionDTO,
  UpdateInterventionDTO,
  QueryInterventionDTO,
  FindInterventionByIdDTO,
  FindInterventionBySlugDTO,
  LinkKeyResultToInterventionDTO,
} from './intervention.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('interventions')
@Controller('interventions')
export class InterventionController {
  private readonly logger = new Logger(InterventionController.name);

  constructor(
    private readonly interventionService: InterventionService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new intervention' })
  @ApiResponse({ status: 201, description: 'Intervention created successfully' })
  async createIntervention(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewInterventionDTO,
  ): Promise<IBaseResponse> {
    const result = await this.interventionService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Intervention created successfully');
  }

  @Delete(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete an intervention' })
  async deleteIntervention(
    @CurrentUser() user: IUserSession,
    @Param() params: FindInterventionByIdDTO,
  ): Promise<IBaseResponse> {
    await this.interventionService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Intervention deleted successfully');
  }

  @Patch(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update an intervention' })
  async updateIntervention(
    @CurrentUser() user: IUserSession,
    @Param() params: FindInterventionByIdDTO,
    @Body() dto: UpdateInterventionDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.interventionService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Intervention updated successfully');
  }

  @Get()
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted interventions' })
  async getAllInterventions(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.interventionService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} interventions`);
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search interventions with filters' })
  async searchInterventions(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryInterventionDTO,
  ): Promise<IBaseQueryResult> {
    return this.interventionService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('slug/:slug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an intervention by slug' })
  async getInterventionBySlug(
    @CurrentUser() user: IUserSession,
    @Param() params: FindInterventionBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.interventionService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    return buildOk(result, 'Intervention found');
  }

  @Post(':slug/key-results')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Link a key result to an intervention' })
  async linkKeyResult(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Body() dto: LinkKeyResultToInterventionDTO,
  ): Promise<IBaseResponse> {
    const inv = await this.interventionService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.interventionService.linkKeyResult(inv.id, dto.keyResultId, this.ctx.forUser(user.id));
    return buildOk(null, 'Key result linked successfully');
  }

  @Delete(':slug/key-results/:keyResultId')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Unlink a key result from an intervention' })
  async unlinkKeyResult(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
    @Param('keyResultId') keyResultId: string,
  ): Promise<IBaseResponse> {
    const inv = await this.interventionService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.interventionService.unlinkKeyResult(inv.id, Number(keyResultId), this.ctx.forUser(user.id));
    return buildOk(null, 'Key result unlinked successfully');
  }

  @Get(':slug/key-results')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get affected key result IDs for an intervention' })
  async findAffectedKeyResultIds(
    @CurrentUser() user: IUserSession,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const inv = await this.interventionService.requireBySlug(slug, this.ctx.forUser(user.id));
    const ids = await this.interventionService.findAffectedKeyResultIds(inv.id, this.ctx.forUser(user.id));
    return buildOk(ids, 'Affected key result IDs fetched successfully');
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an intervention by ID' })
  async getInterventionById(
    @CurrentUser() user: IUserSession,
    @Param() params: FindInterventionByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.interventionService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Intervention found');
  }
}
