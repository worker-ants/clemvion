# Cross-Spec 일관성 검토 — control-plane 안내 per-provider escape 이관

대상: `spec/5-system/15-chat-channel.md` (+ 연동 변경: `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`)
모드: `--impl-done`, diff-base=`origin/main`

## 검토 방법 메모

Payload 의 "Target 문서" 블록은 `spec/5-system/15-chat-channel.md` 자체 diff 를 `(없음)` 으로 표기했으나, 실제 워킹트리(`git -C <worktree> diff origin/main...HEAD -- spec/`)를 절대경로로 재확인한 결과 다음 3개 spec 파일이 이번 PR 로 함께 갱신되어 있었다(코드 변경과 짝을 이루는 정상적인 spec 동기화):

- `spec/5-system/15-chat-channel.md` (§3.2 CCH-CV-05 앵커 텍스트, §4.1 JSON 예시, §4.1.1 escape 정책 전면 개정)
- `spec/conventions/chat-channel-adapter.md` (`escapeControlText` 인터페이스 멤버 + §1.1 표 행 추가, §1.1 헤더 리네임)
- `spec/4-nodes/7-trigger/providers/telegram.md` (§5.7 관련 표/admonition 갱신)

이 3개 파일은 서로 정합적으로 갱신되어 있었다(F-5/`UNSAFE_TELEGRAM_MARKDOWN`/`LanguageHintsRawSendValidator`/`markdown-v2.ts` 관련 텍스트가 spec 전역에서 깨끗이 제거됨 — `spec/` 전체 grep 으로 잔존 참조 없음 확인). 아래는 이 재확인 과정에서 발견한 잔여 drift 다.

## 발견사항

- **[INFO]** `15-chat-channel.md` §7 Rationale (R6) 이 여전히 "6함수 인터페이스" 로 어댑터를 설명 — Convention 문서 자신의 §1.1 헤더는 이미 리네임됨
  - target 위치: `spec/5-system/15-chat-channel.md:552` — `### R6. \`chat-channel-adapter.md\` 를 \`spec/conventions/\` 에 두는 정당화` 본문의 "**모든 channel provider 어댑터가 구현해야 하는 6함수 인터페이스 + 데이터 타입 union** 을 정의"
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` — 같은 PR 에서 §1.1 헤더를 `### 1.1 6함수 책임 / 부작용 / 멱등성` → `### 1.1 어댑터 함수 책임 / 부작용 / 멱등성` 으로 리네임했고(§1.1 표에 `escapeControlText` 행도 신규 추가), `codebase/backend/src/modules/chat-channel/types.ts` 의 SoT 주석도 `6함수 인터페이스 + 데이터 타입 union` → `어댑터 인터페이스 + 데이터 타입 union` 으로 동시에 고쳤다.
  - 상세: `escapeControlText` 추가로 필수 함수는 `setupChannel`/`teardownChannel`/`parseUpdate`/`renderNode`/`sendMessage`/`ackInteraction`/`escapeControlText` 총 7개(+ 옵션 3개: `revokeBotToken?`/`openFormModal?`/`buildFormSubmissionResponse?`)로 늘었다. 같은 PR 이 Convention 문서 헤더와 `types.ts` 주석에서는 "N함수" 라는 숫자 표현 자체를 제거했는데, `15-chat-channel.md` R6 본문만 옛 "6함수" 문구를 그대로 남겨 self-inconsistency 가 생겼다. R1/R2 (`chat-channel-adapter.md` 의 "6함수 인터페이스의 책임 분리" / "6함수 (5+1 ack) 의 의도" 헤더)는 문서 자체가 "기존 R1~R4 는 하위 호환 유지(rename 시 cross-link 깨짐 위험)" 라고 명시적으로 리네임을 보류한 것이므로 별개(의도된 유지) — R6 은 헤더가 아닌 본문 prose 라 anchor 파손 위험 없이 고칠 수 있다.
  - 제안: `15-chat-channel.md` R6 의 "6함수 인터페이스" 를 "어댑터 인터페이스"(types.ts 주석과 동일 표현) 로 교체해 숫자 drift 를 제거. 사소한 문구 수정이라 후속 커밋에서 함께 처리 가능.

## 요약

이번 diff 는 control-plane 직접 발송 텍스트의 escape 책임을 `HooksService` 중앙 로직에서 provider adapter (`escapeControlText`)로 이관하고, 이에 따라 telegram 전용 등록 시점 검증(F-5, `LanguageHintsRawSendValidator`/`UNSAFE_TELEGRAM_MARKDOWN`)을 제거했다. `spec/5-system/15-chat-channel.md`·`spec/conventions/chat-channel-adapter.md`·`spec/4-nodes/7-trigger/providers/telegram.md` 3개 spec 이 코드와 함께 갱신되었고, `spec/` 전역 grep 으로 F-5/`markdown-v2.ts`/`UNSAFE_TELEGRAM_MARKDOWN`/`raw-send` 관련 잔존 참조가 없음을 확인했다. 데이터 모델(`1-data-model.md`)·navigation(`2-trigger-list.md`)·data-flow(`14-chat-channel.md`)·slack/discord provider 문서 어디에도 이번 변경과 모순되는 서술은 없다. 유일한 잔여 이슈는 `15-chat-channel.md` R6 rationale 본문이 이번 PR 이 다른 곳(§1.1 헤더, `types.ts` 주석)에서 이미 폐기한 "6함수" 라는 옛 함수 개수 표현을 그대로 남긴 사소한 self-inconsistency(INFO) 뿐이며, 이는 블로킹 사유가 아니다.

## 위험도

LOW
