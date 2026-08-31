import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * `@ApiOperation` 설명에 **손으로 적힌** 한도·확장자가 상수와 갈리지 않게 고정한다.
 *
 * 초판에는 "회귀 테스트가 두 값의 동일성을 고정한다" 는 주석이 컨트롤러에 있었지만
 * **그런 테스트는 없었다.** 게다가 그 주석이 가리킨 `limits.fileSize` 는 상수를 직접
 * 참조하므로 애초에 갈릴 수 없었다. 진짜로 갈릴 수 있는 곳은 여기 — 상수에서 파생되지
 * 않는 Swagger 산문 리터럴이다.
 */
describe('아바타 Swagger 설명 ↔ 상수 동기화', () => {
  const source = readFileSync(join(__dirname, 'users.controller.ts'), 'utf-8');

  it('설명의 "최대 NMB" 가 AVATAR_MAX_BYTES 와 같다', () => {
    const mb = UsersService.AVATAR_MAX_BYTES / (1024 * 1024);
    const found = [...source.matchAll(/최대 (\d+)MB/g)].map((m) => m[1]);
    // 리터럴이 하나도 없으면 vacuous 하게 통과한다 — 존재부터 고정한다.
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) expect(Number(f)).toBe(mb);
  });

  it('설명이 나열한 확장자가 AVATAR_CONTENT_TYPES 의 키와 정확히 일치한다', () => {
    const allowed = Object.keys(UsersService.AVATAR_CONTENT_TYPES).sort();
    const m = source.match(/\(최대 \d+MB, ([a-z/]+)\)/);
    expect(m).not.toBeNull();
    const listed = (m as RegExpMatchArray)[1].split('/').sort();
    // 부분집합이 아니라 **정확히 같아야** 한다 — SVG 를 조용히 허용해도 통과하면 안 된다.
    expect(listed).toEqual(allowed);
  });
});

/**
 * `POST` 는 NestJS 기본이 **201** 이다. 이 컨트롤러의 다른 POST 5개는 전부 명시 200 을
 * 걸어 두었는데 `uploadAvatar` 만 빠져 있었다 — Swagger 는 200 을 문서화하므로 런타임과
 * 어긋난다. 데코레이터가 지워지면 여기서 걸린다.
 */
describe('POST me/avatar 는 200 을 낸다 (자매 엔드포인트와 동일)', () => {
  it('@HttpCode(200) 메타데이터가 붙어 있다', () => {
    const code = Reflect.getMetadata(
      '__httpCode__',
      UsersController.prototype.uploadAvatar,
    ) as number | undefined;
    expect(code).toBe(200);
  });
});
