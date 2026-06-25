# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 분석 대상 변경 파일

- `codebase/backend/src/common/constants/presentation.ts` (신규)
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `codebase/channel-web-chat/src/lib/eia-events.test.ts`
- `codebase/channel-web-chat/src/lib/eia-events.ts`
- `codebase/channel-web-chat/src/lib/eia-types.ts`
- `codebase/channel-web-chat/src/widget/use-widget.ts`
- `codebase/frontend/src/app/(main)/web-chat/page.tsx`
- `codebase/frontend/src/components/web-chat/live-preview.tsx`
- `codebase/frontend/src/lib/i18n/dict/en/webChat.ts`
- `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts`
- `spec/5-system/14-external-interaction-api.md`
- `spec/7-channel-web-chat/2-sdk.md`
- `spec/7-channel-web-chat/5-admin-console.md`

## 매트릭스 적재

매트릭스: `/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` (18개 rows).
보조: PROJECT.md §변경 유형 → 갱신 위치 매핑.

## 발견사항

### [INFO] 실행 엔진 신규 이벤트 타입 추가 — 05-run-and-debug 갱신 회색지대

- 변경 파일: `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 매트릭스 항목: `run-debug-flow-change` — "실행·디버깅 흐름 변경" (semantic), targets: `codebase/frontend/src/content/docs/05-run-and-debug/`
- 상세: `ExecutionEventType.EXECUTION_MESSAGE = 'execution.message'` 신규 enum 값이 추가됐고, 비차단 presentation 노드 완료 시 execution-level 이벤트가 발행되는 새 흐름이 생겼다. 다만 이 변경은 admin-console 미리보기 버그 픽스와 web-chat 위젯 대상 SSE 표면 추가이며, 05-run-and-debug/ 는 워크플로우 실행·결과·에러처리 사용자 가이드다. `execution.message` 는 위젯 채널 내부 이벤트로, 일반 사용자 가이드(05-run-and-debug)의 서술 대상(실행 결과 확인 방법, 에러 처리 등)과 직접 연관성이 낮다.
- 판정: 회색지대 — presentation 노드의 "결과 표시" 동작 변경이지만, 이는 채널 구현 세부사항으로 일반 워크플로우 실행 가이드에 새로운 서술이 필요한 사용자 영향은 없다.
- 제안: 불필요. `05-run-and-debug/` 는 이번 변경의 핵심 사용자 경험(미리보기 버그 픽스, 새 세션 버튼)과 직접 매핑되지 않는다. 웹채팅 채널 전용 이벤트라 사용자 가이드 수정 불필요.

### [INFO] channel-web-chat 신규 기능 — 전용 docs 경로 부재로 매트릭스 미매칭

- 변경 파일: `codebase/channel-web-chat/src/lib/eia-events.ts`, `codebase/channel-web-chat/src/widget/use-widget.ts`
- 상세: 웹채팅 위젯 SDK 수준의 변경(`parseMessage` 함수 추가, `resetSession` 커맨드 처리)이다. 매트릭스에 `channel-web-chat/` 전용 trigger는 없다. `spec/7-channel-web-chat/` 아래 spec 파일(2-sdk.md, 5-admin-console.md)이 이번 변경 set에 함께 포함됐으므로 spec 동반 갱신은 이루어졌다. 사용자 가이드(docs MDX) 경로에 웹채팅 전용 섹션 디렉토리가 없으므로 신규 섹션 locale 등록 이슈도 해당 없다.
- 판정: 매트릭스 미매칭. 해당 없음.

## i18n parity 검사

**ko/en 양쪽 동시 갱신 확인됨 — 이상 없음.**

- `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts`: `preview.reset: "새 세션"`, `preview.resetHint: "대화를 처음부터 다시 시작합니다"` 추가.
- `codebase/frontend/src/lib/i18n/dict/en/webChat.ts`: `preview.reset: "New session"`, `preview.resetHint: "Restart the conversation from the beginning"` 동시 추가.
- 매트릭스 항목 `new-ui-string` (TSX 신규 한국어 리터럴 → dict/{ko,en} 양쪽 등록 필수): 신규 UI 문자열 2개 모두 ko/en 양쪽 등록 완료. parity 이상 없음.

## 신규 errorCode / warningCode 검사

`ExecutionEventType.EXECUTION_MESSAGE`는 `ErrorCode` enum(`codebase/backend/src/nodes/core/error-codes.ts`)과 무관한 별개 네임스페이스다. `warningRules`에도 변경 없다. `backend-labels.ts`의 `WARNING_KO` / `ERROR_KO` 매핑 누락 이슈 없음.

## 신규 섹션 디렉토리 검사

이번 변경에서 `codebase/frontend/src/content/docs/<NN>-<name>/` 신규 디렉토리 생성 없음. locale 등록 누락 해당 없음.

## 노드 신규/스키마 변경 검사

`codebase/backend/src/nodes/**` 변경 없음. `new-node` / `node-schema-change` trigger 매칭 없음.

## 통합/제공자 변경 검사

backend 신규/변경 provider 없음. `integration-provider-change` 매칭 없음.

## 요약

유저 가이드 동반 갱신 매트릭스 18개 trigger 중 이번 변경 set에 의미있게 매칭되는 trigger는 `new-ui-string`(i18n parity)와 `run-debug-flow-change`(실행 흐름 semantic) 2개다. i18n parity는 ko/en 양쪽 동시 추가로 완전히 충족됐다. `run-debug-flow-change`는 채널 내부 구현 이벤트로 일반 사용자 가이드 갱신이 불필요한 회색지대 INFO로 판정했다. CRITICAL/WARNING 누락 0건.

## 위험도

NONE
