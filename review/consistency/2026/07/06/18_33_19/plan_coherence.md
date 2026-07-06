### 발견사항

- **[INFO]** target spec 배지가 아직 stale — 이미 위임 plan 존재, 정상 프로세스
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 표, `execution_failed`(L73)·`schedule_failed`(L74)·`team_invite`(L76) 행 — 여전히 "미구현 (Planned)" / "(현재 어떤 코드도 본 type 발사 안 함)"
  - 관련 plan: `plan/in-progress/spec-update-notifications-firing.md`(owner: planner, worktree: unstarted) — 본 PR 의 마지막 커밋(`9154e455f`)에서 신설되어 flip 대상·미해결 결정을 정확히 나열함. tracker `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` 도 동일 커밋에서 3개 항목을 `[x]`로 갱신하며 "spec 배지 flip 은 planner 위임" 각주를 달아둠.
  - 상세: `developer` 는 spec read-only 라 spec 자체를 고칠 수 없다는 프로젝트 규약(CLAUDE.md) 그대로 따른 것. 동일 파이프라인의 PR1(`spec-update-notifications-ws-emit.md`)·PR2(email, tracker에 위임 기록)도 같은 패턴을 이미 사용했고 실제로 PR1 분은 별도 planner 세션에서 처리된 선례가 있음(현재 spec 은 PR1 항목만 "구현됨"으로 반영돼 있고 PR2/PR3 항목만 Planned 로 남아 있음 — 이는 각 PR 의 실제 반영 시점 차이로 설명됨).
  - 제안: 갱신 불필요 — 다음 단계로 `spec-update-notifications-firing.md` 를 담당하는 planner 세션이 flip 을 수행하면 됨. 코드 PR 자체의 병합을 막을 사유 아님.

- **[WARNING]** `team_invite` 이중 이메일 발송 — plan 이 명시한 미해결 UX 결정을 코드가 옵션(a)로 선반영
  - target 위치: 코드 diff — `workspace-invitations.service.ts` `dispatchTeamInviteNotification`(`channel: 'both'`, L203) + 기존 `dispatchEmail`(초대링크 이메일, L159). target spec 문서에는 이 조합에 대한 서술이 없음(§1.1 L76 은 "이메일 둘 다"라고만 함, 초대링크 이메일과의 중복 여부는 미기재).
  - 관련 plan: `plan/in-progress/spec-update-notifications-firing.md` §"반영할 결정/주의" 두 번째 항목 — "기존 가입자는 초대링크 이메일에 더해 team_invite(channel=both) 알림 이메일도 받아 총 2통 발송됨. (a) 현행 유지 / (b) 초대링크 이메일 생략 / (c) team_invite 를 channel=in_app 로 하향" 3안 중 **미결정** 상태로 planner 위임. `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` L22 에도 동일하게 "spec-literal 채택, planner 재검토(spec-update plan)"라고 명시.
  - 상세: 코드는 spec 문언("이메일 둘 다")을 문자 그대로 구현해 옵션 (a)(현행 유지=2통 발송)를 사실상 확정했다. 이는 plan 이 "결정 필요"로 명시적으로 열어둔 항목에 대해 코드가 하나의 선택지를 프로덕션 동작으로 굳힌 것이라, planner 가 (b)/(c) 를 선택하면 되돌리는 추가 코드 변경이 필요해진다. 다만 코드 주석·plan 양쪽에 "spec-literal, 재검토 대기"라고 투명하게 기록돼 있어 은닉된 결정은 아니다.
  - 제안: 이 자체로 PR 을 막을 필요는 없음(spec 문언과 불일치하지 않고, 명시적으로 위임돼 있음) — 다만 planner 세션이 `spec-update-notifications-firing.md` 처리 시 (b)/(c) 를 선택할 경우 본 코드에 대한 후속 수정이 필요함을 인지하고 처리할 것. 위험을 낮추려면 이번 PR 설명/PR 본문에도 "2통 발송은 임시 상태, planner 결정 대기"임을 명시해 두는 편이 좋음.

- **[INFO]** `execution_failed` resource_type 공유 각주 — 반영 대상이나 아직 spec 미기재
  - target 위치: 코드 주석(`dispatchExecutionFailedNotification` JSDoc) — `resource_type='execution'`이 `background_failed` 의 옛 NodeExecution fallback 과 같은 키공간을 공유한다고 명시. target spec §2.1(L91)의 `findByResource` 서술에는 아직 이 공유 사실이 반영 안 됨.
  - 관련 plan: `spec-update-notifications-firing.md` §"반영할 결정/주의" 첫 항목이 정확히 이 각주를 §2.1 표에 추가하도록 지시.
  - 상세: 후속 항목 누락이 아니라 이미 정확히 캡처되어 있음.
  - 제안: 조치 불요 — planner 세션에서 그대로 반영하면 됨.

### 요약
본 PR(PR3, 발사 소스 3종: `execution_failed`/`schedule_failed`/`team_invite`)은 알림 파이프라인 3-PR 분할(PR1 WS emit·PR2 이메일·PR3 발사원) 중 마지막 조각이며, developer 가 spec read-only 라는 프로젝트 규약에 따라 spec 배지 flip 을 `plan/in-progress/spec-update-notifications-firing.md`(신설, owner=planner)로 정확히 위임했고 tracker(`spec-sync-data-flow-8-notifications-gaps.md`)도 동일 커밋에서 갱신됐다 — PR1/PR2 와 동일한 기존 패턴을 그대로 반복한 것으로 프로세스상 문제 없음. 유일하게 주목할 점은 `team_invite` 채널을 `both`로 구현해 plan 이 "결정 필요"로 명시한 이중 이메일 발송 이슈를 옵션(a, 현행 유지)로 사실상 선반영했다는 것인데, 코드 주석과 plan 양쪽에 이 사실이 투명하게 기록돼 있어 은폐된 결정이 아니고 되돌리기도 국소적이라 병합을 막을 사유는 아니다. `resource_type` 공유 각주 등 다른 후속 spec 반영 항목도 위임 plan에 빠짐없이 캡처돼 있다.

### 위험도
LOW
