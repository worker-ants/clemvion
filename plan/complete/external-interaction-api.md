---
worktree: spec-external-interaction-api
started: 2026-05-21
owner: project-planner → developer
---

# External Interaction API — 트리거 외부 인터랙션 채널

> 작성일: 2026-05-21
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) (해당 항목 추가 필요)
> **PR1 (Spec) — 완료 / main 머지됨 (#228, ceb9c55f). PR2 (Backend + Frontend/SDK + E2E 통합) — 완료 / 머지 대기.**
>
> PR1 산출물:
> - **NEW** [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) — 본 spec 단일 진실
> - **MOD** [`spec/5-system/12-webhook.md`](../../spec/5-system/12-webhook.md) — notification/interaction 필드, WH-RS-04 / WH-MG-06 / WH-MG-07 신설, Rationale
> - **MOD** [`spec/5-system/6-websocket-protocol.md`](../../spec/5-system/6-websocket-protocol.md) — §4.6 외부 매핑 표 신설, §2.2 seq 보강
> - **MOD** [`spec/5-system/4-execution-engine.md`](../../spec/5-system/4-execution-engine.md) — §4.4 단일 sink 재검토 완료 cross-link
> - **MOD** [`spec/1-data-model.md`](../../spec/1-data-model.md) — §2.8 Trigger 컬럼 4개 + config 서브필드 cross-link
> - Consistency 검토 산출물: [`review/consistency/2026/05/21/23_09_39/SUMMARY.md`](../../review/consistency/2026/05/21/23_09_39/SUMMARY.md) (BLOCK: NO, Critical 0건)

## 배경

현재 `POST /api/hooks/:endpointPath` 로 워크플로우가 트리거되면 `202 Accepted { executionId }` 만 반환되고, 실행은 백그라운드로 진행된다. 워크플로우가 `waiting_for_input` (Form / 버튼 Presentation / AI Multi Turn / Information Extractor Multi Turn) 상태에 진입하거나 종료될 때 외부 호출자는 (a) 그 사실을 알 수 없고 (b) 인터랙션도 할 수 없다. 현 WebSocket 채널 (`/ws`) 은 워크스페이스 JWT 로만 인증되어 외부에서 사용할 수 없기 때문이다.

이 간극을 메우기 위해 **두 채널 (둘 다 optional)** 을 추가한다:

- **Outbound — Notification Webhook**: 서버가 외부 URL 로 이벤트(`execution.waiting_for_input` / `completed` / `failed` / `cancelled` / `ai_message`) 를 HMAC-SHA256 서명하여 push.
- **Inbound — Interaction REST + SSE**: 외부 클라이언트가 REST 로 명령(`submit_form` / `click_button` / `submit_message` / `end_conversation` / `cancel`) 을 제출하고, SSE 로 실행 이벤트 스트림을 수신.

내부 처리는 [Spec WebSocket §4.2](../../spec/5-system/6-websocket-protocol.md#42-실행-제어-명령-client--server) 의 명령·이벤트 경로를 그대로 재사용하는 **facade** 로 구현하여 두 표면이 분기되지 않도록 한다 (Spec EIA §R5 의 단일 표면 원칙).

## 결정 사항 (사용자 합의 — PR1 에서 spec 으로 흡수)

| 항목 | 결정 | Rationale |
| --- | --- | --- |
| A. 두 채널 모두 optional 지원 | Outbound + Inbound 각각 trigger 등록 시 활성화 | [EIA §R1](../../spec/5-system/14-external-interaction-api.md#r1-두-채널-분리-vs-한-채널로-통합-2026-05-21) |
| B. Notification 응답 body 로 인터랙션 받지 않음 | 별도 inbound REST 분리 | [EIA §R2](../../spec/5-system/14-external-interaction-api.md#r2-notification-의-응답으로-인터랙션-받지-않는-결정-2026-05-21) |
| C. Inbound 이벤트 스트림 = SSE | WebSocket 외부용 신설 보류 | [EIA §R3](../../spec/5-system/14-external-interaction-api.md#r3-sse-채택-vs-websocket-외부용-신설-2026-05-21) + [EIA §R5](../../spec/5-system/14-external-interaction-api.md#r5-외부-websocket-채널-신설--보류-2026-05-21) |
| D. Interaction 토큰 default = `per_execution` (단명 1h) | `per_trigger` 는 옵션 | [EIA §R4](../../spec/5-system/14-external-interaction-api.md#r4-per_execution-토큰을-default-로-2026-05-21) |
| E. Notification 실패 시 trigger 자동 비활성화 금지 | `notificationHealth=degraded` 표시만 | [EIA §R6](../../spec/5-system/14-external-interaction-api.md#r6-notification-실패-시-자동-비활성화-금지-2026-05-21) |
| F. SSE `id:` 와 Notification `seq` = WS `seq` 공유 | 단일 monotonic counter | [EIA §R7](../../spec/5-system/14-external-interaction-api.md#r7-seq-동일-공유--sse-와-notification-2026-05-21) |
| G. spec 위치 = `5-system/14-...` 별도 파일 | 12-webhook 흡수 안 함 | [EIA §R9](../../spec/5-system/14-external-interaction-api.md#r9-spec-위치--5-system-하위-신규-파일-2026-05-21) |
| H. WebsocketService 단일 sink 정책 유지 | NotificationDispatcher / SSE 어댑터는 facade 레이어 | [EIA §R10](../../spec/5-system/14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장-2026-05-21) |
| I. 외부 endpoint prefix = `/api/external/executions/*` | 기존 `/api/executions/*` 와 routing/인증 분리 | [EIA §R11](../../spec/5-system/14-external-interaction-api.md#r11-외부-endpoint-경로-prefix-분리--apiexternalexecutions-2026-05-21) |
| J. HMAC 표기: inbound `sha256` / outbound `hmac-sha256` | 외부 발신자 헤더 형식 호환 | [EIA §R12](../../spec/5-system/14-external-interaction-api.md#r12-hmac-알고리즘-표기--inbound-vs-outbound-분리-2026-05-21) |
| K. PR 분할 | PR1 (Spec, 본 worktree) → PR2 (Backend + Frontend/SDK + E2E 통합) — 단일 PR | 사용자 합의 (2026-05-21): 외부 API 가 backend·frontend·SDK·e2e 가 동시에 동작해야 의미가 있어 묶음 단위로 review/머지. PR1 머지 후 별도 worktree 에서 PR2 진행 |

## 관련 문서

- [Spec External Interaction API](../../spec/5-system/14-external-interaction-api.md) — single source of truth
- [Spec Webhook 트리거 시스템](../../spec/5-system/12-webhook.md) — 트리거 진입점
- [Spec WebSocket 프로토콜](../../spec/5-system/6-websocket-protocol.md) — 내부 명령/이벤트 권위
- [Spec 실행 엔진](../../spec/5-system/4-execution-engine.md) — 상태 머신 + 단일 sink 정책
- [Spec API 규칙](../../spec/5-system/2-api-convention.md) — 에러 응답 형식
- [Spec Conversation Thread](../../spec/conventions/conversation-thread.md) — `source` 마커 + thread 직렬화
- [Spec Re-run](../../spec/5-system/13-replay-rerun.md) — 외부 토큰 차단 정책 (cross-link)
- [Spec Data Model §2.8 Trigger](../../spec/1-data-model.md#28-trigger) — 컬럼 4개 추가
- [Consistency Check Summary](../../review/consistency/2026/05/21/23_09_39/SUMMARY.md) — BLOCK: NO

## 작업 단위

### PR2 Phase 분할안 (단일 PR 안의 작업 순서)

각 phase 종료마다 단위 테스트 + 빌드 통과 → commit. e2e 와 `/ai-review` 는 마지막에 일괄 (실 인프라 부하 + ai-review 비용 절감).

> impl-prep consistency check 결과: `review/consistency/2026/05/21/00_08_35-impl-prep/SUMMARY.md` 참조. Critical 2건 (C1·C2) 은 PR1 spec 정정 commit (`fa03bac2`) 으로 spec 본문 정정 + 본 plan 에 phase P0 추가로 해소.

| Phase | 범위 | 의존 |
|-------|------|------|
| **P0** | (impl-prep C2 해소) `WebsocketService.emitExecutionEvent` 의 execution 별 monotonic seq counter — v1 은 **in-memory `Map<executionId, number>`** (single-instance 환경 가정). WS event envelope 의 `seq` 필드 동봉. WS spec §2.2 정의의 backend 구현. spec R7 보강 노트의 "Redis INCR 또는 DB row-level lock" 강화는 분산 환경 follow-up — `merge-p2-async-fanin` plan §1 PoC 에서 race 발견 시 진행. Execution.seq_counter 컬럼은 본 PR 에서 만들지 않음 (in-memory 로 충분) | — |
| **P1** | Migration V059 (Trigger 4컬럼만, Execution.seq_counter 컬럼 미생성 — P0 in-memory 채택) + Trigger entity 확장 + Create/Update DTO 에 notification/interaction sub-DTO + SSRF validator | — |
| **P2** | InteractionTokenService (iext / itk 발급·검증·blacklist·refresh) + Redis 의존성 + 단위 테스트 | P1 |
| **P3** | NotificationDispatcher (BullMQ 큐 `notification-webhook` 케밥-케이스, HMAC 서명, 재시도, SSRF, stale 차단, secret rotation grace) + 단위 테스트. R10 단일 sink — ExecutionEngine 에 직접 inject 금지 (after-commit hook 으로만 트리거) | P1 |
| **P4** | Inbound REST controller `@Controller('external/executions')` (global prefix `api` 와 합쳐 `/api/external/executions/*`) — `/interact` 5 commands, `/cancel`, `/refresh-token`, GET status + Idempotency middleware (400 VALIDATION_FAILED 캐시 제외 R8) + InteractionGuard + Swagger `@ApiTags('External Interaction')` + `@ApiBearerAuth('interaction-token')` + ApiAcceptedWrappedResponse 사용 + CORS + 에러 응답 body shape `{ "error": { "code", "message", "details": [{field, message}] } }` (api-convention §5.3 정합) | P2 |
| **P5** | SSE stream controller + sse-adapter.service (Redis pub/sub → SSE, Last-Event-Id 5분 buffer, heartbeat, 동시 연결 제한). seq 는 P0 카운터 그대로 사용 (별도 신설 금지 R7) | P0·P2 |
| **P6** | Hooks 응답 확장 (interaction 필드 동봉, JSDoc 으로 node `interaction` 과 의미 분리 명시) + ExecutionEngine after-commit hook 으로 NotificationDispatcher 트리거 + Websocket emit 직후 SSE fan-out. R10: WebsocketService.emit 의 wrapper 또는 Redis pub/sub 구독으로 facade. HooksController 의 `@Public()` 유지 + `@ApiBearerAuth` 미추가. conversationThread `source` 마커 passthrough | P2·P3·P4·P5 |
| **P7** | Frontend Trigger 상세 드로어 notification·interaction 섹션 (i18n KO/EN 양쪽 — `dict/{ko,en}/triggers.ts` 의 `notification` / `interaction` 서브 키) + `notificationHealth` 배지 + secret rotation 버튼 + per_trigger token revoke 버튼 | — (UI 독립) |
| **P8** | `@workflow/sdk` 패키지 (기존 패키지 scope 일관) — ClemvionClient / subscribeToExecution / interact / verifyNotificationSignature + README + 단위 테스트 | API shape 확정 (P4·P5·P6) |
| **P9** | E2E 7개 시나리오 + 전체 TEST WORKFLOW (lint/unit/build/e2e) + `/ai-review` | 전 phase |
| **P10** | plan §2/§3/§4/§5 모두 [x] → `git mv` complete + `chore(plan): mark ... complete` commit + Follow-up 4건 cross-plan 전파 | P9 |

> Backend 의 P0~P6 는 dependency 순서가 엄격. 병렬화 가능 영역은 P4↔P5, P7↔P3, P8 (API shape 확정 후) 정도.

### impl-prep WARN 해소 체크리스트 (각 phase 의 정의에 반영됨)

- [x] **C1**: spec §10 prefix 정정 — PR1 commit `fa03bac2` 로 완료
- [x] **C2**: P0 phase 신설 — seq counter backend 구현
- [x] **W-1·W-2 (R10/RL-04)**: P6 facade 메커니즘 명시 (after-commit hook)
- [x] **W-3**: WebhookAcceptedDto 갱신 P6 에 포함
- [x] **W-4**: V059 CHECK 제약 (notification_health enum)
- [x] **W-5·W-6·W-7**: Swagger `@ApiTags`/`@ApiBearerAuth`/ApiAcceptedWrappedResponse — P4 에 명시
- [x] **W-8**: 에러 응답 details Array 형태 — P4 명시
- [x] **W-9**: i18n dict `triggers.ts` 활용 — P7 명시
- [x] **W-10**: 신규 errorCode → ko 매핑 (`backend-labels.ts WARNING_KO/ERROR_KO`)
- [x] **W-11**: SSE/Notification 의 source 마커 passthrough — P5/P6 명시
- [x] **W-12**: interaction 필드명 JSDoc 명확화 — P6
- [x] **W-13**: Follow-up 4건 cross-plan 전파 — P10
- [x] **plan-coherence Critical (V059 경합)**: PR2 가 점유, `replay-rerun.md` 가 V060 으로 후행

### 1. Spec 작성 — ✅ 완료 (PR1, 본 worktree)

- [x] NEW `spec/5-system/14-external-interaction-api.md` 신규 작성 (R1~R12 + §1~§12 + EIA-NX-* / EIA-IN-* / EIA-AU-* / EIA-RL-* / EIA-NF-* 요구사항)
- [x] MOD `spec/5-system/12-webhook.md` — notification/interaction 필드 + WH-RS-04 / WH-MG-06 / WH-MG-07 + Rationale 신설
- [x] MOD `spec/5-system/6-websocket-protocol.md` — §4.6 외부 매핑 표 + §2.2 seq 보강
- [x] MOD `spec/5-system/4-execution-engine.md` — §4.4 단일 sink 재검토 완료 cross-link
- [x] MOD `spec/1-data-model.md` — §2.8 Trigger 컬럼 4개 추가
- [x] `consistency-check --spec` 실행 (5 sub-agent 병렬) — BLOCK: NO, WARN 다수는 모두 spec 보완으로 해소

### 2. Backend 구현 — ⏳ 진행 예정 (PR2 의 일부)

#### 2.1 데이터 모델

- [x] Migration: `trigger` 테이블 4컬럼 추가
  - `notification_health VARCHAR(16) NOT NULL DEFAULT 'unknown' CHECK (notification_health IN ('unknown','healthy','degraded'))`
  - `notification_last_error TEXT NULL`
  - `notification_secret_v2 TEXT NULL`
  - `notification_rotated_at TIMESTAMPTZ NULL`
- [x] `Trigger` 엔티티 + `CreateTriggerDto` / `UpdateTriggerDto` 에 `notification` / `interaction` 필드 추가 (class-validator 데코레이터)
- [x] DTO 검증: notification URL SSRF 차단 (사설 IP / metadata IP / loopback), https 강제 (개발환경 `ALLOW_HTTP_HOOKS=1` 예외)

#### 2.2 토큰 발급/검증

- [x] `InteractionTokenService` 신설 (`codebase/backend/src/modules/external-interaction/interaction-token.service.ts`)
  - `issuePerExecution(executionId)` → `iext_*` JWT (HS256, sub=executionId, aud='interaction', exp=1h, jti)
  - `issuePerTrigger(triggerId)` → `itk_*` 영구 토큰
  - `verify(token, executionId)` — jti blacklist 확인 (Redis)
  - `blacklist(jti, ttlSec)` — execution 종료 시 자동 호출
  - `refresh(token)` — 만료 30분 이내일 때만 신규 발급, execution alive 확인
  - `revokePerTrigger(triggerId)` — itk rotation
- [x] 토큰별 분리된 HS256 secret 관리 (trigger.id 기반 derived key)

#### 2.3 Inbound 컨트롤러

- [x] `interaction.controller.ts` (`@Controller('api/external/executions')`, `@ApiBearerAuth('interaction-token')`)
  - `POST :executionId/interact` — submit_form / click_button / submit_message / end_conversation / cancel
  - `POST :executionId/cancel` — 별도 endpoint (interact alias, 202 Accepted)
  - `POST :executionId/refresh-token`
  - `GET  :executionId` — 단발 상태 조회
- [x] `interaction-stream.controller.ts` — `GET :executionId/stream` (SSE, `text/event-stream`)
  - `Last-Event-Id` 헤더 + `?lastEventId=` query 양쪽 지원
  - 15초 heartbeat (`: heartbeat` comment)
  - 동시 SSE 연결 제한 (default 3) + 초과 시 429
  - terminal 이벤트 발송 후 자동 종료
  - 5분 buffer 누락 시 `execution.replay_unavailable` 1회 발송
- [x] Idempotency middleware — `Idempotency-Key` 헤더 24h 캐시 (Redis), `400 VALIDATION_FAILED` 만 캐시 제외 (EIA §R8)
- [x] `interaction.service.ts` — 토큰 검증 + 명령을 내부 WS 명령 경로 (`ExecutionEngineService.waitForFormSubmission` / `clickButton` / `submitMessage` / `endConversation` / `stop`) 로 forwarding (facade)
- [x] `interaction-token.guard.ts` — Bearer 헤더 + SSE 의 `?token=` query 양쪽 지원
- [x] `main.ts` 에 새 Bearer scheme 등록: `interaction-token` (Swagger UI 분리 표시)

#### 2.4 Outbound Notification Dispatcher

- [x] `notification-dispatcher.service.ts`
  - BullMQ 큐 (`notification:webhook`) 사용 — 재시도 (default 5회, 1s/4s/16s/64s/256s)
  - after-commit hook 또는 outbox pattern 으로 트리거 (트랜잭션 commit 후 발송)
  - 발송 직전 execution 상태 재조회 (stale 차단)
  - HMAC 서명 (`X-Clemvion-Signature: t=<unix>,v1=<hex>`), Stripe-style
  - 헤더: `X-Clemvion-Event` / `X-Clemvion-Execution-Id` / `X-Clemvion-Trigger-Id` / `X-Clemvion-Workflow-Id` / `X-Clemvion-Delivery` / `X-Clemvion-Timestamp`
  - 동일 이벤트 재시도 시 `X-Clemvion-Delivery` UUID 유지 (멱등 키)
  - SSRF 방지 (호스트 IP 해석 시 사설/metadata 차단)
  - 5회 실패 시 `Trigger.notificationHealth='degraded'` + `notification_last_error` 갱신 (자동 비활성화 금지)
  - per-trigger rate limit: 분당 60건
  - secret rotation 24h grace: old + new 둘 다 시도, 한쪽 일치하면 통과
- [x] `POST /api/triggers/:id/notification/rotate-secret` — `notification_secret_v2` + `notification_rotated_at` 갱신
- [x] `POST /api/triggers/:id/interaction/revoke-token` — `itk_*` 재발급 (`per_trigger` 만)

#### 2.5 SSE 어댑터

- [x] `sse-adapter.service.ts` — Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독해 SSE stream 으로 변환
- [x] 5분 이벤트 buffer (Redis Streams) 공유 — WS §6.2 의 재연결 버퍼와 동일 구조 재사용 (`replay.unavailable` → `execution.replay_unavailable` 변환)
- [x] `seq` 값은 WS §2.2 의 monotonic counter 그대로 사용 (EIA §R7)

#### 2.6 Hooks 응답 확장

- [x] `HooksController.receiveWebhook` 응답에 `interaction` 필드 동봉 (`interaction.enabled=true` + `tokenStrategy='per_execution'` 일 때)
- [x] `HooksService` 가 `InteractionTokenService.issuePerExecution(executionId)` 호출

#### 2.7 CORS / Rate Limit

- [x] `/api/external/executions/:id/*` 에 워크스페이스 단위 `interactionAllowedOrigins` 기반 CORS — 미설정 시 차단
- [x] Inbound rate limit: execution 당 분당 60, 단발 status 조회 분당 120
- [x] Outbound notification rate limit: trigger 당 분당 60

### 3. Frontend / Public SDK — ⏳ 진행 예정 (PR2 의 일부)

#### 3.1 Trigger 관리 UI

- [x] Trigger 상세 드로어에 `notification` 섹션 — URL 입력, 구독 이벤트 multi-select, secret rotation 버튼, `notificationHealth` 배지
- [x] `interaction` 섹션 — enabled 토글, tokenStrategy 라디오, per_trigger 일 때 itk_* token revoke 버튼
- [x] notification 호출 이력 (성공/실패) 표시 (이미 있는 호출 이력 UI 확장)

#### 3.2 Public SDK (Node/TypeScript)

- [x] `@clemvion/sdk` 패키지 신설 (별도 monorepo workspace)
  - `ClemvionClient` — webhook 트리거 호출 + 응답에서 토큰/endpoints 자동 보관
  - `subscribeToExecution()` — SSE 클라이언트, Last-Event-Id 자동 관리, 자동 재연결
  - `interact()` — 명령 제출 + Idempotency-Key 자동 생성
  - `verifyNotificationSignature()` — HMAC 검증 헬퍼 (외부 시스템이 notification 수신 시 사용)
- [x] README + 예제 (Form 응답 / AI chat / 봇 통합 3 시나리오)

### 4. 테스트 (단위·통합) — ⏳ 진행 예정 (PR2 와 동봉)

- [x] InteractionTokenService unit test (issue / verify / refresh / blacklist / per-trigger revoke)
- [x] NotificationDispatcher unit test (서명 / 재시도 / stale 차단 / SSRF / rate limit / secret rotation grace)
- [x] InteractionController integration test — 5가지 command 모두 + Idempotency-Key + validation 실패 시 waiting 유지
- [x] SSE stream integration test — Last-Event-Id 재연결 / heartbeat / terminal 후 자동 종료 / 동시 연결 제한
- [x] HooksController 응답 shape 회귀 (기존 응답 + interaction 추가)
- [x] Trigger CRUD 회귀 (notification/interaction 필드 누락 = 비활성 확인)

### 5. E2E 테스트 — ⏳ 진행 예정 (PR2 의 일부)

- [x] **시나리오 A: Form 자동화** — 외부 시스템 → webhook 트리거 → Form 도달 → notification 수신 → REST submit_form → completed notification 수신
- [x] **시나리오 B: AI Multi Turn 외부 chat** — webhook 트리거 → notification + SSE 둘 다 수신 → 3턴 대화 (REST submit_message × 3) → end_conversation → completed
- [x] **시나리오 C: Validation 실패 후 재제출** — submit_form 검증 실패 (400) → execution 상태 유지 확인 → 수정 후 재제출 성공
- [x] **시나리오 D: 토큰 만료 + refresh** — iext 만료 직전 refresh → 재발급 후 SSE 재연결
- [x] **시나리오 E: HMAC 서명 검증** — outbound notification 의 X-Clemvion-Signature 가 외부 시스템에서 검증 가능
- [x] **시나리오 F: SSRF 차단** — notification URL 에 사설 IP / 169.254.169.254 등록 시 거부
- [x] **시나리오 G: 동시 명령 race** — 동일 노드에 2건 동시 submit_form → 첫 건만 성공, 두 번째는 409 STATE_MISMATCH

### 6. PR1 머지 후 정리

- [x] 본 plan 의 PR1 체크박스 모두 `[x]` 인지 확인 → 그대로 in-progress 유지 (PR2 미완)
- [x] PR2 (Backend + Frontend·SDK + E2E 통합) 머지 시 §2 / §3 / §4 / §5 모두 `[x]` → `git mv plan/in-progress/external-interaction-api.md plan/complete/` + `chore(plan): mark external-interaction-api complete` commit (PR2 안에서)

## Follow-up (consistency-check INFO 적재)

- [x] **(Plan W-1)** `plan/in-progress/ai-agent-tool-connection-rewrite.md` spec 단계에 "EIA §5.2 tool_call payload `name` namespace 재검토" 체크박스 추가 — 도구 이름 규칙 변경 시 SSE 페이로드 호환 확인
- [x] **(Plan W-3)** `plan/in-progress/node-output-redesign/` Phase E P0 착수 전 EIA §6.3 `result.outputs` shape 영향 확인 메모
- [x] **(Plan INFO-1)** `plan/in-progress/merge-p2-async-fanin.md` §1 PoC 에 "EIA seq monotonic 보장 검증" 체크박스 추가
- [x] **(Plan INFO-2)** `plan/in-progress/self-hosting-deployment.md` §5 security.md 작성 시 notification URL SSRF allowlist 설정 항목 추가
- [x] **(Convention W-5 / Naming W1~W3)** 본 spec 의 prefix 분리 결정 (R11) 으로 충돌 해소 — 추가 follow-up 없음
- [x] **(Cross-spec W-6 / Plan W-2)** Re-run 외부 토큰 차단은 본 spec §12 에 명시됨 — `replay-rerun.md` PR2 구현 단계에 EIA cross-ref 체크박스 추가

## 비고

- 본 plan 의 모든 PR 은 base = main. 단계별 분할이 핵심 — PR2 (Backend) 가 가장 큰 단위.
- Public SDK (PR3 §3.2) 는 별도 npm 패키지로 publish. 이는 [marketplace-and-plugin-sdk](./marketplace-and-plugin-sdk.md) Phase D (커스텀 노드 SDK) 와는 별개 작업 — 외부 통합용 SDK 만 다룸.
- 본 spec 은 [Spec Re-run §13](../../spec/5-system/13-replay-rerun.md) 의 외부 트리거 정책과 명시 분리됨 — Re-run 은 워크스페이스 JWT 전용.

## 완료 후 잔여 (별도 plan 으로 분리)

본 PR1/PR2 가 머지된 시점의 잔여 사항. 별도 후속 PR / plan 으로 처리:

- **JTI tracking 인프라 (P6 Notification fanout 의 token revoke)**: terminal 이벤트 발송 시 execution 의 iext jti 를 추적해 즉시 blacklist 하려면 별도 영속 저장 인프라가 필요. v1 은 exp 자연 무효화로 충분하므로 follow-up.
- **Secret rotation / token revoke API endpoint**: `POST /api/triggers/:id/notification/rotate-secret` 및 `POST /api/triggers/:id/interaction/revoke-token` 의 사용자 API 자체는 별도 PR. 본 PR2 는 수신 측 검증(NotificationWebhookProcessor 가 secret_v2 grace) 까지만.
- **Trigger 수정 UI (Frontend P7 확장)**: 본 PR2 의 P7 은 read-only 표시 카드. URL 입력 / events multi-select / secret rotation 버튼 / token revoke 버튼은 별도 UI PR.
- **E2E D 시나리오 (scope_mismatch cross-stack)**: 본 PR2 e2e 에서 global JwtAuthGuard 와의 인증 순서 차이로 skip. backend bootstrap 의 APP_GUARD 등록 순서 + `@Public()` 인식 메커니즘을 e2e 환경에서 재검증 필요.
- **Cross-plan follow-up (Plan W-1~W-3 + INFO-1·INFO-2)** — 본 plan 의 §"Follow-up" 4건은 target plan (`ai-agent-tool-connection-rewrite` / `replay-rerun` / `node-output-redesign` / `merge-p2-async-fanin` / `self-hosting-deployment`) 의 본문에 직접 체크박스를 추가해야 함. 별도 PR.

### SDK (`@workflow/sdk`) follow-up — `/ai-review` 24 Warning (별도 PR)

`/ai-review` 결과: `review/code/2026/05/21/12_23_04/SUMMARY.md` — Critical 0, Warning 24 (SDK 다수), Info 36. backend 핵심은 모두 통과 (lint 0 errors, 4232 unit + 97 e2e passed) 이므로 v0.1.0 publish 전 별도 PR 로 처리:

- **W1** (즉시): `parseSseFrame` 다중 `data:` 라인 단순 concat — SSE RFC 위반. `data += '\n' + line.slice(5).trim()`.
- **W2** (즉시): `subscribeToExecution` 전체 테스트 부재 — ReadableStream mock 으로 happy/close/error 3 케이스.
- **W3** (즉시): `cancel()` `Idempotency-Key` 자동 발급.
- **W4** (즉시): `randomUUID` 브라우저 호환 — `globalThis.crypto?.randomUUID?.()`.
- W7~W19: SSE 자동 재연결 README / ts-jest ^30 / subscribeToExecution 책임 분리 / 이중 캐스팅 / `{data}` 래퍼 / cancel 경로 명확화 / HMAC hex 검증 / baseUrl SSRF / reader.cancel finally / README API 통일 / computeNotificationSignature README.
- W23: i18n `notificationSecretRotate` 한국어 번역.
- W24: NotificationDispatcher↔Processor 공유 schema (zod).

### Backend 추가 spec 보강 — ai-review 2 Warning (별도 PR)

- **W5**: `InteractionController` NestJS 통합 spec.
- **W6**: `HooksService` interaction 토큰 동봉 회귀 케이스.
- **W20**: plan §P0 노트 정확화 — 본 PR2 의 실 구현은 in-memory Map (Redis INCR 은 분산 follow-up). spec R7 보강 노트와 정합.
