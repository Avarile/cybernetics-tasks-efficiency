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
import { KeyResultRepository } from './key-result.repo';
import {
  NewKeyResultDTO,
  DeleteKeyResultDTO,
  UpdateKeyResultDTO,
  QueryKeyResultDTO,
  FindKeyResultByIdDTO,
  FindKeyResultBySlugDTO,
  UpdateCurrentValueDTO,
} from './key-result.dto';
import { AuthGuard } from 'src/middleware/auth.guard';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { Role, Roles } from 'src/middleware/roles.decorator';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { IUserSession } from '../../module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('key-results')
@UseGuards(AuthGuard, RoleControllerGuard)
@Controller('key-results')
export class KeyResultController {
  private readonly logger = new Logger(KeyResultController.name);

  constructor(
    private readonly keyResultRepository: KeyResultRepository,
    private readonly ctx: DbContextService,
  ) {
    this.logger.warn('KeyResultController initialized');
  }

  @Post('/create')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new key result' })
  @ApiResponse({ status: 201, description: 'Key result created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createKeyResult(
    @Req() req: Request,
    @Body() dto: NewKeyResultDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.keyResultRepository.create(dto, tenancyInfo);
      return {
        data: result,
        status_code: HttpStatus.CREATED,
        message: 'Key result created successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error creating key result: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to create key result: ${error.message}`);
    }
  }

  @Post('/delete')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete a key result by ID' })
  @ApiResponse({ status: 200, description: 'Key result deleted successfully' })
  @ApiResponse({ status: 404, description: 'Key result not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteKeyResult(
    @Req() req: Request,
    @Body() dto: DeleteKeyResultDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.keyResultRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Key result with id ${dto.id} not found`);
      }
      await this.keyResultRepository.delete(dto.id, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Key result deleted successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error deleting key result ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to delete key result: ${error.message}`);
    }
  }

  @Post('/update')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update a key result by ID' })
  @ApiResponse({ status: 200, description: 'Key result updated successfully' })
  @ApiResponse({ status: 404, description: 'Key result not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateKeyResult(
    @Req() req: Request,
    @Body() dto: UpdateKeyResultDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.keyResultRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Key result with id ${dto.id} not found`);
      }
      const updated = await this.keyResultRepository.update(dto.id, dto, tenancyInfo);
      return {
        data: updated,
        status_code: HttpStatus.OK,
        message: 'Key result updated successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error updating key result ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to update key result: ${error.message}`);
    }
  }

  @Post('/update-current-value')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Update the current value of a key result' })
  @ApiResponse({ status: 200, description: 'Current value updated successfully' })
  @ApiResponse({ status: 404, description: 'Key result not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateCurrentValue(
    @Req() req: Request,
    @Body() dto: UpdateCurrentValueDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.keyResultRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Key result with id ${dto.id} not found`);
      }
      const updated = await this.keyResultRepository.updateCurrentValue(dto.id, dto.currentValue, tenancyInfo);
      return {
        data: updated,
        status_code: HttpStatus.OK,
        message: 'Current value updated successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error updating current value for key result ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to update current value: ${error.message}`);
    }
  }

  @Post('all')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted key results (no pagination)' })
  @ApiResponse({ status: 200, description: 'All key results returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllKeyResults(@Req() req: Request): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.keyResultRepository.queryAll(tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} key results`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching all key results: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch all key results: ${error.message}`);
    }
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search key results with filters' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async searchKeyResults(
    @Req() req: Request,
    @Body() searchParams: QueryKeyResultDTO,
  ): Promise<IBaseQueryResult> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.keyResultRepository.query(searchParams, tenancyInfo);
      return { ...result };
    } catch (error: any) {
      this.logger.error(`Error searching key results: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to search key results: ${error.message}`);
    }
  }

  @Post('objective/:objectiveId')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get key results by objective ID' })
  @ApiResponse({ status: 200, description: 'Key results for objective returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getKeyResultsByObjective(
    @Req() req: Request,
    @Param('objectiveId') objectiveId: string,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.keyResultRepository.findByObjectiveId(Number(objectiveId), tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} key results for objective`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching key results by objective: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch key results by objective: ${error.message}`);
    }
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a key result by ID' })
  @ApiResponse({ status: 200, description: 'Key result found' })
  @ApiResponse({ status: 404, description: 'Key result not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getKeyResultById(
    @Req() req: Request,
    @Param() params: FindKeyResultByIdDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.keyResultRepository.findById(params.id, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Key result with id ${params.id} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Key result found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching key result ${params.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch key result: ${error.message}`);
    }
  }

  @Get('/slug/:slug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a key result by slug' })
  @ApiResponse({ status: 200, description: 'Key result found' })
  @ApiResponse({ status: 404, description: 'Key result not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getKeyResultBySlug(
    @Req() req: Request,
    @Param() params: FindKeyResultBySlugDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.keyResultRepository.findBySlug(params.slug, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Key result with slug ${params.slug} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Key result found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching key result by slug ${params.slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch key result: ${error.message}`);
    }
  }
}
