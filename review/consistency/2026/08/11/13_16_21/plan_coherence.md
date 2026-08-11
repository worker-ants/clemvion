# Plan 정합성 검토 — spec/5-system (트리거 시크릿/토큰 회전 감사, `--impl-done`)

## 검토 방법 메모

- target(`spec/5-system/1-auth.md` 등 bundle)과 `plan/in-progress/spec-sync-auth-gaps.md` (이 PR 이 연결된 plan, `worktree: trigger-rotation-audit`), `plan/in-progress/harness-review-gate-followups.md` (이 PR 이 함께 편집한 별도 plan)를 대조했다.
- `git diff origin/main...HEAD -- plan/in-progress/*.md` 로 이 PR 이 실제로 건드린 두 plan 파일의 변경분을 직접 확인했고, 관련 코드(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts`, `codebase/backend/src/modules/triggers/triggers.{service,controller}.ts`, `spec/conventions/audit-actions.md`)를 절대경로/HEAD 기준으로 열어 plan 서술과 대조했다.
- 저장소는 뮤테이션하지 않았다(`Read`/`git diff`/`git log`/`git show` 만 사용).

## 발견사항

- **[INFO]** `harness-review-gate-followups.md` 상단 요약이 이번에 추가한 3번째 미해결 사유를 반영하지 못함
  - target 위치: 해당 없음 (target 은 spec/5-system, 이 발견은 이 PR 이 함께 편집한 다른 plan 파일 내부 정합성)
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` — `## 현재 상태 (2026-08-10 갱신)` 문단 ("`in-progress/` 에 남는 이유는 이제 **둘**이다") vs 바로 이 PR 이 같은 커밋에서 추가한 새 섹션 `## 병렬 fan-out 중 리뷰어가 실제 저장소를 뮤테이션한다 (2026-08-11, 13_04_55 실측)` (미해결 체크박스 1건)
  - 상세: `git diff origin/main...HEAD -- plan/in-progress/harness-review-gate-followups.md` 로 확인한 바, 이 PR 은 파일 끝에 새 `##` 섹션(미해결 항목 1건)만 append 했고 상단의 "이유는 이제 둘이다" 요약 문단은 손대지 않았다. 그 결과 파일을 처음부터 읽는 사람은 "재 in-progress 사유 = 2건(§11 잔여, origin 기본 브랜치 해석)"이라는 stale 한 카운트를 먼저 보고, 실제로는 이 PR 이 추가한 3번째 사유(뮤테이션 방지 프롬프트 규약 미비)를 요약에서 놓치게 된다. 내용 배치 자체(harness review-gate 결함을 `spec-sync-auth-gaps.md` 가 아니라 harness followups 백로그에 기록)는 성격상 올바르다 — audit 스펙 갭이 아니라 리뷰 하니스 결함이므로.
  - 제안: `harness-review-gate-followups.md` 의 "이유는 이제 둘이다" 문장을 "셋"으로 갱신하고 새 섹션을 목록에 추가(사소하므로 다음 편집 때 함께 처리해도 무방).

- **[INFO]** `spec-sync-auth-gaps.md` 의 `[~] [보안·별도 트랙] @Roles() 미부착...` 항목 원문 중 `rotateBotToken` 예시가 stale (이 PR 이전부터, 이 PR 과 무관)
  - target 위치: 해당 없음 — 우연히 이 PR 이 편집한 `triggers.controller.ts`/`triggers.service.ts` 와 같은 파일을 가리키는 서술이라 교차 확인함
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` — "*특히 `triggers.controller.ts` `rotateBotToken` 은 mutation 인데 `@Roles()` 가 없다*" (`review/code/2026/08/01/13_46_48/security.md` 인용)
  - 상세: `git log -p -S "async rotateBotToken"` 및 `git show 8d84f6e9f`(PR #1103, 2026-08-08, `plan/complete/auth-workspace-membership-guard.md` 로 이미 완료 처리됨)로 확인한 결과, `rotateBotToken` 에는 그 P0 커밋에서 `@Roles('editor')` 가 이미 부착되었다(현재 `triggers.controller.ts:239`). 즉 인용된 "예시" 자체는 더 이상 사실이 아니다. 다만 이 서술은 이번 PR 의 diff 가 건드리지 않은 기존 텍스트이고("원 서술 유지"라고 명시), 항목 자체의 완료 판정은 이미 다른(완료된) plan 에 위임돼 있어 실질적 blocking 은 아니다.
  - 제안: 다음에 `spec-sync-auth-gaps.md` 를 편집할 기회에 그 예시 문구에 "(2026-08-08 `#1103` 로 해소)" 각주만 붙이면 향후 오독을 막는다. 이번 PR 의 스코프는 아니므로 지금 당장 처리할 필요는 없음.

## 확인 완료 (문제 없음)

1. **체크박스 vs 실제 상태**: `spec-sync-auth-gaps.md` 의 "트리거 시크릿/토큰 회전 3종 감사" 항목이 `[ ]` → `[x]` 로 바뀌었고, target(`1-auth.md §4.1`)에 `trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked` 가 "현재 구현된 액션" 표에 실제로 등재돼 있다. `conventions/audit-actions.md §3`(레지스트리 행 + Rationale 두 문단)도 동일 액션명·근거로 동기화되어 있음을 직접 확인했다. 완료 표시는 정확하다.
2. **후속 3건의 정확성**:
   - `AuditLogsService.record()` DB 오류 삼킴 — `audit-logs.service.ts:92-93` 에서 `catch (err) { this.logger.warn(...) }` 로 실제 확인. 정확.
   - `rotateBotToken` 5→6 구간 뮤테이션 잔여 갭 — `triggers.service.ts` 의 `rotateBotToken` 이 4단계 `setupChannel` 이후 `recordAudit` 를 호출하는 구조(코드 라인 1079/1113 부근)와 plan 서술이 일치. 정확.
   - `audit-action.const.ts` 주석 비대화 — 파일이 실제로 141줄(plan 서술과 일치). 정확.
   - 세 항목 모두 `[ ]` 로 정확히 미해결 등재돼 있고, target 의 완료 서술과 충돌하지 않는다(target 은 "구현됨"만 선언하고 이 세 갭은 별도 트랙으로 정직하게 미완 표시).
3. **`harness-review-gate-followups.md` 에 추가한 "리뷰어가 저장소를 뮤테이션한다" 항목의 성격**: 내용은 harness/리뷰 하니스 결함(스코프 리뷰어가 워크트리 안에서 뮤테이션 → 다른 리뷰어 오염)이며 auth 스펙 갭이 아니다. `spec-sync-auth-gaps.md` 가 아니라 `harness-review-gate-followups.md` 에 기록한 배치는 주제상 올바르다. 서로 다른 `worktree:` 프론트매터(이 PR = `trigger-rotation-audit`, 그 plan = `harness-review-ci-backstop-91f379`)를 갖는 것은 본 checker 의 검토 범위 밖이다(`plan-lifecycle.md §3` — "다른 worktree 와의 동시 작업 충돌"은 plan_coherence 에서 명시적으로 제외됨, 한 worktree 가 여러 plan 을 정당하게 다룰 수 있다고도 명시).
4. **잔여 미완 항목 stale 여부**: §1.3 LDAP/SAML, `workflow.executed`(보존 정책 미정과 묶인 유예), "동시 삭제 중복 감사"(W7) 세 항목 모두 이 PR 의 diff·target 변경과 무관한 영역이며, target 문서에서도 그대로 미구현/유예 상태로 남아 있다(예: `workflow.executed` 의 Rationale 이 새 trigger.rotate* 액션에는 "고빈도 유예 원칙이 적용되지 않는다"고 명시적으로 구분해 스스로 경계를 그었다). stale 화 없음.
5. **미해결 결정과의 충돌**: `trigger.rotate*` 액션명·3분할 여부는 plan 이 "spec 카탈로그에 0건이라 별도 planner 턴이 선행돼야 한다"고 명시적으로 남겨둔 미해결 결정이었다. 이 PR 은 그 결정을 planner 턴에서 규약(§2.1 과거분사 + 선례 `integration.rotated`)에 따라 내리고 `conventions/audit-actions.md §3` Rationale 에 기각된 대안(단일 액션+details 서브필드 방식)까지 남겼다 — plan 이 예고한 절차를 그대로 따른 것이지, plan 이 남겨둔 "결정 필요" 항목을 우회·일방 결정한 사례가 아니다.

## 요약

이 PR(`trigger-rotation-audit`)이 완료 표시한 `spec-sync-auth-gaps.md` 의 "트리거 시크릿/토큰 회전 3종 감사" 항목은 target 의 실제 구현·spec 개정과 정확히 일치하며, 등재한 후속 3건(감사 적재 실패 무관측·`rotateBotToken` 뮤테이션 갭 1건·`audit-action.const.ts` 주석 비대화)도 코드로 재확인한 결과 사실과 부합하고 미완으로 정직하게 표시돼 있다. 이 PR 이 앞서 남겨둔 "새 액션명은 별도 planner 턴에서 결정" 이라는 미해결 사항도 규약·선례에 근거해 정상적으로 해소했다. `harness-review-gate-followups.md` 에 병행 추가한 리뷰 하니스 결함 기록은 배치 위치가 올바르나 그 문서 상단 요약 카운트가 갱신되지 않아 사소한 self-consistency 드리프트가 남았고, 별개로 `spec-sync-auth-gaps.md` 에는 이 PR 이전부터 있던 `rotateBotToken` `@Roles()` 관련 예시 문구가 이미 다른(완료된) PR 로 해소돼 stale 한데 방치돼 있다 — 둘 다 이 PR 을 막을 사안은 아니며 차기 편집 시 정리 권고 수준이다. Critical 은 없다.

## 위험도

LOW
