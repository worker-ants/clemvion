# Code Review 통합 보고서

## 전체 위험도
**LOW** — 9개 reviewer(강제 7명 전원 결과 확보 포함) 전원이 Critical/Warning 없이 INFO 등급 관찰만 보고했다. 실질 코드 변경은 e2e 테스트 헬퍼의 순수 함수 추출(동작 보존 리팩터링)로 프로덕션 런타임에 영향이 없으며, 가장 무거운 지적도 "에러 메시지 접두어 소실"·"배선 미검증"·"기존부터 있던 타이머 정리 누락" 수준의 정보성 트레이드오프다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `assertEnoughFiresForOverlap`/`assertGuardBelowKnownTimeouts` 를 순수 함수로 추출한 내용은 self-spec 이 검증하지만, `raceUnderHeldLock` 이 실제로 이 함수들을 **호출한다**는 배선 자체는 어떤 테스트도 행사하지 않는다(호출 줄을 지워도 기존 9파일 e2e 는 통과). plan 문서에 이미 명시된, 기존 `src/shared/testing/` 5쌍 선례와 동일 등급의 갭 | `codebase/backend/test/helpers/concurrency.ts:31,78` | 필요 시 `jest.spyOn` 으로 호출 여부를 검증하는 얇은 통합 테스트 고려(이 PR 단독 스코프는 아님) |
| 2 | side_effect / requirement / maintainability | 검증 로직을 분리 모듈로 옮기며 에러 메시지의 `raceUnderHeldLock:` 접두어가 소리 없이 사라짐. 현재 유일한 호출부라 즉시 영향은 없음(문자열 의존 단언 0건, grep 확인) | `codebase/backend/src/shared/testing/overlap-preconditions.ts:27-30, 54-57` | 현행 유지 무방. 재사용 호출부가 늘면 `raceUnderHeldLock` 쪽에서 catch 후 컨텍스트를 덧붙이는 방안 고려 |
| 3 | architecture | 신규 순수 함수 모듈이 프로덕션 컴파일 루트(`src/`) 안에 위치 — 경계는 폴더 구조가 아니라 `tsconfig.build.json` 의 `exclude` 설정 한 줄에 의존. 새로 도입된 위험은 아니며 기존 5쌍 선례와 동일 패턴, plan 문서에 대안 검토·기각 근거 있음 | `codebase/backend/src/shared/testing/overlap-preconditions.ts`, `codebase/backend/tsconfig.build.json:20` | harness 가드가 `src/shared/testing/**` 세그먼트를 계속 고정 검증하는지 향후 tsconfig 리팩터 시 재확인 |
| 4 | concurrency | `Promise.race` 패자(loser) 쪽 `setTimeout` 이 승자 확정 후에도 `clearTimeout` 되지 않아 `VACUITY_GUARD_MS` 동안 잔존. 이번 diff 의 unchanged 영역이며 기능적 결함 아님 | `codebase/backend/test/helpers/concurrency.ts:91-97` (unchanged) | 필요 시 후속으로 타이머 핸들 저장 후 정리 또는 `AbortController` 도입 — 이번 PR 차단 사유 아님 |
| 5 | scope | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 작업과 무관한 백로그 항목(spec Overview 헤딩 편차) 등재. 코드 수정 없이 planner 인계용 기록이며 plan 본문이 "이 PR 의 수렴 조건 아님"을 명시 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1921` | 조치 불요 — 스코프 위반 아님 |
| 6 | scope | `review/consistency/2026/09/21/{22_25_20,22_39_59}/**` 산출물 16개 파일이 diff 에 포함되어 핵심 코드 변경(4파일) 대비 diff 크기가 큼. CLAUDE.md 가 요구하는 워크플로 산출물(`--impl-prep` 의무)이라 스코프 위반 아님 | `review/consistency/2026/09/21/**` | 조치 불요 |
| 7 | documentation | CHANGELOG.md 미변경 — 이 저장소는 프로덕션 동작 변경 없는 test-harness-only 커밋에 CHANGELOG 를 남기지 않는 선례(직전 관련 커밋 2건도 동일)와 일치 | `CHANGELOG.md` (변경 없음) | 조치 불요 |
| 8 | maintainability | `concurrency.ts` 최상위 `assertGuardBelowKnownTimeouts(...)` 호출은 import-time 부수효과로 리팩터 전부터 존재하던 결합이 그대로 유지됨(신규 도입 아님, plan 문서가 트레이드오프로 명시 수용) | `codebase/backend/test/helpers/concurrency.ts:31` | 조치 불요 |
| 9 | security / requirement | SQL 파라미터 바인딩 준수, 하드코딩 시크릿 없음, 인증/인가·의존성 변경 없음, 신규 모듈은 `tsconfig.build.json` exclude 로 프로덕션 표면 미노출 — 전부 확인됨 | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 파라미터 바인딩, 시크릿 없음, 프로덕션 표면 미노출 — 문제 없음 |
| architecture | NONE | 순수 함수 추출로 SRP 개선, 경계는 tsconfig exclude 의존(기존 선례와 동일) |
| requirement | NONE | 동작 보존 실측 확인(11 tests, 뮤턴트 재현), 에러 메시지 접두어 소실은 INFO |
| scope | NONE | 핵심 4파일은 요청 범위와 정확히 일치, 나머지는 워크플로 강제 산출물 |
| side_effect | LOW | 에러 메시지 접두어 소실 외 부작용 없음, import-time 부수효과 불변 |
| maintainability | NONE | 순수 함수 추출·JSDoc 단일화로 개선, 매직넘버/중복 없음 |
| testing | LOW | 11개 테스트 실측 PASS, 다만 concurrency.ts→함수 호출 배선 자체는 미검증(기존 선례와 동급 갭) |
| documentation | NONE | JSDoc·PROJECT.md 정합 실측 확인, CHANGELOG 미변경도 선례와 일치 |
| concurrency | LOW | 락 오케스트레이션 로직 무변경 확인, 기존부터 있던 타이머 정리 누락 관측(diff 밖) |

## 발견 없는 에이전트

없음 — 모든 에이전트가 최소 1건 이상의 INFO 관찰을 보고했으나, Critical/Warning 은 9개 에이전트 전원 0건이다.

## 권장 조치사항

1. (선택, 비필수) `raceUnderHeldLock` → `assertEnoughFiresForOverlap`/`assertGuardBelowKnownTimeouts` 호출 배선을 검증하는 얇은 스파이 테스트를 향후 `src/shared/testing/` 6번째 쌍과 함께 구조적으로 고려한다.
2. (선택, 비필수) 에러 메시지에서 사라진 `raceUnderHeldLock:` 접두어는 이 헬퍼가 다른 호출부에서 재사용되기 시작하면 진단성 저하를 낳을 수 있으니, 그 시점에 컨텍스트 재도입을 검토한다.
3. 위 두 항목 모두 이번 PR 을 막을 사유가 아니며, 현재 상태로 병합 가능하다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 함수 추출, 프로덕션 런타임 무영향)와 관련성 낮음 |
  | dependency | 의존성 변경 없음 |
  | database | DB 접근 로직(`raceUnderHeldLock` 본체) 변경 없음, 리팩터 대상은 순수 검증 로직뿐 |
  | api_contract | API 표면 변경 없음 |
  | user_guide_sync | 사용자 대상 문서/가이드 영향 없음 (테스트 하네스 전용 변경) |
