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
  INewDepartment,
  IQueryDepartmentParams,
  IUpdateDepartment,
} from './department.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

export class NewDepartmentDTO implements INewDepartment {
  @ApiProperty({ description: 'Department name', required: true })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Department description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Parent department ID (for nested departments)', required: false })
  @IsOptional()
  @IsNumber()
  parentId?: number | null;

  @ApiProperty({ description: 'Lead person ID', required: false })
  @IsOptional()
  @IsNumber()
  leadPersonId?: number | null;
}

export class DeleteDepartmentDTO implements IGetByID {
  @ApiProperty({ description: 'Department ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdateDepartmentDTO implements IUpdateDepartment {
  @ApiProperty({ description: 'Department ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Department name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Department description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Parent department ID', required: false })
  @IsOptional()
  @IsNumber()
  parentId?: number | null;

  @ApiProperty({ description: 'Lead person ID', required: false })
  @IsOptional()
  @IsNumber()
  leadPersonId?: number | null;

  @ApiProperty({ description: 'Is active flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class QueryDepartmentDTO implements Partial<IQueryDepartmentParams> {
  @ApiProperty({ description: 'Filter by name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Filter by description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Filter by parent department ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  parentId?: number | null;

  @ApiProperty({ description: 'Filter by lead person ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  leadPersonId?: number | null;

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

export class FindDepartmentByIdDTO {
  @ApiProperty({ description: 'Department ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}
