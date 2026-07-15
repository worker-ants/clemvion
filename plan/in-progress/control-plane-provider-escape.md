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

## 마이그레이션 주의 — 이중 escape 배포 점검 (ai-review requirement/side_effect WARNING)

새 계약은 "operator override 는 **평문**". F-5(#950) 체제에선 operator 가 escape 된 문자열(`처리 중입니다\.`)을
저장해야 검증을 통과했으므로, 그런 값이 남아 있으면 배포 후 `escapeControlText` 가 재-escape 해
telegram 400(안내 조용히 유실)을 낼 수 있다. `escapeMarkdownV2` 는 backslash 를 감지하지 않아 이중
escape 를 코드로 막지 않는다(구 F-5 의 backslash-toggle 검출기는 삭제됨 — 새 계약에선 불필요).

- **위험도**: F-5 는 #950 로 방금 머지됐고 본 근본 fix 가 바로 뒤따르므로, escape 된 override 가 저장됐을
  창이 매우 좁아 실무 확률은 낮다. 그러나 multi-env 배포 시차·시드/QA 데이터·API 직접 호출 경로를
  코드/데이터로 배제하진 못했다(가정).
- **배포 전 점검(권장)**: 프로덕션 `trigger.config.chatChannel.languageHints` 를 스캔해 `provider='telegram'`
  이고 control-plane 7키 값에 `\`(backslash)가 포함된 항목이 있으면 backslash 제거(평문화) 후 재저장하는
  1회성 데이터 점검. (본 PR 코드는 새 평문 계약 기준으로 정합 — 마이그레이션은 ops 항목.)
- **코드 방어 미채택 근거**: escapeControlText 에 "이미 escaped 면 skip" 방어를 넣으려면 방금 삭제한
  backslash-toggle 복잡도를 되살려야 하고, 평문 계약에선 backslash 가 정상 입력일 수도 있어 오탐 위험.
  좁은 창의 마이그레이션을 ops 점검으로 처리하는 편이 낫다.

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
