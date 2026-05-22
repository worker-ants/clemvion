# Plan 정합성 검토 결과

검토 대상: `spec/conventions/cafe24-api-metadata.md` (worktree `cafe24-conditional-required-audit-28fb28`, commit `36a8f16e`)
검토 모드: `--impl-prep` (구현 착수 전)

---

## 발견사항

### 1. [INFO] `cafe24-conditional-required-impl.md` plan 이 정확히 target spec 변경을 추적하고 있음 — 정합 확인

- target 위치: `spec/conventions/cafe24-api-metadata.md` §2 `constraints?` 신설, §6 step 7·8 갱신, §7 pseudo-code 갱신, §9 CHANGELOG, §Rationale 신설
- 관련 plan: `plan/in-progress/cafe24-conditional-required-impl.md` (worktree: `.claude/worktrees/cafe24-conditional-required-audit-28fb28`) §1–§4
- 상세: plan 의 §1 Type 정의, §2 `metadata.spec.ts` invariant, §3 handler runtime 검증, §4 MCP 경로 JSON Schema 변환·description suffix·runtime 검증이 target spec §2 "constraints 의 의미" + MCP/JSON Schema 매핑 표 + 노드 핸들러 runtime 검증 설명과 1:1 대응한다. 미해결 결정이 target spec 에 의해 일방적으로 결정된 항목은 없음 — 모두 사용자 결정(2026-05-22)이 §Rationale 에 명시되어 있다.
- 제안: 현재 상태 그대로 구현 착수 가능.

### 2. [INFO] `cafe24-backlog-residual-batch` worktree 가 `cafe24/metadata/order.ts` 를 수정 중 — 파일 수준 부분 경합

- target 위치: `spec/conventions/cafe24-api-metadata.md` §2 (메타데이터 형식 정의), §1 디렉토리 구조 (`codebase/backend/src/nodes/integration/cafe24/metadata/` 하위 파일들)
- 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` (worktree: `cafe24-backlog-residual-batch`)
- 상세: `cafe24-backlog-residual-batch` 는 현재 `order.ts` 에 uncommitted 변경(+18/-5 lines)을 보유하고 있다. target plan(`cafe24-conditional-required-impl.md`) 의 §1은 `types.ts` 신설이고 §3·§4 는 각각 `cafe24.handler.ts` / `cafe24-mcp-tool-provider.ts` 대상이다 — `order.ts` 와는 직접 파일 충돌이 없다. 그러나 `cafe24-conditional-required-impl.md` 의 "Cafe24 docs audit (Phase C)" (비포함 항목으로 명시됨) 가 향후 `order.ts` 를 포함한 다수 resource 파일에 `constraints` row 를 추가할 때 `cafe24-backlog-residual-batch` 의 `order.ts` 변경과 merge 충돌 가능성이 있다. Phase C 는 별도 plan이므로 현재 §1–§4 구현 단계에서는 즉각 충돌 위험 없음.
- 제안: Phase C 착수 시 `cafe24-backlog-residual-batch` 의 `order.ts` 변경이 main 에 merge 된 이후에 진행하거나, 두 worktree 작업자가 사전 조율할 것을 권장.

### 3. [INFO] `cafe24-restricted-scopes-followups.md` 의 §1 AI Agent allowlist UI — `cafe24-mcp-tool-provider.ts` 간접 연관

- target 위치: `spec/conventions/cafe24-api-metadata.md` §2 MCP/JSON Schema 매핑 (`buildJsonSchema` + `constraintToSuffixLine`) → `cafe24-mcp-tool-provider.ts` 구현 대상 (impl plan §4)
- 관련 plan: `plan/in-progress/cafe24-restricted-scopes-followups.md` §1 (worktree: TBD)
- 상세: `cafe24-restricted-scopes-followups.md` §1 은 AI Agent allowlist UI 신설을 다루며 `cafe24-mcp-tool-provider.ts` 의 `buildTools()` 출력을 소비하는 frontend 를 대상으로 한다. `cafe24-conditional-required-impl.md` §4 는 동일 `cafe24-mcp-tool-provider.ts` 의 `buildJsonSchema()` / `buildTools()` 함수를 수정한다. §1 은 worktree 가 미할당(TBD)이고 "advanced surface 도입 시" 조건부 작업이라 동시 진행 중인 worktree 충돌이 현재 시점에서는 없다.
- 제안: `cafe24-restricted-scopes-followups.md` §1 착수 시 constraints 구현(PR) 이 merge 된 후 진행하도록 순서를 plan 에 명시하는 것을 권장.

### 4. [INFO] `0-unimplemented-overview.md` 에 `cafe24-conditional-required-impl.md` 인덱스 누락

- target 위치: 없음 (target doc 자체는 영향 없음)
- 관련 plan: `plan/in-progress/0-unimplemented-overview.md` §plan 문서 목록
- 상세: `0-unimplemented-overview.md` 의 `plan/in-progress/` 목록 트리에 `cafe24-conditional-required-impl.md` 가 등재되어 있지 않다 (2026-05-18 기준 스냅샷이고, 본 plan 은 2026-05-22 신설). 인덱스 문서의 역할은 전체 가시화이므로 누락된 상태다.
- 제안: `0-unimplemented-overview.md` 의 `plan 문서 목록` 트리에 `cafe24-conditional-required-impl.md` 1줄을 추가하거나, 인덱스 갱신을 차기 project-planner 사이클로 위임.

---

## 요약

`spec/conventions/cafe24-api-metadata.md` 의 `constraints?` 신설 변경은 대응 구현 plan `cafe24-conditional-required-impl.md` 와 1:1로 정합하며, 미해결 결정 우회나 동일 파일을 손대는 active worktree 충돌(CRITICAL 조건)은 없다. `cafe24-backlog-residual-batch` 가 `order.ts` 를 보유 중이나 구현 착수 §1–§4 대상 파일(`types.ts`, `cafe24.handler.ts`, `cafe24-mcp-tool-provider.ts`)과 직접 겹치지 않는다. 향후 Phase C(docs audit → resource 파일에 `constraints` row 추가) 착수 시 merge 조율이 필요하며, `cafe24-restricted-scopes-followups.md` §1 AI Agent allowlist UI 는 `cafe24-mcp-tool-provider.ts` 를 간접 소비하므로 constraints 구현 PR merge 이후에 착수할 것을 권장한다. `0-unimplemented-overview.md` 인덱스에 신규 plan 등재가 누락된 경미한 추적 갭이 있다.

## 위험도

LOW
