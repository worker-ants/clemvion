# 신규 식별자 충돌 검토 — kb-unsearchable-warning

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)

---

## 발견사항

신규 식별자 목록 (이번 변경이 도입한 것):

| 식별자 | 유형 | 위치 |
|---|---|---|
| `status: "not_searchable"` | tool_result content 판별 키 값 | `9-rag-search.md §2.2`, `kb-tool-provider.ts` |
| `reason: "reembedding_required"` | tool_result content 필드 값 | `9-rag-search.md §2.2`, `rag-search.service.ts` |
| `reason: "reembedding_in_progress"` | tool_result content 필드 값 | `9-rag-search.md §2.2`, `rag-search.service.ts` |
| `ragDiagnostics.skipReason = "kb_unsearchable"` | ragDiagnostics 진단 필드 값 | `9-rag-search.md §4.2`, `ai-agent.handler.ts` |
| `KbUnsearchableReason` | TypeScript 타입명 | `rag-search.service.ts` |
| `reembeddingRequired` | i18n 키 | `frontend/.../knowledgeBases.ts` |
| `reembeddingInProgress` | i18n 키 | `frontend/.../knowledgeBases.ts` |

### 발견사항

- **[INFO]** `skipReason` 필드명 재사용 — ragDiagnostics vs mcpDiagnostics.serverSummaries[]
  - target 신규 식별자: `ragDiagnostics.skipReason` (`kb_unsearchable` / `empty_kb_list` / `no_results`)
  - 기존 사용처: `spec/5-system/11-mcp-client.md §6.2` — `mcpDiagnostics.serverSummaries[].skipReason` (`expired_install_timeout` / `expired_refresh_failed` / `expired_no_refresh_token` / `error` / `pending_install` / `lookup_failed` / `not_capable`)
  - 상세: 두 `skipReason` 은 서로 다른 parent object 하위에 있다(`ragDiagnostics.skipReason` vs `mcpDiagnostics.serverSummaries[].skipReason`). 네임스페이스가 분리되어 있으며, 값 vocabulary 도 의미상 전혀 다른 도메인(KB 검색 불가 vs MCP 서버 빌드 skip)이다. `spec/5-system/11-mcp-client.md §6.2` 는 `skipReason` 값이 `lower_snake_case` 라는 점을 명시하고 있고, 이번 변경의 `kb_unsearchable` 도 동일 표기 관례를 따른다. 실질적 충돌 없음.
  - 제안: 현행 유지 가능. 향후 통합 진단 UI 나 소비 코드에서 두 `skipReason` 을 혼동하지 않도록, 각 spec 참조 시 부모 객체 경로를 명시하는 관례를 유지할 것을 권장한다.

- **[INFO]** `ragDiagnostics.skipReason` 에 기존 값(`empty_kb_list`, `no_results`)이 이미 정의된 상태에서 `kb_unsearchable` 추가
  - target 신규 식별자: `skipReason = 'kb_unsearchable'`
  - 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (origin/main 기준) — TypeScript 타입 `skipReason?: 'empty_kb_list' | 'no_results'`; `spec/5-system/9-rag-search.md §4.2` (origin/main 에 이미 이번 변경이 반영됨)
  - 상세: origin/main 코드(`ai-agent.handler.ts:139`)의 기존 타입 union 이 `'empty_kb_list' | 'no_results'` 이었고, 이번 변경이 `'kb_unsearchable'` 을 추가했다. 값 자체의 의미 충돌은 없으며, 기존 값들과의 우선순위 (`empty_kb_list` → `kb_unsearchable` → `no_results`) 도 spec 에 명시되어 있다. 실질적 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `status: "not_searchable"` — 기존 tool_result content 패턴과의 관계
  - target 신규 식별자: `status: "not_searchable"` (tool_result content 내 판별 키)
  - 기존 사용처: `spec/5-system/9-rag-search.md §2.2` 및 `kb-tool-provider.ts` — 기존 판별 키는 `error` (`search_failed`) 와 `grounding` (`none`)
  - 상세: `not_searchable` 은 기존 판별 키(`error`, `grounding`)와 다른 키 이름으로, 봉투 판별 우선순위(`error` → `status` → `grounding` → 정상 `results`)가 spec §2.2 에 명시되어 있다. 같은 tool_result 에 두 판별 키가 공존하지 않도록 설계됐고(한 content 에 하나의 판별 키만 존재), 의미 충돌 없음.
  - 제안: 현행 유지.

---

## 요약

이번 변경이 도입한 주요 신규 식별자(`status:"not_searchable"`, `reason:"reembedding_required/reembedding_in_progress"`, `ragDiagnostics.skipReason="kb_unsearchable"`, i18n 키 `reembeddingRequired`/`reembeddingInProgress`)는 기존 사용처와 실질적 충돌이 없다. 유사한 이름의 기존 식별자(`skipReason` in mcpDiagnostics, 기존 `skipReason` 값들)는 네임스페이스·vocabulary 가 완전히 분리되어 있으며, 판별 구조(봉투 우선순위, 부모 객체 경로 구분)가 spec 에 명시되어 혼동 가능성도 낮다. 위험 식별자 없음.

---

## 위험도

NONE
