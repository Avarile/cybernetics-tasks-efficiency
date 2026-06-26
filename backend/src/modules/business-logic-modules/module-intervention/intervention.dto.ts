import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  IsArray,
  IsIn,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  INewIntervention,
  IQueryInterventionParams,
  IUpdateIntervention,
  InterventionStatus,
} from './intervention.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

const INTERVENTION_STATUSES: InterventionStatus[] = ['planned', 'active', 'measuring', 'concluded'];

export class NewInterventionDTO implements INewIntervention {
  @ApiProperty({ description: 'Intervention title', required: true })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ description: 'Intervention description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Decided by person ID', required: true })
  @IsNumber()
  decidedByPersonId!: number;

  @ApiProperty({ description: 'Started at (ISO timestamptz string)', required: true })
  @IsString()
  startedAt!: string;

  @ApiProperty({ description: 'Scope of the intervention', required: true })
  @IsString()
  scope!: string;

  @ApiProperty({ description: 'Hypothesis text', required: false })
  @IsOptional()
  @IsString()
  hypothesis?: string | null;

  @ApiProperty({ description: 'Measurement window in days (default 14)', required: false })
  @IsOptional()
  @IsInt()
  measurementWindowDays?: number;
}

export class DeleteInterventionDTO implements IGetByID {
  @ApiProperty({ description: 'Intervention ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdateInterventionDTO implements IUpdateIntervention {
  @ApiProperty({ description: 'Intervention ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Intervention title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Intervention description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Decided by person ID', required: false })
  @IsOptional()
  @IsNumber()
  decidedByPersonId?: number;

  @ApiProperty({ description: 'Started at (ISO timestamptz string)', required: false })
  @IsOptional()
  @IsString()
  startedAt?: string;

  @ApiProperty({ description: 'Scope of the intervention', required: false })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiProperty({ description: 'Hypothesis text', required: false })
  @IsOptional()
  @IsString()
  hypothesis?: string | null;

  @ApiProperty({ description: 'Measurement window in days', required: false })
  @IsOptional()
  @IsInt()
  measurementWindowDays?: number;

  @ApiProperty({
    description: 'Intervention status',
    required: false,
    enum: INTERVENTION_STATUSES,
  })
  @IsOptional()
  @IsString()
  @IsIn(INTERVENTION_STATUSES)
  status?: InterventionStatus;

  @ApiProperty({ description: 'Is active flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class QueryInterventionDTO implements Partial<IQueryInterventionParams> {
  @ApiProperty({ description: 'Filter by title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Filter by decided by person ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  decidedByPersonId?: number;

  @ApiProperty({ description: 'Filter by scope', required: false })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiProperty({ description: 'Filter by status', required: false, enum: INTERVENTION_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(INTERVENTION_STATUSES)
  status?: InterventionStatus;

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

export class FindInterventionByIdDTO {
  @ApiProperty({ description: 'Intervention ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}

export class FindInterventionBySlugDTO {
  @ApiProperty({ description: 'Intervention slug', required: true })
  @IsString()
  slug!: string;
}

export class LinkKeyResultToInterventionDTO {
  @ApiProperty({ description: 'Key result ID to link', required: true })
  @IsNumber()
  keyResultId!: number;
}
