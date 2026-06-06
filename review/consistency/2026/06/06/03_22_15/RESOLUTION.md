# RESOLUTION — `--impl-done spec/5-system` (03_22_15)

**BLOCK: YES** (Critical 2 / Warning 2 / Info 11). 처리:

## Critical — 본 PR(exec-park-pr-b2) 의 결함 아님 (cross-worktree, 문서화·완화 완료)

| # | 발견 | 판정·처리 |
|---|------|-----------|
| C1 | `impl-concurrency-cap-pr2b` 브랜치가 `4-execution-engine.md` 를 Phase B 이전 모델로 회귀 + `exec-park-durable-resume` 를 `pending_plans` 에서 삭제 | **타 worktree 이슈 — 본 PR 무관**. `claude/impl-concurrency-cap-pr2b` 는 미머지·PR 없음. 본 PR-B2 가 고칠 수 없다(다른 브랜치). **이미 식별·완화**: `exec-intake-queue-impl.md` PR2b 착수조건에 "PR-B2 머지 후 origin/main rebase 선행 필수"(spec 두 파일) 명기 완료(commit 6cf89845). memory `reference_consistency_check_main_baseline_fp` 패턴(feature-branch 검사가 타 브랜치 divergence 를 본 작업 결함처럼 보고). |
| C2 | 같은 pr2b 브랜치가 `1-auth.md §3.2` RerankConfig RBAC 행 + `rerank_config.*` 감사 로그 삭제(rag-rerank-followup 완료분 회귀) | **타 worktree 이슈 — 본 PR 무관**. pr2b 의 범위 밖 변경(concurrency cap 과 무관). pr2b rebase 시 자연 해소. 본 PR-B2 는 `1-auth.md` 미수정. |

> C1/C2 의 BLOCK 은 **`impl-concurrency-cap-pr2b` 브랜치의 stale spec** 에서 비롯되며, 본 PR-B2 의 변경(execution-engine §4.x/§6.2/§7.5/§Rationale, data-model §2.13)은 모두 origin/main 위에 정합하게 추가됐다. pr2b 가 rebase 하면 해소된다(그 worktree planner 담당, 착수조건 명기됨).

## Warning

| # | 발견 | 처리 |
|---|------|------|
| W2 | `4-execution-engine.md` D6 절(§6.2 (e)/§7.5/§Rationale)이 현재형 서술이나 재귀 재진입 로직 미구현 | **fix** — 3곳에 "**구현 상태(2026-06-06): V087 컬럼·타입·`CALL_STACK_SCHEMA_VERSION` 영속 매체는 추가됨(설계 확정); park stage·재귀 rehydration 은 PR-B2 후속 커밋 구현·미구현, 그 전까지 컬럼 NULL·기존 동작**" 표식 추가. §4.x 정직화와 동일 over-claim 방지. |
| W1 | pr2b 가 `1-auth.md §1.5.4` historical-artifact 주석 삭제 | **타 worktree 이슈** (C2 와 함께 pr2b rebase 시 해소). 본 PR 무관. |

## Info (선별)

- **I1/I2/I3** (`spec/data-flow/3-execution.md` Schema 매핑에 `resume_call_stack`·`conversation_thread`·`user_variables` 누락 + alt 분기 주석): **이월** — data-flow 동기화는 PR-B2 행위 구현 커밋과 함께(behavior 가 실제 동작할 때). conversation_thread/user_variables 누락은 A1/A3 선례부터의 기존 갭(본 PR 도입 아님).
- **I11** (D6 per-node 기각 cross-link): §Rationale D6 에 이미 "per-node task queue 기각과 다른 범주" 명시함. §4.2/§7.5 인라인 cross-link 은 행위 구현 시 보강.
- **I7/I8/I9** (`11-mcp-client.md`·`_product-overview.md` nav·`1-auth.md` Overview 섹션): 본 PR 무관한 기존 문서 구조 — 다음 spec 편집 시 일괄.
- **I5/I6** (data-model dead-link 위험·전이표 NodeExecution/Execution 구분): 기존 문서, 본 PR 무관.

## 결론
- 본 PR-B2 의 spec 변경은 정합(W2 over-claim 표식으로 정직화 완료).
- BLOCK 의 원인 C1/C2 는 **타 worktree(`impl-concurrency-cap-pr2b`) 의 stale spec** 이며 본 PR 이 해소 불가 — 이미 PR2b 착수조건(rebase 선행)으로 완화됨. 사용자 보고 대상.
- 행위 구현(turn-park·재귀 rehydration·full B3) + data-flow 동기화(I1~I3)는 같은 PR 후속 커밋(deferred-within-PR).
