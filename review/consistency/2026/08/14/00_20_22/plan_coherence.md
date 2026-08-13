STATUS=success plan_coherence — CRITICAL 0 / WARNING 0

===REPORT_MARKDOWN_BELOW===

# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 배경

`git diff origin/main...HEAD` 기준 `spec/`(`spec/5-system/` 포함) 변경분은 0건이다. 이번
diff 는 순수 코드 결함 수정이다 — `plan/in-progress/update-returning-tuple-shape.md`(현재
worktree `eia-r8-cache-scope-4ae434`)가 규명한 "TypeORM `UPDATE`/`DELETE … RETURNING` 은
`[rows, rowCount]` 튜플인데 8곳이 행 배열로 다뤘다" 결함을, `execution-engine`·
`knowledge-base`·`auth-oauth`(OAuth 콜백 state 소비, `codebase/backend/src/modules/auth/
auth-oauth.service.ts`) 8개 소비 지점에 걸쳐 정정한 것이다. `spec/5-system/` 자체를 바꾸지
않았으므로 target 문서가 새 결정을 내리거나 기존 서술을 뒤집는 행위 자체가 없다 — 미해결
결정 충돌(관점 1) 가능성은 이 diff 구조상 낮다.

이 회차(`00_20_22`)는 직전 회차(`review/consistency/2026/08/14/00_00_45`) plan_coherence 가
낸 WARNING 2건에 대한 재검토다. 두 건 모두 커밋 `304679959`("test(e2e): OAuth 콜백을 실
드라이버로 고정")에서 반영됐음을 diff·plan 본문 대조로 확인했다.

## 직전 WARNING 반영 확인

1. **`exec-intake-followups.md` 소급 정정 배너 (전회 WARNING 1)** — 반영 확인.
   `plan/in-progress/exec-intake-followups.md` "admission 회귀 보강" 항목 바로 위에
   2026-08-14 배너가 삽입돼, 그 항목이 검증한 파라미터 순서·cap 매핑은 유효하지만
   "admission 이 실제로 승인한다" 는 부분은 `[{id:'eSQL'}]`(INSERT 형태) mock 위에서만
   참이었음을 명시한다. 자매 plan(`ie-resume-turn-boundary-cancel.md`·
   `retry-turn-terminal-guard.md`) 과 동일한 톤·구조로 정정돼 세 자매 plan 이 이제
   일관된 상태다.
2. **spec 위임 5건 집결 티켓 등재 (전회 WARNING 2)** — 반영 확인.
   `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 에
   `## 추가 위임 (2026-08-14 #12)` 가 신설돼, `update-returning-tuple-shape.md` 의
   5개 spec 각주(`4-execution-engine.md` §1.1 · `8-embedding-pipeline.md` §7.3 ·
   `10-graph-rag.md` 동시 호출 표 · `data-flow/2-auth.md` OAuth state 소비 ·
   `node-cancellation.md` §2.4)를 표로 재등재하고 원 출처를 포인터로 명시했다.
   `node-cancellation.md` §2.4 항목은 전회 WARNING 2 가 요구한 대로 "행 라벨이 아니라
   소비 경로 단위" 로 영향 있음/없음을 갈라 적어(`finalizeFailedExecution` 등 4개
   영향 있음 vs `assertExecutionNotCancelled`/`FOR UPDATE` 2개 영향 없음), 반대 방향
   drift(가드 자체가 검증 안 된 것처럼 과잉 서술)를 피했다.

## 신규 확인 — 잔여 상태는 위험이 아니라 이미 추적된 pending 상태

- `spec/5-system/4-execution-engine.md`·`spec/conventions/node-cancellation.md` 의
  `pending_plans:` frontmatter 를 직접 열어 대조했다. 둘 다 아직
  `update-returning-tuple-shape.md`(또는 그 위임을 흡수한
  `spec-update-node-cancellation-shutdown-classification.md`)를 목록에 갖고 있지
  않다. 그러나 이는 신규로 발견한 갭이 아니라 `#12` 항목 자신이 "부수: `node-cancellation.md`
  frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 등재" 로 이미 밝힌
  잔여 작업이며, `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 로는 실행할 수 없는
  항목이다(정상적인 권한 경계 — 이후 project-planner 턴에서 처리). CRITICAL/WARNING
  으로 승격할 사안이 아니다.
- `update-returning-tuple-shape.md` 체크리스트의 미완료 항목(`[ ] 후속 ②·③`,
  `[ ] 통합 레벨 관측`(retry-turn-terminal-guard.md), `[ ] CHANGELOG Unreleased`,
  `[ ] 배포 후 관측`)은 전부 "본 PR 뒤로 미룬다" 고 명시적으로 스코프 밖 처리돼 있고,
  target(`spec/5-system/`)의 어떤 서술과도 충돌하지 않는다.
- `spec-update-node-cancellation-shutdown-classification.md` 최상단의 유일한
  미해결 결정(SIGTERM/timeout 유발 abort 를 `cancelled` 로 통일할지 (a)/(b) 택일)은
  이번 diff 의 어떤 코드·plan 변경과도 접점이 없다 — 대상 코드(`shutdown-state.service.ts`)
  는 이번 diff 에서 건드리지 않았고, tuple-shape 수정은 그 결정과 독립적인 별개
  결함 클래스다. 일방적 결정 우회 없음.

## 요약

직전 회차가 지적한 plan_coherence WARNING 2건(자매 plan 소급 정정 누락, spec 위임 5건
고립)이 모두 이번 커밋에서 반영됐다. `spec/5-system/` 자체는 diff 가 없어 target 이
새로 결정을 내리거나 plan 의 미해결 결정을 우회할 표면이 없고, 코드 diff(tuple-shape
버그 수정)가 만든 5건의 spec 각주 필요성은 지금 `spec-update-node-cancellation-shutdown-classification.md`
`#12` 에 정확히 포인터로 등재돼 다음 planner 스윕이 놓치지 않도록 안전망이 걸려 있다.
남은 것은 developer 권한 밖의 `spec/` 반영·`pending_plans:` 등재뿐이며 이는 이미
plan 안에 명시적으로 pending 으로 기록돼 있어 새로운 발견이 아니다. plan 정합성
관점에서 이 PR 을 막을 이유가 없다.

(참고 — 이 세션의 target·diff-base·워크트리 라우팅이 워크트리 이름(`eia-r8-cache-scope-4ae434`)과
실제 체크아웃 브랜치(`claude/raw-query-audit-followups`) 사이에 불일치가 있다는 점은
직전 회차에서 `rationale_continuity` 가 이미 CRITICAL 로 등급화해 orchestrator 인계
표에 반영했다. 이는 다른 worktree/branch 간 동시 작업 라우팅 문제로 본 checker(plan
정합성)의 검토 대상이 아니라 재언급하지 않는다.)

## 위험도
LOW
