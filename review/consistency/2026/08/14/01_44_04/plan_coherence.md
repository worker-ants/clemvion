# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 사전 확인 — target 추론에 대한 정정

이 세션의 워크트리 절대경로(`eia-r8-cache-scope-4ae434`)는 실제 체크아웃 브랜치
(`claude/raw-query-audit-followups`)와 **일치하지 않는다** — 재사용된 워크트리다.
경로에서 "EIA r8 캐시 스코프 작업" 을 추론해 그 델타가 0임을 근거로 "검토 전제
무효" CRITICAL 을 내는 것은, 바로 이 세션의 이전 라운드(`00_00_45`·`01_12_33`)가
이미 낸 오탐이며 `plan/in-progress/update-returning-tuple-shape.md` §후속에
"harness: stale 워크트리 이름이 consistency 검토 대상을 오염시킨다" 항목으로
등재·비차단 확정돼 있다. 본 라운드는 그 오탐을 반복하지 않고, **실제 diff**
(`git diff origin/main...HEAD`)를 근거로 판단했다.

실제 diff 는 `UPDATE`/`DELETE … RETURNING` 이 TypeORM 0.3.31+pg 에서
`[rows, rowCount]` 튜플로 오는데 8개 지점(auth-oauth 소셜 로그인 콜백,
execution-engine admission/updateExecutionStatus, knowledge-base CAS 락 2건 +
재큐 2건)이 행 배열로 오인해 소셜 로그인 상시 실패·admission cap 미집행·KB CAS
락 미작동을 낸 결함의 코드 전용(spec 미변경) 수정 PR 이다. 대상 plan 은
`plan/in-progress/update-returning-tuple-shape.md`(마스터).

## 발견사항

- **[INFO]** `node-cancellation-residual-signal-propagation.md` W11 회귀 테스트의 mock 이 실제 드라이버 튜플 shape 을 반영하지 않는다 (기능적으로는 무해)
  - target 위치: N/A (코드) — `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:7285` (`W11` 테스트)
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 "후속 2" §W11 (완료 표시, `[x]` 상당)
  - 상세: 이 테스트는 `updateExecutionStatus` else 분기(바로 이 PR 이 `updateReturningRows` 로 고친 그 자리)의 0행 매칭을 `mockExecutionRepo.query` 가 `Promise.resolve([])`(bare 빈 배열)로 시뮬레이션한다. 그런데 마스터 plan 이 실측한 실제 드라이버 shape 은 `UPDATE … RETURNING (0행) → [[], 0]`(튜플)이다. `updateReturningRows([])` 와 `updateReturningRows([[], 0])` 는 우연히 동일하게 `.length === 0` 을 내므로 **이 테스트의 결론(persisted=false → stale finishedAt/durationMs 재저장 안 함)은 fix 전후 모두 유효**하다 — ie-resume-turn-boundary-cancel.md·retry-turn-terminal-guard.md 가 겪은 "GREEN 의 근거가 거짓 mock" 패턴과 달리, 이 경우는 mock 이 비사실적이어도 결론까지는 우연히 안전하다.
  - 제안: plan_coherence 관점에서는 정정 불필요(주장이 무효화되지 않음) — 다만 mock 을 실제 튜플 `[[], 0]` 로 맞추는 것은 code-review 성격의 사소한 정합성 개선이라 developer 턴에서 `review/code` 쪽으로 흘려보내는 편이 적절하다. `plan/` 정정은 필요 없다.

- **[INFO]** 소급 각주 위임 티켓(`spec-update-node-cancellation-shutdown-classification.md` "추가 위임 2026-08-14 #12")과 `update-returning-tuple-shape.md` 마스터 체크리스트가 서로를 정확히 가리키는지 재확인 완료 — 새 지적 없음
  - target 위치: `spec/5-system/4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`, `spec/data-flow/2-auth.md`, `spec/conventions/node-cancellation.md` §2.4 (아직 미반영, project-planner 대기)
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` §후속 "[planner 위임] 소급 각주" ↔ `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §추가 위임(2026-08-14 #12)
  - 상세: 5개 문서 caveat 표 + `OAUTH_STATE_MISMATCH` 신규 카탈로그 항목(`3-error-handling.md` §1.2) 둘 다 #12 티켓에 정확히 집결돼 있고, `pending_plans:` 등재 대상도 "5개 문서 전부"로 명시돼 있다. developer 권한 밖이라 미반영 상태이나 이는 정상적인 skill 경계(project-planner 턴 대기)이며 plan 자체의 내적 모순은 없다.
  - 제안: 조치 불요 — project-planner 턴에서 이 티켓을 소비할 때 참고.

## 확인했으나 문제 없음 (교차 검증)

- `ie-resume-turn-boundary-cancel.md`·`exec-intake-followups.md`·`retry-turn-terminal-guard.md` 세 plan 모두 이번 diff 가 반증한 "동시 cancel 방어가 실제로 작동했다" 류 주장에 소급 정정 배너를 이미 갖추고 있다(내용도 서로 모순 없이 일치).
- `KB_REEMBED_IN_PROGRESS`/`KB_REEXTRACT_IN_PROGRESS`/`remember_me`/`OAUTH_STATE_MISMATCH` 를 언급하는 다른 in-progress plan 은 없다 — 이번 fix 가 무효화할 만한 제3의 미포착 claim 없음.
- `backend-lint-gate-broken-on-main.md` 의 "`updateExecutionStatus` else 분기 트랜잭션화"(② 후속) 항목은 마스터 plan 의 "②는 이 PR 뒤로 미룬다" 서술과 정합 — 중복 등재도, 모순도 없음.
- `node-cancellation-residual-signal-propagation.md` 의 BLOCKED 항목("Workflow 단위 timeout 노드 abort 통합", project-planner 결정 대기)은 이번 diff 와 무관한 영역(ShutdownStateService/abortSignal)이라 충돌 없음.

## 요약

실제 코드 diff(origin/main...HEAD, `claude/raw-query-audit-followups`)는 spec 을 전혀
바꾸지 않는 코드 전용 버그 수정이며, 그 부작용으로 이전 라운드들이 "닫혔다"고
기록한 동시성 방어 3건(ie-resume-turn-boundary-cancel.md·retry-turn-terminal-guard.md·
exec-intake-followups.md)의 근거를 소급 무효화한다. 세 plan 모두 이미 정정 배너를
갖췄고, spec 정정이 필요한 5개 문서 + 신규 에러코드 카탈로그 항목은
`spec-update-node-cancellation-shutdown-classification.md` 의 단일 위임 티켓(#12)에
정확히 집결돼 project-planner 턴을 기다리는 상태다. 추가로 점검한
`node-cancellation-residual-signal-propagation.md` W11 테스트는 mock shape 이
비사실적이지만 결론은 fix 전후 동일해 무해하다. 미해결 결정을 우회하거나
선행 조건을 누락한 CRITICAL 급 불일치는 발견되지 않았다. 워크트리 경로가
"EIA r8 캐시 스코프" 를 암시하는 것과 실제 작업(raw query 튜플 버그 수정) 간의
불일치는 이미 알려진 harness 결함으로 별도 등재돼 있어 본 라운드에서 재지적하지
않는다(재지적 시 오탐 반복).

## 위험도
NONE
