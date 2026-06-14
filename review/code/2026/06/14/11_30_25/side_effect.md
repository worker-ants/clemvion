# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `InvalidExecutionStateError.detail` 프로퍼티 — `readonly` 필드에서 getter 로 변경
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (diff 라인 314–326)
- 상세: 기존 `readonly detail?: string` 필드가 `get detail()` getter 로 교체됐다. 외부에서 `err.detail`을 읽는 기존 코드는 동일하게 동작하므로 일반적인 호출자 영향은 없다. 그러나 `Object.keys(err)`, `JSON.stringify(err)`, `spread ({...err})` 로 `detail` 을 열거하던 코드(서버 로그 직렬화, 테스트 스냅샷)는 getter 가 열거 불가(non-enumerable)이므로 `detail` 필드가 누락될 수 있다. `serverDetail` 은 생성자에서 `this.serverDetail = serverDetail`로 직접 할당되어 여전히 열거 가능하다.
- 제안: 기존 로그/직렬화 경로 중 `err.detail`을 `JSON.stringify` 또는 spread 로 다루는 곳이 있다면, `err.serverDetail` 또는 명시적 프로퍼티 접근으로 전환한다. `RetryLastTurnError.detail` getter 에도 동일하게 적용된다.

### [INFO] `RetryLastTurnError.detail` 프로퍼티 — 동일한 열거 가능성 변경
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (diff 라인 347–349)
- 상세: `InvalidExecutionStateError` 와 동일 패턴. `readonly detail?: string` 필드 → getter. 기존 직렬화·스냅샷 코드에서 `detail` 이 사라질 수 있다.
- 제안: 위와 동일.

### [INFO] `buildContinuationErrorAck` 동작 변경 — 기존 plain Error 의 `error` 필드 내용 변경
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (diff 라인 575–601)
- 상세: 변경 전 `buildContinuationErrorAck` 는 `error instanceof Error ? error.message : fallbackMessage` 를 클라이언트 ack 의 `error` 필드로 전달했다. 변경 후에는 plain Error 의 경우 내부 message 를 차단하고 `fallbackMessage` ("Form submission failed" 등)를 고정 전달한다. 이는 의도된 보안 게이트이나, 이 ack 를 소비하는 클라이언트 측 코드(프론트엔드·채널 웹챗 SDK 등) 중 `result.data.error` 를 사람 가독 오류 문자열로 표시하던 모든 경로가 이제 다른 메시지를 받는 behavioral change 이다. 이번 PR 에서 `use-execution-interaction-commands.ts` 의 toast 경로는 함께 갱신됐으나, 채널 웹챗 SDK 또는 EIA REST 경로처럼 동일 ack 를 소비하는 다른 클라이언트가 있다면 영향 범위를 검토해야 한다.
- 제안: 채널 웹챗 위젯(`codebase/channel-web-chat`)과 EIA REST 경로가 `execution.form_submitted` / `execution.submit_message.ack` ack 의 `error` 필드를 직접 표시하는지 확인한다. 해당 경로가 있다면 localize 처리 또는 고정 fallback 메시지 대응이 필요하다.

### [INFO] `ErrorCode` 상수 객체에 신규 키 2개 추가 — `ErrorCodeValue` 유니온 타입 확장
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` (diff 라인 632–633)
- 상세: `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG` 두 값이 `ErrorCode` const 에 추가되어 `ErrorCodeValue` 유니온이 확장된다. 이 타입을 exhaustive switch(`switch(code)` + `never` 검사)나 discriminated union 분기로 다루는 코드가 있다면 컴파일러 경고 없이 새 케이스가 누락 처리될 수 있다. 다만 `ErrorCode` 는 const 객체이고 기존 사용 패턴이 lookup-table 방식이므로 실질적 runtime 위험은 낮다.
- 제안: `ErrorCodeValue` exhaustive switch 패턴 존재 여부를 grep 으로 확인한다. 존재하면 새 코드 케이스를 추가한다.

### [INFO] `useExecutionInteractionCommands` 훅 — `useT()` 추가로 렌더 의존성 확장
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (diff 라인 1433)
- 상세: `useT()` 훅이 추가됐고, 이를 `submitForm`, `clickButton`, `clickContinue`, `sendMessage`, `endConversation` 의 `useCallback` 의존성 배열에 포함시켰다. `useT` 가 locale 변경 시 새 참조를 반환한다면 모든 콜백이 재생성된다. 이는 부작용(메모 캐시 무효화)이나 locale 변경이 사용자 상호작용 중 실시간으로 일어나는 경우가 없다면 실질 문제는 없다.
- 제안: `useT` 반환 함수가 stable reference 를 보장하는지(memo/ref 내부 구현) 확인한다. stable 하다면 현재 구현이 적절하다.

## 요약

이 변경의 핵심은 `ExecutionError` 추상 기반 클래스 도입, `MessageTooLongError` 신규 typed error, `buildContinuationErrorAck` 의 보안 게이트 재작성, 그리고 프론트엔드의 errorCode→i18n 매핑이다. 의도하지 않은 전역 상태 변경, 파일시스템 부작용, 네트워크 호출, 환경 변수 변경은 없다. 주목할 부작용은 두 가지다: (1) `detail` 프로퍼티의 `readonly` 필드 → getter 전환으로 인한 JSON 직렬화·spread 연산에서의 열거 가능성 소실, (2) `buildContinuationErrorAck` 가 plain Error 의 내부 message 를 `fallbackMessage` 로 대체함으로써 기존 클라이언트 ack `error` 필드 내용이 변경되는 behavioral change(의도된 보안 게이트이나 채널 웹챗 SDK 등 다른 소비자 영향 확인 필요). `ErrorCode` 유니온 확장과 `useT` 의존성 추가는 경미한 수준이다.

## 위험도

LOW
