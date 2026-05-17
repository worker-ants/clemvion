### 발견사항

- **[WARNING]** `use-execution-events.ts` 동시 수정 경합 위험
  - target 위치: `frontend/src/lib/websocket/use-execution-events.ts` (구현 착수 예정 scope)
  - 관련 plan: `plan/in-progress/ai-thread-source-mark.md` Phase 3 — `frontend/src/lib/websocket/use-execution-events.ts` 의 `RawMessage` 타입 확장 + `messagesToConversationItems` 의 `currentTurn` 증가 로직 수정 (미체크, worktree `ai-thread-source-mark-7c4f2a`)
  - 상세: `ai-thread-source-mark.md` 의 Phase 3 항목이 `use-execution-events.ts` 의 payload.messages[] 타입에 `source` 필드를 추가하는 미완 작업으로 남아 있다. 해당 worktree(`ai-thread-source-mark-7c4f2a`) 는 현재 파일시스템에 존재하지 않아 비활성 상태이나 plan 이 `in-progress` 에 있고 Phase 2~4 가 모두 미체크다. 동일 파일에 대해 현재 target scope 가 구현 착수를 앞두고 있으므로, 두 작업이 같은 파일을 독립적으로 수정하면 merge conflict 또는 `source` 마커 처리 로직 누락이 발생할 수 있다.
  - 제안: 착수 전 `ai-thread-source-mark.md` 의 Phase 2~4 완료 여부를 확인한다. 해당 plan 이 실질적으로 중단된 상태라면 plan 내 `use-execution-events.ts` 관련 항목을 현재 작업 scope 에 포함하거나 plan 을 보류 표기한다.

- **[WARNING]** `full-review-fixes-a1b2c3` 의 미해결 결정 W-1 이 target scope 와 교차
  - target 위치: `frontend/src/lib/websocket/` 전반 (구현 착수 예정 scope)
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` §의사결정 보류 W-1 — "WebSocket CORS `*` → frontendUrl 화이트리스트" 결정 미완 (worktree `full-review-fixes-a1b2c3` 활성 중)
  - 상세: RESOLUTION 의 보류 항목 W-1 은 `websocket.gateway.ts` (backend) 의 CORS 정책 결정이지만, 그 결과가 frontend WebSocket 클라이언트(`ws-client.ts`, `use-execution-events.ts`) 의 연결 origin 처리에 영향을 줄 수 있다. W-1 결정이 내려지기 전에 frontend websocket 코드를 착수하면, 추후 CORS 정책 변경에 따른 재수정이 발생할 수 있다.
  - 제안: W-1 의 `NODE_ENV=production` 환경 분기 결정을 사용자와 먼저 확정한 뒤 frontend 착수 또는, frontend side 에 영향 없음을 확인 후 INFO 로 강등.

- **[INFO]** `full-review-fixes-a1b2c3` 의 `use-execution-events.ts` 이중 connect 핸들러 항목 (INFO → 미처리)
  - target 위치: `frontend/src/lib/websocket/use-execution-events.ts:659,728`
  - 관련 plan: `plan/in-progress/20260516-full-review/concurrency.md` — INFO 항목 "프론트엔드 `useExecutionEvents`: 동일 이벤트 핸들러 이중 등록"
  - 상세: `client.on("connect", onConnect)` 와 `client.on("connect", onReconnect)` 두 핸들러 이중 등록으로 최초 connect 시 `trySubscribe` 가 두 번 호출될 수 있다는 INFO 항목이 RESOLUTION 에서 처리 대상으로 분류되지 않고 남아 있다. 현재 착수 scope 에서 이 파일을 수정할 경우 해당 패턴이 수정되지 않고 지나칠 수 있다.
  - 제안: 착수 시 해당 이중 등록 패턴 수정을 함께 포함하거나, plan 에 명시적으로 "이번 scope 제외" 로 표기한다.

### 요약

`frontend/src/lib/websocket` 착수 전 주요 정합성 위험은 `ai-thread-source-mark.md` Phase 3 의 미체크 `use-execution-events.ts` 수정 작업과의 경합이다. 해당 worktree 가 파일시스템에서 비활성 상태임에도 plan 이 `in-progress` 로 유지되고 있어, 동일 파일에 대한 독립 수정 시 충돌 위험이 있다. `full-review-fixes-a1b2c3` 의 미해결 결정 W-1(CORS 정책) 은 backend 사안이지만 frontend websocket 클라이언트에 잠재 영향을 남긴다. 전반적으로 현재 target 영역이 기존 plan 에서 "결정 필요" 로 명시한 항목을 일방적으로 우회하는 정황은 없으나, 동일 파일을 다른 plan 이 미완 상태로 예약하고 있어 직렬화 확인이 필요하다.

### 위험도
MEDIUM
