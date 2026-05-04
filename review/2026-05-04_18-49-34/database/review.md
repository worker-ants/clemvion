## 발견사항

해당 없음

이번 변경셋은 전적으로 다음 레이어에 집중되어 있습니다:

- **WebSocket 이벤트 계층**: `TOOL_CALL_STARTED` / `TOOL_CALL_COMPLETED` 이벤트 타입 추가 및 emit 로직
- **실행 컨텍스트 스레딩**: `nodeId` 필드를 `ExecutionContext`에 추가 (WS 라우팅 키 전달 목적)
- **핸들러 텔레메트리**: `runProviderTool()` 래퍼로 기존 `provider.execute()` 호출을 감싸는 구조
- **프론트엔드 상태 관리**: Zustand 스토어에 `upsertToolItem` / `updateToolItem` 액션 추가

데이터베이스 스키마 변경, 새로운 ORM 쿼리, 마이그레이션, 인덱스, 트랜잭션 경계에 대한 수정은 포함되어 있지 않습니다.

기존에 `KbToolProvider`가 `buildTools`와 `execute` 양쪽에서 `knowledgeBaseService.findById()`를 개별 호출하는 패턴이 존재하나, 이는 이번 diff의 변경 범위 밖입니다.

## 요약

이번 변경은 AI Agent 노드의 tool 호출을 실시간 디버깅 타임라인에 가시화하기 위한 WebSocket 텔레메트리 레이어와 프론트엔드 상태 관리 구현에 집중되어 있으며, 데이터베이스 접근 계층(엔티티, 리포지토리, 마이그레이션, 쿼리)에 대한 변경은 전혀 없습니다.

## 위험도

**NONE**