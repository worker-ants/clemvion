# Code Review 통합 보고서

## 전체 위험도

**LOW** — 실제 코드 변경(`codebase/backend/test/schedule-trigger.e2e-spec.ts` 「D. PATCH cron → nextRunAt 재계산」 케이스 1건)에는 Critical/Warning 급 결함이 없다. `codebase/**` 에 영구히 남는 JSDoc 안의 인용 형식 불일치(문서화, WARNING) 1건과, 이미 트래커에 등재된 e2e 판별력 갭(연 1회 ~2분 반대 방향 창, 단위 테스트 부재)이 남아 있어 NONE 이 아닌 LOW 로 수렴한다.

forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원의 결과가 확보되어 반영됐다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `codebase/**` 에 영구히 남는 JSDoc 문단 안에서, 다른 두 인용은 전체 경로(날짜 포함)를 쓰는데 한 곳(`(1라운드·2라운드 리뷰가 두 번 잡았다)`)만 세션을 특정할 수 없는 순번만 남아 있어 `spec/conventions/review-citations.md` §2/§3(전체 경로 인용 요구, `plan/**` 외 예외 없음)를 따르지 않는다. 사실관계 자체는 정확함(`review/code/2026/09/20/11_54_10` W1, `12_17_18` W1 이 실제로 이 겹침을 두 번 잡음) — 문제는 인용 형태다 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:293` | `(1라운드·2라운드 리뷰가 두 번 잡았다)` → `` (`review/code/2026/09/20/11_54_10` W1 · `review/code/2026/09/20/12_17_18` W1 이 두 번 잡았다) `` 로 정정, 같은 문단의 다른 두 인용과 형태 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 (의도적 유예, SPEC-DRIFT 아님) | 반대 방향의 좁은 거짓-통과 창(연 1회, 12/31 23:58:30~01/01 00:00:30 KST 근방)이 의도적으로 미해결 상태로 남아 있다 — 생성 cron(`0 0 1 1 *`)의 자체 다음 실행값이 이 구간에서는 PATCH 후 판정창 안에 우연히 들어가 재계산 누락 회귀를 통과시킬 수 있다. e2e 로는 시각을 고정할 수 없어 구조적으로 못 닫으며, JSDoc·plan·트래커 세 곳에 일관되게 등재돼 있고 3라운드에 걸쳐 이미 반증·처분된 잔여물이다(재-flag 대상 아님) | `codebase/backend/test/schedule-trigger.e2e-spec.ts:296-299`(JSDoc), `plan/in-progress/schedule-cron-flake.md:40-41`, `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4939` | 조치 불요 — 후속 단위 테스트(`computeNextRuns` spy)가 닫는 자리로 이미 트래커에 등재 |
| 2 | 테스트 | `SchedulesService.update()` 의 cron/timezone 변경 → `nextRunAt` 재계산 happy-path 를 고정하는 결정적 **단위** 테스트가 아직 없다 — e2e 케이스 하나에 전적으로 의존 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts`(happy-path `describe` 부재), `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4939` | 조치 불요(이미 트래커 등재, 재등재 금지) |
| 3 | 요구사항 | `spec/2-navigation/3-schedule.md` API 표는 PATCH 의 `isActive` 토글만 특기하고 cron 재계산 자체는 언급하지 않는다 — 재계산 규칙 자체는 `spec/data-flow/10-triggers.md:138,214` 에 이미 정의돼 있어 모순이 아니라 침묵 | `spec/2-navigation/3-schedule.md:140` | 조치 불요 |
| 4 | 스코프 | 이번 diff 44개 파일 중 실제 코드 변경은 1개(2%)뿐이고 나머지 43개(98%)는 plan(2)·리뷰 산출물(41) — 위반은 아니나 `--stat` 파일 수만 보면 범위를 오판하기 쉬움 | `git diff --stat origin/main...HEAD` 전체 | 조치 불요, 향후 리뷰어를 위한 참고 |
| 5 | 부작용 | 신규 plan/리뷰 산출물 다수와 `_retry_state.json` 내 워크트리 절대경로는 CLAUDE.md 가 규정한 정식 저장 위치·기존 orchestrator 관례와 일치 | `plan/in-progress/schedule-cron-flake.md`, `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31}/**`, `review/consistency/2026/09/20/11_21_16/**` | 조치 불요 |
| 6 | 유지보수성 | JSDoc(테스트 파일)과 plan 문서가 같은 설계 근거를 이중으로 서술한다 — 3라운드 중 실제로 한쪽만 갱신돼 drift 가 발생했던 이력이 있는 자리(현재는 양쪽 일치 확인). 다음 후속 수정 시 재발 가능한 구조적 리스크 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:283-300`(JSDoc), `plan/in-progress/schedule-cron-flake.md:25-41` | 급하지 않음 — 다음에 이 로직을 만질 때 JSDoc 을 SoT 로 삼는 방향 고려 |
| 7 | 유지보수성 | 허용 오차 매직 넘버(`30_000`/`90_000`)가 이름 없는 인라인 리터럴 — 파일 내 기존 스타일(예: 112행)과 일치, 새 결함 아님 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:323-324` | 조치 불요, 세 번째 값이 늘면 상수화 고려 |
| 8 | 유지보수성 | 연 1회 cron 리터럴 `'0 0 1 1 *'` 이 D·E 두 케이스에서 중복 — plan 이 명시한 의도적 재사용, 파일 기존 패턴과 일치 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:308,346` | 조치 불요 |
| 9 | 테스트 | D 케이스가 PATCH 로 등록한 매분(`*/1 * * * *`) cron 트리거를 테스트 종료 후 정리(DELETE)하지 않는다 — 파일 내 기존 패턴과 동일, 이번 diff 로 새로 생긴 문제 아님 | `codebase/backend/test/schedule-trigger.e2e-spec.ts`(D 케이스 본문) | 조치 불요 |
| 10 | 문서화 | 신규 트래커 항목(`spec-draft-nullable-notation-followups.md:4933-4939`)이 다른 항목과 달리 실측 설명 전체를 메타데이터 괄호 안에 4줄 넘게 중첩시켜 형식이 다르다 — 내용은 정확 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4939` | 선택적, 급하지 않음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 애플리케이션 코드·인증/인가·의존성 변경 없음 |
| requirement | NONE | INFO 2건 — 잔여 반대방향 창(의도적 유예), spec 침묵(모순 아님). 구현·spec·테스트 line-level 일치 확인 |
| scope | NONE | INFO 1건 — 44개 중 43개가 워크플로 산출물, 위반 아님 |
| side_effect | NONE | INFO 다수 — 신규 산출물·경로 하드코딩 모두 기존 관례, 전역상태/네트워크/인터페이스 부작용 없음 |
| maintainability | NONE | INFO 3건 — JSDoc-plan 이중서술 구조적 리스크, 매직넘버·cron literal 중복은 기존 스타일과 일치 |
| testing | LOW | INFO 3건 — happy-path 단위 테스트 부재(트래커 등재), 잔여 창(구조적으로 e2e 로 못 닫음), cleanup 미실시(기존 패턴) |
| documentation | LOW | WARNING 1건(JSDoc 인용 형식 불일치) + INFO — 3라운드 지적 결함 전량 정정 재확인 |

## 발견 없는 에이전트

- security — Critical/Warning/Info 모두 없음. 인젝션·시크릿·인가·입력검증·암호화·의존성 전 항목 확인, 지적 사항 없음.

## 권장 조치사항

1. `codebase/backend/test/schedule-trigger.e2e-spec.ts:293` 의 인용을 `` (`review/code/2026/09/20/11_54_10` W1 · `review/code/2026/09/20/12_17_18` W1 이 두 번 잡았다) `` 로 정정 — 같은 문단의 다른 인용과 형태 통일(문서화 WARNING).
2. (백로그, 이미 등재됨) `SchedulesService.update()` cron 재계산 happy-path 의 `computeNextRuns` spy 기반 결정적 단위 테스트 추가 — 남은 연 1회 ~2분 반대 방향 거짓-통과 창을 구조적으로 닫는 유일한 경로.
3. (선택, 급하지 않음) 다음에 이 로직을 다시 만질 때 JSDoc/plan 이중 서술 중 JSDoc 을 SoT 로 삼아 drift 재발 가능성을 낮추는 방향 고려.
4. (선택) 신규 트래커 항목의 메타데이터 괄호 중첩 형식을 다른 항목과 통일.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원, 결과 전원 확보 확인)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(prompt 에 개별 사유 미제공) — 이번 diff 가 성능에 영향을 주는 프로덕션 코드 변경을 포함하지 않음(e2e 테스트 단언 재구성뿐) |
  | architecture | router 판단(개별 사유 미제공) — 아키텍처/구조 변경 없음 |
  | dependency | router 판단(개별 사유 미제공) — 의존성 매니페스트/lockfile 변경 없음 |
  | database | router 판단(개별 사유 미제공) — 스키마/쿼리 변경 없음 |
  | concurrency | router 판단(개별 사유 미제공) — 동시성 로직 변경 없음 |
  | api_contract | router 판단(개별 사유 미제공) — API 계약 변경 없음(테스트가 기존 엔드포인트 재사용) |
  | user_guide_sync | router 판단(개별 사유 미제공) — 사용자 가이드 영향 있는 사용자 대면 동작 변경 없음 |
