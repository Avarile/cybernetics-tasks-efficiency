import { IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogTimeDTO {
  @ApiProperty({ description: 'Minutes to log', required: true })
  @IsNumber()
  @Min(1)
  minutes!: number;
}

export class RecordReasonDTO {
  @ApiProperty({ description: 'Reason text', required: true })
  @IsString()
  reason!: string;

  @ApiProperty({ description: 'Reason classification', required: false })
  @IsOptional()
  @IsString()
  reasonClass?: string;
}

export class RecordOutcomeDTO {
  @ApiProperty({ description: 'Outcome result text', required: true })
  @IsString()
  result!: string;
}

export class MeasureKeyResultDTO {
  @ApiProperty({ description: 'Numeric value as string', required: true })
  @IsString()
  value!: string;
}

export class LifecyclePayloadDTO {
  @ApiProperty({ description: 'Optional context payload', required: false })
  @IsOptional()
  payload?: Record<string, unknown>;
}
