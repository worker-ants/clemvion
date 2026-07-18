# Requirement Review — review/code/2026/07/18/01_00_03

## 대상

이번 라운드의 실질 코드 변경은 `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` 1개
파일이며 (커밋 `9b42bdf31`), 나머지 파일들(2~13)은 직전 종결 리뷰 라운드
`review/code/2026/07/18/00_33_58/**` 의 산출물(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·
개별 reviewer 리포트·`meta.json`)이 같은 커밋에 함께 기록된 것, 그리고 파일 14 는
`spec/conventions/frontend-layering.md` §4.1 갱신이다. 목적은 `b2bc51d5e`(직전 fix)를
재리뷰한 00_33_58 라운드가 찾은 WARNING#1(static 진입점 메시지 뒤바뀜 미탐지)·WARNING#2(모듈
JSDoc staleness)를 해소하는 fix 커밋이 실제로 그 갭을 닫았는지 검증하는 것.

## 검증 방법

주장(RESOLUTION.md "재검증: 상수 뒤바꿈 4종 전부 1건 실패로 탐지")을 신뢰하지 않고 직접
실측했다.

1. `npx vitest run eslint-layering-guard.test.ts` — 51/51 통과 (baseline).
2. `codebase/frontend/eslint.config.mjs` 를 임시로 mutate 후 재실행, 원복:
   - `STATIC_IMPORT_MSG` ↔ `DYNAMIC_IMPORT_MSG` 텍스트 교환 → **1건 실패로 탐지** (이전 라운드가
     "51/51 통과, 미탐지" 로 실측 보고했던 바로 그 조합).
   - `REQUIRE_MSG` 를 `STATIC_IMPORT_MSG` 와 동일한 텍스트로 단방향 치환(require 쪽만 고유 문구
     소실) → **1건 실패로 탐지**.
   - `DYNAMIC_IMPORT_MSG` ↔ `REQUIRE_MSG` 텍스트 교환 → **1건 실패로 탐지**.
   - 매 mutation 후 `eslint.config.mjs` 를 백업본으로 원복하고 `git status --porcelain` 로
     dangling diff 없음을 확인, 51/51 통과로 baseline 복귀 확인.

세 조합 모두 회귀를 정확히 잡아 RESOLUTION.md/SUMMARY.md 의 "FIXED" 주장이 실측과 일치함을
확인했다.

## 발견사항

- **[INFO]** `present`/`absent` 배열 기반 negative 단언은 `DYNAMIC_MARK`("동적 import() 로도")·
  `REQUIRE_MARK`("require() 로도") 라는 하드코딩 한국어 부분 문자열에 결합돼 있다. 두 마크
  문자열이 `LAYERS_LABEL`/`RESOLUTION_HINT`(공통 접미부)에는 등장하지 않아 현재는 오탐 없이
  동작함을 실측으로 확인했지만, 향후 정당한 문구 리팩터(예: "동적 import 로도" 로 괄호 제거)가
  있으면 이 테스트가 무관하게 깨진다 — 기존에도 있던 "메시지 문자열에 커플링된 회귀 테스트"
  패턴의 연장이라 새로운 결함은 아니다.
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:130-131`
  - 제안: 조치 불필요. 문구가 실제로 바뀌면 테스트가 실패해 리뷰어가 갱신을 강제받는 것 자체가
    설계 의도(회귀 고정)이므로 이 결합은 트레이드오프이지 결함이 아니다.
- **[INFO]** spec fidelity — `spec/conventions/frontend-layering.md` §4.1 은 이번 커밋에서
  "메시지 콘텐츠" 항목을 추가해 테스트가 실제로 검증하는 내용(공통 부분문자열 문제 + negative
  단언)과 line-level 로 일치한다. §1 계층 표(`src/app` → `src/components` → `src/lib` →
  `src/types`)·§4 CI 강제 표(no-restricted-imports/no-restricted-syntax 커버 범위)도
  `eslint.config.mjs` 실제 구현(`LOWER_LAYERS`, 4개 selector, 3개 message 상수)과 일치함을
  코드 대조로 확인했다. 불일치 없음.
- **[INFO]** 이전 라운드(00_33_58) 가 지적한 WARNING#2(모듈 JSDoc staleness — `src/lib/**` 단독
  스코프 기술)는 이번 diff 에서 JSDoc 전문이 `LOWER_LAYERS`(`src/lib/**`·`src/types/**`) 포괄
  기술 + 규약 SoT 링크 + 두 describe 스위트의 관심사 분리(내용 vs 스코프) 설명으로 갱신됐다.
  파일 전체를 재독해 잔여 단일-스코프 문구가 없음을 확인.
- TODO/FIXME/HACK/XXX 주석: 대상 파일들에서 검색 결과 없음(`grep` 실측).

## CRITICAL 발견사항

없음.

## 요약

이번 라운드에서 리뷰 대상인 실질 코드 변경(`eslint-layering-guard.test.ts`)은 직전 종결 리뷰가
찾은 WARNING#1(static 진입점 메시지 뒤바뀜 탐지 실패)을 `{present, absent}` 구조 도입으로
정확히 해소했다 — `STATIC↔DYNAMIC`·`DYNAMIC↔REQUIRE`·단방향 REQUIRE 텍스트 소실 3가지 mutation
을 직접 재현해 전부 탐지됨을 실측 확인했으며(이전엔 미탐지였던 조합 포함), 원복 후 baseline
51/51 통과도 재확인했다. WARNING#2(모듈 JSDoc staleness)도 실제로 갱신돼 있다. spec
(`spec/conventions/frontend-layering.md`) §1·§4·§4.1 은 코드 구현과 line-level 로 일치하며
§4.1 에 이번에 추가된 보장 항목("메시지 콘텐츠")도 정확히 반영돼 있다. CRITICAL 급 발견 없음,
남은 것은 기존에 인지된 트레이드오프(문구 하드코딩 결합) 재확인 수준의 INFO 뿐이다.

## 위험도

NONE
