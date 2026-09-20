# Rationale 연속성 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 발견사항

- **[WARNING]** 변경안 ③ 이 새로 등재하는 두 코드가 인접 Rationale 의 "닫힌 다섯" 서술과 어긋남
  - target 위치: target 문서 `## 변경안` → `### ③ HTTP 연결 테스트의 두 코드` (§5.3 결과 목록 끝 문장 · §14.1 두 행 추가안)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → `### 연결 테스트 — Database · HTTP 는 실제로 접속한다 …` (2026-09-19) → `**코드 이름**:` 문단
  - 상세: 그 Rationale 문단은 "호스트 차단 둘(`DB_HOST_BLOCKED`·`HTTP_BLOCKED`)을 뺀 **나머지 다섯**(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR`)은 연결 테스트 전용이다" 라고 그 기능(Database·HTTP 연결 테스트 신설)이 도입한 코드를 닫힌 집합으로 서술한다. 실제로는 같은 기능(`http-connection-tester.ts`)이 `resolveHttpCredentials` 의 실패(`INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED`)를 그대로 `IntegrationTestResult.code` 로 반환한다 — 코드 자신의 주석(`connection-test-codes.ts` 상단)도 이 둘을 별도 카테고리("HTTP 자격증명을 붙이기 전 실패")로 이미 구분해 두고 있다. target 의 ③은 §5.3·§14.1(본문)에는 이 두 코드를 반영하지만, 같은 문서의 그 Rationale 문단은 그대로 둔다 — 병합 후 그 문단만 읽으면 "연결 테스트 전용 코드는 다섯 뿐" 이라는, 방금 고친 본문과 어긋나는 인상을 준다. 같은 배치(2026-09-19)로 들어온 기능의 설명이 스스로 불완전했던 것이라 "번복"은 아니지만, 그 불완전함이 이번 fact-fix 이후에도 그대로 남는다.
  - 제안: `### ①~④ Rationale` 절 또는 `2-navigation/4-integration.md` 의 "코드 이름" 문단에 한 문장 추가 — 예: "`INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED` 는 위 다섯과 달리 연결 테스트 전용이 아니라 노드와 공유하는 공통 Integration 코드다(`resolveHttpCredentials` 가 요청 전 자격증명 해소에서 반환 — 호스트 차단 둘이 노드와 코드를 공유하는 것과 같은 부류)." target 의 체크리스트에 이 한 줄을 반영 항목으로 등재.

## 요약

넷 중 ①·②·④는 이미 완료된 구현 결정(#1364 `ssrf-catch-instanceof`, `http-redirect.ts` 실재)이나 이미 각 노드 문서(`5-makeshop.md` §9)에 명문화된 설계 의도를 spec 표·frontmatter 에 그대로 옮기는 사실 정정이며, 과거 `## Rationale`(SSRF 차단 코드 신설·SSRF 가드 전 인증 공통·SSRF 메시지 일반화·MakeShop 403 세분 미구현)의 결정·기각 대안과 정합한다 — 오히려 "차단 코드는 판정에만 쓴다"는 기존 원칙을 더 정확히 완성한다. ③은 실제 코드·타입(`connection-test-codes.ts`)과 정합하는 옳은 사실 정정이지만, 같은 날 작성된 인접 Rationale 문단("나머지 다섯")을 함께 갱신하지 않아 그 문단이 이번 수정 이후에도 스스로 불완전한 채로 남는다. 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다.

## 위험도

LOW
