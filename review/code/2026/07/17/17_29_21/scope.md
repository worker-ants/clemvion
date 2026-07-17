# 변경 범위(Scope) Review

## 대상
commit `e0e2123d4` — `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (2 files, +135/-0)

## 사전 검증 (git 실측)

- `git show --stat e0e2123d4`: 변경 파일 정확히 2개, 순수 추가(+135/-0). payload 에 제시된 diff·전체 파일 컨텍스트와 일치 확인.
- 선행 리뷰(`review/code/2026/07/17/16_33_59/`)의 `scope.md` 프롬프트에 담긴 "리뷰 시점 uncommitted diff"(blob `675a05865`, base `de9a2fac2`)와 이번 커밋의 결과 blob(`05e8e141e`)을 `git diff 675a05865 05e8e141e` 로 직접 비교해 "진짜 fix 델타"를 분리 추출했다. 그 델타는 정확히 다음 두 조각뿐이다:
  1. `no-restricted-syntax` 커버리지 한계를 명시하는 배경 주석 4줄 추가
  2. `no-restricted-syntax` 규칙 2개(`ImportExpression` 동적 import·`CallExpression[callee.name='require']` require selector) 추가
- `git log --oneline -- codebase/frontend/eslint.config.mjs`: 이 파일에 레이어 가드 블록을 도입한 커밋은 e0e2123d4 하나뿐 — 즉 16_33_59 시점에 리뷰된 `no-restricted-imports` 전용 버전은 그 시점에 커밋되지 않은 working-tree 상태였고, 이번 커밋이 "이미 scope:NONE 으로 승인된 원본 기능 + 이번 fix" 를 한 번에 처음 커밋한 것이다. `git show` 기준 diff 에는 원본 블록 전체가 `+` 로 표시되지만, 실제 신규 내용은 위 두 조각으로 한정된다 (별도 항목으로 아래 INFO 기재).

## 발견사항

- **[INFO]** 커밋 diff 표면적이 "fix 델타"보다 크게 보임 (git 히스토리 특성, 실질 범위 이탈 아님)
  - 위치: `codebase/frontend/eslint.config.mjs` 전체 `+48` 라인
  - 상세: `git show e0e2123d4` 기준으로는 `src/lib/**` 레이어 가드 블록 전체(원본 `no-restricted-imports` 규칙 포함)가 신규 추가로 보인다. 그러나 이는 원본 기능이 16_33_59 리뷰 시점에 아직 커밋되지 않은 상태였기 때문이며, blob 대 blob 비교(`675a05865` → `05e8e141e`) 결과 원본 `no-restricted-imports` 블록·메시지·패턴은 문자 그대로 동일하고 실질 diff 는 WARNING #1/#2 에 대응하는 두 조각(커버리지 주석 + `no-restricted-syntax` 규칙)뿐이다. 원본 블록은 이미 그 세션에서 `scope: NONE` 으로 승인된 내용이라 재검토 대상이 아니다.
  - 제안: 조치 불필요. 참고로만 남김 — 향후 유사 상황(직전 리뷰가 uncommitted diff 를 대상으로 함)에서 "이 커밋의 git diff = 순수 fix" 로 오해하지 않도록 orchestrator 쪽에서 인지.

- **[INFO]** WARNING #1 은 "규칙 추가" 또는 "주석 명시" 중 하나를 제안했으나 커밋은 둘 다 적용
  - 위치: `codebase/frontend/eslint.config.mjs:18-21` (커버리지 한계 주석), `:26-42` (`no-restricted-syntax` 규칙)
  - 상세: SUMMARY WARNING #1 제안문은 "`no-restricted-syntax` 에 selector 를 추가하거나, 최소한 주석에 한계를 명시할 것" 으로 선택지를 제시했다. 이번 fix 는 두 선택지를 모두 반영했다. 주석은 규칙 자체(정적 리터럴만 매칭, `import(someVar)` 같은 계산된 경로는 여전히 미탐지)의 잔존 한계를 정직하게 문서화하는 내용으로, 별도 기능이 아니라 방금 추가한 규칙의 부속 설명이다.
  - 제안: 범위 이탈 아님 — 동일 fix 의도(코드 + 문서) 내에서 자연스러운 보강. 조치 불필요.

- 그 외 범위 이탈 없음: 커밋 메시지가 명시한 두 WARNING 외 다른 규칙 추가·리팩토링·포맷팅 변경·불필요한 import·무관 파일 수정이 diff 에 없음. 신규 테스트 파일(`src/lib/__tests__/eslint-layering-guard.test.ts`)은 WARNING #2 가 제안한 파일 경로·기법(ESLint `Linter#verify` 로 config 의 실제 rules 객체를 그대로 구동)을 그대로 따랐고, 테스트 케이스(위반 8건 + 무관 5건)는 커밋 메시지 서술과 정확히 일치한다. `eslint`·`vitest` 는 이미 devDependency 로 존재해 `package.json` 등 설정 변경도 없다 (`git show --stat` 로 확인, 2 files changed 외 없음).

## 요약
`e0e2123d4` 는 선행 ai-review(16_33_59) WARNING #1(동적 `import()`/`require()` 우회 커버리지 공백)과 WARNING #2(레이어 가드 회귀 테스트 부재)를 정확히 겨냥한 fix 로, blob 단위 비교로 분리한 실질 델타는 (a) 커버리지 한계 주석, (b) `no-restricted-syntax` 규칙 2개, (c) 제안된 경로·기법을 그대로 따른 신규 테스트 파일 뿐이다. git show 상 diff 표면(원본 블록 전체 포함)이 커 보이는 것은 원본 기능이 리뷰 시점에 아직 커밋되지 않았던 히스토리 특성 때문이며, 그 원본 내용은 이미 승인된 것으로 재검토 불필요하다. 요청받지 않은 리팩토링·기능 확장·무관 파일 수정·포맷팅 혼입·불필요한 import/설정 변경은 발견되지 않았다.

## 위험도
NONE

STATUS: success
