# RESOLUTION — `--impl-done spec/5-system` (03_34_46) — 터미널

**BLOCK: YES** (Critical 2 / Warning 5 / Info 12).

## Critical

| # | 발견 | 처리 |
|---|------|------|
| C1 | spec 본문 `D6` 레이블이 AI 노드 spec(`1-ai-agent.md` 등)의 기존 `D6`(다른 결정)와 충돌 | **fix** — `4-execution-engine.md`(§6.2 (e)·§7.5·§Rationale) + `1-data-model.md` 의 D6 참조를 **`exec-park D6`** 로 스코프 + §7.5·§Rationale 에 "AI 노드 D6 와 무관" 명시 노트 추가. plan 의 D6(plan-internal)는 유지. bare-D6 잔존 0건 확인. |
| C2 | active worktree `impl-concurrency-cap-pr2b` 가 `4-execution-engine.md` 를 Phase B 이전 모델로 보유 → 충돌 위협 | **본 PR 해소 불가 — 외부 worktree (터미널)**. `claude/impl-concurrency-cap-pr2b` 미머지·PR 없음. git 반증: 본 PR 변경은 origin/main 위 clean 추가(Phase B 회귀 아님). **이미 완화**: `exec-intake-queue-impl.md` PR2b 착수조건에 "PR-B2 머지 후 rebase 선행"(spec 2파일) 명기(6cf89845). **이 Critical 은 본 PR 의 어떤 변경으로도 사라지지 않으므로 `--impl-done` 은 pr2b rebase 전까지 영구 BLOCK** — hook escape("외부 사정 보고")로 사용자에게 보고. (memory `reference_consistency_check_main_baseline_fp` 패턴.) |

## Warning (요약)
- **W1**(error-codes `forbidden`/`rate_limited` "초대 흐름 한정" 단서) · **W2**(graph-rag Overview 이중 계층) · **W3**(graph-rag dead-declared 이벤트) — **본 PR 무관** 기존 문서 이슈. 다음 해당-영역 편집 시 처리.
- **W4**(C5 commit 순서 — spec 완료형이 코드보다 앞서면 역전): 본 PR 은 §4.x 배너를 **interim 유지**(turn-park 미구현이라 완료형 flip 안 함), D6 spec 은 "설계 확정·미구현" 표식 — spec↔구현 역전 방지함(W4 의도 충족).
- **W5**(D6 재귀 경로 ↔ node-cancellation §2 abortSignal 겹침): node-cancellation §2 cross-link 에 "B3 결과 위 rebase" 이미 기재(commit d51b0ef3 직전 작업). 재귀 경로 abortSignal 커버는 행위 구현 시.

## Info
- I1/I2(active_running_ms 마이그번호·auth 엔드포인트) · I7~I10(문서 구조·이모지·skipReason) — **본 PR 무관** 기존 문서. 
- I4/I5/I6(Rationale 명확성·§7.4 시점 태그) — 서술 보강, 행위 구현 시 일괄.
- I11(PR3 이관 체크박스 대응) — plan 정리, 행위 구현 phase.
- I12(`CALL_STACK_SCHEMA_VERSION`/`CHECKPOINT_SCHEMA_VERSION` 유사) — 의도된 독립(주석 명시). 충돌 없음.

## 결론 (터미널)
- 본 PR(exec-park-pr-b2) 의 **my-work 지적은 전부 해소**: W2(D6 over-claim, 03_22_15)·C1(D6 레이블, 03_34_46).
- **잔여 BLOCK 은 C2(외부 `impl-concurrency-cap-pr2b`)** 단일 원인 — 본 PR 변경으로 제거 불가, pr2b rebase(타 worktree 담당)로만 해소. `--impl-done` 재실행은 동일 C2 로 영구 BLOCK(무한 루프)이므로 중단하고 사용자에게 보고한다(hook escape).
- 행위 구현(turn-park·재귀 rehydration·full B3)·data-flow 동기화는 같은 PR 후속 커밋(deferred-within-PR).
