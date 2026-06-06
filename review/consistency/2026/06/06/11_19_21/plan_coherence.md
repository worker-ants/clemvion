# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 spec 영역: `spec/5-system/`
분석 시점: 2026-06-06

---

## 발견사항

### [WARNING] P6 완료 사실이 상위 plan `rag-quality-improvement.md` 에 미반영
- **target 위치**: `plan/in-progress/embedding-model-ux.md` (진행 메모에 Phase A/B/C 완료 기재)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/rag-quality-improvement.md §3 P6 — 임베딩 모델 UX 보강`
- **상세**: `embedding-model-ux` 브랜치가 P6의 3개 항목(① 한국어 추천 배지, ② 재임베딩 경고·진행률 검증·spec 갱신, ③ input_type/prefix 배선)을 모두 구현하고 spec 갱신까지 마쳤다. 그러나 상위 plan `rag-quality-improvement.md §3 P6` 의 3개 체크박스는 여전히 `[ ]` 미체크 상태다. `embedding-model-ux.md` §3 게이트 I-4 에 "PR 머지 후 `rag-quality-improvement.md §P6` 3개 체크박스 `[x]` 갱신" 이 명시돼 있으나, 현재 브랜치 diff 에는 `rag-quality-improvement.md` 수정이 포함되지 않음.
- **제안**: 본 PR 머지 전(또는 머지 커밋에 포함)에 `rag-quality-improvement.md §P6` 의 3개 항목을 `[x]` 로 갱신하고 완료 날짜·PR 번호를 기재한다. `embedding-model-ux.md` §2 Phase A/B/C 의 개별 `[ ]` 항목들도 현황에 맞게 `[x]` 로 업데이트한다.

---

### [WARNING] `rag-quality-improvement.md` P6 항목의 voyage/cohere 범위 표현이 D-P6-1 결정과 불일치
- **target 위치**: `plan/in-progress/embedding-model-ux.md §1 결정 D-P6-1` (voyage/cohere = provider 부재로 OUT)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/rag-quality-improvement.md §3 P6` 항목 "e5/voyage/cohere 선택 시 input_type/prefix(query vs passage) 자동 배선 — silent bug 방지"
- **상세**: 상위 plan P6 항목에 voyage/cohere 가 배선 대상으로 기재돼 있으나, D-P6-1 결정("voyage/cohere 는 provider 부재로 OUT")에 따라 실제 구현은 e5(prefix)·Google Gemini(taskType)·나머지(no-op) 에 한정됐다. 상위 plan 이 voyage/cohere 를 계속 배선 대상으로 기재하면 향후 작업자가 잘못된 기대를 가질 수 있다.
- **제안**: `rag-quality-improvement.md §P6` 의 해당 항목을 "e5 계열 선택 시 `query:`/`passage:` prefix, Google Gemini 선택 시 `taskType` 자동 배선(voyage/cohere 는 client 부재로 제외) — silent bug 방지" 로 정정한다.

---

### [INFO] `embedding-model-ux.md` §2 작업 항목 체크박스가 구현 후에도 미갱신
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/plan/in-progress/embedding-model-ux.md §2`
- **관련 plan**: 동일 파일
- **상세**: §2 Phase A/B/C 의 개별 작업 항목들(`[ ]`)이 구현 완료 후에도 체크 해제 상태다. 파일 상단 진행 메모에서는 완료를 기술하고 있으나, 체크박스는 추적 단위이므로 불일치가 발생한다.
- **제안**: 커밋 또는 PR 직전에 완료된 항목을 `[x]` 로 업데이트한다.

---

## Stale 으로 skip 한 worktree (의무 기재)

worktree 충돌 후보: `spec/5-system/` 내 동일 파일을 수정하는 브랜치를 전수 확인함.

| worktree | branch | 판정 | 근거 |
|---|---|---|---|
| `rag-quality-proposal-0c618c` | `rag-quality-proposal-0c618c` | **stale** | Step 2: PR MERGED |
| `ai-context-memory-9c7e6e` | `ai-context-memory-9c7e6e` | **stale** | Step 2: PR MERGED |
| `fix-webchat-sse-field-map-22cd94` | `claude/fix-webchat-sse-field-map-22cd94` | **stale** | Step 2: PR MERGED |
| `rag-eval-harness-b8cc46` | `claude/rag-eval-harness-b8cc46` | **stale** | Step 2: PR MERGED |
| `rag-eval-plan-hygiene-279c3e` | `claude/rag-eval-plan-hygiene-279c3e` | **stale** | Step 2: PR MERGED |

모두 PR MERGED 상태로 stale 판정. active worktree 중 `spec/5-system/` 에 충돌을 일으키는 브랜치는 0건.

- `claude/exec-park-pr-b2`: `spec/5-system/4-execution-engine.md` 만 수정, 대상 파일과 비겹침.
- `claude/impl-concurrency-cap-pr2b`: `spec/5-system/` 파일 수정 없음.

해당 stale worktree 디렉토리가 활성으로 남아있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target(`spec/5-system/` 내 `7-llm-client.md`·`8-embedding-pipeline.md`·`17-agent-memory.md`) 변경 내용은 `embedding-model-ux.md` 의 결정·설계와 완전히 정합한다. 미해결 결정 우회나 선행 조건 미충족은 없다. active worktree 와의 spec 파일 충돌도 없다(후보 5건 전부 stale skip). 다만 구현 완료 사실이 상위 plan `rag-quality-improvement.md §P6` 에 미반영(WARNING)이고 voyage/cohere 범위 표현이 실제 결정과 불일치(WARNING)하므로 PR 전 plan 갱신이 필요하다. worktree 충돌 후보 5건 중 stale 5건 skip, active 0건.

## 위험도

LOW
