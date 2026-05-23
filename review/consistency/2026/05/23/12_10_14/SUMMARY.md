# Consistency Check 통합 보고서 (`--impl-prep spec/4-nodes/`)

**BLOCK: NO** — 본 worktree 작업(`ai-agent-render-button-user-message`)을 차단할 사유 없음.

---

## 전체 위험도

**LOW** — 본 작업 한정 위험. 5개 checker 의 WARNING 6건 중 본 작업 무관 (pre-existing drift / stale plan false positive) 이 모두이며, 본 작업 직접 발견사항은 INFO 수준만 존재.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING) — 본 작업 무관 (해소 또는 별 plan 추적 중)

| # | Checker | 발견 | 본 작업 영향 | 비고 |
|---|---------|------|------------|------|
| 1 | cross_spec | `spec/4-nodes/0-overview.md §2.6` Presentation 출력 포트 표기 (`1 (out) 또는 N`) 가 `presentation/0-common.md §2` (버튼 설정 시 `out` 제거) 와 불일치 | 없음 | Pre-existing drift. 본 작업과 별도 정비 사이클 권장. |
| 2 | cross_spec | `ai-presentation-tools.md §4.1` 의 미완료 spec 갱신 (`conversation-thread.md` / `websocket-protocol.md` / `external-interaction-api.md §6.5` / `node-output.md §4.5`) | 없음 | 본 작업이 건드리는 ButtonDef·`userMessage` 와 직교. 해당 4개 spec 파일과 본 작업 변경은 무관. |
| 3 | convention_compliance | `10-parallel.md §5.2` `count` 필드 제거 vs `node-output.md` Principle 9.2 충돌 | 없음 | 이미 `plan/in-progress/spec-drift-parallel-count.md` 가 추적 중 (PR #279 잔여). |
| 4 | convention_compliance | `12-background.md §5.1` `meta.durationMs` 출처 표기 불일치 | 없음 | Pre-existing. Background 노드 본문 정비 시 처리. |
| 5 | convention_compliance | `ai-agent.md §1` 의 `[Presentation 공통 §10.1~§10.3]` cross-ref 누락 의심 | **없음 — false positive** | 본 worktree 의 `0-common.md` 에 §10.1~§10.8 실재 (line 257~358 확인). Checker 의 stale 분석. |
| 6 | plan_coherence | `ai-presentation-tools-9b7c5c` worktree 와 동일 파일 (3종) 동시 편집 경합 | **없음 — false positive** | PR #269 (`bf16a3e7`) 머지 완료 (2026-05-22). `render-tool-provider.ts` 는 이미 main 에 존재. `ai-presentation-tools.md` plan 파일이 in-progress 잔존 중인 stale state. 해당 plan 의 잔여 spec 갱신 항목은 본 작업과 직교. |

> Pre-existing drift / stale plan / false positive — 본 worktree 작업 진행 차단 사유 아님. 동시 편집 경합으로 보고된 3 파일 (`0-common.md`, `ai-agent.md`, `render-tool-provider.ts`) 은 모두 main HEAD 기준으로 충돌 없이 본 worktree 에서 수정 가능 (PR #279 머지 후 main 동기화 완료 상태).

---

## 참고 (INFO) — 본 작업 직접 발견사항

| # | Checker | 발견 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `1-data-model.md §2.6 Node.category` Enum 에 `trigger` 누락 (vs `0-overview.md §1.2`) | spec/1-data-model.md | 본 작업 무관, 별 정비 권장 |
| 2 | cross_spec | `container_id` 제약 주석에 "Background는 도입 시 추가" 미완 표현 잔존 | spec/1-data-model.md §2.6 | 본 작업 무관 |
| 3 | cross_spec | `interaction_data.interactionType` enum 과 WS event `interactionType` (`"buttons"` / `"ai_form_render"`) layer 분리 명문화 | spec/1-data-model.md §2.14 | 본 작업 무관 |
| 4 | cross_spec | `12-background.md §8.5` payload `status` 에 `cancelled` 포함 vs §8.2 4값 명시 자기모순 | spec/4-nodes/1-logic/12-background.md | 본 작업 무관 |
| 5 | cross_spec | `1-logic/0-common.md §9.1` Loop `시작 시점 output` 컬럼이 `(없음)` — `output: null` 명시 권장 | spec/4-nodes/1-logic/0-common.md | 본 작업 무관 |
| 6 | rationale_continuity | `ai-agent.md §12.4` Rationale 안 (D) "그래프 포트 분기 흉내 기각" 과 `userMessage` (텍스트 내용 제어) 의 직교성 명시 권장 | spec/4-nodes/3-ai/1-ai-agent.md §12.4 | (선택) `userMessage` 가 안 (D) 의 라우팅 모방이 아님을 §12.4 Rationale 에서 역참조 한 줄 — 구현 단계에서 함께 추가 가능 |
| 7 | rationale_continuity | `§10.5 step 3 backfillButtonUuids` 설명에 "`userMessage` 는 backfill 대상 아님 (§Rationale 참조)" 한 줄 추가 권장 | spec/4-nodes/6-presentation/0-common.md §10.5 step 3 | (선택) Rationale 가 이미 명시했으나, step 3 본문에도 한 줄 보강하면 구현자 혼동 추가 차단 |
| 8 | rationale_continuity | `link` 타입의 `userMessage` 무시 처리 — 기존 §2 / §3 의 "link = 외부 URL 이동 우선" 원칙과 정합 | spec/4-nodes/6-presentation/0-common.md §1.1 | 현상 유지 — 정합 |
| 9 | naming_collision | `ButtonDef.userMessage` — codebase `presentation/_shared/button.types.ts` ButtonDef 인터페이스에 필드 미존재 (구현 단계에서 추가 필요) | codebase/backend/src/nodes/presentation/_shared/button.types.ts | 구현 단계 (TDD) 에서 처리 — `userMessage?: string` 추가 |
| 10 | naming_collision | `userMessage` 가 backend `processMultiTurnMessage(userMessage: string, ...)` 파라미터명·frontend 지역 변수와 동명이지만 layer 다름 (data field vs parameter) | (다층) | 현상 유지 — spec §10.8 가 `ButtonDef.userMessage` 의미·범위 명문 |
| 11 | naming_collision | `findButtonContext` — 기존 `findButtonLabel` 함수 (line 37 of `assistant-presentations-block.tsx`) 를 spec 명시대로 교체 필요 | codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx | 구현 단계 (TDD) 에서 처리 — `findButtonContext` 로 rename + 반환 타입 확장 |
| 12 | naming_collision | `backfillButtonUuids` — spec 명·codebase 명 완전 정합 (PR #279 commit `8f9d857f`) | render-tool-provider.ts | 이상 없음 |
| 13 | naming_collision | `§10.8 anchor` (`#108-render_-클릭-user-message-합성`) 와 `ai-agent.md §4.1` cross-ref 정합 | (양쪽 모두 갱신 완료) | 이상 없음 |

---

## Checker 별 위험도

| Checker | 위험도 | 본 작업 영향 |
|---------|--------|------------|
| cross_spec | MEDIUM (전체) | NONE (본 작업 직접 발견 없음 — 모두 pre-existing drift) |
| rationale_continuity | LOW (전체) | LOW (INFO 3건 — 모두 가독성 개선 제안, 차단 없음) |
| convention_compliance | MEDIUM (전체) | NONE (본 작업 발견은 false positive — §10 sections 실재 확인) |
| plan_coherence | MEDIUM (전체) | NONE (3 WARNING 모두 stale plan false positive — main 머지 상태 검증 완료) |
| naming_collision | NONE | INFO — 구현 단계에서 처리할 알려진 항목 (`userMessage?: string` 필드 추가, `findButtonContext` rename) |

---

## 실제 구현 진행 시 처리할 INFO 항목 (TDD 체크리스트에 통합)

1. `codebase/backend/src/nodes/presentation/_shared/button.types.ts` 의 `ButtonDef` 인터페이스에 `userMessage?: string` 추가 (naming_collision #1)
2. `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 의 button zod schema 에 `userMessage: z.string().optional()` 추가 (이미 plan §변경 범위 (C) 에 포함)
3. `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` 의 `findButtonLabel` → `findButtonContext` rename + 반환 타입 확장 (이미 plan §변경 범위 (A) 에 포함)
4. (선택) `spec/4-nodes/3-ai/1-ai-agent.md §12.4` Rationale 에 `userMessage` 와 (D) 기각 결정의 직교성 한 줄 (rationale_continuity #6)
5. (선택) `spec/4-nodes/6-presentation/0-common.md §10.5 step 3` 에 `userMessage` 가 backfill 대상 아님 한 줄 (rationale_continuity #7)

**검토 메타**

- 모드: 구현 착수 전 (`--impl-prep`)
- 대상: `spec/4-nodes/`
- 세션: `/Volumes/project/private/clemvion/.claude/worktrees/ai-agent-render-button-user-message-521f33/review/consistency/2026/05/23/12_10_14/`
- Checker 5건 모두 success
- BLOCK 결정: NO
- ISSUES: WARNING 6 (모두 pre-existing 또는 false positive), INFO 13 (본 작업 직접 5, 무관 8)
