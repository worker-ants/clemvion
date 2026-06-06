# Convention Compliance Review — `plan/in-progress/spec-draft-rag-dynamic-cut.md`

검토 모드: `--spec` (spec draft)
검토 대상: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/plan/in-progress/spec-draft-rag-dynamic-cut.md`
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] plan frontmatter 에 `spec_impact` 필드 없음
- target 위치: 파일 최상단 frontmatter (lines 1-5)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` / `§5 Gate C` — `started ≥ 2026-06-04` 인 plan 이 `complete/` 로 이동 시 `spec_impact` 선언 필수. `spec/conventions/spec-impl-evidence.md §4.2` 도 동일 강제.
- 상세: 현재 frontmatter 에 `worktree`/`started`/`owner` 3필드만 존재하고 `spec_impact` 가 없다. `started: 2026-06-06` 이므로 Gate C cutoff(`2026-06-04`) 이후 plan 이다. 완료(`complete/` 이동) 시점에 `spec-plan-completion.test.ts` 가 해당 필드를 검증한다. **현재 in-progress 단계에서는 의무가 아님** — 완료 이동 전에 추가하면 충족된다. 사전 확인 차원에서 INFO 로 기록.
- 제안: plan 을 `complete/` 로 이동하기 직전에 `spec_impact:` 필드를 추가할 것. 예: `spec_impact:\n  - spec/5-system/9-rag-search.md\n  - spec/4-nodes/3-ai/1-ai-agent.md\n  - spec/4-nodes/3-ai/0-common.md\n  - spec/5-system/17-agent-memory.md\n  - spec/5-system/10-graph-rag.md`

---

### [INFO] 문서 구조 — 3섹션(Overview/본문/Rationale) 패턴 미적용
- target 위치: 파일 전체 구조
- 위반 규약: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`". spec draft 를 담는 plan 문서 자체는 spec 이 아니므로 직접 의무는 아니나, "## Rationale (draft 자체)" 섹션이 spec 편집 지침과 draft 자체의 설계 근거를 혼합하고 있다.
- 상세: `## Rationale (draft 자체)` 가 존재하고 내용도 충실하다. 이는 spec draft plan 의 구조로 정형화된 패턴이 없어 문제가 되지는 않는다. 단지 섹션 제목 `## Rationale (draft 자체)` 와 달리 그 밑 `## 갱신 — …` 섹션이 선행 검토 반영 내역을 담고 있어 두 구역 모두 Rationale 성격을 공유한다. 순서·제목만의 일관성 제안.
- 제안: 이후 동종 spec draft plan 에서도 동일 구조를 유지하면 충분. 현 문서는 변경 불필요.

---

### [INFO] `pending_plans` 경로 참조가 이 draft 파일이 아닌 `rag-dynamic-cut.md` 를 가리킴 — 이미 §A1/W1 에서 자가 해소
- target 위치: §A1 (line 23), §갱신 W1 (line 125)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans:` 는 `plan/in-progress/<name>.md` 실존 파일 경로여야 함
- 상세: draft 스스로 "(W1) pending_plans 경로: §A1 은 실존 파일 `plan/in-progress/rag-dynamic-cut.md` 를 가리킨다" 고 확인. 해당 파일은 실존한다(`/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/plan/in-progress/rag-dynamic-cut.md` 확인). 따라서 실제 spec 편집 시 올바른 경로가 사용될 것이다. 이 항목은 이미 자가 해소된 상태다.
- 제안: 실제 spec 편집(`spec/5-system/9-rag-search.md` frontmatter 수정) 시 `plan/in-progress/rag-dynamic-cut.md` 경로를 추가하면 `spec-pending-plan-existence.test.ts` 통과.

---

## 준수 항목 (이상 없음)

1. **plan frontmatter 필수 3필드 충족**: `worktree: rag-dynamic-cut-12fac1` / `started: 2026-06-06` / `owner: project-planner` — `plan-frontmatter.test.ts` 기준 통과.
2. **파일 위치 규약 준수**: `plan/in-progress/spec-draft-rag-dynamic-cut.md` — CLAUDE.md §정보 저장 위치 "진행 중 작업 → `plan/in-progress/<name>.md`" 준수.
3. **명명 규약 준수**: 파일 basename `spec-draft-rag-dynamic-cut` 은 kebab-case. 관련 식별자(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`)는 SCREAMING_SNAKE_CASE 내부 상수 명명으로 코드 컨벤션에 부합.
4. **spec 대상 문서들의 frontmatter 경로 타당**: 편집 대상 5개 spec 파일(`spec/5-system/9-rag-search.md` 등) 모두 `spec/conventions/spec-impl-evidence.md §1` 대상 경로.
5. **`spec/5-system/9-rag-search.md` status 전이 판단**: 현재 `status: partial` 이고 `pending_plans:` 에 `rag-rerank-followup.md` 등재 — draft §A1 이 `rag-dynamic-cut.md` 를 추가 병기하도록 안내하고 있어 `spec-impl-evidence` §3 전이 규칙을 올바르게 따름.
6. **문서 구조(Overview/본문/Rationale)**: draft 가 안내하는 spec 편집 지침들은 대상 spec 파일에 `## Overview` + 본문 + `## Rationale` 섹션을 보유하도록 유도하고 있음. §A8 전체가 `## Rationale` 갱신 지침.
7. **이전 검토(14_44_26) Critical 해소**: BLOCK 이었던 "plan frontmatter 부재"가 현재 파일에 frontmatter 추가로 해소. 재발 없음.
8. **금지 패턴 부재**: spec-impl-evidence 에서 금지된 `plan/complete/archive/from-*/` 신규 생성, `spec/` 직접 수정(draft 는 편집 지침이므로 직접 spec write 아님) 등이 없음.

---

## 요약

`plan/in-progress/spec-draft-rag-dynamic-cut.md` 는 `plan-lifecycle.md §4` 가 요구하는 3필드 frontmatter(`worktree`/`started`/`owner`)를 완비하고, `plan/in-progress/` 위치 규약 및 kebab-case 명명 규약을 준수한다. 문서가 안내하는 5개 spec 파일 편집 지침도 `spec-impl-evidence.md` 의 frontmatter 전이 규칙(partial 유지 + pending_plans 추가)·Rationale 섹션 의무·3섹션 구조를 따른다. 미해소 위반은 없으며, Gate C(`spec_impact`) 필드는 in-progress 단계에서 의무가 아니므로 완료 이동 시점까지 적용 유예가 허용된다. 전체적으로 정식 규약 준수 관점에서 문제가 없다.

---

## 위험도

NONE
