import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import {
  NewKnowledgeDTO,
  UpdateKnowledgeDTO,
  QueryKnowledgeDTO,
  FindKnowledgeBySlugDTO,
  KnowledgeShareDTO,
  KnowledgeLinkDTO,
  KnowledgeAttachmentDTO,
  AttachTaskDTO,
} from './knowledge.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly service: KnowledgeService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Knowledge'))
  @ApiOperation({ summary: 'Create a knowledge entry' })
  async create(@CurrentUser() user: IUserSession, @Body() dto: NewKnowledgeDTO): Promise<IBaseResponse> {
    const created = await this.service.create(dto, user.id, this.ctx.forUser(user.id));
    return buildCreated(created, 'Knowledge created');
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Search knowledge visible to the current user' })
  async search(@CurrentUser() user: IUserSession, @Body() params: QueryKnowledgeDTO): Promise<IBaseQueryResult> {
    return this.service.search(params as any, this.ctx.forUser(user.id), user);
  }

  @Get(':slug')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Get a knowledge entry by slug' })
  async getBySlug(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindKnowledgeBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.service.requireReadableBySlug(params.slug, this.ctx.forUser(user.id), ability, user);
    return buildOk(result, 'Knowledge found');
  }

  @Patch(':slug')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Update a knowledge entry (owner/admin)' })
  async update(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Body() dto: UpdateKnowledgeDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.service.update(slug, dto, this.ctx.forUser(user.id), ability);
    return buildOk(updated, 'Knowledge updated');
  }

  @Delete(':slug')
  @CheckPolicies((a) => a.can('delete', 'Knowledge'))
  @ApiOperation({ summary: 'Soft-delete a knowledge entry (owner/admin)' })
  async remove(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    await this.service.remove(slug, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Knowledge deleted');
  }

  // --- shares ---------------------------------------------------------------

  @Post(':slug/shares')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Share a knowledge entry with a person' })
  async addShare(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Body() dto: KnowledgeShareDTO,
  ): Promise<IBaseResponse> {
    await this.service.addShare(slug, dto.personId, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Shared');
  }

  @Delete(':slug/shares/:personId')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Revoke a share' })
  async removeShare(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Param('personId') personId: string,
  ): Promise<IBaseResponse> {
    await this.service.removeShare(slug, Number(personId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Share revoked');
  }

  // --- links ----------------------------------------------------------------

  @Post(':slug/links')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Add an external link' })
  async addLink(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Body() dto: KnowledgeLinkDTO,
  ): Promise<IBaseResponse> {
    const link = await this.service.addLink(slug, dto.url, dto.title ?? null, this.ctx.forUser(user.id), ability);
    return buildCreated(link, 'Link added');
  }

  @Delete(':slug/links/:linkId')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Remove an external link' })
  async removeLink(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Param('linkId') linkId: string,
  ): Promise<IBaseResponse> {
    await this.service.removeLink(slug, Number(linkId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Link removed');
  }

  @Get(':slug/links')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'List external links' })
  async listLinks(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const links = await this.service.listLinks(slug, this.ctx.forUser(user.id), ability, user);
    return buildOk(links, 'Links retrieved');
  }

  // --- attachments ----------------------------------------------------------

  @Post(':slug/attachments')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Attach an uploaded file' })
  async attachFile(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Body() dto: KnowledgeAttachmentDTO,
  ): Promise<IBaseResponse> {
    await this.service.attachFile(slug, dto.attachmentId, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Attachment added');
  }

  @Delete(':slug/attachments/:attachmentId')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Detach a file' })
  async detachFile(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<IBaseResponse> {
    await this.service.detachFile(slug, Number(attachmentId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Attachment removed');
  }

  @Get(':slug/attachments')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'List attachments with resolved preview URLs' })
  async listAttachments(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const items = await this.service.listAttachments(slug, this.ctx.forUser(user.id), ability, user);
    return buildOk(items, 'Attachments retrieved');
  }

  // --- task attach/detach ---------------------------------------------------

  @Post(':slug/tasks')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Attach this knowledge to a task' })
  async attachToTask(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Body() dto: AttachTaskDTO,
  ): Promise<IBaseResponse> {
    await this.service.attachToTask(slug, dto.taskId, this.ctx.forUser(user.id), ability, user);
    return buildOk(null, 'Attached to task');
  }

  @Delete(':slug/tasks/:taskId')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Detach this knowledge from a task' })
  async detachFromTask(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
    @Param('taskId') taskId: string,
  ): Promise<IBaseResponse> {
    await this.service.detachFromTask(slug, Number(taskId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Detached from task');
  }
}
