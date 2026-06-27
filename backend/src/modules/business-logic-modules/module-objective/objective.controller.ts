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
import { ObjectiveRepository } from './objective.repo';
import {
  NewObjectiveDTO,
  DeleteObjectiveDTO,
  UpdateObjectiveDTO,
  QueryObjectiveDTO,
  FindObjectiveByIdDTO,
  FindObjectiveBySlugDTO,
} from './objective.dto';
import { AuthGuard } from 'src/middleware/auth.guard';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { Role, Roles } from 'src/middleware/roles.decorator';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { IUserSession } from '../../module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('objectives')
@UseGuards(AuthGuard, RoleControllerGuard)
@Controller('objectives')
export class ObjectiveController {
  private readonly logger = new Logger(ObjectiveController.name);

  constructor(
    private readonly objectiveRepository: ObjectiveRepository,
    private readonly ctx: DbContextService,
  ) {}

  @Post('/create')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new objective' })
  @ApiResponse({ status: 201, description: 'Objective created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createObjective(
    @Req() req: Request,
    @Body() dto: NewObjectiveDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.objectiveRepository.create(dto, tenancyInfo);
      return {
        data: result,
        status_code: HttpStatus.CREATED,
        message: 'Objective created successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error creating objective: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to create objective: ${error.message}`);
    }
  }

  @Post('/delete')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete an objective by ID' })
  @ApiResponse({ status: 200, description: 'Objective deleted successfully' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteObjective(
    @Req() req: Request,
    @Body() dto: DeleteObjectiveDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.objectiveRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Objective with id ${dto.id} not found`);
      }
      await this.objectiveRepository.delete(dto.id, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Objective deleted successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error deleting objective ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to delete objective: ${error.message}`);
    }
  }

  @Post('/update')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update an objective by ID' })
  @ApiResponse({ status: 200, description: 'Objective updated successfully' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateObjective(
    @Req() req: Request,
    @Body() dto: UpdateObjectiveDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.objectiveRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Objective with id ${dto.id} not found`);
      }
      const updated = await this.objectiveRepository.update(dto.id, dto, tenancyInfo);
      return {
        data: updated,
        status_code: HttpStatus.OK,
        message: 'Objective updated successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error updating objective ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to update objective: ${error.message}`);
    }
  }

  @Post('all')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted objectives (no pagination)' })
  @ApiResponse({ status: 200, description: 'All objectives returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllObjectives(@Req() req: Request): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.objectiveRepository.queryAll(tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} objectives`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching all objectives: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch all objectives: ${error.message}`);
    }
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search objectives with filters' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async searchObjectives(
    @Req() req: Request,
    @Body() searchParams: QueryObjectiveDTO,
  ): Promise<IBaseQueryResult> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.objectiveRepository.query(searchParams, tenancyInfo);
      return { ...result };
    } catch (error: any) {
      this.logger.error(`Error searching objectives: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to search objectives: ${error.message}`);
    }
  }

  @Post('owner/:ownerPersonId')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get objectives by owner person ID' })
  @ApiResponse({ status: 200, description: 'Objectives for owner returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getObjectivesByOwner(
    @Req() req: Request,
    @Param('ownerPersonId') ownerPersonId: string,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.objectiveRepository.findByOwner(Number(ownerPersonId), tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} objectives for owner`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching objectives by owner: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch objectives by owner: ${error.message}`);
    }
  }

  @Post('scope')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get objectives by scope and scopeRefId' })
  @ApiResponse({ status: 200, description: 'Objectives for scope returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getObjectivesByScope(
    @Req() req: Request,
    @Body() body: { scope: 'org' | 'department' | 'team'; scopeRefId?: number },
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.objectiveRepository.findByScope(body.scope, body.scopeRefId, tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} objectives for scope`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching objectives by scope: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch objectives by scope: ${error.message}`);
    }
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an objective by ID' })
  @ApiResponse({ status: 200, description: 'Objective found' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getObjectiveById(
    @Req() req: Request,
    @Param() params: FindObjectiveByIdDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.objectiveRepository.findById(params.id, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Objective with id ${params.id} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Objective found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching objective ${params.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch objective: ${error.message}`);
    }
  }

  @Get('/slug/:slug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an objective by slug' })
  @ApiResponse({ status: 200, description: 'Objective found' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getObjectiveBySlug(
    @Req() req: Request,
    @Param() params: FindObjectiveBySlugDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.objectiveRepository.findBySlug(params.slug, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Objective with slug ${params.slug} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Objective found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching objective by slug ${params.slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch objective: ${error.message}`);
    }
  }
}
