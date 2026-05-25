# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 분석 개요

**리뷰 대상 변경 set** (두 커밋 ff2d676d + ded1a4b9):

백엔드:
- `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` (및 spec)
- `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts` (및 spec)
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` (및 spec)
- `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` (및 spec)
- `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` (및 spec)
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`

프론트엔드:
- `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` + `discord.en.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx` + `slack.en.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` + `telegram.en.mdx`

**PROJECT.md 매트릭스 적재 완료** (§변경 유형 → 갱신 위치 매핑).

---

## 발견사항

### [WARNING] `languageHintsHelp` dict 키 (KO/EN) 가 신규 CCH-ERR-* 6 키를 미반영 — 사용자 가시 툴팁 stale

- 변경 파일: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (신규 `executionFailedThirdParty4xx` 등 6개 `languageHints` 키 도입)
- 매트릭스 항목: "통합 신규/제공자 변경 → `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` 의 dict 키 동반 갱신"
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` — `chatChannel.languageHintsHelp` 값
  - `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/en/triggers.ts` — `chatChannel.languageHintsHelp` 값
- 상세: `trigger-detail-drawer.tsx` 의 languageHints 편집 필드가 `t("triggers.chatChannel.languageHintsHelp")` 를 툴팁으로 렌더링한다. 현재 KO 값은 `"봇이 보내는 자체 안내 메시지 키 — groupChatRefusal / executionStarted / executionCompleted / executionStillRunning / help."`, EN 값은 `"Keys for bot-sent guidance messages — groupChatRefusal / executionStarted / executionCompleted / executionStillRunning / help."` 이다. 이 PR 이 `executionFailedThirdParty4xx`, `executionFailedThirdParty5xx`, `executionFailedThirdParty`, `executionFailedTimeout`, `executionFailedRateLimit`, `executionFailedInternal` 6개 키를 새로 도입했지만 툴팁 설명에는 전혀 언급이 없다. 운영자가 UI 에서 `languageHints` 를 편집할 때 6개 신규 키의 존재를 알 수 없다.
- 제안:
  - `dict/ko/triggers.ts` `chatChannel.languageHintsHelp` 값에 CCH-ERR-* 6 키 목록 추가
  - `dict/en/triggers.ts` 동일 키에 영문 설명 추가 (KO/EN 동시 갱신 — parity 가드)
  - 예시: `"봇이 보내는 자체 안내 메시지 키 — groupChatRefusal / executionStarted / executionCompleted / executionStillRunning / help. CCH-ERR-* 실패 안내 키: executionFailedThirdParty4xx / executionFailedThirdParty5xx / executionFailedThirdParty / executionFailedTimeout / executionFailedRateLimit / executionFailedInternal. CCH-ERR-* 키의 허용 placeholder: {statusCode} 1종."`
  - i18n parity 가드(`i18n.test.ts`) 가 KO/EN 동시 갱신을 강제하므로 한쪽만 변경 시 빌드 차단됨

---

### 통과 항목 (동반 갱신 완료)

다음 trigger 에 대해서는 동반 갱신이 정상적으로 수행됨:

1. **통합/제공자 변경 → docs MDX 동반 갱신 완료**
   - Discord, Slack, Telegram 의 `execution.failed` 렌더링 로직 변경에 대해 `.mdx` (KO) + `.en.mdx` (EN) 양쪽 모두 §7 / §6 "안내 메시지 커스터마이즈" 절이 신설됨
   - 매트릭스 항목 "통합 신규/제공자 변경 → `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}`" 충족

2. **KO/EN sibling parity 완료**
   - `discord.mdx` + `discord.en.mdx`, `slack.mdx` + `slack.en.mdx`, `telegram.mdx` + `telegram.en.mdx` 모두 양쪽 동시 갱신

3. **신규 warningCode/errorCode 발행 없음**
   - `execution-failure-classifier.ts` 는 기존 `ErrorCode` enum 값을 분류(mapping) 만 하며 신규 에러 코드를 발행하지 않음 → `backend-labels.ts` 동반 갱신 불필요

4. **신규 TSX 한국어 리터럴 없음**
   - 이번 변경은 TSX 파일을 건드리지 않음 → i18n parity (dict ko/en 양쪽 등록) trigger 해당 없음

5. **신규 섹션 디렉토리 없음**
   - `06-integrations-and-config/` 는 기존 섹션 — `locale.ts` `SECTION_LABELS_BY_LOCALE` 등록 불필요

6. **인증·권한·세션 흐름 변경 없음**

7. **표현식 언어 변경 없음**

8. **실행·디버깅 흐름 직접 변경 없음** (chat-channel renderer 변경이지만 execution engine 흐름 자체가 아님 → `05-run-and-debug/` 갱신 불필요)

---

## 요약

PROJECT.md 매트릭스에서 식별한 유효 trigger 수: 2 ("통합 신규/제공자 변경" + "신규 UI 문자열(TSX)"). 매칭된 trigger: "통합 신규/제공자 변경" 1건. docs MDX 동반 갱신 (6 파일, KO/EN 완전 쌍)은 충실히 수행됐으나, 같은 trigger 의 dict 키 동반 갱신 의무 중 `chatChannel.languageHintsHelp` (운영자에게 실제 노출되는 툴팁) 가 신규 CCH-ERR-* 6 키를 반영하지 않아 stale 상태임 — WARNING 1건 발견.

## 위험도

LOW
