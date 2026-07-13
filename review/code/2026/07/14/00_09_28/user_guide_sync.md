# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 컨텍스트 요약

변경 set (7 파일) — `languageHints.surfaceMismatch` 신규 키 도입 (F-2 / plan `eia-command-waiting-surface-guard`):

1. `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.spec.ts` — 신규 테스트
2. `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` — `SURFACE_MISMATCH_DEFAULTS` + `resolveSurfaceMismatchMessage` 신설
3. `codebase/backend/src/modules/hooks/hooks.service.spec.ts` — 신규 테스트
4. `codebase/backend/src/modules/hooks/hooks.service.ts` — `sendSurfaceMismatchNotice` 신설, 409 `STATE_MISMATCH` swallow 경로에서 안내 발송
5. `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` — §7.4 신설
6. `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` — §7.4 신설
7. `spec/5-system/15-chat-channel.md` — §4.1.1 표 + 본문 갱신

매트릭스([`doc-sync-matrix.json`](../../../../../../.claude/config/doc-sync-matrix.json)) 기준 이 변경은 **`integration-provider-change`** (통합 신규/제공자 변경, semantic match) 에 해당한다 — `codebase/backend/src/modules/chat-channel/**` / `codebase/backend/src/modules/hooks/**` 의 telegram provider 사용자 가시 동작(봇 안내 메시지) 변경이므로 target 은 `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`.

**핵심 확인**: MDX 문서(파일 5·6, KO/EN 양쪽)와 spec(파일 7)이 **같은 변경 set 안에 이미 포함**돼 있다. §7.4 절 신설 내용도 실제 `SURFACE_MISMATCH_DEFAULTS` 문구·lookup 순서·MarkdownV2-safe 근거와 정확히 일치한다. 이 부분은 매트릭스 요구를 정확히 충족한 모범 사례다.

## 발견사항

- **[WARNING]** 트리거 상세 drawer 의 `languageHints` 편집 도움말(dict)에 `surfaceMismatch` 키 미열거
  - 변경 파일: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` (SURFACE_MISMATCH_DEFAULTS 신설) — trigger
  - 매트릭스 항목: `integration-provider-change` — "codebase/frontend/src/content/docs/06-integrations-and-config/\<provider\>.{mdx,en.mdx} **+ dict 키**"
  - 누락된 동반 갱신: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` / `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` 의 `languageHintsHelp` 문자열
  - 상세: 이 문자열은 트리거 상세 drawer 의 Chat Channel 카드(`codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`)에서 `languageHints` JSON textarea 위에 표시되는 in-app 도움말로, 현재 알려진 override 키를 명시적으로 나열한다:
    - ko: `"봇이 보내는 자체 안내 메시지 키 — groupChatRefusal / executionStarted / executionCompleted / executionStillRunning / help. " + "실행 실패 안내(CCH-ERR-*) 6 키: ..."` (`codebase/frontend/src/lib/i18n/dict/ko/triggers.ts:237-240`)
    - en: 동일 구조 (`codebase/frontend/src/lib/i18n/dict/en/triggers.ts:246-249`)

    이번에 도입된 `surfaceMismatch` 는 이 열거 목록에 없다. 운영자가 이 도움말만 보고 `languageHints` 를 커스터마이즈하면 `surfaceMismatch` 키의 존재를 알 수 없다 — 기능 자체(JSON 파싱)는 막히지 않지만(임의 키 허용), **발견 가능성(discoverability)이 문서 MDX 에만 있고 in-app 도움말에는 없어** 실제로 이 override 를 쓰려는 운영자는 반드시 telegram.mdx §7.4 까지 찾아가야 한다.
  - 참고: 같은 목록에 이미 `formOpenLabel`(2026-05-28 도입) · `sessionExpired`(§7.5) 도 누락돼 있어 이 PR 이전부터 존재하던 반복 패턴("자주 누락되는 항목" 표 §"backend warning/error code → ko 매핑"과 유사한 성격의 dict staleness)이다. 즉 이번 PR 이 새로 만든 회귀는 아니지만, 이번 PR 도 같은 갭을 한 번 더 답습했다. ko/en 은 대칭이라 i18n parity(CRITICAL) 문제는 아님 — WARNING 수준.
  - 제안: `languageHintsHelp` (ko/en 양쪽) 에 `surfaceMismatch` 를 추가 열거. 가능하면 같은 PR 에서 `formOpenLabel` / `sessionExpired` 도 함께 백필해 목록을 실제 지원 키 전체와 동기화 (해당 dict 키에 대한 별도 guard test 는 없어 보임 — `pnpm --filter frontend test -- i18n` 로는 잡히지 않는 순수 텍스트 콘텐츠 이슈).

## 매칭되지 않은/해당 없음 확인

- **새 노드 추가 / 노드 schema 변경** — `codebase/backend/src/nodes/**` 변경 없음 → 해당 없음
- **신규 UI 문자열 (TSX)** — 이번 변경 set 에 `.tsx` 파일 없음 → 해당 없음, i18n parity(CRITICAL) 이슈 없음
- **신규 섹션 디렉토리** — `codebase/frontend/src/content/docs/<NN>-<name>/` 신설 없음 (기존 `06-integrations-and-config/` 내 파일 수정) → 해당 없음
- **인증·권한·세션 흐름 변경** — `codebase/backend/src/modules/auth/**` 변경 없음 (chat-channel/hooks 모듈만 변경) → 해당 없음
- **표현식 언어 변경** — `codebase/packages/expression-engine/**` 변경 없음 → 해당 없음
- **실행·디버깅 흐름 변경** — execution engine 본체(§7.5.1) 변경 아님, spec 문서에서 참조만 함 → 해당 없음
- **신규 warningCode/errorCode** — `STATE_MISMATCH` 는 기존 코드 재사용(`codebase/backend/src/common/filters/http-exception.filter.spec.ts`, `interaction.service.spec.ts` 등에서 이미 사용 중, `error-codes.ts` 변경 없음) → 신규 아님, `backend-labels.ts` ERROR_KO/WARNING_KO 매핑 갱신 불필요

## 요약

매트릭스 20개 trigger 항목 중 이번 diff 는 `integration-provider-change` 1개에 매칭됐다. 이 항목의 필수 동반 갱신 중 docs MDX(KO/EN) + spec 은 같은 변경 set 안에서 정확히 완료됐으나(모범 사례), in-app `languageHints` 도움말 dict 문자열(`languageHintsHelp`, ko/en 양쪽 대칭) 이 신규 키 `surfaceMismatch` 를 열거하지 못한 WARNING 1건이 남아있다 — 기능 차단은 아니며 discoverability 저하 수준, 또한 기존에 이미 존재하던 패턴(누락 키 2개 추가 답습)이라 이번 PR 단독 회귀는 아니다.

## 위험도

LOW
