import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service';
import { LoginDTO } from './auth.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk } from 'src/utils/shared/response.factory';
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
  @UseGuards(LocalAuthGuard)
  @Post('login')
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
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the access token using the refresh cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    const data = await this.authService.refresh(req, res);
    return buildOk(data, 'Token refreshed');
  }

  @Post('logout')
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
