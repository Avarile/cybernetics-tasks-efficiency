import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { KnowledgeService } from '../module-knowledge/knowledge.service';
import {
  NewTaskDTO, UpdateTaskDTO, QueryTaskDTO, FindTaskByIdDTO, FindTaskBySlugDTO, TaskAssigneeDTO, TaskLabelDTO,
} from './task.dto';
import { buildTaskKey } from './task.util';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('tasks')
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly knowledgeService: KnowledgeService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Task'))
  @ApiOperation({ summary: 'Create a task' })
  async create(@CurrentUser() user: IUserSession, @Body() dto: NewTaskDTO): Promise<IBaseResponse> {
    const created = await this.taskService.create(
      { ...dto, createdByPersonId: user.id },
      this.ctx.forUser(user.id),
    );
    return buildCreated({ ...created, key: buildTaskKey(created.sequenceId) }, 'Task created successfully');
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Search tasks with filters' })
  async search(@CurrentUser() user: IUserSession, @Body() params: QueryTaskDTO): Promise<IBaseQueryResult> {
    return this.taskService.search(params as any, this.ctx.forUser(user.id));
  }

  @Get('summary')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Task roll-up counts for an initiative' })
  async summary(@CurrentUser() user: IUserSession, @Query('initiativeId') initiativeId: string): Promise<IBaseResponse> {
    const data = await this.taskService.summary(Number(initiativeId), this.ctx.forUser(user.id));
    return buildOk(data, 'Task summary retrieved');
  }

  @Get('slug/:slug')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Get a task by slug' })
  async getBySlug(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindTaskBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.taskService.requireBySlugAuthorized(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk({ ...result, key: buildTaskKey(result.sequenceId) }, 'Task found');
  }

  @Post(':slug/assignees')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Assign a person to a task' })
  async assign(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Body() dto: TaskAssigneeDTO,
  ): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlugForWrite(slug, this.ctx.forUser(user.id), ability);
    await this.taskService.assign(t.id, dto.personId, this.ctx.forUser(user.id));
    return buildOk(null, 'Assignee added');
  }

  @Delete(':slug/assignees/:personId')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Unassign a person from a task' })
  async unassign(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Param('personId') personId: string,
  ): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlugForWrite(slug, this.ctx.forUser(user.id), ability);
    await this.taskService.unassign(t.id, Number(personId), this.ctx.forUser(user.id));
    return buildOk(null, 'Assignee removed');
  }

  @Post(':slug/labels')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Add a label to a task' })
  async addLabel(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Body() dto: TaskLabelDTO,
  ): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlugForWrite(slug, this.ctx.forUser(user.id), ability);
    await this.taskService.addLabel(t.id, dto.labelId, this.ctx.forUser(user.id));
    return buildOk(null, 'Label added');
  }

  @Delete(':slug/labels/:labelId')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Remove a label from a task' })
  async removeLabel(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Param('labelId') labelId: string,
  ): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlugForWrite(slug, this.ctx.forUser(user.id), ability);
    await this.taskService.removeLabel(t.id, Number(labelId), this.ctx.forUser(user.id));
    return buildOk(null, 'Label removed');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Update a task' })
  async update(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindTaskByIdDTO,
    @Body() dto: UpdateTaskDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.taskService.update(params.id, dto, this.ctx.forUser(user.id), ability);
    return buildOk({ ...updated, key: buildTaskKey(updated.sequenceId) }, 'Task updated successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Task'))
  @ApiOperation({ summary: 'Soft-delete a task' })
  async remove(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindTaskByIdDTO,
  ): Promise<IBaseResponse> {
    await this.taskService.remove(params.id, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Task deleted successfully');
  }

  @Get('slug/:slug/knowledge')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'List knowledge attached to a task' })
  async listKnowledge(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const ctx = this.ctx.forUser(user.id);
    const task = await this.taskService.requireBySlugAuthorized(slug, ctx, ability);
    const items = await this.knowledgeService.listForTask(task.id, ctx);
    return buildOk(items, 'Task knowledge retrieved');
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Get a task by ID' })
  async getById(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindTaskByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.taskService.requireByIdAuthorized(params.id, this.ctx.forUser(user.id), ability);
    return buildOk({ ...result, key: buildTaskKey(result.sequenceId) }, 'Task found');
  }
}
