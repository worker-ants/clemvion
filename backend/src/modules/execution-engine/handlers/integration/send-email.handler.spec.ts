import { SendEmailHandler } from './send-email.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

describe('SendEmailHandler', () => {
  let handler: SendEmailHandler;
  const context: ExecutionContext = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
  };

  beforeEach(() => {
    handler = new SendEmailHandler();
  });

  describe('validate', () => {
    const base = { subject: 'hi', body: 'hello' };

    it('accepts a comma-separated string for to', () => {
      const result = handler.validate({
        ...base,
        to: 'a@example.com, b@example.com',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts a non-empty array for to', () => {
      const result = handler.validate({
        ...base,
        to: ['a@example.com'],
      });
      expect(result.valid).toBe(true);
    });

    it('accepts an expression template string for to', () => {
      const result = handler.validate({
        ...base,
        to: '{{ $input.recipients }}',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects missing to', () => {
      const result = handler.validate(base);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('to');
    });

    it('rejects empty string for to', () => {
      const result = handler.validate({ ...base, to: '   ' });
      expect(result.valid).toBe(false);
    });

    it('rejects empty array for to', () => {
      const result = handler.validate({ ...base, to: [] });
      expect(result.valid).toBe(false);
    });

    it('allows cc to be absent or empty', () => {
      expect(
        handler.validate({ ...base, to: 'a@b', cc: '' }).valid,
      ).toBe(true);
      expect(
        handler.validate({ ...base, to: 'a@b', cc: undefined }).valid,
      ).toBe(true);
    });

    it('rejects non-string cc', () => {
      const result = handler.validate({
        ...base,
        to: 'a@b',
        cc: 123 as unknown,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid bodyType', () => {
      const result = handler.validate({
        ...base,
        to: 'a@b',
        bodyType: 'markdown',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('execute', () => {
    it('normalizes comma-separated string to array', async () => {
      const out = (await handler.execute(
        null,
        {
          to: 'a@example.com, b@example.com ,  c@example.com',
          subject: 'hi',
          body: 'hello',
        },
        context,
      )) as { to: string[] };
      expect(out.to).toEqual([
        'a@example.com',
        'b@example.com',
        'c@example.com',
      ]);
    });

    it('preserves array input and normalizes whitespace', async () => {
      const out = (await handler.execute(
        null,
        {
          to: [' a@example.com ', 'b@example.com'],
          subject: 'hi',
          body: 'hello',
        },
        context,
      )) as { to: string[] };
      expect(out.to).toEqual(['a@example.com', 'b@example.com']);
    });

    it('returns empty cc array when not provided', async () => {
      const out = (await handler.execute(
        null,
        { to: 'a@b', subject: 'hi', body: 'hello' },
        context,
      )) as { cc: string[] };
      expect(out.cc).toEqual([]);
    });
  });
});
