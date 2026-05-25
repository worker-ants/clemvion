# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/5-system/`
검토 문서: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

### [INFO] `mcpDiagnostics.serverSummaries[]` 도입에 대한 Rationale 항목 부재

- **target 위치**: `spec/5-system/11-mcp-client.md §6.2 mcpDiagnostics` — `serverSummaries[]` 필드 (2026-05-18 신규) 와 `skipReason` vocabulary 섹션
- **과거 결정 출처**: 없음 — `spec/5-system/11-mcp-client.md ## Rationale` 섹션에 해당 항목이 존재하지 않음. (본 프롬프트 payload 에서 MCP 의 Rationale 항목들은 truncated 상태이나, serverSummaries 에 관한 항목은 보이지 않는다.)
- **상세**: `serverSummaries[]` 는 기존 `errors[]` 와 병행하는 새 필드로, "빌드 결과의 정적 스냅샷" 을 별도 추적한다. 이 구조가 왜 `errors[]` 확장이나 별도 필드로 분리됐는지, 특히 "정보 중복 회피" 원칙(내용 상 `skipReason` 명명 규칙 분리 절에 간략히 언급)이 왜 이 케이스에서는 두 필드 병행을 허용하는지 Rationale 항목이 없다.
- **제안**: `spec/5-system/11-mcp-client.md ## Rationale` 에 "serverSummaries 와 errors 의 분리 — buildTools 결과 스냅샷 vs 런타임 실패 기록" 항목을 추가한다. 핵심 내용: (a) `errors[]` 는 connect/tools-list/tools-call 단계의 런타임 실패를 누적하는 반면, `serverSummaries[]` 는 config 에 등록된 각 Integration 의 buildTools 결과를 정적으로 기록해 "왜 통합이 LLM 에 보이지 않는가" 를 즉시 진단하기 위한 목적이 다름; (b) 두 구조가 중복되지 않도록 외부 MCP 의 connect/initialize 실패는 `errors[]` 만 누적하고 `skipReason` 은 내부 Bridge 경로의 buildTools 단계 skip 을 위주로 정의한다는 구분 원칙을 명문화.

---

### [INFO] `WebAuthnController` host 위치 결정 (AuthModule vs WebAuthnModule) 의 Rationale 1.4.H 내 컨트롤러 배치 근거 보완 권장

- **target 위치**: `spec/5-system/1-auth.md Rationale 1.4.H` — "컨트롤러 host 위치 — AuthModule" 절
- **과거 결정 출처**: `spec/5-system/1-auth.md Rationale 1.4.H` 자체 (기존 결정 번복이 아니라 새 결정)
- **상세**: 1.4.H 는 신설 Rationale 항목으로 컨트롤러 파일과 등록 위치 분리 결정을 설명한다. 내용은 충분히 기록되어 있고 다른 Rationale 항목과 충돌하지 않는다. 다만 "컨트롤러 파일은 webauthn/ 폴더에 두지만 module 등록은 AuthModule 의 controllers 배열에 한다" 는 패턴이 일반적인 NestJS 관행과 다소 어긋나는 이례적 구조다. 이를 읽는 구현자가 "실수"로 오해하지 않도록 Rationale 1.4.H 에 "이것은 의도된 구조이며, WebAuthnModule 에 controller 를 두면 역방향 의존성(`WebAuthnModule → AuthModule`)이 생겨 단방향 원칙을 위반한다" 는 문장을 더 명확히 전면에 배치하는 것을 권장한다. 현재도 내용은 있지만 중반부에 위치해 있어 첫 독자가 놓칠 수 있다.
- **제안**: Rationale 1.4.H 의 "컨트롤러 host 위치 — AuthModule" 단락 첫 문장을 "**이것은 의도된 구조이다.** WebAuthnController 파일은 `auth/webauthn/` 에 위치하지만 NestJS module 등록은 AuthModule 에 한다. 이유: WebAuthnController 가 `AuthService` (access/refresh 토큰 발급) 에 의존하므로 …" 으로 시작하도록 보강. 번복이나 충돌은 아니므로 INFO 처리.

---

### [INFO] Graph RAG `graph-extraction` 큐 처리 오류 — "비재시도성 오류 즉시 failed 전환" 원칙과 §7 에러 처리 표의 일관성 확인 권장

- **target 위치**: `spec/5-system/10-graph-rag.md §7 에러 처리` 표 및 `§7.1 Retry & Failure 정책 상세`
- **과거 결정 출처**: `spec/5-system/10-graph-rag.md ## Rationale "Memory: Graph RAG 기획 결정 (2026-05-02)"` — 기각 대안: 룰 기반 entity 추출 (LLM 추출 단일 경로). Graph RAG 의 임베딩 큐 패턴 동일 채택 결정.
- **상세**: §7 표에서 "추출 응답 JSON 파싱 실패" 의 처리가 "chunk 단위 silent skip + warn (LLM 응답 형식 문제는 재시도해도 동일하므로 비재시도)" 로 기술되어 있다. 그런데 §7.1 의 재시도 정책은 "문서 단위 재시도" (chunk 단위 재시도 별도 적용 없음) 로 단순화되어 있다. JSON 파싱 실패가 chunk 수준에서 발생할 경우, 문서 단위 재시도 시 동일한 LLM 호출이 반복되어 같은 파싱 실패가 재현될 수 있다. "비재시도성" 의도와 "문서 단위 재시도" 정책이 함께 존재할 때 구현자가 "JSON 파싱 실패 청크를 skip 하면서도 나머지 청크는 재시도 포함 문서 단위 재시도 진행" 으로 구현할지 명확하지 않다. 이는 기각된 대안 재도입이나 합의 원칙 위반은 아니나, 구현 착수 전 명확화가 필요하다.
- **제안**: §7.1 에 "JSON 파싱 실패 chunk 는 비재시도 — 해당 chunk 만 skip 하고 나머지 chunk 의 처리는 계속 진행. 문서 단위 재시도 진입은 LLM 일시 오류 (timeout/5xx/network/429) 가 발생한 경우만 해당" 으로 명시.

---

## 요약

`spec/5-system/` 의 세 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`) 는 각 문서의 Rationale 에 기록된 기각 대안·합의 원칙을 본문이 충실하게 반영하고 있다. 명시적으로 기각된 대안(WebAuthn credential suspend, TOTP 자동 fallback, WebAuthn env 미설정 시 부팅 거부, 공통 복구 코드 풀, stdio MCP transport, KB 모드 사후 변경, Apache AGE/Neo4j 도입, DB 기반 WebAuthn challenge 테이블)이 target 문서에 재도입된 사례는 발견되지 않았다. 발견사항은 모두 INFO 등급으로, 기존 Rationale 에 기록되지 않은 신설 결정에 대한 Rationale 항목 보완 권장 사항이거나 구현 시 명확화가 필요한 정책 서술이다. 구현 착수를 차단할 CRITICAL·WARNING 등급 이슈는 없다.

---

## 위험도

LOW
