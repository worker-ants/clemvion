import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESERVED_ERROR_PORT_ID } from './port-id.util';
import { RESERVED_ERROR_PORT_ID as REEXPORTED } from './button-slug.util';

/**
 * 에러 포트 ID 는 백엔드(`RESERVED_ERROR_PORT_ID`)와 프런트(`ERROR_PORT_ID`)에
 * 사본으로 있다. 두 패키지가 공유하는 모듈이 없어서 프런트 소스의 리터럴을 읽어
 * 값을 맞춘다. 한쪽만 바꾸면 캔버스가 그린 에러 포트 연결선을 엔진이 열지 못한다.
 */
describe('RESERVED_ERROR_PORT_ID ↔ 프런트엔드 ERROR_PORT_ID', () => {
  it('프런트 resolve-dynamic-ports.ts 의 ERROR_PORT_ID 와 값이 같다', () => {
    const source = readFileSync(
      join(
        __dirname,
        '../../../../frontend/src/lib/node-definitions/resolve-dynamic-ports.ts',
      ),
      'utf8',
    );
    const match = /export const ERROR_PORT_ID = "([^"]*)";/.exec(source);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe(RESERVED_ERROR_PORT_ID);
  });

  it('button-slug.util 이 다시 내보낸 값도 같은 상수다', () => {
    expect(REEXPORTED).toBe(RESERVED_ERROR_PORT_ID);
  });
});
