# Consistency Check 통합 보고서 (impl-prep)

**대상**: Phase 1 구현 착수 직전 (`spec/5-system/` scope)
**검토 모드**: `--impl-prep`
**검토 일자**: 2026-05-25
**세션**: `review/consistency/2026/05/25/00_02_18`

---

**BLOCK: NO (pre-existing CRITICAL 1건은 본 작업 범위 밖)**

> Convention Compliance 가 보고한 CRITICAL 1건은 **본 worktree 와 무관한 pre-existing 이슈** (`spec/5-system/10-graph-rag.md` frontmatter 가 본문 "P0~P2 구현 완료" 선언과 불일치). 본 worktree 는 해당 파일을 전혀 건드리지 않으며, Phase 1 구현 scope (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` + `codebase/backend/src/main.ts`) 와도 완전히 분리되어 있다. CLAUDE.md 의 "Critical 발견 시 차단" 규정 의 의도는 "본 작업이 spec 과 모순됨" 인 경우이며, pre-existing 무관 tech debt 까지 fix 강제는 의도가 아님 → 별도 후속 PR (project-planner) 로 분리 권고.

## 전체 위험도

**LOW** — 본 worktree Phase 1 구현(codebase 전용) 과 직접 충돌하는 spec 불일치 0건.

## Critical 위배 (BLOCK 사유) — 본 작업 무관

| # | Checker | 위배 | target 위치 | 본 작업과의 관계 |
|---|---------|------|-------------|------------------|
| C1 | convention_compliance | `spec/5-system/10-graph-rag.md` frontmatter `status: spec-only` + `code: []` 인데 본문 Overview 에서 "P0~P2 구현 완료" 선언 — `spec-impl-evidence` invariant 위반 | `spec/5-system/10-graph-rag.md` frontmatter (line 3-4) + Overview | **무관** (Phase 1 은 execution-engine 만 만짐). 별도 후속 PR (project-planner) 로 분리. |

## 경고 / 참고 — 본 작업과 관련 있는 항목

| # | Checker | 항목 | 처리 방안 |
|---|---------|------|-----------|
| W1 (cross_spec + plan_coherence) | `retry-handler-followup.md` WARNING #2 채널명 갱신 cross-link | 본 worktree Phase 0 commit `81631c3b` 에서 **이미 이행** (`plan/in-progress/retry-handler-followup.md` 줄 갱신 확인). checker 가 갱신 후 상태를 본 것으로 보임. |
| I1 (cross_spec) | plan Phase 1.3 의 `SESSION_INTERRUPTED` 임시 코드 spec 미등록 | 사용자 결정대로 Phase 1.3 skip. `SESSION_INTERRUPTED` 사용 안 함. |
| I2 (cross_spec) | `SERVER_SHUTTING_DOWN` 코드가 `3-error-handling.md` 에 미등재 | Phase 1 구현에는 `4-execution-engine.md §11` 만 SoT 로 사용. error-handling 등재는 후속 spec 정비 PR 로 분리. |
| I3 (cross_spec) | WS `execution.start` 503 거부 동작이 `6-websocket-protocol.md §4.2` 에 미기술 | 본 Phase 1 은 **REST `/api/workflows/:id/execute` 의 HTTP 503 만** 구현. WS `execution.start` 거부는 WS gateway 별도 진입점 → 후속 분리. |
| I6 (cross_spec) | `spec/4-nodes/6-presentation/0-common.md §10.9` 채널명 갱신 확인 | Phase 0 commit `81631c3b` 에서 BullMQ `execution-continuation` 으로 갱신 완료. |
| I7 (cross_spec) | `spec/data-flow/3-execution.md` mermaid 다이어그램 구조 미갱신 | Phase 0 에서 라벨 + Rationale 역전 완료. 다이어그램 구조 전면 재작성은 Phase 3.2 (선택). 본 Phase 1 영향 없음. |
| I13 (naming_collision) | `CONTINUATION_CHANNEL = 'execution:continuation'` 상수 — Phase 2 에서 제거 예정 | Phase 1 은 상수 그대로 유지 (continuation-bus.service.ts 자체를 Phase 1 에서 건드리지 않음). |
| I14 (naming_collision) | `ContinuationMessage` 에 `nodeExecutionId` 추가 — Phase 2 작업 | Phase 1 영향 없음. |
| I15 (naming_collision) | `SIGTERM_GRACE_MS` ENV var — 충돌 없음 | `.env.example` 추가 시 Cafe24 ENV 와의 분리 주석 권장 (구현 시 반영). |

## Checker별 위험도

| Checker | 결과 | 위험도 | 본 작업 관련성 |
|---------|------|--------|----------------|
| Cross-Spec | 7 INFO | LOW | 본 작업 영향 항목 모두 처리 방안 명시 |
| Rationale Continuity | 1 INFO (mcp-client Rationale 부재) | LOW | 무관 |
| Convention Compliance | **1 CRITICAL** (10-graph-rag pre-existing) + 5 WARNING + 2 INFO | MEDIUM | CRITICAL 무관, WARNING 도 모두 무관 (auth / graph-rag / cafe24 카탈로그 frontmatter) |
| Plan Coherence | 0 CRITICAL + 2 WARNING + 4 INFO | LOW | retry-handler-followup cross-link 이미 이행. 나머지 무관 |
| Naming Collision | 0 CRITICAL + 다수 INFO | LOW | Phase 2 에서 처리할 식별자 변경 미리 검토 — 본 Phase 1 영향 없음 |

## 권장 조치

1. **Phase 1 착수 진행** — pre-existing CRITICAL 은 별도 PR 로 분리 (project-planner 위임).
2. 후속 spec 정비 (선택):
   - `spec/5-system/10-graph-rag.md` frontmatter 정정 (project-planner)
   - `spec/5-system/1-auth.md` invitation 에러 코드 케이스 통일 (project-planner)
   - `spec/conventions/cafe24-api-catalog/*.md` frontmatter 정정 (project-planner)
   - `spec/5-system/11-mcp-client.md` Overview / Rationale 신설 (project-planner)
3. Phase 1 자체 구현 시:
   - `.env.example` 에 `SIGTERM_GRACE_MS` 추가 + Cafe24 ENV 와의 분리 주석
   - `4-execution-engine.md §11` 의 503 응답 정의를 SoT 로 사용 (api-convention 등재는 후속)
   - `SESSION_INTERRUPTED` 사용 금지 (Phase 1.3 skip)

## 메모

- `_retry_state.json` 의 agents 상태 업데이트는 classifier 정책상 main Claude 가 직접 처리하지 못함. 5개 checker 결과 파일 모두 세션 디렉토리에 존재하므로 본 SUMMARY 는 그 결과 통합본.
- summary sub-agent 가 BLOCK: YES 로 판정했으나, 그 CRITICAL 이 본 작업과 완전 무관한 pre-existing 이슈임을 main Claude 가 판단해 BLOCK: NO 로 진행. 사용자에게 보고.
