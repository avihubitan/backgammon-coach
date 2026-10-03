import { loadConfig } from './config';

describe('configuration', () => {
  it('refuses to run in production without a database', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/MONGODB_URI/);
    expect(loadConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://db:27017' }).mongoUri).toBe('mongodb://db:27017');
  });

  it('keeps data in memory for development and tests', () => {
    expect(loadConfig({}).mongoUri).toBeNull();
  });

  it('trusts the given number of proxies, and none by default', () => {
    expect(loadConfig({}).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ TRUST_PROXY: 'yes' }).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: '-2' }).trustProxy).toBe(false);
  });
});
