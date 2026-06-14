# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] `ExecutionError` 추상 기반 클래스의 단일 책임 및 추상화 수준 — 적절
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (신규 `ExecutionError` 추상 클래스)
- 상세: `ExecutionError`는 `{ code, message, serverDetail }` 세 필드의 계약만 담고 있다. `message`는 client-safe 고정 문자열, `serverDetail`은 서버 로그 전용 진단으로 책임이 명확히 분리돼 있다. 추상 클래스로 `code`를 강제하면서도 구체 구현은 하위 클래스에 위임한다(OCP, ISP 준수). 추상화 수준이 경량이며 과도하지 않다.
- 제안: 없음.

### [INFO] `ExecutionTimeLimitError` 의도적 비계층 유지 — 설계 결정 적절
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (ExecutionTimeLimitError 블록 주석)
- 상세: JSDoc에 "설계 경계 (I-3)" 주석으로 `ExecutionError` 계층 밖에 남기는 이유가 명시돼 있다. dispatch loop sentinel로만 쓰이며 continuation ack 경로에 도달하지 않는다는 제약이 주석으로 문서화됐다. 향후 유지보수자가 실수로 `ExecutionError`로 승격시키는 것을 주석이 예방한다.
- 제안: 없음.

### [INFO] `@deprecated detail` getter — 하위 호환 별칭 처리 방식 적절
- 위치: `workflow-errors.ts` `InvalidExecutionStateError.detail`, `RetryLastTurnError.detail`
- 상세: `serverDetail`로의 마이그레이션을 위한 `@deprecated` getter가 `{ return this.serverDetail; }` 위임으로 구현돼 있다. 이중 저장 없이 단일 소스(`serverDetail`)를 참조하므로 데이터 불일치 위험이 없다. 마이그레이션 경로가 명확하다.
- 제안: 마이그레이션 완료 후 제거 시점을 spec 또는 plan에 명시해 두면 기술 부채 추적이 용이하다.

### [INFO] `buildContinuationErrorAck` 의 레이어 책임 분리 — 적절
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`buildContinuationErrorAck` private 메서드)
- 상세: gateway(프레젠테이션 레이어)가 typed/non-typed 분기 및 서버 로그 기록까지 담당하는데, 이는 "에러를 client-safe 형태로 surface 하는 것"이 presentation 레이어의 정당한 책임이다. 비즈니스 로직(`ExecutionError` 계약)은 `execution-engine` 모듈이 담당하고, gateway는 이를 소비·변환만 하므로 레이어 책임이 분리돼 있다.
- 제안: 없음.

### [WARNING] `ErrorCode` 위치와 모듈 경계 — WS continuation ack 코드가 `nodes/core/`에 혼재
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` (신규 `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)
- 상세: `ErrorCode`는 `nodes/core/` 패키지에 위치하지만, 신규 코드 2개(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)는 execution-engine / websocket 도메인의 continuation ack 전용 개념이다. `nodes/core/`는 본래 노드 핸들러 수준의 공통 상수를 담는 위치로, "WS continuation ack 표면 코드"를 노드 레이어에 두는 것은 개념 경계가 어긋난다. `execution-engine` 모듈 또는 `websocket` 모듈이 이 코드를 정의하고, `nodes/core/error-codes.ts`는 노드 레벨 코드만 담도록 책임을 분리하는 것이 더 명확한 모듈 경계다.
- 제안: 단기적으로는 현재 구조를 유지하되(광범위 이동의 비용이 크므로), `error-codes.ts` 내에 "WS continuation ack 코드" 섹션을 명시적으로 구분하는 블록 주석을 추가해 의도를 명확히 한다. 중장기적으로는 `EXECUTION_*` 코드를 `execution-engine` 모듈 범위 상수로 이동하고 `ErrorCode` 에서 re-export 하는 방식을 검토한다.

### [INFO] frontend `execution-error-codes.ts` — 단방향 의존성 및 모듈 경계 적절
- 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts`
- 상세: 프론트엔드 `execution-error-codes.ts`는 순수 매핑 함수/상수만 담고, `use-execution-interaction-commands.ts`가 이를 소비한다. 역방향 의존 없이 단방향이며, `TranslationKey` 타입을 통해 i18n 계층과 느슨하게 연결된다. `Object.prototype.hasOwnProperty` 가드로 prototype 오염 방어도 포함돼 있다.
- 제안: 없음.

### [INFO] `localizeAckError` 유틸리티 함수 — SRP 준수
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (신규 `localizeAckError`)
- 상세: "errorCode → i18n key 조회 → fallback" 로직이 별도 순수 함수로 추출됐다. 4개의 `useCallback` 모두 이 함수를 재사용하므로 DRY가 지켜지며, hook 내부 비즈니스 로직과 표현 변환이 분리돼 있다.
- 제안: 없음.

### [INFO] 이중 i18n 경로(`backend-labels.ts` + `dict/*/executions.ts`) — 방어적 중복, 장기 관리 위험
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` + `dict/en/executions.ts` + `dict/ko/executions.ts`
- 상세: `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`가 `backend-labels.ts`(레거시 `translateBackendError` 경로)와 `dict/*/executions.interactionError.*`(신규 localize 경로) 두 곳에 모두 등재됐다. 코드 주석이 "defense-in-depth" 의도를 명시하고 있어 의도적 중복임은 알 수 있다. 단, 두 경로의 문자열이 독립 관리되면 향후 불일치 위험이 생긴다.
- 제안: 두 경로 중 하나가 canonical이라면 주석 또는 타입 레벨에서 "이 값은 X를 소비처로 하는 fallback" 임을 명확히 문서화한다. 장기적으로는 `backend-labels.ts` 경로의 해당 키를 `dict/*/executions.interactionError.*`로 통합 위임하는 것을 검토한다.

### [INFO] `emitWithAck` 시그니처 확장 — 하위 호환 방식 적절
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (`emitWithAck` 함수)
- 상세: `onFailure` 콜백의 시그니처를 `(error: string) => void` → `(error: string, errorCode?: string) => void`로 확장했다. `errorCode`가 선택적(optional)이므로 기존 호출자 영향 없이 하위 호환이 유지된다.
- 제안: 없음.

## 요약

이번 변경은 execution-engine의 에러를 client-safe typed 계층(`ExecutionError`)으로 통일하고, WebSocket gateway에서 typed/non-typed 분기를 통해 내부 정보 누출을 차단하는 보안 게이트를 도입한 리팩터링이다. SOLID 관점에서 `ExecutionError` 추상 클래스는 단일 책임·개방-폐쇄 원칙을 준수하고, `buildContinuationErrorAck`의 레이어 책임도 프레젠테이션 레이어로 적절히 귀속됐다. 프론트엔드의 `localizeAckError`/`execution-error-codes.ts` 분리도 응집도와 모듈 경계 관점에서 양호하다. 유일한 구조적 우려 사항은 WS continuation ack 전용 에러 코드 2개(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)가 `nodes/core/error-codes.ts`에 위치해 모듈 경계 개념이 다소 어긋난다는 점이며(WARNING), 이는 단기 주석 보완으로 완화 가능하다. 전체적으로 아키텍처 품질이 개선된 방향의 변경이다.

## 위험도

LOW
