import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { TestTransportDTO } from './email.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';

@ApiTags('mail')
@Controller('mail')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test-transport')
  @CheckPolicies((a) => a.can('manage', 'all'))
  @ApiOperation({ summary: 'Send a test email via the configured transport (admin only)' })
  async testTransport(@Body() dto: TestTransportDTO): Promise<IBaseResponse> {
    await this.emailService.sendTestEmail(dto.to);
    return buildOk(null, 'Test email sent');
  }
}
