import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDTO {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class LoginDTO {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
