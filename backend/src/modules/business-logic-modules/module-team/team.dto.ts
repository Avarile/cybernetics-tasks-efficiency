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
  INewTeam,
  IQueryTeamParams,
  IUpdateTeam,
} from './team.interface';
import { IGetByID, ISortOptions } from '../../../utils/shared/interface';

export class NewTeamDTO implements INewTeam {
  @ApiProperty({ description: 'Team name', required: true })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Department ID (required)', required: true })
  @IsNumber()
  departmentId!: number;

  @ApiProperty({ description: 'Lead person ID', required: false })
  @IsOptional()
  @IsNumber()
  leadPersonId?: number | null;
}

export class DeleteTeamDTO implements IGetByID {
  @ApiProperty({ description: 'Team ID', required: true })
  @IsNumber()
  id!: number;
}

export class UpdateTeamDTO implements IUpdateTeam {
  @ApiProperty({ description: 'Team ID', required: true })
  @IsNumber()
  id!: number;

  @ApiProperty({ description: 'Team name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Department ID', required: false })
  @IsOptional()
  @IsNumber()
  departmentId?: number;

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

export class QueryTeamDTO implements Partial<IQueryTeamParams> {
  @ApiProperty({ description: 'Filter by name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Filter by department ID', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  departmentId?: number;

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

export class FindTeamByIdDTO {
  @ApiProperty({ description: 'Team ID', required: true })
  @IsNumber()
  @Type(() => Number)
  id!: number;
}
