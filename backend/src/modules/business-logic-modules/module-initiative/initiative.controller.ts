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
import { InitiativeRepository } from './initiative.repo';
import {
  NewInitiativeDTO,
  DeleteInitiativeDTO,
  UpdateInitiativeDTO,
  QueryInitiativeDTO,
  FindInitiativeByIdDTO,
  FindInitiativeBySlugDTO,
  LinkKeyResultDTO,
} from './initiative.dto';
import { AuthGuard } from 'src/middleware/auth.guard';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { Role, Roles } from 'src/middleware/roles.decorator';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { IUserSession } from '../../module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('initiatives')
@UseGuards(AuthGuard, RoleControllerGuard)
@Controller('initiatives')
export class InitiativeController {
  private readonly logger = new Logger(InitiativeController.name);

  constructor(
    private readonly initiativeRepository: InitiativeRepository,
    private readonly ctx: DbContextService,
  ) {}

  @Post('/create')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new initiative' })
  @ApiResponse({ status: 201, description: 'Initiative created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createInitiative(
    @Req() req: Request,
    @Body() dto: NewInitiativeDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.initiativeRepository.create(dto, tenancyInfo);
      return {
        data: result,
        status_code: HttpStatus.CREATED,
        message: 'Initiative created successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error creating initiative: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to create initiative: ${error.message}`);
    }
  }

  @Post('/delete')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete an initiative by ID' })
  @ApiResponse({ status: 200, description: 'Initiative deleted successfully' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteInitiative(
    @Req() req: Request,
    @Body() dto: DeleteInitiativeDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.initiativeRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Initiative with id ${dto.id} not found`);
      }
      await this.initiativeRepository.delete(dto.id, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Initiative deleted successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error deleting initiative ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to delete initiative: ${error.message}`);
    }
  }

  @Post('/update')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update an initiative by ID' })
  @ApiResponse({ status: 200, description: 'Initiative updated successfully' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async updateInitiative(
    @Req() req: Request,
    @Body() dto: UpdateInitiativeDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const existing = await this.initiativeRepository.findById(dto.id, tenancyInfo);
      if (!existing) {
        AppException.throw('RESOURCE_NOT_FOUND', `Initiative with id ${dto.id} not found`);
      }
      const updated = await this.initiativeRepository.update(dto.id, dto, tenancyInfo);
      return {
        data: updated,
        status_code: HttpStatus.OK,
        message: 'Initiative updated successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error updating initiative ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to update initiative: ${error.message}`);
    }
  }

  @Post('all')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted initiatives (no pagination)' })
  @ApiResponse({ status: 200, description: 'All initiatives returned' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAllInitiatives(@Req() req: Request): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const data = await this.initiativeRepository.queryAll(tenancyInfo);
      return {
        data,
        status_code: HttpStatus.OK,
        message: `Fetched ${data.length} initiatives`,
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching all initiatives: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch all initiatives: ${error.message}`);
    }
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search initiatives with filters' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async searchInitiatives(
    @Req() req: Request,
    @Body() searchParams: QueryInitiativeDTO,
  ): Promise<IBaseQueryResult> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.initiativeRepository.query(searchParams, tenancyInfo);
      return { ...result };
    } catch (error: any) {
      this.logger.error(`Error searching initiatives: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to search initiatives: ${error.message}`);
    }
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an initiative by ID' })
  @ApiResponse({ status: 200, description: 'Initiative found' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getInitiativeById(
    @Req() req: Request,
    @Param() params: FindInitiativeByIdDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.initiativeRepository.findById(params.id, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Initiative with id ${params.id} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Initiative found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching initiative ${params.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch initiative: ${error.message}`);
    }
  }

  @Get('/slug/:slug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get an initiative by slug' })
  @ApiResponse({ status: 200, description: 'Initiative found' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getInitiativeBySlug(
    @Req() req: Request,
    @Param() params: FindInitiativeBySlugDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.initiativeRepository.findBySlug(params.slug, tenancyInfo);
      if (!result) {
        AppException.throw('RESOURCE_NOT_FOUND', `Initiative with slug ${params.slug} not found`);
      }
      return {
        data: result,
        status_code: HttpStatus.OK,
        message: 'Initiative found',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching initiative by slug ${params.slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch initiative: ${error.message}`);
    }
  }

  @Post(':slug/key-results')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Link a key result to an initiative' })
  @ApiResponse({ status: 200, description: 'Key result linked successfully' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async linkKeyResult(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() dto: LinkKeyResultDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const ini = await this.initiativeRepository.findBySlug(slug, tenancyInfo);
      if (!ini) {
        AppException.throw('RESOURCE_NOT_FOUND', `Initiative with slug ${slug} not found`);
      }
      await this.initiativeRepository.linkKeyResult(ini!.id, dto.keyResultId, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Key result linked successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error linking key result to initiative ${slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to link key result: ${error.message}`);
    }
  }

  @Delete(':slug/key-results/:keyResultId')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Unlink a key result from an initiative' })
  @ApiResponse({ status: 200, description: 'Key result unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async unlinkKeyResult(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Param('keyResultId') keyResultId: string,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const ini = await this.initiativeRepository.findBySlug(slug, tenancyInfo);
      if (!ini) {
        AppException.throw('RESOURCE_NOT_FOUND', `Initiative with slug ${slug} not found`);
      }
      await this.initiativeRepository.unlinkKeyResult(ini!.id, Number(keyResultId), tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Key result unlinked successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error unlinking key result from initiative ${slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to unlink key result: ${error.message}`);
    }
  }

  @Get(':slug/key-results')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get key result IDs linked to an initiative' })
  @ApiResponse({ status: 200, description: 'Key result IDs returned' })
  @ApiResponse({ status: 404, description: 'Initiative not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findKeyResultIds(
    @Req() req: Request,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const ini = await this.initiativeRepository.findBySlug(slug, tenancyInfo);
      if (!ini) {
        AppException.throw('RESOURCE_NOT_FOUND', `Initiative with slug ${slug} not found`);
      }
      const ids = await this.initiativeRepository.findKeyResultIds(ini!.id, tenancyInfo);
      return {
        data: ids,
        status_code: HttpStatus.OK,
        message: 'Key result IDs fetched successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching key result IDs for initiative ${slug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch key result IDs: ${error.message}`);
    }
  }
}
