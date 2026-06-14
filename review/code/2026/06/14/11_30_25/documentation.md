# 문서화(Documentation) 리뷰 결과

## 발견사항

### 독스트링/JSDoc

- **[INFO]** `ExecutionError` 추상 클래스에 상세한 JSDoc 추가됨 — 계약, client-safe 보장, ack 빌더 참조까지 명시.
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (신규 `ExecutionError` 클래스 블록)
  - 상세: 기반 클래스·각 서브클래스 모두 목적·spec 섹션 참조·보안 게이트 설명을 갖춤. `serverDetail` 필드에 "서버 로그 전용" 주석이 명확히 달려 있어 오용 위험을 낮춤.
  - 제안: 현 상태 유지. 추가 개선 사항 없음.

- **[INFO]** `@deprecated` 태그를 사용한 `detail` getter 별칭 문서화가 올바름.
  - 위치: `workflow-errors.ts` — `InvalidExecutionStateError.detail`, `RetryLastTurnError.detail`
  - 상세: spec §7.5.1 참조와 함께 `{@link serverDetail}` 크로스링크가 명확함. 구 호출자가 별칭을 인지하지 못하고 실수로 사용하더라도 lint/IDE 에서 deprecated 경고를 받을 수 있음.
  - 제안: 현 상태 유지.

- **[INFO]** `localizeAckError` 함수 및 `InteractionAck.errorCode` 필드에 JSDoc이 추가됨.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`
  - 상세: 함수 목적과 보안 근거(내부 정보 누출 없음)가 주석으로 설명됨.
  - 제안: 현 상태 유지.

- **[INFO]** `execution-error-codes.ts` 맵 상수에 "새 매핑 추가 시 ko/en dict 동시 갱신" 안내 주석이 포함되어 있음.
  - 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts`
  - 상세: 향후 기여자가 i18n 동기화를 놓칠 위험을 감소시키는 좋은 관행.
  - 제안: 현 상태 유지.

### 주석 정확성

- **[WARNING]** `buildContinuationErrorAck` JSDoc이 변경된 동작을 정확히 반영하지만, 메서드 시그니처의 `fallbackMessage` 파라미터에는 별도 파라미터 주석(`@param`)이 없음.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `buildContinuationErrorAck` 메서드
  - 상세: 메서드 레벨 JSDoc이 동작 변경(typed vs plain error 분기)을 충분히 설명하므로 실질적 정보 손실은 없음. 그러나 `fallbackMessage`가 plain error 경우에만 사용된다는 사실이 JSDoc에서 명시되지 않아 독자가 시그니처만 보고는 파라미터 역할을 즉시 파악하기 어려울 수 있음.
  - 제안: `@param fallbackMessage plain(non-typed) Error 에만 사용되는 client-side 고정 메시지` 한 줄 추가.

- **[INFO]** `workflow-errors.ts` 파일 상단 블록 주석이 "옛 메시지 매칭은 외부 throw 호환을 위한 defensive backstop" 이라 설명하는데, 이는 W-17 패턴 관련 기존 에러 클래스들에 해당하며 신규 `ExecutionError` 계층과는 무관함. 두 설명 블록이 동일 파일에 공존해 약간 혼동 가능.
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` 최상단 파일 레벨 JSDoc
  - 상세: 파일 레벨 JSDoc이 두 개의 별도 블록(W-17 legacy 설명 + `ExecutionError` 계약 설명)으로 나뉘어 있어 파일의 이중 책임이 암시적으로 드러남. 현재 구조가 혼란을 야기할 정도는 아니나, 나중에 파일이 분리될 경우 유지보수성이 저하될 수 있음.
  - 제안: 선택적 개선. 파일 상단에 이 파일에 두 종류의 에러 계층이 공존함을 명시하는 안내 주석 추가를 고려.

### 인라인 주석

- **[INFO]** `websocket.gateway.ts`의 비-typed error 처리 블록에 `// 비-typed / unknown — 내부 message 는 절대 client 에 전달하지 않는다.` 주석이 명확히 달려 있어 보안 의도를 즉시 파악할 수 있음.
  - 위치: `buildContinuationErrorAck` 내부 fallback 분기
  - 상세: 보안 게이트 의도를 코드 리뷰어가 즉시 이해할 수 있도록 하는 효과적인 인라인 주석.
  - 제안: 현 상태 유지.

- **[INFO]** `execution-engine.service.spec.ts`의 변경된 테스트에 `// client-safe 고정 message — 실제 길이 수치는 message 에 노출되지 않는다 (§7.5.2)` 주석이 추가됨.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (변경 후 L51 근방)
  - 상세: 테스트 의도를 설명하는 유용한 주석이며 spec 참조도 포함.
  - 제안: 현 상태 유지.

- **[INFO]** `websocket.gateway.spec.ts`의 보안 게이트 테스트에 SQL 원문·내부 IP가 담긴 mock Error를 선택한 이유와 검증 의도를 설명하는 풍부한 주석이 포함됨.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` 변경된 테스트 블록
  - 상세: 테스트 데이터 선택 이유와 검증 의도를 명확히 설명해 리뷰와 이후 유지보수가 쉬움.
  - 제안: 현 상태 유지.

### API 문서 / 설정 문서

- **[INFO]** `error-codes.ts`의 신규 코드 2개(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)에 각각 의미와 spec 참조가 블록 주석으로 정확히 기술됨.
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`
  - 상세: 다른 코드 그룹과 동일한 주석 스타일을 유지하며, 누출 차단 보안 게이트 동작까지 설명함.
  - 제안: 현 상태 유지.

### README 업데이트 / 변경 이력

- **[INFO]** 이 변경은 내부 error 타입 리팩터링이며 공개 API나 환경변수 추가가 없으므로 README나 CHANGELOG 업데이트는 불필요.
  - 상세: `plan/in-progress/execution-engine-typed-errors.md`가 변경 이력 추적 역할을 대신하고 있으며, 체크리스트가 충분히 상세하게 기록됨.

### 예제 코드

- **[INFO]** `workflow-errors.spec.ts`와 `execution-error-codes.test.ts`가 사실상 사용 예제 역할을 하므로 별도 예제 코드는 불필요.
  - 상세: 신규 `ExecutionError` 계층 사용 패턴(생성자 인자, `serverDetail` 접근, `code` 확인)이 테스트 파일에서 명확하게 보여짐.

### i18n 문서화

- **[INFO]** 영문(`en/executions.ts`)과 한국어(`ko/executions.ts`) 두 locale 파일 모두에 동일 목적의 인라인 주석이 추가됨.
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/executions.ts`, `codebase/frontend/src/lib/i18n/dict/ko/executions.ts`
  - 상세: i18n 키 구조와 spec 참조가 주석에 명시되어 향후 locale 파일 추가 시 가이드 역할을 함.
  - 제안: 현 상태 유지.

---

## 요약

이번 변경(A-1 client-safe typed error 체계)은 전반적으로 문서화 품질이 높다. `ExecutionError` 추상 클래스, `MessageTooLongError`, `buildContinuationErrorAck`, `execution-error-codes.ts` 모두 목적·계약·보안 근거를 JSDoc 및 인라인 주석으로 명확히 설명하고 있으며, spec 섹션 번호 참조도 일관되게 유지된다. 발견된 유일한 WARNING은 `buildContinuationErrorAck`의 `fallbackMessage` 파라미터에 `@param` 주석이 없는 것으로, 메서드 레벨 JSDoc이 동작을 이미 충분히 설명하고 있어 실질적 정보 손실이 없는 낮은 우선순위 사항이다. `@deprecated` 별칭 처리, i18n 동기화 안내, 보안 게이트 의도 명시 주석 등은 프로젝트 관행 수준 이상의 문서화를 보여준다.

## 위험도

LOW
