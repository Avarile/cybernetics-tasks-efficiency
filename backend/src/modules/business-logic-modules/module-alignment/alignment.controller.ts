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
import { AlignmentRepository } from './alignment.repo';
import { OkrTreeService } from './okr-tree.service';
import { ObjectiveRepository } from '../module-objective/objective.repo';
import { LinkDTO, UnlinkDTO } from './alignment.dto';
import { AuthGuard } from 'src/middleware/auth.guard';
import { IBaseResponse } from 'src/utils/shared/interface';
import { Role, Roles } from 'src/middleware/roles.decorator';
import { RoleControllerGuard } from 'src/middleware/role-controller.guard';
import { IUserSession } from '../../module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('alignment')
@UseGuards(AuthGuard, RoleControllerGuard)
@Controller()
export class AlignmentController {
  private readonly logger = new Logger(AlignmentController.name);

  constructor(
    private readonly alignmentRepo: AlignmentRepository,
    private readonly okrTreeService: OkrTreeService,
    private readonly objectiveRepo: ObjectiveRepository,
    private readonly ctx: DbContextService,
  ) {
    this.logger.warn('AlignmentController initialized');
  }

  @Get('okr/tree/:objectiveSlug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get the OKR tree rooted at the given objective slug' })
  @ApiResponse({ status: 200, description: 'OKR tree returned' })
  @ApiResponse({ status: 404, description: 'Objective not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getOkrTree(
    @Req() req: Request,
    @Param('objectiveSlug') objectiveSlug: string,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const objective = await this.objectiveRepo.findBySlug(objectiveSlug, tenancyInfo);
      if (!objective) {
        AppException.throw('RESOURCE_NOT_FOUND', `Objective with slug '${objectiveSlug}' not found`);
      }
      const tree = await this.okrTreeService.buildTree(objective.id, tenancyInfo);
      return {
        data: tree,
        status_code: HttpStatus.OK,
        message: 'OKR tree fetched successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching OKR tree for slug ${objectiveSlug}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to fetch OKR tree: ${error.message}`);
    }
  }

  @Post('alignment/link')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create an alignment link between two entities' })
  @ApiResponse({ status: 201, description: 'Alignment link created' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createLink(
    @Req() req: Request,
    @Body() dto: LinkDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      const result = await this.alignmentRepo.link(
        {
          fromType: dto.fromType,
          fromId: dto.fromId,
          toType: dto.toType,
          toId: dto.toId,
          weight: dto.weight !== undefined ? String(dto.weight) : undefined,
        },
        tenancyInfo,
      );
      return {
        data: result,
        status_code: HttpStatus.CREATED,
        message: 'Alignment link created successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error creating alignment link: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to create alignment link: ${error.message}`);
    }
  }

  @Post('alignment/unlink')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Remove an alignment link by ID' })
  @ApiResponse({ status: 200, description: 'Alignment link removed' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async removeLink(
    @Req() req: Request,
    @Body() dto: UnlinkDTO,
  ): Promise<IBaseResponse> {
    const tenancyInfo = this.ctx.forUser(((req as any)['user'] as IUserSession).id);
    try {
      await this.alignmentRepo.unlink(dto.id, tenancyInfo);
      return {
        data: null,
        status_code: HttpStatus.OK,
        message: 'Alignment link removed successfully',
        timestamp: new Date(),
        error: null,
      };
    } catch (error: any) {
      this.logger.error(`Error removing alignment link ${dto.id}: ${error.message}`);
      if (error instanceof BusinessException) throw error;
      AppException.throw('SYSTEM_INTERNAL_ERROR', `Failed to remove alignment link: ${error.message}`);
    }
  }
}
