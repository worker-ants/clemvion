# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 전제 확인

- `spec/5-system/**` diff: **0줄** (`git diff origin/main...HEAD -- spec/5-system` 결과 없음). 이번 PR 은 순수 코드 버그 수정(`UPDATE/DELETE … RETURNING` 튜플 shape 오인 8곳 + 그 위에서 드러난 OAuth `remember_me` 컬럼명 결함 1곳)이며 target 문서 자체를 바꾸지 않는다.
- 관련 plan: `plan/in-progress/update-returning-tuple-shape.md`(신규, P1), `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(§"추가 위임 #12" 로 이번 PR 소급분을 집결), `plan/in-progress/exec-intake-followups.md`·`ie-resume-turn-boundary-cancel.md`·`retry-turn-terminal-guard.md`(모두 이 튜플 버그 위에서 내린 과거 판정을 소급 정정하는 배너만 추가).
- 이번 세션 마지막 코드 커밋(`f5ab3040c`, 01:11:33 — 테스트 가드 대칭화 + CHANGELOG 정정 + plan 문구 정정)은 직전 라운드(`review/consistency/2026/08/14/00_54_07`) WARNING 을 반영한 후속으로, target 이나 plan 의 정합성에 새 영향을 주지 않는다.

## 발견사항

- **[WARNING]** `OAUTH_STATE_MISMATCH` 가 중앙 에러 카탈로그(target)에 아직 미등재
  - target 위치: `spec/5-system/3-error-handling.md` §1.2 (인증/인가 에러 표) — 실측 결과 해당 표에 `OAUTH_STATE_MISMATCH` 0건. 자매 코드 `KB_REEMBED_IN_PROGRESS`(§1.8, L197)·`KB_REEXTRACT_IN_PROGRESS`(§1.8, L196)는 등재돼 있어 형식 선례가 이미 있다.
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-08-14 #12)" 표 — `spec/5-system/3-error-handling.md **§1.2 인증/인가 에러**` 에 `OAUTH_STATE_MISMATCH (400)` 등재 + `data-flow/2-auth.md` 상호링크를 명시적으로 위임해 둔 상태(삽입 위치는 초판 "§1.8 인근" 오기를 `f5ab3040c` 에서 §1.2 로 이미 정정 완료).
  - 상세: 이 코드는 이번 PR 전에는 "튜플 shape 오인으로 정상 콜백까지 상시 실패"시켜 사실상 노멀 에러가 아니었고(plan 자체 서술), 수정 후에야 "실제 이상 상황에서만 발생" 이라는 본래 의미로 돌아왔다. 그래서 지금 시점부터 카탈로그 미등재가 실질적인 문서 갭이다. `developer` 는 `spec/` 쓰기 권한이 없어 이 PR 로는 반영 불가 — 이미 project-planner 위임으로 정확히 추적 중이며 새로 만들 항목이 아니다.
  - 제안: project-planner 턴에서 `spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 #12" 를 그대로 집행(§1.2 에 행 추가 + 로그인 OAuth/연동 OAuth 두 표면 중 어느 쪽을 덮는지 명시). 집행 전까지는 `3-error-handling.md` frontmatter `pending_plans:` 에도 해당 plan 을 등재해 역방향 추적성을 확보하는 편이 안전.

## 참고 (INFO)

- **[INFO]** target 3개 5-system 문서의 `pending_plans` 가 아직 `update-returning-tuple-shape.md` 를 가리키지 않음
  - target 위치: `spec/5-system/4-execution-engine.md`(frontmatter — 기존에 `execution-engine-residual-gaps.md`·`retry-turn-terminal-guard.md`·`exec-intake-followups.md` 3건만 등재, 이번 신규 plan 미포함), `spec/5-system/8-embedding-pipeline.md`·`spec/5-system/10-graph-rag.md`(frontmatter 자체에 `pending_plans` 필드 없음).
  - 관련 plan: `update-returning-tuple-shape.md` frontmatter `spec_impact` 가 이 3개 문서(+ `data-flow/2-auth.md`·`conventions/node-cancellation.md`)를 명시 — 그리고 `spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 #12" 의 "부수" 항목이 이미 "5개 문서 전부에 `pending_plans:` 등재" 를 명시적으로 지시해 둔 상태(`spec-pending-plan-existence.test.ts` 는 한 방향 가드라 이 등록을 강제하지 않으므로 규율로만 남는다는 점도 plan 이 자각하고 있음).
  - 상세: `developer` 권한 밖(spec 쓰기)이라 이번 PR 에서 등록되지 않은 것은 정상 — 이미 계획돼 있고 실행만 남은 상태다. 새로운 gap 이 아니라 실행 대기 항목.
  - 제안: 별도 조치 불요 — project-planner 가 §"추가 위임 #12" 집행 시 함께 반영.

- **[INFO]** admission gate 원자성(§1.1)·CAS 락(§7.3/graph-rag §5.1 인근) 소급 caveat 미반영
  - target 위치: `spec/5-system/4-execution-engine.md` §1.1, `spec/5-system/8-embedding-pipeline.md` §7.3, `spec/5-system/10-graph-rag.md` 동시 호출 표.
  - 관련 plan: `update-returning-tuple-shape.md` §후속 "[planner 위임] 소급 각주" 항목이 정확히 이 3곳(+ `data-flow/2-auth.md`·`conventions/node-cancellation.md`)을 표로 명시.
  - 상세: 4개월간 이 spec 서술을 위반했던 버그가 이번 PR 로 수정됐으니, 과거엔 보장이 실효되지 않았다는 caveat 을 소급으로 남겨야 하나 아직 미반영. 이미 project-planner 위임으로 추적 중이라 새 조치 불요.
  - 제안: 별도 조치 불요 — 위 WARNING·다른 INFO 항목과 같은 planner 턴에서 일괄 집행 권고.

## 미해결 결정과의 관계 (충돌 없음 확인)

`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 최상단에 유일하게 열려 있는 "결정 필요" 택일 항목((a) 기존 `failed` 계약 유지 vs (b) `cancelled` 로 재정의 — SIGTERM/timeout 유발 abort 의 최종 상태 분류)은 `shutdown-state.service.ts` 를 대상으로 하는데, 이번 PR 의 diff 는 그 파일을 전혀 건드리지 않는다(`git diff --name-only` 확인). 즉 이번 코드 변경은 그 미해결 결정을 우회하거나 선점하지 않는다 — 무관한 트랙.

## 요약

target(`spec/5-system/`)은 이번 diff 에서 1줄도 바뀌지 않았고, 코드 변경은 이미 spec 이 서술한 보장(admission gate 원자성·CAS 락 거절·OAuth state one-shot 소비)을 실제로 충족시키는 방향의 버그 수정이라 target 과 충돌하지 않는다. 유일하게 남은 실질 갭(`OAUTH_STATE_MISMATCH` 중앙 카탈로그 미등재)과 부수 항목(3개 문서 `pending_plans` 미등록, 소급 caveat 미반영)은 모두 `developer` 권한 밖으로 project-planner 위임 티켓(`spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 #12", `update-returning-tuple-shape.md` §후속)에 구체적으로, 중복 없이 이미 등재돼 있다 — 직전 라운드(`00_54_07`)에서 지적된 항목들이 그대로 유지되고 있을 뿐 새로운 정합성 문제는 발견되지 않았다. 이 PR 이 가정하는 선행조건(TypeORM 반환 shape 실측)은 plan 내에서 자체적으로 검증·완결됐고, 유일하게 열려 있는 "결정 필요" 항목(SIGTERM/timeout 최종상태 분류)은 이번 diff 와 무관한 별도 트랙이라 충돌하지 않는다.

## 위험도

LOW
