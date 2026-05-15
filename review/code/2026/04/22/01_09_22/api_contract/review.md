## 발견사항

해당 없음

이번 변경사항은 API 계약과 무관한 순수 UI/프롬프트 레이어 수정입니다:

- **`harmony-filter.ts`** — 클라이언트 사이드 렌더링 직전 필터 함수. API 요청/응답 형식, 엔드포인트, 스키마에 영향 없음.
- **`assistant-message.tsx` / `markdown-renderer.tsx`** — 렌더링 컴포넌트 내 sanitize 적용. SSE 스트림 데이터 자체는 변경 없이 수신 후 UI 단에서만 처리.
- **`assistant-panel.tsx`** — 자동 스크롤 signature 확장. 서버와의 통신 인터페이스 무관.
- **`system-prompt.ts`** — 백엔드 LLM 시스템 프롬프트 추가 지시문. `/api/v1/workflow-assistant/sessions/{id}/messages` SSE 엔드포인트의 요청·응답 스키마, HTTP 상태 코드, 인증 방식에 변경 없음.
- **`spec/4-ai-assistant.md`** — 클라이언트 렌더링 동작 문서화. 기존 API 계약(§5 SSE 프로토콜, §6 REST API) 스키마 변경 없음.

---

### 요약

모든 변경사항은 LLM이 assistant text 채널로 harmony 제어 토큰을 leak하는 현상에 대한 클라이언트 방어 레이어 추가와 프롬프트 지침 강화로, API 엔드포인트·요청/응답 스키마·인증·버전 관리 등 API 계약 영역에 어떠한 변경도 발생하지 않는다.

### 위험도
**NONE**