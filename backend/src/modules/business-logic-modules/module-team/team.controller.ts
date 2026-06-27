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
import { TeamService } from './team.service';
import {
  NewTeamDTO,
  UpdateTeamDTO,
  QueryTeamDTO,
  FindTeamByIdDTO,
} from './team.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('teams')
@Controller('teams')
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(
    private readonly teamService: TeamService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  async createTeam(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewTeamDTO,
  ): Promise<IBaseResponse> {
    const result = await this.teamService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Team created successfully');
  }

  @Delete(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete a team' })
  async deleteTeam(
    @CurrentUser() user: IUserSession,
    @Param() params: FindTeamByIdDTO,
  ): Promise<IBaseResponse> {
    await this.teamService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Team deleted successfully');
  }

  @Patch(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update a team' })
  async updateTeam(
    @CurrentUser() user: IUserSession,
    @Param() params: FindTeamByIdDTO,
    @Body() dto: UpdateTeamDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.teamService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Team updated successfully');
  }

  @Get()
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted teams' })
  async getAllTeams(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.teamService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} teams`);
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search teams with filters' })
  async searchTeams(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryTeamDTO,
  ): Promise<IBaseQueryResult> {
    return this.teamService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get(':id/members')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get teams for a department' })
  async getTeamsByDepartment(
    @CurrentUser() user: IUserSession,
    @Param() params: FindTeamByIdDTO,
  ): Promise<IBaseResponse> {
    const data = await this.teamService.findByDepartmentId(params.id, this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} teams`);
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a team by ID' })
  async getTeamById(
    @CurrentUser() user: IUserSession,
    @Param() params: FindTeamByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.teamService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Team found');
  }
}
