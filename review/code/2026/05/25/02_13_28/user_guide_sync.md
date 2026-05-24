# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 분석 개요

PROJECT.md §변경 유형 → 갱신 위치 매핑 (17개 trigger 항목) 를 SoT 로 적재하여,
리뷰 대상 10개 파일 전체를 매트릭스 left column 패턴에 매칭했다.

변경 파일 목록:
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.spec.ts`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts`
- `plan/in-progress/fix-chat-channel-dispatcher-and-cafe24-warn.md`
- `review/consistency/2026/05/25/01_36_06/SUMMARY.md`
- `review/consistency/2026/05/25/01_36_06/_retry_state.json`

---

## 발견사항

매트릭스 17개 trigger 항목 매칭 결과: **매칭 없음**.

### trigger 별 판정 근거

**새 노드 추가** (`codebase/backend/src/nodes/<cat>/<name>/` 신규 파일): 해당 없음. `mcp-tool-provider.ts` 는 기존 AI Agent 노드의 내부 helper 파일 수정이며, 신규 노드 디렉토리 생성 아님.

**노드 schema 변경** (필드 추가·라벨 변경): 해당 없음. `mcp-tool-provider.ts` 변경은 `openServer` 의 반환 타입을 `ServerEntry` → `ServerEntry | null` 로 변경해 silent skip 경로를 추가한 것으로, 노드의 사용자 노출 schema (필드·라벨·타입) 변경이 아님.

**신규 UI 문자열 (TSX)**: 해당 없음. 변경 파일 중 TSX 파일 없음. 신규 한국어 리터럴 추가 없음.

**통합 신규/제공자 변경**: 해당 없음. 신규 provider 등록이나 integration config 변경 없음.

**유저 가이드 신규 섹션 디렉토리**: 해당 없음. `codebase/frontend/src/content/docs/` 하위 변경 없음.

**백엔드 API 추가·변경**: 해당 없음. 공개 HTTP API endpoint 변경 없음. `WebsocketService`/`ExecutionEventEmitter` 의 신규 메서드는 internal backend service 메서드이며 controller/DTO 레이어가 아님.

**신규 warningCode 발행** (backend warningRules): 해당 없음. `mcp-tool-provider.ts` 변경은 기존 `logger.warn(...)` 직접 호출을 제거한 것이며, `warningRules` 배열에 신규 warningCode 를 추가한 것이 아님. `backend-labels.ts` 의 `WARNING_KO` 매핑 영향 없음.

**신규 errorCode 발행** (`ErrorCode` enum): 해당 없음. `error-codes.ts` 변경 없음.

**신규 cross-cutting enum 값 추가** (`WaitingInteractionType` / `ConversationTurnSource` / `PresentationType` 등): 해당 없음.

**신규 backend zod `ui.label` / `hint` / `group` / `itemLabel` 값**: 해당 없음. `backend-labels.ts` 관련 변경 없음.

**신규 handler output field**: 해당 없음.

**인증·권한·세션 흐름 변경**: 해당 없음. `codebase/backend/src/auth/**` 또는 권한·세션 미들웨어 변경 없음.

**표현식 언어 변경**: 해당 없음. `codebase/packages/expression-engine/**` 변경 없음.

**실행·디버깅 흐름 변경**: trigger 패턴 (`codebase/backend/src/modules/execution-engine/**`) 에 `execution-engine.service.ts` / `execution-event-emitter.service.ts` 가 표면적으로 매칭되나, 변경 내용을 면밀히 검토한 결과 **사용자 가시 실행·디버깅 흐름 변경이 아님**으로 판정.

  - `execution-engine.service.ts` 변경은 `execute()` 진입 시 `WebsocketService` 에 `(executionId → {triggerId, chatChannel})` 를 등록하는 내부 routing context 등록 추가. 사용자가 보는 실행 상태(시작·진행·완료), 디버깅 로그, 노드 이벤트 payload 는 전혀 변경되지 않음.
  - `websocket.service.ts` 변경은 wire envelope (frontend socket.io 수신 payload, WS spec §4.4) 를 명시적으로 보존하면서, backend-internal fanout envelope 에만 routing context 를 첨부. 사용자가 실행 패널·디버그 패널에서 받는 이벤트 shape 은 불변.
  - 해당 fix 는 Telegram/Slack/Discord chat channel outbound 발송이 silent 차단되던 회귀를 복원하는 백엔드 내부 배관 수정. `05-run-and-debug/` 문서는 사용자 관점의 실행 시작·중단·로그 조회 가이드이며, 내부 fanout 라우팅 메커니즘은 해당 문서의 갱신 대상이 아님.

**환경 변수·기동 방법·런타임 변경**: 해당 없음.

**spec 신규/대규모 변경**: 해당 없음. `spec/**` 변경 없음.

**user-guide GUI 흐름 절 신규/변경**: 해당 없음. `02-nodes/**.mdx` / `06-integrations-and-config/**.mdx` 변경 없음.

**plan / review 파일**: `plan/**` 및 `review/**` 는 매트릭스 trigger 와 무관한 추적 산출물.

---

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 17개 trigger 항목 전체를 검토한 결과, 리뷰 대상 10개 파일 중 어떤 파일도 동반 갱신이 필요한 trigger 에 해당되지 않는다. 변경의 본질은 백엔드 내부 회귀 fix (chat-channel outbound routing context 등록 복원 + MCP tool provider 불필요 WARN 제거) 로, wire envelope shape 이 보존되고 사용자 가시 동작·라벨·가이드에 영향이 없다. 매칭 trigger 0건, 누락 0건.

## 위험도

NONE

STATUS=success ISSUES=0
