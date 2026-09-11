# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SSOT 로 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 대조했다.

## 변경 파일 식별

`prompt_file` 이 포함한 변경 set (총 36개 파일):

- `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (신규 파일이지만 이번 diff 는 이전 라운드 대비 무변경 — 파일 2 참조)
- `codebase/backend/src/modules/triggers/trigger-callback-url.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (신규 파일, 무변경)
- `codebase/backend/src/modules/triggers/triggers.module.ts` (수정 — DI 등록)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (수정 — provider 등록 10줄)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정)
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` (수정 — provider 등록 1줄)
- `plan/in-progress/impl-chat-channel-binder-t2.md` (수정)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (수정 — 후속 항목 등재)
- `review/code/2026/09/11/18_04_36/*` 17개 (직전 라운드 리뷰 산출물 + RESOLUTION.md, 신규)
- `review/consistency/2026/09/11/17_39_32/*` 8개 (`--impl-prep` 산출물)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 경로는 이 변경 set 에 **하나도 없다**.

## 매트릭스 매칭 검토

이번 라운드는 직전 라운드(`review/code/2026/09/11/18_04_36`)가 WARNING 1·2 로 짚은 테스트 갭을 메우는 후속 커밋이다. 실질 변경은:

1. `chat-channel-binder.service.spec.ts` 신규 — `teardownChatChannel` 의 adapter 호출·best-effort catch 경로를 직접 행사하는 unit 테스트 4케이스 추가.
2. `trigger-callback-url.spec.ts` 신규 — `buildTriggerCallbackUrl` 순수 함수의 문자열 조립 규칙(fallback·양쪽 슬래시 정규화) 을 직접 단언하는 7케이스 추가.
3. `triggers.module.ts`/`*.spec.ts` — `ChatChannelBinderService` provider 등록(DI 배선), 단언(`expect`) 변경 없음.
4. `RESOLUTION.md` 신규 — 직전 라운드 리뷰 결과 처분 기록.

모두 **테스트 전용 추가 + 순수 리팩터 DI 배선**이며, `buildTriggerCallbackUrl`/`ChatChannelBinderService` 자체의 동작(에러 코드·URL 형태·adapter 호출 인자)은 변경되지 않았다 — RESOLUTION.md 자신이 "동작을 바꾸지 않는다" 를 명시하고 뮤테이션 검증으로 뒷받침한다.

매트릭스 21행을 대조한 결과 (전부 직전 라운드와 동일한 결론이며, 이번 diff 가 테스트/DI 배선만 추가했으므로 재확인만 필요):

| 행 | trigger | 매칭 여부 |
|---|---|---|
| new-node / node-schema-change | `codebase/backend/src/nodes/**` | 불일치 — 경로는 `modules/triggers/`, `nodes/` 아님 |
| new-ui-string | `codebase/frontend/src/**/*.tsx` | 불일치 — frontend 파일 0개 |
| new-widget-chrome-string | `codebase/channel-web-chat/src/**/*.tsx` | 불일치 |
| integration-provider-change | semantic | 불일치 — telegram/slack/discord adapter 호출 자체는 무변경(테스트가 기존 동작을 새로 행사할 뿐) |
| new-userguide-section-dir | `docs/*/` | 불일치 |
| backend-api-change | `*.controller.ts`, `dto/**` | 불일치 — controller/DTO 파일 미포함 |
| new-bullmq-queue | `system-status.constants.ts` | 불일치 |
| new-warning-code | semantic (warningRules) | 불일치 |
| new-error-code | `error-codes.ts` | 불일치 — 미포함, 기존 `CHAT_CHANNEL_ENDPOINT_REQUIRED` 재확인일 뿐 |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | semantic | 불일치 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` | 불일치 — `modules/auth/` 미포함. inbound-signing 검증 로직 자체도 이번 diff 로 변경되지 않음(테스트만 추가) |
| auth-config-type-enum-change | semantic | 불일치 |
| expression-language-change | `packages/expression-engine/**` | 불일치 |
| run-debug-flow-change | semantic | 불일치 |
| env-runtime-change | semantic | 불일치 |
| spec-major-change | `spec/{2,3,4,5}-*/**`, `spec/conventions/**` | 불일치 — `spec/` 파일 0개 |
| userguide-gui-flow-section | `docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx` | 불일치 |
| spec-defect-found | semantic | 해당 없음 — 이번 diff 는 신규 spec 불일치를 만들지 않음(직전 라운드에서 발견된 3곳은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 등재 상태 유지, 재확인만 함) |

## 종합 판단

이번 changeset 은 (a) 직전 리뷰가 지적한 미행사 경로(`teardownChatChannel` adapter 호출, `buildTriggerCallbackUrl` 조립 규칙)를 메우는 **테스트 전용 신규 파일 2개**, (b) 그 테스트가 참조하는 신규 클래스/함수를 DI 그래프에 등록하는 배선 diff, (c) 리뷰/plan 문서로만 구성된다. `codebase/frontend/**`·`codebase/channel-web-chat/**`·`spec/**` 어디에도 파일이 없고, 노드·provider·UI 문자열·warning/error 코드·docs 섹션·인증 흐름·표현식 언어·실행/디버깅 흐름 중 어느 것도 신규/변경되지 않았다. doc-sync-matrix 21개 trigger 중 매칭되는 행이 없다.

## 발견사항

없음.

## 요약

매트릭스 21행 전수 대조 결과 매칭된 trigger 0건, 누락된 동반 갱신 0건. 이번 diff 는 직전 라운드 WARNING 을 해소하는 backend 테스트 신규 2건(순수 함수·adapter 호출 경로 행사) + DI 배선 + 리뷰/plan 문서로만 구성되며 frontend·i18n·docs·spec 경로를 전혀 건드리지 않아 유저 가이드 동반 갱신 관점에서 **해당 없음**이다.

## 위험도

NONE
