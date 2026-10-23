import {
  isDryRun,
  buildDryRunMock,
  isDryRunMockedOperation,
} from './dry-run.util';
import type { ExecutionContext } from './node-handler.interface';

function ctx(variables?: Record<string, unknown>): ExecutionContext {
  return { variables } as unknown as ExecutionContext;
}

describe('dry-run.util', () => {
  describe('isDryRun', () => {
    it('is true when variables.__dryRun === true', () => {
      expect(isDryRun(ctx({ __dryRun: true }))).toBe(true);
    });

    it('is false when variables.__dryRun === false', () => {
      expect(isDryRun(ctx({ __dryRun: false }))).toBe(false);
    });

    it('is false when __dryRun is absent', () => {
      expect(isDryRun(ctx({ other: 1 }))).toBe(false);
    });

    it('is false when variables is undefined', () => {
      expect(isDryRun(ctx(undefined))).toBe(false);
    });

    it('is false for truthy-but-not-true values (strict === true)', () => {
      expect(isDryRun(ctx({ __dryRun: 'true' }))).toBe(false);
      expect(isDryRun(ctx({ __dryRun: 1 }))).toBe(false);
    });
  });

  describe('buildDryRunMock', () => {
    it('returns the dry-run mock shape with kind and no extra fields', () => {
      const mock = buildDryRunMock('http_request');
      expect(mock).toEqual({
        _dryRun: true,
        skippedReason: 'dry-run mode',
        wouldHaveCalled: { kind: 'http_request' },
      });
    });

    it('merges wouldHaveCalled fields alongside kind', () => {
      const mock = buildDryRunMock('database_query', {
        operation: 'insert',
        sqlPreview: 'INSERT INTO t',
      });
      expect(mock).toEqual({
        _dryRun: true,
        skippedReason: 'dry-run mode',
        wouldHaveCalled: {
          kind: 'database_query',
          operation: 'insert',
          sqlPreview: 'INSERT INTO t',
        },
      });
    });

    it('defaults wouldHaveCalled extra fields to empty (kind only)', () => {
      const mock = buildDryRunMock('send_email', {});
      expect(mock.wouldHaveCalled).toEqual({ kind: 'send_email' });
    });
  });

  // 부수효과 판정 — 근거: CLE-EXEC-RERUN 「부수효과 판정」.
  describe('isDryRunMockedOperation', () => {
    const NO_GETS: ReadonlySet<string> = new Set();

    it.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
      'mocks a %s operation',
      (method) => {
        expect(isDryRunMockedOperation({ id: 'op', method }, NO_GETS)).toBe(
          true,
        );
      },
    );

    it('calls a GET operation for real', () => {
      expect(
        isDryRunMockedOperation({ id: 'op', method: 'GET' }, NO_GETS),
      ).toBe(false);
    });

    it('mocks a GET operation listed as state-changing', () => {
      const stateChangingGets = new Set(['get-cart_free_config-update']);
      expect(
        isDryRunMockedOperation(
          { id: 'get-cart_free_config-update', method: 'GET' },
          stateChangingGets,
        ),
      ).toBe(true);
      expect(
        isDryRunMockedOperation(
          { id: 'get-cart_free_config', method: 'GET' },
          stateChangingGets,
        ),
      ).toBe(false);
    });

    it('treats an unexpected method spelling as a side effect (fail-closed)', () => {
      expect(
        isDryRunMockedOperation({ id: 'op', method: 'get' }, NO_GETS),
      ).toBe(true);
      expect(isDryRunMockedOperation({ id: 'op', method: '' }, NO_GETS)).toBe(
        true,
      );
    });
  });
});
