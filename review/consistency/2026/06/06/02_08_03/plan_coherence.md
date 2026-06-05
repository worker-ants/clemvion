# Plan 정합성 검토 — rag-eval-harness (P0 Phase 0+1)

검토 모드: `--impl-prep`
Target: `plan/in-progress/rag-eval-harness.md` (신규 생성 예정)
변경 범위: `codebase/backend/src/modules/knowledge-base/eval/**`, `src/scripts/{generate-golden-set,eval-retrieval}.ts`, `codebase/backend/eval/**`, `package.json scripts`, `spec/conventions/rag-evaluation.md`

---

## 발견사항

### [INFO] Target plan 파일이 아직 존재하지 않음 — 신규 생성 전 검토

- target 위치: `plan/in-progress/rag-eval-harness.md` (미생성)
- 관련 plan: 없음 (신규 plan)
- 상세: 검토 대상인 `rag-eval-harness.md` 은 아직 `plan/in-progress/` 에 존재하지 않는다. 이 검토는 해당 plan 을 생성·착수하기 전 사전 정합성 검토(`--impl-prep`)이다. plan 파일 자체의 내용을 검토할 수 없으므로, 변경 범위(구현 대상 경로·신규 spec 파일)와 기존 in-progress plan 들 간의 정합 위험만 분석한다.
- 제안: plan 파일 생성 시 아래 WARNING/INFO 항목들을 반영할 것.

---

### [WARNING] `rag-quality-improvement.md §P0` 와의 범위 중복 — 동일 Phase 를 별도 plan 이 구현

- target 위치: 변경 범위 전체 (`eval/**`, `generate-golden-set`, `eval-retrieval`, `spec/conventions/rag-evaluation.md`)
- 관련 plan: `plan/in-progress/rag-quality-improvement.md §3 P0 — 평가 하베스 (모든 것의 전제)`
- 상세: `rag-quality-improvement.md` 는 P0 를 RAG 개선 전체의 전제로 정의하고 다음 항목들이 미완(전부 미체크):
  - 응답 로깅 (`ragSources`/`ragDiagnostics` 재활용)
  - 골든셋 50~200건 (`eval/golden.json` git 버전관리)
  - 검색 지표 순수 TS (`Recall@k`/`Precision@k`/`MRR`/`nDCG@k`/`hit-rate`)
  - 생성 지표 LLM-judge (`autoevals`/`phoenix-evals`)
  - agentic 지표 (tool-call accuracy, whether-to-retrieve accuracy)
  - spec 갱신: `spec/conventions/rag-evaluation.md` 또는 `spec/5-system/9-rag-search.md`

  신규 `rag-eval-harness.md` 이 동일 P0 Phase 의 구현을 담당한다면 이는 한 Phase 가 두 plan 으로 분산된 상태다. `rag-quality-improvement.md` 의 P0 항목들이 "완료" 처리되지 않은 채 신규 plan 이 동일 코드 경로(`knowledge-base/eval/**`, `eval/golden.json`, scripts)를 구현하면 양쪽 plan 의 체크박스 상태가 불일치한다.
- 제안:
  - `plan/in-progress/rag-eval-harness.md` frontmatter 에 `parent: plan/in-progress/rag-quality-improvement.md` 를 명시하고, 본문에 "본 plan 은 `rag-quality-improvement.md §P0` 를 분리·구현한다" 선언 추가.
  - `rag-quality-improvement.md §P0` 의 각 체크박스에 `→ rag-eval-harness.md 에서 구현` 주석 또는 완료 표시 추가.

---

### [WARNING] `rag-quality-improvement.md §6` 미해결 결정 — 평가셋 규모·합성 비율 TBD

- target 위치: 신규 plan 의 골든셋 생성 스크립트(`generate-golden-set.ts`) 및 `eval/golden.json`
- 관련 plan: `plan/in-progress/rag-quality-improvement.md §6 남은 결정`
  - `[ ] 평가셋 규모·합성 비율(수동 50 + 합성 확장) 확정` — 미결
- 상세: `rag-quality-improvement.md` 은 "평가셋 규모·합성 비율 확정" 을 착수 전 확정 필요 결정 항목으로 남겨두었다. 신규 plan 이 `generate-golden-set.ts` 를 구현할 때 규모·합성 비율을 코드에 하드코딩하면 이 미결 결정을 일방적으로 내리는 충돌이 된다. P0 에서 "수동 50 + 합성 확장" 은 하나의 방향으로 언급됐으나 정식 확정 표시(`[x]`)가 없다.
- 제안: 신규 plan 착수 전 `rag-quality-improvement.md §6` 의 "평가셋 규모·합성 비율" 항목을 사용자와 합의해 `[x]` 처리하거나, 신규 plan 본문에 "초기값 수동 50건, 이후 확장" 결정을 명시하고 `rag-quality-improvement.md §6` 해당 항목도 동기 업데이트할 것.

---

### [WARNING] `rag-rerank-followup.md` 미해결 의존 — conditional escalate 임계가 P0 평가셋에 의존

- target 위치: 신규 plan 의 평가 결과 활용 흐름
- 관련 plan: `plan/in-progress/rag-rerank-followup.md`
  - `[ ] conditional escalate 정량 임계 — P0 평가셋 보정 후 도입`
- 상세: `rag-rerank-followup.md` 는 cross_encoder_llm 의 conditional escalate 정량 임계(점수 평탄/모호 시 LLM grading 트리거 임계값)가 "P0 평가셋 보정 후 도입" 이라고 명시한다. 따라서 신규 `rag-eval-harness.md` 의 P0 평가 하베스는 단순한 독립 기능이 아니라 `rag-rerank-followup.md` 의 선행 조건이다. 신규 plan 완료 후 `rag-rerank-followup.md` 의 conditional escalate 항목이 착수 가능해지므로, 신규 plan 에 이 후속 연결을 명시해야 한다.
- 제안: 신규 plan 의 "완료 후 후속 항목" 또는 "의존성" 절에 `rag-rerank-followup.md §conditional escalate` 를 활성화하는 사전 조건임을 명시. `rag-rerank-followup.md` 에도 "`rag-eval-harness.md` 완료 후 착수" 가드 추가 권장.

---

### [INFO] `spec/conventions/rag-evaluation.md` 신규 생성 — `spec/5-system/9-rag-search.md` pending_plans 등재 필요

- target 위치: 신규 `spec/conventions/rag-evaluation.md`
- 관련 plan: `plan/in-progress/rag-quality-improvement.md §P0 spec 갱신`
  - `[ ] spec 갱신: 신규 spec/conventions/rag-evaluation.md 또는 spec/5-system/9-rag-search.md`
- 상세: 현재 `spec/5-system/9-rag-search.md` frontmatter 의 `pending_plans` 는 `rag-rerank-followup.md` 만 참조한다. 신규 `spec/conventions/rag-evaluation.md` 는 `9-rag-search.md` 와 관련된 새 spec 문서이므로, 신규 plan 을 `9-rag-search.md` `pending_plans` 에 등재하거나 평가 spec 을 `9-rag-search.md` 본문에 통합하는 방향을 선택해야 한다.
- 제안: 신규 plan 생성 시 `spec/5-system/9-rag-search.md` frontmatter `pending_plans` 에 `plan/in-progress/rag-eval-harness.md` 추가. 또는 별도 spec 파일이 아닌 `9-rag-search.md` 의 하위 절로 통합하는 결정을 plan 본문에 명시.

---

### [INFO] `codebase/backend/eval/**` 경로 및 `package.json scripts` — active worktree 경합 없음

- target 위치: `codebase/backend/eval/**`, `package.json scripts`
- 관련 plan: `exec-park-durable-resume` worktree(branch `claude/exec-park-pr-b2`) 변경 파일: `spec/5-system/4-execution-engine.md`, `spec/5-system/13-replay-rerun.md`, plan 3개, review 파일만 포함. `impl-exec-concurrency-cap` worktree(branch `claude/impl-concurrency-cap-pr2b`) 변경 파일: `plan/in-progress/exec-intake-queue-impl.md` 만 포함.
- 상세: 두 active worktree 모두 `codebase/backend/src/modules/knowledge-base/eval/`, `src/scripts/`, `codebase/backend/eval/` 경로를 건드리지 않는다. 파일 수준 경합 없음.
- 제안: 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

| worktree | branch | stale 판정 |
|---|---|---|
| `rag-eval-harness-b8cc46` | `claude/rag-eval-harness-b8cc46` | **Step 1 STALE** — `git merge-base --is-ancestor claude/rag-eval-harness-b8cc46 origin/main` exit 0. 브랜치 HEAD 가 main 의 조상. non-squash merge 또는 최초 분기 전 상태. |

현재 active worktree 는 `exec-park-durable-resume`(branch `claude/exec-park-pr-b2`)와 `impl-exec-concurrency-cap`(branch `claude/impl-concurrency-cap-pr2b`) 두 건이며, 둘 다 target 변경 경로와 경합 없다.

`rag-eval-harness-b8cc46` worktree 는 검토(review) 파일 작성에만 사용 중이며, 신규 구현 착수 시 새 브랜치로 분기하거나 `ensure-worktree.sh` 로 재설정이 필요할 수 있다.

---

## 요약

신규 `rag-eval-harness.md` 은 `rag-quality-improvement.md §P0` 에서 정의·미착수 상태로 남겨진 평가 하베스 Phase 를 독립 plan 으로 분리하는 구조다. 핵심 위험은 두 plan 간 P0 체크박스 상태 불일치(WARNING 1), 미결 결정 "평가셋 규모·합성 비율" 의 일방 확정 위험(WARNING 2), `rag-rerank-followup.md` 의 conditional escalate 의존 연결 미명시(WARNING 3)이다. worktree 충돌 후보는 `rag-eval-harness-b8cc46` 1건이었으나 Step 1 cascade 에서 stale(main 조상) 로 판정해 CRITICAL 제외하고 skip 기록함. active worktree 2건(`exec-park`, `impl-concurrency-cap`)은 target 경로와 경합 없다. BLOCK 사유 없음 — WARNING 3건은 plan 작성 시 동기화·명시로 해소 가능하며 구현 착수를 차단하는 수준은 아니다.

### 위험도

MEDIUM
