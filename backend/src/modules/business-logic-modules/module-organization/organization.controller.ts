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
import { OrganizationService } from './organization.service';
import {
  NewOrganizationDTO,
  UpdateOrganizationDTO,
  QueryOrganizationDTO,
  FindOrganizationByIdDTO,
  FindOrganizationByNameDTO,
  FindOrganizationBySlugDTO,
} from './organization.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationController {
  private readonly logger = new Logger(OrganizationController.name);

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Organization'))
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  async createOrganization(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewOrganizationDTO,
  ): Promise<IBaseResponse> {
    const result = await this.organizationService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Organization created successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Organization'))
  @ApiOperation({ summary: 'Soft-delete an organization' })
  async deleteOrganization(
    @CurrentUser() user: IUserSession,
    @Param() params: FindOrganizationByIdDTO,
  ): Promise<IBaseResponse> {
    await this.organizationService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Organization deleted successfully');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Organization'))
  @ApiOperation({ summary: 'Update an organization' })
  async updateOrganization(
    @CurrentUser() user: IUserSession,
    @Param() params: FindOrganizationByIdDTO,
    @Body() dto: UpdateOrganizationDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.organizationService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Organization updated successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Organization'))
  @ApiOperation({ summary: 'Fetch all non-deleted organizations' })
  async getAllOrganizations(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.organizationService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} organizations`);
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Organization'))
  @ApiOperation({ summary: 'Search organizations with filters' })
  async searchOrganizations(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryOrganizationDTO,
  ): Promise<IBaseQueryResult> {
    return this.organizationService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('name/:name')
  @CheckPolicies((a) => a.can('read', 'Organization'))
  @ApiOperation({ summary: 'Get an organization by name' })
  async getOrganizationByName(
    @CurrentUser() user: IUserSession,
    @Param() params: FindOrganizationByNameDTO,
  ): Promise<IBaseResponse> {
    const result = await this.organizationService.requireByName(params.name, this.ctx.forUser(user.id));
    return buildOk(result, 'Organization found');
  }

  @Get('slug/:slug')
  @CheckPolicies((a) => a.can('read', 'Organization'))
  @ApiOperation({ summary: 'Get an organization by slug' })
  async getOrganizationBySlug(
    @CurrentUser() user: IUserSession,
    @Param() params: FindOrganizationBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.organizationService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    return buildOk(result, 'Organization found');
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Organization'))
  @ApiOperation({ summary: 'Get an organization by ID' })
  async getOrganizationById(
    @CurrentUser() user: IUserSession,
    @Param() params: FindOrganizationByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.organizationService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Organization found');
  }
}
