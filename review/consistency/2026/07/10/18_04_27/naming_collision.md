### 발견사항

없음.

target 문서(`plan/in-progress/spec-integration-error-code-doc-fix.md`)는 새 식별자를 전혀 도입하지 않는다. 변경 대상 4곳 전부가 기존에 이미 정의·사용 중인 식별자(`INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE` 에러 코드, `pending_install` Integration.status enum 값)의 **서술 텍스트만 정정**한다:

- `INTEGRATION_NOT_CONNECTED` — 이미 `spec/4-nodes/4-integration/0-common.md` §4.2, `2-database-query.md`, `3-send-email.md`, `4-cafe24.md`, `1-http-request.md`, `5-system/3-error-handling.md`, `5-system/11-mcp-client.md`, `data-flow/5-integration.md` 등 전 영역에서 노드 실행 시 Integration 미연결(non-connected status)을 나타내는 코드로 일관되게 쓰이고 있음. target 은 이 코드의 조건 목록에 기존 `Integration.status` enum 값인 `pending_install`(`spec/2-navigation/4-integration.md:780`) 을 추가하는 것뿐 — 새 값도 새 코드도 아님.
- `INTEGRATION_INCOMPLETE` — 이미 credential 필드 누락(`0-common.md:74,84`, `1-http-request.md:91`, `4-cafe24.md:106`, `5-makeshop.md:82`, `3-send-email.md:219`)과 `testConnection`(`4-integration.md:798,1223,1225`) 전용 코드로 확립돼 있고, target 은 이 두 용법을 "유지"한다고 명시(§Rationale)하며 §6 line 726 한 곳만 오기를 바로잡음.
- 변경 대상 4개 파일(`spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/4-integration/3-send-email.md`)은 모두 기존 파일이며 신규 경로가 아님.

실제 spec 본문의 line 726/1084(4-integration.md), line 83(0-common.md), line 221(3-send-email.md) 을 직접 확인해 target 의 인용 컨텍스트가 정확함을 검증했고, 코퍼스 전역 grep 결과 두 코드의 용법 분리(노드 실행 status-check → `INTEGRATION_NOT_CONNECTED` vs credential-누락/testConnection → `INTEGRATION_INCOMPLETE`)가 이미 대다수 위치에서 정합적으로 서술돼 있어 target 의 4곳 수정이 이 기존 일관성에 나머지 stale 3곳을 맞추는 것으로 확인된다.

### 요약

target 은 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 중 어느 것도 새로 도입하지 않는 순수 doc-only 정정이다. 다루는 두 에러 코드(`INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE`)와 상태값(`pending_install`)은 모두 코드와 spec 전역에서 이미 확립된 기존 식별자이며, target 의 변경은 그 기존 정의와 완전히 정합한다. 신규 식별자 충돌 관점에서 검토할 대상 자체가 존재하지 않는다.

### 위험도
NONE
