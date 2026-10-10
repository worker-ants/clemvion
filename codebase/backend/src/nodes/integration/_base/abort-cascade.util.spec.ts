import {
  isAbortErrorLike,
  isUpstreamAbort,
  linkUpstreamAbort,
} from './abort-cascade.util.js';

// NERV CLE-EXEC-CANCEL §fetch 자체 타임아웃과의 연쇄 — the helper HTTP Request ·
// Cafe24 · MakeShop share to wire the execution's `context.abortSignal` into the
// controller each call already owns for its own timeout.
describe('linkUpstreamAbort', () => {
  it('returns a no-op and leaves the controller alone when there is no upstream', () => {
    const controller = new AbortController();
    const unlink = linkUpstreamAbort(controller, undefined);
    expect(controller.signal.aborted).toBe(false);
    expect(() => unlink()).not.toThrow();
  });

  it('aborts the controller immediately when upstream is ALREADY aborted', () => {
    // A listener added to an aborted signal never fires, so this branch is the
    // only thing that stops the request when cancellation landed first.
    const upstream = new AbortController();
    upstream.abort();
    const controller = new AbortController();
    linkUpstreamAbort(controller, upstream.signal);
    expect(controller.signal.aborted).toBe(true);
  });

  it('aborts the controller when upstream fires later', () => {
    const upstream = new AbortController();
    const controller = new AbortController();
    linkUpstreamAbort(controller, upstream.signal);
    expect(controller.signal.aborted).toBe(false);
    upstream.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('unlink removes the listener — a later upstream abort no longer reaches the controller', () => {
    // The leak this helper exists to close: a request that SUCCEEDS never
    // aborts its own controller, so cleanup hung off that controller's abort
    // event never ran and every call left a listener on the execution-wide
    // signal.
    const upstream = new AbortController();
    const controller = new AbortController();
    const unlink = linkUpstreamAbort(controller, upstream.signal);
    unlink();
    upstream.abort();
    expect(controller.signal.aborted).toBe(false);
  });

  it('does not accumulate listeners across repeated link/unlink cycles', () => {
    // Observed through the listener calls, not timing: the commerce clients
    // recurse on 429/401, so each attempt links again.
    const upstream = new AbortController();
    const add = jest.spyOn(upstream.signal, 'addEventListener');
    const remove = jest.spyOn(upstream.signal, 'removeEventListener');
    const attempts = [0, 1, 2];
    attempts.forEach(() => {
      const unlink = linkUpstreamAbort(new AbortController(), upstream.signal);
      unlink();
    });
    expect(add).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledTimes(3);
    // Each removal names the exact function that was added.
    attempts.forEach((i) => {
      expect(remove.mock.calls[i][1]).toBe(add.mock.calls[i][1]);
    });
  });

  it('does not touch an upstream that was already aborted', () => {
    const upstream = new AbortController();
    upstream.abort();
    const add = jest.spyOn(upstream.signal, 'addEventListener');
    const unlink = linkUpstreamAbort(new AbortController(), upstream.signal);
    unlink();
    expect(add).not.toHaveBeenCalled();
  });
});

describe('isUpstreamAbort', () => {
  const abortError = () =>
    Object.assign(new Error('aborted'), { name: 'AbortError' });

  it('is true for an AbortError while upstream is aborted', () => {
    const upstream = new AbortController();
    upstream.abort();
    expect(isUpstreamAbort(abortError(), upstream.signal)).toBe(true);
  });

  it('is false for an AbortError while upstream is still open — the LOCAL timeout aborted it', () => {
    const upstream = new AbortController();
    expect(isUpstreamAbort(abortError(), upstream.signal)).toBe(false);
  });

  it('is false for an AbortError when there is no upstream at all', () => {
    expect(isUpstreamAbort(abortError(), undefined)).toBe(false);
  });

  it('is false for a non-abort error even when upstream is aborted', () => {
    // Only a real AbortError counts — an unrelated failure that happens to
    // land after cancellation keeps its own mapping.
    const upstream = new AbortController();
    upstream.abort();
    expect(
      isUpstreamAbort(new TypeError('fetch failed'), upstream.signal),
    ).toBe(false);
    expect(isUpstreamAbort('AbortError', upstream.signal)).toBe(false);
    expect(isUpstreamAbort(null, upstream.signal)).toBe(false);
  });

  it('recognises an AbortError from another realm by name', () => {
    // A real `fetch` rejects with a DOMException; under jest's VM sandbox it may
    // not satisfy `instanceof Error`. The engine's `isAbortError` duck-types on
    // `name` for the same reason, so the two must agree.
    const upstream = new AbortController();
    upstream.abort();
    const foreign = { name: 'AbortError', message: 'aborted' };
    expect(foreign instanceof Error).toBe(false);
    expect(isUpstreamAbort(foreign, upstream.signal)).toBe(true);
  });

  it('is true for the error a real aborted signal produces', () => {
    const upstream = new AbortController();
    upstream.abort();
    let thrown: unknown;
    try {
      upstream.signal.throwIfAborted();
    } catch (err) {
      thrown = err;
    }
    expect(isUpstreamAbort(thrown, upstream.signal)).toBe(true);
  });
});

describe('isAbortErrorLike', () => {
  it('is true for an Error named AbortError', () => {
    expect(
      isAbortErrorLike(Object.assign(new Error('x'), { name: 'AbortError' })),
    ).toBe(true);
  });

  it('is true for the DOMException a real aborted signal throws', () => {
    const controller = new AbortController();
    controller.abort();
    let thrown: unknown;
    try {
      controller.signal.throwIfAborted();
    } catch (err) {
      thrown = err;
    }
    expect(isAbortErrorLike(thrown)).toBe(true);
  });

  it('is true for an AbortError from another realm that is not an Error instance', () => {
    const foreign = { name: 'AbortError', message: 'aborted' };
    expect(foreign instanceof Error).toBe(false);
    expect(isAbortErrorLike(foreign)).toBe(true);
  });

  it('is false for other errors and for non-objects', () => {
    expect(isAbortErrorLike(new TypeError('fetch failed'))).toBe(false);
    expect(isAbortErrorLike('AbortError')).toBe(false);
    expect(isAbortErrorLike(null)).toBe(false);
    expect(isAbortErrorLike(undefined)).toBe(false);
  });
});
