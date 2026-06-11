# Cross-Spec 일관성 검토 결과

**Target**: `spec/4-nodes/4-integration/1-http-request.md` (draft — http-ssrf-all-auth 브랜치)
**검토 일시**: 2026-06-11

---

## 발견사항

### [WARNING] `INTEGRATION_NOT_FOUND` 코드 — 공통 spec 과 충돌

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.8 실행 로직 bullet 및 §6 에러 코드 표
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §4.2` (공통 에러 코드)
- **상세**: target 은 §5.8 에서 "`INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE`([공통 §4.2]) 모두 `port: 'error'` 로 surface" 라고 명시한다. 그러나 `0-common.md §4.2` 는 다음을 명시한다: "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 — `requireEntity` 가 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 throw 하고 이는 `IntegrationError` 가 아니므로 `INTEGRATION_CALL_FAILED` 로 surface 된다." 즉 `INTEGRATION_NOT_FOUND` 는 spec 상 존재하지 않는 에러 코드이며, target 이 이를 surfaced code 로 열거하는 것은 `0-common.md §4.2` 와 모순된다. 같은 패턴은 `2-database-query.md §6` 과 `4-cafe24.md §5.3` 이 있으나, 이들 문서도 동일하게 `INTEGRATION_NOT_FOUND` 를 `0-common.md §4.2` 의 parenthetical 주석 흡수 동작 없이 열거하는 불일관성이 이미 존재한다. 따라서 본 target 만의 신규 충돌이 아니라 Integration 노드 전체에 걸친 기존 불일치를 반복·복제한 것이다. `3-send-email.md §5.3` 은 이를 올바르게 처리하여 `EMAIL_SEND_FAILED` fallback 으로만 서술하고 별도 비고에 `INTEGRATION_NOT_FOUND` 를 Planned 처리로 구분한다.
- **제안**: `0-common.md §4.2` 의 설명("별도 `INTEGRATION_NOT_FOUND` 코드 없음 — `INTEGRATION_CALL_FAILED` surface")을 SoT 로 삼아, target §5.8 / §6 의 `INTEGRATION_NOT_FOUND` 열거를 제거하거나 비고에 "현재 구현에서는 `INTEGRATION_CALL_FAILED` 로 흡수 — 코드명 통일은 Planned" 형태로 정정한다. `2-database-query.md §6` 과 `4-cafe24.md §5.3` 도 동일하게 정합성 보강이 필요하다(별도 작업).

---

### [INFO] `0-common.md §7` 출력 구조 색인 — 인증 범위 서술 업데이트 권장

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §4` step 8 (SSRF 가드 전 인증 방식 공통)
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §7` 출력 구조 색인
- **상세**: target 은 SSRF 가드를 `none`/`integration`/`custom` 전 인증 방식에 적용하는 것으로 변경했다. `0-common.md §7` 의 http_request 행("4xx/5xx + transport + integration resolve 실패 + SSRF 차단 모두 통합")은 인증 모드 범위를 명시하지 않으므로 형식적 모순은 없다. 그러나 "전 인증 공통 SSRF" 를 명시적으로 반영한 서술로 보강하면 인덱스 역할의 완결성이 높아진다.
- **제안**: `0-common.md §7` http_request 행을 "4xx/5xx + transport + integration resolve 실패 + SSRF 차단(전 인증 방식 공통) 모두 통합" 으로 동기화. 필수는 아닌 권장 동기화.

---

### [INFO] `4.2 Usage 로깅 매트릭스` — SSRF 차단 로그 항목의 인증 한정 표시 누락

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §4.2 Usage 로깅 매트릭스`
- **충돌 대상**: target 내부 §4 step 8 및 §8.2 Rationale (자기 참조)
- **상세**: target §4.2 표는 "SSRF 차단 / redirect 한도 초과 | `failed` | `HTTP_BLOCKED`" 를 Usage 로그 항목으로 기술한다. 그러나 §4 step 8 (`none`/`custom` 은 활동 로그 미생성) 및 §8.2 Rationale("Usage 로깅은 `integration` 인증에 한정")에 따르면, `none`/`custom` 인증에서 발생하는 SSRF 차단은 §5.3 `error` 포트로 라우팅되지만 Usage 로그는 기록되지 않는다. 표 헤더에 `authentication='integration'` 일 때 라고 명시되어 있어 기술적 모순은 아니지만, SSRF 차단 행이 `integration` 전용임을 표 안에서 명확히 하지 않아 다른 인증 모드 독자에게 혼동을 줄 수 있다.
- **제안**: §4.2 표의 "SSRF 차단" 행에 비고 "(authentication='integration' 일 때만 기록; none/custom 은 error 포트만)" 를 추가하거나, §4.2 서두에 "아래 표는 `authentication='integration'` 에만 해당하며, none/custom 의 SSRF 차단은 error 포트만 발생하고 Usage 로그 미생성" 을 한 줄 추가한다.

---

### [INFO] `spec/5-system/11-mcp-client.md §3.2` — `ALLOW_PRIVATE_HOST_TARGETS` 참조 범위 업데이트 권장

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §4` SSRF opt-out callout
- **충돌 대상**: `spec/5-system/11-mcp-client.md §3.2` Production fail-closed 강제 callout
- **상세**: `mcp-client.md §3.2` 는 `ALLOW_PRIVATE_HOST_TARGETS(http-request §4)` 를 참조하며 "정당한 self-host 용도(VPC 내부 호스트)가 있는 플래그라 warn 분리" 라고 기술한다. target 이 SSRF 를 전 인증 공통으로 확장해도 이 참조의 의미는 변하지 않으므로 형식 모순은 없다. 단, 이 플래그의 적용 범위가 "HTTP Request 전 인증 모드 + Database Query + Send Email" 임이 더 명확해졌으므로, `mcp-client.md` 의 참조 문구를 "[HTTP Request §4 모든 인증 모드 + Database Query + Send Email]" 로 보강하면 독자에게 더 정확하다.
- **제안**: 필수가 아닌 명명 동기화 권장. `mcp-client.md §3.2` 의 `ALLOW_PRIVATE_HOST_TARGETS(http-request §4)` 괄호를 `ALLOW_PRIVATE_HOST_TARGETS(http-request §4, 전 인증 방식)` 으로 갱신.

---

## 요약

target draft 의 주요 변경(SSRF 가드를 `none`/`custom` 인증 포함 전 인증 방식으로 확장, Config echo spread→명시 열거 D1 적용)은 `spec/4-nodes/4-integration/0-common.md` §7 · `spec/2-navigation/4-integration.md` · `spec/4-nodes/4-integration/3-send-email.md` · `spec/5-system/11-mcp-client.md` 와 직접 모순되지 않는다. 다만 WARNING 1건: target 이 `INTEGRATION_NOT_FOUND` 를 surfaced 에러 코드로 열거하는 것은 `0-common.md §4.2` 의 "이 코드는 현재 구현에 존재하지 않으며 `INTEGRATION_CALL_FAILED` 로 흡수" 기술과 충돌한다. 이 불일치는 `2-database-query.md` · `4-cafe24.md` 에도 이미 존재하는 기존 패턴의 반복이며, target 단독 결함이 아닌 Integration 노드 전체의 에러 코드 목록 정합성 갭이다. INFO 3건은 명시적 표현 보강 권장이다.

## 위험도

LOW
