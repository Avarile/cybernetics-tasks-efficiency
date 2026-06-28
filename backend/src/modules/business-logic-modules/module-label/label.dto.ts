import { IsString, IsOptional, IsNumber, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { INewLabel, IUpdateLabel } from './label.interface';

export class NewLabelDTO implements INewLabel {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() color?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateLabelDTO implements IUpdateLabel {
  @ApiProperty() @IsNumber() id!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() color?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sortOrder?: number;
}

export class FindLabelByIdDTO {
  @ApiProperty() @IsNumber() @Type(() => Number) id!: number;
}
