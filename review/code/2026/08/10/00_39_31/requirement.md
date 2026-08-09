# 요구사항(Requirement) 리뷰 — plan-scan.ts 추출 + fixture 11건

## 검토 방법
- `codebase/frontend/src/lib/docs/__tests__/{plan-scan.ts,plan-scan.test.ts,plan-frontmatter.test.ts,spec-links.ts}` 전체 컨텍스트 정독.
- 커밋 `ebb6f9598` diff(`git show`)로 리팩터 전/후 `collectLivePlanMarkdown`(구 spec-links.ts)·`collectCompletedPlans`(구 plan-frontmatter.test.ts)의 동작을 새 `plan-scan.ts` 구현과 line-level 대조.
- SoT 로 `.claude/docs/plan-lifecycle.md` §4(Frontmatter 스키마 — `status` 종료값·top-level 상대링크 규칙)를 Read, `TERMINAL_STATUSES`·`isLifecyclePlan` 규칙과 대조.
- Gate C 구현 `spec-plan-completion.test.ts`의 `collectCompletePlans`(라인 59-83)와 `plan-scan.ts`의 `isLifecyclePlan`/`walkPlanMarkdown` 예외 규칙(`0-`/`_` 접두·`archive/` 제외)을 대조.
- `pnpm vitest run src/lib/docs/__tests__/` 전체 실행 — 19 test files / 2839 tests 전량 PASS 확인(회귀 없음 실측).

## 발견사항

- **[INFO]** Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 이번 리팩터에 편입되지 않고 여전히 독립 구현으로 남아 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59` (함수 `collectCompletePlans`, 이번 리뷰 대상 파일 아님 — 참조용)
  - 상세: `plan-scan.ts` 모듈 상단 주석(1-18행)은 "`plan/` 트리를 손으로 순회하는 walker 가 저장소에 네 벌 있었고... 여기서 두 수집기를 한 구현(`walkPlanMarkdown`)에서 파생시키고, Gate C(`spec-plan-completion.test.ts`)와 같은 면제 규칙을 쓴다" 라고 정확히 서술한다 — 즉 "Gate C 와 구현을 공유한다"가 아니라 "Gate C 와 같은 규칙값을 쓴다"는 주장이라 문구 자체는 사실과 어긋나지 않는다(실측: 두 구현 모두 `.md` + `!0-` + `!_` + `archive/` 제외로 동일). 다만 이번 PR 의 동기("네 벌이 서로 다른 규칙을 써서 조용히 어긋난다")가 여전히 부분적으로 남아있다 — `plan-scan.ts`(complete 쪽)와 `spec-plan-completion.test.ts` 두 구현이 나란히 존재하므로, 향후 예외 규칙이 바뀌면 다시 두 곳에 각각 반영해야 하는 구조다. 오늘 시점엔 값이 일치하므로 기능 결함은 아니다.
  - 제안: 필수는 아니지만, 후속 정리 시 `spec-plan-completion.test.ts` 도 `plan-scan.ts`의 `walkPlanMarkdown`/`collectCompletePlanMarkdown`을 재사용하도록 통합하면 이 PR 이 밝힌 "네 벌 → 한 구현" 목표가 완전해진다.

- **[INFO]** `findNonTerminalCompletedPlans` 의 `status` 필드가 빈 문자열(`status: ""`)인 경우를 커버하는 fixture 가 없다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:118-122` (`findNonTerminalCompletedPlans`)
  - 상세: `typeof status !== "string"` 만 걸러내므로 빈 문자열은 "선언된 문자열"로 취급돼 `TERMINAL_STATUSES.has("")` 가 false 라 위반으로 보고된다. 로직 자체는 안전한 방향(과소검출이 아니라 과대검출)이라 버그는 아니지만, `plan-scan.test.ts` 의 11개 fixture 케이스 중 이 경계값은 다뤄지지 않는다.
  - 제안: 우선순위 낮음 — 현재 동작이 안전한 방향이므로 즉시 조치 불요.

## Spec Fidelity 대조 결과 (문제 없음, 근거 기록)

- `TERMINAL_STATUSES`(`plan-scan.ts:90-95`) = `{complete, implemented, applied, superseded}` — `.claude/docs/plan-lifecycle.md:80-83` "`plan/complete/**` 에서 허용되는 값은 종료 상태뿐이다 — `complete` · `implemented` · `applied` · `superseded`" 와 값·순서 의미 모두 일치.
- `status` 를 선택 필드로 취급(미선언 시 스킵) — `plan-lifecycle.md:81` "선언 자체가 없는 것은 정상이다(선택 필드)" 와 일치(`plan-scan.ts:119` `if (typeof status !== "string") continue;`).
- `collectLivePlanMarkdown`(top-level, non-recursive, `0-`/`_` 제외) — `plan-lifecycle.md:73` "세 필드는 top-level `plan/in-progress/*.md` 에서 필수... 하위 그룹 폴더의 작업 material 은... 면제" 와 일치. 리팩터 전 `spec-links.ts` 구현과 완전히 동일한 필터링(파일명 조건 동일)임을 diff 로 확인.
- `collectCompletePlanMarkdown`(recursive, `archive/` 제외) — `plan-lifecycle.md §4` 의 `plan/complete/**` 표기 및 §1 "`plan/complete/archive/from-*/`... 신규 생성 금지" 의 archive 특수 취급과 일치.
- `plan-frontmatter.test.ts` 의 두 describe 블록((a) status 모순, (b) 상대링크)의 스코프 분리(§4 두 규칙)와 `TERMINAL_STATUSES`/`findNonTerminalCompletedPlans`/`findBrokenPlanLinks` 참조가 각각 올바른 함수로 연결됨을 import 문(1-11행)과 실제 사용처(163-186행)에서 확인.
- 리팩터 전후 동작 등가성: `spec-links.ts` 의 구 `collectLivePlanMarkdown`(readdirSync 단일 레벨 + `0-`/`_` 필터)과 `plan-frontmatter.test.ts` 의 구 `collectCompletedPlans`(재귀 + `archive` 제외, `0-`/`_` 필터 없음)를 diff 로 대조 — complete 쪽만 `0-`/`_` 예외가 새로 추가됐는데, 이는 Gate C 의 기존 규칙과 맞춘 의도적 변경이고 현재 `plan/complete/**` 트리에 `0-`/`_` 접두 파일이 실존하지 않아(직접 확인: `os.walk` 스캔 결과 0건) 실거동 회귀는 없음.
- 테스트 실행 결과 실측: `pnpm vitest run src/lib/docs/__tests__/` → 19 test files / **2839 tests 전량 PASS**(커밋 메시지 claim 과 일치).

## 요약

`plan-scan.ts` 추출은 3라운드 리뷰가 지적한 "링크 검사만 모듈화되고 status 검사는 인라인으로 남아 negative-path 를 증명 못 한다"는 근본 원인을 해소한다. `TERMINAL_STATUSES`·선택 필드 취급·`0-`/`_`/`archive` 예외 규칙 모두 `.claude/docs/plan-lifecycle.md §4`·Gate C(`spec-plan-completion.test.ts`)와 line-level 로 일치하며, 리팩터 전후 `collectLivePlanMarkdown`/status 판정 로직의 동작 등가성도 diff 로 확인됐다(complete 쪽 `0-`/`_` 예외 신설은 Gate C 정합 목적의 의도적 변경이며 현재 실존 데이터에 영향 없음). `plan-scan.test.ts` 11개 fixture 가 위반 3건을 심고 "정확히 그 3건만" 잡히는지까지 단언해 이전 라운드의 vacuous-pass 문제를 구조적으로 재발 방지한다. 전체 doc-guard 스위트(19 files/2839 tests) 실행으로 회귀 없음을 실측 확인. TODO/FIXME 류 미완성 표식 없음. 발견된 두 건은 모두 INFO 수준(Gate C 워커 잔존 중복, 빈 문자열 status 미커버 — 안전한 방향이라 과소검출 아님)으로 기능 결함이 아니다.

## 위험도
NONE
