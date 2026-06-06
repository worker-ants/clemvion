## 발견사항

- **[INFO]** `status` 키 — tool_result content JSON 에 신규 추가
  - target 신규 식별자: `"status": "not_searchable"` (KB tool_result content 객체 안)
  - 기존 사용처: `AgentToolResult` 반환 객체의 outer field `status: 'error'` (`/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` 197·209·270행). 단, 이 `status` 는 `content` 문자열 **밖**의 메타 필드로, LLM 에게 전달되는 JSON content 내부에는 현재 `status` 키가 없음.
  - 상세: 기존 KB tool_result content JSON 스키마(`spec/5-system/9-rag-search.md §2.2`)에는 `error`, `grounding`, `note`, `kb`, `query`, `results` 키만 존재한다. `status` 는 content payload 에 없는 신규 키다. `AgentToolResult.status` 는 outer wrapper 필드라 LLM 에게 노출되지 않으므로 실제 의미 충돌은 없다. 그러나 spec §2.2 의 기존 봉투 예시들이 `error`/`grounding` 등 각기 다른 최상위 필드로 상황을 구분하는 패턴인데, target 이 `status` 라는 새 최상위 키를 추가함으로써 봉투 판별 방식이 혼합된다 (기존: `error` 유무 / `grounding:"none"` 유무, 신규: `status:"not_searchable"` 유무).
  - 제안: 충돌은 아니나 일관성 보완 차원에서 — spec §2.2 에 "봉투 판별 우선순위: `error` 먼저 → `status` → `grounding`" 를 명시하거나, 기존 `error:"search_failed"` 패턴처럼 `status` 대신 별도 최상위 키(예: `unsearchable: true`)를 쓰는 방안도 검토 가능. 현 제안대로 `status` 를 쓰는 것 자체는 semantic 충돌이 없으므로 INFO 수준.

- **[INFO]** `skipReason` enum — `ragDiagnostics` 와 `mcpDiagnostics.serverSummaries` 간 네임스페이스 분리 확인 필요
  - target 신규 식별자: `ragDiagnostics.skipReason = "kb_unsearchable"`
  - 기존 사용처: `spec/5-system/9-rag-search.md §4.2` 및 `ai-agent.handler.ts:139` — `skipReason?: 'empty_kb_list' | 'no_results'`. 별도로 `spec/5-system/11-mcp-client.md §6.2` 의 `mcpDiagnostics.serverSummaries[].skipReason` vocabulary(`expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `pending_install`, `lookup_failed`, `not_capable`)도 `skipReason` 이름을 공유하나 다른 객체 경로에 있음.
  - 상세: `ragDiagnostics.skipReason` 과 `mcpDiagnostics.serverSummaries[].skipReason` 은 경로가 달라 런타임 충돌이 없다. 그러나 두 곳이 동일 필드명을 사용하면서 각각 별도 vocabulary 를 관리한다. target 의 `kb_unsearchable` 추가는 `ragDiagnostics.skipReason` 에만 적용되므로 `mcpDiagnostics` vocabulary 와 물리적 충돌 없음.
  - 제안: `spec/5-system/9-rag-search.md §4.2` 의 `skipReason` 값 목록에 `kb_unsearchable` 을 명시적으로 추가하고, `mcp-client.md §6.2` 의 vocabulary 는 별개임을 주석으로 구분해 두면 향후 관리 용이.

- **[INFO]** `reason` 키 — KB tool_result content 에 신규 추가
  - target 신규 식별자: `"reason": "reembedding_required"` / `"reembedding_in_progress"` (KB tool_result content 내)
  - 기존 사용처: `spec/5-system/9-rag-search.md §2.2` 기존 봉투에 `reason` 키 없음. 코드베이스(`kb-tool-provider.ts`) 에도 content JSON 에 `reason` 필드 없음.
  - 상세: 순수 신규 도입. 기존 `grounding:"none"` 봉투의 `note` 필드와 역할이 일부 겹치나(LLM 에게 행동 지시), `reason` 은 기계 판독 enum 이고 `note` 는 자연어 설명이라 의미 분리가 명확하다. 충돌 없음.
  - 제안: 없음 (이미 적절히 분리됨).

### 요약

target draft 가 도입하는 신규 식별자(`status:"not_searchable"`, `reason:"reembedding_required"/"reembedding_in_progress"`, `ragDiagnostics.skipReason="kb_unsearchable"`)는 기존 spec 및 코드베이스에서 다른 의미로 사용 중인 식별자와 충돌하지 않는다. `status` 키가 `AgentToolResult` outer wrapper 의 `status` 필드와 이름이 같지만 완전히 다른 레이어(content JSON 내부 vs 반환 객체 메타)에 위치해 실질적 충돌이 없다. `skipReason` 필드는 `ragDiagnostics` 와 `mcpDiagnostics.serverSummaries` 두 곳에서 이미 공유되는 이름이나 경로가 분리되어 있으며, 신규 값 `kb_unsearchable` 은 `ragDiagnostics` 네임스페이스에만 추가된다. 전반적으로 식별자 충돌 위험은 없으며, spec §2.2 봉투 판별 규칙 명시라는 가독성 개선 정도만 권장한다.

### 위험도

NONE
