# Plan 정합성 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

## 검토 대상 diff 요약

`origin/main..HEAD` 2 커밋 (`312d1d990` feat, `faf6a7b1e` docs) — `CCH-SE-02`
(chat-channel update dedup) 구현. `spec/5-system/15-chat-channel.md` (CCH-SE-02 표 행) +
`spec/4-nodes/7-trigger/providers/telegram.md` (sibling 서술) + 코드
(`ChatChannelDedupService` 신설, `hooks.service.ts` 배선) + `CHANGELOG.md` +
`plan/in-progress/backend-lint-gate-broken-on-main.md` 체크박스 갱신을 포함.

## 발견사항

- **[WARNING]** plan 이 "planner 결정" 으로 게이팅한 항목을 developer 턴이 같은 커밋에서 자체 결정·종결
  - target 위치: `spec/5-system/15-chat-channel.md` CCH-SE-02 표 행(L88) · `spec/4-nodes/7-trigger/providers/telegram.md` L232-236
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L621-644, 특히 L631-632
    `"착수 시: dedup 을 구현할지, CCH-SE-02 를 현실에 맞게 고칠지가 **planner 결정**이다. 전자면
    in-process 경로 전용 dedup 이 필요하다"`
  - 상세: plan 은 이 항목을 명시적으로 project-planner 판단이 선행되어야 하는 미해결 결정으로
    등재해 두었다. 커밋 `312d1d990`(`feat(chat-channel): ...`)이 코드 구현과 **같은 커밋**에서
    이 결정을 "구현" 쪽으로 내리고, `CCH-SE-02` 요구사항 문면 자체를 다시 썼다(종전 "EIA
    `Idempotency-Key` 를 어댑터가 자동 발급" 서술을 폐기하고 `ChatChannelDedupService`/Redis
    키/TTL/fail-open 을 명시하는 새 메커니즘 서술로 교체). CLAUDE.md 규약상 `developer` 는
    `spec/` read-only 이고 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner
    위임" 이 명문 규칙이다. `git log --all --grep` 로 확인한 결과 이 결정을 다루는 별도의
    project-planner 커밋은 존재하지 않는다 — 결정과 구현이 한 턴에 합쳐졌다.
    이 사실은 이미 같은 diff 에 대한 code review(`review/code/2026/08/13/02_38_41/SUMMARY.md`
    WARNING #1, `RESOLUTION.md` WARNING #1)가 독립적으로 포착·인정했고 **되돌리지 않기로**
    결정한 상태다("절차 위반이 맞다... 다만 되돌리지 않는다... 다음부터는 순서를 지킨다").
    plan-정합성 관점에서는 그 인정이 `RESOLUTION.md` 에만 남아 있고, `backend-lint-gate-broken-on-main.md`
    의 체크리스트 항목 자체(L634 "완료 (2026-08-13, `cch-se02-dedup`) — 결정: 구현.")에는
    "이 턴이 developer 턴이었고 절차를 우회했다" 는 caveat 이 없다 — plan 파일만 읽는 향후
    감사자는 이 결정이 정상적인 planner 채널을 거쳤다고 오인할 수 있다.
  - 제안: (a) 내용 자체(구현 선택)를 되돌릴 필요는 없다 — `필수` 요구사항 미이행을 메우는
    보수적 선택이고 code review 도 CRITICAL 없음으로 확인했다. 다만 절차를 공식화하려면
    짧은 project-planner 턴(또는 `consistency-check --spec`)으로 이 스펙 재작성을 사후
    추인하거나, 최소한 `backend-lint-gate-broken-on-main.md` 의 해당 체크리스트 항목에
    `review/code/2026/08/13/02_38_41/RESOLUTION.md` WARNING #1 로의 포인터 한 줄을 추가해
    "developer 턴에서 spec 을 직접 고쳤다" 는 절차상 사실을 plan 자체에도 남길 것을 권장한다.

- **[INFO]** `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 가 이미 완료된 plan 을 가리킴 (본 diff 와 무관한 선재 상태)
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` 목록 (L23)
  - 관련 plan: `plan/complete/spec-sync-chat-channel-gaps.md` (이미 `complete/` 로 이동됨, `in-progress/` 에는 없음)
  - 상세: frontmatter 는 여전히 `plan/in-progress/spec-sync-chat-channel-gaps.md` 를 pending
    plan 으로 나열하지만 실제 파일은 `plan/complete/` 아래 있다. `git show origin/main:...`
    확인 결과 이 dangling 참조는 본 diff 이전(origin/main)부터 있던 선재 상태이며, 이번
    diff 는 같은 파일의 본문(CCH-SE-02 행)만 건드리고 frontmatter 는 변경하지 않았다 — 본
    diff 가 만든 문제는 아니다.
  - 제안: 이번 PR 의 blocking 사유는 아니다. 다음에 이 spec 파일을 planner 가 편집할 때
    `pending_plans` 목록에서 해당 항목을 제거할 것을 권장(하우스키핑).

## 요약

이번 diff(CCH-SE-02 update dedup 구현)는 plan(`backend-lint-gate-broken-on-main.md`)이
"planner 결정 필요" 로 남겨둔 항목을 실제로 해소했고, 내용 면에서는 plan 의 실측·권고와
정합한다(구 dead field 갭을 메우는 방향, 후속 plan 들과 충돌 없음, chat-channel 계열 다른
backlog plan — discord-gateway/slack-socket-mode/visual-ssr-png — 는 이 변경에 영향받지
않음). 다만 그 "planner 결정" 을 developer 성격의 구현 커밋이 같은 턴에서 직접 내리고
spec 문면까지 재작성한 절차상 문제가 있으며, 이는 이미 병렬 code review 가 독립적으로
포착·인정(되돌리지 않기로 함)했다 — plan 파일 자체에는 그 인정이 반영되지 않아 향후 plan-only
감사에서는 드러나지 않는다는 점만 WARNING 으로 남긴다. 그 외 target 이 다른 in-progress plan
의 미해결 결정과 충돌하거나 선행 plan 을 무시하거나 후속 항목을 누락시킨 사례는 발견하지
못했다.

## 위험도
LOW
