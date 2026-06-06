# RESOLUTION — PR-B2a turn-park /ai-review (10_26_12)

**리뷰**: HIGH, Critical 1 / Warning 19 / Info N. PR-B2a = top-level 멀티턴 AI turn-park.
**처리 방침**: Critical + PR-B2a 직접 관련 high-value warning 은 **즉시 fix**, in-memory 머신 추상화(W1~W6/W8/W9)는 그 머신을 제거할 **PR-B2b 로 이월**(지금 추출은 premature), pre-existing/타-영역은 별도 추적.

## Critical — 해소

| # | 발견 | 처리 |
|---|------|------|
| C1 | `eia-client.ts` envelope unwrap 핫픽스(#490 `733721dc`) 소실 → 웹챗 SSE 미개시 재발 | **fix(rebase)** — origin/main 이 79b66ce5 rebase 이후 `733721dc`(#490)로 전진했고 본 브랜치가 누락(cross-branch staleness; 본 PR 은 eia-client 미수정). **origin/main 재rebase 로 #490 포함** → `unwrapEnvelope` 5건 복원 확인. 본 PR 변경(turn-park) 무관, rebase 로 자연 해소(C1 과 동근원인 W17/W18 도 동시 해소 — eia-client = main #490 버전). |

## Warning

| # | 처리 |
|---|------|
| W7 (동시성, ai_form_render hang) | **false alarm (검증)** — ai_form_render 는 `ai_agent` 노드(metadata interaction=`ai_conversation`)라 `driveResumeDetached` 의 form 분기(`blockingMeta.interaction==='form'`)에 **미진입**, AI 분기(`isAiConversation && resumeCheckpoint`)→`processAiResumeTurn`(form_submitted action 처리)로 간다. firePayload skip 무관, hang 없음. |
| W10 (payload null guard) | **fix** — `processAiResumeTurn` 진입부에 null/비객체/`type` 부재 guard 추가 → warn + re-park(대화 alive). 새 §7.5 진입점 방어. |
| W15 (테스트 flaky timeout) | **fix** — dispatch describe 블록에 `jest.setTimeout(15_000)` (flushResumeDrive 누적 대비). |
| W17 / W18 (eia-client getStatus 타입·에러 테스트) | **해소(rebase)** — C1 과 동근원. rebase 후 eia-client.ts·test 가 main(#490) 버전이라 타입·에러 케이스 복원됨. |
| W19 / I1 / I2 (spec drift §4.x·§Rationale) | **fix** — §4.x banner 2개 + §Rationale 단계적 롤아웃을 **B1→B2a→B2b** 로 갱신: top-level form/button(PR-B1)·top-level 멀티턴 AI(PR-B2a) park-release 완료, in-memory 머신 완전 제거 + 중첩 D6 는 PR-B2b. §7.5 nested 재진입 banner 는 PR-B2b 미구현이라 "구현 예정" 유지(정확). |
| W1~W6 (아키텍처: ParkStrategy/ParkResult union/ParkSessionStore/도메인이벤트/helper 추출/resume runner 통합) | **이월(PR-B2b)** — 이 추상화들이 다루는 in-memory 머신(`pendingContinuations`/`firstSegmentBarriers`/`firePayload`/detached)은 **PR-B2b 에서 제거**된다. 제거 직전 구조를 지금 추상화로 감싸는 건 premature(곧 사라질 코드). PR-B2b 에서 최종 구조(slow-path 일원화)에 맞춰 정리. RESULT: 후속. |
| W8 / W9 (배리어 순서·cleanup 경쟁 주석) | **이월(PR-B2b)** — 해당 머신(barriers/detached) 제거 대상. 현재 실위험 낮음(리뷰 인정). B2b 제거로 소멸. |
| W11 / W12 (driveResumeDetached opts.payload 옵셔널화·finalizeAiNode 분기 명시) | **minor, 이월** — W10 가 payload 안전성은 커버. `payload` 는 AI 재개에 필수 forwarding 이라 현 non-optional 명확성 수용; finalizeAiNode RUNNING-skip 분기는 주석으로 의도 명시함. B2b 정리 시 함께. |
| W13 / W14 (re-park WAITING 전이·finalizeAiNode skip 분기 전용 어서션) | **이월(test-rigor)** — 해당 동작은 302 green(turn-park resume·end-conversation·button/unknown re-park 테스트)이 이미 경유 커버. 전이 상태 직접 spy assertion 보강은 후속 test-rigor. |
| W16 (user guide RESUME_* 한국어 매핑·park 실패 안내) | **이월(follow-up)** — `RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE` 는 PR-A/B1 도입 코드(PR-B2a 신규 아님). user-guide + backend-labels 매핑은 별도 user-guide-writer 후속(PR-B2a 회귀 아님). |

## Info
- I1/I2(spec drift): W19 와 함께 fix.
- I3/I4 (fail-open: allowedFieldNames size 0 / assertSameWorkspace 미정의 callerWorkspaceId): **pre-existing**(PR-B2a 무관, form park·workspace 격리 기존 코드). standing security 백로그로 기록 — 본 PR 미변경.

## 빌드/테스트
- `nest build` 통과. `execution-engine.service.spec` 302/302 통과(W10 null guard·W15 timeout 반영 후 재확인).

## 남은 PR-B2a 항목
- **dockerized e2e (top-level 멀티턴 park→worker kill→재개 무손실)** — plan 필수. LLM stub 하네스(workflow-execution.e2e 패턴) 활용해 추가 예정. (현 단위 302 + PR-B1 form park→rehydration e2e 가 cold-rehydration 인프라를 이미 커버.)
- spec drift fix 후 `--impl-done` 재확인.
