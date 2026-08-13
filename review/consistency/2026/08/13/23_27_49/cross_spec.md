# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, 4차 라운드)

## 검토 범위 확인

`git diff origin/main...HEAD --stat -- spec/` = **0건**. 이번 diff 는 `spec/**` 를 전혀
건드리지 않는다. 실제 변경(3차 라운드 `23_07_12` 이후 추가분 포함):

- `codebase/backend/src/common/utils/update-returning-rows.ts` (+spec) — `detail` 인자
  선택→필수 승격 (최신 커밋 `76203ad63`, ai-review `23_07_11` W4)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — 3라운드째
  stale 하던 제네릭 제거(W1) + 실측 shape 회귀 테스트 3종 추가(W2)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` — `detail` 인자 채움
- `plan/in-progress/{update-returning-tuple-shape.md, retry-turn-terminal-guard.md,
  ie-resume-turn-boundary-cancel.md}` — 소급 정정 배너
- `review/**` (이전 라운드 산출물)

target(`spec/5-system/`) 자체가 무변경이므로 이전 3개 라운드(`20_36_36`→`22_45_25`→
`23_07_12`)와 동일하게 "코드 변경이 함의하는 동작 변화가 spec 의 다른 영역과 새로
어긋나는지" 를 확인했고, 3차 라운드가 지목한 잔여 WARNING 1건의 현재 상태를 재검증했다.

## 발견사항

- **[WARNING] `spec/conventions/node-cancellation.md:198` "✓ mutation 13/13 검증" 캐비엇
  부재 — 3차 라운드에서 이미 지적된 항목, 이번 라운드도 미해소 (carry-forward, 회귀 아님)**
  - target 위치: `spec/5-system/` 자체 diff 없음(파생 확인). 근거는
    `plan/in-progress/update-returning-tuple-shape.md` §"[planner 위임] 소급 각주"
    (193~204행, 4개 spec 문서 각주 목록 — `node-cancellation.md` 는 이 목록에 **없다**,
    3차 라운드 제안 (c) 가 아직 그 목록에 병합되지 않음)
  - 충돌 대상: `spec/conventions/node-cancellation.md:198` (§2.4 status 표 — "retry 재진입
    종결 경로 terminal 가드 | ✓ | ... mutation 13/13 검증")
  - 상세: `git -C <worktree> diff origin/main...HEAD -- spec/conventions/node-cancellation.md`
    = 0건 — 3차 라운드 이후에도 이 문서는 손대지 않았다. 그 사이 코드 쪽은 두 plan
    (`ie-resume-turn-boundary-cancel.md`, `retry-turn-terminal-guard.md`) 모두에 "12+/6~8
    라운드의 종결 판정은 튜플 버그로 `persisted`/`updateExecutionStatus` else 분기가 항상
    상수였던 상태 위에서 나온 것이고, driver 경계 밖(`persisted=false`) 재검증은 아직
    미완료" 라는 소급 정정 배너를 붙였다(3차 라운드가 지목했던 "두 plan 중 하나만 배너"
    상태는 이번 세션 커밋 `f56334c10` 로 해소됨 — 아래 INFO 참조). 그런데 이 인식이
    `spec/conventions/` 쪽으로는 아직 전파되지 않아, `node-cancellation.md` 의 "✓ mutation
    13/13 검증" 은 여전히 캐비엇 없이 "검증 완료" 로 읽힌다 — 실제로는 그 13개 뮤턴트가
    `finalizeGuarded` 의 mock 경계 **안쪽**(`driver.updateExecutionStatus` 가 true/false 를
    줄 때 각각 옳게 반응하는가)만 검증했고, 그 driver 자신(`ExecutionEngineService.
    updateExecutionStatus` else 분기)이 튜플 버그로 이번 PR 전까지 `false` 를 돌려준 적이
    없었다는 사실은 spec 표에 반영되지 않았다.
  - 제안: developer 는 `spec/` 쓰기 권한이 없어 이번 PR 범위 밖 — 이미
    `update-returning-tuple-shape.md` §"[planner 위임]" 목록(4개 spec 문서: execution-engine
    §1.1·embedding-pipeline §7.3·graph-rag 동시 호출 표·data-flow/2-auth OAuth state)에
    다섯 번째로 `node-cancellation.md:198` 를 추가해 "driver 배선 정상화는 2026-08-13,
    `persisted=false` 통합 재검증은 `retry-turn-terminal-guard.md` 소급 재검증 항목 참조"
    각주를 붙이는 것을 planner 턴에서 검토. 기능 결함이 아니라 "검증 완료" 선언의 caveat
    누락이라 위험도는 이전 라운드와 동일하게 낮게 유지한다.

- **[INFO] 3차 라운드 CRITICAL(배너 누락 2/2 중 1/2)이 이번 세션 중 해소 확인**
  - 상세: 3차 라운드(`23_07_12`)는 `retry-turn-terminal-guard.md` 에 소급 정정 배너가
    없다고 지적했다(grep 0건). 커밋 `f56334c10`("'두 plan 모두' 라 써 놓고 한 곳만
    고쳤다 — 네 번째 반복")로 현재 두 plan 모두 배너 + 재검증 체크리스트 항목을 갖췄다
    (`retry-turn-terminal-guard.md` 에 "## 소급 재검증 (2026-08-13 등재)" 섹션 신설,
    `plan/complete/` 이동 전 필수로 명시). `update-returning-tuple-shape.md` 체크리스트의
    "[x] 소급 영향 조사·정정" 항목 텍스트는 여전히 `ie-resume-turn-boundary-cancel.md` 만
    호명하지만(와딩 nit), 본문(105~107행)은 "두 plan 모두" 로 정정된 상태라 실질 조치는
    완료로 판단한다. 새 blocking 사항 아님.

- **[INFO] 코드 4곳 재확인 — 결론 불변 (1~3차 라운드와 동일, 반복 서술 생략)**
  - admission gate 튜플 버그(`spec/5-system/4-execution-engine.md` §4.2/§7.1/§7.5/§8),
    KB CAS 락 2건(`spec/5-system/8-embedding-pipeline.md` §7.3,
    `spec/5-system/10-graph-rag.md` 동시 호출 표, `spec/5-system/3-error-handling.md:196-197`,
    `spec/2-navigation/5-knowledge-base.md:149,216,221`), OAuth state 소비
    (`spec/data-flow/2-auth.md:122-128,274-275,388`) — 이번 라운드 추가 커밋(`76203ad63`)은
    이 4곳의 **결론에 영향 없는** 보강(테스트 강화·stale 제네릭 정리·`detail` 필수화)뿐이다.
    전부 "코드가 이미 문서화된 spec 문언을 뒤늦게 따라잡는" 방향 — 새 데이터 모델·API
    계약·요구사항 ID·RBAC·계층 책임 충돌 없음.

## 요약

이번 4차 라운드에서도 `spec/5-system/` 자체는 완전히 무변경이며, 세션 전체에 걸친 코드
수정(admission gate·KB CAS 락 2건·OAuth state 소비의 TypeORM UPDATE/DELETE 튜플-shape
버그 수정)은 모두 이미 존재하던 spec 문언(§4-execution-engine, §8-embedding-pipeline,
§10-graph-rag, §3-error-handling, 2-navigation/5-knowledge-base, data-flow/2-auth)과
실제 동작을 재정합시키는 방향이라 새로운 Cross-Spec 충돌은 없다. 유일한 잔여 WARNING
(`spec/conventions/node-cancellation.md:198` 의 "✓ mutation 13/13 검증" 이 이번에 밝혀진
mock-경계 한정 사실을 아직 반영하지 못함)은 3차 라운드부터 이어지는 carry-forward 이며,
developer 권한 밖(`spec/` 쓰기 불가)이라 이미 plan 문서에 planner-위임 항목으로 정확히
등재돼 있다 — 이번 라운드는 그 등재 상태가 여전히 유효하고 퇴행하지 않았음을 재확인했다.
3차 라운드가 지목했던 두 plan 문서 간 배너 불일치(CRITICAL 급 문서 정합성 결함)는 이번
세션 중 커밋으로 해소됐다.

## 위험도

LOW
