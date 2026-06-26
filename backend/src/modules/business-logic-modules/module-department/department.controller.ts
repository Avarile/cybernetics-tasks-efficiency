import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AppException, BusinessException } from '../../../utils/exception.provider';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DepartmentRepository } from './department.repo';
import {
  NewDepartmentDTO,
  DeleteDepartmentDTO,
  UpdateDepartmentDTO,
  QueryDepartmentDTO,
  FindDepartmentByIdDTO,
} from './department.dto';
import { AuthGuard } from 'src/middleware/auth.guard';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { Role, Roles } from 'src/middleware/roles.decorator';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { IUserSession } from '../../module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('departments')
@UseGuards(AuthGuard, RoleControllerGuard)
@Controller('departments')
export class DepartmentController {
  private readonly logger = new Logger(DepartmentController.name);

  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly ctx: DbContextService,
  ) {
    this.logger.warn('DepartmentController initialized');
  }

  @Post('/create')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createDepartment(
    @Req() req: Request,
    @Body() dto: NewDepartmentDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.departmentRepository.create(dto, tenancyInfo);
      return {
        data: result,
        status_code: HttpStatus.CREATED,
        message: 'Department created successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error creating department: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to create department: ${error.message}`);
    }
  }

  @Post('/delete')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete a department by ID' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteDepartment(
    @Req() req: Request,
    @Body() dto: DeleteDepartmentDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.departmentRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Department with id ${dto.id} not found`);
      }
      await this.departmentRepository.delete(dto.id, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Department deleted successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error deleting department ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to delete department: ${error.message}`);
    }
  }

  @Post('/update')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update a department by ID' })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateDepartment(
    @Req() req: Request,
    @Body() dto: UpdateDepartmentDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.departmentRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Department with id ${dto.id} not found`);
      }
      const updated = await this.departmentRepository.update(dto.id, dto, tenancyInfo);
      return {
        data: updated,
        status_code: HttpStatus.OK,
        message: 'Department updated successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error updating department ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to update department: ${error.message}`);
    }
  }

  @Post('all')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted departments (no pagination)' })
  @ApiResponse({ status: 200, description: 'All departments returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllDepartments(@Req() req: Request): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.departmentRepository.queryAll(tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} departments`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching all departments: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch all departments: ${error.message}`);
    }
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search departments with filters' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async searchDepartments(
    @Req() req: Request,
    @Body() searchParams: QueryDepartmentDTO,
  ): Promise<IBaseQueryResult> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.departmentRepository.query(searchParams, tenancyInfo);
      return { ...result };
    } catch (error: any) {
      this.logger.error(`Error searching departments: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to search departments: ${error.message}`);
    }
  }

  @Get('roots')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get root departments (no parent)' })
  @ApiResponse({ status: 200, description: 'Root departments returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getRootDepartments(@Req() req: Request): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.departmentRepository.findRoots(tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} root departments`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching root departments: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch root departments: ${error.message}`);
    }
  }

  @Get(':id/children')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get child departments by parent ID' })
  @ApiResponse({ status: 200, description: 'Child departments returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getChildDepartments(
    @Req() req: Request,
    @Param() params: FindDepartmentByIdDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.departmentRepository.findByParentId(params.id, tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} child departments`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching child departments for ${params.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch child departments: ${error.message}`);
    }
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a department by ID' })
  @ApiResponse({ status: 200, description: 'Department found' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getDepartmentById(
    @Req() req: Request,
    @Param() params: FindDepartmentByIdDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.departmentRepository.findById(params.id, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Department with id ${params.id} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Department found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching department ${params.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch department: ${error.message}`);
    }
  }
}
