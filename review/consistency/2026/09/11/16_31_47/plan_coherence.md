# Plan 정합성 검토 — impl-chat-channel-binder (spec/5-system scope)

## 검토 범위 및 방법

- target 은 `spec/5-system/` 스코프의 `--impl-done` 이나, 이번 브랜치의 spec 델타는 0개 파일이고
  실제 변경은 `codebase/backend/src/modules/triggers/{triggers.service.ts,chat-channel-input-rules.ts,chat-channel-input-rules.spec.ts}`
  + `plan/in-progress/{impl-chat-channel-binder.md, spec-draft-nullable-notation-followups.md}`
  다 (`git diff origin/main...HEAD --stat` 실측).
- HEAD 워킹트리(현재 CWD)가 그대로 diff 를 반영한 SoT 이므로, 프롬프트 번들 대신 `git diff`·
  `grep -rn`·`git log` 를 절대경로/현재 트리 기준으로 직접 재실측해 판정했다.
- 예산 절단으로 프롬프트에서 빠진 다른 `plan/in-progress/*.md` (chat-channel-discord-gateway·
  chat-channel-slack-socket-mode·chat-channel-visual-ssr-png 등)는 `TriggersService`/
  `chat-channel-input-rules`/이동 대상 심볼에 대한 참조가 **0건**임을 grep 으로 확인했다 —
  이 리팩터와 교차하는 열린 결정 없음.

## 발견사항

- **[WARNING]** 신규 spec-drift 후속 항목이 자신이 등재된 트래커의 `spec_impact` 목록을 다시 놓쳤다
  - target 위치: 구현 diff 중 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 신규
    추가된 항목 — *"`slack.md`·`discord.md` 의 `TriggersService.assertInboundSigningPlaintextByProvider`
    귀속 표기가 부정확해졌다"* (2026-09-11 등재)
  - 관련 plan: 같은 파일의 frontmatter `spec_impact:` 리스트 (파일 상단)
  - 상세: 새 항목은 `spec/4-nodes/7-trigger/providers/discord.md:297` ·
    `spec/4-nodes/7-trigger/providers/slack.md:275` 의 `TriggersService.X` 표기 정정을 요구한다
    (실측: 두 파일만 클래스 접두어를 쓰고, `2-trigger-list.md:155`·`discord.md:76`·
    `15-chat-channel.md:432` 는 함수명만 인용해 이동 후에도 참으로 남는다 — 이 구분 자체는 정확함).
    그런데 `discord.md`/`slack.md` 는 이 트래커 파일의 `spec_impact` 프런트매터에 **없다**.
    같은 파일 frontmatter 주석(9~13행)이 바로 이 실패 모드를 명문화하고 있다 — *"아래 셋은
    본문 항목이 정정을 요구하는 파일 — 빠지면 `--spec`/`--impl-done` 번들 스코프에서 누락된다
    (`review/consistency/2026/09/06/16_29_00` INFO#2)"*. 그 INFO#2 도 지금과 같은 패턴
    (본문은 특정 파일을 정정 대상으로 지목했는데 `spec_impact` 가 안 따라감)이었고, 그때는
    소급 등재(`2-trigger-list.md`·`3-schedule.md`·`15-chat-channel.md`·`review-citations.md`·
    `spec-impl-evidence.md`·`secret-store.md`)로 고쳤다(git log 로 확인). 이번 항목은 그 교훈이
    다시 새는 자리다. (완화 요인: 과거 유사 항목 — `SecretResolver.store()→rotate()` 9곳 —도
    `spec_impact` 밖의 `providers/slack.md`·`providers/telegram.md` 를 지목했지만 별도 planner
    턴(`plan/complete/spec-draft-chat-channel-drift-3.md`)이 직접 실측해 고쳤다. 그러나 이는
    "이 트래커의 `spec_impact` 로 스코핑된 `--spec` 리뷰"가 아니라 애드혹 후속 턴이 우연히
    커버한 것이라 구조적 안전망은 아니다.)
  - 제안: `spec-draft-nullable-notation-followups.md` frontmatter `spec_impact` 에
    `spec/4-nodes/7-trigger/providers/discord.md` · `spec/4-nodes/7-trigger/providers/slack.md`
    를 추가한다(둘 다 실재 파일, 이미 본문에서 여러 항목이 참조 중).

- **[WARNING]** T2 유예로 트래커 종결 조건("남은 3메서드")이 실제 잔존 메서드 수와 어긋난다
  - target 위치: `plan/in-progress/impl-chat-channel-binder.md` 체크리스트 —
    `~~T2 이동~~ — 이 PR 범위 밖. 트래커에 이미 별 항목으로 있다` 및 바로 다음 항목
    `트래커 "chat-channel 도메인 규칙이 …" 항목 종결 (남긴 3메서드는 사유와 함께 명시)`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 원 항목
    *"chat-channel 도메인 규칙이 제네릭 `TriggersService`(1855줄)에 계속 쌓인다"*
    (처방 후보: `ChatChannelTriggerBinder` 협력자 추출, 여전히 `- [ ]` 미해결) 및
    *"`setupChatChannel` 이 6~8가지 관심사를 한 함수에 담고 있다"* (처방:
    `resolveChatChannelSecretWrites` 로 내부 분리 — 함수 **내부 리팩터**일 뿐 provider 추출이 아님)
  - 상세: 이 plan 의 설계 절(§T2)은 원래 `setupChatChannel`·`teardownChatChannel` 을
    `ChatChannelBinderService`(Nest provider, `triggers/` 안)로 **추출**하는 것이었다 —
    타이틀의 *"secret 쓰기(협력자)"* 절반이 이것이다. 그런데 체크리스트에서 T2 를
    "이 PR 범위 밖"으로 취소하면서 *"트래커에 이미 별 항목으로 있다"* 고 적었다. 실측
    (`grep -rn ChatChannelBinderService plan/ spec/ codebase/`) 하면 이 심볼은 **이 plan
    자신에만** 존재하고, 트래커의 관련 항목은 provider 추출이 아니라 함수 내부 분리
    (`resolveChatChannelSecretWrites`)만 다룬다 — 스코프가 다르다. 이 상태로 다음 단계
    (미체크 항목 *"트래커 종결 — 남긴 3메서드는 사유와 함께 명시"*)를 그대로 실행하면,
    실제로는 `setupChatChannel`·`teardownChatChannel` 까지 포함해 **5개 메서드**가
    `TriggersService` 에 남는데 *"3메서드만 남았다"* 고 트래커를 닫아, 이 PR 을 낳은
    원 아키텍처 지적(모듈 경계)의 절반(secret 쓰기 협력자 분리)이 별도 backlog 항목 없이
    조용히 유실될 위험이 있다.
  - 제안: 트래커 종결 시점에 (a) 원 항목을 닫지 않고 *"T1 만 완료, T2(=`setupChatChannel`/
    `teardownChatChannel` → `ChatChannelBinderService` 추출)는 별도 PR 로 이월"* 로 재기술하거나,
    (b) `setupChatChannel` 관심사 분해 항목의 처방을 provider 추출까지 포괄하도록 명시적으로
    넓혀 T2 가 그 항목 하나로 durable 하게 추적되게 한다. 어느 쪽이든 "남긴 3메서드" 문구는
    실제 잔존 메서드 수(5개: `setupChatChannel`·`teardownChatChannel`·`rotateBotToken`·
    `cleanupRotatedChatChannelTokens`·`tryRevokeOldBotToken`)로 정정해야 한다.

## 확인했으나 문제 없음 (참고)

- `assertChatChannelInputSafe`·`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·
  `stripChatChannelPlaintext`·`translateSetupChannelError`·`teardownChatChannel` 의 spec 귀속
  "0곳" 주장은 `grep -rn` 전수로 확인 — 정확함.
- `assertInboundSigningPlaintextByProvider` 의 "드리프트 2곳(`discord.md:297`·`slack.md:275`)
  vs 안전 3곳(`2-trigger-list.md:155`·`discord.md:76`·`15-chat-channel.md:432`)" 구분도
  실측과 정확히 일치.
- `chat-channel-adapter.md:369` 의 `TriggersService.setupChatChannel` 인용은 T2 가 이번 PR
  에서 유예됐으므로 여전히 참 — drift 아님.
- `backend-lint-gate-broken-on-main.md`·`spec-sync-external-interaction-api-gaps.md` 의
  `triggers.service.ts:875`/`:634` 라인 인용은 모두 **이미 `[x]` 처리된 과거 스냅샷**이고 그
  파일들 자체가 이번 브랜치에서 편집되지 않았다 — 라인 시프트는 있지만 살아있는 결정이 아니라
  실무 영향 없음.
- 다른 `plan/in-progress/chat-channel-*.md`(discord-gateway·slack-socket-mode·visual-ssr-png)와
  `webchat-*.md` 는 이동 대상 심볼·`TriggersService` 참조가 0건 — 교차 충돌 없음.
- `#676`(순환 의존 해소) 재발 방지를 위해 "T1/T2 모두 `triggers/` 안에 남긴다"는 방향 전환은
  plan 문서 안에서 `forwardRef` 0건 실측으로 스스로 검증했고, 다른 plan 의 전제와 충돌하지 않는다.

## 요약

이 PR(`impl-chat-channel-binder`)은 원 아키텍처 지적을 실측 기반으로 정확히 재해석하고(순환
의존 재발 방지), T1(순수 함수 이동)을 테스트 무편집으로 증명하며 진행했다. spec 귀속 drift도
전수 실측으로 정확히 식별해 durable 트래커에 등재하는 등 plan 정합성 관리가 전반적으로
꼼꼼하다. 다만 (1) 이번에 등재한 새 후속 항목이 `spec_impact` 프런트매터 동기화라는, 같은
트래커 파일이 과거에 한 번 이미 겪고 고친 실패 모드를 다시 재현했고, (2) T2 를 범위 밖으로
미루면서 남긴 "별도 항목으로 이미 있다"는 근거가 실측상 정확히 들어맞지 않아 트래커 종결 시
잔존 메서드 수·범위 서술이 어긋날 위험이 있다. 둘 다 CRITICAL 은 아니며(미해결 결정을 우회하지
않음, 다른 plan 과 충돌하지 않음), plan 종결 전에 트래커 문서만 갱신하면 해소되는 WARNING 이다.

## 위험도

LOW
