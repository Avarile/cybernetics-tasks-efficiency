import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestTransportDTO {
  @ApiProperty() @IsEmail() to!: string;
}
