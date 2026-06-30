import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service';
import { LoginDTO, RegisterDTO } from './auth.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildCreated, buildOk } from 'src/utils/shared/response.factory';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { LocalAuthGuard } from 'src/common/guards/local-auth.guard';
import { IUserSession } from './current-user-module/session.interface';

@ApiTags('auth')
@SkipThrottle({ default: false })
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account' })
  @ApiBody({ type: RegisterDTO })
  async register(
    @Body() dto: RegisterDTO,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    const data = await this.authService.register(dto.name, dto.email, dto.password, req, res);
    return buildCreated(data, 'Registration successful');
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password' })
  @ApiBody({ type: LoginDTO })
  async login(
    @CurrentUser() user: IUserSession,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    const data = await this.authService.login(user, req, res);
    return buildOk(data, 'Login successful');
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the access token using the refresh cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    const data = await this.authService.refresh(req, res);
    return buildOk(data, 'Token refreshed');
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    await this.authService.logout(req, res);
    return buildOk(null, 'Logged out');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  async me(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    return buildOk(user, 'Current user');
  }
}
