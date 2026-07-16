# 보안(Security) 리뷰 — control-plane 안내 발송 per-provider escape (F-5 근본 fix)

## 발견사항

- **[INFO]** `sendSurfaceMismatchNotice` 의 doc comment 가 구식 F-5 가정을 그대로 남김
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:1038-1045` (`sendSurfaceMismatchNotice` 위 주석 "문구는 렌더러 escape 를 거치지 않으므로 default 는 MarkdownV2-safe(...)")
  - 상세: 본 PR 이 `sendExecutionStillRunningNotice` 등 인접 함수의 doc comment 는 "평문 — `sendBestEffortNotice` 가 provider 별로 escape" 로 갱신했으나, `sendSurfaceMismatchNotice` 의 comment 는 갱신되지 않고 "default 는 MarkdownV2-safe(특수문자 미포함)"라는 F-5 이전 가정을 유지한다. 기능상으로는 `sendSurfaceMismatchNotice` 도 `sendBestEffortNotice` → `adapter.escapeControlText` 경로를 그대로 타므로 실제 동작(escape 적용)에는 문제가 없음을 코드로 확인했다(라인 1055 `sendBestEffortNotice` 호출). 순수 문서 drift 이며 보안 결함은 아니지만, 향후 유지보수자가 "이 default 는 escape 불필요"로 오독해 실제로 MarkdownV2 특수문자가 든 override 를 넣고도 안전하다고 오판할 근거는 되지 않는다(어차피 자동 escape 되므로) — 다만 주석 자체는 부정확.
  - 제안: 해당 comment 를 인접 함수들과 동일하게 "평문 — 발송 시 `adapter.escapeControlText` 가 provider 별로 escape" 로 갱신.

- **[INFO]** Discord control-plane 텍스트는 여전히 무(無)-escape(identity) — 기존 `renderNode` 경로와 동일한 accepted risk
  - 위치: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` `escapeControlText` (identity 구현)
  - 상세: Discord 는 `[label](url)` 형태의 masked-link markdown 을 파싱한다. `languageHints` (operator 가 trigger config 로 설정하는 admin 제어 값)에 이런 문자열이 포함되면 클릭 유도형 링크로 렌더될 수 있다. 다만 이는 (a) `renderNode`(§5 EIA event 렌더링) 경로의 기존 동작과 완전히 동일한 선택(discord 는 어디서도 escape 하지 않음)이고, (b) 위협 행위자가 이미 해당 trigger 의 `chatChannel.languageHints` 를 쓸 수 있는 operator/admin 이며 봇 채널은 DM-only(R-D-4, guild 채널 차단)라 mass-messaging/타인 대상 확산 경로가 없어 실질 위험은 낮다. 새 취약점이 아니라 기존에 이미 존재하던 (그리고 본 PR 범위 밖인) provider 선택 사항이다.
  - 제안: 조치 불필요(정보 제공 목적). 향후 Discord 발송 표면을 넓힐 계획이 있다면(예: guild 채널 지원) masked-link escape 재검토 권고.

## 점검 관점별 결론

1. **인젝션(Markdown/mrkdwn 인젝션)**: `escapeControlText` 는 `renderNode` 경로가 이미 쓰는 canonical 함수(`escapeMarkdownV2`, `escapeSlackMrkdwn`)를 그대로 재사용한다(신규 escape 로직 없음 — DRY). 실제 소스를 직접 확인함:
   - `telegram-message.renderer.ts`: `MD_V2_ESCAPE_REGEX = /([_*[\]()~`>#+\-=|{}.!])/g` — Telegram Bot API 의 공식 MarkdownV2 예약문자 전체 집합과 정확히 일치(삭제된 `MARKDOWN_V2_SPECIAL_CHARS` 상수와도 동일 문자셋이었음 — 삭제된 SoT-drift 계약 테스트가 보장하던 등가성 자체가 이제 "단일 SoT"로 수렴해 무의미해진 것이라 손실 아님).
   - `slack-message.renderer.ts`: `escapeSlackMrkdwn` 이 `&` → `<` → `>` 순서로 치환(순서상 `&amp;` 의 `&` 를 재이스케이프하지 않음 — 정확). `<...>` 문법(링크/멘션/`<!channel>` 등 Slack 특수 마크업)을 무력화하므로 오히려 **기존에 없던 slack mrkdwn 인젝션 방지**가 새로 생겼다(F-5 는 telegram 전용이라 slack override 는 종전에 전혀 검증/escape 되지 않았음).
   - `HooksService` 의 `adapter.sendMessage` 직접 발송 5개 호출 지점(`help`/`groupChatRefusal`·`unsupportedMessageKind`/`formValidationFailed`/`formNextField`/`sendBestEffortNotice` 공통 경로 — `surfaceMismatch`/`executionStillRunning` 포함)을 전수 확인, 예외 없이 `adapter.escapeControlText` 를 거친다. `formOpenLabel`(버튼 라벨, MarkdownV2 파싱 대상 아님)만 제외되며 이는 spec 에도 명시된 의도된 예외.
   - 결론: **F-5 제거가 새로운 injection/노출 위험을 열지 않는다.** F-5 는 "operator 가 미리 escape 해야 send 400 을 피할 수 있다"는 등록 시점 형식 검증(가용성 목적)이었고, 본 PR 은 그 책임을 발송 시점 자동 escape 로 이관해 telegram 은 동등 이상, slack 은 순증(신규 방어), discord 는 기존과 동일하게 유지한다.

2. **하드코딩된 시크릿**: 해당 없음. 이 diff 는 텍스트 escape 로직/DTO validator 제거에 국한.

3. **인증/인가**: 영향 없음. bot token/secret 처리 경로 변경 없음.

4. **입력 검증**: `languageHints` 의 placeholder whitelist 검증(`LanguageHintsPlaceholderValidator`, CCH-ERR-03)은 그대로 유지됨 — 이번 diff 가 제거한 건 telegram 전용 MarkdownV2 형식 검증(`LanguageHintsRawSendValidator`)뿐이며, 그 책임이 발송 시 자동 escape 로 대체되므로 실질 방어 수준은 저하되지 않음(오히려 slack 은 순증).

5. **OWASP Top 10**: A03(Injection) 관점에서 위 1항과 동일 결론. 다른 카테고리 해당 없음.

6. **암호화**: 해당 없음(평문 텍스트 처리 로직, secret/hash 미관여).

7. **에러 처리**: 해당 없음 — diff 에 에러 메시지 관련 변경 없음.

8. **의존성 보안**: 신규 의존성 없음.

## 요약

본 diff 는 control-plane 안내 텍스트(봇이 `renderNode` 를 우회해 직접 발송하는 7개 키)의 escape 책임을 "등록 시점 telegram 전용 형식 검증(F-5)"에서 "발송 시점 provider별 자동 escape(`escapeControlText`)"로 이관한다. 실제 telegram/slack escape 함수는 기존 `renderNode` 경로가 이미 사용하던 canonical 구현(`escapeMarkdownV2`, `escapeSlackMrkdwn`)을 재사용하며, `HooksService` 의 모든 직접 발송 지점(5곳, 7개 control-plane 키 전량)이 예외 없이 이 경로를 통과함을 직접 확인했다. F-5 제거로 새로 열리는 injection/노출 경로는 발견되지 않았고, 오히려 종전에 검증 대상이 아니었던 Slack mrkdwn(`<!channel>`, `<url|label>` 등) 인젝션이 새로 차단되는 순증 효과가 있다. Discord 는 escape 없이(identity) 유지되나 이는 `renderNode` 경로와 동일한 기존 설계 선택이며 DM-only 제약상 실질 위험은 낮다. 발견된 항목은 모두 INFO 수준(주석 drift, 기존 설계상 accepted risk 재확인)이며 코드 동작에 결함은 없다.

## 위험도

NONE
