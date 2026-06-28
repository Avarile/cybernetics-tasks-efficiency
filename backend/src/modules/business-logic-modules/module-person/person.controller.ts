import { Body, Controller, Delete, Get, Logger, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PersonService } from './person.service';
import { CreateUserDTO, UpdatePersonDTO, QueryPersonDTO, FindPersonByIdDTO, FindPersonByNameDTO, FindPersonBySlugDTO } from './person.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PasswordService } from 'src/modules/module-auth/password.service';

@ApiTags('persons')
@Controller('persons')
export class PersonController {
  private readonly logger = new Logger(PersonController.name);

  constructor(
    private readonly personService: PersonService,
    private readonly passwords: PasswordService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Person'))
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiResponse({ status: 201, description: 'Person created successfully' })
  async createPerson(@CurrentUser() user: IUserSession, @Body() dto: CreateUserDTO): Promise<IBaseResponse> {
    const passwordHash = await this.passwords.hash(dto.password);
    const result = await this.personService.create(
      { name: dto.name, email: dto.email, role: dto.role, departmentId: dto.departmentId ?? null, teamId: dto.teamId ?? null, passwordHash },
      this.ctx.forUser(user.id),
    );
    const { passwordHash: _omit, ...safe } = result as unknown as Record<string, unknown>;
    return buildCreated(safe, 'Person created successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Person'))
  @ApiOperation({ summary: 'Soft-delete a person' })
  async deletePerson(@CurrentUser() user: IUserSession, @Param() params: FindPersonByIdDTO): Promise<IBaseResponse> {
    await this.personService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Person deleted successfully');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Person'))
  @ApiOperation({ summary: 'Update a person' })
  async updatePerson(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindPersonByIdDTO,
    @Body() dto: UpdatePersonDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.personService.update(params.id, dto, this.ctx.forUser(user.id), ability);
    return buildOk(updated, 'Person updated successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Fetch all non-deleted persons' })
  async getAllPersons(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.personService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} persons`);
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Search persons with filters' })
  async searchPersons(@CurrentUser() user: IUserSession, @Body() searchParams: QueryPersonDTO): Promise<IBaseQueryResult> {
    return this.personService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('name/:name')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Get a person by name' })
  async getPersonByName(@CurrentUser() user: IUserSession, @Param() params: FindPersonByNameDTO): Promise<IBaseResponse> {
    const result = await this.personService.requireByName(params.name, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }

  @Get('slug/:slug')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Get a person by slug' })
  async getPersonBySlug(@CurrentUser() user: IUserSession, @Param() params: FindPersonBySlugDTO): Promise<IBaseResponse> {
    const result = await this.personService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Get a person by ID' })
  async getPersonById(@CurrentUser() user: IUserSession, @Param() params: FindPersonByIdDTO): Promise<IBaseResponse> {
    const result = await this.personService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }
}
