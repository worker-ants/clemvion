# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SSOT 로 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (라인 141~185, JSON 과 21행 1:1) 을 보조로 대조했다.

## 변경 파일 식별

`prompt_file` 이 나열한 53개 파일 + 독립 검증 `git diff --name-only origin/main...HEAD` 결과가 정확히 일치함을 확인했다 (53개, `review/code/2026/09/11/19_06_54/` 자기 산출물 제외). 구성:

- 코드(8개, 전부 `codebase/backend/src/modules/triggers/`): `chat-channel-binder.service.{ts,spec.ts}`(신규), `trigger-callback-url.{ts,spec.ts}`(신규), `triggers.module.ts`(DI 등록), `triggers.service.{ts,spec.ts}`(호출부 위임 + provider 등록), `triggers.web-chat.spec.ts`(provider 등록)
- plan 2개: `plan/in-progress/impl-chat-channel-binder-t2.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
- 이전 두 라운드(`18_04_36`, `18_42_05`)의 리뷰 산출물 34개 + `--impl-prep` consistency 산출물 8개(`review/consistency/2026/09/11/17_39_32/**`) — 전부 프로세스 문서, `codebase/`/`spec/` 아님

`git diff --name-only origin/main...HEAD | grep -E "frontend|channel-web-chat|content/docs"` 는 **0건**이다 — 이 브랜치 전체(3개 커밋 누적)에 `codebase/frontend/**`·`codebase/channel-web-chat/**`·`spec/**` 파일이 하나도 없음을 직접 확인했다.

## 매트릭스 매칭 검토

이 changeset 의 실질은 `TriggersService` private 메서드 2개(`setupChatChannel`/`teardownChatChannel`)와 `buildCallbackUrl` 헬퍼를 신규 `ChatChannelBinderService`(`@Injectable` provider)·`buildTriggerCallbackUrl`(순수 함수)로 옮기는 **동작 보존 리팩터**(2회 rebuttal 라운드에서 단언·URL 형태·에러 코드가 이동 전후 바이트 단위로 동일함을 mutation testing 으로 확인됨)에, 이번 3라운드째 추가된 테스트(`trigger-callback-url.spec.ts` 조립 규칙 · `chat-channel-binder.service.spec.ts` teardown adapter 경로 · `triggers.service.spec.ts` 의 `rotateBotToken` config-key 단언)가 얹힌 것이다. 21행 전수 대조:

| trigger | 판정 |
|---|---|
| new-node / node-schema-change (`nodes/**`) | 불일치 — `modules/triggers/`, `nodes/` 아님 |
| new-ui-string (`frontend/**/*.tsx`) | 불일치 — frontend 파일 0개 |
| new-widget-chrome-string (`channel-web-chat/**/*.tsx`) | 불일치 |
| integration-provider-change (semantic) | 불일치 — slack/discord/telegram adapter 호출 인자·순서가 이동 전후 동일함이 실측됨(단언 diff 0). "제공자 변경" 아니라 내부 구조 변경 |
| new-userguide-section-dir (`docs/*/`) | 불일치 |
| backend-api-change (`*.controller.ts`, `dto/**`) | 불일치 — controller/DTO 파일 미포함. `rotate-bot-token` OpenAPI 데코레이터 부재는 사전 존재 갭(별도 등재, 이 diff 유발 아님) |
| new-bullmq-queue (`system-status.constants.ts`) | 불일치 |
| new-warning-code (semantic warningRules) | 불일치 — 신규 warningRule 없음 |
| new-error-code (`error-codes.ts`) | 불일치 — 파일 미포함. `CHAT_CHANNEL_ENDPOINT_REQUIRED` 는 이동 전부터 있던 기존 에러(diff `-`/`+` 양쪽 동일 문자열로 확인됨), 신규 발행 아님 |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | 불일치 |
| auth-session-flow-change (`modules/auth/**`) | 불일치 — `modules/auth/` 미포함. chat-channel inbound-signing(webhook 서명) 검증은 워크스페이스/세션 인증과 다른 축이고 이번 diff 는 그 로직 자체도 바꾸지 않음(호출 위치만 이동) |
| auth-config-type-enum-change | 불일치 |
| expression-language-change (`packages/expression-engine/**`) | 불일치 |
| run-debug-flow-change (semantic) | 불일치 — webhook 등록/해제이지 실행·디버깅 흐름 아님 |
| env-runtime-change | 불일치 |
| spec-major-change (`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) | 불일치 — `spec/` 파일 0개(plan 문서가 `spec_impact: none` 명시) |
| userguide-gui-flow-section (`docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx`) | 불일치 |
| spec-defect-found (semantic) | 부분 관련 — 아래 참고, 조치 불요로 판정 |

### spec-defect-found — 이미 규약대로 처리됨 (조치 불요)

`--impl-prep`(`review/consistency/2026/09/11/17_39_32`)의 `plan_coherence`/`rationale_continuity` checker 가, 이 이동으로 `spec/conventions/secret-store.md:146`·`spec/conventions/chat-channel-adapter.md:369`·`spec/data-flow/14-chat-channel.md:29` 세 곳이 `setupChatChannel` 을 `TriggersService` 소유로 서술한 것이 stale 화됐음을 WARNING 으로 짚었다. developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 제안 노트로 등재해 planner 위임 절차를 밟았다(같은 changeset 안에서 그 파일 수정으로 확인). 이 세 파일은 `spec/conventions/`·`spec/data-flow/` — 본 리뷰어 스코프(`codebase/frontend/src/content/docs/**`, i18n dict, `backend-labels.ts`)가 아니며, 규약대로 처리됐으므로 추가 조치 불요.

## 이전 라운드와의 정합성

이번(3라운드째) 리뷰 대상에는 직전 두 라운드(`18_04_36`, `18_42_05`)의 `user_guide_sync.md` 산출물이 포함돼 있다 — 둘 다 독립적으로 21행 전수 대조 후 매칭 0건·NONE 을 냈다. 이번 라운드에서 코드 측 실질 변경(`triggers.service.spec.ts` 의 `rotateBotToken` config-key 단언 추가 등)도 여전히 `codebase/backend/src/modules/triggers/**` 내부에 머물러 있어, 매트릭스 판정에 변화를 주는 신규 파일이 없다. 3라운드 연속 동일 결론.

## 발견사항

없음.

## 요약

매트릭스 21행 전수 대조 결과 매칭된 trigger 0건, 누락된 동반 갱신 0건. `git diff --name-only origin/main...HEAD` 로 브랜치 전체를 직접 재확인한 결과 `codebase/frontend/**`·`codebase/channel-web-chat/**`·`spec/**` 파일이 이 PR 에 하나도 없다 — `TriggersService` 의 chat-channel adapter setup/teardown/URL 조립 로직을 신규 `ChatChannelBinderService`/순수 함수로 옮기는 backend-only 동작 보존 리팩터(+ 그 검증 테스트, + plan/review 프로세스 문서)이기 때문이다. 노드·provider·UI 문자열·warning/error 코드·docs 섹션·인증 흐름·표현식 언어·실행/디버깅 흐름 중 어느 것도 신규/변경되지 않아 유저 가이드 동반 갱신 관점에서 **해당 없음**이다. 부수적으로 발견된 spec 서술 stale 화 3곳은 consistency-checker 스코프이며 이미 규약대로 planner 인계 항목으로 등재돼 있다.

## 위험도

NONE
