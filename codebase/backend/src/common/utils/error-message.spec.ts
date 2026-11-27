import { errorMessage } from './error-message';

describe('errorMessage', () => {
  it('Error 면 message 를 준다', () => {
    expect(errorMessage(new TypeError('boom'))).toBe('boom');
  });

  it.each([
    ['문자열', 'plain', 'plain'],
    ['숫자', 42, '42'],
    ['null', null, 'null'],
    ['undefined', undefined, 'undefined'],
    ['객체', { a: 1 }, '[object Object]'],
  ])('Error 가 아니면 String() 값을 준다: %s', (_label, value, expected) => {
    expect(errorMessage(value)).toBe(expected);
  });
});
