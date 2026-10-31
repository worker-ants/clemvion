import { rethrowIfNodeCancelled } from './llm-cancellation';
import { isAbortError } from '../../../modules/execution-engine/execution-engine.service';

/**
 * Anthropic and OpenAI SDKs reject an aborted request with
 * `APIUserAbortError`, whose `name` stays `'Error'`. This stands in for it
 * without importing the SDKs.
 */
class APIUserAbortError extends Error {
  constructor() {
    super('Request was aborted.');
  }
}

function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

function catchThrown(fn: () => void): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe('rethrowIfNodeCancelled', () => {
  it('does nothing while the node signal is open, even for an AbortError', () => {
    const open = new AbortController().signal;
    const abortErr = Object.assign(new Error('timed out'), {
      name: 'AbortError',
    });
    expect(() => rethrowIfNodeCancelled(abortErr, open)).not.toThrow();
    expect(() =>
      rethrowIfNodeCancelled(new APIUserAbortError(), open),
    ).not.toThrow();
  });

  it('does nothing without a node signal', () => {
    expect(() =>
      rethrowIfNodeCancelled(new APIUserAbortError(), undefined),
    ).not.toThrow();
  });

  it('rethrows an AbortError unchanged once the node signal aborted', () => {
    const abortErr = Object.assign(new Error('aborted'), {
      name: 'AbortError',
    });
    expect(
      catchThrown(() => rethrowIfNodeCancelled(abortErr, abortedSignal())),
    ).toBe(abortErr);
  });

  it('rethrows a non-Error AbortError-like value unchanged', () => {
    const foreign = { name: 'AbortError', message: 'cross-realm' };
    expect(
      catchThrown(() => rethrowIfNodeCancelled(foreign, abortedSignal())),
    ).toBe(foreign);
  });

  it('wraps an SDK abort error in an AbortError the engine classifies as cancelled', () => {
    const sdkErr = new APIUserAbortError();
    const thrown = catchThrown(() =>
      rethrowIfNodeCancelled(sdkErr, abortedSignal()),
    );
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toMatchObject({
      name: 'AbortError',
      message: 'Request was aborted.',
      cause: sdkErr,
    });
    expect(isAbortError(thrown)).toBe(true);
  });

  it('wraps a non-Error rejection with a fallback message', () => {
    const thrown = catchThrown(() =>
      rethrowIfNodeCancelled('boom', abortedSignal()),
    );
    expect(thrown).toMatchObject({
      name: 'AbortError',
      message: 'LLM call was aborted',
      cause: 'boom',
    });
  });
});
