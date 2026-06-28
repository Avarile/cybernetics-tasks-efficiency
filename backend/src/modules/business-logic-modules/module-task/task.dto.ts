import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { INewTask, IUpdateTask, TaskPriority } from './task.interface';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none'];

export class NewTaskDTO implements Omit<INewTask, 'createdByPersonId'> {
  @ApiProperty() @IsNumber() initiativeId!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ enum: PRIORITIES }) @IsIn(PRIORITIES) priority!: TaskPriority;
  @ApiProperty({ required: false }) @IsOptional() @IsString() startDate?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() targetDate?: string | null;
}

export class UpdateTaskDTO implements IUpdateTask {
  @ApiProperty() @IsNumber() id!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() initiativeId?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ required: false, enum: PRIORITIES }) @IsOptional() @IsIn(PRIORITIES) priority?: TaskPriority;
  @ApiProperty({ required: false }) @IsOptional() @IsString() startDate?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() targetDate?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() completedAt?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sortOrder?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
}

export class QueryTaskDTO {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) initiativeId?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) parentId?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() priority?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) page?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) pageSize?: number;
}

export class FindTaskByIdDTO {
  @ApiProperty() @IsNumber() @Type(() => Number) id!: number;
}
export class FindTaskBySlugDTO {
  @ApiProperty() @IsString() slug!: string;
}
export class TaskAssigneeDTO {
  @ApiProperty() @IsNumber() personId!: number;
}
export class TaskLabelDTO {
  @ApiProperty() @IsNumber() labelId!: number;
}
