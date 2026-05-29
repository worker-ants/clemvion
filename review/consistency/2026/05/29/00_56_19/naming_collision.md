# 신규 식별자 충돌 검토 결과

**검토 범위**: `spec/5-system/` (--impl-prep, 구현 착수 전)
**검토 일시**: 2026-05-29

---

## 발견사항

### [INFO] `StuckDocumentRecoveryService` — 임베딩 vs 그래프 추출 두 경로에서 동일 서비스명 사용

- **target 신규 식별자**: `StuckDocumentRecoveryService` (Graph RAG §KB-GR-EX-10, `spec/5-system/10-graph-rag.md`)
- **기존 사용처**: `spec/5-system/8-embedding-pipeline.md §8.1`, `spec/data-flow/6-knowledge-base.md §3.1` — 임베딩 stuck 문서 회수 목적으로 동일 이름 사용
- **상세**: Graph RAG spec 은 `graph_last_attempted_at` 기준 10분 회수를, 임베딩 파이프라인 spec 은 `embedding_last_attempted_at` 기준 회수를 동일 서비스 이름으로 기술한다. 두 도메인(임베딩/그래프 추출)의 stuck 회수를 하나의 서비스가 담당하는 통합 설계인지, 아니면 별도 구현이어야 하는데 이름이 겹치는지 명확하지 않다.
- **제안**: 동일 서비스가 양쪽 회수를 수행한다는 설계 의도라면, `spec/5-system/10-graph-rag.md KB-GR-EX-10` 에 "임베딩 spec `§8.1` 의 동일 서비스가 그래프 추출 stuck 도 함께 처리한다"는 한 줄 cross-reference를 추가해 명확화. 별도 서비스라면 `StuckGraphExtractionRecoveryService` 등으로 구분.

---

### [INFO] `notification_health` / `chat_channel_health` — 동일 Enum 집합(`unknown / healthy / degraded`)을 두 컬럼이 공유

- **target 신규 식별자**: `chat_channel_health` (Trigger 테이블 컬럼, `spec/1-data-model.md §2.8`, `spec/5-system/15-chat-channel.md`)
- **기존 사용처**: `notification_health` (`spec/1-data-model.md §2.8`, `spec/5-system/14-external-interaction-api.md`)
- **상세**: `spec/1-data-model.md` 는 "enum 값 집합이 동일 — 향후 공용 DB 타입 통합 검토"라고 명시한다. 구현 시 두 컬럼이 서로 다른 DB enum 타입으로 생성되면 migration 비용이 발생할 수 있다. 이름 충돌은 아니지만 `unknown / healthy / degraded` 값 집합 자체는 동일 의미로 사용된다.
- **제안**: 구현 시 공용 PostgreSQL ENUM 타입(`trigger_health_status` 등)을 하나로 정의해 두 컬럼이 재사용하도록 마이그레이션 설계. spec에 "두 컬럼은 동일 DB enum 타입 사용"을 명기하면 구현자 혼선을 방지한다.

---

### [INFO] `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CALL_TIMEOUT_MS`, `MCP_MAX_RESPONSE_BYTES` — 구현체에 이미 존재하나 spec에 미기재

- **target 신규 식별자**: `MCP_ALLOW_INSECURE_URL`, `MCP_MAX_CONCURRENT_CONNECTIONS` (`spec/5-system/11-mcp-client.md §3.2, §4.3`)
- **기존 사용처**: `.env.example` 및 `codebase/backend/src/modules/mcp/mcp-client.service.ts` 에 `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CALL_TIMEOUT_MS`, `MCP_MAX_RESPONSE_BYTES` 가 이미 정의됨
- **상세**: spec `§4.4` 는 타임아웃을 "환경 변수로 override 가능"이라고만 언급하나 실제 env var 이름을 명시하지 않는다. `.env.example` 에는 위 4종이 존재한다. spec에서 정의된 env var 집합(`MCP_ALLOW_INSECURE_URL`, `MCP_MAX_CONCURRENT_CONNECTIONS`)과 구현체의 env var 집합 사이에 gap이 있어 구현자가 추가 env var를 임의로 도입할 가능성이 있다.
- **제안**: `spec/5-system/11-mcp-client.md §4.4` 에 `MCP_CONNECT_TIMEOUT_MS`, `MCP_LIST_TIMEOUT_MS`, `MCP_CALL_TIMEOUT_MS`, `MCP_MAX_RESPONSE_BYTES` 네 env var를 명시적으로 표에 추가. 이름 충돌은 없으나 누락으로 인한 의사소통 갭.

---

### [INFO] `document:graph_error` — 의미 변경 주의사항이 embedding 이벤트와 대칭적으로 기술되어 있으나 WebSocket 프로토콜 spec 에 경고가 축약됨

- **target 신규 식별자**: `document:graph_error` (WS 이벤트, `spec/5-system/10-graph-rag.md §6`)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md §KB` 에 `document:embedding_error` 와 유사하게 "(의미 변경, 2026-05-11) 영구 실패 신호로 사용하지 말 것" 주석이 있음
- **상세**: `spec/5-system/10-graph-rag.md §6` 에 `document:graph_error` 의 의미 변경 경고가 상세히 기술됐지만, `spec/5-system/6-websocket-protocol.md §KB` 는 "임베딩 이벤트와 1:1 대응" 한 줄만 있어 경고가 전달되지 않는다. 프론트엔드가 websocket 프로토콜 spec만 보면 `graph_error`를 영구 실패로 오해할 수 있다.
- **제안**: `spec/5-system/6-websocket-protocol.md` 의 `document:graph_*` 행에 `document:graph_error` 에 대한 의미 변경 주의 메모를 인라인으로 추가하거나 10-graph-rag.md §6 로 직접 링크 추가.

---

## 요약

`spec/5-system/` 에서 도입된 신규 식별자(WebAuthn env vars, MCP env vars, WebAuthn/Graph-RAG 에러 코드, WS 이벤트명, Entity/Relation/ChunkEntity 엔티티 타입명, Graph RAG 요구사항 ID KB-GR-*) 전반에 걸쳐 CRITICAL 또는 WARNING 등급의 직접적 충돌은 발견되지 않았다. `requires2fa`, `challengeToken`, `optionsToken` 등 auth 관련 신규 식별자는 `spec/2-navigation/10-auth-flow.md` 와 `spec/data-flow/2-auth.md` 에서 일관되게 동일 의미로 사용되고 있다. `EMAIL_SEND_FAILED`, `INTEGRATION_NOT_CONNECTED` 등 Integration 에러 코드는 `spec/5-system/3-error-handling.md`, `spec/conventions/chat-channel-adapter.md`, `spec/2-navigation/4-integration.md` 에서 동일 의미로 교차 참조된다. 발견된 4건은 모두 INFO 등급으로 구현 착수를 차단하지 않으나, `StuckDocumentRecoveryService` 이름 공유 양상과 MCP timeout env var 미기재는 구현 단계에서 혼선을 유발할 수 있으므로 spec 보완을 권장한다.

## 위험도

LOW
