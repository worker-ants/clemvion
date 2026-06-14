# 문서화(Documentation) 리뷰

## 발견사항

### 독스트링/JSDoc

- **[INFO]** `ExecutionError` 추상 클래스 — 최상급 JSDoc 완비
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` 신규 추가 블록 (L334–L348)
  - 상세: `code`, `message`, `serverDetail` 세 필드의 계약과 `buildContinuationErrorAck` 연동까지 명시한 우수한 수준의 JSDoc. 클래스 수준 doc 으로서 충분하다.
  - 제안: 유지. 추가 불필요.

- **[INFO]** `MessageTooLongError` 클래스 JSDoc 완비
  - 위치: `workflow-errors.ts` L432–L439 (신규)
  - 상세: 보안 분리 정책(`serverDetail` 서버 로그 전용)과 spec 참조를 명시. 양호.
  - 제안: 유지.

- **[INFO]** `ExecutionTimeLimitError` 설계 경계 주석 추가
  - 위치: `workflow-errors.ts` L415–L423 (신규)
  - 상세: `ExecutionError` 계층 밖에 의도적으로 남긴 이유를 상세히 기술. 미래 리팩터러가 실수로 승격하지 않도록 막는 방어적 주석.
  - 제안: 유지.

- **[INFO]** `@deprecated` JSDoc 태그 적절히 사용
  - 위치: `workflow-errors.ts` `InvalidExecutionStateError.detail`, `RetryLastTurnError.detail` getter
  - 상세: `@deprecated since refactor-04-a1 — use {@link serverDetail}; remove after callers migrated` 형식으로 마이그레이션 경로를 명시. 양호.
  - 제안: "remove after callers migrated" 문구에 목표 시점(예: 다음 major 또는 구체적 태스크 참조)을 추가하면 방치 방지에 유리하지만, 없어도 현행 수준에서 문제는 없다.

- **[INFO]** `localizeAckError` 함수 JSDoc 완비
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` (신규 함수)
  - 상세: 매핑 로직과 fallback 정책을 정확히 설명. 양호.
  - 제안: 유지.

- **[INFO]** `InteractionAck.errorCode` 필드 JSDoc 추가
  - 위치: `use-execution-interaction-commands.ts` `InteractionAck` 인터페이스
  - 상세: WS ack 이벤트의 평면 errorCode 필드에 대한 spec 참조와 retry 의 nested 구조와의 구분을 명시. 양호.
  - 제안: 유지.

- **[INFO]** `buildContinuationErrorAck` JSDoc 대폭 보강
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` L659–L679
  - 상세: typed/plain 분기 정책과 `fallbackMessage` 파라미터의 의미를 상세히 기술. 이전 버전 주석("메시지만 전달")에서 보안 게이트 역할까지 명시한 것으로 갱신. 정확.
  - 제안: 유지.

- **[INFO]** `execution-error-codes.ts` 모듈 수준 JSDoc 완비
  - 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts` (신규 파일)
  - 상세: 화이트리스트 목적, 계약 참조(spec §7.5.2), fallback 관례, 확장 시 동기화 대상까지 기술. 모듈 수준 문서로 우수.
  - 제안: 유지.

---

### 주석 정확성 (오래된 주석)

- **[WARNING]** `buildContinuationErrorAck` 구버전 레이블 "변경 2.3 (review W-8)" — 히스토리 태그가 구식 참조로 남음
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` JSDoc 첫 줄 `/** 변경 2.3 (review W-8) — continuation 핸들러 4종의 catch 블록 공통화.`
  - 상세: 기능 설명은 A-1 typed-error 로 정확히 갱신됐으나, "변경 2.3 (review W-8)" 레이블은 이전 리팩터 단계의 히스토리 태그다. 해당 리뷰 리포트를 알지 못하는 신규 독자에게 맥락 없는 레퍼런스가 된다.
  - 제안: 레이블을 `A-1 typed-error (§7.5.2) — continuation 핸들러 4종의 catch 블록 에러 분류` 로 교체하거나 "변경 2.3" 태그를 제거하여 현재 의미 기준으로만 기술한다.

- **[INFO]** `workflow-errors.spec.ts` 최상단 JSDoc — "A-1 client-safe typed error 계약" 명시
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.spec.ts` L127–L133
  - 상세: 테스트 파일 최상단에 불변식 계약 전체를 문서화한 것은 모범 사례. 테스트 명세 문서 역할도 겸함.
  - 제안: 유지.

---

### 인라인 주석

- **[INFO]** 보안 게이트 의도 인라인 주석 적절
  - 위치: `websocket.gateway.ts` 신규 분기 `// 비-typed / unknown — 내부 message 는 절대 client 에 전달하지 않는다.`
  - 상세: 의도적 설계 결정을 코드 옆에 명시. 향후 코드 리뷰어가 실수로 `error.message` 를 직접 전달하는 방향으로 "수정"하는 사고를 방지하는 방어 주석. 적절.

- **[INFO]** 테스트 코드 내 인라인 주석 — `§7.5.2` 참조 일관성
  - 위치: `execution-engine.service.spec.ts` 10000자 초과 테스트 추가 어설션, `websocket.gateway.spec.ts` 각 보안 게이트 어설션 블록
  - 상세: 각 어설션 블록에 "A-1 §7.5.2" 또는 "보안 게이트" 등 의도 설명을 달아 테스트가 무엇을 검증하는지 명확히 함. 양호.

- **[INFO]** `error-codes.ts` 신규 코드 블록 인라인 주석 충분
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 추가 블록
  - 상세: 각 코드의 semantics, 동작 조건, 보안 동작을 영문 주석으로 명확히 기술. 양호.

- **[INFO]** `backend-labels.ts` 신규 항목 주석 적절
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` 신규 항목 상단 주석
  - 상세: "defense-in-depth" 역할과 primary 경로(`execution-error-codes.ts`)를 명시. 양호.

---

### README/API 문서 업데이트

- **[INFO]** REST API 변경 없음 — API 문서 업데이트 불필요
  - 상세: 이 변경은 WS continuation ack 의 `errorCode` 필드 추가와 내부 에러 분류 체계 개편으로, REST endpoint 표면은 변경되지 않았다.

- **[INFO]** WS 프로토콜 spec 은 이미 갱신됨
  - 상세: `spec/5-system/6-websocket-protocol.md §4.2` 에 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 코드가 이미 반영됐음을 plan 체크리스트와 consistency-check SUMMARY(`review/consistency/2026/06/14/10_58_32/SUMMARY.md`)에서 확인. 구현 코드와 spec 의 동기화 상태 양호.

---

### 변경 이력 / CHANGELOG

- **[INFO]** 이 프로젝트는 CHANGELOG 파일 패턴을 사용하지 않고 `plan/` + `spec/` + git 히스토리로 추적 — 별도 CHANGELOG 업데이트 불필요.
  - 상세: `plan/in-progress/execution-engine-typed-errors.md` 가 변경 이력 역할을 수행하며, 본 PR 내 체크리스트가 완비되어 있다.

---

### 설정 문서

- **[INFO]** 환경변수·신규 설정 옵션 없음 — 설정 문서 업데이트 불필요.

---

### 예제 코드

- **[INFO]** `execution-error-codes.ts` 확장 가이드 주석 충분
  - 위치: `codebase/frontend/src/lib/websocket/execution-error-codes.ts` "새 매핑 추가 시" 주석
  - 상세: 신규 코드 추가 시 갱신해야 할 위치 2곳(맵 + 사전 파일)을 명시. 간결하지만 핵심 정보를 담고 있어 충분함.
  - 제안: (선택적) 확장 예시 한 줄을 주석으로 추가하면 신규 기여자가 더 빠르게 이해 가능하나, 현행으로도 실용적.

---

## 요약

이번 변경(A-1 typed-error 체계 도입)의 문서화 품질은 전반적으로 높다. `ExecutionError` 추상 클래스, `MessageTooLongError`, `buildContinuationErrorAck`, `execution-error-codes.ts` 모두 보안 의도·spec 참조·fallback 정책을 JSDoc/인라인 주석으로 명확히 기술하고 있으며, 테스트 파일에도 불변식 계약이 서술형으로 문서화되어 있다. 유일한 경고 수준 사항은 `buildContinuationErrorAck` JSDoc 첫 줄의 "변경 2.3 (review W-8)" 레이블이 구버전 히스토리 참조로 남아 신규 독자에게 맥락 없는 레퍼런스가 된다는 점으로, 레이블 교체 한 줄로 해소 가능하다. `@deprecated` 별칭(`detail`)에 마이그레이션 목표 시점이 없는 것은 INFO 수준이며 차단 사항이 아니다.

## 위험도

LOW
