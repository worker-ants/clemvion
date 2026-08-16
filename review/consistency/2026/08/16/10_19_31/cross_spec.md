### 발견사항

- **[INFO]** `execution.failed`(WS/SSE/webhook) `error.message` 값-마스킹이 §R17 의 확립된 문서화 패턴과 비대칭
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.4(`### 6.4 페이로드 — execution.failed`) 및 "종결 이벤트의 필드 집합" 표(`error` 행, L579)
  - 충돌 대상: 같은 파일의 `### R17` (L1371~) 및 `spec/5-system/11-mcp-client.md` L485 (`error` 필드 표에 마스킹을 정본 계약으로 명시)
  - 상세: 이번 PR(`codebase/backend/src/shared/utils/terminal-error-payload.ts`)은 `toTerminalErrorPayload` 안에서 `message`/`details` 에 `deepRedactSecrets` 를 적용해 WS·SSE·outbound webhook 으로 나가는 `execution.failed`(및 `cancelled`/`completed`) 의 `error.message` 를 값-패턴 마스킹한다. 그런데 이 새 보장은 `spec/5-system/14-external-interaction-api.md` 어디에도 명문화되지 않았다. 같은 파일의 R17 은 정확히 같은 성격의 결정(`getStatus` 의 terminal `result`/`error` 값 마스킹)을 "강제됨" 항목으로 Rationale 에 상세 기술하고, `11-mcp-client.md` L485 는 아예 정본 데이터 모델 표 안에 마스킹 방식·패턴 출처를 명시한다. 이 저장소는 정확히 이런 보안 불변식을 항상 Rationale/필드 표에 적어 두는 관행을 스스로 세워 두었는데, 이번 변경만 그 관행 밖에 있다 — 다음에 §6.4 를 읽는 사람(새 consumer 구현자·보안 감사자)은 `message` 가 마스킹된다는 사실을 spec 만으로는 알 수 없다.
  - 제안: `plan/in-progress/eia-terminal-error-sanitize.md` 는 `spec_impact: none`(§6.4 가 sanitize 를 애초에 "요구"하지 않았으므로 계약 위반이 아니라는 근거)으로 명시적으로 판단했고, 그 판단 자체는 타당하다(정말로 §6.4 규범 텍스트와 모순되지 않는다). 다만 R17 과의 문서화 대칭을 원하면 project-planner 턴에서 R17 말미(또는 새 R 항목)에 "WS/SSE/webhook 의 `execution.failed`/`cancelled`.`error.message` 도 2026-08-16 부터 `toTerminalErrorPayload`→`deepRedactSecrets` 로 값-마스킹된다(자격증명 패턴 한정, `postgres://host:port/db` 처럼 자격증명 없는 연결 문자열·내부 호스트명은 미방어 — 잔여 갭은 `spec-sync-external-interaction-api-gaps.md` 등재)"는 한 줄만 추가하면 R17/§6.4/11-mcp-client.md 세 곳의 마스킹 문서화 수준이 맞춰진다. 필수 차단 사유는 아니다.

### 요약
target 영역(`spec/5-system/`)에 대한 실제 diff 는 0줄이다 — 이번 PR 은 `codebase/backend/src/shared/utils/terminal-error-payload.ts`(+테스트)와 `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` 의 docstring 정정, 그리고 두 plan 파일(`eia-terminal-error-sanitize.md` 신규, `spec-sync-external-interaction-api-gaps.md` 항목 close)만 건드렸다. 엔티티·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 다른 spec 영역과의 직접 모순은 발견되지 않았다: (1) `deepRedactSecrets`/`toTerminalErrorPayload` 는 모두 기존 정의를 재사용하고 wire shape(`{code, message, nodeId, details?}`)은 불변, (2) `chat-channel-adapter.md`/`15-chat-channel.md` CCH-ERR-03(`error.message` 원문을 채널 메시지·로그에 노출 금지)과 충돌하지 않고 오히려 방어 계층이 하나 더 생긴 형태로 정합, (3) `6-websocket-protocol.md` 의 별개 결정("`llmCalls` 값-레벨 마스킹 기각")은 다른 필드(`llmCalls`)에 대한 것이라 무관, (4) `11-mcp-client.md`/`3-error-handling.md §6.3` 의 마스킹 서술과도 모순 없음. 유일하게 남는 항목은 위 INFO 하나 — R17 이 세운 "보안 불변식은 Rationale 에 문서화한다" 관행 대비 이번 신규 마스킹 보장이 아직 spec 에 반영되지 않은 문서 동기화 갭이며, PR 을 막을 사유는 아니다.

### 위험도
LOW
