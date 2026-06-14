# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `InvalidExecutionStateError.detail` — deprecated getter 추가 (하위 호환 별칭)
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `InvalidExecutionStateError` 클래스
- 상세: 기존 `readonly detail?: string` 필드가 제거되고 `get detail()` getter(deprecated)로 교체됐다. 기존 호출자가 `err.detail`을 직접 읽는 코드는 여전히 동작하므로 런타임 부작용 없음. 단, `detail`에 할당하던 코드(`err.detail = ...`)가 있었다면 readonly 필드 → getter 전환으로 컴파일 오류가 발생할 수 있다. 현재 diff 범위에서는 쓰기 사용처가 보이지 않으므로 실질 위험 없음.
- 제안: deprecation 이후 callers migrated 시 getter 제거 예정임이 JSDoc에 명시돼 있어 적절. 추가 조치 불필요.

### [INFO] `RetryLastTurnError.detail` — 동일 패턴의 deprecated getter 추가
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `RetryLastTurnError` 클래스
- 상세: `InvalidExecutionStateError`와 동일하게 `readonly detail` 필드 → `get detail()` getter 전환. 동일 분석 적용.
- 제안: 이상 없음.

### [INFO] `buildContinuationErrorAck` 시그니처 — 내부 private 메서드, 인터페이스 영향 없음
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `WebsocketGateway.buildContinuationErrorAck`
- 상세: private 메서드로 외부 API 변경 아님. 기존 동작(`error instanceof Error ? error.message : fallbackMessage`)에서 typed/non-typed 분기 로직으로 교체됨. 기존 호출자(동 파일 내 4종 continuation 핸들러)는 동일 인자로 그대로 호출하므로 부작용 없음.
- 제안: 이상 없음.

### [INFO] `emitWithAck` 함수 — `onFailure` 콜백 시그니처 변경
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` — `emitWithAck` 함수
- 상세: `onFailure: (error: string) => void` → `onFailure: (error: string, errorCode?: string) => void` 로 변경됐다. 이 함수는 파일 내 module-scope 함수이며 export 되지 않으므로 외부 호출자 없음. 파일 내 모든 호출 지점(submitForm, clickButton, clickContinue, sendMessage, endConversation)이 동일 diff에서 함께 갱신됐다. 기존 `(error) => ...` 콜백은 TypeScript 호환성상 새 시그니처와 호환되므로 런타임 부작용 없음.
- 제안: 이상 없음.

### [INFO] `useExecutionInteractionCommands` — `useT()` 훅 의존성 추가
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`
- 상세: `const t = useT()` 호출이 훅 상단에 추가됐다. React 훅 호출 규칙상 조건부·루프 없이 최상단에서 호출하므로 문제 없음. `t`가 `useCallback` 의존성 배열에 추가됐으므로 `t` 참조가 바뀔 때마다 콜백이 재생성된다. locale 변경 시 정상 동작이며 의도하지 않은 부작용 아님.
- 제안: 이상 없음.

### [INFO] `EXECUTION_INTERACTION_ERROR_CODE_TO_I18N` — 모듈 수준 상수 (전역 유사 상태)
- 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts`
- 상세: `Readonly<Record<string, TranslationKey>>` 타입의 모듈 수준 상수 도입. `Readonly`로 동결되어 있으므로 외부에서 변경 불가능. 실질 전역 가변 상태 아님.
- 제안: 이상 없음.

### [INFO] `logger.warn` 신규 호출 — 서버 로그 부작용 (의도된 동작)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `buildContinuationErrorAck`
- 상세: typed `ExecutionError`의 `serverDetail`이 있을 때 및 non-typed 에러 발생 시 `this.logger.warn(...)` 이 추가됐다. 기존에는 로그를 남기지 않았다. 이는 의도된 서버 로그 부작용(진단용)이며 client 응답에는 영향 없음. 고빈도 에러 경로에서 로그 폭주 가능성이 있으나, 에러 경로는 정상 경로가 아니므로 허용 범위.
- 제안: 이상 없음.

### [INFO] WS ack 응답 구조 변경 — 기존 클라이언트 호환성
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `buildContinuationErrorAck`
- 상세: 기존에는 non-typed 에러 시 `errorCode` 필드 없이 `{ success: false, error: <내부 message> }` 를 반환했다. 변경 후에는 `{ success: false, error: <fallback 고정문자열>, errorCode: 'EXECUTION_INTERNAL_ERROR' }` 를 반환한다. 프론트엔드 `InteractionAck` 인터페이스에 `errorCode?: string` 이 추가됐으므로 새 필드는 선택적이며 하위 호환. 그러나 `error` 필드 값이 변경(`내부 message` → 고정 fallback 문자열)되므로, 클라이언트가 이 `error` 문자열에 직접 의존하는 다른 경로가 있다면 영향을 받을 수 있다.
- 제안: 본 diff의 프론트엔드 코드는 `errorCode` 우선 매핑 → fallback으로 처리하므로 적절히 대응됨. 다른 WS 클라이언트(예: channel-web-chat 위젯, 외부 연동)가 `error` 문자열을 하드코딩으로 비교하는 경우 있다면 별도 확인 필요.

## 요약

이번 변경은 `Error`를 직접 throw하던 기존 코드를 `ExecutionError` 추상 기반 클래스 계층으로 교체하고, WS continuation ack 빌더에서 내부 에러 메시지 누출을 차단하는 리팩터링이다. 전역 변수 도입·파일시스템 부작용·환경 변수 읽기/쓰기·네트워크 호출은 없다. 변경된 시그니처(`emitWithAck.onFailure`, `InteractionAck.errorCode`)는 모두 선택 파라미터 추가 또는 내부 한정 변경이라 기존 호출자에 대한 호환성이 유지된다. `InvalidExecutionStateError.detail`과 `RetryLastTurnError.detail`은 deprecated getter로 하위 호환이 보장된다. 의미 있는 부작용으로는 서버 로그 `logger.warn` 신규 추가(의도된 진단 로그)와 WS ack의 non-typed 에러 응답 형식 변경(error 문자열 값 변경, errorCode 필드 신규 추가)이 있으며, 후자는 `error` 문자열을 직접 비교하는 외부 WS 클라이언트에 잠재적 영향이 있을 수 있다.

## 위험도

LOW
