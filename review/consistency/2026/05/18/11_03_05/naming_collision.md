# 신규 식별자 충돌 검토 — cafe24-expired-self-healing

> 검토 모드: spec draft (--spec)
> Target: `plan/in-progress/cafe24-expired-self-healing.md`
> 검토일: 2026-05-18

---

## 발견사항

### 1. [CRITICAL] `skipReason` 값 `'not_cafe24'` vs 이미 정의된 `'not_capable'` 충돌

- **target 신규 식별자**: `'not_cafe24'` — plan D 항목 line 69. "마지막은 service_type 불일치" 라고 부연.
- **기존 사용처**: `spec/5-system/11-mcp-client.md:370` — `skipReason` vocabulary 표에서 동일 의미를 `'not_capable'` 로 이미 정의. 설명: "`mcpServers` 에 등록된 Integration 의 `service_type` 이 본 provider 가 처리할 대상 아님 (provider 라우팅 정상 동작 확인용)", 적용 provider: `공용`.
- **상세**: plan 은 `'not_cafe24'` 라는 provider 한정적 이름을 제안하지만, spec 은 이미 동일 의미를 provider 무관 공용(`공용`) 이름인 `'not_capable'` 로 확정·문서화했다. 두 이름이 동시에 코드에 등장하면 동일 상황에 다른 값이 emit 되어 소비자(UI 진단, 로그 파싱)가 분기 처리를 이중으로 해야 하는 혼선이 생긴다. spec `11-mcp-client.md` 는 2026-05-18 갱신분(§6.2)에서 이미 해당 표를 확정한 상태이므로, plan 이 spec 보다 뒤처진 상황이다.
- **제안**: plan D 항목의 `'not_cafe24'` 를 `'not_capable'` 로 교체한다. spec `11-mcp-client.md:370` 이 이미 정의를 담고 있으므로 추가 spec 수정은 불필요하다.

---

### 2. [WARNING] plan 이 제안하는 `'auth_failed'` / `'connection_failed'` skipReason 값 — spec vocabulary 미등록 및 `status_reason` 동명 혼동 위험

- **target 신규 식별자**: `'auth_failed'`, `'connection_failed'` — plan D 항목 line 70. "외부 `McpToolProvider` (`service_type='mcp'`) 도 동일 필드 사용 가능" 으로 제안.
- **기존 사용처**:
  - `spec/5-system/11-mcp-client.md:362-370` — 현재 `skipReason` vocabulary 표 7항목에 `'auth_failed'` 도 `'connection_failed'` 도 없다. vocabulary 표 외 값이 emit 되면 소비자 코드가 예상치 못한 분기를 처리하거나 무시할 수 있다.
  - `spec/1-data-model.md §2.10` (Integration.status_reason) — `auth_failed` 는 이미 `status_reason` 열거값으로 사용 중 (`error` 상태의 사유). `skipReason='auth_failed'` 와 `status_reason='auth_failed'` 가 서로 다른 레이어(buildTools 스킵 사유 vs DB 상태 사유)에 동명으로 존재하면 로그/진단 코드에서 맥락 혼동이 발생할 수 있다.
- **상세**: plan 은 "필요한 만큼만 추가" 라고 명시하나, 구체 값을 vocabulary 표에 등록하지 않고 코드 구현 시점에 추가하면 spec-코드 drift 가 발생한다. 특히 `'auth_failed'` 는 `Integration.status_reason` 와 동명이므로 진단 로그에서 "이 `auth_failed` 는 skip 사유인가, DB 상태 사유인가" 구분이 어려워진다.
- **제안**:
  1. plan D 또는 spec C 갱신 시 `spec/5-system/11-mcp-client.md` §6.2 vocabulary 표에 `'auth_failed'` (적용: `mcp`) 와 `'connection_failed'` (적용: `mcp`) 를 명시적으로 추가해 vocabulary 를 완결시킨다.
  2. `'auth_failed'` 가 `status_reason` 과 동명임을 Rationale 또는 인라인 주석으로 의도적 동명 채택 근거를 남겨 혼동을 차단한다. 대안으로 `'mcp_auth_failed'` 처럼 prefix 를 두어 레이어를 명시하는 방안도 검토할 수 있다.

---

### 3. [INFO] `skipReason` 필드명이 `ragDiagnostics` 와 `mcpDiagnostics` 두 진단 객체에서 공유 — 명칭 충돌 없으나 타입 불일치 확인 필요

- **target 신규 식별자**: `serverSummaries[].skipReason` — plan D 항목 전반.
- **기존 사용처**: `spec/5-system/9-rag-search.md` — `meta.ragDiagnostics.skipReason` 필드. 값: `'empty_kb_list'` / `'no_results'`. `spec/4-nodes/3-ai/1-ai-agent.md` — `meta.ragDiagnostics` 의 선택 필드로 정의.
- **상세**: 두 `skipReason` 는 각각 `meta.ragDiagnostics` (RAG 레이어) 와 `meta.mcpDiagnostics.serverSummaries[]` (MCP 레이어) 에 속하여 JSON 경로가 다르므로 직접적인 식별자 충돌은 없다. 다만 향후 TypeScript 타입 정의(`McpServerSummary.skipReason` / `RagDiagnostics.skipReason`)에서 union 타입을 공유하거나 별도 enum 을 두는지를 구현 시 명시적으로 분리해야 한다. 공유 타입을 사용하면 RAG 의 `'empty_kb_list'` 가 MCP skipReason 에도 유효 값처럼 취급되는 타입 안전성 문제가 생긴다.
- **제안**: 구현 시 `McpSkipReason` 과 `RagSkipReason` 을 별도 string union/enum 으로 정의한다. spec C 갱신(§D 관련 spec 수정) 시 두 타입의 분리를 명시적으로 주석으로 남기면 충분하다.

---

## 요약

target 문서가 도입하는 신규 식별자 중 결정적 충돌은 1건이다. plan D 항목 line 69 에서 제안한 `skipReason` 값 `'not_cafe24'` 는 이미 `spec/5-system/11-mcp-client.md §6.2` vocabulary 표에 `'not_capable'` 이라는 이름으로 동일 의미가 정의되어 있어 충돌한다. 이 값이 두 이름으로 병존하면 소비자 코드가 양쪽을 처리해야 하는 혼선이 생기므로 plan 의 `'not_cafe24'` 를 `'not_capable'` 로 교체해야 한다. 나머지 신규 식별자(`cafe24-token-refresh`, `Cafe24TokenRefreshProcessor`, `ensureFreshToken`, `refreshViaQueue`, `Cafe24AuthFailedError`, `markAuthFailed`, `expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `lookup_failed`)는 기존 spec 및 코드와 정합하거나 이미 구현된 식별자를 재사용하는 것이어서 충돌이 없다. 추가로 plan 이 언급하는 `'auth_failed'` / `'connection_failed'` (외부 MCP provider 용) 는 vocabulary 표 미등록 및 `status_reason` 동명 혼동 위험이 있어 spec 갱신(C 항목) 시 함께 표에 추가하고 레이어 분리 근거를 명시할 것을 권장한다.

---

## 위험도

MEDIUM
