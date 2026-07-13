# 요구사항(Requirement) Review

대상: F-2 (plan `eia-command-waiting-surface-guard.md`) — chat-channel 표면 불일치(409
`STATE_MISMATCH`) 삼킴 시 사용자에게 `languageHints.surfaceMismatch` best-effort 안내 발송.

## 발견사항

- **[INFO]** `ChatChannelConfig.languageHints` JSDoc 의 "기타 안내 키 (CCH-ERR-* 외)" 목록에
  `surfaceMismatch` 미기재
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:104-110` (목록: `formOpenLabel`,
    `sessionExpired` 만 나열)
  - 상세: 코드 동작·spec 본문(§4.1.1 표, §4.1 서술) 은 정확히 반영됐고 이 JSDoc 은 참고용
    비-authoritative 목록(SoT 는 spec 문서로 명시)이라 기능상 문제는 없음. 다만 동일 파일의
    `sessionExpired` 도입 시에는 이 목록이 갱신됐던 선례가 있어, 이번엔 갱신되지 않아 완전성이
    약간 떨어짐.
  - 제안: `surfaceMismatch — F-2 표면 불일치 안내 (§4.1.1)` 한 줄 추가 (경미, 선택적).

- **[INFO]** `plan/in-progress/eia-command-waiting-surface-guard.md` 의 F-2 항목이 "후속 항목
  (본 PR 범위 밖)" 섹션에 그대로 남아 있고, 본 diff 에는 plan 체크리스트 갱신(F-2 완료 표시)이
  포함되지 않음
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md:115-126`
  - 상세: 코드·spec·문서(telegram.mdx/en.mdx) 변경 자체는 F-2 서술과 완전히 일치하나, 이
    PR 이 F-2 를 실제로 구현·완료한 것으로 보이는데 plan 문서에는 미반영 상태. `.claude/docs/plan-lifecycle.md`
    관례상 완료 항목은 체크리스트/상태 갱신이 기대됨.
  - 제안: 별도 커밋/PR 로 plan 파일에 F-2 완료 표시 추가 (developer 워크플로 마무리 단계).

## 점검 관점별 확인 내역 (문제 없음 확인)

1. **기능 완전성**: `SURFACE_MISMATCH_DEFAULTS`(KO/EN) + `resolveSurfaceMismatchMessage`(3-level
   lookup) + `HooksService.sendSurfaceMismatchNotice`(발송, swallow) + 호출부
   (`forwardToInteractionService` 의 `STATE_MISMATCH` catch) 까지 end-to-end 로 구현됨. plan
   F-2 서술("form 대기 + 자유 텍스트", "buttons 대기 + 자유 텍스트" 모두 동일 `STATE_MISMATCH`
   catch 경로로 흡수)과 일치.
2. **엣지 케이스**: override 빈 문자열은 default 로 처리(`length > 0` 가드, 기존 `sessionExpired`
   /`formOpenLabel` 과 동일 패턴), `languageLocale` 미설정/unknown 값은 ko fallback, adapter
   `sendMessage` 실패는 catch 되어 전체 webhook 흐름을 막지 않음(`try/catch` + `logger.warn`).
3. **TODO/FIXME**: 신규 코드에 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 없음. 함수명(`sendSurfaceMismatchNotice`, `resolveSurfaceMismatchMessage`)과
   JSDoc, 실제 동작이 모두 일치.
5. **에러 시나리오**: `adapter.sendMessage` 실패 시 예외를 삼키고 warn 로그만 남겨, 안내 발송
   실패가 webhook 응답(202 ack)이나 원래 `STATE_MISMATCH` 삼킴 로직에 영향을 주지 않음 —
   "발송 실패가 재시도 루프를 유발하면 안 된다"는 설계 의도와 일치.
6. **데이터 유효성**: `languageHints` DTO(`ChatChannelConfigDto`)의 placeholder whitelist
   validator(`LanguageHintsPlaceholderValidator`)는 `FAILURE_HINT_KEYS`(CCH-ERR-* 6종)만 검사
   대상이며 `surfaceMismatch` 는 (spec 표의 "`{statusCode}` 허용: no" 와 일치하게) 이 검사
   scope 밖 — `sessionExpired`/`formOpenLabel` 도 동일 취급이라 기존 설계와 정합.
7. **비즈니스 로직**: "silently swallow 금지"(CCH-ERR-04 대칭, spec 본문에 명시) 반영. 삼키는
   범위를 `STATE_MISMATCH` 코드로 한정(다른 409 사유는 전파)하는 기존 관례도 그대로 유지.
8. **반환값**: `resolveSurfaceMismatchMessage`/`sendSurfaceMismatchNotice` 모든 분기에서 값(또는
   `void` Promise)을 반환. 누락 경로 없음.
9. **spec fidelity (line-level)**:
   - `spec/5-system/15-chat-channel.md` §4.1 예시 JSON 및 §4.1.1 표에 `surfaceMismatch` 행이
     정확히 코드 상수(`SURFACE_MISMATCH_DEFAULTS.ko/en`)와 문자 단위로 일치.
   - spec 서술("구현은 `HooksService.forwardToInteractionService` 가 거부를 삼킬 때
     `sendSurfaceMismatchNotice` 로 발송")이 실제 코드 위치·함수명과 정확히 일치.
   - "다른 default 문구와 달리 문장부호를 쓰지 않는다"는 spec 서술이 실제 상수 값(KO 문구에
     마침표/쉼표 없음, EN 문구도 MarkdownV2 특수문자 미포함)과 일치. 신규 회귀 테스트
     (`MD_V2_SPECIALS` 정규식, telegram MarkdownV2 예약문자 전체 집합과 정확히 일치: `_ * [ ] ( )
     ~ \` > # + - = | { } . !`) 가 이 불변식을 코드 레벨에서 강제.
   - `adapter.sendMessage`(kind:`'text'`) 가 `parse_mode: 'MarkdownV2'` 로 무조건 raw 전송하고
     escape 를 하지 않는다는 전제(`codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts`
     의 `sendMessage` 구현 확인)가 실제 코드와 일치 — 특수문자 배제 설계가 실질적으로 근거 있음.
   - `spec/5-system/4-execution-engine.md` §7.5.1 의 "EIA 외부 진입점(`interaction.service`)은
     409 `STATE_MISMATCH`" 서술과 `codebase/backend/src/modules/external-interaction/interaction.service.ts`
     의 실제 에러 바디 shape(`{ error: { code: 'STATE_MISMATCH', message } }`)가
     `hooks.service.ts` 의 `readErrorBody` 파싱 로직과 정확히 매칭.
   - `telegram.mdx` / `telegram.en.mdx` §7.4 신규 섹션의 표·default 문구가 backend 상수·spec
     표와 3방향(spec/코드/문서) 모두 문자 단위 일치.
   - 테스트(`language-hint-defaults.spec.ts`, `hooks.service.spec.ts`)는 override/빈 문자열/locale
     fallback/삼킴 범위(STATE_MISMATCH 한정)/실제 발송 wiring 을 모두 커버하며 spec 요구사항과
     1:1 대응.

## 요약

F-2(chat-channel 표면 불일치 graceful 안내)는 plan 서술·spec 본문(§4.1/§4.1.1/§7.5.1)·구현
(`language-hint-defaults.ts`/`hooks.service.ts`)·문서(telegram.mdx/en.mdx)가 모두 문자 단위로
정합하며, 기능 완전성·에러 처리(swallow+warn)·엣지 케이스(빈 override, locale fallback, 삼킴
범위 한정)·테스트 커버리지가 촘촘하다. MarkdownV2 안전성 주장은 실제 telegram adapter 의 raw
전송 동작으로 뒷받침되며 회귀 테스트로 고정돼 있다. 발견된 두 항목은 모두 INFO 수준(비-authoritative
JSDoc 키 목록 누락, plan 체크리스트 미갱신)으로 코드 동작에는 영향이 없다. CRITICAL/WARNING 없음.

## 위험도

LOW
