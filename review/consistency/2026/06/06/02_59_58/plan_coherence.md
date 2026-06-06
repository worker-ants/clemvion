# Plan 정합성 검토 결과

검토 모드: `--impl-done`
Target: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md` — RAG 평가 하베스 구현 완료 후 spec-impl 정합.
구현 범위: `codebase/backend/src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`, `src/database/root-entities.ts`

---

## 발견사항

### [WARNING] rag-eval-harness.md 작업 항목이 미완료 표시로 남아있음

- target 위치: `plan/in-progress/rag-eval-harness.md` §2 Phase A / Phase B 체크박스 전부 `[ ]` (미체크)
- 관련 plan: `plan/in-progress/rag-eval-harness.md` 본문
- 상세: plan 진행 노트(line 15)는 "Phase A(코드)·B(spec) 구현 완료"라고 밝히지만 §2 Phase A/B 의 개별 작업 항목 체크박스가 모두 `[ ]`로 남아있다. 완료된 것과 미완료 표시 간 불일치. plan-stale-audit 의 `DONE?` 플래그가 오작동할 수 있고, 후속 진입자가 중복 착수할 위험이 있다.
- 제안: `plan/in-progress/rag-eval-harness.md` §2 Phase A·B 의 완료된 항목들을 `[x]` 로 체크하고, 아직 남은 항목(`/ai-review` 단계 등)은 `[ ]` 로 유지한다.

### [WARNING] rag-quality-improvement.md P0 체크박스가 부분 완료 미반영

- target 위치: `plan/in-progress/rag-quality-improvement.md` §3 P0 항목
- 관련 plan: `plan/in-progress/rag-quality-improvement.md` §P0 및 `plan/in-progress/rag-eval-harness.md` (상위 plan)
- 상세: `rag-eval-harness.md` 는 `rag-quality-improvement.md §P0` 의 부분집합으로 "①자동 합성 골든셋 + 순수-TS 검색지표 두 항목만" 구현한다고 명시했다. `rag-quality-improvement.md` 의 P0 체크박스 중 대응 항목("골든셋", "검색 지표(순수 TS)")은 아직 `[ ]`로 남아있다. 완료 후 상위 plan 에 해당 항목만 `[x]`로 분리 갱신하겠다는 약속이 `rag-eval-harness.md` 진행 노트에 있으나 아직 반영되지 않았다.
- 제안: `rag-eval-harness.md` 머지 시점 또는 PR 완료 후, `rag-quality-improvement.md` §P0 의 "골든셋 자동 합성 generator" 및 "검색 지표(순수 TS)" 두 항목을 `[x]`로 체크하고 `rag-eval-harness.md` 완료 주석을 추가한다.

### [INFO] rag-rerank-followup.md — conditional escalate 임계가 P0(본 PR) 의존으로 선언됨

- target 위치: `plan/in-progress/rag-rerank-followup.md` 미구현 surface 목록 `conditional escalate 정량 임계` 항목
- 관련 plan: `plan/in-progress/rag-rerank-followup.md`
- 상세: `rag-rerank-followup.md` 의 `conditional escalate 정량 임계` 항목은 "P0 평가셋 보정 후 도입" 으로 본 eval harness 에 명시적으로 의존한다고 기록되어 있다. 본 구현이 완료됨에 따라 이 선행 조건이 충족되었다. `rag-rerank-followup.md` 의 해당 항목에 "P0 하베스 구현 완료(rag-eval-harness PR) — 본 조건 충족" 메모를 추가하면 후속 담당자가 착수 가능 여부를 즉시 인식할 수 있다.
- 제안: `rag-rerank-followup.md` 의 `conditional escalate` 항목에 조건 충족 메모 추가(필수 아님, 추적 개선).

### [INFO] spec/5-system/9-rag-search.md — pending_plans 에 rag-eval-harness 등재 완료(정합)

- target 위치: `spec/5-system/9-rag-search.md` frontmatter `pending_plans`
- 관련 plan: `plan/in-progress/rag-eval-harness.md` §참조 spec
- 상세: `9-rag-search.md` frontmatter 의 `pending_plans` 에 `plan/in-progress/rag-eval-harness.md` 가 이미 등재되어 있고, `rag-evaluation.md` cross-reference 링크도 추가된 상태다. Phase B spec 생성 및 9-rag-search.md 링크 삽입이 완료된 것으로 확인 — 정합.

### [INFO] src/database/root-entities.ts 분리는 미선언 변경이나 충돌 없음

- target 위치: `codebase/backend/src/app.module.ts` + `codebase/backend/src/database/root-entities.ts` (신규)
- 관련 plan: `plan/in-progress/rag-eval-harness.md` §Phase A (D-E5)
- 상세: `ROOT_ENTITIES` 를 `app.module.ts` 에서 전용 파일 `src/database/root-entities.ts` 로 분리하는 리팩터는 `rag-eval-harness.md` §Phase A 체크리스트에 명시 항목이 없으나, 진행 노트에는 기록되어 있다. 다른 active worktree(exec-park-durable-resume, fix-webchat-envelope-unwrap-9519af, impl-exec-concurrency-cap) 에서 `root-entities.ts` 와 충돌하는 변경 없음 확인.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보를 검토한 결과 다음 3건이 stale 판정되어 §5 검토에서 제외됨:

- `rag-rerank-impl` (branch `claude/rag-rerank-impl`) — Step 2 PR MERGED
  (`rag-rerank-followup.md` frontmatter `worktree: rag-rerank-impl` 참조)
- `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) — Step 2 PR MERGED
  (`rag-quality-improvement.md` frontmatter `worktree: rag-quality-proposal-0c618c` 참조)
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 2 PR MERGED
  (`knowledge-base-quality-improvements.md` frontmatter `worktree: kb-quality-fba2f2` 참조)

이 worktree 들은 물리적으로 제거되었거나 branch 가 main 에 squash-merge 되었다. `./cleanup-worktree-all.sh --yes --force` 실행으로 잔여 항목 정리 권장.

active worktree 충돌 후보(spec/conventions/rag-evaluation.md, spec/5-system/9-rag-search.md, src/database/root-entities.ts 기준):
- `exec-park-durable-resume`, `fix-webchat-envelope-unwrap-9519af`, `impl-exec-concurrency-cap` 3개 모두 대상 파일에 변경 없음 (git diff origin/main...HEAD 결과 empty) — 충돌 없음.

---

## 요약

worktree 충돌 후보 3건은 모두 Step 2(PR MERGED)로 stale 판정되어 skip 되었으며, 현재 active 4개 worktree 중 target 파일과 실제 충돌하는 것은 없다. 주요 관찰은 다음 두 WARNING: (1) `rag-eval-harness.md` Phase A/B 체크박스가 완료됐음에도 미체크(`[ ]`) 상태로 남아 plan 상태 추적에 오염을 일으킬 수 있고, (2) 상위 `rag-quality-improvement.md` §P0 의 대응 항목들도 아직 미갱신이다. 두 건 모두 spec/코드 정합과는 무관한 plan 위생 이슈다. spec/conventions/rag-evaluation.md(신규)와 spec/5-system/9-rag-search.md(pending_plans + 링크 추가) 의 spec-impl 정합성은 양호하다.

worktree 충돌 후보 3건 중 stale 3건 skip, active 0건 분석.

---

## 위험도

LOW
