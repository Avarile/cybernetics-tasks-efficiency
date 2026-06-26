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
import { INewKeyResult, IQueryKeyResultParams, IUpdateKeyResult } from './key-result.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

enum KrMetricType {
  NUMBER = 'number',
  PERCENT = 'percent',
  CURRENCY = 'currency',
  BOOLEAN = 'boolean',
}

enum KrDirection {
  INCREASE = 'increase',
  DECREASE = 'decrease',
}

export class NewKeyResultDTO implements INewKeyResult {
  @ApiProperty({ description: 'Objective ID', required: true })
  @IsNumber()
  objectiveId!: number;

  @ApiProperty({ description: 'Key result title', required: true })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ description: 'Metric type', required: true, enum: KrMetricType })
  @IsEnum(KrMetricType)
  metricType!: 'number' | 'percent' | 'currency' | 'boolean';

  @ApiProperty({ description: 'Unit label', required: false })
  @IsOptional()
  @IsString()
  unit?: string | null;

  @ApiProperty({ description: 'Start value (decimal as string)', required: false })
  @IsOptional()
  @IsString()
  startValue?: string | null;

  @ApiProperty({ description: 'Target value (decimal as string)', required: false })
  @IsOptional()
  @IsString()
  targetValue?: string | null;

  @ApiProperty({ description: 'Current value (decimal as string)', required: false })
  @IsOptional()
  @IsString()
  currentValue?: string | null;

  @ApiProperty({ description: 'Direction of progress', required: true, enum: KrDirection })
  @IsEnum(KrDirection)
  direction!: 'increase' | 'decrease';
}

export class DeleteKeyResultDTO implements IGetByID {
  @ApiProperty({ description: 'Key result ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdateKeyResultDTO implements IUpdateKeyResult {
  @ApiProperty({ description: 'Key result ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Objective ID', required: false })
  @IsOptional()
  @IsNumber()
  objectiveId?: number;

  @ApiProperty({ description: 'Key result title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Metric type', required: false, enum: KrMetricType })
  @IsOptional()
  @IsEnum(KrMetricType)
  metricType?: 'number' | 'percent' | 'currency' | 'boolean';

  @ApiProperty({ description: 'Unit label', required: false })
  @IsOptional()
  @IsString()
  unit?: string | null;

  @ApiProperty({ description: 'Start value (decimal as string)', required: false })
  @IsOptional()
  @IsString()
  startValue?: string | null;

  @ApiProperty({ description: 'Target value (decimal as string)', required: false })
  @IsOptional()
  @IsString()
  targetValue?: string | null;

  @ApiProperty({ description: 'Current value (decimal as string)', required: false })
  @IsOptional()
  @IsString()
  currentValue?: string | null;

  @ApiProperty({ description: 'Direction of progress', required: false, enum: KrDirection })
  @IsOptional()
  @IsEnum(KrDirection)
  direction?: 'increase' | 'decrease';

  @ApiProperty({ description: 'Is active flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class QueryKeyResultDTO implements Partial<IQueryKeyResultParams> {
  @ApiProperty({ description: 'Filter by objective ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  objectiveId?: number;

  @ApiProperty({ description: 'Filter by title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Filter by metric type', required: false, enum: KrMetricType })
  @IsOptional()
  @IsEnum(KrMetricType)
  metricType?: 'number' | 'percent' | 'currency' | 'boolean';

  @ApiProperty({ description: 'Filter by direction', required: false, enum: KrDirection })
  @IsOptional()
  @IsEnum(KrDirection)
  direction?: 'increase' | 'decrease';

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

export class FindKeyResultByIdDTO {
  @ApiProperty({ description: 'Key result ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}

export class FindKeyResultBySlugDTO {
  @ApiProperty({ description: 'Key result slug', required: true })
  @IsString()
  slug!: string;
}

export class UpdateCurrentValueDTO {
  @ApiProperty({ description: 'Key result ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'New current value (decimal as string)', required: true })
  @IsString()
  currentValue!: string;
}
