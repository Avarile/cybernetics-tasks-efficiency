import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from 'src/common/decorators/roles.decorator';

export class RegisterDTO {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class LoginDTO {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
