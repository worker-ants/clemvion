해당 없음

이 변경사항은 순수한 프론트엔드 내부 유틸리티 함수(`llm-call-trace.ts`)와 그에 대응하는 단위 테스트(`llm-call-trace.test.ts`)로, 외부 API 엔드포인트, 요청/응답 스키마, HTTP 계약과는 무관합니다. `fromConversationMessages` 함수 내에서 같은 턴에 여러 어시스턴트 메시지가 있을 때 `callIndexInTurn`을 순차적으로 할당하도록 수정한 로직 버그 픽스이며, API 계약 관점에서 검토할 항목이 없습니다.

### 위험도
NONE