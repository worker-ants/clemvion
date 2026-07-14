# 유지보수성(Maintainability) Review

대상: F-2 (`plan eia-command-waiting-surface-guard`) `surfaceMismatch` 안내 기능 — `language-hint-defaults.{ts,spec.ts}`, `hooks.service.{ts,spec.ts}`, `telegram.mdx`/`telegram.en.mdx`, `spec/5-system/15-chat-channel.md`.

## 발견사항

- **[WARNING]** 테스트가 MarkdownV2 특수문자 집합을 canonical 소스에서 import 하지 않고 재선언 — drift 시 안전성 테스트가 무력화될 수 있음
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts:18` (`const MD_V2_SPECIALS = /[_*[\]()~\`>#+\-=|{}.!]/;`)
  - 상세: 동일한 문자 클래스가 `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts:27` 의 `MD_V2_ESCAPE_REGEX`(+ export 된 `escapeMarkdownV2()`)로 이미 canonical 하게 정의돼 있다. 본 diff 는 그 정의를 재사용하지 않고 손으로 같은 18개 문자를 다시 나열한 두 번째 사본을 만들었다. 두 정의는 지금은 문자 단위로 동일하지만, 향후 Telegram Bot API 사양 변경 등으로 `telegram-message.renderer.ts` 쪽 집합이 갱신되면 이 테스트의 하드코딩된 사본은 자동으로 따라가지 않는다 — "SURFACE_MISMATCH_DEFAULTS 는 MarkdownV2-safe" 라는 이 테스트의 핵심 보증이 stale 정의 기준으로 계속 통과하며 조용히 무력화될 위험이 있다(사용자 메모리에 기록된 "canonical redaction/escape 소스 재사용" 원칙과 동일한 클래스의 문제).
  - 제안: `MD_V2_SPECIALS` 를 별도 선언하는 대신 `escapeMarkdownV2` 를 import 해 `expect(escapeMarkdownV2(SURFACE_MISMATCH_DEFAULTS.ko)).toBe(SURFACE_MISMATCH_DEFAULTS.ko)` (escape 결과가 원문과 동일 = 이스케이프 대상 문자가 없음) 형태로 단언한다. 이렇게 하면 canonical 정의가 바뀌어도 테스트가 자동으로 최신 기준을 따라간다.

- **[INFO]** `override → locale default → ko fallback` 4줄 패턴이 3번째로 복제됨 — 공통 헬퍼 추출 시점(rule of three)
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts:117-125`(`resolveFormOpenLabel`), `:143-151`(`resolveSessionExpiredMessage`), `:175-183`(신규 `resolveSurfaceMismatchMessage`)
  - 상세: 세 함수 모두 시그니처 `(languageHints, languageLocale) => string` 과 본문 로직(override non-empty 체크 → `languageLocale === 'en'` 분기 → 각자의 `_DEFAULTS.en`/`.ko`)이 override 키 이름과 DEFAULTS 상수만 다를 뿐 완전히 동일하다. 이번 PR 이 이 패턴을 3번째로 복제해, 향후 유사 키(`languageHints.xxx`)가 하나 더 추가되면 4번째 복제가 될 가능성이 높다.
  - 제안: `resolveLocalizedDefault(override: string | undefined, languageLocale: LanguageLocale | undefined, defaults: Record<LanguageLocale, string>): string` 같은 내부 헬퍼로 추출하고, 세 `resolveXxxMessage` 함수는 이를 호출하는 1줄 wrapper 로 축소. 기존 두 함수는 이번 diff 범위 밖이라 강제 리팩터링 대상은 아니지만, 신규 함수를 추가하는 이번 기회에 정리하면 향후 복제를 막을 수 있다.

- **[INFO]** `hooks.service.spec.ts` 의 `executionRepository` mock 캐스팅 boilerplate 가 신규 테스트로 한 번 더 복제됨 (파일 전체 기준 이미 다수 발생)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` 신규 테스트 `'표면 불일치(STATE_MISMATCH) 시 surfaceMismatch 안내를 채널로 발송'` 내 `const execRepo = (moduleRef.get(ExecutionsService) as { executionRepository: jest.Mocked<{ findOne: ... }> }).executionRepository;` 블록
  - 상세: 동일한 5줄 캐스팅 블록이 이 파일에서 이미 10회 이상 반복되고 있고(`grep` 기준 14곳), 이번 diff 는 그 패턴을 그대로 답습해 한 곳 더 추가한다. 신규 코드가 저지른 문제는 아니고 기존 관례를 따른 것이지만, 지금 시점에 `mockActiveExecutionStatus(status: string)` 같은 로컬 헬퍼로 추출했다면 새 테스트가 이 boilerplate 없이 1줄로 끝났을 것이다.
  - 제안: 이번 PR 필수 수정 사항은 아님. 다음에 이 파일을 만질 때 helper 추출을 고려.

- **[INFO]** default 문구 리터럴이 코드/스펙/영문 doc/국문 doc 4곳에 그대로 중복
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts:170-171`(`SURFACE_MISMATCH_DEFAULTS`), `spec/5-system/15-chat-channel.md:3339, 3348`, `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx:3036-3037`, `telegram.mdx:3303-3304`
  - 상세: `sessionExpired`/`formOpenLabel` 등 기존 키와 완전히 동일한 기존 관례(코드가 SoT, spec·doc 는 사람이 손으로 미러링)를 그대로 따른 것이라 이번 diff 가 새로 만든 문제는 아니다. 다만 4곳의 리터럴을 동기화해줄 자동 검증이 없어(spec-coverage 는 NLP 휴리스틱, 강제 아님) 문구가 나중에 코드에서만 바뀌고 문서 3곳 중 일부가 stale 로 남을 위험은 기존과 동일하게 존재한다.
  - 제안: 조치 불요(기존 컨벤션 준수). 향후 4개 이상 languageHints 키가 늘어나면 spec 표 → doc 표 자동 생성 스크립트를 고려할 만하다.

## 요약

이번 변경은 기존 `sessionExpired`/`formOpenLabel` 패턴(override → locale default → ko fallback, try/catch swallow + warn 로그, JSDoc 에 SoT·rationale 명시)을 정확히 그대로 따라 만들어져 있어 네이밍·구조·에러 처리 관례 일관성이 매우 높고, 함수도 짧고 단일 책임이며 중첩도 낮다. 가장 눈에 띄는 개선 포인트는 테스트에서 Telegram MarkdownV2 특수문자 집합을 canonical 정의(`telegram-message.renderer.ts` 의 `escapeMarkdownV2`)를 재사용하지 않고 별도로 하드코딩한 것으로, 이는 향후 drift 시 안전성 보증이 조용히 무력화될 수 있는 실질적 리스크다. 그 외에는 기존에도 있던 resolver 함수 복제 패턴이 3번째로 늘어난 점과 스펙 테스트 파일의 mock 캐스팅 boilerplate 누적 등 rule-of-three 급의 경미한 중복이 관찰되나, 모두 이번 PR 이 새로 만든 문제라기보다 기존 컨벤션을 성실히 따른 결과다.

## 위험도

LOW
