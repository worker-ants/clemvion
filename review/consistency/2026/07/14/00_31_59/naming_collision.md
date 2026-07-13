# 신규 식별자 충돌 검토 — spec/5-system/15-chat-channel.md (F-2 surfaceMismatch)

## 검토 범위

target: `spec/5-system/15-chat-channel.md` (§4.1.1 `languageHints` default 문구 테이블 + 본문 설명에
`surfaceMismatch` 키 추가, diff `origin/main...HEAD` 4줄 순증분).
연관 구현: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts`
(`SURFACE_MISMATCH_DEFAULTS`, `resolveSurfaceMismatchMessage`), `codebase/backend/src/modules/hooks/hooks.service.ts`
(`sendSurfaceMismatchNotice`), frontend `telegram.mdx` / `telegram.en.mdx` §7.4, i18n dict
(`triggers.ts` ko/en `languageHintsHelp`).

payload 의 "구현 대상 spec 영역" 인라인 발췌가 `(없음)` 으로 비어 있어, target 문서 diff 는
`git -C <worktree> diff origin/main...HEAD -- spec/5-system/15-chat-channel.md` 로 직접 재확인했다
(4-line addition, §4.1.1 표 + 본문 단락). 코드 diff 는 payload 제공분을 그대로 사용했다.

## 발견사항

이번 target 이 새로 도입하는 식별자는 다음과 같다:

- `languageHints.surfaceMismatch` (config/i18n 키)
- `SURFACE_MISMATCH_DEFAULTS` (TS const)
- `resolveSurfaceMismatchMessage` (TS 함수)
- `sendSurfaceMismatchNotice` (private method)
- 문서 섹션 `telegram.mdx`/`telegram.en.mdx` §7.4 "표면 불일치 안내 키"

각각을 기존 코퍼스(spec/, plan/in-progress/, codebase/)와 대조한 결과, **충돌은 발견되지 않았다.**

- **[INFO]** `surfaceMismatch` 는 이미 동일 브랜치의 선행 커밋(`spec/4-nodes/7-trigger/providers/telegram.md` §5.8, `plan/in-progress/eia-command-waiting-surface-guard.md` F-2)에서 같은 의미로 먼저 등장했고, target(`15-chat-channel.md` §4.1.1)이 SoT 테이블에 뒤늦게 등재하는 관계다. 두 문서가 서로 cross-ref 하며 정의가 동일해 의미 충돌은 없다. 다만 `slack.md`/`discord.md` 등 다른 provider 문서에는 `surfaceMismatch` 언급이 전혀 없어(grep 0건), 신규 키 전체(`languageHints` 공통 6→9키 확장)가 provider 문서에 고르게 반영됐는지는 별도 커버리지 확인 대상 — 본 checker 의 "충돌" 범주는 아니므로 정보성으로만 남긴다.
- **[INFO]** `SURFACE_MISMATCH_DEFAULTS` / `resolveSurfaceMismatchMessage` / `sendSurfaceMismatchNotice` 3개 신규 식별자는 각각 기존 patterns(`SESSION_EXPIRED_DEFAULTS`/`resolveSessionExpiredMessage`, `sendExecutionStillRunningNotice`)와 명명 규칙이 동일해 기존 사용처와 의미가 겹치지 않으면서도 컨벤션을 그대로 따른다. 충돌 아님.
- **[INFO]** `STATE_MISMATCH` (409, EIA continuation 표면 불일치) 는 target 이 재사용하는 기존 에러 코드이며 신규 도입이 아니다. 유사한 이름의 기존 코드 `OAUTH_STATE_MISMATCH`(400, OAuth callback state 파라미터 불일치 — `spec/conventions/error-codes.md:35`, `spec/2-navigation/4-integration.md:851`, `spec/data-flow/2-auth.md:128`)가 별도로 존재하지만, target 이 새로 부여한 이름이 아니라 이미 `spec/5-system/3-error-handling.md`·`14-external-interaction-api.md` 등에서 확립된 코드이므로 이번 target 의 "신규 식별자" 충돌 범주에는 해당하지 않는다 (기존 정합성 문제라면 별도 checker 범주).
- **[INFO]** 문서 섹션 번호 `telegram.mdx`/`telegram.en.mdx` §7.4 는 기존 §7.1~§7.3 뒤에 순차 추가되어 중복·재사용 없음. `plan/in-progress/eia-command-waiting-surface-guard.md` 내부 국소 라벨 `F-2` 도 같은 문서 안에서만 쓰이는 finding 번호라 전역 요구사항 ID 네임스페이스(`CCH-*`, `ND-*` 등)와 겹치지 않는다.

집중적으로 살펴본 6개 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로) 중 실질적으로 해당하는 것은 "설정키"(`languageHints.surfaceMismatch`)뿐이며, 이는 기존 5→8개 키(`groupChatRefusal`/`executionStarted`/`executionCompleted`/`executionStillRunning`/`help`/`formOpenLabel`/`sessionExpired`)와 같은 네임스페이스에 동일 lookup 패턴(override → locale default → ko fallback)으로 자연스럽게 확장됐고, i18n dict(`triggers.ts` ko/en `languageHintsHelp`)도 함께 갱신되어 신규 키 목록에 정합하게 반영됐다. 새 API endpoint·webhook/queue 이벤트명·ENV var·spec 파일 경로는 이번 변경에 도입되지 않았다(기존 파일 `15-chat-channel.md` 본문 확장, 기존 파일 `language-hint-defaults.ts`/`hooks.service.ts` 함수 추가에 그침).

## 요약

target 이 새로 도입하는 식별자(`surfaceMismatch` 키, `SURFACE_MISMATCH_DEFAULTS`/`resolveSurfaceMismatchMessage`/`sendSurfaceMismatchNotice`)는 모두 같은 파일 내 기존 명명 컨벤션(`sessionExpired`/`formOpenLabel` 계열)을 그대로 따르며, spec/plan/코드 전 코퍼스에서 동일 이름이 다른 의미로 이미 쓰이는 사례는 발견되지 않았다. 유사 이름인 기존 `OAUTH_STATE_MISMATCH` 는 target 이 새로 만든 것이 아니라 이미 확립된 별개 에러 코드이므로 신규 충돌 범주에 해당하지 않는다. 신규 API endpoint·이벤트명·ENV var·spec 파일 경로 도입도 없다.

## 위험도

NONE
