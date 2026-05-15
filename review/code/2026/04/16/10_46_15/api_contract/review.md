해당 없음

이번 변경사항은 프론트엔드 React 컴포넌트(`result-detail.tsx`, `result-timeline.tsx`)와 해당 테스트 파일의 수정입니다. 변경 내용은 `information_extractor` 노드 타입 지원 추가, 멀티턴 대화 감지 로직 일반화(`isMultiTurnAgent` → `isMultiTurnConversation`), 라이브 노드 판별 조건에서 `ai_agent` 타입 제한 제거 등 UI/클라이언트 내부 렌더링 로직에만 해당합니다. 백엔드 API 엔드포인트, 요청/응답 스키마, HTTP 상태 코드, 인증/인가 등 API 계약과 관련된 코드 변경은 포함되지 않습니다.

### 위험도
NONE