# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 실질 코드 변경(`schedule-trigger.e2e-spec.ts` 「D. PATCH cron」 케이스, 29줄)은 4라운드에 걸쳐 검증된 e2e 플레이크 수정으로 6개 reviewer 가 전부 NONE 을 냈으나, testing reviewer 가 「연 1회 ~2분 규모의 구조적 false-GREEN 잔여(e2e 로는 닫을 수 없고 별도 단위 테스트 필요, 이미 트래커 등재)」를 근거로 LOW 를 유지해 전체 위험도를 LOW 로 집계한다. forced 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 인라인·디스크 양쪽에서 확보됐고 누락은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / requirement | 반대 방향의 좁은 구조적 false-GREEN 창(연 1회, 12/31 23:58:30~01/01 00:00:30 KST 근방) — 생성 cron(`0 0 1 1 *`)의 다음 실행값이 우연히 판정창(-30s~+90s, 초=0) 안에 들어오면 재계산이 안 일어나도 테스트가 통과한다. e2e 는 서버 실시각을 쓰므로 구조적으로 닫을 수 없음 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:296-299`(JSDoc), `plan/complete/schedule-cron-flake.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4939` | 조치 불요 — 이미 4라운드에 걸쳐 반증·처분되어 트래커에 등재됨. 후속 `computeNextRuns` spy 기반 단위 테스트가 이 잔여를 구조적으로 닫는다 |
| 2 | testing | `SchedulesService.update()` cron 재계산 happy-path 에 결정적 단위 테스트 부재 — `schedules.service.spec.ts:379-403` 은 `computeNextRuns` 를 `[]` 로 반환하는 방어 분기만 고정, 정상 값 경로는 이 e2e 케이스가 유일한 회귀 방어선 | `codebase/backend/test/schedules.service.spec.ts:379-403` | 조치 불요(이번 PR 범위 밖) — #1 과 동일 트래커 항목이 이미 담당 |
| 3 | requirement / documentation | `spec/2-navigation/3-schedule.md` 는 PATCH 의 cron 재계산 자체를 API 표 수준에서 명시하지 않음(재계산 규칙 SoT 는 `data-flow/10-triggers.md` 쪽) | `spec/2-navigation/3-schedule.md:140`, `spec/data-flow/10-triggers.md:138,214` | 조치 불요 — 침묵일 뿐 모순 아님 |
| 4 | maintainability | 시간창 허용 오차(`30_000`/`90_000`)가 이름 없는 인라인 매직넘버 — 다만 근거 주석 동반, 파일 기존 컨벤션(인라인 리터럴+근거 주석)과 일치 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:94-95` | 조치 불요. 같은 성격 허용창이 3번째 등장하면 상수화 고려 |
| 5 | maintainability | cron 리터럴 `'0 0 1 1 *'` 이 D·E 두 케이스에서 중복 — 각 `it()` 이 값을 스스로 인라인으로 드는 파일 기존 패턴, plan 문서도 의도된 재사용임을 명시 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:79`(D), `:117`(E) | 조치 불요. 3번째 사용처가 생기면 헬퍼/상수 추출 고려 |
| 6 | documentation | JSDoc(테스트 파일)과 plan 문서가 같은 설계 근거를 이중 서술 — 3라운드에 한쪽만 갱신되는 drift 가 실제로 있었던 자리, 지금은 양쪽 일치 확인 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:283-299`, `plan/complete/schedule-cron-flake.md` | 조치 불요. 후속 단위 테스트 작업 시 JSDoc 을 SoT 로 삼는 방향 고려 |
| 7 | documentation | 트래커 신규 항목의 attribution 괄호가 3줄에 걸쳐 중첩(짝은 맞음, 가독성 저하) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4939` | 조치 불요 — 4라운드에서 이미 INFO 로 등재·유예됨 |
| 8 | side_effect | plan 완료 이동 + 4라운드 review/consistency 산출물 다수 신규 생성 | `plan/complete/schedule-cron-flake.md`, `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}/**`, `review/consistency/2026/09/20/{11_21_16,13_34_15}/**` | 조치 불요 — CLAUDE.md 저장 위치 규약에 정확히 부합하는 정식 산출물 |
| 9 | side_effect | `_retry_state.json`/`meta.json` 에 워크트리 절대경로 하드코딩 | `review/code/**/_retry_state.json`, `review/consistency/**/_retry_state.json` | 조치 불요 — orchestrator 표준 포맷, 기존 관례와 동일 |
| 10 | testing | D 케이스가 등록한 매분(`*/1 * * * *`) 트리거를 테스트 종료 후 정리(DELETE)하지 않음 — 같은 파일 기존 패턴 | `codebase/backend/test/schedule-trigger.e2e-spec.ts`(D 케이스) | 조치 불요 — 1~4라운드 모두 스코프 밖으로 처분 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드·인증/인가·시크릿·암호화 경로 미변경, 지적 사항 없음 |
| requirement | NONE | 재계산 로직이 `SchedulesService.update()`/`computeNextRuns`·spec 과 line-level 일치, 인용 오류 정정 확인. 잔여 false-GREEN 창은 등재 확인(INFO) |
| scope | NONE | 실질 코드 변경은 e2e 테스트 1파일 29줄로 국한, 나머지 62개 파일은 규약상 표준 리뷰/plan 산출물 |
| side_effect | NONE | 전역 상태·네트워크·환경변수·파일시스템 영향 없음, 신규 파일은 전부 표준 산출물(INFO) |
| maintainability | NONE | 매직넘버·cron 리터럴 중복은 파일 기존 컨벤션과 일치(INFO), 신규 구조적 결함 없음 |
| testing | LOW | 코드 결함은 없으나 연 1회 ~2분 규모의 구조적 false-GREEN 잔여가 여전히 실재(e2e 로 못 닫음, 단위 테스트 필요) |
| documentation | NONE | 이전 라운드 인용 오류·서술 모순 전부 정정 확인, 남은 것은 이미 처분된 INFO 2건 |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 1건 이상의 INFO 를 보고했으나, Critical/Warning 은 전원 0건이다.

## 권장 조치사항

1. (트래커 등재됨, 이번 PR 범위 밖) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 「cron 재계산 happy-path 결정적 단위 테스트」 항목을 후속 작업으로 착수해 `computeNextRuns` spy 기반 단위 테스트를 추가한다 — 이 e2e 케이스가 구조적으로 못 닫는 연 1회 ~2분 false-GREEN 창을 닫는 유일한 경로다.
2. 위 단위 테스트 구현 시 JSDoc(`schedule-trigger.e2e-spec.ts:283-299`)을 설계 근거의 SoT 로 삼고, 새 테스트 설명이 JSDoc 을 참조하는 방향으로 작성해 이중 서술 drift 재발을 막는다.
3. 매직넘버(`30_000`/`90_000`)·cron 리터럴(`'0 0 1 1 *'`) 중복은 3번째 사용처가 생기는 시점에 상수/헬퍼 추출을 고려한다(현재는 조치 불요).
4. 그 외 Critical/Warning 없음 — 추가 코드 조치 불요, 현재 머지 완료 상태 유지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원 — forced 전원 결과 확보됨, 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | diff 가 e2e 판정 로직 교체(29줄)에 국한, 성능 영향 표면 없음 |
  | architecture | 서비스/모듈 구조 변경 없음 |
  | dependency | 신규·변경 의존성 없음 |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음(서비스 코드 미변경) |
  | api_contract | API 엔드포인트·페이로드·계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 대상 UI/사용자 흐름 변경 없음 |
