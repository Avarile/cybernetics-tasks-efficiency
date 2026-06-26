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
  INewOrganization,
  IQueryOrganizationParams,
  IUpdateOrganization,
} from './organization.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

export class NewOrganizationDTO implements INewOrganization {
  @ApiProperty({ description: 'Organization name', required: true })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Organization description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class DeleteOrganizationDTO implements IGetByID {
  @ApiProperty({ description: 'Organization ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdateOrganizationDTO implements IUpdateOrganization {
  @ApiProperty({ description: 'Organization ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Organization name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Organization description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Updated at timestamp', required: false })
  @IsOptional()
  @IsString()
  updatedAt?: string | null;

  @ApiProperty({ description: 'Deleted at timestamp', required: false })
  @IsOptional()
  @IsString()
  deletedAt?: string | null;

  @ApiProperty({ description: 'Is deleted flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDeleted?: boolean;

  @ApiProperty({ description: 'Is active flag', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class QueryOrganizationDTO implements Partial<IQueryOrganizationParams> {
  @ApiProperty({ description: 'Filter by name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Filter by description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

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

export class FindOrganizationByIdDTO {
  @ApiProperty({ description: 'Organization ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}

export class FindOrganizationByNameDTO {
  @ApiProperty({ description: 'Organization name', required: true })
  @IsString()
  name!: string;
}

export class FindOrganizationBySlugDTO {
  @ApiProperty({ description: 'Organization slug', required: true })
  @IsString()
  slug!: string;
}
