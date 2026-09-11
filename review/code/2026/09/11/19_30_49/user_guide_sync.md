# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `impl-chat-channel-binder-t2` (19_30_49)

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 22개 항목) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑(L141-211) + §자주 누락되는 항목(L182-198) Read 완료.

## 변경 파일 식별 (이번 라운드 실질 코드 diff)

prompt 가 나열한 71개 항목 중 실제 코드/plan 변경은 파일 1~10, 나머지(11~71)는 이전 리뷰 라운드
(`18_04_36`·`18_42_05`·`19_06_54`·consistency `17_39_32`)의 산출물이 커밋된 것으로 이번 판정 대상인
"신규 코드"가 아니다 (메타 리뷰 문서, doc-sync-matrix trigger 대상 아님):

- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (신규)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (신규)
- `codebase/backend/src/modules/triggers/trigger-callback-url.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/triggers.module.ts` (수정 — provider 등록)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (수정 — private 메서드 제거·위임)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (수정 — provider 배선)
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` (수정 — provider 배선)
- `plan/in-progress/impl-chat-channel-binder-t2.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`

`git diff 9eb201a80 HEAD --stat` 로 브랜치 전체 이력도 대조했으나, docs mdx(`discord`/`slack`/`telegram`)·
`dto/`·`triggers.controller.ts` 변경은 **이 라운드보다 앞선 커밋**(T1 / 이전 세션, 이미 별도로
리뷰·머지된 이력)에 속하며 이번 19_30_49 diff 에는 포함되지 않는다.

## trigger 매칭 결과

`chat-channel-binder.service.ts` 자체 JSDoc 이 "`TriggersService` 에서 그대로 옮겨왔다(동작 보존)"
라고 명시하고, 별도 `api_contract.md`(파일 14, 이전 라운드 산출물)가 에러 코드·메시지·
`chatChannelHealth`/`chatChannelLastError` 갱신 로직·`buildTriggerCallbackUrl` 출력 문자열이
이동 전후 바이트 단위로 동일함을 소스 대조로 확인했다. 본 리뷰어가 `chat-channel-binder.service.ts`
전문을 직접 Read 하여 재확인:

- `CHAT_CHANNEL_ENDPOINT_REQUIRED` — 기존 에러 코드 그대로, 신규 아님
- `chatChannelHealth: 'healthy'/'degraded'` — 기존 값 그대로
- 로그 메시지 리터럴(`TriggersService: ...`) — 클래스명이 바뀌었는데도 **의도적으로 보존**(JSDoc L43-46)
- 신규 config 키·신규 warning/error 코드·신규 provider 없음

매트릭스 22개 행을 전수 대조한 결과 **매칭되는 trigger 없음**:

| trigger | 매칭 여부 | 사유 |
|---|---|---|
| new-node / node-schema-change | 불일치 | `codebase/backend/src/nodes/**` 미터치 (triggers 모듈, nodes 모듈 아님) |
| new-ui-string / new-widget-chrome-string | 불일치 | frontend/channel-web-chat tsx 미터치 |
| integration-provider-change | 불일치(그레이존 검토 후 기각) | chat-channel adapter 호출부이지만 동작·시그니처·에러코드 불변(순수 이동) — "제공자 변경" 아님 |
| new-userguide-section-dir | 불일치 | docs 디렉토리 미생성 |
| backend-api-change | 불일치 | `*.controller.ts`/`dto/**` 미터치 |
| new-bullmq-queue | 불일치 | `system-status.constants.ts` 미터치 |
| new-warning-code / new-error-code | 불일치 | 신규 코드 없음(기존 코드 이동만) |
| new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field | 불일치 | 해당 없음 |
| auth-session-flow-change | 불일치 | `codebase/backend/src/modules/auth/**` 미터치 (triggers 모듈) |
| auth-config-type-enum-change | 불일치 | 해당 없음 |
| expression-language-change | 불일치 | `codebase/packages/expression-engine/**` 미터치 |
| run-debug-flow-change | 불일치 | 실행 엔진/디버그 로깅 아님(트리거 chat-channel 바인딩) |
| env-runtime-change | 불일치 | 해당 없음 |
| spec-major-change | 불일치 | 이번 diff 에 `spec/**` 변경 없음(이전 커밋에서 이미 처리됨) |
| userguide-gui-flow-section | 불일치 | `02-nodes/**.mdx`/`06-integrations-and-config/**.mdx` 미터치 |

추가로 docs mdx 안에 이동된 심볼(`setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`/
`ChatChannelBinderService`/`TriggersService`)을 `<ImplAnchor>` 등으로 직접 참조하는 곳이 있는지
`codebase/frontend/src/content/docs/` 전체를 grep 했으나 **0건** — 심볼 이동이 문서의 `file`/`symbol`
앵커를 깨뜨리지 않는다.

## 발견사항

없음.

## 요약

이번 라운드(19_30_49)의 실질 diff(파일 1~10)는 `TriggersService` 의 private 메서드
`setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl` 을 신규 `ChatChannelBinderService` +
순수 함수 `buildTriggerCallbackUrl` 로 옮기는 **동작 보존 내부 리팩터**다(에러 코드·설정 키·로그
문구·URL 형태 불변, 별도 `api_contract.md`/`concurrency.md` 라운드가 이미 바이트 단위로 대조).
`doc-sync-matrix.json` 22개 행을 전수 대조한 결과 매칭되는 trigger 가 없고, docs mdx 의 ImplAnchor
심볼 참조도 0건이라 이동으로 깨지는 것도 없다. 유저 가이드/i18n dict/backend-labels 동반 갱신
누락 없음 — **해당 없음**.

## 위험도

NONE
