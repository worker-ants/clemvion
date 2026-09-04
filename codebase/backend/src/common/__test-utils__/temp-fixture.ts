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

/** 이름→내용 맵을 tmpdir 에 쓰고, 콜백에 절대경로 맵을 넘긴 뒤 반드시 지운다. */
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
    return fn(paths);
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
