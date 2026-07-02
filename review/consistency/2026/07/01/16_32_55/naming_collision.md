# 신규 식별자 충돌 검토 결과

**검토 모드**: 구현 착수 전 (`--impl-prep`)
**대상 문서**: `spec/5-system/4-execution-engine.md`
**구현 대상 영역**: (없음) — 신규 식별자 도입 없음

---

## 발견사항

### [WARNING] `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` — 유사 접두어 오류 코드

- **target 신규 식별자**: 해당 없음 (기존 식별자)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md §8` — `EXECUTION_TIME_LIMIT_EXCEEDED`: 엔진 레벨 **누적 active-running 시간** 초과 시 `failed` 전환 (PR2a 구현 완료)
  - `spec/5-system/3-error-handling.md §1.4` (cross-ref) — `EXECUTION_TIMEOUT`: **Code 노드 스크립트** 타임아웃 전용 코드
- **상세**: 두 코드 모두 `EXECUTION_` 접두어를 공유하나 의미가 다르다. `EXECUTION_TIME_LIMIT_EXCEEDED`는 워크플로우 전체의 누적 active 실행 시간 초과(waiting_for_input 제외), `EXECUTION_TIMEOUT`은 Code 노드 스크립트 자체의 실행 시간 초과다. 실행 엔진 spec §8은 이 차이를 명시("Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 의미가 달라 코드 분리")하고 있으나, 구현 시 두 코드를 혼용하거나 에러 핸들러에서 혼동할 가능성이 있다.
- **제안**: 구현 시 `assertActiveTimeWithinLimit` → `ExecutionTimeLimitError` (code: `EXECUTION_TIME_LIMIT_EXCEEDED`) 경로와 Code 노드 샌드박스 → `EXECUTION_TIMEOUT` 경로를 별도 try-catch 분기로 분리 유지한다. 통합 에러 핸들러에서 두 코드를 동일하게 처리하지 않도록 주의한다.

---

### [WARNING] `CHECKPOINT_SCHEMA_VERSION` vs `CALL_STACK_SCHEMA_VERSION` — 독립 버전 상수 혼동 위험

- **target 신규 식별자**: 해당 없음 (기존 식별자)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md §1.3` — `CHECKPOINT_SCHEMA_VERSION`: `_resumeCheckpoint` 스키마 버전 (multi-turn AI 재개 checkpoint 진화 관리)
  - `spec/5-system/4-execution-engine.md §7.5` — `CALL_STACK_SCHEMA_VERSION`: `Execution.resume_call_stack` 스키마 버전 (중첩 sub-workflow call-stack 영속 진화 관리, exec-park D6, V087)
- **상세**: 두 상수 모두 "재개 가능성"과 관련된 체크포인트 스키마 버전 관리이나, 관리하는 대상이 다르다. `CHECKPOINT_SCHEMA_VERSION`은 `NodeExecution.outputData._resumeCheckpoint`(멀티턴 AI 상태), `CALL_STACK_SCHEMA_VERSION`은 `Execution.resume_call_stack`(중첩 호출 체인)이다. Spec §1.3은 "checkpoint 와 **독립 상수**"라고 명시한다. 구현 시 두 상수를 하나로 통합하거나 같은 값으로 동기화하면 두 체크포인트의 호환성 판단이 잘못 연동된다.
- **제안**: 두 상수를 코드에서 각각 `CHECKPOINT_SCHEMA_VERSION` (ai-turn rehydration 경로 전용), `CALL_STACK_SCHEMA_VERSION` (call-stack rehydration 경로 전용)으로 선언하고 공유하지 않는다. 버전 증가 시 해당 체크포인트 경로만 독립 갱신한다.

---

### [INFO] `_resumeState` (in-memory 전용) vs `_resumeCheckpoint` (DB 영속) — `_resume*` 접두어 패밀리 혼동 가능

- **target 신규 식별자**: 해당 없음 (기존 식별자)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md §1.3` — `_resumeState`: 멀티턴 핸들러가 다음 턴 처리를 위해 in-memory 에만 보관하는 전체 런타임 상태 (credential 포함 가능, DB 영속 안 함, `stripControlFields()` 제거 대상)
  - `spec/5-system/4-execution-engine.md §1.3` — `_resumeCheckpoint`: `_resumeState`의 **credential-strip 부분집합**, `NodeExecution.outputData`에 DB 영속, `stripControlFields()`가 보존하는 예외
- **상세**: `_resumeState`와 `_resumeCheckpoint`는 비슷한 접두어를 가지나 라이프사이클이 다르다. 구현 시 `_resumeState` 전체를 DB에 저장하면 보안 정책 위반(`maskSensitiveFields` 경계 침해), 반대로 `_resumeCheckpoint`를 in-memory 전용으로 처리하면 재시작 후 재개 불가 결함을 낳는다. 또한 `_retryState` (`_retryState` — retryable error 종결 전용, `expiresAt` 포함)도 같은 `_*State` 패턴을 사용하나 별도 용도다.
- **제안**: 구현 시 세 필드의 DB 저장 여부를 spec §1.3과 §6.2에 따라 명확히 구분한다: `_resumeState` = in-memory only; `_resumeCheckpoint`·`_retryState` = `NodeExecution.outputData` 경유 DB 영속. `stripControlFields()` 구현 시 세 필드의 처리 규칙을 각각 검증한다.

---

### [INFO] `NodeTypeMetadata.kind` (정적 등록) vs `executionMetadata.kind` (런타임 출력) — 동일 어휘 다른 소비처

- **target 신규 식별자**: 해당 없음 (기존 식별자)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md §5.4` — `NodeTypeMetadata.kind`: 핸들러 등록 시 엔진 dispatch가 **정적으로** 특수 실행 경로를 선택하는 데 쓰는 discriminated union (`standard`/`container`/`background`/`parallel`/`blocking`/`trigger`)
  - `spec/5-system/4-execution-engine.md §5.4` — `executionMetadata.kind`: 핸들러 런타임 출력의 `executionMetadata.kind` (예: foreach의 `'container'`) — 실행 결과 메타
- **상세**: 두 `kind` 필드는 동일 어휘 집합을 공유하나 spec §5.4에서 "**별개 객체·별개 소비처**(등록 시 static dispatch 선택 vs 실행 결과 메타)"임을 명시한다. 구현 시 `getMetadata(type).kind`를 런타임 핸들러 출력의 `kind`로 오인하면 dispatch 경로 오류가 발생한다.
- **제안**: 코드에서 `NodeTypeMetadata` (등록 타임 객체)와 핸들러 출력의 `executionMetadata` 타입을 별도로 선언해 타입 수준에서 혼용을 차단한다. TypeScript의 tagged union 구분자로 같은 리터럴 타입 값을 공유하더라도 상위 타입이 분리되어야 한다.

---

### [INFO] `execution:continuation` (폐기된 Redis pub/sub) vs `execution-continuation` (BullMQ 큐) — 네이밍 잔재 혼동 가능

- **target 신규 식별자**: 해당 없음 (폐기 이력)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md §9.2/§9.3` — `execution-continuation`: 현행 BullMQ 큐 이름 (하이픈 구분)
  - `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation"` — `execution:continuation`: 폐기된 Redis pub/sub 채널 (콜론 구분)
- **상세**: 두 식별자는 문자 구분자만 다르다(하이픈 vs 콜론). 코드 내 주석·상수·테스트 fixture에 구 채널명 `execution:continuation`이 잔존할 경우 혼동을 유발한다. 실행 엔진 spec §9.3은 "옛 Redis pub/sub `execution:continuation` 채널은 BullMQ 큐 `execution-continuation`으로 교체되어 폐기"라고 명시한다.
- **제안**: 구현 중 `execution:continuation` 문자열이 코드에 남아 있으면 제거하거나 주석으로 "폐기됨" 표기한다. 새 코드는 `execution-continuation` (하이픈)만 참조한다.

---

## 요약

`spec/5-system/4-execution-engine.md`의 구현 대상 영역이 "(없음)"이므로 신규 식별자 도입은 없다. 기존 식별자들 간 충돌은 CRITICAL 수준이 없으며, 이미 spec 내에서 명시적으로 구분 설명된 유사 네이밍 쌍(WARNING 2건, INFO 3건)이 구현 시 혼동 가능성을 가진다. 이 중 가장 주의가 필요한 것은 `EXECUTION_TIMEOUT` vs `EXECUTION_TIME_LIMIT_EXCEEDED` (서로 다른 타임아웃 계층의 에러 코드)와 `CHECKPOINT_SCHEMA_VERSION` vs `CALL_STACK_SCHEMA_VERSION` (두 독립 체크포인트 메커니즘의 버전 상수)로, 구현 시 에러 핸들러와 버전 가드 분기를 각 spec 경로에 따라 독립 유지해야 한다.

## 위험도

LOW
