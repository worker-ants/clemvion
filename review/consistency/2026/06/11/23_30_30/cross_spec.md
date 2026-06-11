# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Target: `spec/4-nodes/4-integration/` (diff-base=origin/main)
검토 시각: 2026-06-11

---

## 발견사항

### [INFO] 기존 `1-http-request.md` SSRF 가드 범위 기술과 `0-common.md` ALLOW_PRIVATE callout 간 내부 모순 — 타겟이 해소

- target 위치: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 (Rationale §8.2)
- 충돌 대상: `spec/4-nodes/4-integration/0-common.md` ALLOW_PRIVATE_HOST_TARGETS callout (현 origin/main)
- 상세: origin/main 의 `1-http-request.md` step 8 은 SSRF 가드를 `authentication='integration'` 일 때만 적용하도록 기술했다. 그러나 같은 파일 `ALLOW_PRIVATE_HOST_TARGETS` callout 은 "이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다 — HTTP Request·Database Query·Send Email 가 동일 플래그를 공유한다" 고 표현해, `none`/`custom` 모드도 공통 제어 대상임을 함의하는 문장과 실제 step 8 기술이 불일치했다. 타겟 draft 는 step 8 을 **전 인증 방식 공통**으로 수정하고 §8.2 Rationale 에 결정 근거를 명시해 이 내부 모순을 해소했다.
- 제안: 타겟이 이미 수정·정합 완료. origin/main 병합 후 old callout 문구는 자연 덮어씌워진다. 추가 조치 불필요.

---

### [INFO] Database Query SSRF 차단 에러 코드 비대칭 — 타겟이 명문화, 별도 spec 갱신 불필요

- target 위치: `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 주석
- 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표 (`HTTP_BLOCKED`), `spec/4-nodes/4-integration/3-send-email.md` §6 에러 코드 표 (`EMAIL_HOST_BLOCKED`)
- 상세: HTTP Request 는 SSRF 차단 시 `HTTP_BLOCKED`, Send Email 은 `EMAIL_HOST_BLOCKED` 전용 코드를 노출하지만, Database Query 는 SSRF 차단 시 전용 코드가 정의돼 있지 않아 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다. 타겟 draft 의 `2-database-query.md` §4 SSRF 가드 주석이 이 비대칭을 "향후 통일 후보" 로 명문화했다.
- 제안: 현재 spec 내에서 모순은 없다 (각 노드가 의도적으로 다른 코드를 쓰는 사유가 주석으로 기록됨). `INTEGRATION_CALL_FAILED` 로 통일하거나 `DB_SSRF_BLOCKED` 를 신설하는 후속 작업은 별도 plan 으로 진행. 이번 범위에서는 INFO 수준.

---

### [INFO] `spec/5-system/11-mcp-client.md` 의 `ALLOW_PRIVATE_HOST_TARGETS` production warn 정책 — 타겟과 완전 정합

- target 위치: `spec/4-nodes/4-integration/1-http-request.md` §4 ALLOW_PRIVATE_HOST_TARGETS callout
- 충돌 대상: `spec/5-system/11-mcp-client.md` §3.2 "Production fail-closed 강제 (refactor 04 M-7)", `spec/5-system/1-auth.md` Rationale "Production fail-closed 가드"
- 상세: `spec/5-system/11-mcp-client.md` §3.2 는 `MCP_ALLOW_INSECURE_URL=true` 는 production 에서 부팅 throw(절대 금지), `ALLOW_PRIVATE_HOST_TARGETS` 는 정당 용도가 있어 production 에서 **warn 만** (부팅은 허용) 으로 분리돼 있음을 명시한다. 타겟 draft 의 HTTP 노드 spec 은 이 구분을 기술하지 않지만(운영 가드는 `spec/5-system/` 영역 책임이므로 통합 노드 spec 이 production 부팅 동작을 기술할 필요 없음), 타겟이 기술한 `ALLOW_PRIVATE_HOST_TARGETS` 의 의미·범위는 `spec/5-system/` 기술과 충돌하지 않는다.
- 제안: 정합. 추가 조치 불필요.

---

### [INFO] `spec/5-system/_product-overview.md` NF-SC-05 (OWASP Top 10) — 타겟 변경이 규정 준수를 강화

- target 위치: `spec/4-nodes/4-integration/1-http-request.md` §8.2 Rationale (SSRF 전 인증 공통 적용)
- 충돌 대상: `spec/5-system/_product-overview.md` NF-SC-05 "CSRF, XSS, SQL Injection 등 OWASP Top 10 대응 | 필수 | ✅"
- 상세: NF-SC-05 의 구현 상태가 ✅ 로 표기되어 있고 SSRF 는 OWASP Top 10 (A10:2021 Server-Side Request Forgery) 항목이다. 타겟 draft 가 `none`/`custom` 모드에 대한 SSRF 가드 공백을 닫음으로써 NF-SC-05 ✅ 표기의 실질적 정합성이 높아진다. 모순이 아니라 보강.
- 제안: 현 NF-SC-05 행에 SSRF 명시가 없어 범위 모호성이 있다. 관련 plan 이 생길 경우 `spec/5-system/_product-overview.md` NF-SC-05 설명에 "SSRF 포함" 을 추가하면 명시성이 향상된다. 이번 검토 범위에서 필수 조치는 아님.

---

### [INFO] `spec/2-navigation/4-integration.md` SMTP SSRF Rationale 과의 일관성 — 정합 확인

- target 위치: `spec/4-nodes/4-integration/3-send-email.md` §8.0 Rationale (SMTP host SSRF 가드)
- 충돌 대상: `spec/2-navigation/4-integration.md` §5.5 Email SMTP 연결 테스트, §Rationale "SMTP SSRF 가드를 http/db 와 동일 ALLOW_PRIVATE_HOST_TARGETS 로 통일"
- 상세: `spec/2-navigation/4-integration.md` 의 기존 Rationale 이 이미 SMTP SSRF 가드가 HTTP Request / Database Query 와 동일한 `ALLOW_PRIVATE_HOST_TARGETS` 를 공유함을 명시하고 있다. 타겟 draft 의 `3-send-email.md` §8.0 는 이를 인용·참조하며 충돌이 없다.
- 제안: 정합. 추가 조치 불필요.

---

## 요약

Cross-Spec 일관성 관점에서 타겟 draft (`spec/4-nodes/4-integration/`)는 기존 spec 과 충돌하는 항목이 없다. 핵심 변경인 HTTP Request SSRF 가드 전 인증 방식 공통 적용은 origin/main 의 `1-http-request.md` step 8 이 `ALLOW_PRIVATE_HOST_TARGETS` callout 와 가지고 있던 내부 모순을 해소하는 방향이며, `spec/5-system/11-mcp-client.md` 의 production 가드 분류(throw vs warn), `spec/2-navigation/4-integration.md` 의 SSRF Rationale, NF-SC-05 준수 표기 모두와 일관된다. Database Query 의 SSRF 차단 코드 비대칭 (`INTEGRATION_CALL_FAILED` vs 전용 코드)은 타겟이 도입한 것이 아니라 기존에 존재하던 미해결 항목으로 명문화만 이루어졌으며 선택적 후속 작업 대상이다.

## 위험도

NONE
