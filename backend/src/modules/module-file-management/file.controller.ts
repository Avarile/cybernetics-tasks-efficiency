import type { Readable } from 'node:stream';
import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { FileService } from './file.service';
import { SignatureDTO, FindBySlugDTO } from './file.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('files')
@Controller('files')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly ctx: DbContextService,
  ) {}

  @Post('signature')
  @CheckPolicies((a) => a.can('create', 'Attachment'))
  @ApiOperation({ summary: 'Request a presigned upload URL' })
  async signature(@CurrentUser() user: IUserSession, @Body() dto: SignatureDTO): Promise<IBaseResponse> {
    const res = await this.fileService.signature(dto, this.ctx.forUser(user.id));
    return buildCreated(res, 'Signature created');
  }

  @Post('notify/:token')
  @CheckPolicies((a) => a.can('create', 'Attachment'))
  @ApiOperation({ summary: 'Confirm upload complete and persist the attachment' })
  async notify(
    @CurrentUser() user: IUserSession,
    @Param('token') token: string,
    @Query('filename') filename?: string,
  ): Promise<IBaseResponse> {
    const res = await this.fileService.notify(token, this.ctx.forUser(user.id), filename);
    return buildCreated(res, 'Attachment created');
  }

  @Public()
  @Put('upload/:token')
  @ApiOperation({ summary: 'Local upload target (PUT)' })
  async uploadPut(@Req() req: Request, @Param('token') token: string): Promise<IBaseResponse> {
    await this.fileService.uploadLocal(req, token);
    return buildOk(null, 'Uploaded');
  }

  @Public()
  @Post('upload/:token')
  @ApiOperation({ summary: 'Local upload target (POST)' })
  async uploadPost(@Req() req: Request, @Param('token') token: string): Promise<IBaseResponse> {
    await this.fileService.uploadLocal(req, token);
    return buildOk(null, 'Uploaded');
  }

  @Public()
  @Get('read/:path(*)')
  @ApiOperation({ summary: 'Serve a local file' })
  async read(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
    @Param('path') path: string,
    @Query('token') token?: string,
  ): Promise<StreamableFile | void> {
    if (this.fileService.localConditionalCaching(path, req.headers, res)) {
      res.status(304);
      return;
    }
    const { fileStream, headers } = await this.fileService.readLocalFile(path, token);
    res.set(headers);
    return new StreamableFile(fileStream as Readable);
  }

  @Get(':slug/link')
  @CheckPolicies((a) => a.can('read', 'Attachment'))
  @ApiOperation({ summary: 'Get a signed preview/download link' })
  async link(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindBySlugDTO,
  ): Promise<IBaseResponse> {
    const url = await this.fileService.getLink(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk({ url }, 'Link generated');
  }

  @Get(':slug')
  @CheckPolicies((a) => a.can('read', 'Attachment'))
  @ApiOperation({ summary: 'Get attachment metadata' })
  async getBySlug(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindBySlugDTO,
  ): Promise<IBaseResponse> {
    const row = await this.fileService.requireBySlugAuthorized(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk(row, 'Attachment found');
  }

  @Delete(':slug')
  @CheckPolicies((a) => a.can('delete', 'Attachment'))
  @ApiOperation({ summary: 'Delete an attachment' })
  async remove(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindBySlugDTO,
  ): Promise<IBaseResponse> {
    await this.fileService.remove(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Attachment deleted');
  }
}
