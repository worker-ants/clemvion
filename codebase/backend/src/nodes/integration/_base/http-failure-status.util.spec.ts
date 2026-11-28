import { isHttpFailureStatus } from './http-failure-status.util.js';

describe('isHttpFailureStatus', () => {
  it.each([200, 201, 204, 299])('%i 은 성공이다', (status) => {
    expect(isHttpFailureStatus(status)).toBe(false);
  });

  it.each([0, 100, 199, 300, 301, 304, 399, 400, 404, 500, 503])(
    '%i 은 실패다',
    (status) => {
      expect(isHttpFailureStatus(status)).toBe(true);
    },
  );
});
