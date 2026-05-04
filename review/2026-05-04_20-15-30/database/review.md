### 발견사항

해당 없음

변경된 코드 세 파일 모두 데이터베이스와 직접적인 관련이 없습니다:

- **`execution-engine.service.ts`** 의 diff — `buildAiMessageDebugFromResumeState` 순수 함수 추가 및 WebSocket 이벤트 페이로드 구조 변경. 데이터베이스 읽기/쓰기 없음
- **`execution-engine.service.spec.ts`** — 위 함수에 대한 단위 테스트 추가. 인메모리 객체만 사용
- **`spec/.../6-websocket-protocol.md`** — WebSocket 프로토콜 스펙 문서 업데이트. DB 스키마/쿼리 변경 없음

### 요약

이번 변경은 `resumeState` 인메모리 객체에서 LLM 디버그 정보(`llmCalls`, `durationMs`)를 추출하는 순수 유틸리티 함수를 분리하고, WebSocket 이벤트 페이로드를 재구성하는 작업입니다. 데이터베이스 계층(쿼리, 트랜잭션, 스키마, 인덱스 등)에 대한 변경이 전혀 없으므로 데이터베이스 관점의 리뷰 대상이 아닙니다.

### 위험도

**NONE**