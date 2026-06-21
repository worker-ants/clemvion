# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 위배는 WARNING 또는 INFO 수준.

## 전체 위험도
**LOW** — spec frontmatter `code:` 에 M-1 1/2단계 신설 파일 2개 미등재(이미 plan backlog 인지). 기능 계약·API 계약·상태 전이 위반 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts` 미등재 (`spec-impl-evidence.md §2.1`) | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 배열 | `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (M-1 2단계 신설) | `project-planner` 가 `code:` 에 해당 경로 추가 (비차단 backlog) |
| 2 | Convention Compliance | `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 미등재 (`spec-impl-evidence.md §2.1`) | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 배열 | `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (M-1 1단계 신설, commit `24ca3340`) | `project-planner` 가 `code:` 에 해당 경로 추가 (비차단 backlog) |

> 두 WARNING 은 동일 위치(`1-ai-agent.md` frontmatter `code:`)의 누락으로 통합 가능. Cross-Spec / Plan Coherence 도 같은 사항을 INFO 로 지적했으며, Convention Compliance 의 WARNING 이 가장 강한 등급. 실질 invariant 파괴 없음 — `spec-code-paths.test.ts` glob 매칭 통과 중, CI 차단 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | spec `§6.1` 구현 주체 표기 drift — 단계 1.3/1.5/2.7 가 핸들러 책임으로 기술되나 실제 구현은 `AiMemoryManager` | `spec/4-nodes/3-ai/1-ai-agent.md §6.1` | 비차단. 필요 시 `(AiMemoryManager 위임)` 주석 추가 |
| 2 | Cross-Spec | IE 핸들러 `injectPersistentMemory` 와 `AiMemoryManager` 유사 로직 중복 — `02-architecture §M-1` Option B 의도적 미채택 결과 | `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` lines 271–355 | M-1 3단계 또는 별도 리팩터에서 `ai/shared/` 승격 재평가 |
| 3 | Rationale Continuity | `injectMemoryContext` 이중 thread 조회 (`getThreadExcludingNode` + `getThread`) — I/O-backed 전환 시 비용 두 배 가능 | `ai-memory-manager.ts` lines 150–153, 275–281 | `ai-context-memory-followup-v2.md` 백로그에 이미 추적 중. 현재 비차단 |
| 4 | Rationale Continuity | `contextInjectionMode` 읽기 위치 — `manual` 전략 경계 확인 후 spec §1 정합 확인됨 | `ai-memory-manager.ts` line 290 | 비차단. 코드 주석 추가로 의도 명료화 가능 |
| 5 | Rationale Continuity | `scheduleMemoryExtraction` — `extractionModelConfigId` 미직접 처리, `sharedScheduleMemoryExtraction` 위임 (processor 경로에서 처리) | `ai-memory-manager.ts` lines 370–401 | 현행 유지 가능. processor 경로 단위 테스트로 검증 |
| 6 | Plan Coherence | M-1 1단계 spec DRIFT 비차단 후속 미반영 — `ai-condition-evaluator.ts` frontmatter 등재 + §6.1 step 3a 참조 갱신 | `spec/4-nodes/3-ai/1-ai-agent.md` | `02-architecture.md §M-1 planner 후속` 항목 처리로 해소 |
| 7 | Plan Coherence | `ai-context-memory-followup-v2.md` 76번 항목 미체크 — `compactedMessages?` 가 실제 spec 에 이미 반영됨 | `plan/in-progress/ai-context-memory-followup-v2.md` line 76 | 해당 항목을 `[x]` 로 갱신해 plan 상태 동기화 |
| 8 | Convention Compliance | `0-common.md` frontmatter `id: common` — basename `0-common` 과 불일치 (강제 규칙 아님) | `spec/4-nodes/3-ai/0-common.md` | 현행 유지 가능. 타 영역 동명 충돌 시 `id: ai-common` 변경 고려 |
| 9 | Convention Compliance | `_product-overview.md` `## Rationale` 섹션 없음 — PRD 성격 문서, 강제 규칙 아님 | `spec/4-nodes/3-ai/_product-overview.md` | 현행 유지 가능 |
| 10 | Convention Compliance | `0-common.md §5` `output.error.details?` 표기 — LLM 노드 `details.retryable` 필수 명시 누락 (Principle 3.2.1) | `spec/4-nodes/3-ai/0-common.md §5` | `"LLM 계열 노드는 details.retryable: boolean 필수"` 인라인 주석 추가 권장 |
| 11 | Naming Collision | 신규 식별자 충돌 없음 — `AiMemoryManager` 동명 중복 없음, spec 변경분 전량 제거(이메일 변경 흐름 폐기) | — | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec `code:` 2건 누락 (INFO), IE 유사 로직 중복 (INFO, 의도적 설계) |
| Rationale Continuity | NONE | 핵심 invariant 전체 보존 확인. 이중 thread 조회 등 3건 INFO |
| Convention Compliance | LOW | `ai-memory-manager.ts` / `ai-condition-evaluator.ts` frontmatter 미등재 (WARNING 2건) |
| Plan Coherence | LOW | 비차단 planner 후속 미반영 (INFO), plan 체크박스 불일치 (INFO) |
| Naming Collision | NONE | 신규 식별자 충돌 전무 |

## 권장 조치사항

1. **(WARNING 해소, 비차단 — project-planner 위임)** `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 아래 두 경로 추가:
   - `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`
   - `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
   — `02-architecture.md §M-1 planner 후속` 항목과 함께 처리 가능.

2. **(INFO — plan 동기화)** `plan/in-progress/ai-context-memory-followup-v2.md` 76번 항목(`compactedMessages?`)을 `[x]` 로 갱신.

3. **(INFO — 선택)** `ai-memory-manager.ts` line 336 근방에 `contextInjectionMode` 의도 주석 추가 (spec §1 자동 전략 전용 명시).

4. **(INFO — 선택)** `0-common.md §5` `output.error` 표에 LLM 계열 노드 `details.retryable` 필수 인라인 주석 추가.

5. **(중기 백로그)** M-1 3단계 또는 별도 리팩터에서 IE 핸들러 `injectPersistentMemory` 와 `AiMemoryManager` 유사 로직 통합 가능성(`ai/shared/` 승격) 재평가.