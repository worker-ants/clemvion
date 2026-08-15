# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (--impl-prep)

## 검토 범위 메모

target 으로 번들된 `spec/5-system/14-external-interaction-api.md` 는 현재 브랜치(`claude/eia-terminal-emit-facade`)가 `origin/main` 과 diff 없이 동일한 상태이며, 이번 작업(`plan/in-progress/eia-terminal-emit-facade.md`)은 spec 본문을 바꾸지 않는 **순수 내부 타입 리팩터**(`ExecutionEventEmitter` 에 판별 union 파사드 `emitTerminalExecutionEvent`/`TerminalEmitPayload` 추가)다. 따라서 이번 검토는 (a) 기존 spec 문서 자체가 이미 갖고 있는 식별자들이 다른 문서/코드와 충돌하지 않는지 재확인하고, (b) plan 이 새로 도입하려는 코드 식별자가 기존 코드베이스와 충돌하지 않는지를 함께 본다.

## 발견사항

- **[WARNING]** 신규 타입명 `TerminalEmitPayload` 가 기존 `TerminalErrorPayload` 와 한 글자(Emit/Error) 차이로 극히 유사
  - target 신규 식별자: `TerminalEmitPayload` (plan 설계, `emitTerminalExecutionEvent(executionId, payload: TerminalEmitPayload)` 의 판별 union — `plan/in-progress/eia-terminal-emit-facade.md` §설계)
  - 기존 사용처: `codebase/backend/src/shared/utils/terminal-error-payload.ts:36` `export interface TerminalErrorPayload { ... }` (및 `toTerminalErrorPayload()`, 2026-08-14 도입 — `spec/5-system/14-external-interaction-api.md` §종결 이벤트의 필드 집합 `error` 행이 정본 참조)
  - 상세: `TerminalErrorPayload` 는 종결 이벤트의 `error` 필드 하나만을 나타내는 좁은 shape 이고, 새로 도입될 `TerminalEmitPayload` 는 `status`/`durationMs`/`error`/`cancelledBy` 를 모두 아우르는 종결 이벤트 **전체** payload 의 판별 union 이다. plan 설계상 `failed` variant 는 `error: TerminalErrorPayload` 필드를 그대로 내장하므로, 같은 파일/같은 import 구문 안에 `TerminalErrorPayload` 와 `TerminalEmitPayload` 가 나란히 등장하게 된다. 이름이 한 단어만 다르고 둘 다 `Terminal*Payload` 패턴이라 리뷰·자동완성·grep 시 혼동(잘못된 타입을 import 하거나 두 타입을 같은 것으로 오인) 가능성이 있다. `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` 의 `TerminalRevokeReconcilerService` 까지 포함하면 `Terminal*` 접두 식별자가 이미 3종(`TerminalErrorPayload`/`TerminalRevokeReconcilerService`/신규 `TerminalEmitPayload`)이 되어 네임스페이스가 조밀해진다.
  - 제안: 구현 시 `TerminalEmitPayload` 대신 포함 관계가 이름에서 드러나는 명칭(예: `TerminalEventEmitPayload`, `TerminalExecutionEmitPayload`, 또는 필드 집합 SoT 절 제목을 따라 `TerminalEventPayload`)을 검토하거나, JSDoc 에 "이 안에 `TerminalErrorPayload` 를 포함한다" 를 명시해 두 타입의 관계를 소스에서 즉시 드러낸다. CRITICAL 은 아니다 — 두 타입이 실제로 다른 의미로 이미 쓰이고 있는 충돌이 아니라, 신규 도입 시점에 이름을 좁게 고르지 않으면 향후 혼동 여지가 생기는 예방적 권고다.

- **[INFO]** `emitTerminalExecutionEvent` 와 기존 `emitExecution` 의 이름 유사성은 의도된 계층 관계이나 문서화 필요
  - target 신규 식별자: `emitTerminalExecutionEvent` (plan, `ExecutionEventEmitter` 신규 메서드)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:37` `async emitExecution(...)`, `:53` `async emitNode(...)`
  - 상세: 이름 패턴이 `emitExecution` ⊂ `emitTerminalExecutionEvent` 형태로 겹쳐, 호출부 작성 시 "일반 실행 이벤트"와 "종결 전용 파사드" 중 어느 것을 불러야 하는지 헷갈릴 여지가 있다. 다만 plan 자체가 이 관계(파사드가 내부적으로 `emitExecution` 을 호출)를 명시적으로 설계했고, 이는 실제 다른 의미의 충돌이 아니라 계층적 확장이라 CRITICAL/WARNING 은 아니다.
  - 제안: 메서드 JSDoc 에 "종결 이벤트(`completed`/`failed`/`cancelled`) 전용 — 그 외 이벤트는 `emitExecution` 을 직접 호출" 을 명시해 두 메서드의 사용 경계를 소스에서 바로 확인 가능하게 한다.

## 점검했으나 충돌 없음 확인

- **요구사항 ID (`EIA-NX-*`/`EIA-IN-*`/`EIA-AU-*`/`EIA-RL-*`/`EIA-NF-*`)**: `spec/` 전체에서 재사용처를 grep — `spec/1-data-model.md`, `spec/5-system/{3-error-handling,4-execution-engine,6-websocket-protocol,12-webhook,15-chat-channel,16-system-status-api}.md`, `spec/7-channel-web-chat/{0-architecture,1-widget-app,3-auth-session}.md`, `spec/data-flow/{3-execution,15-external-interaction}.md` 전부 동일 문서를 가리키는 cross-reference 였고, 다른 의미로 재정의된 곳은 없음.
- **API endpoint**: `/api/external/executions/:id/*` prefix 는 spec 본문 §R11 이 이미 기존 `/api/executions/*` 와의 분리 근거를 명시. `spec/5-system/12-webhook.md` 에서 겹치는 endpoint 정의 없음(grep 결과 `PATCH /api/triggers/:id` 언급만 있고 신규 EIA endpoint 와 경로 충돌 없음).
- **환경변수**: `WEBCHAT_IDLE_REAP_GRACE_MS` / `INTERACTION_JWT_SECRET` / `IEXT_REFRESH_WINDOW_SEC` / `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` / `STUCK_RECOVERY_STALE_MS` 를 spec 전역에서 grep — 전부 동일 의미로 일관 참조(`EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 는 실행 엔진·EIA 양쪽에서 같은 큐 대기 타임아웃을 가리키는 의도된 공유).
- **엔티티/DTO 명**: `InteractAckDto`/`RefreshTokenResponseDto`/`ExecutionStatusDto`/`WebChatAppearanceDto` 등은 코드 SoT 파일 경로가 spec frontmatter 에 이미 명시돼 있고 codebase 상 다른 의미의 동명 클래스는 발견되지 않음.
- **plan 신규 함수/타입명 자체의 코드베이스 재사용**: `emitTerminalExecutionEvent`, `TerminalEmitPayload` 는 `codebase/`·`spec/` 전체에서 기존 사용처 0건(신규 도입) — 이름 자체의 직접 충돌은 없음. `emitCancellationEvent`(plan 이 파사드로 흡수 예정)는 `execution-engine.service.ts` 에 이미 존재해 plan 의 전제와 일치.
- **파일 경로**: spec frontmatter `code:` 목록에 새로 등장하는 파일 없음 — `emitTerminalExecutionEvent`/`TerminalEmitPayload` 는 기존 `execution-event-emitter.service.ts` 안에 추가될 예정(plan 상 신규 파일 언급 없음)이라 파일 경로 충돌 검토 대상 자체가 없음.

## 요약

이번 target 은 spec 본문 변경이 없는 impl-prep 스캔이며, 문서 자체는 이미 R11(endpoint prefix 분리)·R12(HMAC 표기 분리)·R13/R14(에러 코드 네임스페이스 분리)·R19(`WEBCHAT_` vs `CHANNEL_` prefix 분리)로 여러 잠재 충돌을 사전에 명시적으로 해소해 둔 상태였고, 실측(grep) 결과 요구사항 ID·endpoint·환경변수·엔티티명 전 영역에서 실제 충돌은 발견되지 않았다. 유일한 주목 사항은 이번 plan(`eia-terminal-emit-facade`)이 새로 도입하려는 코드 타입명 `TerminalEmitPayload` 가 같은 도메인의 기존 `TerminalErrorPayload` 와 이름이 지나치게 유사해 향후 혼동 소지가 있다는 것으로, CRITICAL 수준의 실질 충돌은 아니고 명명 명확화를 권고하는 WARNING 이다.

## 위험도
LOW
