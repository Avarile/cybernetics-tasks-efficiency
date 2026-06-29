import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FilePurpose } from './file.interface';

export class SignatureDTO {
  @ApiProperty({ enum: FilePurpose }) @IsEnum(FilePurpose) purpose!: FilePurpose;
  @ApiProperty() @IsString() contentType!: string;
  @ApiProperty() @IsInt() @Min(1) @Type(() => Number) contentLength!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() hash?: string;
}

export class FindBySlugDTO {
  @ApiProperty() @IsString() slug!: string;
}
