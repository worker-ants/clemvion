# 유지보수성(Maintainability) 리뷰

대상: `git diff origin/main..HEAD` (15 files changed)
- 코드: `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
- 그 외 13개 파일은 `review/code/2026/07/17/18_06_36/**` — 선행 코드 리뷰 세션(RESOLUTION.md·SUMMARY.md·`_resolution_*`·`_retry_state.json`·`_routing_decision.json`·`meta.json`·6개 개별 reviewer `.md`)의 생성물이 커밋된 것. `spec/conventions/plan-lifecycle` 규약상 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 위치가 표준 산출 경로이며, 이 파일들은 사람이 유지보수할 "코드"가 아니라 append-only 감사 기록(historical audit trail)이므로 함수 길이·중첩·매직넘버 등 본 체크리스트가 실질적으로 적용되지 않는다. 네이밍(파일명 컨벤션 `<agent>.md`/`_*.json`)도 기존 세션들과 일관되어 별도 지적 없음.

아래는 실질 코드 변경 2개 파일에 대한 분석이다.

## 발견사항

- **[INFO]** glob 패턴(`no-restricted-imports`)과 정규식 상수(`no-restricted-syntax`)가 "components 경로 매칭"이라는 동일 개념을 여전히 두 문법으로 이중 표현
  - 위치: `codebase/frontend/eslint.config.mjs:38-44`(`group: ["@/components", "@/components/**", "**/../components", "**/../components/**"]`) vs `:6`(`COMPONENTS_PATH_RE`)
  - 상세: 이번 diff 는 두 `no-restricted-syntax` selector 사이의 정규식 리터럴 중복(동일 개념의 2중 하드코딩)을 `COMPONENTS_PATH_RE` 상수로 성공적으로 제거했다 — "중복 코드" 관점의 명확한 개선이며, 상단 주석("한쪽만 완화되는 drift 방지")도 의도를 정확히 전달한다. 다만 `no-restricted-imports` 의 `group` 은 minimatch glob 문법이라 이 정규식 상수를 공유할 수 없는 구조적 제약이 있다. 결과적으로 "bare + 하위 경로 매칭"이라는 동일 의도가 (a) glob 4-엔트리, (b) 정규식 1-소스로 파일 내 2곳에 남아 있어, 향후 매칭 대상(신규 alias, 신규 우회 경로)이 추가될 때 한쪽만 갱신되고 다른 쪽이 누락될 여지가 있다. ESLint API 제약상 완전한 단일 소스화는 불가능하므로 구조적으로 불가피한 잔존 리스크다.
  - 제안: 파일 상단에 "`@/components` 경로를 매칭하는 지점은 총 2곳(`group` patterns, `COMPONENTS_PATH_RE`)이며 함께 갱신해야 한다"는 크로스레퍼런스 주석 1줄을 추가하면 향후 drift 를 낮출 수 있다. 이번 diff 범위를 넘는 개선이라 필수는 아니다.

- **[INFO]** `errors.every((m) => m.severity === 2)` 의 `2` 가 이름 없는 리터럴(매직 넘버)
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` "위반으로 잡혀야 하는 형태" `it.each` 콜백 (신규 severity assertion)
  - 상세: ESLint `Linter#verify()` 메시지의 severity 는 `1`(warn)/`2`(error) 숫자로만 반환되고 별도 named export 가 없어 완전한 회피는 어렵다. 바로 위 주석("ESLint 의 `warn` severity 는 2 가 아닌 1")이 이 리터럴의 의미를 즉시 설명하고 있어 실질적인 가독성 저해는 낮다. 같은 파일 안에서 `ruleSeverity()` 헬퍼는 config 선언값을 문자열 `"error"` 로 검증하고, 이 assertion 은 실제 verify 출력값을 숫자 `2` 로 검증한다 — 표기가 다른 이유(config 는 문자열/숫자 양쪽을 허용하지만 verify 출력은 항상 숫자)도 인접 주석으로 설명돼 있어 의도적 트레이드오프로 판단된다.
  - 제안: 선택 사항. `const ESLINT_ERROR_SEVERITY = 2;` 같은 이름 있는 상수로 추출하면 두 severity 표현(`"error"` 문자열 vs `2` 숫자) 사이의 개념적 연결이 코드 레벨에서도 더 명시적이 된다. 우선순위 낮음 — 즉시 조치 불요.

## 긍정적으로 확인된 점

- **중복 제거**: `COMPONENTS_PATH_RE` 상수화로 두 `no-restricted-syntax` selector 간에 있던 정규식 리터럴(이중 이스케이프 포함) 완전 중복이 단일 소스로 통합됨. `String.raw` 사용으로 이스케이프 표현이 더 읽기 쉬워짐(리팩터 전/후 런타임 문자열은 바이트 단위로 동일 — 순수 치환).
- **네이밍**: `COMPONENTS_PATH_RE`(UPPER_SNAKE_CASE) 는 동일 코드베이스(`scripts/copy-widget.mjs` 의 `WIDGET_PACKAGE`, `CODEPLOY_DIR` 등) 상수 명명 관례와 일치. 테스트 파일의 `layeringBlock`(단수) → `layeringBlocks`(복수, `.filter`) + `mergedRules` 리네이밍도 변수 의미 변화를 정확히 반영해 오해의 소지가 없음.
- **의도 명확성(가독성)**: `layeringBlocks`/`mergedRules` 도입부 주석이 "왜"(ESLint flat config 가 나중 블록 우선으로 병합되므로 첫 블록만 보면 fail-open) 를 명시하고, 새 bare-path `it.each` 케이스마다 "이 케이스가 없으면 어떤 mutation 이 통과해버리는지"를 주석으로 남겨 회귀 방지 의도가 코드만으로 파악됨. 근접 오탐(`@/components-legacy` 등) negative fixture 도 동일한 패턴.
- **함수 길이/책임 분리**: `ruleSeverity()` 는 3줄짜리 단일 책임 헬퍼로 적절히 추출됨(문자열/숫자 severity 표기를 정규화). 기존 `layeringErrors()` 는 변경 없음. 두 파일 모두 함수 길이·책임 과다 문제 없음.
- **중첩 깊이 / 복잡도**: `eslint.config.mjs` 는 선언적 config 객체이고 테스트 파일도 `describe`/`it.each` 평면 구조를 유지 — 이번 diff 로 중첩이나 순환 복잡도가 늘어난 지점 없음.
- **일관성**: 신규 bare-path 4개 케이스는 기존 엔트리와 동일한 1-라인 배열 리터럴 스타일·한국어 라벨 컨벤션을 유지. 파일 상단 JSDoc 블록의 "여기서 왜 실제 config 를 import 해 검증하는지"를 설명하는 기존 서술 패턴과도 결이 맞음.

## 요약

이번 diff 의 실질 코드 변경(`eslint.config.mjs`, `eslint-layering-guard.test.ts`) 은 유지보수성을 개선하는 방향이다. 정규식 리터럴 완전 중복을 이름 있는 공유 상수로 제거했고, flat config 의 "나중 블록 우선" 병합 규칙을 실제로 재현하도록 테스트를 강화하면서 관련 헬퍼(`ruleSeverity`)를 적절히 분리했다. 네이밍·주석("왜") 관례·기존 테스트 스타일과의 일관성이 모두 양호하며, 함수 길이·중첩 깊이·순환 복잡도 측면에서 우려되는 지점은 없다. 남은 지적은 두 건 모두 INFO 수준(ESLint API 제약으로 구조적으로 불가피한 glob/regex 이중 표현, 이미 인접 주석으로 설명된 severity 리터럴 `2`)으로, 즉시 조치가 필요한 결함은 아니다. 함께 커밋된 `review/code/2026/07/17/18_06_36/**` 산출물 13개는 프로젝트 규약이 정한 표준 경로에 위치한 생성 문서로, 코드 유지보수성 체크리스트가 적용될 대상이 아니며 별도 지적사항 없다.

## 위험도

LOW
