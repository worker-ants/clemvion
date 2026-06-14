# 아키텍처(Architecture) 리뷰

**대상**: refactor-04-a1 typed-errors (A-1) — client-safe typed error 계층 도입
**파일 수**: 13개 (be 4 + fe 4 + test 4 + plan 1)

---

## 발견사항

### [INFO] ExecutionError 추상 기반 클래스 — 단일 책임 및 레이어 경계 명확성 양호
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
- 상세: `ExecutionError` 추상 클래스가 "client 경계에 도달하는 에러의 공통 계약"을 단일 책임으로 집약한다. `code`(client-safe 식별자), `message`(고정 client-safe 문자열), `serverDetail`(서버 로그 전용)의 3-필드 분리는 information hiding 원칙을 잘 구현하고 있다. 기존 `InvalidExecutionStateError`·`RetryLastTurnError` 를 흡수하는 방식도 리스코프 치환 원칙(LSP)에 부합한다 — 두 서브클래스 모두 `ExecutionError` 계약을 확장 없이 구체화한다.
- 제안: 없음.

### [INFO] `detail` 게터 — 하위 호환 별칭의 적절한 사용
- 위치: `workflow-errors.ts`, `InvalidExecutionStateError.detail` 및 `RetryLastTurnError.detail` getter
- 상세: `@deprecated` 태그와 함께 `serverDetail` 을 위임하는 게터 패턴은 기존 호출자와의 인터페이스 분리(ISP) 계약을 유지하면서 내부 구현을 마이그레이션하는 교과서적 방식이다. 다만 이 별칭이 영구화될 위험이 있으므로 실제 사용 지점의 이주 타임라인 계획이 있으면 별도 plan 항목으로 추적하는 것이 좋다.
- 제안: 본 PR 에서 즉시 조치할 사안은 아니지만, `detail` 의존 코드 전수 검색 후 점진적 제거 plan 생성을 권장한다.

### [INFO] `ExecutionTimeLimitError` 가 `ExecutionError` 를 상속하지 않음
- 위치: `workflow-errors.ts` — `ExecutionTimeLimitError extends Error`
- 상세: `ExecutionTimeLimitError` 는 기존 코드이며 이번 변경에서 건드리지 않았다. 이 클래스는 동일 파일의 `ExecutionError` 계층 밖에 위치하며, `code` 필드(`EXECUTION_TIME_LIMIT_EXCEEDED`) 와 `serverDetail` 유사 패턴(수치 분리)을 개별로 구현하고 있다. 아키텍처적으로 `ExecutionError` 계층에 흡수되지 않으면 continuation ack 빌더가 이 에러를 `ExecutionError` 로 분기하지 못하고 generic fallback(`EXECUTION_INTERNAL_ERROR`) 으로 처리한다. 이것이 의도된 설계(해당 에러는 WS ack 경로가 아닌 다른 경로로 surface) 인지 확인이 필요하다.
- 제안: `ExecutionTimeLimitError` 가 continuation ack 경로에 도달하는 케이스가 있다면 `ExecutionError` 를 상속하도록 동일 PR 또는 후속 리팩터로 흡수해야 한다. 아니라면 주석으로 "WS continuation ack 경로 제외" 를 명시하는 것이 모듈 경계 명확성에 도움이 된다.

### [INFO] `ErrorCode` enum 위치 — 레이어 경계 검토
- 위치: `codebase/backend/src/nodes/core/error-codes.ts`
- 상세: WS continuation ack 전용 코드(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)가 노드 핸들러 계층의 `error-codes.ts` 에 추가됐다. 이 파일의 기존 JSDoc("Canonical error-code enum for node handlers' `output.error.code`")은 노드 실행 출력 에러 코드를 목적으로 하며, continuation ack 계층 코드는 관심사가 다르다. 현재는 기능적 문제가 없고 frontend/backend 공용 타입 패키지가 없는 구조에서 실용적 선택임을 이해하지만, 두 concern 이 단일 파일에 혼재하는 결합도 문제가 생긴다.
- 제안: 단기적으로는 기존 위치 유지 수용 가능 (파일 내 섹션 주석으로 구분은 이미 잘 돼 있음). 중장기적으로는 `execution-engine/execution-error-codes.ts` 같은 별도 파일로 분리하거나, 공용 패키지(`packages/`) 레이어로 이동해 frontend 와 타입 공유를 고려할 수 있다.

### [INFO] `buildContinuationErrorAck` — 전략 패턴 부재, 단일 메서드 내 분기 집중
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `buildContinuationErrorAck` 메서드
- 상세: 현재 구현은 `instanceof ExecutionError` 분기 1개 + generic fallback 으로 단순하고 응집도가 높다. 이 정도 복잡도에서는 전략 패턴 도입이 과도한 추상화(over-engineering) 이므로 현재 설계가 적절하다. 향후 에러 종류가 늘어나 분기가 3~4개를 넘기 시작하면 visitor 패턴이나 error handler registry 도입을 재검토하면 된다.
- 제안: 없음 (현 복잡도에서 최적 설계).

### [INFO] frontend `execution-error-codes.ts` — 개방-폐쇄 원칙(OCP) 고려
- 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts`
- 상세: `EXECUTION_INTERACTION_ERROR_CODE_TO_I18N` 를 `Readonly<Record<string, TranslationKey>>` 로 선언하고, `Object.prototype.hasOwnProperty.call` 가드를 적용한 설계는 prototype pollution 방어와 열린 fallback 정책(`null` 반환)을 함께 충족한다. 새 에러 코드 추가 시 맵 항목과 i18n dict 를 동시에 갱신해야 한다는 주석도 명시돼 있어 유지보수 지침이 잘 문서화됐다. `integration-error-codes.ts` 선례를 따른 일관된 패턴이다.
- 제안: 없음.

### [INFO] `localizeAckError` 함수 — 단일 책임 분리 양호
- 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts`
- 상세: `localizeAckError` 를 hook 내부 인라인이 아닌 별도 함수로 추출한 것은 단일 책임 원칙(SRP)에 부합하며 테스트 용이성도 높인다. `TFunction` 을 인자로 받아 의존성을 역전(DIP)한 것도 mock 친화적 설계다. 다만 이 함수가 현재 `use-execution-interaction-commands.ts` 내에 private 하게 위치하는데, 만약 다른 hook 에서도 동일 패턴이 필요해지면 `execution-error-codes.ts` 로 이동하거나 별도 유틸리티 파일로 승격을 검토할 수 있다.
- 제안: 현 위치는 수용 가능. 재사용 필요 시 `execution-error-codes.ts` 로 이동.

### [INFO] useCallback 의존성 배열 — `t` 추가의 안정성
- 위치: `use-execution-interaction-commands.ts`, 4개 `useCallback` deps
- 상세: `useT()` 가 반환하는 `t` 함수가 매 렌더마다 새 참조를 반환한다면 `useCallback` 의존성에 추가된 `t` 가 불필요한 재생성을 유발한다. 일반적으로 i18n `t` 함수는 안정적 참조를 반환하도록 구현되므로 문제가 없을 가능성이 높으나, `useT` 구현을 직접 확인하지 않은 상태에서는 성능 회귀 잠재성이 있다.
- 제안: `useT` 의 `t` 가 `useMemo`/`useCallback` 등으로 안정화돼 있는지 확인. 안정화돼 있지 않다면 `useMemo(() => t, [locale])` 패턴으로 안정화하거나, `useT` 자체를 수정해야 한다. (이 검토 범위 내에서 `useT` 구현을 확인하지 못했으므로 INFO 수준으로 분류.)

---

## 요약

이번 변경은 "client-safe typed error 계층 도입"이라는 명확한 단일 목표 아래, backend 에서 `ExecutionError` 추상 기반을 신설해 에러의 client-surface 계약(`code`, `message`)과 서버 진단 데이터(`serverDetail`) 를 구조적으로 분리하고, frontend 에서 `errorCode → i18n key` 매핑 계층을 추가한 것이다. SOLID 원칙 전반이 잘 적용됐고 레이어 책임 분리(information hiding at WS boundary)가 견고하다. 유일하게 관심이 필요한 구조적 지점은 `ExecutionTimeLimitError` 가 새 `ExecutionError` 계층 밖에 남아 있다는 점으로, continuation ack 경로에서 이 에러가 generic fallback 으로 처리되는지 여부를 명시적으로 문서화하거나, 필요 시 흡수해야 한다. `ErrorCode` enum 의 관심사 혼재는 현 모노레포 구조에서 실용적 타협이며 중장기 개선 후보다. 전체적으로 확장성과 보안 경계 설계가 우수하다.

---

## 위험도

LOW
