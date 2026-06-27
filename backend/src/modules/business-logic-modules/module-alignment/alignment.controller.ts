import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AlignmentService } from './alignment.service';
import { LinkDTO, UnlinkDTO } from './alignment.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('alignment')
@Controller()
export class AlignmentController {
  private readonly logger = new Logger(AlignmentController.name);

  constructor(
    private readonly alignmentService: AlignmentService,
    private readonly ctx: DbContextService,
  ) {}

  @Get('okr/tree/:objectiveSlug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get the OKR tree rooted at the given objective slug' })
  @ApiResponse({ status: 200, description: 'OKR tree returned' })
  async getOkrTree(
    @CurrentUser() user: IUserSession,
    @Param('objectiveSlug') objectiveSlug: string,
  ): Promise<IBaseResponse> {
    const tree = await this.alignmentService.getTree(objectiveSlug, this.ctx.forUser(user.id));
    return buildOk(tree, 'OKR tree fetched successfully');
  }

  @Post('alignment/link')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create an alignment link between two entities' })
  @ApiResponse({ status: 201, description: 'Alignment link created' })
  async createLink(
    @CurrentUser() user: IUserSession,
    @Body() dto: LinkDTO,
  ): Promise<IBaseResponse> {
    const result = await this.alignmentService.link(
      {
        fromType: dto.fromType,
        fromId: dto.fromId,
        toType: dto.toType,
        toId: dto.toId,
        weight: dto.weight !== undefined ? String(dto.weight) : undefined,
      },
      this.ctx.forUser(user.id),
    );
    return buildCreated(result, 'Alignment link created successfully');
  }

  @Post('alignment/unlink')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Remove an alignment link by ID' })
  @ApiResponse({ status: 200, description: 'Alignment link removed' })
  async removeLink(
    @CurrentUser() user: IUserSession,
    @Body() dto: UnlinkDTO,
  ): Promise<IBaseResponse> {
    await this.alignmentService.unlink(dto.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Alignment link removed successfully');
  }
}
