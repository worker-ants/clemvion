# User Guide Sync 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows: 21) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L141-198) 을 SoT 로 사용.

## 변경 파일 (커밋 `2ae81077c`, 11개)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 318줄)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정, private 메서드 5개+1개 삭제 → import 로 대체)
- `plan/in-progress/impl-chat-channel-binder.md` (신규 plan)
- `review/consistency/2026/09/11/14_59_33/*` (7개 — consistency-check 산출물)

## 트리거 매칭 분석

이번 변경은 `TriggersService` 내부에 있던 chat-channel 입력 검증 순수 함수 6개(`assertChatChannelInputSafe`, `assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`, `stripChatChannelPlaintext`, `assertInboundSigningPlaintextByProvider`, `translateSetupChannelError`)를 클래스 private 메서드에서 module-level 함수로 **그대로 옮기는(move)** 리팩터다. plan 자체가 "이 PR 의 주장은 하나다 — 동작 보존" 이라 명시하고, 커밋 통계도 순수 이동(신규 318줄 ≈ 삭제 324줄)을 뒷받침한다. 각 trigger 행에 대입:

- **new-node** / **node-schema-change** (`codebase/backend/src/nodes/**`) — 변경 파일은 `src/modules/triggers/` 아래이며 `src/nodes/**` 글롭에 매칭되지 않는다. 노드 신규/스키마 변경 아님 → 미매칭.
- **new-ui-string** (`*.tsx`) — frontend TSX 변경 없음 → 미매칭.
- **integration-provider-change** (semantic) — slack/discord/telegram 분기 로직(`assertInboundSigningPlaintextByProvider`)이 파일만 옮겨졌을 뿐 **에러 메시지·검증 규칙·정규식 텍스트가 한 글자도 바뀌지 않았다**(diff 대조 확인: 옛 `triggers.service.ts` 삭제 블록과 신규 `chat-channel-input-rules.ts` 추가 블록이 동일 문자열). 제공자 신규/변경이 아니므로 `06-integrations-and-config/{slack,discord,telegram}.mdx` 갱신 트리거 아님.
- **new-userguide-section-dir** — 신규 docs 디렉토리 없음 → 미매칭.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — controller/DTO 파일 변경 없음(트리거는 서비스 내부 리팩터만) → 미매칭.
- **new-warning-code** / **new-error-code** (`error-codes.ts`) — `ErrorCode.INVALID_FIELD` 등은 기존 값을 import 만 할 뿐 `error-codes.ts` 자체는 변경 안 됨. `'VALIDATION_ERROR'`/`'BOT_TOKEN_INVALID'`/`'CHAT_CHANNEL_SETUP_FAILED'` 문자열도 이전 PR(`#1314`/`#1317`)에서 이미 존재하던 값을 그대로 옮긴 것 — 신규 발행 없음 → 미매칭.
- **auth-session-flow-change** (`src/modules/auth/**`) — 변경 파일은 `src/modules/triggers/`, `src/modules/auth/` 아님 → 미매칭.
- **expression-language-change** (`packages/expression-engine/**`) — 미매칭.
- **run-debug-flow-change** — 실행/디버그 로깅 흐름과 무관(입력 검증 계층 이동) → 미매칭.
- **spec-major-change** / **userguide-gui-flow-section** — `spec/**`, `docs/**mdx` 변경 없음 → 미매칭.

## i18n / backend-labels 확인 (grep 실측)

`codebase/frontend/src/content/docs/`, `codebase/frontend/src/lib/i18n/dict/`, `codebase/frontend/src/lib/i18n/backend-labels.ts` 어디에도 `assertInboundSigningPlaintextByProvider`/`setupChatChannel`/`TriggersService` 같은 내부 심볼 참조가 없고(원래도 없어야 정상 — user guide 는 심볼명이 아닌 사용자 관점 서술), `chatChannel`/`botToken`/`inboundSigning` 키는 `ko/en triggers.ts` 양쪽에 **이미** 존재한다(이번 diff 로 추가된 키 없음 → parity 위반 여지 자체가 없음).

## 참고 — 이 리뷰어 영역 밖의 관측 (스코프 아님, 참고용)

동봉된 `review/consistency/2026/09/11/14_59_33/SUMMARY.md` 가 별도로 지적한 이슈(WARNING #1, #2 — `spec/5-system/15-chat-channel.md` §7, `spec/4-nodes/7-trigger/providers/{slack,discord}.md` 의 "TriggersService.X" 귀속 서술이 이동으로 부정확해짐)는 **spec/*.md 문서**(`cross_spec`/`naming_collision` checker 영역)에 대한 것이며, 커밋 메시지에도 "planner 항목으로 등재했다"고 명시돼 있어 이미 정상 프로세스로 트래킹되고 있다. 이는 본 리뷰어(user-guide-sync)의 대상인 `codebase/frontend/src/content/docs/**`(사용자 가이드 MDX) · `dict/{ko,en}` · `backend-labels.ts` 와는 다른 문서 축이라 매트릭스 어떤 행에도 해당하지 않는다 — CRITICAL/WARNING 아님, 정보 공유 목적으로만 기재.

## 요약

매트릭스 21개 trigger 행 중 이번 변경 파일 셋(backend 서비스 리팩터 2개 + plan 1개 + consistency 산출물 7개)에 매칭되는 행은 **0개**다. 이 PR 은 `TriggersService` 의 private 메서드를 동일 로직·동일 문자열로 module-level 함수로 옮기는 순수 이동(behavior-preserving move)이며, 노드/스키마/UI 문자열/제공자/신규 섹션/인증 흐름/표현식 언어/실행-디버그 흐름/신규 warning·error 코드 중 어느 것도 변경하지 않는다. 유저 가이드 MDX·i18n dict·backend-labels.ts 동반 갱신 누락 없음.

## 위험도

NONE — 해당 없음.
