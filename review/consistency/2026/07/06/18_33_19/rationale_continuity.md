### 발견사항

- **[WARNING]** `team_invite` channel='both' 가 결과적으로 기존 가입자에게 이메일 2통 발송 — spec 문구 준수이나 Rationale 미검증 side-effect
  - target 위치: `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `dispatchTeamInviteNotification` (§ `invite()` 흐름, line 159-177 근방)
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` §1.1 `team_invite` 행("새 멤버 초대(해당 이메일이 이미 가입자인 경우에만 in-app 알림 + 이메일 둘 다)") 및 `notifications.service.ts` 의 `notify()` Rationale(§1 단일 `notify()` 표면 — "channel ∈ {email, both} 시 이메일 발송"). `notify()` 자체는 이번 diff 이전 PR1/PR2(`69d0f0a24`, `550f971cf`)에서 이미 구현·병합됨.
  - 상세: 기존 가입자(비멤버) 초대 시 `invite()` 는 (1) 무조건 `dispatchEmail()` 로 초대 링크 이메일을 보내고, (2) 그 직후 `dispatchTeamInviteNotification(..., channel:'both')` 를 호출한다. `notify()` 는 `channel ∈ {email, both}` 이면 `dispatchEmails([saved])` 를 additionally 수행하므로, 동일 초대 이벤트에 대해 수신자는 "초대 링크 이메일" + "team_invite 알림 이메일" 두 통을 받는다. spec §1.1 문구("이메일 둘 다")는 "in-app + email 채널을 모두 쓴다"는 뜻이지, "이미 존재하는 초대 링크 메일과 별개로 2번째 메일을 추가로 보낸다"는 의도인지는 spec에 명시적 근거가 없다. 이는 새 Rationale 없이 두 개의 독립 이메일 발송 경로가 동시에 활성화되는 결과를 낳는다.
  - **중요 정황**: 이 이슈는 이미 인지되어 있다 — 같은 워크트리의 `plan/in-progress/spec-update-notifications-firing.md` 가 정확히 이 문제를 "team_invite 이메일 2통 (side-effect 재검토)" 항목으로 명시하고, planner 결정 대기 중(3개 옵션: 현행 유지/초대링크 이메일 생략/channel=in_app 하향)이라고 밝히고 있다. 즉 developer 는 spec read-only 라 구현을 spec 문언 그대로 적용했고, 결정/Rationale 반영은 project-planner 로 명시적으로 위임된 상태 — 이는 프로젝트 규약(§구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임)을 정확히 따른 것이다.
  - 제안: 코드 자체는 수정 불필요(계획된 위임 경로 안). `spec-update-notifications-firing.md` 의 해당 체크박스가 이번 PR 코드 머지와 별개 트랙으로 계속 열려 있어야 하며, 미해결 상태로 방치되면(예: 이 plan 이 회수 없이 잊혀지면) 이중 이메일이 사용자에게 노출된 채 영구화될 위험이 있다 — plan 추적 유지를 권고.

- **[INFO]** spec §1.1 "미구현 (Planned)" 3행이 이번 구현으로 stale — 이미 별도 flip 작업으로 추적 중
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표 (`execution_failed`/`schedule_failed`/`team_invite` 행), Overview 상단 "구현 현황 주의" 박스
  - 과거 결정 출처: 해당 spec 자체 — 세 type 을 "미구현 (Planned)" 로 명시한 최신 버전(`84195ef15`)
  - 상세: 이번 diff 는 spec 파일을 전혀 건드리지 않으면서(`git diff origin/main...HEAD -- spec/` 결과 없음) 코드에서 세 알림 type 을 모두 발사하도록 구현했다. 결과적으로 spec 본문은 실제 구현 상태와 어긋난 채로 PR 코드만 먼저 머지되는 흐름이다. 다만 이는 Rationale 상의 결정 번복이 아니라 순수한 문서 동기화 지연이며, `plan/in-progress/spec-update-notifications-firing.md` 가 정확히 이 flip 을 담당 작업으로 이미 등록해 두었다("developer 는 spec read-only 라 … planner 위임"). 프로젝트 규약상 정상 경로.
  - 제안: `spec-update-notifications-firing.md` 를 이번 코드 PR 이후 신속히 실행해 spec 본문(§1.1 표 + Overview 주의 박스 + 관련 Rationale)을 구현됨으로 flip 할 것. 특히 `execution_failed` 의 `!parentExecutionId` 조건, `schedule_failed` 의 "시작 실패 한정"(async 실패는 `execution_failed` 담당) 조건, `resource_type='execution'` 공유 키공간 주의사항까지 plan 이 이미 열거해 두었으므로 그대로 반영하면 된다.

- **[INFO]** `notifications.service.ts` 의 `notify()`/WS emit/이메일 발송 구현(PR1·PR2, `69d0f0a24`/`550f971cf`)도 spec 상 여전히 "미구현 (Planned)"으로 남아있어 이번 PR 이전부터 존재하던 선행 drift
  - target 위치: `spec/data-flow/8-notifications.md` Overview "구현 현황 주의" 박스, §2.2 WebSocket/SMTP 행
  - 과거 결정 출처: 동일 spec — WS emit·이메일 발송을 "follow-up phase, 미구현" 으로 서술한 대목
  - 상세: 코드 확인 결과 `NotificationsService.notify()`(단일 표면), `emitNew()`→`WebsocketService.emitNotificationEvent()`, `dispatchEmails()` 모두 이미 구현·병합되어 있다. 이는 이번 PR3 범위 밖(선행 PR1/PR2)이라 이번 diff 의 책임은 아니지만, 이번 PR3 의 신규 코드(`schedule_failed`/`team_invite`)가 바로 이 `notify()` 표면 위에서 동작하므로 두 drift 가 누적되는 지점이다. Rationale 위반이라기보다 문서 미갱신 누적.
  - 제안: 이미 `plan/in-progress/spec-update-notifications-ws-emit.md`, `plan/in-progress/spec-update-notifications-email.md` 가 별도 트랙으로 존재 — `spec-update-notifications-firing.md` 와 병합 처리 가능하다고 plan 스스로 명시하고 있으므로 세 plan 을 한 번에 반영하는 것을 고려.

### 요약

이번 diff(`execution_failed`/`schedule_failed`/`team_invite` 발사 구현)는 `spec/data-flow/8-notifications.md` 의 §1.1 표에 이미 선언돼 있던 발사 조건·수신자·채널 규칙을 코드로 정확히 구현했고, `background_failed` 와의 중복 회피(`!parentExecutionId`), dedup 정책 범위(§4.4 는 `integration_action_required` 한정이라 신규 3종에 미적용해도 정합), 모듈 순환 회피 패턴(`ModuleRef` 우회, PR1/PR2 선례) 등 기존 Rationale 이 박아둔 원칙을 위반하지 않는다. 유일하게 실질적인 주의가 필요한 지점은 `team_invite` channel='both' 가 기존 초대 링크 이메일과 별개로 두 번째 이메일을 추가 발송하는 side-effect인데, 이는 developer 가 spec read-only 제약을 지키며 project-planner 에게 명시적으로 위임한 미결 항목(`plan/in-progress/spec-update-notifications-firing.md`)으로 이미 추적되고 있어 "결정의 무근거 번복"에 해당하지 않는다. spec 본문(§1.1 3행)이 구현 완료 후에도 "미구현 (Planned)"로 남아 실제 상태와 어긋나는 것 역시 별도 flip 작업으로 계획돼 있는 정상적인 spec-code 동기화 지연이다. 전반적으로 Rationale 연속성 관점에서 새로 기각된 대안의 재도입이나 invariant 우회는 발견되지 않았다.

### 위험도
LOW
