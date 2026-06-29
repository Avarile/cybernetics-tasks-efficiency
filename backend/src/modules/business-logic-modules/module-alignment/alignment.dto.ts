import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ALIGNABLE_TYPES, AlignableType } from './alignment.constants';

export class LinkDTO {
  @IsIn([...ALIGNABLE_TYPES])
  fromType!: AlignableType;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  fromId!: number;

  @IsIn([...ALIGNABLE_TYPES])
  toType!: AlignableType;

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
