---
worktree: (unstarted)
started: 2026-07-06
owner: planner
---

# spec-update — background_failed 딥링크/attribution 분리 (background_run_id 컬럼 신설)

> 출처: 알림 파이프라인 후속 하드닝 항목 1 (`hopeful-wozniak-a22f76`) — `background_failed` 알림의
> 딥링크 resource_id 미스매치(선존 결함) 해소. developer 가 코드+마이그레이션(V107)을 구현했고,
> spec 은 read-only 라 아래 문서 반영을 planner 위임. 근거 tracker: [[notif-hardening-followups]],
> [[spec-sync-data-flow-8-notifications-gaps]] (선존 결함으로 이월했던 항목).
> **착수 전 `/consistency-check --spec` 통과 의무.** 코드가 이미 존재하므로 drift 창 최소화를 위해 즉시 반영.

## 구현된 사실 (코드 기준 — spec 반영 대상)

- 신규 컬럼 `notification.background_run_id UUID NULL` (migration `V107__notification_background_run_id.sql`).
  부분 인덱스 `idx_notification_background_run_id WHERE background_run_id IS NOT NULL`.
- `background_failed` 알림 적재가 **딥링크와 attribution 을 분리**:
  - `resource_type='workflow'` / `resource_id=workflow.id` (딥링크 — `_layout.md §3.1` 계약,
    `execution_failed`/`schedule_failed` 와 일관). 옛 `execution`/`executionId` fallback 제거.
  - `background_run_id` = backgroundRunId (per-run attribution 전용, 옛 NodeExecution 은 NULL).
- `background-runs.service` 는 `NotificationsService.findByBackgroundRun(backgroundRunId)`
  (구 `findByResource('background_run', …)` 대체) 로 조회. `background_run_id` 는 REST 응답
  (`NotificationDto`)에 노출하지 않는 내부 전용 컬럼 — 모니터링 API 는 자체 `BackgroundRunNotificationDto` 로 동봉.

## 적용 상태 (2026-07-06, developer — SPEC-DRIFT reverse-flow)

impl-done consistency 가 BLOCK:YES(naming_collision CRITICAL 2건 = spec 이 폐기 식별자를 SoT 로 서술)를
반환 → drift 를 이번 PR 에서 닫으라는 checker 지시 + [[feedback_plan_must_include_spec_updates]] 에 따라
아래 flip 항목을 developer 가 직접 spec 에 반영(developer SKILL §REVIEW step3 SPEC-DRIFT reverse-flow,
`/consistency-check --spec` 검증). 전부 [x] — 기계적 drift 정합(이미 구현·리뷰된 코드에 spec 텍스트를 맞춤).

## flip / 갱신 대상

- [x] `spec/data-flow/8-notifications.md §2.1` — `notification` 적재 행의 컬럼 목록에 `background_run_id?` 추가.
      "리소스 attribution 조회" 행을 `SELECT WHERE resource_type=? AND resource_id=?`
      → `SELECT WHERE background_run_id=?` (`NotificationsService.findByBackgroundRun`) 로 갱신.
- [x] `spec/data-flow/8-notifications.md §1.1` — `background_failed` 행에 resource_type/resource_id 계약
      명시 (딥링크=workflow, attribution=background_run_id) — `execution_failed`/`schedule_failed` 행과 대칭.
- [x] `spec/data-flow/8-notifications.md §1.1` — `execution_failed` 행의 발사 지점 서술 정정: 현행
      "(runExecution FAILED 분기)" 은 불완전. 일반 실행은 대부분 **재개(rehydration) 세그먼트**로 종결되므로
      `finalizeResumedExecutionOutcome` FAILED 분기에서도 발사한다 (초기 세그먼트 `runExecution` catch 와 동일).
      → "top-level 실행 종결(초기/재개 세그먼트) FAILED 시" 로 일반화. (근인: 재개 경로 dispatch 누락 + @Optional
      undefined 2건이 execution_failed 를 실제로 미발사시키던 선존 버그 — 코드로 해소, [[notif-hardening-followups]].)
- [x] `spec/data-flow/8-notifications.md` Rationale — "딥링크와 attribution 을 별도 컬럼으로 분리한 이유"
      항 추가 (option b [href.ts background_run 라우팅] 기각 근거 포함: backgroundRunId 단독 주소지정 불가).
      **backfill 없음 명시**: V107 이전 적재된 `background_failed` row 는 resource_type='background_run'/
      background_run_id=NULL 상태로 남아 backfill 하지 않는다 — 배포 이전 알림은 background-runs 모니터링
      API(`fetchNotifications`)의 attribution 범위 밖(과거 알림은 이미 소비됐고 소급 표시 가치 낮음, 의도된 trade-off).
- [x] `spec/1-data-model.md §2.19` — Notification 필드 표에 `background_run_id UUID?` 행 추가.
- [x] `spec/4-nodes/1-logic/12-background.md §8.2` — 모니터링 API 응답 `notifications` 필드 설명이
      attribution 을 `background_run_id` 기준으로 서술하도록 갱신 (구 resource_type='background_run' 서술 정정).

## 후속 (impl-done rationale_continuity WARNING, LOW — planner 판단)

- [ ] `spec/5-system/4-execution-engine.md §4.4` (순환 의존 처리) — 현재 "엔진 순환 = `forwardRef`(Nest 권장)" 만
      명문화. 본 작업에서 `ExecutionEngineService ↔ NotificationsService` 순환은 `forwardRef` 대신
      **ModuleRef(strict:false) 런타임 지연 해석**(생성자 `@Optional` 이 인스턴스화 순서로 undefined 로 굳는 함정
      회피)으로 해결했고, 기존 `NotificationsService.getWebsocket()` 도 동일 미문서 선례다. §4.4 에
      "순환 DI 해법 = forwardRef + ModuleRef 지연해석 2종, 각 적용 기준(생성자 주입이 인스턴스화 순서로 실패하는
      @Optional 케이스는 ModuleRef)" 을 정리 → 향후 신규 @Optional 순환 의존이 동일 undefined 함정을 반복하지
      않도록. (planner 판단: §4.4 갱신 또는 conventions 문서 신설.)

## 완료 조건
- 위 5개 갱신 + `/consistency-check --spec` BLOCK:NO. tracker `notif-hardening-followups.md` 항목 1의
  "spec-update draft → planner 위임" 체크박스 `[x]`.
