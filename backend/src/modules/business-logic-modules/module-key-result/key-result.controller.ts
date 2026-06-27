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
import { KeyResultService } from './key-result.service';
import {
  NewKeyResultDTO,
  UpdateKeyResultDTO,
  QueryKeyResultDTO,
  FindKeyResultByIdDTO,
  FindKeyResultBySlugDTO,
  UpdateCurrentValueDTO,
} from './key-result.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('key-results')
@Controller('key-results')
export class KeyResultController {
  private readonly logger = new Logger(KeyResultController.name);

  constructor(
    private readonly keyResultService: KeyResultService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new key result' })
  @ApiResponse({ status: 201, description: 'Key result created successfully' })
  async createKeyResult(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewKeyResultDTO,
  ): Promise<IBaseResponse> {
    const result = await this.keyResultService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Key result created successfully');
  }

  @Delete(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete a key result' })
  async deleteKeyResult(
    @CurrentUser() user: IUserSession,
    @Param() params: FindKeyResultByIdDTO,
  ): Promise<IBaseResponse> {
    await this.keyResultService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Key result deleted successfully');
  }

  @Patch(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update a key result' })
  async updateKeyResult(
    @CurrentUser() user: IUserSession,
    @Param() params: FindKeyResultByIdDTO,
    @Body() dto: UpdateKeyResultDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.keyResultService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Key result updated successfully');
  }

  @Patch(':id/value')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Update the current value of a key result' })
  async updateCurrentValue(
    @CurrentUser() user: IUserSession,
    @Param() params: FindKeyResultByIdDTO,
    @Body() dto: UpdateCurrentValueDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.keyResultService.updateCurrentValue(params.id, dto.currentValue, this.ctx.forUser(user.id));
    return buildOk(updated, 'Current value updated successfully');
  }

  @Get()
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted key results' })
  async getAllKeyResults(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.keyResultService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} key results`);
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search key results with filters' })
  async searchKeyResults(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryKeyResultDTO,
  ): Promise<IBaseQueryResult> {
    return this.keyResultService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('objective/:objectiveId')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get key results by objective ID' })
  async getKeyResultsByObjective(
    @CurrentUser() user: IUserSession,
    @Param('objectiveId') objectiveId: string,
  ): Promise<IBaseResponse> {
    const data = await this.keyResultService.findByObjective(Number(objectiveId), this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} key results for objective`);
  }

  @Get('slug/:slug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a key result by slug' })
  async getKeyResultBySlug(
    @CurrentUser() user: IUserSession,
    @Param() params: FindKeyResultBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.keyResultService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    return buildOk(result, 'Key result found');
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a key result by ID' })
  async getKeyResultById(
    @CurrentUser() user: IUserSession,
    @Param() params: FindKeyResultByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.keyResultService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Key result found');
  }
}
