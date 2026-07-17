# 유지보수성(Maintainability) 리뷰

대상: `git diff origin/main..HEAD` (27 files changed)

- **실질 코드 변경 2개**: `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
- **그 외 25개**: `review/code/2026/07/17/18_06_36/**`(15개) · `review/code/2026/07/17/18_43_17/**`(10개) — 선행 `/ai-review` 세션 2회 분의 산출물(`RESOLUTION.md`/`SUMMARY.md`/`_resolution_*`/`_retry_state.json`/`_routing_decision.json`/`meta.json`/개별 reviewer `.md`)이 커밋된 것. `spec/conventions/plan-lifecycle` 규약상 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`가 표준 산출 경로이며, 이 파일들은 사람이 유지보수할 "코드"가 아니라 append-only 감사 기록(historical audit trail)이라 함수 길이·중첩·매직넘버 등 본 체크리스트가 실질적으로 적용되지 않는다. 파일명 컨벤션(`<agent>.md`/`_*.json`)도 기존 세션들과 일관되어 별도 지적 없음.

아래는 실질 코드 변경 2개 파일에 대한 독립 분석이다. (참고: 이 diff 는 이미 2회의 선행 `/ai-review` 라운드를 거쳐 백틱 우회 차단·severity assertion 보강 등이 반영된 최종 상태다. 선행 라운드에서 이미 식별·처리(defer 포함)된 항목은 중복 지적을 피하고 상태만 간단히 언급한다.)

## 발견사항

- **[INFO]** 테스트 파서 추출 로직의 파일 매칭이 부분 문자열(substring) 기반이라 의도치 않은 블록을 조용히 선택할 여지가 있음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:41-48` (`tsParser` 도출부, `g.includes("ts")`)
  - 상세: `blocks.filter((c) => c.languageOptions?.parser && (c.files === undefined || c.files.some((g) => g.includes("ts"))))` 의 `g.includes("ts")` 는 glob 문자열에 `"ts"` 부분열이 포함되는지만 본다. 이는 `"**/*.ts"` 뿐 아니라 예컨대 `"scripts/**"`(`scrip-**ts**`) 처럼 TypeScript 와 무관한 glob 도 우연히 매칭시킬 수 있는 느슨한 휴리스틱이다. 현재는 `.at(-1)`(배열의 마지막 매치)로 실제 TS 파서를 정확히 골라내고 있지만, 이는 "우연히 현재 config 순서가 맞아떨어진" 결과이지 매칭 로직 자체가 견고해서가 아니다. `!tsParser` 가드는 "매치가 아예 없을 때"만 fail-loud 하고, "잘못된(엉뚱한) 블록이 매치돼 그 파서가 선택되는" 경우는 감지하지 못한다 — 향후 `eslint-config-next` 업그레이드나 config 재구성으로 순서/후보가 바뀌면 조용히 잘못된 파서가 선택될 수 있다.
  - 제안: `g.endsWith(".ts") || g.endsWith(".tsx")` 처럼 확장자 기준 매칭으로 좁히거나, 최소한 "정확히 어떤 근거로 이 블록을 TS 블록으로 판단하는지" 주석을 보강. 테스트 헬퍼 코드이고 현재 실제로는 올바르게 동작하므로 이번 diff 범위에서 필수는 아님.

- **[INFO]** (선행 리뷰에서 이미 식별·defer, 재확인) `no-restricted-imports` 의 glob `group` 패턴과 `no-restricted-syntax` 의 `COMPONENTS_PATH_RE` 정규식이 "components 경로 매칭"이라는 동일 개념을 여전히 2가지 문법으로 이중 표현
  - 위치: `codebase/frontend/eslint.config.mjs:54-62`(`group` 4-엔트리) vs `:7`(`COMPONENTS_PATH_RE`)
  - 상세: minimatch glob(`no-restricted-imports`)과 esquery 정규식(`no-restricted-syntax`)은 ESLint API 상 문법이 달라 완전한 단일 소스화가 불가능한 구조적 제약이다. `review/code/2026/07/17/18_43_17/RESOLUTION.md` INFO#4 에서 이미 검토 후 "주석만으로는 drift 를 실제로 막지 못한다"는 판단으로 defer 되었다 — 재작업을 요구하는 항목은 아니며 현재 상태로도 병합 가능하다고 판단한다.
  - 제안: (기존 권고 유지) 파일 상단에 "`@/components` 경로 매칭 지점은 총 2곳, 함께 갱신 필요" 크로스레퍼런스 주석. 우선순위 낮음.

- **[INFO]** (선행 리뷰에서 이미 식별·defer, 재확인) `errors.every((m) => m.severity === 2)` 의 `2`가 이름 없는 매직 넘버
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:162`
  - 상세: ESLint `Linter#verify()` 는 severity 를 `1`(warn)/`2`(error) 숫자로만 반환하며 named export 가 없어 완전한 회피는 어렵다. 바로 위 줄(160-161)의 주석이 이 리터럴의 의미("`warn` severity 는 2 가 아닌 1")를 즉시 설명하고 있어 실질적 가독성 저해는 낮다.
  - 제안: (기존 권고 유지) `const ESLINT_ERROR_SEVERITY = 2;` 로 추출 가능하나 선택 사항, 우선순위 낮음.

## 긍정적으로 확인된 점

- **중복 제거**: `COMPONENTS_PATH_RE`(`String.raw` 사용) 로 두 selector 간 정규식 리터럴 완전 중복을 단일 소스화. `literalSpecifier`/`backtickSpecifier` 헬퍼로 "문자열 리터럴 vs 백틱" 두 AST 형태에 대한 selector 조합 로직도 추출해 4개 `no-restricted-syntax` 엔트리가 짧고 병렬적으로 읽힘.
- **네이밍**: `COMPONENTS_PATH_RE`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`/`REQUIRE_CALL`(UPPER_SNAKE_CASE 상수), `layeringBlocks`/`mergedRules`/`tsParser`/`ruleSeverity`(의미가 명확한 camelCase) 모두 목적을 정확히 드러내고 기존 코드베이스 컨벤션과 일관됨.
- **의도 명확성**: 두 파일 모두 "왜"를 설명하는 주석이 풍부하다 — 특히 `TemplateLiteral` 노드에 `.value` 가 없어 매칭이 조용히 실패하는 이유, flat config 의 "나중 블록 우선" 병합 규칙, `@typescript-eslint/parser` 를 직접 import 하지 않는 이유(phantom dependency) 등 향후 유지보수자가 "이 코드를 왜 이렇게 짰는지" 재추론할 필요가 없도록 배경을 남겼다.
- **함수 길이/책임 분리**: `ruleSeverity()`(4줄), `literalSpecifier`/`backtickSpecifier`(1~2줄), `layeringErrors()`(짧은 단일 책임) 모두 적절한 크기로 추출되어 있고 여러 책임을 겸하는 함수가 없다.
- **중첩 깊이/복잡도**: `eslint.config.mjs` 는 선언적 config 객체, 테스트 파일은 `describe`/`it.each` 평면 구조 — 순환 복잡도를 높이는 조건 분기·반복 중첩이 없다.
- **일관성**: 신규 bare-path·백틱·근접 오탐 fixture 들은 기존 `it.each` 엔트리와 동일한 1-라인 배열 리터럴·한국어 라벨 스타일을 유지한다.

## 요약

이번 diff 의 실질 코드 변경(`eslint.config.mjs`, `eslint-layering-guard.test.ts`) 은 유지보수성을 개선하는 방향이며, 이미 2회의 선행 `/ai-review` 라운드를 거치며 정규식 중복 제거·백틱 우회 차단·severity 회귀 방어까지 반영된 성숙한 최종 상태다. 함수 길이·중첩 깊이·순환 복잡도 측면에서 우려되는 지점이 없고, 네이밍과 주석 관례도 기존 코드베이스와 일관된다. 새로 식별한 사항은 테스트 헬퍼의 TS 파서 탐색이 `.includes("ts")` 부분열 매칭에 의존해 이론상 취약하다는 점(INFO, 현재는 정상 동작) 하나뿐이며, 나머지는 선행 리뷰에서 이미 검토 후 defer 하기로 확정된 항목(glob/regex 이중 표현, severity 매직넘버)의 재확인이다. 셋 다 즉시 조치를 요구하는 결함이 아니므로 병합을 막을 이유는 없다. 함께 커밋된 `review/code/**` 산출물 25개는 프로젝트 표준 경로의 생성 문서(감사 기록)로 코드 체크리스트 적용 대상이 아니다.

## 위험도

LOW
