import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  INewInitiative,
  IQueryInitiativeParams,
  IUpdateInitiative,
} from './initiative.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

export class NewInitiativeDTO implements INewInitiative {
  @ApiProperty({ description: 'Initiative title', required: true })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ description: 'Initiative description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Owner person ID', required: true })
  @IsNumber()
  ownerPersonId!: number;

  @ApiProperty({ description: 'Priority (high/medium/low)', required: true })
  @IsString()
  priority!: string;

  @ApiProperty({ description: 'Due date (ISO string)', required: false })
  @IsOptional()
  @IsString()
  dueDate?: string | null;
}

export class DeleteInitiativeDTO implements IGetByID {
  @ApiProperty({ description: 'Initiative ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdateInitiativeDTO implements IUpdateInitiative {
  @ApiProperty({ description: 'Initiative ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Initiative title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Initiative description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Owner person ID', required: false })
  @IsOptional()
  @IsNumber()
  ownerPersonId?: number;

  @ApiProperty({ description: 'Priority (high/medium/low)', required: false })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({ description: 'Due date (ISO string)', required: false })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiProperty({ description: 'Is active flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class QueryInitiativeDTO implements Partial<IQueryInitiativeParams> {
  @ApiProperty({ description: 'Filter by title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Filter by owner person ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  ownerPersonId?: number;

  @ApiProperty({ description: 'Filter by priority', required: false })
  @IsOptional()
  @IsString()
  priority?: string;

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

export class FindInitiativeByIdDTO {
  @ApiProperty({ description: 'Initiative ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}

export class FindInitiativeBySlugDTO {
  @ApiProperty({ description: 'Initiative slug', required: true })
  @IsString()
  slug!: string;
}

export class LinkKeyResultDTO {
  @ApiProperty({ description: 'Key result ID to link', required: true })
  @IsNumber()
  keyResultId!: number;
}
