# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SSOT 로 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (라인 141~210) 을 보조로 대조했다.

## 변경 파일 식별

`prompt_file` 이 포함한 변경 set (총 16개 파일):

- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (신규)
- `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (신규)
- `codebase/backend/src/modules/triggers/triggers.module.ts` (수정)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (수정)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정)
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` (수정)
- `plan/in-progress/impl-chat-channel-binder-t2.md` (신규 — 이 turn 의 plan)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (수정 — 후속 항목 등재)
- `review/consistency/2026/09/11/17_39_32/*` 8개 (`--impl-prep` 산출물, 신규)

`codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**` 경로는 이 변경 set 에 **하나도 없다** (`git status`/diff 목록 기준으로도 동일 — plan 문서 자체가 "`spec_impact: none`" 을 명시).

## 매트릭스 매칭 검토

이 diff 의 실질은 `TriggersService` 안에 있던 **private 메서드 2개**(`setupChatChannel`/`teardownChatChannel`, 212줄)와 `buildCallbackUrl` 헬퍼를 각각 `ChatChannelBinderService`(신규 `@Injectable` provider)와 `buildTriggerCallbackUrl`(신규 순수 함수)로 **그대로 옮긴 것**이다. plan 문서 자체가 "단언(`expect`) diff 0줄" 을 증거로 들고 있고(§증거), 로그 메시지 리터럴까지 의도적으로 보존했다고 명시한다 — 동작 변경이 없는 순수 리팩터.

각 매트릭스 행을 대조한 결과:

| 행 | trigger | 매칭 여부 |
|---|---|---|
| new-node / node-schema-change | `codebase/backend/src/nodes/**` | 불일치 — 변경 경로는 `modules/triggers/`, `nodes/` 아님 |
| new-ui-string | `codebase/frontend/src/**/*.tsx` | 불일치 — frontend 파일 0개 |
| new-widget-chrome-string | `codebase/channel-web-chat/src/**/*.tsx` | 불일치 |
| integration-provider-change | semantic (신규/변경 provider) | 불일치 — slack/discord/telegram adapter 호출 자체는 그대로이고 **동작 보존**이 이 PR 의 핵심 주장(단언 diff 0줄 실측). "제공자 변경" 아님 |
| new-userguide-section-dir | `docs/*/` | 불일치 |
| backend-api-change | `*.controller.ts`, `dto/**` | 불일치 — controller/DTO 파일 미포함 (convention_compliance checker 가 `rotateBotToken` OpenAPI 데코레이터 부재를 지적했으나, 그 컨트롤러 파일 자체는 **이 diff 에 없다** — 사전 존재 갭으로 별도 등재됨, 이 changeset 의 신규 유발 아님) |
| new-bullmq-queue | `system-status.constants.ts` | 불일치 |
| new-warning-code | semantic (warningRules) | 불일치 — 신규 warningRule 없음 |
| new-error-code | `error-codes.ts` | 불일치 — `error-codes.ts` 미포함. `CHAT_CHANNEL_ENDPOINT_REQUIRED` 는 이동 전 코드에 이미 존재하던 에러(diff 상 `-`/`+` 양쪽에 동일 문자열로 확인) — 신규 발행 아님 |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | semantic | 불일치 — 해당 없음 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` | 불일치 — 변경 경로는 `modules/triggers/`, `modules/auth/` 아님. chat-channel inbound-signing 검증(webhook 서명)은 워크스페이스/세션 인증과 다른 축이고 이번 diff 가 그 검증 로직 자체를 바꾸지도 않음(호출 위치만 이동) |
| auth-config-type-enum-change | semantic | 불일치 |
| expression-language-change | `packages/expression-engine/**` | 불일치 |
| run-debug-flow-change | semantic (실행 엔진) | 불일치 — trigger의 webhook 등록/해제이지 실행·디버깅 흐름이 아님 |
| env-runtime-change | semantic | 불일치 |
| spec-major-change | `spec/{2,3,4,5}-*/**`, `spec/conventions/**` | 불일치 — `spec/` 파일 0개 (plan 신설 문서만 있음, `spec_impact: none` 명시) |
| userguide-gui-flow-section | `docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx` | 불일치 |
| spec-defect-found | semantic | **부분 관련이나 이미 올바르게 처리됨** — 아래 참고 |

### 참고 — spec-defect-found 는 이미 규약대로 처리됨 (조치 불요)

`--impl-prep` (`review/consistency/2026/09/11/17_39_32`) 의 `plan_coherence`/`rationale_continuity` checker 가 이 이동으로 인해 `spec/conventions/secret-store.md:146`, `spec/conventions/chat-channel-adapter.md:369`, `spec/data-flow/14-chat-channel.md:29` 세 곳이 `setupChatChannel` 을 `TriggersService` 소유로 잘못 서술(현재형)하게 됨을 WARNING 으로 짚었다. 이는 CLAUDE.md 표의 "spec 자체에 누락·오류가 있다고 판단됨" 행에 해당하며, 규약대로 developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 제안 노트로 등재해 planner 위임으로 넘겼다(같은 diff 안에 `plan/in-progress/spec-draft-nullable-notation-followups.md` 수정으로 확인됨). **단, 이 세 파일은 `spec/conventions/`·`spec/data-flow/` — 본 리뷰어의 스코프인 "유저 가이드"(`codebase/frontend/src/content/docs/**`, i18n dict, `backend-labels.ts`) 가 아니다.** consistency-checker 영역이고 이미 올바른 절차(자기 손으로 못 고치는 spec 을 코드 안에서 고치지 않고 planner 인계)를 밟았으므로 본 리뷰에서 추가 조치를 요구하지 않는다.

## 종합 판단

이 changeset 은 `codebase/frontend/**` · `codebase/channel-web-chat/**` · `spec/**` 어디에도 파일이 없는 **backend 내부 리팩터**(private 메서드를 별도 Nest provider 로 이동, 동작 보존)와 그에 딸린 plan/review 문서로만 구성된다. 신규 노드·신규 provider·신규 UI 문자열·신규 warning/error 코드·신규 docs 섹션·인증 흐름 변경·표현식 언어 변경·실행/디버깅 흐름 변경 중 어느 것도 발생하지 않았으므로 doc-sync-matrix 의 21개 trigger 중 어느 것도 매칭되지 않는다.

## 발견사항

없음.

## 요약

매트릭스 21행 전수 대조 결과 매칭된 trigger 0건, 누락된 동반 갱신 0건. 이 diff 는 `TriggersService` private 메서드 2개를 `ChatChannelBinderService`(신규 provider)로 옮기는 순수 backend 리팩터(단언 diff 0줄, 동작 보존 명시)와 plan/review 문서로만 구성되며 frontend·i18n·docs·spec 경로를 전혀 건드리지 않아 유저 가이드 동반 갱신 관점에서 **해당 없음**이다. 부수적으로 발견된 spec 서술 stale 화(3곳)는 consistency-checker 스코프이며 이미 규약대로 planner 인계 항목으로 등재돼 있어 추가 조치 불요.

## 위험도

NONE
