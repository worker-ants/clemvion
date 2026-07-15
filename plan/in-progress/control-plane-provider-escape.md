---
worktree: .claude/worktrees/control-plane-provider-escape-bc344c
started: 2026-07-14
owner: developer
---

# control-plane 안내 발송 per-provider escape 이관 (F-5 근본 fix)

> 배경: `plan/complete/eia-command-waiting-surface-guard.md` 의 미채택 백로그
> "defaults per-provider escape 이관" — F-5(등록 시점 MarkdownV2 검증)를 대체하는 근본 fix.
> 사용자 결정(2026-07-14): "근본 fix 를 하자".

## 문제

`HooksService` 가 렌더러(`renderNode`)를 거치지 않고 `adapter.sendMessage` 로 **직접 발송**하는
control-plane 안내(surfaceMismatch / executionStillRunning / groupChatRefusal /
unsupportedMessageKind / help / formValidationFailed / formNextField)는 provider별 escape 가
적용되지 않는다. 그래서:

1. telegram 은 default 문구에 `\\.` 를 **inline baked-in** — 그런데 이 `\.` 이 **slack/discord 에서
   literal `\.` 로 노출**되는 실 cross-provider 버그.
2. operator override 는 telegram MarkdownV2 특수문자를 포함하면 send 400 → F-5(#950)가 등록
   시점 검증으로 막았으나, 이는 operator 가 직접 escape 하게 만드는 우회일 뿐.

## 해법 (per-provider escape at send)

발송 시점에 provider 가 자기 표면에 맞게 escape 하도록 이관한다. 어댑터가 escape 를 소유하면
default·override 모두 자동으로 올바르게 렌더되고, F-5 의 검증·operator escape 요구가 불필요해진다.

- **`ChatChannelAdapter.escapeControlText(text): string`** 신규 — control-plane 텍스트 전용 escape.
  - telegram → `escapeMarkdownV2`
  - slack → `escapeSlackMrkdwn` (`<>&`)
  - discord → identity (discord markdown 은 평문 안전)
- `HooksService` 의 raw control-plane 발송을 모두 `escapeControlText` 경유로 (sendBestEffortNotice +
  help / formValidationFailed / formNextField inline).
- telegram-baked `\\.` default 들을 **평문**으로 정리 (이중 escape 방지). §4.1 예제도 평문 복원.
- **F-5 제거**: `LanguageHintsRawSendValidator` / `TELEGRAM_RAW_SEND_HINT_KEYS` / `@Validate` /
  DTO 테스트 / `markdown-v2.ts`(+spec). operator override 는 평문으로 넣으면 되고 자동 escape 됨.

## 마이그레이션 주의 (timing 상 실무 무해)

F-5(#950) 가 방금 머지돼 아직 operator 가 override 를 escape(`\.`)해 저장한 사례가 없다. 따라서
"평문 override → 자동 escape" 전환의 이중 escape 리스크는 실무상 0. spec 에 "override 는 평문으로"
계약을 명시한다.

## rationale continuity

F-5 는 **interim 등록 검증**이었고, plan(eia-command-waiting-surface-guard)이 per-provider escape
이관을 근본 fix backlog 로 명시했다. 따라서 F-5 제거는 기각된 대안의 재도입이 아니라 **예고된 진행**이다.

## 체크리스트

- [x] `escapeControlText` interface + 3 adapter 구현 (telegram=escapeMarkdownV2 / slack=escapeSlackMrkdwn / discord=identity) + adapter 테스트
- [x] hooks.service 발송 경로 이관 (sendBestEffortNotice + help/formValidationFailed/formNextField) + default 평문 정리
- [x] F-5 제거 (LanguageHintsRawSendValidator/TELEGRAM_RAW_SEND_HINT_KEYS/@Validate/DTO 테스트/markdown-v2.ts+spec)
- [x] spec 동기 (§4.1.1 escape-at-send / §4.1 예제 평문 / R-CC-15 F-5 제거 / providers/telegram §5.8 / chat-channel-adapter §1·§1.1)
- [x] lint / unit 통과
- [ ] build / e2e
- [ ] `/ai-review` + fix
- [ ] `/consistency-check --impl-done` BLOCK:NO
