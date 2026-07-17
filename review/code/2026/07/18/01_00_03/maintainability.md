# 유지보수성(Maintainability) 리뷰 — 레이어 가드 종결 리뷰 반영 (메시지 뒤바뀜 탐지 + JSDoc 스코프 갱신)

## 스코프 메모

`meta.json`(파일 8) 기준 이번 diff 21개 파일 중 실제 소스 코드 변경은
`codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 1개뿐이다. 나머지 20개는
직전 코드 리뷰(`review/code/2026/07/18/00_33_58/**`)와 일관성 검토(`review/consistency/2026/07/18/00_22_41/**`)
산출물을 기록으로 남기는 마크다운·JSON 이며, 사람이 직접 유지보수하는 실행 코드가 아니라 함수
길이·중첩·매직넘버 등 코드 유지보수성 기준이 적용되지 않는다(CLAUDE.md 저장 위치 규약에 부합하는
정상 기록물). `spec/conventions/frontend-layering.md` §4.1 에 추가된 한 줄("메시지 콘텐츠" 항목)도
산문 문서이며, 이번 diff 가 실제로 담고 있는 테스트 로직 변경과 내용이 정합한다. 아래 발견사항은
테스트 파일 diff 자체에 집중한다.

## 독립 검증

- `npx eslint src/lib/__tests__/eslint-layering-guard.test.ts` → 0 errors (lint 클린, 신규 라인 길이/스타일 위반 없음).
- `npx vitest run` → 51/51 통과.
- 회귀 탐지력 실측 재현: `eslint.config.mjs` 의 `message: STATIC_IMPORT_MSG` → `message: DYNAMIC_IMPORT_MSG` 로 mutation 후 재실행 시 신규 테스트가 정확히 실패(`not.toContain('동적 import() 로도')` 위반)로 잡아냄 — RESOLUTION.md 가 주장한 WARNING #1 fix 가 실제로 유효함을 직접 확인했다(원복 완료, 소스 diff 없음).

## 발견사항

- **[INFO]** rule-id 필터 predicate 중복이 이번 diff 이후에도 그대로 남음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:214-216` (`layeringErrors`) 및 `:355-358` (`errorsAt`)
  - 상세: `(m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-syntax"` 가 두 헬퍼에 동일하게 반복된다. 이번 diff 가 손댄 범위(JSDoc·문구 회귀 테스트)와는 무관한 기존 코드라 회귀는 아니며, 이전 라운드에서 이미 INFO로 "조치 불필요" 처분된 항목이다. 규칙이 하나 더 추가되면 두 곳을 수동 동기화해야 하는 drift 위험은 여전히 남아 있다.
  - 제안: 급하지 않음. 상수화(`const LAYERING_RULE_IDS = [...] as const`)로 단일화하면 향후 규칙 추가 시 한 곳만 고치면 된다.

- **[INFO]** 신규 문구 회귀 테스트의 `present`/`absent` 루프가 static 케이스에서 `present: []` 인 이유가 코드만 봐서는 즉시 드러나지 않음
  - 위치: `eslint-layering-guard.test.ts:126-135` (case 배열), `:140-142` (실행 루프)
  - 상세: `for (const phrase of present) ...` 가 static 케이스에서 0회 순회하는 이유(“static 은 고유 qualifier 가 없다”)는 바로 위 주석(`:124`)에 정확히 설명돼 있어 실제로는 문제 없음 — 다만 이 설계는 "빈 배열 = no-op" 이라는 암묵적 관례에 의존하므로, 향후 진입점이 하나 더 추가돼 실수로 `present`/`absent` 둘 다 빈 배열을 넣으면(즉 아무것도 검증 안 함) 테스트가 조용히 그린으로 남는다. 현재는 3개 케이스 전부 `present`·`absent` 중 최소 하나는 비어있지 않아 문제가 없다.
  - 제안: 조치 불필요(현재 케이스 3개로는 실질 위험 없음). 향후 케이스가 늘어나면 "적어도 하나는 비어있지 않아야 한다"는 불변조건을 코멘트나 헬퍼 assertion으로 명시하는 것을 고려.

## 확인된 양호 사항

- WARNING #1(직전 라운드) 완결: `distinctPhrase` 단일 positive 단언 → `{ code, present, absent }` 구조로 전환해 static↔dynamic·static↔require 상수 뒤바뀜을 실제로 탐지하도록 보강됐다. 타입도 `readonly [string, string]` 위치 기반 튜플에서 `{ code: string; present: string[]; absent: string[] }` 명명 필드 객체로 바뀌어, 각 필드의 의미(입력 코드 / 있어야 할 문구 / 없어야 할 문구)가 이름만으로 드러난다 — 순서 의존적 튜플 분해(`[code, distinctPhrase]`)보다 가독성이 개선됐다.
- WARNING #2(직전 라운드) 완결: 모듈 최상단 JSDoc이 `src/lib/**` 단독 스코프 서술에서 `LOWER_LAYERS`(`src/lib/**`·`src/types/**`) 포괄 서술로 갱신되고, 두 describe 스위트(내용 검증 vs 스코프 검증)의 관심사 분리도 JSDoc에 명시돼 파일 구조와 문서가 다시 일치한다.
- 네이밍: `DYNAMIC_MARK`/`REQUIRE_MARK`(테스트 쪽 판별 마커)가 프로덕션 상수(`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`)와 값은 겹치지만 접미사(`_MARK` vs `_MSG`)로 역할이 다름을 구분해, 기존 파일의 "프로덕션 상수를 그대로 재사용하지 않고 목적에 맞는 자기 이름을 부여" 하는 관례와 일관된다.
- 함수 길이·중첩 깊이: 변경분은 기존 `describe`/`it` 하나의 본문을 확장한 수준이며(약 12줄 → 22줄), 새로 추가된 반복은 `for...of` 2개(둘 다 단일 `expect` 호출)로 얕다. 새로운 깊은 중첩이나 장문 함수는 도입되지 않았다.
- 매직 넘버/문자열: `DYNAMIC_MARK`/`REQUIRE_MARK` 리터럴은 config 의 실제 문구(`동적 import() 로도`/`require() 로도`)를 의도적으로 하드코딩한 것으로, 파일 전반의 "config 파생값과 독립 하드코딩 기대값을 대조해 drift 를 잡는다"는 기존 설계 원칙(예: `EXPECTED_LOWER_LAYERS`)과 일관된 트레이드오프다.
- 일관성: 기존 파일의 "한국어 설명 주석 + 영어 식별자" 컨벤션, `it.each`/`describe.each` 데이터 기반 테스트 관용구를 그대로 따른다.

## 요약

이번 diff는 테스트 파일 1개에 국한된 리뷰-fix 종결 커밋으로, 직전 라운드 WARNING 2건(메시지 상호 배타성 미검증, JSDoc staleness)을 정확한 근거로 해소했다. 직접 mutation 재현으로 회귀 탐지력이 실제로 개선됐음을 확인했고, 타입을 위치 기반 튜플에서 명명 필드 객체로 바꾼 것은 가독성 측면의 순개선이다. 새로 추가된 코드는 기존 관용구를 따르는 짧고 단일 책임 구조라 복잡도·중첩 문제가 없다. 남은 항목(rule-id predicate 중복)은 이번 diff의 범위 밖 기존 코드이고 이미 INFO로 기존 처분된 사항이라 회귀가 아니다. 나머지 20개 변경 파일은 리뷰/일관성 검토 산출물(기록물)이라 코드 유지보수성 평가 대상이 아니다. CRITICAL/WARNING 급 발견 없음.

## 위험도
LOW
