import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  IsArray,
  IsEnum,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { INewPerson, IQueryPersonParams, IUpdatePerson } from './person.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

enum PersonRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
  EXECUTIVE = 'executive',
}

export class NewPersonDTO implements INewPerson {
  @ApiProperty({ description: 'Person full name', required: true })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Person email address', required: true })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Person role',
    required: true,
    enum: PersonRole,
    default: PersonRole.MEMBER,
  })
  @IsEnum(PersonRole)
  role!: 'admin' | 'manager' | 'member' | 'executive';

  @ApiProperty({ description: 'Department ID', required: false })
  @IsOptional()
  @IsNumber()
  departmentId?: number | null;

  @ApiProperty({ description: 'Team ID', required: false })
  @IsOptional()
  @IsNumber()
  teamId?: number | null;

  @ApiProperty({ description: 'Password hash (internal)', required: false })
  @IsOptional()
  @IsString()
  passwordHash?: string | null;
}

export class DeletePersonDTO implements IGetByID {
  @ApiProperty({ description: 'Person ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdatePersonDTO implements IUpdatePerson {
  @ApiProperty({ description: 'Person ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Person full name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Person email address', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Person role',
    required: false,
    enum: PersonRole,
  })
  @IsOptional()
  @IsEnum(PersonRole)
  role?: 'admin' | 'manager' | 'member' | 'executive';

  @ApiProperty({ description: 'Department ID', required: false })
  @IsOptional()
  @IsNumber()
  departmentId?: number | null;

  @ApiProperty({ description: 'Team ID', required: false })
  @IsOptional()
  @IsNumber()
  teamId?: number | null;

  @ApiProperty({ description: 'Is active flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class QueryPersonDTO implements Partial<IQueryPersonParams> {
  @ApiProperty({ description: 'Filter by name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Filter by email', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Filter by role', required: false, enum: PersonRole })
  @IsOptional()
  @IsEnum(PersonRole)
  role?: 'admin' | 'manager' | 'member' | 'executive';

  @ApiProperty({ description: 'Filter by department ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  departmentId?: number | null;

  @ApiProperty({ description: 'Filter by team ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  teamId?: number | null;

  @ApiProperty({ description: 'Filter by ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  id?: number;

  @ApiProperty({ description: 'Filter by multiple IDs', required: false })
  @IsOptional()
  @IsArray()
  ids?: number[];

  @ApiProperty({ description: 'Filter by slug', required: false })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ description: 'Filter by multiple slugs', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  slugs?: string[];

  @ApiProperty({ description: 'Page number for pagination', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ description: 'Number of items per page', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number;

  @ApiProperty({ description: 'Filter by active status', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({ description: 'Filter by deleted status', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDeleted?: boolean;

  @ApiProperty({ description: 'Sort options', required: false, type: [Object] })
  @IsOptional()
  @IsArray()
  sortOptions?: ISortOptions[];
}

export class FindPersonByIdDTO {
  @ApiProperty({ description: 'Person ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}

export class FindPersonByNameDTO {
  @ApiProperty({ description: 'Person name', required: true })
  @IsString()
  name!: string;
}

export class FindPersonBySlugDTO {
  @ApiProperty({ description: 'Person slug', required: true })
  @IsString()
  slug!: string;
}
