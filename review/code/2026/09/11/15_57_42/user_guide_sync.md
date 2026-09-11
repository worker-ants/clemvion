# User Guide Sync 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SoT 로 Read. PROJECT.md §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인(두 문서는 `test_doc_sync_matrix.py` 가 1:1 로 묶어 두므로 행 집합 동일).

## 변경 파일 식별 (실측)

`git diff HEAD~2 --stat` 으로 이번 리뷰 세션(`15_57_42`)이 다루는 전체 changeset(3796c7308 → HEAD, 커밋 `2ae81077c` + `6dc2b7d60`)을 확인했다. 실제 코드 파일은 3개뿐이고 전부 `codebase/backend/src/modules/triggers/` 아래다 — `codebase/backend/src/nodes/**`, `codebase/frontend/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/modules/auth/**`, `*.controller.ts`, `dto/**`, `error-codes.ts` 어디에도 해당하지 않는다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 318줄) — `TriggersService` private 메서드 6개를 module-level 함수로 이동
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정, 324줄 삭제 → import 로 대체)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규, 185줄) — 이동된 함수에 대한 전용 단위 테스트

나머지 27개 변경 파일은 전부 `plan/**`(2개) · `review/code/2026/09/11/15_31_54/**`(20개, 직전 리뷰 라운드 산출물) · `review/consistency/2026/09/11/14_59_33/**`(7개) — 모두 마크다운 산출물이지 매트릭스가 감시하는 `codebase/frontend/src/content/docs/**` · `dict/{ko,en}` · `backend-labels.ts` · `locale.ts` 어느 것도 아니다.

## 트리거 매칭 분석

이번 변경은 이미 존재하던 provider(telegram/slack/discord) 검증 로직 6개 함수를 클래스 private 메서드에서 module-level 순수 함수로 **문자 그대로 이동**하는 리팩터다. `chat-channel-input-rules.spec.ts`(신규)도 같은 로직에 대한 신규 assertion 이 아니라 이동 전 서비스 spec 에서 이미 검증되던 동작을 mock 없이 재확인하는 캐너리·회귀 테스트다(파일 자체 docstring 이 "서비스 경유로 이미 존재하던 커버리지를 옮긴다"고 명시). 매트릭스 21행에 전수 대입:

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 변경 파일은 `src/modules/triggers/` 아래이며 글롭 미매칭.
- **new-ui-string** (`*.tsx`) — frontend TSX 변경 없음.
- **integration-provider-change** (semantic) — `assertInboundSigningPlaintextByProvider` 의 slack/discord/telegram 분기가 파일만 옮겨졌을 뿐 정규식·에러 메시지·필수/금지 조건이 한 글자도 바뀌지 않았다(이전 라운드 api_contract/architecture reviewer 가 이동 전후 텍스트 대조로 이미 확인, 이번 라운드 diff 도 동일 파일에 추가 편집 없음). 신규/변경 provider 없음 → 미매칭.
- **new-userguide-section-dir** — 신규 `content/docs/*/` 디렉토리 없음.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 두 경로 모두 changeset 밖(`git diff --stat` 로 확인).
- **new-warning-code / new-error-code** (`error-codes.ts`) — `error-codes.ts` 자체는 변경 없음. `translateSetupChannelError` 가 던지는 `'BOT_TOKEN_INVALID'`/`'CHAT_CHANNEL_SETUP_FAILED'` 는 이전 PR(`#1314`/`#1317`)에서 이미 존재하던 값을 그대로 옮긴 것 — 신규 발행 없음.
- **auth-session-flow-change** (`src/modules/auth/**`) — 미매칭.
- **expression-language-change** (`packages/expression-engine/**`) — 미매칭.
- **run-debug-flow-change** — 입력 검증 계층 이동일 뿐 실행/디버그 흐름과 무관.
- **spec-major-change / userguide-gui-flow-section** — `spec/**`, `content/docs/**.mdx` 변경 없음.
- 나머지 행(new-widget-chrome-string, new-bullmq-queue, new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-config-type-enum-change, env-runtime-change, spec-defect-found) — 대상 영역과 무관.

## i18n / backend-labels 확인 (grep 실측)

```
grep -rln "assertInboundSigningPlaintextByProvider\|TriggersService" codebase/frontend/src/content/docs codebase/frontend/src/lib/i18n
```
→ 매치 없음(원래도 없어야 정상 — user guide 는 내부 심볼명이 아니라 사용자 관점 서술이라 심볼 이동이 dict 를 건드릴 이유가 없다). `chatChannel`/`botToken`/`inboundSigning` 관련 키는 이번 diff 이전부터 `ko/en triggers.ts` 양쪽에 이미 존재하며 이번 changeset 은 그 파일들을 전혀 건드리지 않는다 — parity 위반 여지 자체가 없음.

## 참고 — 이 리뷰어 영역 밖의 관측 (스코프 아님, 참고용)

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 커밋으로 새로 등재된 두 항목(`slack.md:275`/`discord.md:297` 의 `TriggersService.X` 귀속 표기 정정, `translateSetupChannelError` 502 캐너리)은 **`spec/4-nodes/7-trigger/providers/*.md`** — 즉 기술 명세(spec)에 대한 것이며 이 리뷰어의 대상인 `codebase/frontend/src/content/docs/**`(사용자 가이드 MDX)와는 다른 문서 축이다. 매트릭스 어떤 행에도 해당하지 않는다. 직전 라운드(`15_31_54`)의 architecture reviewer 가 지적했던 "등재 주장이 산출물에 없다"는 WARNING 은 이번 커밋(`6dc2b7d60`, 커밋 메시지 "거짓 등재 주장을 바로잡고")에서 실제로 트래커에 항목이 추가되어 해소된 것으로 관측된다 — user-guide-sync 관점의 판정에는 영향 없음(정보 공유 목적).

## 요약

매트릭스 21개 trigger 행 중 이번 changeset(코드 3파일 + plan/review 마크다운 27파일)에 매칭되는 행은 **0개**다. 실제 코드 변경은 기존 provider(telegram/slack/discord) 검증 로직 6개 함수를 `TriggersService` private 메서드에서 module-level 순수 함수로 동일 문자열·동일 로직으로 옮기고 전용 단위 테스트를 붙인 것이 전부이며, 노드/스키마/UI 문자열/제공자/신규 섹션/인증 흐름/표현식 언어/실행-디버그 흐름/신규 warning·error 코드 중 어느 것도 신규 도입하거나 변경하지 않는다. 유저 가이드 MDX·i18n dict·backend-labels.ts·locale.ts 동반 갱신 누락 없음 — 해당 없음.

## 위험도

NONE
