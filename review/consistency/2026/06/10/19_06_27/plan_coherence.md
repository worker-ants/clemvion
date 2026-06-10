# Plan 정합성 Check — refactor/01-performance.md 유효 항목 구현

검토 모드: 구현 착수 전 (--impl-prep)
Target: `plan/in-progress/refactor/01-performance.md` (worktree `perf-backlog-01`, frontmatter `worktree:` 필드 없음 — README 주도 standing audit 백로그 suite)
Target 항목 13건: #1 resume rehydration N+1 / #2 KB S3 배치 삭제(B안 확정) / #3 execution-store sortByStartedAt / #4 dashboard getSummary 통합 / #5 assertNoContainerCycle / #6 planParallelBody BFS / #7 buildSystemPrompt 캐시 / #8 nodeResults Map 인덱스 / #10 workflow import 배치 insert / #11 clearLlmDefaultConfigCache(C 종결 권장) / #12 RAG graph-traversal CTE 통합 / #14 MAX_NODE_ITERATIONS/PARALLEL_ENGINE read-once / #15 대화 메시지 .map(C 종결 권장)

## 발견사항

- **[WARNING] #12 RAG graph-traversal CTE 통합 — 동일 파일(`rag-search.service.ts`) 변경이 방금 머지됨 (베이스 재확인 필요)**
  - target 위치: #12, `backend/.../knowledge-base/search/rag-search.service.ts:630-656`
  - 관련 plan: `plan/in-progress/kb-unsearchable-warning.md` (worktree `kb-unsearchable-warning-b47e20`, PR #511 **MERGED**)
  - 상세: PR #511(kb-unsearchable)이 `rag-search.service.ts` 를 54+/12- 수정해 머지됐다. 변경 헌크는 라인 23~267(import·타입·초반 메서드)로 #12 의 graph-traversal CTE(630-656)와 **라인 직접 겹침은 없다**. 그러나 (a) target plan 의 라인 번호(630-656)는 PR #511 머지 **전** 스냅샷 기준일 수 있어, 머지 후 main 에서 해당 CTE 위치가 이동했을 가능성이 있다. (b) target worktree `perf-backlog-01` 의 베이스가 PR #511 머지 이전이면 #12 구현 시 stale 라인 참조.
  - 제안: #12 착수 직전 `perf-backlog-01` 을 최신 main(PR #511 포함) 위로 rebase 후 graph-traversal CTE 실제 라인 재확인. plan 본문의 `:630-656` 표기는 구현 시 grep 로 재특정(라인 고정 금지). target plan 수정 불요 — 베이스 갱신만.

- **[INFO] #1 ↔ exec-park-durable-resume 의 rehydration 영역 인접 (충돌 아님)**
  - target 위치: #1, `execution-engine.service.ts:1303-1330` `resumeFromCheckpoint` findOne 루프
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` (worktree `exec-park-durable-resume`, active)
  - 상세: 두 plan 모두 "rehydration" 을 다루나 대상이 다르다. exec-park 의 A1(conversationThread 영속+rehydration 복원)은 이미 PR #470 으로 main 완료, 코드 변경 표면도 `rehydrateContext`/durable park 컬럼이지 #1 의 `nodeExecutionRepository.findOne` N+1 루프가 아니다. 현재 exec-park 브랜치의 `execution-engine.service.ts` diff 는 target 파일 목록에 **미포함**(검증: `git diff --name-only origin/main...exec-park-durable-resume` 에 해당 파일 없음). 직접 충돌 없음.
  - 제안: 추적 메모만. #1 구현 시 exec-park 의 resume 경로 변경과 병합 시점이 겹치면 `execution-engine.service.ts` 동일 파일 머지 충돌 가능 — 직렬화 권장(둘 중 먼저 머지되는 쪽 기준 rebase).

- **[INFO] #1 은 05-database.md M-4 와 동일 근원 (suite 내부 의도된 교차참조)**
  - target 위치: 01-performance.md 헤더 "중복 참조" 주석
  - 관련 plan: 동일 refactor 백로그 suite `plan/in-progress/refactor/05-database.md` M-4
  - 상세: 같은 N+1 항목을 두 관점 파일이 가리키며 01-performance 가 본문 소유로 명시. suite 내부 의도된 설계이지 중복 작업 아님.
  - 제안: 조치 불요. #1 구현 시 05-database.md M-4 체크박스도 동반 종결.

- **[INFO] #2 KB S3 배치 삭제 — 미해결 결정 없음(B안 사용자 확정)**
  - target 위치: #2 (`knowledge-base.service.ts:678-684`)
  - 상세: target 이 plan 의 "결정 필요" 를 우회하지 않는다 — #2 는 2026-06-10 사용자 결정으로 B안(전제조건 4건 실검증 통과) 확정 상태. KB service 를 손대는 active worktree 는 없음(`kb-lifecycle-groom`·`kb-unsearchable` 모두 `knowledge-base.service.ts` 미변경, 검증 완료). spec 갱신 필요 항목(`data-flow/4-file-storage.md` "for 루프" 문구)은 planner 트랙으로 plan 에 이미 명시.
  - 제안: 조치 불요.

- **[INFO] #14 PARALLEL_ENGINE/MAX_NODE_ITERATIONS read-once ↔ continuation worker concurrency env (충돌 아님)**
  - target 위치: #14, `execution-engine.service.ts:1387,3025,1549,3665`
  - 관련 plan: `plan/in-progress/continuation-resume-optional-followups.md` (worktree `continuation-worker-concurrency-env`)
  - 상세: continuation plan 의 env 작업은 `@Processor` 데코레이터 worker concurrency env 로 **이미 `[x]` 완료**이고 대상 env 가 다르다(worker concurrency ≠ MAX_NODE_ITERATIONS/PARALLEL_ENGINE). 동일 env 중복 없음.
  - 제안: 조치 불요.

## Stale 으로 skip 한 worktree

worktree 충돌 후보(§5) 중 §worktree stale 판정 으로 skip 된 항목 — **1건**:

- `kb-unsearchable-warning-b47e20` (branch `claude/kb-unsearchable-warning-b47e20`) — Step 1 ancestor 음성(squash merge 로 HEAD 미일치) → **Step 2 PR #511 MERGED → stale**. 브랜치에 6 커밋(머지된 feat + 후속 review/plan 커밋)이 정리 안 된 채 worktree 로 잔존. rag-search.service.ts 의 PR #511 변경분은 이미 main 에 squash-머지 반영됨.

해당 worktree 는 PR 머지 완료로 활성 사유 없음 — `./cleanup-worktree-all.sh --yes --force` 실행 권장. (cleanup 후 #12 베이스 갱신 시 rag-search.service.ts 가 머지본 기준으로 정렬됨 — 위 #12 WARNING 의 라인 재특정과 연계.)

## 요약
target 13건은 전부 미착수([ ]) 백로그 항목이며 미해결 결정 우회나 active worktree 와의 라인 직접 충돌은 없다. 유일한 동일파일 후보였던 `rag-search.service.ts`(#12 대상)는 active 가 아니라 PR #511 MERGED 의 stale worktree(kb-unsearchable)였고, 해당 변경은 이미 main 에 반영돼 있어 CRITICAL 이 아닌 WARNING(베이스 재확인)으로 분류했다. 핵심 후속 조치는 두 가지: (1) #12 착수 전 perf-backlog-01 을 PR #511 포함 main 위로 rebase 후 CTE 라인 재특정, (2) #1·exec-park 가 `execution-engine.service.ts` 를 같은 시기 손대면 머지 직렬화. worktree 충돌 후보 1건 중 stale 1건 skip, active 동일파일 충돌 0건.

## 위험도
LOW
