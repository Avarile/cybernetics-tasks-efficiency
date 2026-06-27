import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthenticationService } from './authentication.service';
import { RegisterDTO, LoginDTO } from './auth.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildCreated, buildOk } from 'src/utils/shared/response.factory';

@ApiTags('auth')
@SkipThrottle({ default: false })
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  async register(@Body() dto: RegisterDTO): Promise<IBaseResponse> {
    const data = await this.authService.register({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role,
    });
    return buildCreated(data, 'Account created');
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  async login(@Body() dto: LoginDTO): Promise<IBaseResponse> {
    const data = await this.authService.login(dto.email, dto.password);
    return buildOk(data, 'Login successful');
  }
}
