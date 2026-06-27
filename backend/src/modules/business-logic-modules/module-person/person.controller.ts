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
import { PersonService } from './person.service';
import {
  NewPersonDTO,
  UpdatePersonDTO,
  QueryPersonDTO,
  FindPersonByIdDTO,
  FindPersonByNameDTO,
  FindPersonBySlugDTO,
} from './person.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { Roles, Role } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';
import { AppException } from 'src/utils/exception.provider';

@ApiTags('persons')
@Controller('persons')
export class PersonController {
  private readonly logger = new Logger(PersonController.name);

  constructor(
    private readonly personService: PersonService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Create a new person' })
  @ApiResponse({ status: 201, description: 'Person created successfully' })
  async createPerson(
    @CurrentUser() user: IUserSession,
    @Body() dto: NewPersonDTO,
  ): Promise<IBaseResponse> {
    const result = await this.personService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Person created successfully');
  }

  @Delete(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Soft-delete a person' })
  async deletePerson(
    @CurrentUser() user: IUserSession,
    @Param() params: FindPersonByIdDTO,
  ): Promise<IBaseResponse> {
    await this.personService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Person deleted successfully');
  }

  @Patch(':id')
  @Roles(Role.admin, Role.manager)
  @ApiOperation({ summary: 'Update a person' })
  async updatePerson(
    @CurrentUser() user: IUserSession,
    @Param() params: FindPersonByIdDTO,
    @Body() dto: UpdatePersonDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.personService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Person updated successfully');
  }

  @Get()
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Fetch all non-deleted persons' })
  async getAllPersons(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.personService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} persons`);
  }

  @Post('search')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Search persons with filters' })
  async searchPersons(
    @CurrentUser() user: IUserSession,
    @Body() searchParams: QueryPersonDTO,
  ): Promise<IBaseQueryResult> {
    return this.personService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('name/:name')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a person by name' })
  async getPersonByName(
    @CurrentUser() user: IUserSession,
    @Param() params: FindPersonByNameDTO,
  ): Promise<IBaseResponse> {
    const result = await this.personService.requireByName(params.name, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }

  @Get('slug/:slug')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a person by slug' })
  async getPersonBySlug(
    @CurrentUser() user: IUserSession,
    @Param() params: FindPersonBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.personService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }

  @Get(':id')
  @Roles(Role.admin, Role.manager, Role.member, Role.executive)
  @ApiOperation({ summary: 'Get a person by ID' })
  async getPersonById(
    @CurrentUser() user: IUserSession,
    @Param() params: FindPersonByIdDTO,
  ): Promise<IBaseResponse> {
    const result = await this.personService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }
}
