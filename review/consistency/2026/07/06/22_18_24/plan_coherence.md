# Plan 정합성 Check — `spec/data-flow/`

## 검토 모드
구현 완료 후 검토 (--impl-done, scope=`spec/data-flow/`, diff-base=`origin/main`)

이 실행에서 실제로 `origin/main` 대비 변경된 target 파일은 `spec/data-flow/8-notifications.md`(+동반 `spec/2-navigation/9-user-profile.md`)뿐이다 (`git diff origin/main...HEAD --stat` 확인). 나머지 payload 에 포함된 data-flow 문서(`0-overview.md`, `1-audit.md`, `10-triggers.md`, `11-workflow.md`, `12-workspace.md`, `13-agent-memory.md` 일부)는 이번 diff 의 변경분이 아니라 컨텍스트로만 첨부된 것으로 판단해, 실제 diff 파일을 중심으로 plan 정합성을 확인했다.

## 발견사항

- **[WARNING]** `spec-sync-data-flow-8-notifications-gaps.md` 의 `team_invite` 완료 메모가 target 의 최종 결정(channel=`in_app`)과 어긋난 채 stale
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `team_invite` 행(구현됨, channel=`in_app`) + 신설 Rationale "`team_invite` 채널 — 이메일 중복 회피 (channel=`in_app`)" (라인 74, 329-368). 동반: `spec/2-navigation/9-user-profile.md` §5.1 각주.
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` "## 착수 (2026-07-06, developer) — PR 분할" 절의 PR3 설명(라인 22: `team_invite ... channel=`both`(spec 명시) ... spec-literal 채택, planner 재검토(spec-update plan)`)과 "## 미구현 항목" 체크박스(라인 33: `type `team_invite` 발사 — **PR3 완료** (... channel=both)`).
  - 상세: 이 diff 이전에는 target 도 `channel=both` 였고(자매 plan `plan/complete/spec-update-notifications-firing.md` 의 "OPEN 결정" 이었음), 이번 diff 에서 planner 가 옵션 (c) `channel=in_app` 하향을 채택해 target 을 갱신했다(`spec-update-notifications-firing.md` 도 이미 `plan/complete/` 로 이동, 체크박스 `[x]` 반영 완료 — 이 부분은 정상 해소). 그러나 **같은 결정을 참조하는 자매 트래커** `spec-sync-data-flow-8-notifications-gaps.md` 는 여전히 `plan/in-progress/` 에 남아 있고, 그 안의 두 곳(착수 메모·완료 체크박스)이 옛 값 `channel=both` 를 그대로 서술한다. 이는 "미해결 결정과의 충돌"은 아니지만(결정 자체는 별도 plan 에서 이미 해소·기록됨), 이 트래커만 읽는 독자는 실제 구현이 `both` 라고 오인할 수 있다 — 관점 3(후속 항목 누락: 결정 변경이 인접 문서에 전파되지 않음)에 해당.
  - 제안: `spec-sync-data-flow-8-notifications-gaps.md` 라인 22, 33 의 `channel=both` 서술을 `channel=in_app`(결정 (c) 채택, 2026-07-06) 로 갱신하거나, 해당 상세는 `plan/complete/spec-update-notifications-firing.md` 를 SoT 로 위임하는 링크 각주로 대체한다. 아울러 이 트래커가 참조하는 `spec-update-notifications-email.md`/`-ws-emit.md`/`-firing.md` 세 plan 이 모두 `plan/in-progress/...`(위임처)로 인용돼 있으나 이미 전부 `plan/complete/` 로 이동했으므로, 경로 표기도 함께 정정 권장.

- **[INFO]** `spec-sync-data-flow-8-notifications-gaps.md` 자체는 라이프사이클 이동 후보
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 전체 (execution_failed/schedule_failed/team_invite/notify 단일표면/이메일발송/WS emit)
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`
  - 상세: 이 트래커의 "미구현 항목" 체크박스는 `marketplace_update` 1건(마켓플레이스 backlog 차단으로 범위 밖 확정) 을 제외하면 전부 `[x]` 완료다. `spec/data-flow/8-notifications.md` 본문도 이제 전 항목 "구현됨" 으로 정합돼 있어, 이 문서는 사실상 `marketplace_update` 잔여 1건만 남기고 종결 상태다. Critical/Warning 은 아니나, 위 team_invite 서술 정정과 함께 완료 처리(`plan/complete/` 이동 또는 marketplace 전용 후속 문서로 축소) 를 고려할 시점이라는 점만 기록.
  - 제안: 조치 선택 사항. 위 WARNING 정정과 같은 커밋에서 처리하면 효율적.

- 그 외 이번 diff(`8-notifications.md`, `9-user-profile.md`)에 대해서는 미해결 결정과의 충돌(관점 1), 선행 plan 미해소(관점 2) 사례를 찾지 못했다. `spec/data-flow/12-workspace.md` §1.5(워크스페이스 전환 미구현)·§Rationale 은 `spec-sync-data-flow-12-workspace-gaps.md` 의 미해결 결정 1/2/3/4 와 여전히 일관되게 "미구현/미강제" 로 남아 있어(이번 diff 로 건드려지지 않음) 일방적 결정 우회는 없다.

## 요약

이번 diff 의 target 은 `spec/data-flow/8-notifications.md`(+ `2-navigation/9-user-profile.md`) 하나이며, 자매 plan `spec-update-notifications-firing.md` 가 "OPEN" 으로 남겨뒀던 `team_invite` 중복 이메일 결정을 옵션 (c)(`channel=in_app`) 로 정확히 해소하고 해당 plan 도 `plan/complete/` 로 이동·체크박스 갱신까지 마쳤다 — 결정 우회나 충돌은 없다. 다만 같은 사실을 서술하는 또 다른 진행 중 트래커 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` 가 옛 값(`channel=both`)을 그대로 남겨 이번 target 갱신과 어긋나게 됐다 — 결정 자체의 충돌이 아니라 결정 전파 누락(후속 항목 미반영)이라 WARNING 으로 등급화했다. `spec/data-flow/12-workspace.md` 등 이번에 변경되지 않은 나머지 payload 문서들은 각자의 plan(`spec-sync-data-flow-12-workspace-gaps.md`)이 남긴 미해결 결정과 여전히 정합해 추가 위반이 없다.

## 위험도

LOW
