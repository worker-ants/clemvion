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

## 항목 2 — execution_failed 통합 e2e (+ e2e 가 적발한 선존 PR3 버그 2건 수정)

> **핵심 성과**: 신규 e2e 가 `execution_failed` 가 **실제로는 전혀 발사되지 않던** 선존 결함 2건을 적발.
> unit 화이트박스(mock)만 있어 그동안 은폐돼 있었다. 실 인프라 e2e 로 격리 후 근인 진단(격리 docker
> 컨테이너 backend 로그 계측)·수정.
>
> **버그 A — 재개 세그먼트 실패 경로 dispatch 누락**: 일반 실행은 대부분 rehydration(재개) 세그먼트로
> 종결되며 그 종결 핸들러 `finalizeResumedExecutionOutcome` 가 FAILED 마킹만 하고
> `dispatchExecutionFailedNotification` 를 호출하지 않았다 (PR3 는 초기 세그먼트 `runExecution` catch 에만
> dispatch 배선). → `finalizeResumedExecutionOutcome` FAILED 분기에 dispatch 추가 (초기 세그먼트와 동일).
>
> **버그 B — notificationsService @Optional undefined**: `ExecutionEngineService` 는 WebsocketModule 등과
> forwardRef 순환 그래프라 NotificationsModule 보다 먼저 인스턴스화 → 생성자 `@Optional NotificationsService`
> 가 **undefined** 로 남아 dispatch 가 guard 에서 항상 no-op. (background processor 는 비-optional·후행
> 인스턴스화라 정상 → `background_failed` 는 발사됐음.) → `getNotificationsService()` 가 ModuleRef(strict:false)
> 로 런타임 지연 해석하도록 수정 (notifications.service.ts 가 WebsocketService 를 푸는 것과 동일 패턴).
>
> 두 버그 모두 e2e 없이는 검출 불가였다 — 항목 2 의 실질 가치.

- [x] impl-prep (동일 area, 항목1과 공유)
- [x] 버그 A/B 수정 (`execution-engine.service.ts`) + 진단 계측 제거
- [x] 신규 e2e `execution-failed-notification.e2e-spec.ts` 작성 [TEST WORKFLOW 에서 검증, 격리 실행 2/2 pass 확인]:
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
- [x] **결정 (2026-07-06, 사용자 확정)**: **(a) 보류 유지** — 코드 변경 없음. 근거: 현 동기 호출자(team_invite/invite)
      는 이미 초대링크 이메일로 SMTP 바운드라 알림 이메일 dispatch 는 additive 일 뿐 새 hot-path latency 클래스가
      아님. decouple 은 전 호출자 계약을 async 로 바꾸고 PR2 이메일 unit(await 직후 email_sent_at 동기 단언) 재작성을
      요구 → 비용 대비 이득 없음. **재개 트리거**: 신규 *non-SMTP* 동기 API 경로가 notify()/createMany 를 호출하게 될 때.

## 후속(followup) — 엔진 재리뷰(22_42_32) 아키텍처/리팩터링 지적 (비차단)

엔진 버그 A/B 수정 재리뷰에서 나온 구조적 지적. 기능은 정상(0 Critical, e2e·unit 검증)이나 장기 부채로 이월(**미완 — 별도 트랙**):

- [ ] **[아키텍처 부채] DI 순환 인스턴스화 순서**: `ExecutionEngineService` 가 WebsocketModule 등과 forwardRef
  순환이라 NotificationsModule 보다 먼저 인스턴스화 → 생성자 `@Optional` 의존성이 조용히 undefined 가 되는
  함정이 구조적으로 잔존(이번엔 ModuleRef 지연해석으로 우회). **신규 `@Optional` 의존성 추가 시 동일 함정 주의.**
  근본 해소(이벤트 기반 디커플링 등 순환 그래프 축소)는 별도 트랙. (execution-engine 리팩터링 backlog 후보.)
- [x] **[리팩터링] 초기/재개 세그먼트 FAILED 종결 중복** — **완료** ([[notif-followup-refactor]], PR): 공통 헬퍼
  `finalizeFailedExecution(savedExecution, error, {rehydrated?})` 추출로 `runExecution` catch·`finalizeResumedExecutionOutcome`
  일원화 (behavior-preserving). 버그 A 재발 구조적 차단.
- [x] **[spec §4.4 ModuleRef 문서화]** — **완료** ([[notif-followup-refactor]], PR): §4.4 순환 의존 처리를
  forwardRef / ModuleRef(strict:false) 2종 + 적용 기준 표로 구조화. rationale WARNING 해소.

## 게이트 이행 결과 (Definition of Done)
- [x] impl-prep consistency-check (20_58_46, BLOCK:NO)
- [x] TEST WORKFLOW: lint·unit·build·e2e(238 pass) 통과 — 최종 commit 04386bdd4 기준 green
- [x] `/ai-review` ×2: 초기 구현(21_23_13, 0 Critical/7 WARNING) + 엔진 버그수정 재리뷰(22_42_32, 0 Critical/5 WARNING+security). 전 WARNING 조치 or followup 이관. RESOLUTION.md 2건.
- [x] `/consistency-check --impl-done` (23_06_30, 5 checker, **BLOCK:NO**) — spec 동기화로 SPEC-DRIFT 해소.
- [x] 발견 버그 2건(execution_failed 미발사) 수정 + 회귀 가드(e2e·unit).
- [x] security WARNING(에러메시지 새니타이징) 조치.
- 커밋: 797488494(구현) · 656fc7cce(버그수정) · 04386bdd4(리뷰반영+새니타이저+spec동기화).

## 잔여 (plan in-progress 유지 사유)
- **항목 3** (dispatchEmails decouple): 분석 완료 + 사용자 확정 "보류 유지" — 코드 변경 없음, 종결.
- **team_invite 이메일 2통 UX**: planner 가 channel=`in_app`(벨만, 초대링크 이메일이 이메일 담당)으로 확정·머지 — **종결**.
- **FAILED 종결 헬퍼 추출 · spec §4.4 문서화**: [[notif-followup-refactor]] PR 로 **완료**.
- **유일 잔여 = DI 순환 그래프 근본 축소 (backlog)**: 위 §후속 첫 항목([ ]). forwardRef/ModuleRef 우회가 아닌 순환
  자체 제거로, 대규모 behavior-risky 아키텍처 작업이라 착수 미정 backlog. 본 plan 은 이 backlog 추적을 위해 in-progress 유지.
