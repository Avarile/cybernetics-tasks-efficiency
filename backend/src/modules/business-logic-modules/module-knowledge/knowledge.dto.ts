import { IsString, IsNumber, IsOptional, IsIn, IsUrl, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { KnowledgeVisibility } from './knowledge.interface';

const VISIBILITIES: KnowledgeVisibility[] = ['private', 'shared', 'organization'];

export class NewKnowledgeDTO {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() body?: string | null;
  @ApiProperty({ required: false, enum: VISIBILITIES }) @IsOptional() @IsIn(VISIBILITIES) visibility?: KnowledgeVisibility;
}

export class UpdateKnowledgeDTO {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() body?: string | null;
  @ApiProperty({ required: false, enum: VISIBILITIES }) @IsOptional() @IsIn(VISIBILITIES) visibility?: KnowledgeVisibility;
}

export class QueryKnowledgeDTO {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) ownerPersonId?: number;
  @ApiProperty({ required: false, enum: VISIBILITIES }) @IsOptional() @IsIn(VISIBILITIES) visibility?: KnowledgeVisibility;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) page?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) pageSize?: number;
}

export class FindKnowledgeBySlugDTO {
  @ApiProperty() @IsString() slug!: string;
}

export class KnowledgeShareDTO {
  @ApiProperty() @IsNumber() personId!: number;
}

export class KnowledgeLinkDTO {
  @ApiProperty() @IsUrl() url!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string | null;
}

export class KnowledgeAttachmentDTO {
  @ApiProperty() @IsNumber() attachmentId!: number;
}

export class AttachTaskDTO {
  @ApiProperty() @IsNumber() taskId!: number;
}
