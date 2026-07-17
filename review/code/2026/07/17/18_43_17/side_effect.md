# 부작용(Side Effect) 리뷰 — eslint.config.mjs 정규식 상수화 + layering-guard 테스트 강화 (+ 선행 리뷰 세션 산출물 커밋)

리뷰 범위: `git diff origin/main..HEAD` (2 코드 파일 + `review/code/2026/07/17/18_06_36/` 13개 신규 파일)

## 발견사항

- **[INFO]** `eslint.config.mjs` 정규식 상수화는 런타임 문자열이 리팩터 전/후 바이트 단위로 동일 — 독립 재현으로 확인
  - 위치: `codebase/frontend/eslint.config.mjs:5-7, 55, 61`
  - 상세: 신규 `const COMPONENTS_PATH_RE = String.raw\`...\`;` 는 module-scope `const` (ESM 파일 스코프)이며 `globalThis`/`global` 오염이 아니다. 두 `no-restricted-syntax` selector(`ImportExpression`, `CallExpression`)에 템플릿 리터럴로 보간되는데, Node 로 두 selector 문자열(구 하드코딩 리터럴 vs 신규 상수 보간)을 직접 생성·비교해 `===` true 임을 실측 확인했다(이 리뷰 세션에서 독립 재현, 선행 리뷰 `review/code/2026/07/17/18_06_36/side_effect.md` 의 동일 주장과 합치). 추가로 `npx eslint .` 를 현재 HEAD 상태에서 재실행해 `0 errors / 12 warnings` (프롬프트 명시 baseline과 동일)를 재확인했다. `eslint.config.mjs` 는 프론트엔드 전역 lint 게이트라 이 파일 변경은 원리상 "전역 side effect" 범주지만, 이번 변경은 순수 동등 치환(behavior-preserving refactor)임이 실측으로 뒷받침된다.
  - 제안: 없음 (조치 불요, 검증 기록).

- **[INFO]** `COMPONENTS_PATH_RE` 는 `String.raw` 사용으로 이스케이프된 `\/` 만 포함 — selector 델리미터(`/.../`) 파손 위험 없음
  - 위치: `codebase/frontend/eslint.config.mjs:7`
  - 상세: 템플릿 리터럴 보간(`` `ImportExpression[source.value=/${COMPONENTS_PATH_RE}/]` ``)은 상수 값에 이스케이프되지 않은 raw `/` 가 섞이면 esquery selector 파싱이 깨질 수 있는 구조다. `COMPONENTS_PATH_RE` 원문을 확인한 결과 모든 `/` 가 `\/` 로 이스케이프되어 있어 해당 위험은 없다. 상수 값이 향후 다른 목적으로 수정될 경우에만 재검토가 필요한 항목이라 조치는 불요.
  - 제안: 없음.

- **[INFO]** 테스트 파일의 `.find()` → `.filter()` + `Object.assign` 병합 전환은 import 된 `eslintConfig` 를 mutate 하지 않음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:14-21`
  - 상세: `mergedRules = Object.assign({}, ...layeringBlocks.map((c) => c.rules ?? {}))` 는 매번 새 객체를 생성해 반환하며, `import eslintConfig from "../../../eslint.config.mjs"` 로 들어온 모듈의 라이브 바인딩이나 그 내부 `rules` 객체를 직접 수정하지 않는다. 따라서 동일 vitest worker 프로세스 내에서 다른 테스트 파일이 같은 모듈을 재사용해도 오염 전파 위험이 없다(각 vitest 워커는 module cache 기준 격리이며, 이 파일 자체도 순수 파생 객체만 만든다). `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` 를 독립 실행해 23/23 통과를 재확인했다.
  - 제안: 없음.

- **[INFO]** fail-open 가드 조건 확장(`Object.keys(mergedRules).length === 0`)도 "모듈 로드 시 즉시 throw" 라는 기존 부작용 성격을 유지 — 트리거 조건만 정확해짐
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:23-29`
  - 상세: 기존 `if (!layeringBlock?.rules)` 는 `rules` 가 `{}`(빈 객체, truthy)여도 통과하는 잠재적 허점이 있었다(이번 diff 이전부터 존재, 이번 diff 의 회귀 아님). 신규 조건은 그 케이스도 포함해 잡는다. import 시점 throw(테스트 스위트 전체를 즉시 실패시키는 성질) 자체는 diff 전후 동일 — 새로운 부작용이 아니라 커버리지 보강.
  - 제안: 없음.

- **[INFO]** `codebase/` 외부 — 선행 리뷰 세션(`18_06_36`)의 산출물 13개 신규 파일이 이번 diff 에 함께 커밋됨. 프로젝트 규약상 정규 저장 위치이며 프로덕션 코드/런타임 동작에 영향 없음
  - 위치: `review/code/2026/07/17/18_06_36/{RESOLUTION.md,SUMMARY.md,_resolution_log.md,_resolution_state.json,_retry_state.json,_routing_decision.json,maintainability.md,meta.json,requirement.md,scope.md,security.md,side_effect.md,testing.md}` (13개, 전부 신규 추가)
  - 상세: `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과 정확히 일치하는 위치라 "예상치 못한 파일 생성"에 해당하지 않는다. 다만 side-effect 관점에서 참고할 점: `_retry_state.json`/`_resolution_state.json` 에는 세션 당시의 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/heuristic-nightingale-9c8a0e/review/...`)가 그대로 박제되어 커밋된다. 이 워크트리가 향후 정리(삭제)되면 해당 절대경로는 dangling 참조가 된다(프로젝트 메모리에 이미 알려진 패턴 — "output_file 은 삭제된 워크트리를 가리킴"). 이는 이번 diff 가 새로 만든 문제가 아니라 하네스가 모든 리뷰 세션 산출물에 공통으로 남기는 기존 패턴이며, 해당 JSON 은 실행 시점 감사 기록(audit trail)으로서의 의미가 크므로 즉시 조치는 불필요하다고 판단된다.
  - 제안: 조치 불요. 다만 이 절대경로들을 스크립트가 사후에 파싱·역참조하는 용도로 쓴다면(예: 상태 재구성 자동화) 세션 상대경로 기반으로 해소하는 것이 안전하다는 점을 인지해둘 것(기존 프로젝트 관례).

## 검토했으나 해당 없음

- **전역 변수 도입**: `COMPONENTS_PATH_RE` 는 ESM module-scope `const`, `globalThis`/`process` 오염 없음. 신규 전역 변수 없음.
- **함수/메서드 시그니처 변경**: `eslint.config.mjs` 의 `export default eslintConfig` 형태(배열 of flat-config object) 동일. 두 파일 모두 외부에 노출되는 함수 시그니처 변경 없음(`ruleSeverity` 는 테스트 파일 내부 전용 신규 헬퍼, export 안 됨).
- **공개 API 변경**: `eslint.config.mjs` 의 소비자(ESLint CLI, 테스트의 직접 import)에게 노출되는 구조·규칙 옵션 값 모두 실측상 리팩터 전후 동일.
- **파일시스템 부작용 (런타임)**: 두 코드 파일 모두 런타임에 파일을 생성·삭제하지 않는다. `Linter#verify` 는 순수 in-memory 검사.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음 — selector·message 는 정적 데이터, 콜백 발동 방식(ESLint 규칙 엔진 자체의 매칭·리포트 흐름) 변경 없음.

## 요약

핵심 코드 변경(`eslint.config.mjs` 의 정규식 상수화, `eslint-layering-guard.test.ts` 의 flat-config "나중 블록 우선" 병합 재현·bare fixture 추가·severity assertion 보강)은 순수 동등 치환·테스트 커버리지 강화 성격으로, 이번 리뷰 세션에서 독립적으로 재현·검증한 결과(selector 문자열 바이트 동일성, `npx eslint .` = 0 errors/12 warnings, `vitest run` 23/23 통과) 프로덕션 config 나 외부 인터페이스에 미치는 부작용은 없다. `eslint.config.mjs` 는 프론트엔드 전역 lint 게이트이므로 원리상 전역 side effect 범주에 들지만 baseline 이 변경 전후 동일함이 실측으로 확인됐다. 전역 변수 신설·시그니처/인터페이스 변경·환경변수·네트워크·이벤트/콜백 부작용은 발견되지 않았다. diff 에는 코드 외에 선행 리뷰 세션 산출물 13개 신규 파일(`review/code/2026/07/17/18_06_36/**`)도 함께 커밋되어 있으나, 프로젝트 규약상 정식 저장 위치이며 런타임 동작에 영향이 없어 "예상치 못한 파일시스템 부작용"으로 분류하지 않는다(단, 해당 상태 파일에 박제된 워크트리 절대경로가 워크트리 정리 후 dangling 될 수 있다는 기존에 알려진 특성만 참고로 기록).

## 위험도

NONE
