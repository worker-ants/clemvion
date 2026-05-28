import { isSmtpHostBlocked } from './smtp-host-guard';

describe('smtp-host-guard', () => {
  const orig = process.env.ALLOW_PRIVATE_HOST_TARGETS;
  afterEach(() => {
    if (orig === undefined) delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    else process.env.ALLOW_PRIVATE_HOST_TARGETS = orig;
  });

  it('blocks private / loopback / link-local hosts by default (guard on)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked('127.0.0.1')).toBe(true);
    expect(await isSmtpHostBlocked('10.0.0.5')).toBe(true);
    expect(await isSmtpHostBlocked('172.16.3.4')).toBe(true);
    expect(await isSmtpHostBlocked('192.168.1.10')).toBe(true);
    expect(await isSmtpHostBlocked('169.254.169.254')).toBe(true);
    expect(await isSmtpHostBlocked('localhost')).toBe(true);
    expect(await isSmtpHostBlocked('::1')).toBe(true);
  });

  it('allows private hosts when ALLOW_PRIVATE_HOST_TARGETS=true (self-host opt-out)', async () => {
    process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true';
    expect(await isSmtpHostBlocked('10.0.0.5')).toBe(false);
    expect(await isSmtpHostBlocked('localhost')).toBe(false);
    expect(await isSmtpHostBlocked('169.254.169.254')).toBe(false);
  });

  it('allows public IP literals (guard on, but not private)', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked('8.8.8.8')).toBe(false);
  });

  it('returns false for empty host', async () => {
    delete process.env.ALLOW_PRIVATE_HOST_TARGETS;
    expect(await isSmtpHostBlocked('')).toBe(false);
  });
});
