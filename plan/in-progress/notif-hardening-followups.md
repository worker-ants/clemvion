---
worktree: hopeful-wozniak-a22f76
started: 2026-07-06
owner: developer
---

# 알림 파이프라인 후속 하드닝 3건

> 출처: 알림 파이프라인 PR1~3 (#836/#837/#838) 후속. 관련 spec: spec/data-flow/8-notifications.md,
> spec/2-navigation/_layout.md §3.1 (딥링크 계약), spec/1-data-model.md §2.19.
> PR3 tracker [[spec-sync-data-flow-8-notifications-gaps]] 가 `background_failed` resource_id 미스매치를
> "선존 결함 — 범위 밖" 으로 남긴 것을 본 작업이 처리.

## 항목 1 — background_failed 딥링크 resource_id 미스매치 (선존 결함)

### 설계 (option a — 별도 필드)
- **문제**: `background-execution.processor.ts` 가 `resource_id=backgroundRunId ?? executionId` 로 채우나,
  `href.ts` 는 `background_failed` 를 `/workflows/<resource_id>` 로 라우팅(§3.1: resource_id=workflow id 기대)
  → 클릭 시 404. 동시에 `background-runs.service.findByResource('background_run', backgroundRunId)` 가
  같은 resource_id 를 per-run attribution 에 소비 → 단순 교체 불가.
- **결정**: 딥링크 요구(workflow id)와 attribution 요구(backgroundRunId) 를 **별도 컬럼으로 분리**.
  - `notification.resource_type='workflow'` / `resource_id=workflow.id` (딥링크 — §3.1 계약 준수, execution_failed/schedule_failed 와 일관)
  - 신규 nullable 컬럼 `background_run_id UUID` — attribution 전용. `background-runs.service` 가 이 컬럼으로 조회.
  - legacy `execution`/`executionId` fallback 제거 (workflowId 는 항상 존재 → 딥링크 항상 정상).
- **option b 기각**: background run 은 `(executionId, backgroundRunId)` 로만 주소지정 가능 —
  backgroundRunId 단독 라우트 부재, href.ts 는 resource_id 만 보유 → workflow URL 생성 불가 + §3.1 변경 필요. 더 무거움.

### 작업 체크리스트
- [x] impl-prep consistency-check (data-flow/8-notifications) — BLOCK: NO (`review/consistency/2026/07/06/20_58_46/SUMMARY.md`). convention_compliance 재실행 CRITICAL 은 재실행 타이밍 false-positive(원 게이트는 코드 이전 통과), rationale/DTO WARNING 은 처리.
- [x] 마이그레이션 V107 — `notification.background_run_id UUID NULL` + 부분 인덱스
- [x] `notification.entity.ts`(컬럼) + `notification-response.dto.ts`(resourceType/type 문서 정확성)
- [x] `NotificationsService.findByBackgroundRun` (구 findByResource 대체) + notify/createMany 에 backgroundRunId 통과
- [x] `background-execution.processor.ts` — resource_type='workflow'/resource_id=workflowId + backgroundRunId 세팅
- [x] `background-runs.service.ts` — findByBackgroundRun 사용 + module 주석
- [x] unit 갱신: processor.spec / background-runs.service.spec
- [x] `background-monitoring.e2e-spec.ts` — assertion 갱신 (workflow/workflowId + background_run_id) [작성; TEST WORKFLOW 에서 검증]
- [x] spec-update draft `spec-update-notifications-background-run-id.md` (§2.1/§2.19/§1.1/Rationale + 12-background §8.2) → planner 위임

## 항목 2 — execution_failed 통합 e2e

- [x] impl-prep (동일 area, 항목1과 공유)
- [x] 신규 e2e `execution-failed-notification.e2e-spec.ts` 작성 [TEST WORKFLOW 에서 검증]:
  - Test1: top-level 실행 실패(manual_trigger→code syntax error) → `execution_failed` **정확히 1건**
    (owner==executor dedup), resource_type='workflow'/resource_id=workflowId, channel='both', resource_id≠executionId.
  - Test2: Background 본문 실패(메인 격리 완료) → `background_failed` 만 발사, 같은 workflow 의 `execution_failed` **0건**.
  - 현재 unit(execution-engine.service.spec.ts:620-751) 화이트박스만 존재하던 것을 실 BullMQ+PG 인프라로 승격.

## 항목 3 — dispatchEmails await 인라인 decouple 검토 (분석 완료 — 결정 대기)

- [x] 분석:
  - `notify()`(notifications.service.ts:290)/`createMany`(:331) 는 `dispatchEmails` 를 **await 인라인** 한다.
  - **premise 정정**: 호출자가 "전부 백그라운드" 는 아니다 — `team_invite` 는 `workspace-invitations.service.invite()`
    (동기 초대 API 핸들러)에서 `notify()` 를 await 한다. 즉 이미 동기 API 경로가 존재한다.
  - **완화 요인**: invite 엔드포인트는 초대링크 이메일(`dispatchEmail`)도 이미 동기 SMTP 로 보내므로, 알림 이메일
    dispatch 는 *기존 SMTP 바운드 엔드포인트에 additive* 일 뿐 새 hot-path latency 클래스가 아니다.
  - **decouple 비용**: `dispatchEmails` 를 fire-and-forget 로 바꾸면 (a) 모든 호출자의 계약이 async 로 변함,
    (b) PR2 unit(notifications.service.spec.ts:491-561)이 `await notify()` 직후 `sendNotificationEmail`/`email_sent_at`
    를 동기 단언 → race 로 깨짐(재작성 필요). dispatchEmails 자체는 이미 완전 best-effort 라 correctness 리스크는 없음.
- [ ] **결정 (사용자 판단 대기)**: (a) 현행 유지(보류) — 코드 변경 없음, invite 는 이미 SMTP 바운드라 수용;
      (b) 지금 decouple — notify/createMany 의 email dispatch 를 fire-and-forget + PR2 테스트 재작성.
      권장: **(a) 보류** + 정정된 근거를 spec Rationale 로 문서화(planner). 신규 *non-SMTP* 동기 API 경로 등장 시 (b) 재개.

## 게이트 정책
- 3 항목 모두 spec/data-flow/8-notifications 동일 area → impl-prep 1회(area) + 구현 후 통합 ai-review + impl-done 1회.
  (항목 3 은 코드 변경 없음 → 별도 review 불요, spec-update 로 흡수.)
