import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import env from 'src/utils/env';

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.APP_SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
