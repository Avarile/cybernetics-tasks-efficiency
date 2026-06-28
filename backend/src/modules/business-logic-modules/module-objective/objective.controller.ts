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
import { ObjectiveService } from './objective.service';
import {
  NewObjectiveDTO,
  UpdateObjectiveDTO,
  QueryObjectiveDTO,
  FindObjectiveByIdDTO,
  FindObjectiveBySlugDTO,
  ScopeQueryDTO,
} from './objective.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('objectives')
@Controller('objectives')
export class ObjectiveController {
  private readonly logger = new Logger(ObjectiveController.name);

  constructor(
    private readonly objectiveService: ObjectiveService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Objective'))
  @ApiOperation({ summary: 'Create a new objective' })
  @ApiResponse({ status: 201, description: 'Objective created successfully' })
  async createObjective(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewObjectiveDTO,
  ): Promise<IBaseResponse> {
    const result = await this.objectiveService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Objective created successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Objective'))
  @ApiOperation({ summary: 'Soft-delete an objective' })
  async deleteObjective(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindObjectiveByIdDTO,
  ): Promise<IBaseResponse> {
    await this.objectiveService.remove(params.id, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Objective deleted successfully');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Objective'))
  @ApiOperation({ summary: 'Update an objective' })
  async updateObjective(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindObjectiveByIdDTO,
    @Body() dto: UpdateObjectiveDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.objectiveService.update(params.id, dto, this.ctx.forUser(user.id), ability);
    return buildOk(updated, 'Objective updated successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Objective'))
  @ApiOperation({ summary: 'Fetch all non-deleted objectives' })
  async getAllObjectives(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.objectiveService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} objectives`);
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Objective'))
  @ApiOperation({ summary: 'Search objectives with filters' })
  async searchObjectives(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryObjectiveDTO,
  ): Promise<IBaseQueryResult> {
    return this.objectiveService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('owner/:ownerPersonId')
  @CheckPolicies((a) => a.can('read', 'Objective'))
  @ApiOperation({ summary: 'Get objectives by owner' })
  async getObjectivesByOwner(
    @CurrentUser() user: IUserSession,
    @Param('ownerPersonId') ownerPersonId: string,
  ): Promise<IBaseResponse> {
    const data = await this.objectiveService.findByOwner(Number(ownerPersonId), this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} objectives for owner`);
  }

  @Post('scope')
  @CheckPolicies((a) => a.can('read', 'Objective'))
  @ApiOperation({ summary: 'Get objectives by scope' })
  async getObjectivesByScope(
    @CurrentUser() user: IUserSession,
    @Body() body: ScopeQueryDTO,
  ): Promise<IBaseResponse> {
    const data = await this.objectiveService.findByScope(body.scope, body.scopeRefId, this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} objectives for scope`);
  }

  @Get('slug/:slug')
  @CheckPolicies((a) => a.can('read', 'Objective'))
  @ApiOperation({ summary: 'Get an objective by slug' })
  async getObjectiveBySlug(
    @CurrentUser() user: IUserSession,
    @Param() params: FindObjectiveBySlugDTO,
  ): Promise<IBaseResponse> {
    const obj = await this.objectiveService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    return buildOk(obj, 'Objective found');
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Objective'))
  @ApiOperation({ summary: 'Get an objective by ID' })
  async getObjectiveById(
    @CurrentUser() user: IUserSession,
    @Param() params: FindObjectiveByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.objectiveService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Objective found');
  }
}
