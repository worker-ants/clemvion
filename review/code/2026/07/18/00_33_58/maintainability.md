# 유지보수성(Maintainability) 리뷰 — 레이어 가드 리뷰-fix (문구 회귀 고정 + 근접 케이스 보강)

## 스코프 메모

`meta.json` 기준 이번 diff 의 실제 소스 코드 변경은
`codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 1개 파일뿐이다. 나머지
20개 파일(`review/code/2026/07/17/23_49_51/**`, `review/consistency/2026/07/18/00_22_41/**`)은
이전 리뷰·일관성 검토 라운드의 산출물(마크다운 보고서·JSON 상태 파일)로, 사람이 직접 유지보수하는
소스가 아니라 프로세스 기록물이라 함수 길이/중첩/매직넘버 같은 코드 유지보수성 기준이 적용되지
않는다. 아래 발견사항은 전부 실제 코드 변경분(테스트 파일)에 대한 것이다.

## 발견사항

- **[INFO]** rule-id 필터 predicate 중복이 이번 fix 이후에도 그대로 남음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:108-110` (`layeringErrors`) 와 `:239-241` (`errorsAt`)
  - 상세: `(m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax"` 가 두 헬퍼에 동일하게 반복된다. 이번 diff 는 메시지 내용 검증·근접 케이스를 추가했지만 이 중복 자체는 손대지 않았다 (이전 리뷰 INFO #9, RESOLUTION.md 상 "조치 불필요"로 처리된 항목이라 회귀는 아니다). 규칙이 하나 더 추가되면 두 곳을 수동 동기화해야 하는 drift 위험은 여전히 남아 있다.
  - 제안: 급하지 않음. 상수화(`const LAYERING_RULE_IDS = [...] as const`)는 이전 리뷰 제안대로 유효.

- **[INFO]** `GUARD_BLOCK_KEY`/`CONFIG_LOWER_LAYERS`/`EXPECTED_LOWER_LAYERS` 3개 유사 개념 이름이 병존
  - 위치: `eslint-layering-guard.test.ts:5, 26, 230`
  - 상세: `CONFIG_LOWER_LAYERS`(config 에서 import 한 실제 배열) · `GUARD_BLOCK_KEY`(그 배열의 첫 요소, 블록 탐색 키) · `EXPECTED_LOWER_LAYERS`(다른 describe 블록에서 독립적으로 하드코딩한 동일 값의 복제본)가 한 파일에 공존한다. 각각의 존재 이유는 주석으로 잘 설명돼 있으나(mutation false-green 방지를 위한 의도된 중복), 세 이름이 서로 "같은 값을 가리키지만 목적이 다르다"는 관계를 즉시 파악하기엔 약간의 인지 부하가 있다. 특히 `GUARD_BLOCK_KEY // "src/lib/**"` 라는 트레일링 주석은 `LOWER_LAYERS` 배열 순서에 대한 암묵적 가정이라, 향후 배열 순서가 바뀌면(예: `types` 를 앞에 둠) 주석만 조용히 stale 해지고 코드 동작(첫 요소로 블록을 찾는 로직)은 여전히 정상 동작한다 — 실害는 없지만 독자에게 잘못된 인상을 줄 수 있다.
  - 제안: 급하지 않음. 트레일링 주석을 `// CONFIG_LOWER_LAYERS[0]` 처럼 값이 아닌 "무엇을 가리키는지"로 바꾸거나, 세 상수 옆에 관계를 한 줄로 요약하는 공통 주석을 추가하면 향후 리팩터 시 혼동을 줄일 수 있다.

## 확인된 양호 사항

- WARNING #2(문서화 리뷰) 수정: fail-open 에러 메시지가 하드코딩 리터럴 대신 `` `files: ${JSON.stringify(CONFIG_LOWER_LAYERS)}` `` 파생으로 바뀌어, config 의 `LOWER_LAYERS` 가 늘어나도 메시지가 자동으로 최신 상태를 반영한다. 블록 탐색 키도 같은 이유로 `CONFIG_LOWER_LAYERS[0]` 파생으로 바뀌어 리터럴-config 간 drift 를 제거했다 — 정확히 지적된 유지보수성 문제(오래된 텍스트가 실제 config 형태를 오기)를 해소.
- WARNING #1(테스트 리뷰) 수정: 신규 "위반 메시지가 실제 계층 라벨과 규약 링크를 담는다" 케이스는 정적/동적/require 3개 진입점을 배열 기반 data-driven 루프(`for...of` + 튜플 배열)로 처리해, 기존 `it.each` 패턴과 스타일이 일관되고 함수 길이·중첩 모두 낮다. 각 케이스가 `toContain` 3종(라벨·spec 링크·형태별 문구)만 검증하는 단일 책임 구조로, 읽기 쉽고 순환 복잡도가 낮다.
- 신규 근접(near-miss) 케이스(`types-legacy`, `libs`, `src/lib/types/`)는 기존 `it.each`/`describe.each` 배열에 항목을 추가하는 형태라 구조 변경 없이 자연스럽게 확장됐고, 각 케이스마다 "왜 이 경계가 위험한가"를 주석으로 남겨 향후 케이스를 임의로 지우기 어렵게 만들었다.
- 매직 넘버/문자열: 남아 있는 리터럴(`"src/lib/**"`, `EXPECTED_LOWER_LAYERS` 등)은 모두 "config 에서 파생하면 mutation 이 기대값까지 함께 지워 false-green 이 된다"는 명시적 근거가 있는 의도된 예외로, 일반적 매직넘버 문제와는 성격이 다르다.
- 함수 길이·중첩 깊이·순환 복잡도: 이번 diff 로 추가된 코드는 전부 짧은 헬퍼/데이터 배열 확장 수준이며, 새로운 깊은 중첩이나 긴 함수는 도입되지 않았다.
- 네이밍·컨벤션: `CONFIG_LOWER_LAYERS`, `GUARD_BLOCK_KEY`, `expectedLabel`, `distinctPhrase` 등 이름이 목적을 명확히 드러내고, 기존 파일의 한국어 설명 주석 + 영어 식별자 컨벤션과 일관된다.

## 요약

이번 diff 는 실질적으로 테스트 파일 1개에 국한된 리뷰-fix 커밋으로, 이전 라운드에서 지적된 WARNING 2건(메시지 내용 미검증, fail-open 에러 문구의 config drift)을 정확한 근거 기반 수정으로 해소했다. 새로 추가된 코드는 기존 `it.each`/`describe.each` 관용구를 그대로 따르는 짧고 단일 책임의 구조라 가독성·복잡도 면에서 문제가 없다. 남은 항목은 이전에도 이미 INFO 로 분류돼 "조치 불필요"로 처분된 rule-id predicate 중복이 그대로 남아있는 점과, 세 개의 유사 명명 상수(`CONFIG_LOWER_LAYERS`/`GUARD_BLOCK_KEY`/`EXPECTED_LOWER_LAYERS`) 사이 관계를 파악하는 데 약간의 인지 부하가 있다는 점뿐이며, 둘 다 CRITICAL/WARNING 급이 아니다. 나머지 20개 변경 파일은 리뷰/일관성 검토 산출물(보고서)이라 코드 유지보수성 평가 대상이 아니다.

## 위험도
LOW
