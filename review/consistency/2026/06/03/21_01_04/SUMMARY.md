# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 13건은 Phase A spec 개정 시 해소 필요.

## 전체 위험도
**MEDIUM** — 기존 spec 과의 직접 모순은 없으나, `spec-impl-evidence` build-time 가드 실패 위험 및 Rationale 누락 3건이 Phase A 이전 해소 권장.

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `memoryStrategy` 도입 시 기존 Conversation Context 5 필드(`contextScope` 등)의 유효/무효 조건이 `0-common.md §10`, `1-ai-agent.md §1` 에 미반영 | §2 `memoryStrategy` 필드 + visibleWhen | `spec/4-nodes/3-ai/0-common.md §10`, `spec/4-nodes/3-ai/1-ai-agent.md §1` | Phase A에서 두 문서를 갱신해 `memoryStrategy ≠ manual` 시 5개 필드 유효/무효 조건을 명시 |
| 2 | Cross-Spec | `ConversationThread.runningSummary?` 영속화 경로가 기존 "v1 신규 DB 컬럼 없음" 조항과 잠재 충돌 | §3 conversation-thread.md §1.3 갱신 항목 | `spec/conventions/conversation-thread.md §4` | Phase A에서 §4를 갱신해 `runningSummary` 가 Redis `ExecutionContext` 직렬화에 포함되는지, restart 후 rehydration 경로를 명시 |
| 3 | Cross-Spec | `conversation-thread.md §7` "Token-aware cap" v2 로드맵 항목과 target `summary_buffer` 가 다른 메커니즘임에도 "실현"으로 기술해 의미 충돌 | §1.1 트리거 근거 | `spec/conventions/conversation-thread.md §7` | Phase A에서 §7 항목을 "token-budget 방식으로 부분 실현; tokenizer-exact 방식은 여전히 v3 로드맵" 으로 정밀 표기 |
| 4 | Cross-Spec | `agent_memory` 엔티티가 `spec/1-data-model.md §1` 엔티티 관계도 및 §3 인덱스 전략 표에 부재 | §1.5, §3 | `spec/1-data-model.md §1` 관계도, §3 인덱스 표 | Phase A에서 `AgentMemory (1:N)` 을 Workspace 하위에 추가하고, `(workspace_id, scope_key)` 인덱스 기술 |
| 5 | Cross-Spec | `ND-AG-*` 신규 채번 시 기존 `ND-AG-01`~`ND-AG-26` 중복 위험, 두 `_product-overview.md` 동기화 누락 가능 | §3 요구사항 ID | `_product-overview.md` ×2 | `ND-AG-27` 이후로 채번하고 두 파일 동시 갱신 |
| 6 | Rationale Continuity | §7 v2 유보 결정 번복 근거가 plan 에만 있고 spec Rationale 에 없음 | §1.1 + §2 | `conversation-thread.md §7`, `1-ai-agent.md §12.1` | §7 갱신 + `1-ai-agent.md §12` Rationale 신규 항 |
| 7 | Rationale Continuity | `memoryStrategy` 별도 필드 도입 이유(contextScope enum 확장 기각)가 plan 에만 서술 | §2 | `1-ai-agent.md §1`, `conversation-thread.md §5.1` | `1-ai-agent.md §12` 에 enum 확장 기각 근거 Rationale 항 |
| 8 | Rationale Continuity | 요약 블록 "system_text 안정 프리픽스" 배치가 ordering SoT(`0-common.md §11.4`)와의 관계 미명시 | §2 | `0-common.md §11.4`, `conversation-thread.md §5.2` | `0-common.md §11.4` ordering 표 갱신 + Rationale 추가 |
| 9 | Convention Compliance | Phase A DoD 에 `status: implemented`→`partial` 전환 + `pending_plans` 등록 미포함 — `spec-status-lifecycle.test.ts` 실패 위험 | §3, §4 | `spec-impl-evidence.md §3.1` | Phase A 항목에 frontmatter 전환 스텝 명시 |
| 10 | Convention Compliance | 신규 `agent-memory.md` frontmatter 의무(`id`, `status: spec-only`, `code: []`) 미명시 — `spec-frontmatter.test.ts` 실패 위험 | §3, §5 | `spec-impl-evidence.md §1·§2·§5.1` | Phase A 항목에 신규 파일 frontmatter 스텝 명시 |
| 11 | Plan Coherence | `ai-agent-tool-connection-rewrite` 의 conversation-thread v2 의존 항목 해소 여부 불명확 | §1.1 / §3 | `plan/in-progress/ai-agent-tool-connection-rewrite.md` | Phase A 완료 시 해당 plan 의존성 항목 업데이트 |
| 12 | Plan Coherence | §5.3 char-cap 의 `manual` 유지 여부 및 token-budget vs tokenizer-exact 구분 미명시 | §1.1 | `conversation-thread.md §5.3`, §7 | §5.3 에 manual char-cap 유지 명시, §7 정밀 표기 |
| 13 | Plan Coherence | `ai-review-backlog-seq-counter` PR 2/3 착수 시 `ai-agent.handler.ts` Phase E 경합 가능 | §4 Phase E | `plan/in-progress/ai-review-backlog-seq-counter.md` | Phase E 착수 전 상태 확인, 직렬화 순서 주석 |

---

## 참고 (INFO) — 채택 결정 메모

주요 INFO 채택:
- **#3/#8/#14**: 신규 파일 = `spec/5-system/17-agent-memory.md` (다음 가용 번호 17). `spec/0-overview.md §8` 표 등재.
- **#13**: 요구사항 ID 패턴을 `SYS-MEM-*` → **`AGM-*`** (단층 도메인 약어) 로 변경 채택.
- **#11**: `memoryStrategy: 'manual'` 단어가 `Trigger.type: 'manual'` 과 겹치나 namespace 가 달라 의미 명료성 우선 — **`manual` 유지**.
- **#9**: 요약 LLM 콜 모델은 **v1 노드 `model`/`llmConfigId` 재사용** 으로 scope-freeze.
- **#1/#10**: `memoryTopK`/`memoryThreshold` 와 `ragTopK`/`ragThreshold` 독립성 주석 추가.
- **#2/#4**: persistent 비동기 추출은 `scheduleBackgroundBody` turns snapshot 격리 invariant 준수 + 큐 분리 여부를 `17-agent-memory.md` 에 명시.

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `memoryStrategy` ↔ 기존 5필드 상호작용 미반영, `runningSummary` 영속화 조항 잠재 충돌, `agent_memory` 관계도 부재 |
| Rationale Continuity | MEDIUM | v2 번복 근거 spec 미기록, 별도 필드 근거 미기록, ordering SoT 암묵 변경 |
| Convention Compliance | MEDIUM | `spec-status-lifecycle`/`spec-frontmatter` build-time 가드 실패 위험 (DoD frontmatter 스텝 누락) |
| Plan Coherence | LOW | worktree 경합 없음; v2 의존 plan 정합 확인 필요 |
| Naming Collision | LOW | 직접 충돌 없음; `manual` 단어 중복·`SYS-MEM-*` 패턴 주의 |

---

## 권장 조치 → Phase A DoD 로 흡수

1. 갱신 spec 파일 frontmatter `status: partial` + `pending_plans` 전환, 신규 파일 `status: spec-only` 초기화.
2. `0-common.md §10` + `1-ai-agent.md §1`: `memoryStrategy ≠ manual` 시 기존 5필드 유효/무효 조건 명시.
3. `conversation-thread.md §4`: `runningSummary` Redis 직렬화/rehydration 경로 명시.
4. `conversation-thread.md §7`/§5.3: token-budget 부분 실현 정밀 표기, manual char-cap 유지.
5. `1-data-model.md §1`/§3: `AgentMemory` 관계도 + `(workspace_id, scope_key)` 인덱스.
6. `1-ai-agent.md §12` Rationale: (a) 별도 필드 근거, (b) v1/v2 번복 근거, (c) ordering 관계. `0-common.md §11.4` ordering 갱신.
7. 채번: `ND-AG-27`~ + `AGM-*`, 파일 `17-agent-memory.md`, `0-overview.md §8` 등재.
8. Phase A 완료 후 `ai-agent-tool-connection-rewrite.md` 의존성 항목 업데이트.
9. Phase E 착수 전 `ai-review-backlog-seq-counter` PR 2/3 경합 확인.
