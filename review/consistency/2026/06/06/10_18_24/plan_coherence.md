# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/embedding-model-ux.md` (worktree: `embedding-model-ux-c40698`, branch `claude/embedding-model-ux-c40698`)

---

## 발견사항

### [WARNING] spec/5-system/7-llm-client.md §3.3 embed 시그니처 갱신 누락

- **target 위치**: `embedding-model-ux.md §2 Phase A` 작업 항목 — "spec 갱신" 항목
- **관련 plan**: `plan/in-progress/rag-rerank-followup.md` SoT 목록에 `spec/5-system/7-llm-client.md` 등재됨. 해당 spec 의 `§3.3 embed 시그니처` 는 현재 `embed(texts: string[], model?: string): Promise<number[][]>` 로 명시 (7-llm-client.md §3.3).
- **상세**: target 은 Phase A 에서 `llm-client.interface.ts` 의 embed 시그니처에 `inputType?: 'query' | 'document'` 를 추가한다 (D-P6-3). 이 인터페이스는 `spec/5-system/7-llm-client.md §3.3` 에 현재의 2파라미터 시그니처가 명문화되어 있다. 그러나 target 의 spec 갱신 목록은 `8-embedding-pipeline.md §5` 와 `5-knowledge-base.md §2.3~2.4` 만 열거하고 `7-llm-client.md §3.3` 갱신을 포함하지 않는다. 구현이 완료되면 코드와 spec 사이에 embed 시그니처 드리프트가 발생한다.
- **제안**: Phase A "spec 갱신" 항목에 `spec/5-system/7-llm-client.md §3.3 embed 시그니처` 갱신 (`inputType?` 파라미터 + 용도 주석) 을 추가. 또한 `spec/5-system/7-llm-client.md` frontmatter 의 `pending_plans:` 에 `plan/in-progress/embedding-model-ux.md` 를 등재하거나 갱신 완료 후 제거.

---

### [WARNING] impl-exec-concurrency-cap 워크트리 — 동일 파일 병렬 편집 (merge conflict 위험)

- **target 위치**: `embedding-model-ux.md §2 Phase A` (agent-memory.service.ts :421/:896), `Phase B` (ko/en/knowledgeBases.ts), `Phase C` (spec/2-navigation/5-knowledge-base.md §2.3~2.4)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` + `plan/in-progress/exec-park-durable-resume.md` (공유 worktree: `impl-exec-concurrency-cap`, branch: `claude/impl-concurrency-cap-pr2b`)
- **상세**: `claude/impl-concurrency-cap-pr2b` 는 아직 PR 미생성(오픈되지 않음) 상태의 **active 브랜치** (git worktree list 에서 물리 디렉토리 확인됨, Step 1 ACTIVE, Step 2 PR 없음 → Step 3 fallback active). 해당 브랜치는 다음 3개 파일을 동시에 편집 중:
  1. `agent-memory.service.ts` — line 88, 194, 213, 499 영역 수정 (extractionModel 필드 제거, admin 메서드 201줄 삭제). target 이 수정 예정인 :421/:896 과 직접 겹치지는 않으나, :499 이후 201줄 삭제로 인해 main 에 합류 시 line 896 이 크게 시프트됨.
  2. `spec/2-navigation/5-knowledge-base.md` §2.2 — 리랭킹 행을 `(Planned, 선택)` 으로 되돌리는 변경. target 은 §2.3~2.4 를 수정하므로 섹션은 다르나 동일 파일 경합.
  3. `codebase/frontend/src/lib/i18n/dict/ko/knowledgeBases.ts` / `en/knowledgeBases.ts` — rerank 관련 키 18개를 삭제. target 은 동일 파일에 embedding 추천 배지 키를 추가. 동일 파일 내 다른 영역이지만 동시 편집으로 merge conflict 가능.
- **제안**: impl-concurrency-cap-pr2b 브랜치 PR 생성·머지 순서와 embedding-model-ux 착수 타이밍을 조율. impl-exec-concurrency-cap 이 먼저 머지되면 embedding-model-ux 는 rebase 후 agent-memory.service.ts line ref 재확인 및 knowledgeBases.ts 베이스 상태 확인 필요. 반대로 embedding-model-ux 가 먼저 머지되면 impl-exec-concurrency-cap 의 knowledgeBases.ts 변경이 충돌 없이 적용될 수 있도록 확인.

---

### [INFO] rag-quality-improvement.md §P6 체크박스 미갱신 — 완료 후 동기화 필요

- **target 위치**: `embedding-model-ux.md` 전체 (§P6 실행 plan)
- **관련 plan**: `plan/in-progress/rag-quality-improvement.md §P6` — 3개 항목(`모델 선택 UI 한국어 추천`, `재임베딩 경고+진행률`, `input_type/prefix 자동 배선`) 이 `[ ]` 미완 상태.
- **상세**: embedding-model-ux.md 는 P6 의 실행 plan 으로 기술되어 있고, 완료 시 상위 rag-quality-improvement.md §P6 체크박스를 갱신해야 한다. 현재 plan 의 §3 게이트 순서에 이 항목이 명시되어 있지 않다.
- **제안**: 구현 완료 + PR 머지 후 `rag-quality-improvement.md §P6` 의 3개 체크박스를 `[x]` 로 갱신하는 단계를 `embedding-model-ux.md §3 게이트 순서` 에 추가.

---

### [INFO] ai-context-memory-followup-v2.md — saveMemories 시그니처 리팩터 잠재 후속 주의

- **target 위치**: `embedding-model-ux.md §2 Phase A` — agent-memory.service.ts :421/:896 embed 호출 수정
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` 백로그 항목: `saveMemories 포지셔널 5파라미터 → 옵션 객체(I3)` (미착수)
- **상세**: 해당 백로그는 `AgentMemoryService.saveMemories` 시그니처 리팩터. embedding-model-ux 의 target lines(:421/:896)는 `saveMemories` 가 아닌 `llmService.embed()` 호출이므로 직접 충돌 없음. ai-context-memory plan 의 worktree `ai-context-memory-9c7e6e` 는 PR MERGED(stale)이고 물리 디렉토리도 없으므로 현재 경합 없음. 백로그 항목이 재활성화될 경우 agent-memory.service.ts 를 재수정하게 되어 순차 적용이 필요함을 기록.
- **제안**: 추적 메모만. 현재 blocking 아님.

---

## Stale 으로 skip 한 worktree (의무 항목)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

| worktree (branch) | 판정 |
|---|---|
| `ai-context-memory-9c7e6e` (branch `claude/ai-context-memory-9c7e6e`) | Step 2 PR MERGED — stale |
| `rag-quality-proposal-0c618c` (branch `claude/rag-quality-proposal-0c618c`) | Step 2 PR MERGED — stale |
| `rag-rerank-impl` (branch `claude/rag-rerank-impl`) | Step 2 PR MERGED — stale |
| `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) | Step 2 PR MERGED — stale |
| `rag-eval-harness-b8cc46` (branch `claude/rag-eval-harness-b8cc46`) | Step 2 PR MERGED — stale. 물리 워크트리 디렉토리 여전히 존재 |
| `rag-eval-plan-hygiene-279c3e` (branch `claude/rag-eval-plan-hygiene-279c3e`) | Step 2 PR MERGED — stale. 물리 워크트리 디렉토리 여전히 존재 |

`rag-eval-harness-b8cc46` 및 `rag-eval-plan-hygiene-279c3e` 는 PR 머지 완료됐으나 물리 워크트리가 잔존. 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

embedding-model-ux plan(P6) 은 독립 백로그로 설계되어 있고, 핵심 의존 plan(P1 리랭킹)은 이미 머지 완료 상태이며 미해결 결정 우회는 없다. worktree 충돌 후보 7건 중 stale 6건 skip, active 1건 분석: `impl-exec-concurrency-cap` 워크트리(branch `claude/impl-concurrency-cap-pr2b`)가 `agent-memory.service.ts` / `spec/2-navigation/5-knowledge-base.md` / `ko+en/knowledgeBases.ts` 를 동시 편집 중이며, 두 브랜치의 머지 순서에 따라 line-shift 및 i18n 파일 merge conflict 가 발생할 수 있다. 또한 embed() 시그니처 변경에 동반되어야 하는 `spec/5-system/7-llm-client.md §3.3` 갱신이 plan 의 spec 갱신 목록에서 누락되어 있다. 두 항목 모두 구현 차단 수준이 아닌 WARNING 으로, plan 갱신으로 해소 가능하다.

---

## 위험도

LOW
