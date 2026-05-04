해당 없음

이번 변경사항은 세 파일 모두 데이터베이스와 직접적인 관련이 없습니다:

1. **`execution-engine.service.spec.ts`** — AI Agent 멀티턴 WebSocket 이벤트 페이로드(`llmCalls`, `durationMs`)의 emit 형태를 검증하는 통합 테스트. Repository mock을 사용하지만 실제 DB 쿼리/스키마/인덱스와 무관합니다.

2. **`use-execution-events.test.ts`** — 프론트엔드 WebSocket 이벤트 핸들러 테스트. 상태 관리(Zustand store) 동작을 검증하며 DB 접근 없음.

3. **`use-execution-events.ts`** — `execution.ai_message` 이벤트 처리 로직 변경. legacy fallback 제거 및 `messages` 스냅샷 없는 페이로드 무시 처리. 순수 프론트엔드 WebSocket 이벤트 핸들링으로 DB와 무관.

### 요약

변경사항 전체가 WebSocket 프로토콜 레이어와 클라이언트 상태 관리에 국한되어 있으며, 데이터베이스 쿼리, 스키마, 트랜잭션, 인덱스, 커넥션 등 데이터베이스 관련 코드가 포함되지 않습니다.

### 위험도
NONE