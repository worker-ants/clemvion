# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — WARNING 1건(spec `console.warn` 명문 vs Logger 교체 삼중 불일치), INFO 다수(추적성·순서 불변식 명기 권장). Critical 없음.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `processMultiTurnMessage` c.fallback 경로: spec `1-ai-agent.md §6.2 c.fallback` 이 `console.warn(...)` 을 명문화, 현 구현은 이미 `AiTurnExecutor.logger.warn(...)` 으로 교체되어 있고 plan m-1 도 Logger 교체를 요구 — C-2 분해로 private helper 추출 후 JSDoc 에 spec 단계번호를 명기하면 삼중 불일치(spec 원문 / 현 구현 / m-1 규약)가 주석에 노출됨 | `ai-turn-executor.ts` c.fallback 경로 (약 :1957) | `spec/4-nodes/3-ai/1-ai-agent.md §6.2 c.fallback` + plan `03-maintainability.md §m-1` | 착수 전 planner 에 `spec §6.2 c.fallback` console.warn → Logger.warn 정정 위임을 선행 완료하거나, 추출 helper JSDoc 에 "spec 원문은 console.warn 이나 m-1 Logger 교체 선반영" 을 명시해 불일치 의도를 투명하게 기록 |

> W-1 은 rationale_continuity(INFO) + convention_compliance(WARNING) 양쪽에서 동일 불일치를 지적. convention_compliance 의 WARNING 등급으로 통합.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Rationale Continuity | `classifyTurnResult` 메서드명 — spec 에 명칭 언급 없음, 추적성 명기 필요 | `03-maintainability.md §C-2 개선방안 1` | JSDoc 에 `@see spec §6.2 단계 3판정 (condition-route · user_ended · max_turns)` 명기 |
| I-2 | Rationale Continuity | `executeToolBatch` — `executeProviderToolBatch` 와 accumulator 소유권 및 역할 경계 불명확 | `ai-turn-executor.ts` (기존 `:794`) | accumulator 파라미터를 caller scope 에서 명시 주입, JSDoc 에 `§6.1 단계 3.f Promise.all 병렬 실행` 명기 |
| I-3 | Rationale Continuity | `ai_user` push 시점 불변식 — 분리 후 LLM 호출 전 위치 확인 필요 | `processMultiTurnMessage` 분해 결과 | JSDoc 에 "호출 순서 불변: ai_user push → LLM call (§6.2.c, conversation-thread §1.4)" 명기 |
| I-4 | Rationale Continuity | `handleTurnCompletion` checkpoint 영속 순서 불변식 미명시 | `handleTurnCompletion` 추출 예정 메서드 | JSDoc 에 `§6.2 d checkpoint 영속` + `ai_assistant push 직후 (spec §1.4)` 두 단계번호 명기 |
| I-5 | Naming Collision | `executeToolBatch` vs `executeProviderToolBatch` 역할 경계 혼동 위험 | `AiTurnExecutor` 내부 | (a) `executeProviderToolBatch` 를 `executeToolBatch` 로 리네임해 통합, 또는 (b) 신규 메서드를 `executeMultiTurnToolBatch` 로 명명해 구분 |
| I-6 | Naming Collision | `classifyTurnResult` 가 동일 패키지의 `classifyToolCalls`·`classifyLlmError` 와 `classify*` prefix 공유 | `AiTurnExecutor` + `AiConditionEvaluator` + `AiTurnOrchestratorService` | 대안 명칭: `determineTurnOutcome` / `resolveTurnCompletion`. 유지 시 JSDoc 에 "classifyToolCalls·classifyLlmError 와 별개" 명기 |
| I-7 | Plan Coherence | `03-maintainability.md` C-2 항목 설명이 `ai-agent.handler.ts` 기준(M-1 이전 상태)을 가리켜 실제 작업 파일 `ai-turn-executor.ts` 와 불일치 | `plan/in-progress/refactor/03-maintainability.md §C-2` | 착수 시 `[ ] 미착수` → `[~] 진행중`, 대상 파일을 `ai-turn-executor.ts` 로 정정 |
| I-8 | Plan Coherence | 1차 슬라이스(setup, PR #697)가 plan 문서 어디에도 기록되지 않음 | `03-maintainability.md`, `README.md` | PR #697 완료 내용을 C-2 하위 기록, README.md P2 #16 상태 갱신 |
| I-9 | Convention Compliance | 분해 메서드 명명(camelCase private) — 규약 위반 없음 확인 | — | 변경 불요 |
| I-10 | Convention Compliance | method JSDoc 에 §6.1/§6.2 단계번호 명기 — spec-impl-evidence 추적성 패턴과 정합 | — | 변경 불요 (이미 plan 에 명시됨) |
| I-11 | Convention Compliance | 클러스터 plan 문서 frontmatter 면제 — 규약 적용 범위 밖 | `plan/in-progress/refactor/03-maintainability.md` | 변경 불요 |
| I-12 | Convention Compliance | "spec 변경 불요" 선언 — `spec-impl-evidence.md §3` 라이프사이클과 정합 | — | 변경 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 신규 엔티티·API·요구사항 ID·상태 전이·RBAC·계층 책임 충돌 없음. 순수 behavior-preserving 분해 |
| Rationale Continuity | LOW | m-1 console.warn / C-2 분해 작업 순서 간섭 위험(INFO), 분리 후 ordering 불변식·checkpoint 순서 추적성 명기 권장(INFO 4건) |
| Convention Compliance | LOW | console.warn 명문 vs Logger.warn 삼중 불일치(WARNING 1건), 나머지 4건 INFO(이상 없음 확인) |
| Plan Coherence | NONE | C-2 항목 설명·1차 슬라이스 기록 미반영(INFO 2건). 차단 사안 없음 |
| Naming Collision | NONE | `executeToolBatch` vs `executeProviderToolBatch` 역할 경계 불명확, `classify*` prefix 공유(INFO 2건). 동일 이름 충돌 없음 |

## 권장 조치사항

1. **(WARNING W-1 해소 — 구현 착수 전 권장)** planner 에게 `spec/4-nodes/3-ai/1-ai-agent.md §6.2 c.fallback` 의 `console.warn` 명문을 `Logger.warn` 으로 정정 위임. 선행이 불가한 경우 추출 helper JSDoc 에 불일치 의도를 명문화해 기록.
2. **(I-2, I-5 — 착수 시 설계 결정)** `executeToolBatch` / `executeProviderToolBatch` 통합 방향을 plan 에 명시: 리네임 통합(a) 또는 신규 메서드 `executeMultiTurnToolBatch`(b) 중 선택.
3. **(I-3, I-4 — 구현 중 자기 문서화)** `buildTurnMessages` / `handleTurnCompletion` JSDoc 에 ai_user push → LLM call 순서 불변식, ai_assistant push → checkpoint 영속 → park 순서를 spec 섹션 번호와 함께 명기.
4. **(I-7, I-8 — 착수 시 plan 갱신)** `03-maintainability.md` C-2 항목을 진행중으로 변경하고 대상 파일을 `ai-turn-executor.ts` 로 정정. PR #697 완료 내역을 기록.
5. **(I-1, I-6 — 선택적 보완)** `classifyTurnResult` JSDoc 에 `§6.2 단계 3판정` 및 인접 classify* 메서드와의 역할 구분 명기.