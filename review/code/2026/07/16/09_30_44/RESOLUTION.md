# RESOLUTION — ai-review round 2 (09_30_44, resolution 커버)

round 1(08_36_49)의 조치 커밋(c8dbe05a5 배치 리팩터 등)을 포함한 현재 HEAD 를 재검토. 위험도 **LOW**, Critical 0, Warning 1.

## 라우터 under-selection 참고

diff(origin/main..HEAD)에 round 1 review 산출물 30개 .md + spec/plan/changelog 가 섞여 router 가 "spec 문서 갱신만" 으로 판단, 코드 reviewer 다수(security/performance/architecture/concurrency/maintainability/side_effect/testing)를 skip했다. 그러나 **resolution 코드(배치 조회·트랜잭션 스코프·dead-path 제거·DRY)는 round 1 에서 이 reviewer 들이 전수 검토 후 낸 권고(W1~W4)를 그대로 구현한 것**이며, unit(208 tests) + e2e(256/256, 배치 조회 경로) 로 커버된다. 따라서 코드 검증 공백은 round 1 review + 조치 정합 + 통과 테스트로 메워진다. (재실행 user_guide_sync: NONE.)

## 조치 항목

| SUMMARY # | 카테고리 | 처분 | 근거 |
|---|---|---|---|
| W1 | requirement/documentation | **수용 (코드 변경 없음)** | `cross-node-warning-rules.md` status `partial→implemented` 승격 시 pending_plans 가 가리키던 followups plan 이 plan/in-progress 잔류(항목 B "resume 턴 timeoutMs+signal" 미완). spec-impl-evidence §3.1 문언("plan 을 complete/ 로 옮기는 commit 에서 승격")과 자구적 불일치. **단**: (a) 자동 가드(`spec-status-lifecycle.test.ts`·`spec-pending-plan-existence.test.ts`) 통과(실측), (b) cross-node-warning-rules 는 §8 전 rule 이 구현돼 실제로 fully implemented(항목 A 가 이 spec 의 유일 Planned surface 였음), (c) 항목 B 는 codebase-only 로 cross-node-warning-rules·ai-agent 어느 spec surface 도 건드리지 않음 → 두 spec pending_plans 에서 제거가 정합. 두 reviewer 모두 최종 위험도 NONE·"코드 revert 대상 아님"·project-planner 사안으로 판정. impl-done(09_13_49) rationale_continuity INFO 와 동일 관찰. §3.1 예외 명문화 또는 항목 A/B plan 분리는 후속(project-planner) — followups plan 백로그에 이월. |

INFO 5건: 모두 spec-code line-level 일치 확인(조치 불요) 또는 diff 밖 pre-existing.

## TEST 결과

resolution 이후 코드 변경 없음(본 라운드는 재검토만) — 직전 조치 커밋 c8dbe05a5 기준 TEST WORKFLOW 전수 통과:

- **lint**: 통과 (0 errors)
- **unit**: 통과 (영향 spec 208 tests 포함)
- **build**: 통과
- **e2e**: 통과 (256/256, 신규 배치 경로 e2e 포함)
