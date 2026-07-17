# Code Review 통합 보고서

## 전체 위험도

**LOW** — Critical 없음. 리뷰 시점 WARNING 2건(모두 testing-reviewer, 레이어 가드의 백틱 리터럴 우회·테스트 harness 파서 미배선)은 이후 커밋 `161699c7a`로 전부 조치 완료(main 실측 재확인: `npx eslint --stdin` 백틱 import()/require() 모두 차단, 인터폴레이션·근접오탐은 미매칭 유지). 잔존 항목은 전부 저우선순위 INFO(문서 주석 정밀도, ESLint API 제약상 구조적으로 불가피한 glob/regex 이중 표현)뿐이다.

## Critical 발견사항

없음 — 7개 reviewer 전원 Critical 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | **[수정됨 · 161699c7a]** 백틱(템플릿 리터럴) 인자의 동적 `import()`/`require()`가 레이어 가드를 완전히 우회. `esquery`의 `source.value`/`arguments.0.value` 매칭은 `Literal` 노드에만 성립하고 `TemplateLiteral`(백틱)에는 `.value`가 없어 조용히 빗나감. `` import(`@/components/foo`) `` 가 어떤 규칙에도 걸리지 않고 통과함을 실측 확인(`npx eslint --stdin` → exit 0). PR #967(`e370d1d02`)에서 가드 도입 시점부터 존재하던 pre-existing 구멍이며 이 브랜치가 만든 회귀 아님(main이 `git show`로 확인) | `codebase/frontend/eslint.config.mjs` (당시 `ImportExpression[source.value=...]` selector) | **조치 완료** — selector를 `literalSpecifier`(문자열 리터럴) + `backtickSpecifier`(`quasis.0.value.raw` 기반, `expressions.length=0`으로 인터폴레이션 제외) 양쪽으로 확장, `import()`/`require()` 백틱 fixture 5종 추가. 재검증: `npx eslint --stdin`으로 백틱 import()/require() 모두 차단 확인, 인터폴레이션 경로와 근접오탐(`components-legacy`)은 의도대로 미매칭 유지 |
| 2 | Testing | **[수정됨 · 161699c7a]** 테스트 harness(`new Linter({configType:"flat"})`)가 `languageOptions.parser`를 지정하지 않아 기본 espree(순수 ECMAScript) 사용 → TypeScript 전용 구문(`import type`)을 파싱조차 못함. 실제 프로덕션 config(`@typescript-eslint/parser` 포함)는 `import type`을 정상 차단하지만(실측: stdin 모드 1 error), 격리 테스트에서는 fatal 파싱 에러가 나고 그 fatal 메시지(ruleId: null)가 `ruleId` 필터에 걸러져 `errors.length === 0`으로 "위반 없음"처럼 위장 — 이 가드의 핵심 동기 시나리오(`rag-types.ts` 류 타입 파일)를 회귀 테스트로 표현할 방법이 없었음 | `eslint-layering-guard.test.ts` (`Linter` 인스턴스 생성부, `languageOptions.parser` 미지정) | **조치 완료** — `@typescript-eslint/parser`를 직접 import 하지 않고(frontend package.json 미선언 전이 의존이라 `node-linker=isolated`에서 phantom dependency로 깨짐, main 실측: frontend/node_modules 부재·리포지토리 루트로 leak) config 배열에서 파서 인스턴스를 추출해 배선(프로덕션과 동일 인스턴스, 버전 스큐 없음). `import type` positive fixture 2종 추가. 추가로 fatal 파싱 에러를 `ruleId` 필터 통과 전에 fail-loud `throw`로 전환해 "위반 0건 위장" 경로 자체를 차단 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | **[수정됨 · 161699c7a]** `export ... from` (re-export) 형태가 실제로는 정상 차단되지만 회귀 fixture가 없어 향후 규칙 옵션 변경 시 조용히 회귀 가능 | `eslint-layering-guard.test.ts` positive fixture 목록 | **조치 완료** — `export { Foo } from "@/components/foo"`, `export * from "@/components/foo"` fixture 2종 추가 |
| 2 | Testing / Requirement / Documentation (3개 reviewer 중복 지적) | **[수정됨 · 161699c7a]** `ruleSeverity()`가 배열 래핑만 해제할 뿐 값 자체(`"error"` vs `2`)는 정규화하지 않는데 주석은 "문자열/숫자 어느 표기든 정규화"라고 실제보다 넓게 서술 — 향후 `"error"`→`2` 동등 표기 리팩터 시 `toBe("error")` assertion이 false-fail 가능(fail-safe 방향이라 위험은 낮았음) | `eslint-layering-guard.test.ts` (`ruleSeverity()` 헬퍼 및 인접 주석) | **조치 완료** — `SEVERITY_BY_NAME` 맵(`{off:0, warn:1, error:2}`)으로 실제 숫자 정규화 구현, assertion을 `toBe(2)`로 전환, 주석을 실제 동작과 일치시킴 |
| 3 | Documentation | bare 케이스 주석("이 케이스가 없으면 config의 bare 엔트리를 제거하는 mutation이 통과해버린다")이 정적 bare(2건, `no-restricted-imports` glob 방어)와 동적/require 백틱 bare(`COMPONENTS_PATH_RE`의 optional 서브패스 그룹 방어)라는 서로 다른 mutation 클래스를 하나로 뭉뚱그림. mutation 로그상 실측 자체는 모순 없으나 주석만 읽으면 단일 원인처럼 오인 가능 | `eslint-layering-guard.test.ts` (bare 케이스 fixture 인접 주석) | 정적 bare / 동적·require bare로 분리 서술 권장. 우선순위 낮음, 미조치 |
| 4 | Maintainability | glob 패턴(`no-restricted-imports`의 `group`)과 정규식 상수(`COMPONENTS_PATH_RE`)가 "components 경로 매칭"이라는 동일 개념을 2가지 문법으로 이중 표현 — ESLint API 제약(minimatch glob vs esquery regex)상 완전한 단일 소스화가 불가능해 구조적으로 불가피한 잔존 리스크 | `codebase/frontend/eslint.config.mjs` (`group` 배열 vs `COMPONENTS_PATH_RE` 정의부) | 파일 상단에 "이 2곳을 함께 갱신하라"는 크로스레퍼런스 주석 1줄 추가 권장. 필수 아님, 미조치 |
| 5 | Maintainability | `errors.every((m) => m.severity === 2)`의 `2`가 이름 없는 리터럴(매직넘버). 다만 바로 위 주석이 의미를 설명하고 있어 실질적 가독성 저해는 낮음 | `eslint-layering-guard.test.ts` severity assertion | 선택사항 — `ESLINT_ERROR_SEVERITY` 같은 이름 있는 상수로 추출. 우선순위 낮음, 미조치 |
| 6 | Requirement / Documentation (중복, 기존 트래킹) | `src/lib → components` 레이어 경계 규약을 다루는 전용 `spec/conventions/*.md` 문서가 여전히 부재 (`spec/conventions/` 전수 grep 0건) | `spec/conventions/` (부재) | 조치 불요 — 선행 리뷰(`17_29_21/SUMMARY.md` WARNING#4, `18_06_36/SUMMARY.md` INFO#8)에서 이미 식별되어 `project-planner` 위임으로 트래킹 중인 기존 갭. 이번 diff의 신규 결함 아니므로 중복 이슈 생성 불필요 |
| 7 | Side Effect | `review/code/2026/07/17/18_06_36/**` 산출물에 세션 당시 워크트리 절대경로가 `_retry_state.json`/`_resolution_state.json`에 그대로 박제되어 커밋됨 — 워크트리가 향후 삭제되면 dangling 참조가 됨(프로젝트에 이미 알려진 기존 패턴, 이번 diff가 새로 만든 문제 아님) | `review/code/2026/07/17/18_06_36/_retry_state.json` 등 | 조치 불요(감사 기록으로서 의미가 큼). 해당 경로를 스크립트가 사후 역참조할 경우 세션 상대경로 기반 해소 권장(기존 프로젝트 관례) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도(리뷰 시점) | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음. 정규식 상수화는 원본과 바이트 단위 동일, ReDoS/인젝션/시크릿 노출 없음 |
| requirement | NONE | 선행 리뷰 WARNING #1~#3 및 자체 리뷰 severity 갭을 모두 정확히 해소 확인. INFO 2건은 조치됨/기존 트래킹으로 처리 |
| scope | NONE | 코드 fix 커밋이 선언된 스코프와 정확히 대응, 무관한 파일 수정 없음. INFO 3건 전부 검증 기록(조치 불요) |
| side_effect | NONE | 전역 변수·시그니처·API·파일시스템·네트워크·이벤트 부작용 없음, 정규식 리팩터 baseline 동일 실측 확인. INFO 5건 대부분 검증 기록 |
| maintainability | LOW | 중복 제거(정규식 상수화)로 개선. 잔존 INFO 2건(구조적 불가피 이중 표현, 매직넘버)은 낮은 우선순위·미조치 |
| testing | MEDIUM(리뷰 시점) → **조치 후 해소** | WARNING 2건(백틱 우회, 파서 미배선)·INFO 2건(re-export 부재, severity 비교 취약) 전부 커밋 `161699c7a`로 조치 완료, 실측 재확인됨 |
| documentation | LOW | 신규·기존 주석 대부분 실제 동작과 정확히 일치. INFO 1건 조치됨(ruleSeverity 주석), INFO 1건 미조치(bare 주석 뭉뚱그림, 낮은 우선순위), 나머지 2건은 관례상 문제 없음/기존 트래킹 |

## 발견 없는 에이전트

- **security** — "발견사항: 없음"으로 명시적 결론.

## 권장 조치사항

1. (완료) testing WARNING #1·#2 및 관련 INFO 2건 — 커밋 `161699c7a`로 조치 완료, 추가 조치 불요.
2. (선택, 낮은 우선순위) documentation INFO #3 — bare 케이스 주석을 정적/동적(백틱) 방어 근거별로 분리 서술.
3. (선택, 낮은 우선순위) maintainability INFO #4·#5 — glob/regex 이중 표현 크로스레퍼런스 주석 추가, severity 매직넘버 `2`를 이름 있는 상수로 추출(둘 다 필수 아님).
4. (기존 트래킹, 이번 diff 범위 아님) `src/lib → components` 레이어 경계 규약 전용 `spec/conventions/*.md` 작성 — `project-planner` 위임 유지.

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명) — 전원 `router_safety` 강제 포함
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 상수 추출·테스트 로직 개선은 성능 중립적 |
  | architecture | 모듈 경계 변경 없음, 테스트 정확성 개선만 |
  | dependency | package.json/의존성 변경 없음 |
  | database | DB 마이그레이션·SQL·ORM 변경 없음 |
  | concurrency | async/lock/queue 코드 변경 없음 |
  | api_contract | API route/controller 변경 없음 |
  | user_guide_sync | trigger 디렉토리 매칭 안 됨 |
