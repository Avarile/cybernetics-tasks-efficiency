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
import { DepartmentService } from './department.service';
import {
  NewDepartmentDTO,
  UpdateDepartmentDTO,
  QueryDepartmentDTO,
  FindDepartmentByIdDTO,
} from './department.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('departments')
@Controller('departments')
export class DepartmentController {
  private readonly logger = new Logger(DepartmentController.name);

  constructor(
    private readonly departmentService: DepartmentService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Department'))
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  async createDepartment(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewDepartmentDTO,
  ): Promise<IBaseResponse> {
    const result = await this.departmentService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Department created successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Department'))
  @ApiOperation({ summary: 'Soft-delete a department' })
  async deleteDepartment(
    @CurrentUser() user: IUserSession,
    @Param() params: FindDepartmentByIdDTO,
  ): Promise<IBaseResponse> {
    await this.departmentService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Department deleted successfully');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Department'))
  @ApiOperation({ summary: 'Update a department' })
  async updateDepartment(
    @CurrentUser() user: IUserSession,
    @Param() params: FindDepartmentByIdDTO,
    @Body() dto: UpdateDepartmentDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.departmentService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Department updated successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Department'))
  @ApiOperation({ summary: 'Fetch all non-deleted departments' })
  async getAllDepartments(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.departmentService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} departments`);
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Department'))
  @ApiOperation({ summary: 'Search departments with filters' })
  async searchDepartments(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryDepartmentDTO,
  ): Promise<IBaseQueryResult> {
    return this.departmentService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('roots')
  @CheckPolicies((a) => a.can('read', 'Department'))
  @ApiOperation({ summary: 'Get root departments (no parent)' })
  async getRootDepartments(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.departmentService.findRoots(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} root departments`);
  }

  @Get(':id/children')
  @CheckPolicies((a) => a.can('read', 'Department'))
  @ApiOperation({ summary: 'Get child departments by parent ID' })
  async getChildDepartments(
    @CurrentUser() user: IUserSession,
    @Param() params: FindDepartmentByIdDTO,
  ): Promise<IBaseResponse> {
    const data = await this.departmentService.findByParentId(params.id, this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} child departments`);
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Department'))
  @ApiOperation({ summary: 'Get a department by ID' })
  async getDepartmentById(
    @CurrentUser() user: IUserSession,
    @Param() params: FindDepartmentByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.departmentService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Department found');
  }
}
