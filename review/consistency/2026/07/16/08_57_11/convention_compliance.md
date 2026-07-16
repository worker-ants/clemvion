# 정식 규약 준수 검토 — spec/5-system/15-chat-channel.md

검토 모드: --impl-done (diff-base origin/main). 대상 PR: control-plane 안내 발송 per-provider escape 이관
(`escapeControlText` 신설, F-5 `LanguageHintsRawSendValidator` 제거).

대조한 정식 규약: `spec/conventions/chat-channel-adapter.md`(주), `spec/conventions/error-codes.md`,
`spec/conventions/swagger.md`. (payload 에 첨부된 "정식 규약 모음" 섹션은 audit-actions.md ·
cafe24-api-catalog/* 로 truncate 되어 chat-channel-adapter.md 본문이 빠져 있어, 워크트리
절대경로에서 직접 Read 하여 대조했다.)

## 발견사항

- **[WARNING] `languageHints` 예제·default 표에서 `unsupportedMessageKind` 누락 (문서 자기-불일치)**
  - target 위치: `spec/5-system/15-chat-channel.md` §4.1 `languageHints` jsonc 예제 (L217–236) / §4.1.1 KO·EN default 표 (L249–259) vs 같은 §4.1.1 본문의 escape 대상 키 목록 (L265)
  - 위반 규약: 명시적 conventions 규칙 위반이라기보다, CLAUDE.md "기술 명세는 `spec/<영역>/*.md` 본문" 원칙(spec 이 단일 진실)과 문서 자체 내부 정합성 문제. `spec/conventions/chat-channel-adapter.md` 의 `escapeControlText` JSDoc(L76–78)과 target §4.1.1 본문(L265)은 둘 다 control-plane 직접 발송 키를 `help`·`groupChatRefusal`·`unsupportedMessageKind`·`executionStillRunning`·`surfaceMismatch`·`formValidationFailed`·`formNextField` 7개로 동일하게 명시한다.
  - 상세: 이번 diff 로 나머지 6키(`groupChatRefusal`/`executionStillRunning`/`surfaceMismatch`/`formValidationFailed`/`formNextField`/`help`)는 §4.1 jsonc 예제에 값 + "평문 — 발송 시 어댑터 escape" 주석이 갱신됐다. 그러나 `unsupportedMessageKind` 는 §4.1 예제에도 §4.1.1 KO/EN 표에도 애초부터 등장하지 않는다 (diff 이전부터 이미 없던 pre-existing 갭 — 이번 diff 가 새로 만든 문제는 아님). 실제 default 문구는 `codebase/backend/src/modules/hooks/hooks.service.ts` 안에만 inline 리터럴로 존재하며, 이번 diff 는 바로 그 리터럴의 escape 를 `\\.` → `.` 로 바꾼 지점이다 (payload diff L507–512). spec 이 이 키의 default 값에 대한 SoT 역할을 못 하고 있어, §4.1.1 이 스스로 열거한 "7개 escape 대상 키" 목록과 예제/표가 어긋난다.
  - 제안: §4.1 jsonc 예제에 `"unsupportedMessageKind": "지원하지 않는 메시지 형식입니다.",` 행 추가 + §4.1.1 표에 KO/EN 행 추가. 최소 대안으로는 "기존 5키(EN 미대응) 군에 속함" 한 줄이라도 명시해 표 스코프 예외임을 밝힌다. 이번 PR 이 바로 이 키의 default 문자열을 만졌으므로 같은 커밋에서 채워 넣기 적절한 시점이었다 — 후속 spec-sync PR 로 넘겨도 무방.

## 정합성 확인 (문제 없음, 근거만 기록)

- **명명 규약**: 신규 `escapeControlText(text: string): string` 어댑터 메서드가 `spec/conventions/chat-channel-adapter.md` §1 Adapter Interface(L87)에 정확히 반영돼 있고, 기존 6함수(setupChannel/teardownChannel/parseUpdate/renderNode/sendMessage/ackInteraction)와 동일한 camelCase 패턴을 따른다. target 문서 §4.1.1(L265–271)의 서술도 동일 이름·동일 provider별 규칙(telegram=`escapeMarkdownV2`, slack=`escapeSlackMrkdwn`, discord=identity)으로 일치.
- **출력 포맷 규약**: 어댑터별 escape 규칙이 실제 코드(`discord-message.renderer.ts` — escape 함수 없음/identity, `slack-message.renderer.ts` — `escapeSlackMrkdwn` export, `telegram-message.renderer.ts` — `escapeMarkdownV2` export)와 spec 서술이 1:1 일치함을 확인.
- **금지 항목 재도입 없음**: F-5(`LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`UNSAFE_TELEGRAM_MARKDOWN`/`chat-channel/shared/markdown-v2.ts`)의 죽은 참조가 `spec/`·`codebase/` 어디에도 남아있지 않음 (`grep -rn` 확인, plan 문서의 역사적 언급만 존재 — 정상). R-CC-15 (c) 의 스쳐가는 `UNSAFE_TELEGRAM_MARKDOWN`(F-5) 언급도 이번 diff 에서 함께 제거됨.
- **문서 구조 규약**: target 문서는 `## Overview (제품 정의)` → 본문(§1–8) → `## Rationale`(R1–R9, R-CC-10~19) 3섹션 구조를 그대로 유지. Rationale ID 컨벤션(`R-CC-N` prefix, L602–604) 도 준수 — 이번 변경은 신규 Rationale 항목을 추가하지 않고 기존 §4.1.1 본문·R-CC-15(c) 텍스트만 갱신했는데, 이는 "새 메커니즘의 what"이 §4.1.1 안에 이미 자연스럽게 통합돼 있어 별도 R-CC-2x 신설이 강제 사항은 아니라고 판단(경계선상이나 CRITICAL/WARNING 대상은 아님).
- **API 문서 규약**: `chat-channel-config.dto.ts` 의 `languageHints` `@ApiPropertyOptional({ description: ... })` 갱신은 `spec/conventions/swagger.md` §1-3 Optional 필드 패턴(설명 텍스트로 보강)을 그대로 따름. `LanguageHintsRawSendValidator` 제거 후에도 `LanguageHintsPlaceholderValidator`(`UNKNOWN_PLACEHOLDER`)는 그대로 유지되어 `error-codes.md` 의 "VALIDATION_ERROR prefix-less 공용 코드" 패턴과 정합 — 세부 코드가 top-level enum 이 아니라 `details[].message` prefix 로만 표면하는 기존 관례를 그대로 승계.
- **provider 문서 교차 확인**: `spec/4-nodes/7-trigger/providers/telegram.md` §5.8 도 동일 escape 메커니즘·SoT 링크로 갱신돼 target 문서와 dead link 없이 정합.

## 요약

target 문서(`spec/5-system/15-chat-channel.md`)는 이번 PR(F-5 등록시점 검증 → `escapeControlText` 발송시점 escape 이관)의 정식 규약 대조 결과 CRITICAL/구조적 위반이 없다. 신규 어댑터 인터페이스 메서드 명명·escape 규칙 서술이 `spec/conventions/chat-channel-adapter.md` 및 실제 3-provider 코드(telegram/slack/discord)와 정확히 1:1 대응하고, 제거된 F-5 관련 죽은 참조도 spec/코드 어디에도 남아있지 않으며, 문서 3섹션 구조·Rationale ID 컨벤션·swagger DTO 패턴·error-codes prefix-less 공용 코드 관례 모두 준수한다. 유일하게 지적할 사항은 §4.1.1 이 스스로 열거한 7개 control-plane escape 키 중 `unsupportedMessageKind` 하나가 §4.1 jsonc 예제와 §4.1.1 KO/EN default 표에서 빠져 있는 pre-existing 문서 완결성 갭으로, 이번 PR 이 바로 그 키의 코드측 default 값을 만진 지점이라 함께 채워 넣었으면 더 좋았을 것이다 — 다만 이는 이번 diff 가 새로 만든 위반이 아니라 기존 갭의 방치이며 심각도는 낮다.

## 위험도

LOW
