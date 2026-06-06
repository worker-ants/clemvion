# Plan 정합성 검토 결과

검토 모드: `--impl-done`  
Target 범위: `spec/5-system/` (및 `spec/2-navigation/5-knowledge-base.md`)  
Worktree: `embedding-model-ux-c40698` (branch `claude/embedding-model-ux-c40698`)

---

## 발견사항

### [CRITICAL] active worktree `impl-exec-concurrency-cap` 와 `spec/5-system/17-agent-memory.md` 동시 수정

- **target 위치**: `spec/5-system/17-agent-memory.md` — §4 회수 단락에 비대칭 입력(`inputType`) 설명 블록 추가
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` + `plan/in-progress/spec-update-pr2a-active-running-invariants.md` (둘 다 `worktree: impl-exec-concurrency-cap`)
- **상세**: `impl-exec-concurrency-cap` 브랜치(`claude/impl-concurrency-cap-pr2b`)는 `spec/5-system/17-agent-memory.md`에서 39줄을 독립적으로 수정 중이다(메모리 producer/consumer 노드 문단 제거, V086 인덱스 서술 단순화, AGM-02 요구사항 표현 변경 등). target 워크트리도 같은 파일에 `inputType:'query'`/`'document'` 구분 설명을 추가한다. 두 워크트리가 동일 파일의 인접 구간을 변경하며 병렬 머지 시 충돌 또는 상호 누락 위험이 있다.
- **제안**: target 머지 우선 처리 후 `impl-exec-concurrency-cap`이 rebase 시 `17-agent-memory.md` 충돌을 해소하거나, 두 작업을 직렬화(embed worktree 먼저 머지 → impl-exec 워크트리 rebase). `exec-park-durable-resume.md §W4`에 이미 해당 worktree cross-branch 리스크가 기록돼 있으며, 동일 맥락에서 본 파일 충돌도 조율 대상이다.

---

### [CRITICAL] active worktree `impl-exec-concurrency-cap` 와 `spec/5-system/9-rag-search.md` 동시 수정

- **target 위치**: `spec/5-system/9-rag-search.md` §2.2 — 비대칭 입력(`inputType:'query'`) 한 줄 추가
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`)
- **상세**: `impl-exec-concurrency-cap` 브랜치는 `spec/5-system/9-rag-search.md`에서 25줄 변경 중이다. 해당 변경은 Overview 섹션 삭제, `cross_encoder_llm` 구현 상태를 "구현됨"에서 "후속"으로 역행, `plan/in-progress/spec-draft-rag-reranking.md` 참조(파일 미존재) 삽입, Convention RAG 평가 하베스 링크 제거 등 의미 있는 본문 수정을 포함한다. target 워크트리는 같은 파일 `§2.2` 에 `inputType:'query'` 한 줄을 추가한다. 또한 `impl-exec-concurrency-cap`의 변경이 반영되면 `rag-rerank-followup.md`에서 완료(`#478`)로 표기한 `cross_encoder_llm` 구현 상태가 spec에서 "후속"으로 되돌아가는 콘텐츠 회귀가 발생한다.
- **제안**: `impl-exec-concurrency-cap` 브랜치의 `9-rag-search.md` 변경이 최신 구현 상태(#466, #478 머지)를 반영하지 않은 stale 내용인지 확인 후 rebase. target 워크트리를 먼저 머지하고 impl-exec 워크트리가 그 위에서 충돌을 해소하는 직렬 순서 권장.

---

### [CRITICAL] active worktree `impl-exec-concurrency-cap` 와 `spec/2-navigation/5-knowledge-base.md` 동시 수정

- **target 위치**: `spec/2-navigation/5-knowledge-base.md` §2.2 임베딩 모델 행 + 재임베딩 경고 문단 추가
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`)
- **상세**: `impl-exec-concurrency-cap` 브랜치는 `spec/2-navigation/5-knowledge-base.md`의 리랭킹 행을 "(선택) 검색 후처리 정밀화. `cross_encoder` · `cross_encoder_llm` 모두 구현됨"에서 "(Planned, 선택)" 표현으로 되돌리고 `RerankConfig 자체는 워크스페이스 설정 화면에서 관리` 문구도 제거한다. target 워크트리는 같은 파일의 다른 행(임베딩 모델 행과 재임베딩 경고 문단)을 변경한다. `impl-exec-concurrency-cap`의 변경이 `rag-rerank-followup.md`에서 이미 완료(`#478`)로 처리된 리랭킹 UI 구현 상태를 "Planned"로 역행시키는 콘텐츠 불일치를 유발한다.
- **제안**: `impl-exec-concurrency-cap` 브랜치의 `5-knowledge-base.md` 변경이 stale 기준(PR2b 착수 전 도입된 스냅샷)에서 온 것인지 확인. rebase 시 리랭킹 행 표현을 현재 main 기준으로 정합화 필요.

---

### [WARNING] `plan/in-progress/rag-quality-improvement.md §P6` 미완료 항목과 target 변경 범위 중복

- **target 위치**: `spec/5-system/8-embedding-pipeline.md §5.4` 신설, `spec/2-navigation/5-knowledge-base.md` 임베딩 모델 배지 추가, `spec/5-system/9-rag-search.md` inputType 주석 추가
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md §P6` (worktree `rag-quality-proposal-0c618c`)
- **상세**: `rag-quality-improvement.md §P6`은 다음 3개 항목을 `[ ]`(미완) 상태로 열거한다: (1) "모델 선택 UI 한국어 추천 프리셋/힌트", (2) "e5/voyage/cohere 선택 시 input_type/prefix(query vs passage) 자동 배선", (3) "spec 갱신: spec/2-navigation/5-knowledge-base.md / spec/5-system/8-embedding-pipeline.md". target 워크트리는 이 3가지를 모두 구현·spec 반영했으나 `rag-quality-improvement.md`의 P6 체크박스는 `[ ]` 상태 그대로다.
- **제안**: target 머지 후 `rag-quality-improvement.md §P6`의 해당 3개 항목을 `[x]`(완료)로 갱신하고 해당 spec 변경을 완료 증거로 기록한다.

---

### [WARNING] `spec/5-system/9-rag-search.md` frontmatter `pending_plans`에 `rag-eval-harness.md` stale 참조 위험

- **target 위치**: `spec/5-system/9-rag-search.md` frontmatter
- **관련 plan**: `plan/complete/rag-eval-harness.md` (이미 complete/ 이동됨)
- **상세**: stale 워크트리 `rag-eval-harness-b8cc46`(PR #488 MERGED, stale 처리됨)가 `spec/5-system/9-rag-search.md` frontmatter에 `plan/in-progress/rag-eval-harness.md`를 추가하는 변경을 포함한다. 해당 plan은 이미 `plan/complete/rag-eval-harness.md`로 이동됐으므로 해당 브랜치 변경이 잔류할 경우 유효하지 않은 `pending_plans` 참조가 생긴다. target 워크트리 자체의 `9-rag-search.md` 변경에는 해당 frontmatter 수정이 없어 target 자체는 정상이다.
- **제안**: `rag-eval-harness-b8cc46` worktree cleanup 수행. target 머지 시점에 이 stale 브랜치 변경이 별도로 적용되지 않도록 확인.

---

### [INFO] `rag-quality-proposal-0c618c` 브랜치 내용 없음 — stale 판정 cascade Step 3 fallback

- **상세**: `rag-quality-improvement.md`의 `worktree: rag-quality-proposal-0c618c` 브랜치가 로컬 및 원격에 0 unique commits 상태로 존재(= main HEAD와 동일). Step 1: ACTIVE(ancestor 아님 판정), Step 2: PR 없음(empty), Step 3 fallback: active로 처리. 실제 파일 충돌 없음. "stale 판정 cascade Step 1/2 모두 음성, active로 처리 — 실제 stale이면 cleanup-worktree-all.sh 실행 후 재검토 권장."
- **제안**: 해당 worktree 필드가 plan 문서 작성용으로만 생성됐을 가능성이 있다. `plan-lifecycle.md §4` sentinel `(unstarted)`로 정규화 검토.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `rag-eval-harness-b8cc46` (branch `claude/rag-eval-harness-b8cc46`) — Step 1: ancestor 아님(ACTIVE 신호), Step 2: PR #488 **MERGED**. squash merge로 commit hash가 바뀌어 Step 1 통과했으나 PR 종결 확인 → **stale 처리**. 변경 범위 `spec/5-system/9-rag-search.md` frontmatter skip.

해당 worktree가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target 워크트리(`embedding-model-ux-c40698`)는 `spec/5-system/8-embedding-pipeline.md`·`spec/5-system/9-rag-search.md`·`spec/5-system/17-agent-memory.md`·`spec/2-navigation/5-knowledge-base.md` 네 파일에 임베딩 input_type/prefix 비대칭 입력 배선 및 한국어 추천 UX spec을 반영했다. 미해결 결정 우회 없음(P6 항목은 plan에서 "결정 필요"가 아닌 "미착수 백로그"이며 target이 이를 이행했다). 단 active worktree `impl-exec-concurrency-cap`(`claude/impl-concurrency-cap-pr2b`)이 같은 파일(`17-agent-memory.md` 39줄, `9-rag-search.md` 25줄, `5-knowledge-base.md` 2줄)을 병렬로 수정 중이어서 직렬화 또는 rebase 조율이 필수다. 또한 해당 worktree의 변경이 이미 머지된 리랭킹 구현 상태를 "Planned"·"후속"으로 역행시키는 콘텐츠 불일치를 유발한다. `rag-quality-improvement.md §P6` 체크박스 미갱신은 후처리 권장. worktree 충돌 후보 3건 중 stale 1건 skip(`rag-eval-harness-b8cc46`, PR #488 MERGED), active 2건 분석(`impl-exec-concurrency-cap` CRITICAL, `rag-quality-proposal-0c618c` 파일 충돌 없음).

---

## 위험도

CRITICAL
