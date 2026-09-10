# Plan 정합성 검토 — chatChannel PATCH 비밀 유출 차단 (impl-chat-channel-patch-token)

## 검토 범위

- Target: `spec/5-system` (scope 델타 0개 파일 — 이번 PR 은 spec 미변경, `spec_impact: none`)
- HEAD: `5976587c7`(리뷰 3라운드, `docs(guide)`) — `codebase` 15파일, `plan/in-progress` 2파일 변경
- 대조한 plan: `plan/in-progress/impl-chat-channel-patch-token.md`(target plan, 아직 in-progress) ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(두 CRITICAL 의 origin·후속 트래커,
  이번 PR 이 함께 수정) · `plan/in-progress/chat-channel-{discord-gateway,slack-socket-mode,visual-ssr-png}.md`
  (같은 spec 영역 backlog, 충돌 없음 확인)
- 직전 라운드(`review/consistency/2026/09/11/00_21_57/plan_coherence.md`) 이후 커밋
  `83d5f3f94`(리뷰 2라운드)·`5976587c7`(리뷰 3라운드)의 변화분을 반영해 재검증했다.

## 발견사항

- **[WARNING] `details.field` 실측이 끝났는데 target spec 세 곳은 여전히 "미확정" — 파생 공개
  문서(이번 PR 이 직접 작성)는 이미 확정값을 노출해 SoT-역전이 굳어졌다**
  - target 위치: `spec/5-system/15-chat-channel.md:375`(§5.4.1) · `:392`(§5.4.1.1),
    `spec/2-navigation/2-trigger-list.md:176` — 셋 다 `details.field` 값 필드를 여전히
    `**미확정 — 후속 e2e 확인 대기**` 로 표기 중 (직전 라운드 지적 이후 미변경, grep 재확인)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4.1 · §5.4.1.1 의
    `details.field` 문면이 실제 페이로드와 다를 수 있다" 항목 — 2026-09-11 실측표(비어있지
    않은 값=중첩 경로 `chatChannel.botToken`/배열, `null`·`''`=flat `botToken`/단일 object)가
    확정됐지만 체크박스는 여전히 `[ ]`(planner 미착수)
  - 상세: 이번 PR 3라운드(`5976587c7`)가 새로 작성한 사용자 가이드
    `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429` ·
    `.../06-integrations-and-config/telegram.mdx:119` 은 이미
    `` `details.field='chatChannel.botToken'` `` 라는 **확정값 한 갈래**(비어있지 않은 값 갈래)를
    사용자에게 공지한다. 즉 SoT(`spec/`)가 "미확정"이라 적어 둔 값을 파생 문서가 먼저 확정해
    노출하는 역전이 이번 라운드에서 더 넓어졌다(2라운드는 telegram 만, 3라운드에 triggers.mdx 도
    추가). developer 는 `spec/` 쓰기 권한이 없어 지연 자체는 정당하지만, 공개 문서 노출 시점과
    SoT 정정 시점의 간극이 실측 완료 이후 계속 벌어지고 있다.
  - 제안: planner 턴에서 위 두-갈래 실측표를 `15-chat-channel.md` §5.4.1/§5.4.1.1 과
    `2-trigger-list.md:176`(및 `:119-120`)에 즉시 반영. 선행 조건(e2e 확인)은 이미 충족돼
    지연 사유가 없다 — 이 PR 이 close 되는 즉시 이어질 짧은 planner 후속으로 등재할 것.

- **[WARNING] `SecretResolver.store()` vs 실제 `rotate()` 표기 불일치가 이번 PR 이 직접 편집한
  절 안에 그대로 남아있다**
  - target 위치: `spec/5-system/15-chat-channel.md:201,373,390` (예산 밖 추가 대상:
    `conventions/chat-channel-adapter.md:354,359` · `4-nodes/7-trigger/providers/telegram.md:58,219` ·
    `providers/slack.md:278`)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` "spec 7곳이 `SecretResolver.store()`
    라 적는데 실제 호출은 전부 `rotate()` 다" — `[ ]` planner 미착수. (`--impl-prep 22_45_26` ·
    `--impl-done 23_54_09` · 이번 커밋에서 `00_21_57` 지적까지 반영해 대상 9곳으로 갱신)
  - 상세: 이번 PR 이 §5.4.1 표(L367 이하)를 두 라운드에 걸쳐 편집하면서도 바로 그 표의
    L373·L390 의 `store()` 오기는 손대지 않았다 — 같은 절을 반복 편집하면서도 인접 오기를
    놓친 형태라 다음 사람이 또 같은 자리에서 틀릴 위험이 있다. `git -C <worktree> grep -n
    "\.store("` 재확인 결과 위 세 줄이 현재도 `store()` 를 쓴다.
  - 제안: 이미 followups 항목에 대상 지점이 열거돼 있으므로 신규 등재는 불필요 — 다음
    planner 턴에서 §5.4.1 정정과 함께 일괄 반영 권장.

## 확인했지만 문제 없음 (직전 라운드 대비 해소 확인)

- **[해소] 신규 검증 분기(최초 chatChannel 설정·provider 전환 PATCH 차단) 미등재** — 직전
  라운드(`00_21_57`)가 WARNING 으로 지적했던 항목이 이번 커밋에서
  `spec-draft-nullable-notation-followups.md` 의 "spec 7곳이 `store()`…" 불릿에
  `details.field='chatChannel'`/`'provider'` 두 신규 분기로 병기됐다(`--impl-done
  review/consistency/2026/09/11/00_21_57 W3` 를 스스로 인용). 후속 항목 누락 상태 해소.
- **[해소] "완료 선언 시점상 이르다"(`plan/complete/...` 조기 인용)** — 직전 라운드가 지적한
  `plan/complete/impl-chat-channel-patch-token.md` 조기 인용 문구가 이번 커밋에서
  `` `plan/{in-progress → complete}/impl-chat-channel-patch-token.md`(마무리 커밋에서 이동) ``
  로 정정됐다. `plan/in-progress/impl-chat-channel-patch-token.md` 는 실제로 아직 in-progress —
  표기와 실제 상태가 이제 일치한다.
- R-CC-21 "PATCH 는 어떤 비밀도 받지도 쓰지도 않는다" 산문이 telegram server-issued 축까지
  넓게 읽히는 문제는 planner PR #1313(`c0f2a885c`, origin/main 에 이미 존재)으로 좁혀져 있고,
  target 문서(§5.4.1 L380, R-CC-21 L735 이하)와 코드(`triggers.service.ts` "쓰기 ③ 무조건
  유지" 주석)가 정합. plan checklist 의 해당 항목도 `[x]` 로 정확히 마감.
- `chat-channel-{discord-gateway,slack-socket-mode,visual-ssr-png}.md` 는 모두
  `status: backlog`, 별도 "사용자 결정 필요" 진입 조건 대기 중이며 이번 diff 와 겹치는 코드
  경로가 없다 — 충돌 없음.
- 이번 세션에서 신규로 트래커에 등재된 항목들(동시 PATCH lost update · `setupChatChannel`
  관심사 과다 · `botToken` `minLength` 미검증)은 전부 "사전 존재 설계" 또는 "이 PR 의 스코프
  밖"으로 정확히 분류돼 있고, 미해결 사용자 결정을 우회하지 않는다 — `동시 PATCH lost update`
  는 reviewer 도 *"이번 PR 을 막을 사유 아님"* 으로 명시.
- `impl-chat-channel-patch-token.md` 의 `spec_impact: none` 선언은 실제 diff(코드+가이드 문서
  전용)와 target 문서 변경 0건 실측에 여전히 부합.

## 요약

CRITICAL 은 없다 — 이번 PR 은 미해결 결정을 일방적으로 뒤집거나 다른 plan 의 선행 조건을
건너뛰지 않았고, 같은 spec 영역의 backlog plan(Discord Gateway·Slack Socket Mode·Visual SSR)
과도 충돌이 없다. 직전 라운드가 지적한 WARNING 중 하나(신규 검증 분기 미등재)는 이번 커밋에서
트래커에 병기돼 해소됐고, 완료 시점 조기 인용 INFO 도 정정됐다. 다만 두 항목 — (1)
`details.field` 실측이 끝났는데도 target spec(`15-chat-channel.md`·`2-trigger-list.md`)이
여전히 "미확정"이고 그 사이 이번 PR 자신이 작성한 공개 가이드 문서가 확정값을 먼저 노출해
SoT-역전이 커지고 있는 점, (2) 같은 §5.4.1 절 안의 `store()`/`rotate()` 오기가 이번 PR 의
두 차례 편집에도 남아있는 점은 여전히 유효한 WARNING 이다. 둘 다 developer 권한 밖(spec 쓰기
불가)이라는 점에서 이번 PR 을 막을 사유는 아니지만, planner 후속 턴이 지체되면 사용자 대면
문서와 SoT 간의 불일치 창이 계속 넓어진다.

## 위험도

MEDIUM
