# Plan 정합성 Check — `spec/data-flow/8-notifications.md`

## 발견사항

- **[WARNING]** `spec-update-notifications-firing.md` 의 team_invite OPEN 결정이 target 에서 해소됐는데 plan 체크박스·완료조건이 갱신되지 않음
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `team_invite` 행 + Rationale "`team_invite` 채널 — 이메일 중복 회피 (channel=`in_app`)" (라인 74, 329-388). 동반 diff: `spec/2-navigation/9-user-profile.md §5.1` 주석 추가, `workspace-invitations.service.ts`/`.spec.ts` 의 `channel: 'both'→'in_app'` 코드 변경.
  - 관련 plan: `plan/in-progress/spec-update-notifications-firing.md` "## 반영할 결정/주의" 항목 `team_invite 이메일 2통 (side-effect 재검토) — planner 결정 대기(OPEN)` (체크박스 `[ ]`), 그리고 문서 하단 "## 완료 조건".
  - 상세: 이 plan 은 (a) 현행 유지 both/2통, (b) 초대링크 이메일 생략, (c) `channel=in_app` 하향 3안을 놓고 "planner 결정 대기(OPEN)" 로 명시했다. target 은 정확히 (c) 를 채택해 §1.1 표 문구·Rationale 신설·§5.1 각주·코드(`workspace-invitations.service.ts`)·테스트까지 일관되게 반영했다 — 즉 **plan 이 미해결로 남긴 항목이 실제로는 이번 변경으로 완전히 해소됐다.** 그러나 이 working tree diff 에는 `plan/in-progress/spec-update-notifications-firing.md` 자체에 대한 수정이 전혀 없다 (`git diff HEAD` 확인 결과 무변경). 체크박스가 여전히 `[ ]` OPEN 으로 남아 있고, "완료 조건" 절도 이 결정 반영을 별도 완료 신호로 언급하지 않는다.
  - 이는 CRITICAL 이 아니다 — target 이 plan 의 미해결 결정과 **충돌**하는 게 아니라 plan 이 나열한 후보안 중 하나(옵션 c)를 그대로 채택했으므로 결정 내용 자체는 정합하다. 다만 plan 문서의 라이프사이클 갱신이 누락되어, 이 상태로 커밋되면 이후 독자가 "아직 미결" 로 오인하거나 동일 결정을 중복 재검토할 위험이 있다.
  - 제안: `plan/in-progress/spec-update-notifications-firing.md` 의 해당 체크박스를 `[x]` 로 갱신하고, 채택 결정((c) channel=in_app)·근거 링크(target Rationale 앵커)를 짧게 기록한다. "완료 조건" 절의 `/consistency-check --spec` BLOCK:NO 여부도 이번 변경 세트 기준으로 재확인 문구를 추가하면 좋다. (해당 plan 은 최근 commit 7eabf1d73 에서 이 OPEN 항목과 함께 신설됐으므로, 같은 작업 스레드의 마무리 커밋에 plan 갱신을 포함하는 것이 자연스럽다.)

- **[INFO]** `spec-sync-data-flow-8-notifications-gaps.md` 트래커는 이미 최신 — 교차 확인 결과 특이사항 없음
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 전체
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`
  - 상세: 이 트래커는 `execution_failed`/`schedule_failed`/`team_invite` 발사 항목을 이미 `[x]` (PR3 완료) 로 표기하고 "spec 배지 flip 은 `spec-update-notifications-firing.md`(planner) 위임" 이라고 정확히 교차 참조한다. target 변경은 그 위임을 이행하는 후속 작업이며 이 트래커 자체는 갱신이 불필요하다. 유일한 잔여 오픈 항목(`marketplace_update`, 마켓플레이스 backlog 차단)은 target 변경과 무관.
  - 제안: 조치 불요 (기록용).

## 요약

target (`spec/data-flow/8-notifications.md` + 동반 `9-user-profile.md`/코드/테스트 diff) 은 `plan/in-progress/spec-update-notifications-firing.md` 가 "planner 결정 대기(OPEN)" 로 남겨둔 `team_invite` 채널 중복 이메일 이슈를, 그 plan 이 제시한 옵션 (c) `channel=in_app` 하향을 그대로 채택해 spec·인접 spec(§5.1)·백엔드 코드·테스트까지 정합되게 해소했다. 결정 내용 자체의 충돌은 없다 — plan 이 후보로 열어둔 안을 target 이 선택했을 뿐이다. 다만 이 해소를 반영해야 할 plan 문서(`spec-update-notifications-firing.md`)의 체크박스·완료조건이 이 diff 세트에 포함되지 않아, 같은 커밋/PR 로 plan 라이프사이클 갱신을 마무리하지 않으면 "미해결" 표시가 stale 하게 남는다. 그 외 `spec-sync-data-flow-8-notifications-gaps.md` 트래커나 다른 in-progress plan 문서와의 충돌·선행조건 미해소·후속 누락은 발견되지 않았다.

## 위험도

LOW
