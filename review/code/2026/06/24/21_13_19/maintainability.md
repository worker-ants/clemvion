# 유지보수성(Maintainability) 리뷰

리뷰 대상: `refactor(execution-engine): C-1+M-7 — continuation publish 실패 fail-fast 통일`

---

### 발견사항

- **[INFO]** `nextSeq` 메서드 JSDoc 이 변경 취지를 상세히 기술했으나 길이가 과도함
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `nextSeq` JSDoc (8줄 추가)
  - 상세: M-7 rationale 가 본문 주석에 인라인으로 길게 기술되어 있다. 의도 자체는 명확하나, 구현보다 주석 분량이 많아 향후 구현 변경 시 주석 동기화 부담이 생긴다. spec 참조(§7.4/§9.2)는 유지하되 rationale 상세는 커밋 메시지 또는 spec 문서에 위임하는 편이 더 유지보수하기 좋다.
  - 제안: JSDoc 을 "INCR 실패 시 throw 전파 — publish outer catch 가 null 반환. §7.4/§9.2 idempotency 계약 보존." 수준으로 간결화. 긴 rationale 은 spec 에 위임.

- **[INFO]** `nextSeq` 내부 try/catch 제거로 함수 구조가 단순해짐 — 긍정적 변화
  - 위치: `continuation-bus.service.ts` — `nextSeq` 구현 (변경 전후 diff 참조)
  - 상세: 기존 try/catch 를 제거하고 INCR 실패를 상위 `publish` catch 로 위임함으로써 `nextSeq` 의 책임이 "seq 생성"으로 단일화되었다. 중첩 try/catch 의 제거는 읽기 복잡도를 낮추고 에러 처리 경로를 명확하게 한다.
  - 제안: 변경 없음 (긍정적 변화 기록).

- **[WARNING]** `ServiceUnavailableException` throw 시 `ErrorCode` 상수 미참조 — 문자열 리터럴 직접 사용
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `stop()` WAITING 분기 내 `throw new ServiceUnavailableException({ code: 'EXECUTION_ENQUEUE_FAILED', ... })`
  - 상세: `error-codes.ts` 에 `ErrorCode.EXECUTION_ENQUEUE_FAILED` 상수가 이미 등재되어 있음에도 `code` 필드에 문자열 리터럴 `'EXECUTION_ENQUEUE_FAILED'` 을 직접 사용한다. 이는 타입 안전성을 약화시키며, 향후 에러 코드 값이 리팩터링될 경우 이 위치가 누락될 위험이 있다. 동일 파일 내 다른 에러 처리 패턴과도 일관성이 떨어진다.
  - 제안: `code: ErrorCode.EXECUTION_ENQUEUE_FAILED` 로 수정하고 `ErrorCode` 를 import 한다.

- **[INFO]** `executions.service.ts` 의 `stop()` WAITING 분기 — 인라인 주석 블록이 실제 로직(4행)보다 길어 가독성 일부 저하
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `stop()` 함수의 `WAITING_FOR_INPUT` 분기 (+12행 주석 추가)
  - 상세: 추가된 블록 주석이 실제 로직 코드보다 약 3배 길다. 주석 내용(503 선택 근거, C-1 맥락, WS 후속 이벤트 흐름)은 유용하지만, 함수 안에 서술형 주석이 길게 삽입될수록 향후 구현 변경 시 주석과 코드 간 드리프트 위험이 높아진다.
  - 제안: 핵심 한 줄("C-1: queued=false → 503, Redis upstream failure, api-convention §6")만 인라인에 남기고 상세 rationale 는 메서드 JSDoc 또는 PR description 으로 이동 고려.

- **[INFO]** 테스트 픽스처 `baseFake` 및 mock 패턴이 기존과 일관되게 재사용됨 — 긍정적
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` — 신규 `describe('stop — WAITING_FOR_INPUT cancel (C-1)')` 블록
  - 상세: `baseFake` 헬퍼를 일관 사용하고, `mockResolvedValueOnce` 패턴이 기존 테스트와 통일되어 있다. 중복 코드 없음. test description 이 의도를 명확히 표현한다.
  - 제안: 변경 없음.

- **[INFO]** `websocket.gateway.spec.ts` — `cancelWaitingExecution` mock 형식이 인접 mock 들과 동일한 패턴으로 통일됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
  - 상세: `endAiConversation`, `publishRetryLastTurn` 등 동일 패턴의 mock 과 형식이 통일되어 있어 일관성이 좋다.
  - 제안: 변경 없음.

- **[INFO]** `error-codes.ts` 신규 에러 코드 등재 위치 및 주석 구조가 기존 컨벤션과 일치
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `EXECUTION_ENQUEUE_FAILED` 추가
  - 상세: 기존 `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG` 과 동일 그룹 하에 배치되고, 주석 스타일(배경 기술 → 코드 값)이 파일 전체 패턴과 일치한다.
  - 제안: 변경 없음.

---

### 요약

이번 리팩터링(C-1 + M-7)은 유지보수성 관점에서 전반적으로 긍정적인 방향의 변경이다. `nextSeq` 에서 불필요한 try/catch 중첩을 제거하고 에러 전파 책임을 상위 `publish` 에 일원화한 것은 순환 복잡도를 낮추고 함수 책임을 단일화했다. `cancelWaitingExecution` 의 `void` → `Promise<ContinuationPublishResult>` 전환은 4종 continuation 메서드와 API 표면을 통일하여 코드베이스 일관성을 높였다. 단, `ServiceUnavailableException` throw 시 `ErrorCode` 상수를 참조하지 않고 문자열 리터럴을 직접 사용한 점은 타입 안전성 관점의 작은 리스크이며 수정이 권장된다(WARNING). 일부 주석 분량이 구현 코드를 초과하지만 복잡한 스펙 맥락을 설명하는 특성상 INFO 수준이며, 전체 변경은 기존 코드베이스 스타일과 패턴을 잘 준수하고 있다.

---

### 위험도

LOW
