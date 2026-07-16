# 신규 식별자 충돌 검토 — control-plane-provider-escape

대상: `spec/5-system/15-chat-channel.md` (+ 동기화된 `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`) / 신규 식별자: `ChatChannelAdapter.escapeControlText(text: string): string`

## 검토 방법

- `spec/`, `plan/`, `codebase/backend/src`, `codebase/frontend/src`, `codebase/packages` 전역에서 `escapeControlText` 및 인접 식별자(`escapeSlackMrkdwn`, `escapeMarkdownV2`, `escapePromptText`, `MARKDOWN_V2_SPECIAL_CHARS`, `firstUnescapedMarkdownV2Special`, `TELEGRAM_RAW_SEND_HINT_KEYS`, `LanguageHintsRawSendValidator`, `UNSAFE_TELEGRAM_MARKDOWN`)를 grep.
- HEAD 워킹트리(diff 반영 완료 상태)를 절대경로/`git -C` 기준으로 조회 — CWD 기준 상대 조회에 의존하지 않음.
- `escape*` 계열 전체 함수명(프론트엔드 포함: `escapeHtml`, `escapeForScript`, `unescapeDoubleQuotedKey`, `unescapeString`)과 신규 식별자의 의미 중복 여부 확인.

## 발견사항

이번 target 이 도입하는 신규 식별자는 `escapeControlText` (인터페이스 메서드, `ChatChannelAdapter` 소속) 단 하나다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 — 6개 관점 모두에서 신규 도입 항목은 이 메서드 하나로 확인되며, 아래와 같이 **충돌 없음**을 확인했다.

- **엔티티/타입명 관점 — `escapeControlText`**: 코드 전역(`codebase/backend/src`, `codebase/frontend/src`, `codebase/packages`)에서 이 이름은 diff 가 추가한 4개 파일(`types.ts`, `telegram.adapter.ts`, `slack.adapter.ts`, `discord.adapter.ts`)과 그 spec/test 외에는 존재하지 않는다. 기존에 다른 의미로 쓰인 동명 식별자 없음. `dist/` 컴파일 산출물에 존재하는 것은 동일 소스가 빌드된 결과이므로 충돌 아님.
  - 인접 이름(`escapeMarkdownV2` — `providers/telegram/telegram-message.renderer.ts:29`, `escapeSlackMrkdwn` — `providers/slack/slack-message.renderer.ts:38`)은 기존에 `renderNode` 렌더 경로에서 쓰이던 함수이며, 신규 `escapeControlText` 는 그 함수들을 **호출**할 뿐(telegram/slack 어댑터 구현체 내부) 동일 이름을 재사용하지 않는다 — 의미 계층이 분리돼 있어 혼동 소지가 낮다(§Rationale 참조: "provider 가 자기 escape 규칙을 소유").
  - 프론트엔드의 `escapeHtml`(mail 알림 HTML) / `escapeForScript`(웹챗 스니펫) / `unescapeDoubleQuotedKey`·`unescapeString`(표현식·i18n 파서) 은 도메인이 전혀 다르고 이름도 다르다. 충돌 없음.
- **요구사항 ID 관점**: diff·spec 변경분에 신규 R-ID(`R-CC-*`, `R-CCA-*`, `CCH-*`)가 하나도 새로 부여되지 않았다. `escapeControlText` 는 기존 §1/§1.1 Adapter Interface 표에 행만 추가됐고 별도 Rationale ID 를 신설하지 않았다. 기존 ID(`R-CC-15`, `CCH-ERR-04`, `CCH-CV-03`, `R-CCA-5/7/8` 등)는 모두 기존 문맥 재인용이며 재정의가 아니다.
- **API endpoint / 이벤트·메시지명 관점**: 이번 diff 는 REST endpoint·webhook/queue/SSE 이벤트명을 신규 도입하지 않는다 (순수 어댑터 내부 pure 함수 계약 + `HooksService` 내부 chokepoint 리팩터).
- **환경변수·설정키 관점**: 신규 ENV/config key 없음. 오히려 `LanguageHintsRawSendValidator` 검증 규칙(및 `UNSAFE_TELEGRAM_MARKDOWN` 에러 코드)이 **제거**되어 `languageHints` 는 이제 평문 계약으로 단순화됐다 — 제거된 식별자들이 `plan/complete/eia-command-waiting-surface-guard.md`(과거 완료 기록)에만 역사적으로 남아있고, 활성 코드/spec 어디에도 잔존 참조가 없음을 확인.
- **파일 경로 관점**: `spec/5-system/15-chat-channel.md` 경로 자체는 기존 파일 갱신이라 명명 컨벤션 이슈 없음. diff 로 `codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts`(+`.spec.ts`)가 삭제됐는데, 이 경로를 재사용하는 신규 파일이 없어 경로 충돌도 없음.

### [INFO] Convention 문서의 "6함수" 카운트 표현이 신규 식별자 추가로 stale

- target 신규 식별자: `escapeControlText` (Adapter Interface 필수 메서드 7번째)
- 기존 사용처: `spec/conventions/chat-channel-adapter.md:517` `### R1. 6함수 인터페이스의 책임 분리`, `:521` `### R2. 6함수 (5+1 ack) 의 의도`, `spec/5-system/15-chat-channel.md:552` "6함수 인터페이스 + 데이터 타입 union"
- 상세: 이름 자체의 충돌은 아니지만, "6함수" 라는 표현이 사실상 인터페이스를 가리키는 label 처럼 쓰이고 있다. `escapeControlText` 가 필수 메서드로 추가되며 필수 함수 수가 6→7 로 늘었는데(설계상 `provider`/`supportsNativeForm` 프로퍼티 제외, `setupChannel`·`teardownChannel`·`parseUpdate`·`renderNode`·`sendMessage`·`ackInteraction`·`escapeControlText` = 7), Rationale 섹션 제목·본문의 "6함수"는 갱신되지 않았다. 참고로 `codebase/backend/src/modules/chat-channel/types.ts` 상단 주석은 이미 "6함수 인터페이스" → "어댑터 인터페이스"로 일반화해 이 drift 를 인지하고 회피한 흔적이 있다(diff 라인 353 부근).
- 제안: 신규 식별자 충돌은 아니므로 본 검토의 BLOCK 사유는 아니다. 다만 후속(또는 동일 PR) 커밋에서 R1/R2 제목과 §본문의 "6함수"를 "7함수" 또는 count-agnostic 표현("어댑터 인터페이스")으로 정정하면 spec 정확성이 개선된다. (naming-collision 범위 밖의 stale-reference 성격이 강하므로 별도 checker perspective 에서 별도 확인 권장.)

## 요약

target 문서(`spec/5-system/15-chat-channel.md`, 및 이에 동기화된 `spec/conventions/chat-channel-adapter.md` / `spec/4-nodes/7-trigger/providers/telegram.md`)가 새로 도입하는 유일한 식별자 `escapeControlText`(`ChatChannelAdapter` 신규 필수 메서드)는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로 6개 관점 전부에서 코드·spec·plan 전역에 기존의 다른 의미 사용처가 없음을 확인했다 — 충돌 없음. 오히려 이 PR 은 F-5(`LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`UNSAFE_TELEGRAM_MARKDOWN`/`markdown-v2.ts`)를 근본 fix 로 대체하며 관련 식별자를 정리(삭제)했고, 그 잔존 참조도 `plan/complete/` 의 역사 기록에만 남아 있어 활성 표면과 충돌하지 않는다. 유일한 지적 사항은 신규 식별자와 직접 관련 없는 "6함수" 카운트 표현의 staleness(INFO)뿐이다.

## 위험도

NONE
