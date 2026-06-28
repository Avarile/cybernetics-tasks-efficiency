import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { INewObjective, IQueryObjectiveParams, IUpdateObjective } from './objective.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

enum ObjectiveScope {
  ORG = 'org',
  DEPARTMENT = 'department',
  TEAM = 'team',
}

enum ObjectiveStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export class NewObjectiveDTO implements INewObjective {
  @ApiProperty({ description: 'Objective title', required: true })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ description: 'Objective description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Owner person ID', required: true })
  @IsNumber()
  ownerPersonId!: number;

  @ApiProperty({ description: 'Scope of the objective', required: true, enum: ObjectiveScope })
  @IsEnum(ObjectiveScope)
  scope!: 'org' | 'department' | 'team';

  @ApiProperty({ description: 'Scope reference ID (dept/team ID)', required: false })
  @IsOptional()
  @IsNumber()
  scopeRefId?: number | null;

  @ApiProperty({ description: 'Period (e.g. 2024-Q1)', required: true })
  @IsString()
  @MinLength(1)
  period!: string;

  @ApiProperty({ description: 'Objective status', required: true, enum: ObjectiveStatus })
  @IsEnum(ObjectiveStatus)
  status!: 'draft' | 'active' | 'completed' | 'archived';
}

export class DeleteObjectiveDTO implements IGetByID {
  @ApiProperty({ description: 'Objective ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdateObjectiveDTO implements IUpdateObjective {
  @ApiProperty({ description: 'Objective ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Objective title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Objective description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Owner person ID', required: false })
  @IsOptional()
  @IsNumber()
  ownerPersonId?: number;

  @ApiProperty({ description: 'Scope', required: false, enum: ObjectiveScope })
  @IsOptional()
  @IsEnum(ObjectiveScope)
  scope?: 'org' | 'department' | 'team';

  @ApiProperty({ description: 'Scope reference ID', required: false })
  @IsOptional()
  @IsNumber()
  scopeRefId?: number | null;

  @ApiProperty({ description: 'Period', required: false })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiProperty({ description: 'Objective status', required: false, enum: ObjectiveStatus })
  @IsOptional()
  @IsEnum(ObjectiveStatus)
  status?: 'draft' | 'active' | 'completed' | 'archived';

  @ApiProperty({ description: 'Is active flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class QueryObjectiveDTO implements Partial<IQueryObjectiveParams> {
  @ApiProperty({ description: 'Filter by title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Filter by owner person ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  ownerPersonId?: number;

  @ApiProperty({ description: 'Filter by scope', required: false, enum: ObjectiveScope })
  @IsOptional()
  @IsEnum(ObjectiveScope)
  scope?: 'org' | 'department' | 'team';

  @ApiProperty({ description: 'Filter by status', required: false, enum: ObjectiveStatus })
  @IsOptional()
  @IsEnum(ObjectiveStatus)
  status?: 'draft' | 'active' | 'completed' | 'archived';

  @ApiProperty({ description: 'Filter by period', required: false })
  @IsOptional()
  @IsString()
  period?: string;

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

  @ApiProperty({ description: 'Page number', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false })
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

export class FindObjectiveByIdDTO {
  @ApiProperty({ description: 'Objective ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}

export class FindObjectiveBySlugDTO {
  @ApiProperty({ description: 'Objective slug', required: true })
  @IsString()
  slug!: string;
}

export class ScopeQueryDTO {
  @ApiProperty({ description: 'Scope to filter by', required: true, enum: ObjectiveScope })
  @IsEnum(ObjectiveScope)
  scope!: 'org' | 'department' | 'team';

  @ApiProperty({ description: 'Scope reference ID (dept/team ID)', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  scopeRefId?: number;
}
