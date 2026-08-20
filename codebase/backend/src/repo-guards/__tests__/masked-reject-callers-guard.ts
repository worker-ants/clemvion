// `resolveTriggerParameters` 직접 호출부 허용목록 가드 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `masked-reject-callers.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `eslint-unicorn-peer-guard.ts` · frontend `typescript-toolchain-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';

/** base 함수 — 마커 거부를 **하지 않는다**. */
export const BASE_FN = 'resolveTriggerParameters';

/**
 * base 함수를 직접 import 해도 되는 파일(저장소 루트 기준 상대 경로).
 *
 * - **wrapper 자신** — 감싸는 쪽이라 당연히 부른다.
 * - **webhook · schedule** — 외부 시스템이 저작하는 페이로드라 마커 리터럴이 정상 값일 수
 *   있다(EIA §R17 범위 캐비엇). 의도적으로 거부 대상이 아니다.
 * - **base 모듈 자신**과 그 테스트.
 *
 * > **Manual 실행 경로는 여기 없다.** 그쪽은
 * > `resolveTriggerParametersRejectingMasked` 를 써야 한다.
 */
export const ALLOWED_DIRECT_CALLERS: readonly string[] = [
  // wrapper 자신 — 감싸는 쪽이라 당연히 부른다.
  'codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts',
  // (wrapper 의 spec 은 wrapper 만 import 하므로 여기 없다 — 죽은 항목 캐너리가 잡아 뺐다.)
  // base 모듈의 자기 테스트.
  'codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts',
  // 스키마 로더 테스트 — 로더가 만든 스키마를 base 로 검증한다(Manual 경로 아님).
  'codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.spec.ts',
  // 외부 시스템이 저작하는 페이로드 — 마커 리터럴이 정상 값일 수 있다(EIA §R17).
  'codebase/backend/src/modules/hooks/hooks.service.ts',
  'codebase/backend/src/modules/schedules/schedule-runner.service.ts',
  // 이 가드 자신 — 이름을 상수/픽스처로 들고 있다.
  'codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts',
  'codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts',
];

/** `src/` 하위 `.ts` 전수 (node_modules·dist 제외). */
export function listSourceFiles(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (entry.name.endsWith('.ts')) {
        out.push(full);
      }
    }
  };
  walk(rootDir);
  return out;
}

/**
 * `resolveTriggerParameters` 를 **import 하는** 파일인가.
 *
 * ## 왜 "언급" 이 아니라 "import" 인가
 *
 * 초판은 이름이 등장하기만 하면 잡았는데, 실측하니 **9곳 중 5곳이 주석·설명 문자열**이었다
 * (`manual-trigger.handler.ts` 의 `{@link ...}`, `re-run.dto.ts` 의 swagger description 등).
 * 그런 파일을 허용목록에 넣으면 목록이 실제 위험과 무관해지고, 가드가 지키는 대상이
 * 흐려진다. import 문은 형태가 정해져 있으므로 그 형태만 본다.
 *
 * `resolveTriggerParametersRejectingMasked` 는 **접두가 같다** — 단어 경계로 가르지 않으면
 * wrapper 만 쓰는 파일이 base 사용으로 오인되고, 그러면 올바른 코드가 RED 를 내 가드 자체가
 * 무시된다.
 */
export function importsBaseFn(source: string): boolean {
  // `import { ..., resolveTriggerParameters, ... } from '...'` 의 named 목록 안에서만 찾는다.
  //
  // **멀티라인 import 를 반드시 포함해야 한다** — 이 저장소는 named 가 여럿이면 prettier 가
  // 줄바꿈한다(`resolve-trigger-parameters.spec.ts` 가 그 형태다). 한 줄만 보는 초판은 그
  // 파일을 놓쳤고, "죽은 허용목록 항목" 캐너리가 그걸 잡았다 — 가드가 자기 사각지대를
  // 스스로 드러낸 셈이다.
  const importBlocks = source.match(/import\s*\{[\s\S]*?\}\s*from/g) ?? [];
  const named = new RegExp(`(^|[\\s,{])${BASE_FN}([\\s,}]|$)`);
  return importBlocks.some((block) => named.test(block));
}

/** 허용목록 밖에서 base 를 직접 쓰는 파일들(저장소 루트 상대 경로, 정렬). */
export function findUnexpectedCallers(
  repoRoot: string,
  srcDir: string,
): string[] {
  return listSourceFiles(srcDir)
    .filter((f) => importsBaseFn(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(repoRoot, f).split(path.sep).join('/'))
    .filter((rel) => !ALLOWED_DIRECT_CALLERS.includes(rel))
    .sort();
}
