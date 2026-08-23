# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (--impl-prep)

## 사전 확인

`git diff origin/main -- spec/5-system/14-external-interaction-api.md` 결과가 비어 있다 —
target 번들 파일은 현재 `origin/main` 과 동일한, 이미 병합·구현된 문서다. 즉 본 검토는
"새로 추가되는 diff" 가 아니라 이 파일 전체를 **착수 예정 작업(`plan/in-progress/nodeoutput-allowlist.md`
— `getStatus` 의 `nodeOutput` 을 fail-open deny-list 에서 fail-closed allowlist 로)**의
--impl-prep 게이트 대상으로 재검사한 것이다. 해당 plan 은 아직 "spec 에 allowlist 정의"를
planner 턴 TODO 로 남겨 두고 있어, 이번 문서 자체에는 allowlist 관련 **신규** 식별자가
아직 등장하지 않는다(`config`/`output`/`meta`/`port`/`status`/`formConfig`/`conversationConfig`/
`buttonConfig`/`interactionType` 는 기존 wire 필드명 재사용이지 신규 명명이 아님).

## 점검 결과

### 1. 요구사항 ID 충돌
`EIA-NX-*` / `EIA-IN-*` / `EIA-AU-*` / `EIA-RL-*` / `EIA-NF-*` 전 계열을 `spec/**/*.md` 전수
grep 한 결과, target 문서 밖에서 이 ID 들을 참조하는 파일(`1-data-model.md`,
`5-system/{12-webhook,4-execution-engine,15-chat-channel,3-error-handling,6-websocket-protocol,16-system-status-api}.md`,
`7-channel-web-chat/*`, `conventions/{secret-store,chat-channel-adapter}.md`,
`data-flow/*`)은 모두 target 문서가 정의한 그 ID 를 **가리키기만** 하며, 동일 ID 를 다른
의미로 재정의하는 곳은 없다. 충돌 없음.

### 2. 엔티티/타입명 충돌
`InteractionRequestContext`/`ExternalInteractionRequestContext`/`InternalInteractionRequestContext`,
`InteractionGuard`, `InteractionService`, `InteractionTokenService`, `NotificationDispatcher`,
`NotificationFanout`, `ChatChannelDispatcher`, `TerminalRevokeReconcilerService`,
`WebChatIdleReaperService` 를 codebase 전수 grep — 정의 위치(`interaction.guard.ts`,
`interaction.service.ts` 등)와 spec 서술이 1:1 일치하고, 이 이름들을 다른 의미로 쓰는
곳은 없다. 충돌 없음.

### 3. API endpoint 충돌
`/api/external/executions/:id/*` (interact/stream/status/cancel/refresh-token) 와
`/api/triggers/:id/notification/rotate-secret` · `/api/triggers/:id/interaction/revoke-token` 을
`spec/**` 전수 grep. 기존 `/api/executions/:id/*` (워크스페이스 JWT, 에디터 전용) 와는
target 문서 §R11 이 이미 **prefix + 인증 family 분리 근거**를 명시하고 있고 실제로 경로가
겹치지 않는다. `notification/rotate-secret` 은 `15-chat-channel.md` §566 이 자사 `rotate-bot-token`
과의 동사 재사용 혼동을 스스로 지적하며 명시적으로 다른 이름을 택한 이력이 있다 — 이미
해소된 WARNING(설계 시점에 이름을 분리)이라 재차 지적할 필요 없음. 충돌 없음.

### 4. 이벤트/메시지명 충돌
`execution.message`(§5.2 신규 SSE 표시 이벤트)를 `spec/**` 전수 grep — `7-channel-web-chat/{0-architecture,1-widget-app}.md`,
`conventions/conversation-thread.md`, `5-system/6-websocket-protocol.md` 전부 target §5.2 를
SoT 로 가리키며 정의가 일관된다. `execution.replay_unavailable` 도 §11 매핑 표에서 내부 WS
`replay.unavailable` 과의 이름 차이 근거(§5.2 본문)가 명시돼 있다. 충돌 없음.

### 5. 환경변수·설정키 충돌
`ALLOW_HTTP_HOOKS`, `WEBCHAT_IDLE_REAP_GRACE_MS`, `INTERACTION_JWT_SECRET`,
`IEXT_REFRESH_WINDOW_SEC` 를 `spec/**` + `codebase/**` 전수 grep — 각각 정확히 한 가지
의미로만 쓰이고 `.env.example`·서비스 코드·spec 서술이 정합한다. Redis 키
(`eia:rl:interact:<id>`, `eia:rl:status:<id>`, `eia:notif:rl:<triggerId>`, `exec:seq:<id>`)도
`conventions/redis-keys.md` 인벤토리가 본 spec §8.4 를 detail SoT 로 가리키는 포인터 구조라
이중 정의가 없다. 충돌 없음.

### 6. 파일 경로 충돌
`spec/5-system/14-external-interaction-api.md` 자체는 이미 존재하는 파일이며 target 문서와
동일 경로다(신규 파일 생성 아님). §R9 가 `12-webhook.md` 흡수 대신 신규 번호(13 다음)를 쓴
근거를 남기고 있다. 번호 충돌 없음.

## 요약
target 으로 지정된 `spec/5-system/14-external-interaction-api.md` 는 `origin/main` 과 diff 가 없는
기존 문서이며, 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 여섯
축 전수 grep 결과 spec 전체·codebase 전체에서 동일 식별자가 다른 의미로 쓰이는 사례를
찾지 못했다. 오히려 문서 자체가 `rotate-secret` vs `rotate-bot-token`, HMAC `sha256` vs
`hmac-sha256`, `replay.unavailable` vs `execution.replay_unavailable` 등 잠재적 명명
혼동을 Rationale 절에서 선제적으로 분리·설명해 두고 있어 명명 위생이 양호하다. 이번
--impl-prep 게이트가 대상으로 삼는 실제 작업(`nodeOutput` allowlist)은 아직 planner 가
spec 에 신규 식별자를 부여하지 않은 단계라, 현재 문서에는 그 작업으로 인한 신규 식별자
충돌 후보 자체가 없다 — allowlist 명명이 확정되는 후속 planner 턴에서 (그때 제안될
필터/상수 이름을 대상으로) 재검토가 필요하다.

## 위험도
NONE
