import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LinkDTO {
  @IsString()
  fromType!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  fromId!: number;

  @IsString()
  toType!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  toId!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weight?: number;
}

export class UnlinkDTO {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  id!: number;
}
