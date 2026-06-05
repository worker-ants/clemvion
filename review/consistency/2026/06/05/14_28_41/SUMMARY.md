# Consistency Check (--impl-done) 통합 — A2 contextScope 자동주입 확장

**BLOCK: NO** — Critical 0. 5 checker 수행.

## 조치한 legit 발견
| # | checker | 발견 | 조치 |
|---|---|---|---|
| 1 | plan-coherence(W2) | partial spec(0-common·conversation-thread)의 pending_plans 에 `memory-autoinject-extend.md` 누락 | 두 spec pending_plans 추가 + 공유유틸(conversation-context-injection/schema) code 등재 |

## 검토 후 무조치(이미 충족/minor)
- rationale(INFO): "0-common §10 에 contextScope(stateless) vs memoryStrategy(상태누적) 구분 Rationale 필요" → **내 0-common §10 변경에 이미 포함**(checker 가 merge-base 미사용으로 내 변경 미인지). MOOT.
- cross-spec(INFO): info-extractor §5.4/§5.5 meta 표에 contextInjection 행 — §5.6 이 "첫 진입 1회 주입→state 운반→종결 echo" 이미 설명. minor, 보류.
- plan-coherence(W1): followup-v2 체크박스 contextScope 완료 갱신 — **타 plan(project-planner 영역)**, 별도 grooming.
- naming: NONE(공유유틸/타입/meta 키 충돌 없음 — mapTurns·DEFAULT_CONTEXT_SCOPE_N 이관 패턴 정상).

## ⚠️ FALSE POSITIVE (git 으로 반증 — 본 PR diff 에 없음)
rationale·convention checker 가 본 A2 와 무관한 변경을 보고함. **검증: `git diff 9e65f853..HEAD` 에 migration/error-codes 파일 0개, 1-ai-agent 변경=앵커 1줄뿐, summaryModel 라인은 unchanged context. origin/main ahead-2 = #477(backlog)·#478(rerank) 으로 exec-park 무관.** checker 가 merge-base 대신 repo 전역/origin/main 을 탐색해 타 PR 변경(#467 summaryModel·exec-park V083~085·conversation_thread §8.4·error-codes·invitation)을 본 PR 로 **오귀속**:
- rationale W1(summaryModel/extractionModel 재번복) → FP. 본 PR 은 §12.12 미변경.
- rationale W2(V083/V084/V085 + §8.4 삭제 spec-impl 역정합) → FP. 본 PR 은 migration 0개·§8.4 미변경.
- rationale INFO(_resumeCheckpoint §7.5) → FP. 미변경.
- convention W1(EXECUTION_TIME_LIMIT_EXCEEDED), W2(conversation_thread §8.4), W3(invitation_* 삭제) → FP. 해당 파일 본 PR 미변경.

## checker별 BLOCK: cross-spec NO · rationale NO · convention NO · plan-coherence NO · naming NO
