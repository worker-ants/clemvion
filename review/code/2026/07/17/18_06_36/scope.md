# 변경 범위(Scope) 리뷰

## 대상 및 방법

- 리뷰 대상: uncommitted working diff (`git diff`) — `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 2개 파일.
- `git status --porcelain=v1 -uall` 로 대조: 위 2개 modified 파일 외에는 `review/code/2026/07/17/18_06_36/**` untracked 3건(`_retry_state.json`, `_routing_decision.json`, `meta.json`)뿐이며, 이는 본 리뷰 세션 자체의 orchestrator 부기 파일(현재 실행 중인 리뷰의 상태 기록)이지 리뷰 대상 코드 변경이 아니므로 스코프 평가 대상에서 제외.
- 의도된 범위(주어진 지시): 선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md`)의 WARNING #1(flat config 병합 의미론 미검증) · #2(bare 형태 미탐지 사각지대) · #3(정규식 중복) 후속 처리 3건.
- payload 에 제시된 diff 를 `git diff -- <두 파일>` 실측과 대조 — 완전 일치 확인.

## 항목별 대조

### WARNING #1 (flat config "나중 블록 우선" 병합 미검증) → 처리됨, 범위 내
- `layeringBlock = ...find(...)` → `layeringBlocks = ...filter(...)` 로 전환해 `src/lib/**` 를 매칭하는 모든 블록을 수집.
- `Object.assign({}, ...layeringBlocks.map((c) => c.rules ?? {}))` 로 배열 순서대로 병합해 실제 ESLint flat config 의 "나중 규칙 우선" 의미론을 재현.
- 이에 따른 연쇄 수정(`if (!layeringBlock?.rules)` → `if (Object.keys(mergedRules).length === 0)`, `verifyConfig` 의 `rules: mergedRules`, 두 개의 `expect(...).toHaveProperty(...)` 대상 교체)은 모두 이 리팩터링의 직접적 결과물이며 부수 변경이 아님.
- 선행 SUMMARY 가 제시한 두 가지 옵션 중 더 견고한 (a)(실제 병합 재현) 을 채택 — (b)(블록 1개 assert) 대비 과설계가 아니라 권장안 그대로.

### WARNING #2 (bare 형태 사각지대) → 처리됨, 범위 내
- `it.each` 위반 목록에 정확히 선행 SUMMARY 가 제안한 4종(정적 alias bare / 정적 상대경로 bare / 동적 import() alias bare / require() 상대경로 bare)만 추가.
- 기존 서브패스 케이스는 순서·내용 변경 없이 그대로 유지.

### WARNING #3 (정규식 중복) → 처리됨, 범위 내
- `COMPONENTS_PATH_RE` 상수를 파일 상단에 신설(`String.raw` 로 원본 정규식 문자열 그대로 보존, 이스케이프 표현만 변경되고 매칭 의미는 원본과 동일).
- 두 selector(`ImportExpression`, `CallExpression`)가 템플릿 리터럴로 이 상수를 보간 — 문자 그대로 복붙되어 있던 정규식을 단일 소스화.
- 선행 SUMMARY 가 "여유 있으면" 으로 명시한 선택 사항(두 정규식 문자열 동일성 assert 테스트 추가)은 미적용 — 필수 항목이 아니었으므로 누락이 아니라 스코프 밖 정확한 판단.

## 스코프 외 변경 여부

- **의도 이상의 변경**: 없음. 3개 WARNING 각각에 1:1 대응하는 diff hunk 외 추가 수정 없음.
- **불필요한 리팩토링**: 없음. `mergedRules` 도입에 따른 연쇄 변경은 WARNING #1 해결에 필수적인 범위 내 수정.
- **기능 확장(over-engineering)**: 없음. WARNING #4(spec/conventions 문서화), WARNING #5(`src/types/**` 스코프 확장) 등 선행 SUMMARY 의 아키텍처 계열 권고는 이번 diff 에 전혀 포함되지 않음 — "3건에 한정" 이라는 지시와 정확히 일치.
- **무관한 파일·영역 수정**: 없음. 두 대상 파일 외 어떤 파일도 변경되지 않음(untracked 리뷰 부기 파일 제외).
- **포맷팅 변경 혼입**: 없음. selector 를 한 줄 문자열 리터럴에서 템플릿 리터럴로 바꾼 줄바꿈 변화는 상수 보간이라는 실질 변경에 종속된 것이며 독립적인 개행/공백 정리가 아님.
- **주석 변경**: 신규 주석 3곳(정규식 상수 설명, `layeringBlocks` 필터링 이유, bare 케이스 추가 이유) 모두 해당 diff 라인의 "왜"를 설명하는 목적에 부합 — 무관한 주석 첨삭 없음.
- **임포트 변경**: 없음. import 문 변경 전무.
- **설정 변경**: `eslint.config.mjs` 자체가 대상 파일이지만, 규칙 활성화/비활성화·`files` glob·플러그인 구성 등 설정 의미(semantics)는 불변 — selector 정규식 소스를 상수화한 것뿐이며 매칭 동작은 원본과 동일(정규식 문자열 `String.raw` 로 원본과 바이트 동일 확인).

## 발견사항

없음.

## 요약

diff 는 선행 리뷰(`17_29_21/SUMMARY.md`)가 지목한 WARNING #1(flat config 병합 의미론 미검증)·#2(bare 형태 회귀 케이스 부재)·#3(정규식 중복) 3건에 정확히 1:1 대응하며, 이를 벗어나는 리팩토링·기능 확장·무관한 파일 수정·포맷팅 혼입·불필요한 주석/임포트/설정 변경이 전혀 관찰되지 않았다. `git status`/`git diff` 실측으로 대상 2개 파일 외 코드 변경이 없음을 확인했고, 같은 SUMMARY 가 별도 항목으로 분리해둔 WARNING #4·#5(아키텍처 문서화·가드 스코프 확장)는 의도적으로 이번 범위에서 제외되어 있어 "3건에 한정" 지시를 정확히 준수했다.

## 위험도

NONE
