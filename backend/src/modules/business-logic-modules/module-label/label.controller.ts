import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabelService } from './label.service';
import { NewLabelDTO, UpdateLabelDTO, FindLabelByIdDTO } from './label.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('labels')
@Controller('labels')
export class LabelController {
  constructor(
    private readonly labelService: LabelService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Label'))
  @ApiOperation({ summary: 'Create a label' })
  async create(@CurrentUser() user: IUserSession, @Body() dto: NewLabelDTO): Promise<IBaseResponse> {
    const result = await this.labelService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Label created successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Label'))
  @ApiOperation({ summary: 'List all labels' })
  async list(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.labelService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} labels`);
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Label'))
  @ApiOperation({ summary: 'Update a label' })
  async update(
    @CurrentUser() user: IUserSession,
    @Param() params: FindLabelByIdDTO,
    @Body() dto: UpdateLabelDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.labelService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Label updated successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Label'))
  @ApiOperation({ summary: 'Soft-delete a label' })
  async remove(@CurrentUser() user: IUserSession, @Param() params: FindLabelByIdDTO): Promise<IBaseResponse> {
    await this.labelService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Label deleted successfully');
  }
}
