---
worktree: ai-context-memory-close-bd100e
started: 2026-07-05
owner: project-planner
spec_impact:
  - spec/4-nodes/3-ai/0-common.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/5-system/17-agent-memory.md
  - spec/conventions/conversation-thread.md
---

# spec-draft: ai-context-memory-followup-v2 종결 — pending_plans 정리 + status 승격 + plan 이동

## 배경 (group A 재검증 결론)

exec-intake 후속 이후 group A(near-done) 트랙을 재검증하던 중, `ai-context-memory-followup-v2.md` 의 2개 잔여 `[ ]` 항목이 **이미 main 에 반영됨(stale checkbox)** 을 확인:

- **항목 1** — `node-output.md` Principle 2 `meta.memory` 행 `ai_agent 단독` 정정 + IE echo 안 함 명시 + `ai-agent §7.1` SoT 링크: **현재 `spec/conventions/node-output.md:90` 이 이미 그 상태**("meta.memory? … **ai_agent 전용**. information_extractor … meta.memory 는 echo 하지 않는다(meta.contextInjection 만)" + §7.1 링크).
- **항목 2** — `3-information-extractor.md` watermark `lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq`(I12, 하위호환 폴백 병기): **현재 `:163`·`:694` 가 이미 그 상태**("증분 watermark(`memoryState.lastExtractionTurnSeq` — I12 …; 구 평면 키 폴백)").

→ 두 항목 모두 완료. plan 의 다른 34개 항목도 done. **`ai-context-memory-followup-v2` 는 사실상 완료(stale checkbox)** → spec-impl-evidence §3 종결 흐름 착수.

또한 group D 검증에서 `webchat-widget-refactor.md` 가 완전 완료(주 PR #737 + 후속 #746/#744 전부 MERGED, 헬퍼·split hooks·review 산출물 main 반영)임을 확인 — spec pending_plans 참조 없음(behavior-preserving, spec_impact:[]) → 단순 `complete/` 이동.

## pending_plans 참조 현황 (`ai-context-memory-followup-v2`)

4개 spec frontmatter 가 참조:

| spec | 현 pending_plans | 본 항목 제거 후 | status 조치 |
| --- | --- | --- | --- |
| `4-nodes/3-ai/0-common.md` | [ai-context-memory-followup-v2] | **빈** | partial → **implemented** |
| `4-nodes/3-ai/1-ai-agent.md` | [ai-agent-tool-connection-rewrite, ai-context-memory-followup-v2, exec-park-durable-resume] | 2개 잔존 | **partial 유지** |
| `5-system/17-agent-memory.md` | [ai-context-memory-followup-v2] | **빈** | partial → **implemented** |
| `conventions/conversation-thread.md` | [ai-context-memory-followup-v2, exec-park-durable-resume] | 1개 잔존 | **partial 유지** |

### status 승격 근거 (0-common · 17-agent-memory)

- **17-agent-memory.md**: §7 "v2 로드맵" 이 v2 surface 5건(증분추출·TTL·dedup·분류·가시화 UI)을 **✅ 실현됨(§3·§4·§6 SoT)** 으로 명시. "남은 로드맵" 은 **사용자 식별자 연동** 1건뿐인데, 이는 "최종사용자 식별자 인프라 도입 시" 조건부 **미래 항목**(v1 웹채팅 익명 — Rationale §스코프 키). 활성 plan 없는 명시적 future-roadmap 이므로 **[3-execution §6 breakpoint 로드맵 = frontmatter implemented + 로드맵 표기] 선례**와 동형 → v1/v2-실현 범위는 완결, `implemented` + §7 "남은 로드맵" 표기 유지가 정합.
- **0-common.md**: 자체 미구현 surface 없음(유일한 "로드맵" 언급 `:165` 은 conversation-thread v2 로드맵으로의 **포인터**, 0-common 자신의 미구현 아님). partial 사유가 오직 ai-context-memory-followup-v2 였으므로 제거 시 `implemented`.

> 두 승격은 consistency-check --spec(cross_spec·rationale_continuity)로 검증한다. 미래-로드맵≠partial 판단이 틀리면 BLOCK 으로 포착.

## 변경

1. **`ai-context-memory-followup-v2.md`** — 잔여 2 checkbox `[x]`(각 "이미 main 반영, 2026-07-05 재검증" 근거) + 종결 노트. `git mv` → `plan/complete/`.
2. **`0-common.md`** frontmatter — pending_plans 에서 ai-context 제거(→ 빈) + `status: partial → implemented`.
3. **`17-agent-memory.md`** frontmatter — 동일(→ 빈) + `status: partial → implemented`.
4. **`1-ai-agent.md`** frontmatter — pending_plans 에서 ai-context 제거(2개 잔존) + `status: partial` 유지.
5. **`conversation-thread.md`** frontmatter — pending_plans 에서 ai-context 제거(1개 잔존) + `status: partial` 유지.
6. **`webchat-widget-refactor.md`** — `git mv` → `plan/complete/`(spec 무관, 검증완료). (plan-only 이동을 단독 PR 로 내지 않기 위해 본 종결 PR 에 chore 로 동봉.)
7. **`webchat-widget-refactor.md`** frontmatter `spec_impact` 정정 — `[]`(빈 배열) → `none`. **Gate C 필수**: `spec-plan-completion.test.ts` `hasValidSpecImpact([])=false`(빈 배열=`length>0` 위반) 라 이대로 `complete/` 이동 시 unit fail. behavior-preserving(spec 무변경)이므로 `none` 리터럴이 정답 ([plan-lifecycle §5 line 88](../../.claude/docs/plan-lifecycle.md) 이 정확히 이 함정 처방). `started:2026-06-27`>cutoff(2026-06-04) 라 grandfather 미면제. (consistency-check 12_02_22 convention_compliance CRITICAL 해소.)

## Rationale

- **왜 지금**: group A/D 재검증에서 다수 plan 이 "이미 구현·stale checkbox" 로 드러남 — 백로그가 실제보다 부풀어 보이는 원인. 완료 plan 을 spec-impl-evidence §3 대로 닫으면 실제 잔여 작업이 선명해진다.
- **미래-로드맵 vs partial**: 활성 tracking plan 이 없는 명시적 future-roadmap 항목(17-agent §7 사용자 식별자)은 spec 을 `implemented` 로 두고 로드맵으로 표기하는 것이 기존 선례([`spec/3-workflow-editor/3-execution.md §6`](../../spec/3-workflow-editor/3-execution.md) breakpoint 로드맵 — frontmatter `implemented` + §6 "미구현 로드맵" 표기). "empty pending_plans + partial" 상태가 오히려 부정합.
- **기각 대안**: (a) 4개 spec 모두 partial 유지 — empty pending_plans 인 2건이 근거 없는 partial 로 남아 부정합. (b) plan 만 이동하고 frontmatter 방치 — dangling pending_plans(G1 에서 고친 그 결함) 유발.

## 체크리스트

- [x] /consistency-check --spec (12_02_22) — BLOCK: YES(webchat spec_impact CRITICAL) → 해소(변경 7)
- [x] /consistency-check --spec 재검증(12_09_36) → BLOCK: NO
- [x] spec frontmatter 반영(변경 2·3·4·5) + plan checkbox/이동(변경 1·6·7) + Gate C/lifecycle unit 통과(2 files·545 tests)
- [ ] commit + PR (origin/main)
- [ ] memory
