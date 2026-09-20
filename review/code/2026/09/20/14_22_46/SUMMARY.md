# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 프로덕션 코드 변경 없이 cron/timezone 재계산 happy-path 를 고정하는 단위 테스트 2건이 추가됐으나, 같은 재계산 게이트의 **반대 방향(가드가 사라져도 무조건 재계산되는 회귀)** 을 잡는 대조군 테스트가 없다는 실측 갭이 requirement·testing 두 reviewer 에서 독립적으로 확인됐다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과가 확보되어 강제 목록 미이행은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/requirement | 재계산 게이트 `dto.cronExpression \|\| dto.timezone` 를 **통째로 무력화(if (true))** 하는 뮤턴트가 unit·e2e 어디서도 검출되지 않는다 — 실측: 조건을 `if (true)` 로 바꿔도 `schedules.service.spec.ts` 29건 전부 GREEN(신규 2건 포함). `name`/`isActive` 만 바꾸는 기존 PATCH 테스트는 `computeNextRuns` 를 스파이하지도, `nextRunAt` 을 단언하지도 않아 이 방향을 못 잡는다 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:440`, `:475` (신규 테스트) / `codebase/backend/src/modules/schedules/schedules.service.ts` `update()` 의 `if (dto.cronExpression \|\| dto.timezone)` 분기(약 266행) | `scheduleRow()` 를 재사용해 "cron·timezone 을 건드리지 않는 PATCH(`{ name: 'x' }` 등)는 `computeNextRuns` 를 호출하지 않고 `nextRunAt` 이 갱신 전 값과 동일하게 유지된다"를 단언하는 대조군 테스트 1건 추가. 이 plan 이 채택한 "`\|\|` 의 각 항이 표면" 원칙을 완결하려면 "둘 다 거짓" 인 세 번째 분기도 표면화해야 함 |
| 2 | maintainability | 신설한 `scheduleRow()` 팩토리를 바로 위 기존 테스트(`[방어 분기] 다음 실행 계산이 비면...`)에는 적용하지 않아 동일한 7개 필드 리터럴이 몇 줄 간격으로 중복 공존 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:386-394`(기존 인라인) / `:427-438`(신설 팩토리) | 기존 테스트의 인라인 리터럴도 `scheduleRow()` 호출로 교체해 단일 정의로 통합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 하드코딩 시크릿/자격증명 없음(전부 mock/fixture 값), 재계산 분기에 인가 우회 경로 없음, consistency 산출물에 민감정보 없음(로컬 절대경로만) | `schedules.service.spec.ts` 전반, `review/consistency/2026/09/20/14_01_01/*` | 조치 불필요 |
| 2 | requirement/scope | 리뷰 도중 `schedules.service.ts` 의 재계산 조건이 순간적으로 `if (true)` 로 뮤테이션됐다가 자체 원복된 상태를 두 reviewer 가 독립 관측 — 이 changeset(diff 10파일, 전부 추가)에는 포함되지 않으며, 관측 시점 저장소는 이미 clean. 병렬 세션(뮤턴트 판별력 검증)의 잔상으로 추정 | `codebase/backend/src/modules/schedules/schedules.service.ts:266` | 조치 불요(자체 원복 완료, 이번 diff 밖). 투명성 기록 목적 |
| 3 | requirement | spec fidelity 확인 완료 — `spec/2-navigation/2-trigger-list.md §2.3.1`, `spec/data-flow/10-triggers.md §1.4/§3.2`, DTO 필드 설명과 신규 테스트가 line-level 로 일치 | `plan/in-progress/sched-recalc-unit.md`, `update-schedule.dto.ts` | 조치 불필요 |
| 4 | side_effect | `jest.spyOn` 스파이 2건이 `mockRestore` 없이 남지만, 매 테스트가 `beforeEach` 에서 새 `service` 인스턴스를 받으므로 실질 누수 없음(기존 테스트도 동일 패턴) | `schedules.service.spec.ts:447-452`, `:482-487` | 방어적으로 `afterEach(() => jest.restoreAllMocks())` 고려(강제 아님) |
| 5 | side_effect | 신규 커밋 `review/consistency/**` 산출물에 로컬 워크트리 절대경로가 영구 박제 — 프로젝트 기존 관례와 일치, 실행 동작 영향 없음 | `review/consistency/2026/09/20/14_01_01/_retry_state.json`, `meta.json` | 조치 불요 |
| 6 | maintainability | `computeNextRuns` spy 캐스트가 파일 내 3곳(기존1+신규2)으로 중복되고, nullary 타입 주석이 실제 3-인자 시그니처(`cronExpression, timezone, count`)와 불일치 | `schedules.service.spec.ts:447-452`, `:482-487`(신규) / `:400-404`(기존) | 공용 헬퍼로 캐스트 추출, 타입을 실제 시그니처에 맞춤 |
| 7 | maintainability | `saved` 캡처 4줄 블록이 파일 내 최소 3회 반복 | `schedules.service.spec.ts:441,443-446` / `:476,478-481`(신규) / `:385,395-398`(기존) | `captureSaved()` 류 공용 헬퍼로 추출 검토(스타일 상충 가능성 있어 강제 아님) |
| 8 | maintainability | 신규 테스트가 이름-내용이 어긋난 거대 `describe` 블록(`create — timezone fallback (§2.2)`, 최상위 `SchedulesService.runNow`)에 개선 없이 편입 | `schedules.service.spec.ts:248-817` | 향후 `update()` 전용 하위 `describe` 분리 고려(이번 diff 차단 사유 아님) |
| 9 | maintainability/documentation | 신규 JSDoc(419-426행)이 바로 아래 `scheduleRow()` 함수가 아니라 그 아래 두 테스트의 설계 근거를 설명해, "무엇을 문서화하는지" 시각적으로 모호 | `schedules.service.spec.ts:419-426` | 배경 설명을 첫 `it(...)` 위로 이동하거나 describe 블록 주석으로 승격 |
| 10 | testing | 신규 테스트가 `computeNextRuns` 호출을 `toHaveBeenCalledWith` 로만 확인, `toHaveBeenCalledTimes(1)` 미포함(호출 지점이 하나뿐이라 위험 낮음) | `schedules.service.spec.ts:440-460`, `:475-495` | 낮은 우선순위, 필수 아님 |
| 11 | documentation | 신규 JSDoc 이 인용한 3개 교차 참조(`plan/complete/schedule-cron-flake.md`, 선행 리뷰 세션 `review/code/2026/09/20/12_45_31/SUMMARY.md`, e2e `schedule-trigger.e2e-spec.ts:301`) 전부 실재 확인, 인자 단언도 실제 구현과 일치 | `schedules.service.spec.ts:420-424` | 조치 불필요 |
| 12 | documentation | `spec_impact: none` 과 실제 diff 일치, README/CHANGELOG/API 문서 갱신 불요; plan 체크리스트 상태(`[x]` 3개)가 실제 git 이력(`75d6b5db3`)과 일치 | `plan/in-progress/sched-recalc-unit.md:51-59` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿/인가 우회/민감정보 노출 없음 |
| requirement | LOW | 재계산 게이트 음의 방향(가드 무력화) 대조군 테스트 부재를 실측(뮤턴트 29/29 GREEN)으로 확인 |
| scope | NONE | 스코프 이탈 없음(10파일 전부 추가, 정확히 plan 대응). 병렬 세션의 일시 뮤테이션 관측(무관, 원복 완료) |
| side_effect | NONE | 프로덕션/전역/네트워크/환경변수 부작용 없음. spy 미복구는 인스턴스 격리로 무해 |
| maintainability | LOW | `scheduleRow()` 미적용 중복 리터럴(WARNING) + spy 캐스트/캡처 패턴 반복(INFO 다수) |
| testing | LOW | 동일한 재계산 게이트 음의 방향 커버리지 갭을 독립 실측으로 재확인. 회귀 없음(49건 전체 통과) |
| documentation | NONE | JSDoc 교차 참조 전부 실재 확인, plan 체크리스트-git 이력 일치, 문서 갱신 불요 |

## 발견 없는 에이전트

없음 — forced 7명 전원이 결과를 반환했고, 각 에이전트가 최소 1건 이상의 INFO/WARNING 을 보고함.

## 권장 조치사항

1. `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 에 "cron·timezone 을 건드리지 않는 PATCH(예: `{ name: 'x' }`, `{ isActive: false }`)는 `computeNextRuns` 를 호출하지 않고 `nextRunAt` 이 갱신 전 값을 유지한다"를 단언하는 대조군 테스트 1건 추가 — 이 작업이 표방한 "재계산 게이트의 각 항이 표면" 원칙을 완결.
2. 기존 "[방어 분기]" 테스트의 인라인 스케줄 리터럴을 신설 `scheduleRow()` 팩토리 호출로 교체해 중복 제거.
3. (낮은 우선순위, 선택) `computeNextRuns` spy 캐스트 타입을 실제 3-인자 시그니처에 맞추고 공용 헬퍼로 추출, `saved` 캡처 패턴 통합, 신규 JSDoc 위치를 테스트 그룹 쪽으로 재배치.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, 실행된 7명과 동일 — forced 전원 결과 확보됨, 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(테스트 전용, DB/네트워크 없음)와 무관 |
  | architecture | 프로덕션 아키텍처 변경 없음 |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음(전부 mock) |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | API 계약 변경 없음(`spec_impact: none`) |
  | user_guide_sync | 사용자 문서 대상 표면 변경 없음 |
