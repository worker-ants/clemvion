# Plan 정합성 검토 — `spec/5-system/` (--impl-done)

## 검토 전제

이번 호출은 이전 라운드(`review/consistency/2026/09/15/08_58_18`)의 `--impl-prep` plan_coherence
검토에 대한 후속(`--impl-done`)이다. 실제 코드 diff(`origin/main...HEAD`)는
`codebase/backend/src/modules/triggers/{trigger-config-lock.ts,triggers.service.ts,
trigger-config-lock.spec.ts,__test-utils__/trigger-transaction-mock.ts}` ·
`codebase/backend/src/modules/schedules/schedules.service.spec.ts` 5개 파일이고,
`plan/in-progress/trigger-lock-followups.md`(developer 범위 5건, `spec_impact: none`)가 그 작업
기록이다. `spec/5-system/` 자체 델타는 0(정상 — 코드 전용 PR).

이전 라운드가 낸 WARNING 2건이 이번 diff 에서 실제로 해소됐는지, 그리고 이번 diff 가 다른
`plan/in-progress/**` 문서의 미해결 결정·후속 항목과 새로 충돌하는지를 확인했다.

## 발견사항

- **[INFO] 이전 라운드 WARNING 2건 — 실제로 해소 확인됨**
  - target 위치: `plan/in-progress/trigger-lock-followups.md` `--impl-prep 처분` 표 (W2·W3 행)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4463-4499`
  - 상세: (1) `08_58_18` W1(=이번 트래커의 W2) — `trigger-config-lock.ts`/`schedules.service.ts`
    가 `spec/5-system/` 어떤 `code:` glob 에도 안 걸리는 기지 gap — 이번 PR 이 새 항목
    `5b`(`spec/data-flow/11-workflow.md §3.1` CASCADE 열거에 `trigger` 누락)를
    `spec-draft-nullable-notation-followups.md:4466`에 실제로 추가했다. `git -C … show
    HEAD:spec/data-flow/11-workflow.md` 로 재확인한 결과 §3.1 상태 다이어그램은 지금도
    `CASCADE: nodes/edges/versions/executions/assistant_sessions` 만 나열하고 `trigger` 가
    없어 — 지적이 실측대로 정확하고 등재도 됐다. (2) `08_58_18` W2(=이번 트래커의 W3) —
    반증된 "삭제 경로 둘" 전제가 살아있는 트래커에 남아있던 문제 — `spec-draft-
    nullable-notation-followups.md:4488`에서 원문을 취소선으로 보존하고 "삭제 경로는
    셋" 실측을 이어 붙였다. `CHANGELOG.md`(루트) 도 같은 문구를 인용부호로 보존하며
    정정 각주를 달았다. 둘 다 이번 diff 에 포함되어 있음을 `git diff origin/main...HEAD`
    로 확인.
  - 제안: 없음(확인 기록). 처분이 실제로 이행됐다는 근거로 남긴다.

- **[INFO] `plan/complete/trigger-lock-followups.md` 로의 전방 참조가 아직 존재하지 않는 경로를
  가리킨다 — 마무리 커밋 전 임시 상태로 판단**
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4494`
    (`> ✅ 2026-09-15 — 2~6 해소 (plan/complete/trigger-lock-followups.md, 브랜치
    claude/trigger-lock-followups-0c79a0)`)
  - 관련 plan: `plan/in-progress/trigger-lock-followups.md` (frontmatter `status: in-progress`,
    파일이 여전히 `plan/in-progress/`에 위치. 자체 체크리스트의 "[x] 트래커 갱신 + plan →
    `complete/`" 항목은 체크되어 있으나 실제 이동은 아직 일어나지 않았다 — `ls
    plan/complete/trigger-lock-followups.md` 는 파일 없음)
  - 상세: 지금 이 링크를 따라가면 404 다. 다만 같은 plan 문서의 마지막 체크리스트 항목이
    "`/ai-review` + `--impl-done` — **1라운드로 종결**" 아래에 "`--impl-done` 은 아래 항목"
    이라고만 적어 두고 실제 결과를 비워 둔 상태라, 이 호출(현재 `--impl-done` 실행)의 결과를
    받아 적은 뒤 같은 "마무리 커밋"에서 plan 이동이 뒤따를 개연성이 높다(사용자 메모
    `feedback_plan_checkbox_actual_state.md` 의 "체크와 `complete/` 이동은 한 동작" 관례와도
    합치). 즉 현재 HEAD 는 이 워크플로의 중간 스냅샷일 가능성이 크며, 그 자체로 결정 충돌이나
    선행 plan 미해소는 아니다. 다만 이 상태로 push 되면 다른 세션이 그 링크를 따라가 실패할
    수 있다.
  - 제안: 이번 리뷰(impl-done) 통과 후 마무리 커밋에서 (a) `trigger-lock-followups.md` 를
    실제로 `plan/complete/`로 이동하고 frontmatter `status`를 갱신하거나, (b) 최종적으로
    옮기지 않기로 하면 트래커의 해당 문구에서 `plan/complete/` 경로 언급을 제거할 것. 체크된
    "[x] 트래커 갱신 + plan → `complete/`" 항목도 실제 이동 완료 시점에 맞춰 커밋 순서를
    맞출 것.

- **[INFO] 이번 diff 가 다른 `plan/in-progress/**` 문서의 미해결 결정과 충돌하지 않음 —
  교차 확인**
  - target 위치: `codebase/backend/src/modules/triggers/{trigger-config-lock.ts,
    triggers.service.ts}` diff 전문
  - 관련 plan: 전체 `plan/in-progress/**` (65개 목록 grep)
  - 상세: `findByIdForUpdate`/`TRIGGER_DELETE_LOCK_TIMEOUT_MS`/`trigger-config-lock`/
    `rewriteTriggerConfigLocked` 식별자를 `plan/`·`spec/` 전수 grep 한 결과, 참조는 이번
    작업 문서 두 개(`trigger-lock-followups.md`, `spec-draft-nullable-notation-followups.md`)와
    봉인된 `plan/complete/trigger-config-lost-update.md`(이력 보존, 수정 대상 아님) 뿐이다.
    `rewriteTriggerConfigLocked` 반환값을 여전히 무시하는 호출부 2곳
    (`triggers.service.ts:876` `normalizeNotificationSecretRef` 경유,
    `chat-channel-binder.service.ts:310` degraded fallback)은 이번 PR 범위 밖으로 남겼고,
    트래커 항목 8로 정확히 등재돼 있어 "후속 항목 누락"에 해당하지 않는다. 창 1
    (`TriggersService.update()`의 인라인 `save()`)의 FK CASCADE 미검증도 "추정, 미확정"으로
    올바르게 hedge 되어 항목 7로 등재됐다.
  - 제안: 없음(확인 기록).

## 요약

이전 `--impl-prep` 라운드가 지적한 두 WARNING(코드-스펙 `code:` glob 미커버리지 gap 의
planner 등재, 반증된 "삭제 경로 둘" 전제의 정정)은 이번 diff 에서 실제로 이행됐음을
`git diff`·`spec/data-flow/11-workflow.md` 재확인으로 검증했다. 새로 발견된 결함(FK CASCADE
로 인한 `affected===0` 실결함)과 그 파생 후속(창 1 미검증·호출부 2곳의 반환값 무시)도 모두
살아있는 트래커(`spec-draft-nullable-notation-followups.md`)에 올바른 hedge 수준으로 등재되어
있어 "후속 항목 누락"에 해당하는 CRITICAL/WARNING 은 없다. 유일하게 남는 것은 트래커 문서가
아직 존재하지 않는 `plan/complete/trigger-lock-followups.md` 경로를 선반영해 인용하고 있는
점인데, 이는 이 `--impl-done` 결과를 받아 적을 마무리 커밋에서 plan 이동이 뒤따를 것으로
보이는 중간 상태로 판단되며 차단 사유는 아니다.

## 위험도

LOW
