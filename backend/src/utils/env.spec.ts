describe('env', () => {
  it('parses with defaults and required overrides', () => {
    jest.resetModules(); // env.ts parses once at import; reset so our overrides take effect
    delete process.env.COMPANY_SCHEMA; // exercise the 'public' default, not the value jest.setup loaded from .env
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_ACCOUNT = 'admin@co.com';
    process.env.ADMIN_ACCOUNT_PASSWORD = 'pw';
    process.env.DATABASE_MAIN_DATABASE = 'cybernetic';
    const { default: env } = require('./env');
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.COMPANY_SCHEMA).toBe('public');
    expect(env.JWT_SECRET).toBe('test-secret');
  });
});
