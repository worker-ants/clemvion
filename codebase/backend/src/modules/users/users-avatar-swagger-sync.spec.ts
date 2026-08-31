import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * `@ApiOperation`·`@ApiBody`·`@ApiPayloadTooLargeResponse` 설명에 **손으로 적힌** 한도·
 * 확장자가 상수와 갈리지 않게 고정한다.
 *
 * ## 왜 "전수 열거" 인가
 *
 * 초판은 `최대 (\d+)MB` 라는 **접두어를 요구하는** 패턴으로 찾았다. 그래서
 * `@ApiPayloadTooLargeResponse` 의 `'파일 크기 초과 (2MB)'` 는 구조적으로 매칭되지 않았고,
 * 그 값이 갈려도 테스트는 GREEN 이었다(리뷰 지적). 확장자 쪽도 `/g` 없는 `.match()` 라
 * **첫 번째 occurrence 만** 봤다.
 *
 * 둘 다 "패턴을 한 칸 넓히면" 다음에 나올 표현을 또 놓친다. 그래서 접두어를 요구하지 않고
 * **파일 안의 해당 형태를 전부 모아 각각을 상수와 대조**한다. 하한(`MIN_*`)도 함께 고정해,
 * 리터럴을 지워서 검사 대상을 줄이는 편집이 조용히 통과하지 못하게 한다.
 */
describe('아바타 Swagger 설명 ↔ 상수 동기화', () => {
  // import 경로(`../../auth/utils/auth`)가 확장자 나열과 같은 형태라 먼저 걷어낸다.
  const source = readFileSync(join(__dirname, 'users.controller.ts'), 'utf-8')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('import '))
    .join('\n');

  // 현재 개수. 늘어나는 것은 괜찮지만 줄어들면 커버리지가 조용히 준다.
  const MIN_MB_LITERALS = 4;
  const MIN_EXT_LISTS = 2;

  it('파일 안의 모든 "NMB" 가 AVATAR_MAX_BYTES 와 같다', () => {
    const mb = UsersService.AVATAR_MAX_BYTES / (1024 * 1024);
    const found = [...source.matchAll(/(\d+)\s*MB/g)].map((m) => Number(m[1]));
    expect(found.length).toBeGreaterThanOrEqual(MIN_MB_LITERALS);
    for (const f of found) expect(f).toBe(mb);
  });

  it('파일 안의 모든 확장자 나열이 AVATAR_CONTENT_TYPES 의 키와 정확히 일치한다', () => {
    const allowed = Object.keys(UsersService.AVATAR_CONTENT_TYPES).sort();
    const lists = [
      ...source.matchAll(/\b[a-z]{2,5}(?:\/[a-z]{2,5}){2,}\b/g),
    ].map((m) => m[0]);
    expect(lists.length).toBeGreaterThanOrEqual(MIN_EXT_LISTS);
    for (const l of lists) {
      // 부분집합이 아니라 **정확히 같아야** 한다 — svg 를 조용히 더해도 통과하면 안 된다.
      expect(l.split('/').sort()).toEqual(allowed);
    }
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
