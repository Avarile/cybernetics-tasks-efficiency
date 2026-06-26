import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { RegisterDTO, LoginDTO } from './auth.dto';
import { IBaseResponse } from 'src/utils/shared/interface';

@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post('register')
  async register(@Body() dto: RegisterDTO): Promise<IBaseResponse> {
    const data = await this.authService.register({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
    });
    return {
      data,
      status_code: HttpStatus.CREATED,
      message: 'Account created',
      error: null,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDTO): Promise<IBaseResponse> {
    const data = await this.authService.login(dto.email, dto.password);
    return {
      data,
      status_code: HttpStatus.OK,
      message: 'Login successful',
      error: null,
    };
  }
}
