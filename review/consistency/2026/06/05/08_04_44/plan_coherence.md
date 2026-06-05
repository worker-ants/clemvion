# Plan 정합성 Check — `exec-park-durable-resume.md`

## 발견사항

### [CRITICAL] exec-intake-queue PR3 와 동일 spec 표면·코어 파일 직접 충돌 (병렬 active worktree)
- **target 위치**: Phase A1/A2 (`rehydrateContext`, `_resumeCheckpoint` 견고화, `information_extractor` 멀티턴 checkpoint 확장), Phase B2 (`재개 = 항상 rehydration`, `rehydrateAndResume` 일원화), §SoT `spec/5-system/4-execution-engine.md §7.5`.
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-intake-queue`, branch `claude/impl-exec-intake-queue`, owner: developer, 착수 2026-06-04, PR1 머지·PR2-4 진행 중). 물리 worktree `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-intake-queue`.
- **상세**: 두 plan 이 **동일한 §7.5 rehydration 을 SoT 로 선언**하고 같은 코어 파일(`execution-engine.service.ts`)을 손댄다.
  - exec-intake-queue **PR3**("크래시 RUNNING checkpoint 재개")은 명시적으로 *"stalled active 세그먼트를 §7.5 rehydration 으로 재개. **rehydration 을 `ai_agent` 너머 일반 노드로 확장**. 멱등성: jobId·`NodeExecution.status` 재검증·완료 노드 미재실행"* 을 약속한다.
  - target Phase A2 는 *"information_extractor 멀티턴도 ai_agent 와 동일하게 checkpoint 저장(현재 ai_agent 한정 여부 확인 후 확장)"* 을, Phase B2 는 *"모든 재개가 `execution-continuation` job → `rehydrateAndResume` 로 일원화"* 를 약속한다.
  - 즉 **"rehydration 의 적용 범위 확장 + 멱등 재개 인프라"** 라는 동일 과제를 두 plan 이 독립적으로 인수하고 있다. 코어 함수(`rehydrateContext`/rehydrate 경로, checkpoint allow-list, `buildRetryReentryState`)를 양쪽이 같은 시기에 재작성하면 merge conflict + 의미 분기(어느 쪽 "일원화" 설계가 최종인지) 불가피.
  - branch 실증: `git diff origin/main...claude/impl-exec-intake-queue` 가 `execution-engine.service.ts`·`execution-engine.module.ts`·`queues/execution-run.*`·`spec/5-system/4-execution-engine.md` 를 모두 수정. 최신 커밋 `01bca178` (2026-06-04). PR 부재(Step1 non-ancestor, Step2 empty → Step3 conservative active).
- **제안**: 착수 전 두 plan 의 경계를 명문화해 직렬화한다.
  1. exec-intake-queue **PR3** 가 "rehydration 일반 노드 확장 + 멱등 재개 인프라"의 **소유 plan** 임을 확정하고, target plan B2/A2 는 그 인프라를 **소비/전제**하는 것으로 재기술(중복 구현 금지). target plan 의 "현행 durability 맵"·"미해결 결정 D4(turn-단위 vs 대화-단위 park)"는 PR3 의 세그먼트 재개 모델과 직접 상충하므로 PR3 설계 확정 후 정렬.
  2. 또는 두 트랙을 단일 worktree 로 통합(같은 §7.5 표면이므로). 최소한 target plan §"미해결 결정"에 "D5: exec-intake-queue PR3 과의 rehydration 소유권/순서" 를 추가.

---

### [CRITICAL] target Phase B 가 제거하려는 `firstSegmentBarriers`/W1·W2 로직을 별 worktree 가 동시에 강화 중
- **target 위치**: Phase B1(`runExecutionFromQueue` 의 detached coroutine + `firstSegmentBarriers` 대기 단순화/제거), B3(`firstSegmentBarriers`/`armFirstSegmentBarrier`/`settleFirstSegment`/`signalParkBarrier` 제거 + "#468 의 W1/W2 방어 로직 중 ... 정리").
- **관련 plan**: `fix/exec-engine-park-worker-job-release` (물리 worktree `/Volumes/project/private/clemvion/.claude/worktrees/agent-a71ad1921ae84d695`, owner 미상). 최신 커밋 `c9eb02a2` *"docs(spec)+test(execution-engine): §4.x 구현 메모 + 배리어 엣지 커버리지 (후속 #2/#3)"*, 2026-06-05 **07:52** — 본 plan 작성(08:04)과 같은 날 직전.
- **상세**: 이 branch 는 정확히 target B1/B3 의 대상인 **배리어(`firstSegmentBarriers`) 메커니즘에 엣지 커버리지 테스트와 §4.x 구현 메모를 추가**하고 있다 (main 의 직전 커밋 `dbb0a7ea` *"ai-review W1/W2 반영 — 배리어 중복 arm 가드 + setup throw FAILED 마킹"* 의 후속). 즉 한 worktree 는 배리어를 정교화·문서화하는데, target plan 은 그 배리어를 **통째로 삭제**하려 한다. 두 작업이 같은 함수(`execution-engine.service.ts` 의 `armFirstSegmentBarrier`/`settleFirstSegment`)·같은 spec 절(`4-execution-engine.md §4.x` 구현 메모, line ~401-403)을 손대 직접 라인 충돌 + 노력 낭비(추가한 배리어 테스트가 삭제 PR 에서 폐기).
  - `git diff origin/main...c9eb02a2` 가 `execution-engine.service.ts`·`.spec.ts`·`spec/5-system/4-execution-engine.md` 수정 확인. Step1 non-ancestor, PR 부재 → active.
- **제안**: 순서 강제. `fix/exec-engine-park-worker-job-release` 가 #468 후속(배리어 정확성 fix)으로서 **먼저 머지**되도록 하고, target Phase B 는 그 머지 후 baseline 위에서 "park 즉시 해제"로 배리어를 제거한다(배리어 정교화→삭제 순서가 역전되면 fix 가 의미 없어짐). 또는 fix worktree 담당자와 합의해 배리어 fix 를 target Phase B 에 흡수(중복 제거). target plan §진행 메모에 이 의존성을 명시.

---

### [WARNING] target plan 의 main 기준점(`9f30216f`)이 #468 머지 커밋과 불일치 — durability 맵 stale 가능
- **target 위치**: §진행 메모 *"#468 머지 확인(main `9f30216f`)"*, §본문 헤더 *"SoT: `9f30216f`"* 류 기준. (durability 맵 전체가 이 커밋 기준 조사.)
- **관련 plan/사실**: 현재 worktree HEAD = `9f30216f` 이나, `dbb0a7ea`("ai-review W1/W2 반영 — 배리어 중복 arm 가드 + setup throw FAILED 마킹")·`20f600f9`("user-interaction 대기 시 worker job 반환")가 main 최근 커밋으로 존재. target 이 분기한 시점 이후 배리어/park 동작이 main 에서 추가 변경됐다.
- **상세**: target 의 "현행 durability 맵"·"in-memory 전용(rehydration 시 손실)" 목록은 특정 시점 `execution-engine.service.ts` 조사 결과다. main 이 그 사이 배리어 arm 가드·worker job 반환을 추가했으므로(park 동작 변경), 맵의 일부(예: park 시 worker job ack 타이밍, W1/W2 가드 존재 여부)가 이미 stale 일 수 있다. stale 맵 위에서 Phase B 제거 범위를 산정하면 "이미 main 이 정리한 것"을 재작업하거나 "main 이 새로 의존하게 만든 것"을 놓칠 수 있다.
- **제안**: 착수 직전 `git rebase origin/main`(또는 merge) 후 durability 맵을 재검증. 특히 §진행 메모의 "현행 durability 맵" 을 최신 main(배리어 가드·worker job 반환 포함) 기준으로 재확인하고, B3 의 "W1/W2 방어 로직 중 불필요해진 부분" 범위를 그 최신 상태로 재산정.

---

### [WARNING] target D1(conversationThread DB 컬럼 신설) 이 방금 재확인된 "신규 DB 컬럼 없음" 정책과 정면 충돌 — 결정 충돌
- **target 위치**: Phase A1 (*"thread 영속 매체 결정: `node_execution` JSONB 컬럼 추가 vs 별도 테이블 vs `_resumeCheckpoint` 내 포함"*, *"conversation-thread.md '신규 DB 컬럼 없음' 정책 재검토 → 정책 변경 시 Rationale 명문화"*), 미해결 결정 D1.
- **관련 plan/spec**: `spec/conventions/conversation-thread.md` line 211 *"**v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음.**"* + line 213 — 이 조항은 `ai-context-memory-auto.md`/`followup-v2`(완료) 작업이 **2026-06-03~04 에 막 재확인**한 것: *"`runningSummary`/`summarizedUpToSeq` 는 ExecutionContext(Redis 직렬화)에 thread 의 일부로 포함되며 ... **별도 DB 컬럼을 만들지 않는다**"*. 또한 `spec/5-system/4-execution-engine.md` line 726 도 *"별도 `_continuationCheckpoint` 컬럼 신설하지 않는다 — 기존 SoT 인 `NodeExecution.outputData` 를 §7.5 rehydration 의 단일 진실로 활용"* 로 동일 방향을 명시.
- **상세**: target plan 은 "park 직전 conversationThread 를 durable 저장"을 무손실 rehydration 의 전제로 삼는데, 후보 매체 중 "JSONB 컬럼/별도 테이블"은 두 spec 의 현행 정책(신규 컬럼 금지, `NodeExecution.outputData` 단일 진실)을 뒤집는 결정이다. 이 정책은 ai-context-memory 작업이 막 강화한 것이므로, target 이 D1 을 일방적으로 "컬럼 신설"로 확정하면 (a) 두 spec 의 방금-확정 조항과 모순, (b) ai-context-memory 의 Redis 직렬화 영속 경로(이미 구현된 `runningSummary` rehydration)와 이중 영속 경로 발생.
- **상세 — 정합 가능 경로**: 단, target 이 후보로 든 "`_resumeCheckpoint` 내 포함"·"`NodeExecution.outputData` 활용"은 위 두 정책과 **정합**한다(컬럼 신설 없이 기존 SoT 확장). 즉 D1 은 충돌이 아니라 "올바른 매체 선택"으로 닫을 수 있다.
- **제안**: D1 을 "신규 DB 컬럼 신설" 이 아니라 **기존 `NodeExecution.outputData` / `_resumeCheckpoint` / ExecutionContext-Redis 경로 확장**으로 우선 검토하도록 plan 에 가드를 추가. 컬럼/테이블 신설이 불가피하다고 판단되면 conversation-thread.md·4-execution-engine.md §7 의 "신규 컬럼 없음" 조항 개정을 **project-planner 선행 + consistency-check --spec** 으로 처리(target 의 "Spec 변경" 절에 conversation-thread.md 가 이미 들어있으나, 그 변경이 ai-context-memory 의 방금-확정 조항을 뒤집는다는 점을 명시 필요).

---

### [WARNING] Phase B "fast-path 제거"가 spec §7.4/§7.5 의 의도된 in-instance fast-path 설계와 충돌 — spec 개정 선행 필요
- **target 위치**: Phase B2 (*"continuation 처리(`applyContinuation`)에서 fast-path(`pendingContinuations.has`) 제거 또는 ... 강등(의존 금지)"*), Spec 변경 절(§4.x fast-path 제거 반영, §7.5 무손실 보장).
- **관련 spec**: `spec/5-system/4-execution-engine.md` line 820 *"로컬 `pendingContinuations` 에 키가 있으면 즉시 resolve (in-instance fast path). 없으면 §7.5 rehydration 경로 (slow path)"*, line 835-841 fast/slow path 다이어그램, line 403 *"park 후 `runExecution` 코루틴은 in-process 로 살아 있어 ... 무손실 fast-path"*.
- **상세**: 현 spec 은 fast-path 를 **의도된 정상 설계**로 명문화하고 있고, line 403 은 target 이 추진하는 전환("park 즉시 해제 + slow-path 일원화")을 *"검토 대상이다(추적: execution-engine-residual-gaps.md)"* 라고 **미확정 검토 항목**으로만 표기한다. 즉 spec 은 아직 fast-path 를 제거하기로 확정하지 않았다. target plan 이 코드에서 fast-path 를 제거하려면 §7.4/§7.5/§4.x 의 fast-path 정상-설계 서술을 먼저 개정해야 하며, 이는 project-planner 영역(developer 는 spec read-only).
- **상세 — 미해결 결정 미반영 위험**: 더불어 line 819/841 의 "항상 enqueue — local resolve 는 순수 최적화" 원칙은 fast-path 를 "있어도 그만"으로 두는 것이라, target B2 의 "강등(의존 금지)" 옵션과는 정합하지만 "완전 제거" 옵션과는 충돌(spec 은 local resolve 를 허용된 최적화로 유지). 어느 옵션인지 미확정인 채 B3 가 `pendingContinuations` Map 자체를 제거하면 spec 과 어긋난다.
- **제안**: Phase B 착수 전 `4-execution-engine.md §4.x/§7.4/§7.5` 의 fast-path 서술 개정을 project-planner 가 선행(target "Spec 변경" 절에 §7.4 추가). B2 를 "제거" vs "최적화로 강등(Map 유지)" 중 어느 쪽으로 갈지 미해결 결정으로 명시(현 plan 은 "제거 또는 강등"으로 양립 — 확정 필요). 이 결정 전 B3 의 `pendingContinuations` Map 제거는 보류.

---

### [WARNING] residual-gaps G2 / node-cancellation §2 와의 코드영역·재개 인프라 겹침 미등록
- **target 위치**: Phase B2 "멱등성 보장(동일 turn 이중 실행 0, continuation 유실 0)", Phase A2 cross-instance 재개.
- **관련 plan**:
  - `plan/in-progress/execution-engine-residual-gaps.md` **G2** — 이미 *"exec-intake-queue PR3 으로 cross-instance mid-execution 재개 인프라 부분 해소"* 라고 PR3 의존을 기록. G2 의 잔여(errorPolicy='continue' 분기)는 RUNNING 세그먼트 재개 인프라 위에 얹히므로 target 의 rehydration 일원화와 토대를 공유.
  - `plan/in-progress/node-cancellation-infrastructure.md` **§2**(엔진단 dispatch 직전 abort 사전체크 + `NodeExecution.status='cancelled'` enum/migration) — exec-intake-queue PR3 가 *"`node-cancellation-infrastructure.md §2` 와 코드영역 겹침 → 직렬화 순서: PR3 착수 시 확정"* 라고 이미 충돌 등록. target 의 B 단계도 같은 `execution-engine.service.ts` dispatch/재개 경로를 손대므로 3-way 코드영역 경합(target B · exec-intake PR3 · node-cancellation §2).
- **상세**: 세 plan 모두 `execution-engine.service.ts` 의 RUNNING 세그먼트 재개/dispatch 경로를 손댄다. exec-intake PR3 는 PR3 ↔ node-cancellation §2 직렬화를 이미 의식했으나, target plan 은 이 3-way 경합을 전혀 인지하지 못하고 있다(target §리스크/§진행 메모에 언급 없음).
- **제안**: target plan §리스크 또는 §미해결 결정에 "`execution-engine.service.ts` 재개/dispatch 경로를 exec-intake PR3·node-cancellation §2 와 공유 → 직렬화 순서 합의" 를 등록. `NodeExecution.status='cancelled'` enum/migration(node-cancellation §2 = parallel-p2-followups §1) 이 target 의 status 가드(B2 "durable WAITING + status 가드")와 같은 enum 을 건드리는지 확인.

---

### [INFO] spec-exec-intake-queue worktree 가 residual-gaps.md·spec §7 을 이미 편집 — target 의 SoT 가 이동 중
- **target 위치**: §본문 헤더 SoT 참조(§7.4 continuation bus·§7.5 rehydration), 관련 추적 `execution-engine-residual-gaps.md`.
- **관련 plan**: `claude/spec-exec-intake-queue` (worktree `spec-exec-intake-queue`) — `git diff` 가 `plan/in-progress/execution-engine-residual-gaps.md`·`spec/5-system/4-execution-engine.md` 수정. 최신 `789705e8` *"per-node task queue → execution-level intake 큐 재정의"* (2026-06-04). PR 부재 → active.
- **상세**: target 이 SoT 로 삼는 `4-execution-engine.md §4/§7` 과 추적 plan `residual-gaps.md` 는 spec-exec-intake-queue 브랜치에서 **현재진행형으로 재정의**되고 있다. target 이 분기한 baseline 의 §7.4/§7.5 서술이 spec-exec-intake-queue 머지 시 바뀔 수 있어, target 의 인용·전제가 stale 화될 수 있다.
- **제안**: spec-exec-intake-queue / impl-exec-intake-queue 머지 후 baseline 에서 target 의 §7.4/§7.5 인용을 재확인. (CRITICAL #1 의 직렬화 합의에 포함하면 함께 해소.)

---

### [INFO] target plan frontmatter `worktree` 정합 확인 — 충돌 없음
- **target 위치**: frontmatter `worktree: exec-park-durable-resume`.
- **상세**: `git worktree list` 상 `exec-park-durable-resume` worktree(branch `claude/exec-park-durable-resume`, HEAD `9f30216f`)가 실재하며 frontmatter 와 일치. 다른 plan 이 동일 worktree 이름을 점유하지 않음(중복 0).
- **제안**: 없음(정상).

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보에 대해 stale 캐스케이드(Step1 ancestor / Step2 PR MERGED) 적용 결과:

- **stale skip 없음.** 충돌 후보 4건 모두 Step1 non-ancestor + Step2 PR 부재 → Step3 conservative active 로 분석에 포함:
  - `claude/impl-exec-intake-queue` (커밋 `01bca178`, 2026-06-04) — active [CRITICAL #1]
  - `fix/exec-engine-park-worker-job-release` (커밋 `c9eb02a2`, 2026-06-05) — active [CRITICAL #2]
  - `claude/spec-exec-intake-queue` (커밋 `789705e8`, 2026-06-04) — active [INFO]
  - `claude/node-cancellation-engine-6bfcaa` (커밋 `c77df67b`, 2026-06-03) — active [WARNING #6, node-cancellation-infrastructure §2 관련]

충돌 후보 4건 전부 active. PR 없이 active 인 branch 들은 직렬화 합의(위 제안)가 선행돼야 target 착수가 안전하다.

---

## 종합 판정

**BLOCK: YES** — Critical 2건.

target plan(`exec-park-durable-resume`)은 §7.5 rehydration 코어를 (1) `impl-exec-intake-queue` PR3(rehydration 일반 노드 확장 + 멱등 재개)과 동일 표면에서, (2) `fix/exec-engine-park-worker-job-release`(target B3 가 삭제하려는 배리어를 정교화 중)와 정반대 방향으로 동시에 손댄다. 두 branch 모두 active(미머지)이고 같은 `execution-engine.service.ts`·`spec/5-system/4-execution-engine.md` 를 편집한다. 착수 전 **세 트랙(target B / exec-intake PR3 / park-worker-job-release fix)의 소유권·머지 순서 직렬화 합의**가 필수다. 추가로 fast-path 제거(WARNING #5)·conversationThread 영속 매체(WARNING #4)는 spec 정책 개정을 동반하므로 project-planner 선행 + consistency-check --spec 이 필요하다.

직렬화 합의 + D1 매체를 기존 SoT 확장(컬럼 비신설)으로 가드 + fast-path 제거를 spec 개정 선행으로 묶으면 Critical 은 해소 가능하다.
