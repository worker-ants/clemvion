### 발견사항

해당 없음

이 변경사항은 프론트엔드 캔버스 컴포넌트(`CustomNode`)의 포트 렌더링 로직과 그에 대한 테스트 코드, 그리고 스펙 문서 변경입니다. REST API 엔드포인트, HTTP 요청/응답 구조, 인증/인가, URL 설계 등 API 계약과 직접 관련된 코드는 포함되어 있지 않습니다.

### 요약

변경된 파일들은 순수 UI 컴포넌트(`custom-node.tsx`), 해당 컴포넌트의 단위 테스트(`custom-node.test.tsx`), 그리고 AI 노드 동작 방식을 기술한 스펙 문서(`3-ai-nodes.md`)로 구성됩니다. 변경 내용은 `ai_agent` 노드의 Multi Turn 모드에서 조건이 0개일 때 `out` 포트 대신 `user_ended` + `max_turns` + `error` 포트를 표시하도록 프론트엔드 렌더링 로직을 수정한 것으로, 백엔드 API 계약과는 무관합니다.

### 위험도

NONE