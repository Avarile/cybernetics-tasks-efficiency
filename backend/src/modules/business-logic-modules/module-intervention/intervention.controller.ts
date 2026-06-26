import {
  Body,
  Controller,
  Delete,
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
import { InterventionRepository } from './intervention.repo';
import {
  NewInterventionDTO,
  DeleteInterventionDTO,
  UpdateInterventionDTO,
  QueryInterventionDTO,
  FindInterventionByIdDTO,
  FindInterventionBySlugDTO,
  LinkKeyResultToInterventionDTO,
} from './intervention.dto';
import { AuthGuard } from 'src/middleware/auth.guard';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { Role, Roles } from 'src/middleware/roles.decorator';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { IUserSession } from '../../module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('interventions')
@UseGuards(AuthGuard, RoleControllerGuard)
@Controller('interventions')
export class InterventionController {
  private readonly logger = new Logger(InterventionController.name);

  constructor(
    private readonly interventionRepository: InterventionRepository,
    private readonly ctx: DbContextService,
  ) {
    this.logger.warn('InterventionController initialized');
  }

  @Post('/create')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new intervention' })
  @ApiResponse({ status: 201, description: 'Intervention created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createIntervention(
    @Req() req: Request,
    @Body() dto: NewInterventionDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.interventionRepository.create(dto, tenancyInfo);
      return {
        data: result,
        status_code: HttpStatus.CREATED,
        message: 'Intervention created successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error creating intervention: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to create intervention: ${error.message}`);
    }
  }

  @Post('/delete')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete an intervention by ID' })
  @ApiResponse({ status: 200, description: 'Intervention deleted successfully' })
  @ApiResponse({ status: 404, description: 'Intervention not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteIntervention(
    @Req() req: Request,
    @Body() dto: DeleteInterventionDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.interventionRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Intervention with id ${dto.id} not found`);
      }
      await this.interventionRepository.delete(dto.id, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Intervention deleted successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error deleting intervention ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to delete intervention: ${error.message}`);
    }
  }

  @Post('/update')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update an intervention by ID' })
  @ApiResponse({ status: 200, description: 'Intervention updated successfully' })
  @ApiResponse({ status: 404, description: 'Intervention not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateIntervention(
    @Req() req: Request,
    @Body() dto: UpdateInterventionDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.interventionRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Intervention with id ${dto.id} not found`);
      }
      const updated = await this.interventionRepository.update(dto.id, dto, tenancyInfo);
      return {
        data: updated,
        status_code: HttpStatus.OK,
        message: 'Intervention updated successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error updating intervention ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to update intervention: ${error.message}`);
    }
  }

  @Post('all')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted interventions (no pagination)' })
  @ApiResponse({ status: 200, description: 'All interventions returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllInterventions(@Req() req: Request): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.interventionRepository.queryAll(tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} interventions`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching all interventions: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch all interventions: ${error.message}`);
    }
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search interventions with filters' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async searchInterventions(
    @Req() req: Request,
    @Body() searchParams: QueryInterventionDTO,
  ): Promise<IBaseQueryResult> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.interventionRepository.query(searchParams, tenancyInfo);
      return { ...result };
    } catch (error: any) {
      this.logger.error(`Error searching interventions: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to search interventions: ${error.message}`);
    }
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an intervention by ID' })
  @ApiResponse({ status: 200, description: 'Intervention found' })
  @ApiResponse({ status: 404, description: 'Intervention not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getInterventionById(
    @Req() req: Request,
    @Param() params: FindInterventionByIdDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.interventionRepository.findById(params.id, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Intervention with id ${params.id} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Intervention found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching intervention ${params.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch intervention: ${error.message}`);
    }
  }

  @Get('/slug/:slug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an intervention by slug' })
  @ApiResponse({ status: 200, description: 'Intervention found' })
  @ApiResponse({ status: 404, description: 'Intervention not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getInterventionBySlug(
    @Req() req: Request,
    @Param() params: FindInterventionBySlugDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.interventionRepository.findBySlug(params.slug, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Intervention with slug ${params.slug} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Intervention found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching intervention by slug ${params.slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch intervention: ${error.message}`);
    }
  }

  @Post(':slug/key-results')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Link a key result to an intervention' })
  @ApiResponse({ status: 200, description: 'Key result linked successfully' })
  @ApiResponse({ status: 404, description: 'Intervention not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async linkKeyResult(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LinkKeyResultToInterventionDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const inv = await this.interventionRepository.findBySlug(slug, tenancyInfo);
      if (!inv) {
        AppException.throw('RESOURCE_NOT_FOUND', `Intervention with slug ${slug} not found`);
      }
      await this.interventionRepository.linkKeyResult(inv!.id, dto.keyResultId, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Key result linked successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error linking key result to intervention ${slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to link key result: ${error.message}`);
    }
  }

  @Delete(':slug/key-results/:keyResultId')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Unlink a key result from an intervention' })
  @ApiResponse({ status: 200, description: 'Key result unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Intervention not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async unlinkKeyResult(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Param('keyResultId') keyResultId: string,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const inv = await this.interventionRepository.findBySlug(slug, tenancyInfo);
      if (!inv) {
        AppException.throw('RESOURCE_NOT_FOUND', `Intervention with slug ${slug} not found`);
      }
      await this.interventionRepository.unlinkKeyResult(inv!.id, Number(keyResultId), tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Key result unlinked successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error unlinking key result from intervention ${slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to unlink key result: ${error.message}`);
    }
  }

  @Get(':slug/key-results')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get affected key result IDs for an intervention' })
  @ApiResponse({ status: 200, description: 'Affected key result IDs returned' })
  @ApiResponse({ status: 404, description: 'Intervention not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findAffectedKeyResultIds(
    @Req() req: Request,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const inv = await this.interventionRepository.findBySlug(slug, tenancyInfo);
      if (!inv) {
        AppException.throw('RESOURCE_NOT_FOUND', `Intervention with slug ${slug} not found`);
      }
      const ids = await this.interventionRepository.findAffectedKeyResultIds(inv!.id, tenancyInfo);
      return {
        data: ids,
        status_code: HttpStatus.OK,
        message: 'Affected key result IDs fetched successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching affected key result IDs for intervention ${slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch affected key result IDs: ${error.message}`);
    }
  }
}
