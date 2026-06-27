import { HttpStatus } from '@nestjs/common';
import { buildOk, buildCreated } from './response.factory';

describe('response.factory', () => {
  it('buildOk returns status 200 with data and message', () => {
    const res = buildOk({ id: 1 }, 'Success');
    expect(res.status_code).toBe(HttpStatus.OK);
    expect(res.data).toEqual({ id: 1 });
    expect(res.message).toBe('Success');
    expect(res.error).toBeNull();
    expect(res.timestamp).toBeInstanceOf(Date);
  });

  it('buildCreated returns status 201', () => {
    const res = buildCreated({ id: 2 }, 'Created');
    expect(res.status_code).toBe(HttpStatus.CREATED);
    expect(res.data).toEqual({ id: 2 });
  });
});
