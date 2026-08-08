import {
  normalizeWorkspaceHeader,
  resolveRequestWorkspaceContext,
} from './workspace-context.util';

describe('normalizeWorkspaceHeader', () => {
  it('returns undefined when header is absent', () => {
    expect(normalizeWorkspaceHeader(undefined)).toBeUndefined();
  });

  it('returns the string as-is for a single header', () => {
    expect(normalizeWorkspaceHeader('ws1')).toBe('ws1');
  });

  it('returns the first value for a duplicated (array) header', () => {
    expect(normalizeWorkspaceHeader(['ws1', 'ws2'])).toBe('ws1');
  });
});

describe('resolveRequestWorkspaceContext', () => {
  it('prefers the header over the token claim (header-first)', () => {
    const ctx = resolveRequestWorkspaceContext(
      { 'x-workspace-id': 'header-ws' },
      'token-ws',
    );
    expect(ctx.workspaceId).toBe('header-ws');
    expect(ctx.headerWorkspaceId).toBe('header-ws');
  });

  it('falls back to the token claim when no header is present', () => {
    const ctx = resolveRequestWorkspaceContext({}, 'token-ws');
    expect(ctx.workspaceId).toBe('token-ws');
    expect(ctx.headerWorkspaceId).toBeUndefined();
    expect(ctx.membershipUnverified).toBe(false);
  });

  it('reports membershipUnverified only when the header overrides the token', () => {
    const overridden = resolveRequestWorkspaceContext(
      { 'x-workspace-id': 'other-ws' },
      'own-ws',
    );
    expect(overridden.membershipUnverified).toBe(true);

    const same = resolveRequestWorkspaceContext(
      { 'x-workspace-id': 'same-ws' },
      'same-ws',
    );
    expect(same.membershipUnverified).toBe(false);
  });

  it('normalizes a duplicated header to its first value', () => {
    const ctx = resolveRequestWorkspaceContext(
      { 'x-workspace-id': ['victim-ws', 'decoy-ws'] },
      'own-ws',
    );
    expect(ctx.workspaceId).toBe('victim-ws');
    expect(ctx.headerWorkspaceId).toBe('victim-ws');
    expect(ctx.membershipUnverified).toBe(true);
  });

  it('returns undefined workspaceId when neither header nor token is present', () => {
    const ctx = resolveRequestWorkspaceContext({}, undefined);
    expect(ctx.workspaceId).toBeUndefined();
    expect(ctx.membershipUnverified).toBe(false);
  });
});
