### 발견사항

해당 없음

### 요약

이번 변경은 프론트엔드 UI 렌더링 계층(conversation-inspector 컴포넌트, 클라이언트 내부 데이터 변환 유틸, 프론트엔드 상태 저장소 타입, i18n 사전)에만 한정된다. 백엔드 API 엔드포인트 추가·변경, HTTP 응답 스키마 변경, REST 경로 변경은 포함되지 않는다. `use-execution-events.ts`에서 기존 WebSocket 페이로드의 `conversationThread.turns` 필드를 추가로 소비하는 부분이 있으나, 이는 클라이언트가 서버가 이미 emit 중인 필드(additive, §4.4.5 기존 명세)를 읽는 것이므로 API 계약 관점의 변경에 해당하지 않는다. API 계약 리뷰 영역과 무관한 변경이다.

### 위험도

NONE
