import { cacheKey } from './cache.constants';
import { QueueName, SEND_EMAIL_JOB } from '../queue/queue.constants';

describe('email infra constants', () => {
  it('cacheKey.mailRate is tenant + purpose + email scoped', () => {
    expect(cacheKey.mailRate('public', 'signup', 'a@b.com')).toBe('cyb:public:mail:rate:signup:a@b.com');
  });

  it('EMAIL queue and send-email job name exist', () => {
    expect(QueueName.EMAIL).toBe('email');
    expect(SEND_EMAIL_JOB).toBe('send_email');
  });
});
