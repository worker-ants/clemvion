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
  // 이 가드 자신은 **여기 없다** — 이름을 상수·픽스처로 들고 있을 뿐 import 하지 않는다.
  // 초판은 정규식이 JSDoc 안의 import 예시까지 잡아 두 파일을 여기 얹었는데, 그건 오판을
  // 허용목록으로 은폐한 것이었다(`02_04_38` W1). 주석·문자열 제거를 넣어 근본을 고쳤고,
  // "죽은 허용목록 항목" 캐너리가 그 결과로 이 두 줄을 죽은 항목으로 지목해 제거하게 했다.
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
 *
 * ## 세 형태를 본다 (`02_49_22` security W1)
 *
 * 초판은 named import 만 봤다. 무수정 프로브로 재니 나머지 둘이 **조용히 우회**했다:
 *
 * | 형태 | 초판 | 지금 |
 * |---|---|---|
 * | `import { resolveTriggerParameters } from '…'` | 탐지 | 탐지 |
 * | `import * as base from '…'` + `base.resolveTriggerParameters(…)` | **미탐지** | 탐지 |
 * | `const { resolveTriggerParameters } = require('…')` | **미탐지** | 탐지 |
 *
 * 우회 가능한 가드는 **없느니만 못하다** — 있다고 믿게 만든다. 세 형태 각각을 캐너리로
 * 고정했다.
 */
export function importsBaseFn(source: string): boolean {
  // **주석·문자열을 먼저 걷어낸다.** 안 그러면 문서 안의 import **예시 텍스트**가 실제
  // import 로 오판된다 — 초판은 이 파일 자신과 형제 spec 이 걸려, 그 둘을 허용목록에
  // 얹어 은폐했다(`02_04_38` architecture W1). 그러면 "죽은 허용목록 항목" 캐너리까지
  // 무력화되고, 나중에 무관한 파일이 같은 구문을 인용하면 엉뚱하게 CI 가 깨진다.
  const code = stripCommentsAndStrings(source);

  // ① named import — 멀티라인을 포함해야 한다(named 가 여럿이면 prettier 가 줄바꿈한다).
  const namedBlocks = code.match(/import\s*\{[\s\S]*?\}\s*from/g) ?? [];
  const named = new RegExp(`(^|[\\s,{])${BASE_FN}([\\s,}]|$)`);
  if (namedBlocks.some((block) => named.test(block))) return true;

  // ② `const { resolveTriggerParameters } = require('...')` — CommonJS 구조분해.
  const requireBlocks = code.match(/\{[\s\S]*?\}\s*=\s*require\s*\(/g) ?? [];
  if (requireBlocks.some((block) => named.test(block))) return true;

  // ③ namespace import — `import * as base from '...'` 뒤의 `base.resolveTriggerParameters`.
  //    별칭이 무엇이든 잡으려면 **멤버 접근 자체**를 본다. 같은 이름의 멤버를 다른
  //    네임스페이스에서 쓰는 사례는 이 저장소에 없다(실측) — 생긴다면 그건 같은 이름의
  //    다른 함수라는 뜻이라 어차피 사람이 확인해야 한다.
  return new RegExp(`\\.\\s*${BASE_FN}\\b(?![A-Za-z0-9_])`).test(code);
}

/**
 * 라인/블록 주석과 문자열·템플릿 리터럴을 공백으로 치환한다.
 *
 * AST 파서(`ts.createSourceFile`)가 더 정확하지만, 이 가드가 판정하는 대상은 **import 문
 * 하나**라 문법 표면이 좁다 — 정본 파서를 끌어오는 비용이 이득을 넘는다. 다만 주석·문자열
 * 제거는 **하지 않으면 오판이 실제로 발생**했으므로(위 참조) 그 부분만 처리한다.
 */
export function stripCommentsAndStrings(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, ' ') // 블록 주석 (JSDoc 포함)
    .replaceAll(/\/\/[^\n]*/g, ' ') // 라인 주석
    .replaceAll(/`(?:\\.|[^`\\])*`/g, ' ') // 템플릿 리터럴
    .replaceAll(/'(?:\\.|[^'\\\n])*'/g, "''") // 작은따옴표 (from '...' 형태 보존)
    .replaceAll(/"(?:\\.|[^"\\\n])*"/g, '""'); // 큰따옴표
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
