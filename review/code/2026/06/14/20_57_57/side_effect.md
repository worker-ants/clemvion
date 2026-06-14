### 발견사항

- **[INFO]** `assertFormSubmissionValid` — read-only DB 조회만 수행, 상태 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `assertFormSubmissionValid`
  - 상세: `nodeExecutionRepository.findOne` 및 `nodeRepository.findOneBy` 는 SELECT 전용. 검증 실패 시 throw 만 하며 execution 상태(DB row)를 변경하지 않는다. publish 전 throw 로 `execution.status` 가 `waiting_for_input` 을 유지하는 것도 의도된 설계.
  - 제안: 없음.

- **[INFO]** `coerceFormSubmission` / `coerceFormValue` — 순수 함수, 외부 상태 영향 없음
  - 위치: `execution-engine.service.ts` (static private 메서드)
  - 상세: 입력 객체를 복사하는 새 `Record<string,string>` 을 반환하며 인자를 변경하지 않는다. 전역 변수 접근 없음.
  - 제안: 없음.

- **[INFO]** `badRequest()` 시그니처 확장 — 하위 호환
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` 파일 하단 `badRequest` 함수
  - 상세: `details` 파라미터가 optional(`?`)로 추가됐으므로 기존 `badRequest(code, message)` 호출부는 영향 없음. 반환 타입(`BadRequestException`)도 동일.
  - 제안: 없음.

- **[INFO]** `ErrorCode` enum 에 `VALIDATION_ERROR` 추가 — 기존 값 불변
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`
  - 상세: `as const` 객체에 신규 키-값 쌍만 추가됐다. 기존 키·값 변경 없으므로 `ErrorCode.XXX` 참조 코드에 부작용 없음. `ErrorCodeValue` 유니온 타입이 자동으로 확장되나 기존 narrowing 코드에서 exhaustive check(`switch` + default) 가 없는 구조이므로 런타임 영향 없음.
  - 제안: 없음.

- **[INFO]** `FormValidationError` 클래스 신규 도입 — 기존 에러 계층 비변경
  - 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
  - 상세: 기존 `ExecutionError` 를 extends 하는 새 클래스 추가이며, 기존 클래스 수정 없음. `toHttpDetails()` 는 인스턴스 데이터(`this.field`, `this.message`)를 읽어 새 배열을 생성하는 순수 메서드 — 공유 상태 변경 없음.
  - 제안: 없음.

- **[INFO]** WS gateway 테스트 — `mockRejectedValueOnce` 스코프 격리 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
  - 상세: `mockRejectedValueOnce` 는 단일 호출 후 제거되므로 이후 테스트가 의도치 않게 `FormValidationError` 를 받을 위험 없음.
  - 제안: 없음.

- **[INFO]** e2e 테스트 — DB INSERT 부작용 격리
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts`
  - 상세: 테스트 케이스 G 에서 `node`, `execution`, `node_execution` 테이블에 직접 INSERT. 기존 e2e 인프라에 테스트 DB 초기화 로직이 있다고 가정하면 문제없으나, INSERT 된 row 가 다른 테스트에서 collide 할 가능성은 이론적으로 존재. 그러나 `randomUUID()` 로 고유 ID 를 생성하고 있어 충돌 위험은 극히 낮음.
  - 제안: 기존 e2e 클린업 패턴과 일관성 확인만 권장(현행 유지 가능).

### 요약

이번 변경의 핵심 신규 코드(`assertFormSubmissionValid`, `coerceFormSubmission`, `coerceFormValue`, `FormValidationError`, `badRequest` 확장)는 모두 read-only DB 조회 + throw/return 패턴으로 구성되어 있으며, 전역 변수 수정, 파일시스템 접근, 환경 변수 접근, 외부 네트워크 호출, 이벤트 발행 변경이 일절 없다. `badRequest()` 시그니처 확장은 optional 파라미터 추가로 완전 하위 호환이고, `ErrorCode` enum 및 `FormValidationError` 클래스 추가는 기존 심볼을 변경하지 않는 순수 확장이다. 의도치 않은 부작용은 확인되지 않는다.

### 위험도

NONE
