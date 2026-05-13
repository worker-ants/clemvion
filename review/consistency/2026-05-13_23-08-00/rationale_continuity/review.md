관련 spec 파일들의 Rationale를 확인했습니다. 분석을 시작합니다.

---

## Rationale Continuity Check 결과

### 발견사항

---

- **[WARNING]** `spec/3-workflow-editor/4-ai-assistant.md` §4.3.1 — Candidate Picker의 `mcpServers` 쿼리 스코프 갱신 누락
  - **target 위치**: draft §2 §14.2 (`IntegrationSelector 화이트리스트`) + draft §9 (`spec/4-nodes/3-ai/0-common.md §3 McpServerRef`)
  - **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` ## Rationale — ED-AI-39 (Candidate Picker 정책). "서버: `collectPendingUserConfig` 는 widget 별 저장소(integrationRepo / ...) 를 워크스페이스 스코프로 쿼리해 `candidates` 를 채운다"
  - **상세**: Draft는 `McpServerRef.integrationId`의 FK 범위를 `service_type='mcp'` → `service_type ∈ ('mcp', 'cafe24')`로 확장하고, `IntegrationSelector.serviceTypes`도 동일하게 확장한다. 그러나 ED-AI-39로 도입된 `detectPendingUserConfig` 서버 로직에서 `mcpServers` 위젯의 `integrationRepo` 쿼리 필터가 현재 `service_type='mcp'`에 고정되어 있을 가능성이 높다. 이 서버 측 쿼리 범위를 `['mcp', 'cafe24']`로 확장해야 한다는 사실이 draft의 변경 목록(§1~§9)에 포함되지 않았다.
  - **제안**: draft §2 §14.2 또는 별도 §10 변경 항목으로 "spec/3-workflow-editor/4-ai-assistant.md §4.3.1 — `mcpServers` 위젯의 candidate 쿼리 `service_type` 필터를 `['mcp', 'cafe24']`로 갱신" 을 명시. 구현 단계에서 `collectPendingUserConfig` 의 쿼리가 자동으로 추적되도록 spec 수준에서 contract를 선명히 남겨야 한다.

---

- **[INFO]** `spec/5-system/11-mcp-client.md` §2.2 stdio 미지원 Rationale — Internal Bridge와 비충돌 확인
  - **target 위치**: draft §7 §2.3 Internal Bridge 신규 추가
  - **과거 결정 출처**: `11-mcp-client.md` §2.2 — 멀티테넌트 subprocess 비용·보안·워크스페이스 모델 부정합으로 stdio 기각
  - **상세**: draft §2.3는 stdio가 아니라 in-process 함수 호출 방식이므로 stdio 기각 사유(subprocess spawn · 임의 명령 실행 · 격리 모델)가 적용되지 않는다. 과거 기각된 대안의 재도입이 아님. Rationale 연속성 이상 없음.

---

- **[INFO]** `spec/2-navigation/4-integration.md` §11 만료 스캐너 — MCP 면제 조건의 범위 해석
  - **target 위치**: draft §2 §11 ("service_type='cafe24' Integration 은 OAuth refresh token 을 보유하므로 §11 임계치 알림 흐름이 정상 적용된다")
  - **과거 결정 출처**: `4-integration.md` §5.6 / §11 inline Rationale — "service_type='mcp' Integration 은 OAuth refresh token 흐름이 아니므로 token_expires_at 가 항상 NULL → 만료 스캐너 미적용"
  - **상세**: 기존 Rationale의 면제 조건은 "OAuth refresh token 미보유"라는 기술적 사실에 근거하며, service_type='mcp'에 한정된 진술이다. Cafe24는 OAuth refresh token을 보유하므로 면제 대상이 아님. 과거 결정의 번복이 아니라 올바른 서비스별 적용이다. Rationale 연속성 이상 없음.

---

- **[INFO]** `spec/4-nodes/4-integration/0-common.md` §6.1 `meta.durationMs` 통일 — 준수 확인
  - **target 위치**: draft §5 신규 노드 spec §5.1 출력 예시 (`"durationMs": 320`)
  - **과거 결정 출처**: `0-common.md` §6.1 — "meta.durationMs 로 통일 (모든 노드, 단위는 ms)"
  - **상세**: draft의 모든 출력 예시(§5.1, §5.3.1, §5.3.2, §5.3.3)가 `durationMs` 를 사용하고 있음. Rationale 연속성 이상 없음.

---

- **[INFO]** CONVENTIONS 5-field invariant 준수 — 명시적 Rationale 인용 확인
  - **target 위치**: draft §5 §9.5
  - **과거 결정 출처**: `0-common.md` §3 (output envelope 원칙), `0-common.md` §6.1 (durationMs 통일), CONVENTIONS Principle 0~11
  - **상세**: draft §9.5가 Principle 0/1.1/3/7/8.2 준수를 명시적으로 선언하고 있으며, 출력 구조가 이를 실제로 따름. `status` 생략(비-블로킹 원칙 준수), `config` raw echo(Principle 7), `output.response` HTTP 관용 네이밍(Principle 8.2). Rationale 연속성 이상 없음.

---

### 요약

본 draft는 기존 spec의 ## Rationale 및 inline 의사결정 근거와 전반적으로 높은 연속성을 유지한다. stdio 미지원 결정(subprocess 기반 거부)은 in-process Internal Bridge와 성격이 다르므로 재도입 충돌이 아니며, MCP 만료 스캐너 면제는 OAuth 미보유라는 기술적 조건부 면제였으므로 Cafe24(OAuth 보유)에 적용되지 않는 것이 올바르다. 단 하나의 실질적 갭은 ED-AI-39로 확립된 Candidate Picker 아키텍처다 — `mcpServers` 위젯의 서버 측 `integrationRepo` 쿼리 범위 확장이 draft 변경 목록에서 누락되어 있어, 구현 단계에서 `collectPendingUserConfig` 가 Cafe24 Integration을 후보로 포함하지 못할 위험이 있다. 나머지 발견사항은 기존 결정과 충돌 없이 정합함을 확인하는 수준의 INFO다.

### 위험도

**LOW** — CRITICAL 발견사항 없음. 유일한 WARNING(Candidate Picker 쿼리 스코프 누락)은 spec 단계에서 한 줄 추가로 해소 가능하며, 구현을 차단할 수준의 invariant 위반은 아니다.