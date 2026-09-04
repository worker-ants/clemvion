// 저장소 가드 spec 들이 공유하는 tmpdir 픽스처 헬퍼.
//
// **실제 소스를 변형하지 않는다.** 종전에 실제 서비스·엔티티 파일을 `writeFileSync` 로
// 변형했다가 복원하는 방식을 썼고 두 가지가 잘못됐다: (a) 복원이 실패하면 서비스 파일이
// 변조된 채 남고, (b) `eslint --fix` 가 데코레이터를 여러 줄로 바꾸자 `.replace()` 가
// 조용히 no-op 이 돼 **무효 뮤턴트**가 됐다.
//
// `nullable-type-lie-cast.spec.ts` 안의 지역 함수였는데, 두 번째 소비처
// (`swagger-dto-contract.spec.ts`) 가 생기면서 여기로 옮겼다 — 사본 5개를 없앤 직후에
// 새 사본을 만들지 않기 위해서다.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * `fn` 이 thenable(Promise-like) 을 반환했는가.
 *
 * `typeof value.then === 'function'` 만 본다 — Promise 인스턴스인지가 아니라 "그걸 기다려야
 * 하는가" 가 판정 기준이다(thenable 규약).
 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * 이름→내용 맵을 tmpdir 에 쓰고, 콜백에 절대경로 맵을 넘긴 뒤 반드시 지운다.
 *
 * ## 동기 콜백 전용이다 — async 콜백은 조용히 레이스를 낸다 (리뷰 W4)
 *
 * `finally` 는 `fn(paths)` 의 반환값을 기다리지 않는다. `fn` 이 async 함수라면 즉시 pending
 * `Promise` 를 반환하고, `finally` 의 `rmSync` 가 콜백 본문이 실제로 파일을 읽기 **전에**
 * 곧바로 실행돼 tmpdir 이 먼저 사라진다 — 조용한 `ENOENT` 로만 드러나는 레이스다.
 *
 * 이 헬퍼가 원래 지역 함수였을 땐 소비처가 전부 동기였어서 발현하지 않았지만, 공유
 * 유틸로 승격되며 다음 소비처가 이 함정을 밟을 확률이 커졌다. 지금 async 소비처는
 * **0건**(2026-09-04 실측) 이라 async 지원을 새로 만들지는 않는다 — 대신 그 조용한 함정을
 * **시끄럽게** 만든다: `fn` 이 thenable 을 반환하면 즉시 명확한 메시지로 throw 한다.
 * async 콜백이 실제로 필요해지면 그때 이 함수를 `async`/`await` 로 넓힌다.
 */
export function withFiles<T>(
  files: Record<string, string>,
  fn: (paths: Record<string, string>) => T,
  prefix = 'repo-guard-',
): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const paths: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.writeFileSync(full, content);
    paths[name] = full;
  }
  try {
    const result = fn(paths);
    if (isThenable(result)) {
      throw new Error(
        'withFiles: fn 은 동기 콜백만 지원한다. async/Promise 를 반환하는 콜백을 넘기면 ' +
          'finally 의 rmSync 가 완료를 기다리지 않고 먼저 실행되어 tmpdir 이 조기 삭제된다 ' +
          '— 현재 소비처는 전부 동기다. async 콜백이 필요하면 이 헬퍼를 async 로 확장하라.',
      );
    }
    return result;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** 파일 하나짜리 픽스처 — {@link withFiles} 의 얇은 래퍼. */
export function withFixture<T>(
  content: string,
  fn: (file: string) => T,
  name = 'probe.ts',
): T {
  return withFiles({ [name]: content }, (paths) => fn(paths[name]));
}
