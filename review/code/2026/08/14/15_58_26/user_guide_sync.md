# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]` 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (127~197행) 을 Read 함.

## 변경 파일 식별

`git diff --name-only origin/main...HEAD` 로 실제 변경 set 을 확인 (review/consistency 산출물 다수 제외한 코드/문서 성격 파일):

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (+ `.spec.ts`)
- `plan/in-progress/eia-terminal-payload.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`, `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
- `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` — **이전 라운드(`14_55_29`) 리뷰 이후 새로 추가된 변경 파일**
- `review/code/**`, `review/consistency/**` (리뷰 산출물 — 매트릭스 대상 아님)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**` 는 이번 변경 set 에 전혀 없음 — frontend 코드 파일이 단 하나도 diff 에 포함되지 않았다.

## trigger 매칭 검토

이전 라운드(`review/code/2026/08/14/14_55_29/user_guide_sync.md`)에서 매칭 trigger 0건으로 판정된 항목(new-node / node-schema-change / new-ui-string / integration-provider-change / new-userguide-section-dir / backend-api-change / new-warning-code / new-error-code / auth-session-flow-change / expression-language-change / run-debug-flow-change / new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field / AuthConfig / new-bullmq-queue / env-runtime-change)은 이번 라운드 diff 에 새로 추가된 코드도 이 판정을 뒤집지 않는다 (external-interaction/websocket/shared-utils 범위 안에서 depth-무관 strip·REST 스냅샷 동기화만 계속 다듬어졌을 뿐, 신규 노드/UI 문자열/provider/섹션/enum/필드/warning·error 코드가 전혀 추가되지 않음 — 오히려 필드를 **제거**하는 방향).

새로 확인이 필요한 것은 이전 라운드 이후 diff 에 편입된 `spec/` 3개 파일뿐이다.

- **spec-major-change** (`spec/{2,3,4,5}-**.md`, `spec/conventions/**.md`) — `spec/5-system/14-external-interaction-api.md`(111줄 변경), `spec/5-system/6-websocket-protocol.md`(6줄 변경) 가 glob 매칭. `spec/1-data-model.md` 는 매트릭스 glob 대상(`spec/{2,3,4,5}-**`)에 **포함되지 않음**(`spec/1-*` 미지정) — 매칭 없음.
  - 두 매칭 파일의 현재 frontmatter 확인: 둘 다 `status: partial` + `pending_plans:` 가 이미 각각 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 를 가리키고 있고, 두 plan 파일 모두 실존한다(2026-08-13 기존 파일, 이번 diff 대상 아님). `code:` 글로브도 이번에 변경된 `external-interaction/**`, `websocket.service.ts` 를 이미 커버한다. 즉 (a)(b)(c) 요건이 이미 충족된 상태이며 이번 diff 는 그 안에서 **본문 prose 정정**(에러 객체 nullable 필드 서술, WS §4.4.6 링크 정정, waiting_for_input payload 봉투 주석 추가)만 수행 — frontmatter 재조정이 필요한 변화가 아님. 갭 없음.

나머지 항목:

- **run-debug-flow-change** (`05-run-and-debug/`) — 재확인. 이번 diff 로 추가된 `websocket.service.ts` 변경(`stripDeep` 도입)은 CHANGELOG·RESOLUTION.md 서술상 "내부 WS(에디터) 채널은 종전대로 full payload 를 받는다"(대조군 테스트로 고정)를 명시 — 즉 사용자가 앱 내에서 실행 결과/디버그를 보는 흐름은 동작 변화가 없다. `docs/05-run-and-debug/*.mdx` 에 `llmCalls`/`turnDebug`/외부 payload 관련 서술도 없어(이전 라운드에서 grep 확인, 이번 diff 로 추가되지 않음) 갱신 대상 아님.
- 그 외 17개 행 — 매칭 없음 (노드/UI/provider/섹션/auth/표현식/enum/필드/warning·error 코드 무변경).

## 결론

이번 diff 는 external-interaction REST 스냅샷과 WebSocket fanout 에서 `llmCalls`(raw LLM 요청/응답)가 depth 와 무관하게 새던 보안 결함을 막는 backend 수정 + 그 수정을 뒤따라 EIA/WS spec 문서 본문을 실제 동작에 맞춰 정정하는 것으로 구성된다. frontend 코드가 diff 에 없고, 노드/스키마/UI 문자열/통합 provider/신규 섹션/인증 흐름/표현식 언어/warning·error 코드/신규 enum·필드 어느 것도 추가·변경되지 않았다. 유일하게 새로 매칭된 `spec-major-change` (spec/5-system 2개 파일) 도 frontmatter (`status`/`pending_plans`/`code`) 가 이미 정합 상태라 동반 갱신 누락이 없다.

## 요약

매트릭스 20개 행 전수 검토 — 매칭 trigger 는 `spec-major-change` 1건뿐이고(spec/5-system/14-external-interaction-api.md, spec/5-system/6-websocket-protocol.md), 해당 파일들의 frontmatter(a)(b)(c) 요건은 이미 충족돼 누락 0건이다. 나머지 19개 행은 미매칭. 이번 diff 는 순수 backend 보안 수정 + 그 수정에 맞춘 spec 본문 prose 정정으로, frontend docs MDX·i18n dict·backend-labels.ts 어느 것도 대상 파일 목록에 없어 동반 갱신 누락이 없다. 판정: **해당 없음**.

## 위험도

NONE
