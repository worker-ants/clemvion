---
worktree: goal-audit-08b253
started: 2026-05-30
owner: project-planner
---

# Plan — spec 전체 일관성 검토 findings (2026-05-30)

> 출처: `/goal` 감사 Step 2 — spec/ 138개 전수 대상 4-checker 일관성 워크플로
> (cross-spec / rationale-continuity / convention-compliance / naming-collision).
> 본 plan 은 **spec 본문 변경이 필요한 결정 항목**을 추적한다. 대부분은 두 spec 중
> 어느 쪽을 단일 진실로 삼을지 **사용자/planner 결정**이 필요해 자동 수정하지 않고 기록한다.
> spec 변경은 `project-planner` 가 `consistency-check --spec` 후 진행한다.

## Critical (구현 오도 위험 — 우선 결정)

- [ ] **C1. Background 노드 알림 필드명·채널·수신자 3중 모순**
  - `spec/4-nodes/1-logic/12-background.md:24` — `notifyOnFailure`(Boolean 단일), 수신자 "워크스페이스 Admin"
  - `spec/5-system/4-execution-engine.md:316-317` — `notifyOnError=true` + `notifyChannels.{in_app,email}` 객체, 수신자 "실행 시작 사용자(executed_by)"
  - `spec/1-data-model.md:626` — `Notification.type=background_failed` 의 channel 은 `in_app/email/both`
  - **결정 필요**: 필드명(`notifyOnFailure` vs `notifyOnError`), 채널 구조(단일 boolean vs `notifyChannels` 객체), 수신자(Admin vs 실행 시작 사용자) 중 단일 진실 선택 후 양쪽 spec 통일. data-model `background_failed` channel 표현과도 정합.

- [ ] **C2. 에러 처리 spec §2.2 예시가 폐기 코드 `NODE_EXECUTION_FAILED` 사용**
  - `spec/5-system/3-error-handling.md:72` — `NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR` 는 노드 수준 envelope 에서 폐기 명시
  - `spec/5-system/3-error-handling.md:123` — 그러나 §2.2 "실행 에러 형식" JSON 예시가 `"code": "NODE_EXECUTION_FAILED"` 사용
  - **수정 방향(결정 단순)**: §2.2 예시를 현행 `codebase/backend/src/nodes/core/error-codes.ts` ErrorCode enum 값(예: `LLM_TIMEOUT`/`HTTP_5XX`)으로 교체하거나 "구 포맷" 주석 추가.

- [ ] **C3. EIA §7.1 이 폐지된 inline auth 필드를 Trigger.config 에 재도입 (rationale 위반)**
  - `spec/5-system/14-external-interaction-api.md:571` — Trigger.config JSONB 주석 "기존 필드(authType/secret/bearerToken/hmacHeader/hmacAlgorithm) 유지"
  - `spec/5-system/12-webhook.md:157, 408-415` — inline auth path 폐지(AuthConfig 단일 진입), V066 마이그레이션으로 제거됨을 SoT 로 명시
  - **수정 방향**: EIA §7.1 의 inline auth 필드 유지 주석을 삭제하고 `auth_config_id`(FK)만 잔존함을 12-webhook SoT 와 일치시킨다. JSONB 예시에서 폐지 필드 제거.

- [ ] **C4. ai-agent §7.3 error 예시 — Principle 3.2.1 필수 `retryable` 누락**
  - `spec/4-nodes/3-ai/1-ai-agent.md:554-579` (§7.3 예시·필드표) — `details` 에 `retryable` 없음
  - `spec/conventions/node-output.md:128-129` — LLM 계열 노드 error 포트 `output.error.details.retryable: boolean` 필수
  - **수정 방향**: §7.3 예시 `details` 에 `retryable`(+`retryAfterSec?`) 추가 및 필드표 보강(§7.9 멀티턴 예시와 형식 통일).

- [ ] **C5. ai-agent §7.4 / information_extractor §5.4 — `output.result.maxTurns` 가 Principle 1.1(config↔output 직교성) 위반**
  - `spec/4-nodes/3-ai/1-ai-agent.md:601-652`, `spec/4-nodes/3-ai/3-information-extractor.md:330-353` — `output.result.maxTurns`(config echo)
  - `spec/conventions/node-output.md:46-55` — 정적 config 값은 output 에 복사 금지
  - **수정 방향**: 두 spec 에서 `output.result.maxTurns` 제거. UI 진행률 필요 시 `config.maxTurns` 직접 참조 규칙으로 대체.

- [ ] **C6. node-output Principle 4.3 표 ↔ ai-agent §7.4 / info-extractor §5.4 실제 output 경로 불일치**
  - `spec/conventions/node-output.md:221-222` — `ai_agent (multi): { messages }`, `information_extractor (multi): { messages, partial? }` (최상위처럼 표기)
  - 실제: `output.result.{messages,message,turnCount}` + info-extractor `output.partial.*`
  - **수정 방향**: Principle 4.3 표를 `{ result: { messages, message, turnCount } }` / info-extractor 는 `+ partial?: {...}` 로 정확화 (C5 와 함께 maxTurns 제거).

## Warning (정합성 — 결정/수정 권장)

- [ ] **W1. data-flow/3-execution.md WS 이벤트명이 정규 프로토콜과 불일치**
  - `spec/data-flow/3-execution.md:46,58,167` — `nodeExecution:started/completed/...`
  - `spec/5-system/6-websocket-protocol.md:183` — 정규 `execution.node.started/...`
  - → data-flow 문서를 정규 이벤트명으로 통일.

- [ ] **W2. Background 실패 알림 수신자 불일치** (C1 의 수신자 축; C1 결정에 흡수 가능)

- [ ] **W3. WaitingInteractionType 4값 ↔ EIA 외부 3값 매핑 정책 spec 간 불일치**
  - `spec/conventions/interaction-type-registry.md:25`(4값) vs `spec/5-system/14-external-interaction-api.md:470`(3값) vs `spec/conventions/chat-channel-adapter.md`(4값 노출) vs `spec/7-channel-web-chat/0-architecture.md:65`(3값, render_form→ai_conversation 통합)
  - → chat-channel-adapter.md 의 EIA 페이로드 타입을 3값으로 통일하거나 `ai_form_render` 내부 처리임을 명시 + EIA §6.2 를 SoT 로 참조.

- [ ] **W4. Execution 상태머신 `skipped` 비대칭**
  - `spec/1-data-model.md:433`(Execution 에 skipped 없음) vs `:470`(NodeExecution 에 skipped) vs `spec/2-navigation/14-execution-history.md:53`(필터에 skipped 없음)
  - → "모든 노드 skipped 시 Execution 최종 status" 규칙 + NodeExecution.skipped 발생 조건을 실행 엔진 spec 에 명시.

- [ ] **W5. Chat Channel adapter fan-out 구독 소스가 동일 spec 내 상이 기술**
  - `spec/5-system/15-chat-channel.md:177,495,534`, `spec/5-system/14-external-interaction-api.md:902-904`

- [ ] **W6. data-flow/4-file-storage.md Rationale 가 0-overview §2.7 의 구버전 S3 key 패턴 인용**
  - `spec/data-flow/4-file-storage.md:105-116` vs `spec/0-overview.md:254-274`

- [ ] **W7. ai-agent §7.3 필드표 `status` 행 누락** (Principle 11 문서화 규칙) — `spec/4-nodes/3-ai/1-ai-agent.md:574-579`

- [ ] **W8. information_extractor §5.4 messages 에 `system` role 포함 — conversation-thread §1.4 / ai-agent §7.4 와 불일치**
  - `spec/4-nodes/3-ai/3-information-extractor.md:323-327` vs `spec/conventions/conversation-thread.md:62-64`

- [ ] **W9. node-output Principle 4.3 표 `table (static)` waiting output 에 `totalRows` 누락** — `spec/conventions/node-output.md:217-218`

- [ ] **W10. ai-agent §6.1.d.ii ↔ §7.4 에서 interactionType 값 혼용 (`ai_form_render` vs `ai_conversation`)** — `spec/4-nodes/3-ai/1-ai-agent.md:338,616` (W3 와 연관)

- [ ] **W11. interactionType 열거값 누락 — 3-execution.md:272 / 0-canvas.md:607 에 `ai_form_render` 빠짐** (registry §25 기준)

- [ ] **W12. EIA §6.4 실패 payload `error.code` 예시값이 정규 에러코드와 불일치** — `spec/5-system/14-external-interaction-api.md:523` vs `spec/5-system/3-error-handling.md:52-54`

- [ ] **W13. WS protocol 매핑 표의 외부 interact 엔드포인트 URL 오류** — `spec/5-system/6-websocket-protocol.md:703,710` vs `spec/5-system/14-external-interaction-api.md:65,245`

- [ ] **W14. 토큰 prefix 레지스트리 미완 — `wsk_`/`iext_`/`itk_` 미등재** — `spec/1-data-model.md:543` + EIA `:83,84,201`

- [ ] **W15. EIA-AU-08 이 참조하는 요구사항 ID EIA-AU-09 미정의** — `spec/5-system/14-external-interaction-api.md:90,92`

## Info (명확화 권장 — 비차단)

- [ ] I1. Webhook WH-RS-01 응답 shape 가 실제 TransformInterceptor 래퍼(`{data:{...}}`)와 불일치 — `spec/5-system/12-webhook.md:71,343`
- [ ] I2. Trigger.type enum 에 chat-channel 없음(webhook 종속) — cross-reference 한 줄 추가 권장 (`spec/1-data-model.md:203`, `spec/4-nodes/7-trigger/0-common.md:20`)
- [ ] I3. chat-channel-adapter R4 의 "native modal v2 option" 라벨이 R-CCA-8(v1 활성)과 미정리 — `spec/conventions/chat-channel-adapter.md:502-549`
- [ ] I4. `data-flow/` 폴더가 CLAUDE.md 폴더 구조/단일 진실 원칙 표에 미언급 (12개 파일 존재)
- [ ] I5. NodeExecution.interaction_data.interactionType 과 WaitingInteractionType 이 동일 필드명·상이 enum 집합 — `spec/1-data-model.md:478` vs registry

## 비고

- 전체 원본 findings(detail+suggestion 포함)는 본 감사 세션의 consistency 워크플로 산출(`/goal` Step 2)에 보존. 위 항목은 그 요약·추적본.
- C2/C4/W1/W7/W9/W11~W15/I1~I5 는 단순 문서 정합 수정(결정 부담 낮음). C1/C3/C5/C6/W3/W4/W10 은 canonical-truth 결정 필요.
