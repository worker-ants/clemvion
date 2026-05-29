# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 확인

PROJECT.md §변경 유형 → 갱신 위치 매핑 표를 SoT 로 적재했습니다. 매트릭스 trigger 총 19개 행 확인.

---

## 변경 파일 목록

staged 변경 파일 (16개):

- `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` (신규)
- `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` (수정)
- `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.spec.ts` (수정)
- `codebase/backend/src/modules/execution-engine/execution-engine.module.ts` (수정)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (수정)
- `codebase/backend/src/modules/executions/executions.controller.ts` (수정)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` (수정)
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (수정)
- `plan/in-progress/workflow-resumable-execution.md` (수정)
- `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` (수정)
- `spec/5-system/4-execution-engine.md` (수정)

---

## Trigger 매칭 분석

### Trigger: "새 노드 추가" — 해당 없음

변경 파일 중 `codebase/backend/src/nodes/<cat>/<name>/` 패턴에 매칭되는 파일 없음.

### Trigger: "노드 schema 변경" — 해당 없음

노드 필드·라벨·타입 변경 없음.

### Trigger: "신규 UI 문자열 (TSX)" — 해당 없음

TSX 파일 변경 없음. 한국어 리터럴 추가 없음.

### Trigger: "통합/제공자 변경" — 해당 없음

통합 provider 관련 변경 없음.

### Trigger: "유저 가이드 신규 섹션 디렉토리" — 해당 없음

`codebase/frontend/src/content/docs/<NN>-<name>/` 신규 디렉토리 없음.

### Trigger: "인증·권한·세션 흐름 변경" — 해당 없음

`codebase/backend/src/auth/**` 또는 권한·세션 미들웨어 변경 없음.

### Trigger: "표현식 언어 변경" — 해당 없음

`codebase/packages/expression-engine/**` 변경 없음.

### Trigger: "신규 warningCode/errorCode 발행" — 해당 없음

`codebase/backend/src/nodes/core/error-codes.ts`의 `ErrorCode` enum 변경 없음. `warningRules` 변경 없음. `InvalidExecutionStateError`는 node 실행 에러 코드 체계(`ErrorCode` enum)와 무관한 execution-level 에러 클래스이며, `backend-labels.ts`의 `WARNING_KO` / `ERROR_KO` 매핑 대상이 아니다.

### Trigger: "실행·디버깅 흐름 변경" — 부분 매칭 (INFO)

**매칭 파일**:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `resolveWaitingNodeExecutionId` 동작 변경: 기존 sentinel `__no_node_exec__` 반환 → `InvalidExecutionStateError` throw
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — WS ack 응답에 `errorCode` 필드 추가 (`INVALID_EXECUTION_STATE`)
- `codebase/backend/src/modules/executions/executions.controller.ts` — REST 422 `INVALID_STATE` 에러 코드 신규 발행
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` — 409 `STATE_MISMATCH` 에러를 `assertWaiting` 통과 후 race window 에서도 발행

**동반 갱신 대상 (매트릭스 middle column)**: `codebase/frontend/src/content/docs/05-run-and-debug/`

**현황**: `05-run-and-debug/` 내 어느 파일도 이번 변경 set 에 포함되지 않음.

**판정 근거 — INFO (WARNING 이하)**:

이 변경의 핵심은 에러 응답의 정밀도 개선(silent fallback → explicit error code)이며, 사용자 가시 동작(에러 메시지 표시)은 동일하다.

1. `InvalidExecutionStateError`의 `errorCode` 필드는 현재 **frontend 에서 소비되지 않음** (`use-execution-interaction-commands.ts` 에 `errorCode` 핸들러 없음). 즉 WS ack에 새 필드가 추가됐지만 UI에서 렌더링되지 않는다.
2. REST 422 `INVALID_STATE`는 에디터 내 `continueExecution` 호출 결과를 처리하는 UI 코드가 있지만, 에러 메시지 자체를 사용자에게 보여주는 방식은 기존과 동일하다.
3. `ContinuationDlqMonitorService` 및 `onFailed` 핸들러는 순수 내부 운영 가시성(로그 기반 알람)으로 사용자에게 노출되지 않는다.

---

## 발견사항

### [INFO] 실행·디버깅 흐름 변경 — 05-run-and-debug 동반 갱신 미수행

- **변경 파일**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `codebase/backend/src/modules/executions/executions.controller.ts`
- **매트릭스 항목**: "실행·디버깅 흐름 변경" → `codebase/frontend/src/content/docs/05-run-and-debug/`
- **누락된 동반 갱신**: `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx` 및 `.en.mdx`
- **상세**: 실행 continuation 진입점(WS ack, REST 422)에 신규 에러 코드(`INVALID_EXECUTION_STATE`, `INVALID_STATE`)가 추가됐다. 현재 frontend 에서 `errorCode` 필드를 소비하지 않으므로 UI 동작 변화는 없다. 그러나 WS 프로토콜 계약(`errorCode` 필드 추가)과 REST 422 응답 스키마 변화가 문서화되지 않은 채로 남아 있다. API 통합자 또는 향후 개발자에게 stale 문서를 제공하는 결과가 된다.
- **제안**: 현재 frontend `use-execution-interaction-commands.ts`가 `errorCode`를 처리하지 않으므로 사용자 가이드 갱신은 시급하지 않다. 단, `errorCode` 소비 코드가 frontend 에 추가되는 시점에 `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx`에 "입력 대기 중이 아닌 실행에 계속 명령을 보내면 어떻게 되는가" 설명을 추가하는 것이 권장된다.

---

## 요약

PROJECT.md 매트릭스 19개 trigger 기준으로 staged 16개 파일을 검토했다. 매칭된 trigger는 1개 ("실행·디버깅 흐름 변경"), 누락된 동반 갱신 1건. 변경은 continuation 큐 DLQ 모니터링(`ContinuationDlqMonitorService` 신규), retry-rate 로깅(`onFailed` 핸들러), publisher 사전 검증 실패 에러 코드화(`InvalidExecutionStateError`)로 구성된다. 신규 에러 코드(`INVALID_EXECUTION_STATE`, `INVALID_STATE`)가 WS ack·REST 422 응답에 추가됐지만, frontend 에서 해당 필드를 현재 소비하지 않아 사용자 가시 동작 변화가 없다. `05-run-and-debug/` 미갱신은 INFO 수준으로 판정한다. i18n parity 누락·backend-labels 미매핑·섹션 디렉토리 미등록 등 CRITICAL/WARNING 사안은 없다.

## 위험도

INFO
