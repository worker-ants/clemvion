# 요구사항(Requirement) Review — control-plane 안내 발송 per-provider escape 이관 (F-5 근본 fix)

## 발견사항

- **[WARNING]** 발송 시 double-escape 잔여 리스크 — F-5(#950) 운영 기간에 저장된 telegram override 는 재-escape 되면 Telegram 400 으로 안내가 유실될 수 있다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (`sendBestEffortNotice` / `escapeControlText` 도입 전체), `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:27-31` (`escapeMarkdownV2`)
  - 상세: F-5(#950, `LanguageHintsRawSendValidator`) 체제에서는 telegram operator 가 `languageHints.surfaceMismatch` 등에 이미 escape 된 문자열(예: `"...합니다\."`, backslash+dot 2문자)을 저장해야 검증을 통과했다. 본 PR 은 발송 직전 `adapter.escapeControlText`(telegram → `escapeMarkdownV2`)를 무조건 적용한다. `escapeMarkdownV2` 의 정규식(`MD_V2_ESCAPE_REGEX = /([_*[\]()~`>#+\-=|{}.!])/g`)은 backslash 를 매치 대상에서 제외하고 각 특수문자를 독립적으로 escape 하므로, 이미 `\.`(2문자)가 저장돼 있으면 `\` 는 그대로 두고 `.` 만 추가 escape 해 `\\.`(3문자)가 된다. Telegram MarkdownV2 파서는 `\\` 를 escaped-backslash(literal `\`)로 소비한 뒤 남는 `.` 을 **unescaped 예약문자**로 처리해 `parse_mode` 파싱 실패(400)를 유발한다 — 즉 F-5 체제에서 정상적으로 escape 해 저장했던 override 는 본 PR 배포 후 **재차 이중 escape 로 send 400 → 안내 유실**될 수 있다.
  - plan(`plan/in-progress/control-plane-provider-escape.md` "마이그레이션 주의")도 이 리스크를 인지하고 "F-5 가 방금 머지돼 escape 된 override 사례가 없어 실무상 0" 이라고 결론 내렸으나, 이는 **검증되지 않은 가정**(DB 조회 등으로 실제 0건 확인 안 됨)이다. `#950` 머지 이후 본 PR 배포 전까지의 창(며칠~)에 실제로 operator 가 override 를 저장했을 가능성을 배제할 근거가 코드/데이터로 제시되지 않았다.
  - 제안: 배포 전 실제 프로덕션 `languageHints` 데이터에 F-5 스타일 escape(`\.` 등)가 남아있는 override 가 없는지 1회성 조회로 확인하거나, 마이그레이션 스크립트로 기존 override 에서 `\` 를 제거(un-escape)하는 안전장치를 추가. 최소한 plan 문서의 "실무상 0" 주장에 실측 근거를 남긴다.

- **[WARNING]** `[SPEC-DRIFT]` 아님 — 순수 spec 문서 내부 broken anchor: `chat-channel-adapter.md` §1.1 heading rename 이 `15-chat-channel.md` 의 두 backlink 를 죽였다
  - 위치: `spec/conventions/chat-channel-adapter.md:120` (`### 1.1 6함수 책임 / 부작용 / 멱등성` → `### 1.1 어댑터 함수 책임 / 부작용 / 멱등성`), `spec/5-system/15-chat-channel.md:70`, `spec/5-system/15-chat-channel.md:582` (둘 다 `...chat-channel-adapter.md#11-6함수-책임--부작용--멱등성` 링크)
  - 상세: heading 을 "6함수" → "어댑터 함수" 로 바꾼 것 자체는 `escapeControlText` 추가로 필수 함수가 7개(+옵션)가 된 현재 상태를 정확히 반영해 타당하다. 하지만 GitHub-style 앵커 슬러그가 heading 텍스트에서 파생되므로, 구 슬러그 `11-6함수-책임--부작용--멱등성` 는 신 슬러그 `11-어댑터-함수-책임--부작용--멱등성` 와 달라졌다(실측 확인). `15-chat-channel.md` 의 CCH-CV-05 행(L70)과 registry 멱등성 설명(L582) 두 곳의 링크가 이제 존재하지 않는 anchor 를 가리킨다.
  - 제안: 두 backlink 를 새 슬러그로 갱신 (`#11-어댑터-함수-책임--부작용--멱등성`). 코드 fix 대상 아님 — spec 문서 내부 정합성 문제이므로 `project-planner` 경유 spec 수정.

- **[WARNING]** `hooks.service.spec.ts` 의 `escapeControlText` mock 이 identity passthrough 라 "발송 직전 escape 를 실제로 호출하는지" 배선(wiring) 회귀를 감지하지 못한다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:611` (`escapeControlText: jest.fn((t: string) => t)`), 이 mock 을 사용하는 `sendBestEffortNotice`/`help`/`formValidationFailed`/`formNextField` 관련 기존 assertion 전체
  - 상세: 각 provider adapter 의 `escapeControlText` 자체 정확성은 `telegram/slack/discord.adapter.spec.ts` 로 잘 커버된다. 그러나 `HooksService` 가 `adapter.sendMessage` 호출 직전에 실제로 `adapter.escapeControlText(text)` 를 거치는지(이번 PR 의 핵심 배선)는 identity mock 때문에 검증되지 않는다 — 누군가 향후 리팩터링에서 `adapter.escapeControlText(...)` 호출을 실수로 제거해도 `hooks.service.spec.ts` 의 기존 "발송 텍스트가 X 다" assertion 은 여전히 통과한다(어차피 mock 이 그대로 반환하므로). 소스 코드 직접 확인 결과 현재 배선은 정확하다(누락 없음) — 이는 회귀 방지 커버리지의 공백이지 현재 버그는 아니다.
  - 제안: 최소 1개 테스트에서 `expect(mockAdapter.escapeControlText).toHaveBeenCalledWith(text)` 또는 비-identity mock(e.g. uppercase 변환)으로 최종 발송 텍스트가 escape 산출물임을 검증.

- **[INFO]** stale 주석 — `sendSurfaceMismatchNotice` 의 JSDoc 이 바로 위 `sendBestEffortNotice` 의 갱신된 설명과 어긋난다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:1043-1044`
  - 상세: `sendBestEffortNotice` JSDoc(L989-991)은 "`text` 는 평문으로 전달 — `escapeControlText` 로 provider 별 escape" 로 정확히 갱신됐다. 반면 바로 아래 `sendSurfaceMismatchNotice` 의 JSDoc 은 "문구는 렌더러 escape 를 거치지 않으므로 default 는 MarkdownV2-safe(특수문자 미포함)" 라는 **F-5 이전(구 아키텍처) 서술**을 그대로 남겼다. 기능은 정상(실제로 `sendBestEffortNotice` 경유로 escape 됨)이지만 주석이 실제 흐름과 불일치.
  - 제안: "default 는 평문 — `sendBestEffortNotice` 가 provider 별로 escape 한다" 로 통일.

- **[INFO]** stale 주석 (본 PR 범위 밖 파일) — `language-hint-defaults.ts` 의 `resolveSurfaceMismatchMessage` 문서가 "raw, escape 없이 발송" 이라 서술
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts:183-186`
  - 상세: `SURFACE_MISMATCH_DEFAULTS` 자체는 특수문자를 안 쓰므로 현재는 결과적으로 무해하지만, "호출자가 escape 없이 발송" 서술은 더 이상 사실이 아니다(`sendSurfaceMismatchNotice → sendBestEffortNotice` 가 이제 `escapeControlText` 를 호출). 이 파일은 본 diff 에 포함되지 않아 후속 정리 대상으로만 남긴다.
  - 제안: 후속 커밋에서 comment 갱신.

## 요구사항 충족 관점 평가

핵심 요구사항 — `ChatChannelAdapter.escapeControlText(text): string` 신설, 3개 provider(telegram=`escapeMarkdownV2`/slack=`escapeSlackMrkdwn`(`<>&`만)/discord=identity) 구현, `HooksService` 의 7개 control-plane 직접발송 키(help/surfaceMismatch/executionStillRunning/groupChatRefusal/unsupportedMessageKind/formValidationFailed/formNextField) 전량을 발송 직전 escape 경유로 재배선, telegram-baked `\.` default 정리(평문화), F-5(`LanguageHintsRawSendValidator`/`TELEGRAM_RAW_SEND_HINT_KEYS`/`markdown-v2.ts`) 완전 제거 — 는 코드·spec(`chat-channel-adapter.md` §1/§1.1, `15-chat-channel.md` §4.1/§4.1.1, `providers/telegram.md` §5.8) 3자 모두 line-level 로 정합하게 구현됐고, 관련 unit 테스트 6개 스위트(199 test) 전체 통과·신규 `tsc`/`eslint` 에러 없음을 직접 실행으로 확인했다. `escapeMarkdownV2` 문자 집합(`_*[]()~`>#+-=|{}.!`)과 `escapeSlackMrkdwn` 치환 순서(`&`→`<`→`>`)도 spec 서술과 정확히 일치한다. 다만 (1) F-5 운영 기간에 telegram operator 가 이미 escape 해 저장했을 override 를 본 PR 이 재-escape 해 Telegram 400 으로 안내를 유실시킬 수 있는 이중-escape 리스크가 실측 검증 없이 "실무상 0" 로만 처리됐고, (2) 이번 PR 이 직접 유발한 spec 내부 broken anchor 2건, (3) 배선 자체를 검증하지 못하는 identity mock 테스트 공백이 남아 있어 완전 무결은 아니다. TODO/FIXME 잔존 없음, 반환값 누락 없음, 에러 시나리오(escapeControlText 미구현 provider 없음 — mandatory 인터페이스로 컴파일 타임 강제)도 적절히 처리됐다.

## 위험도
MEDIUM
