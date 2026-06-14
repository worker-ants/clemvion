# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `mockNodeRepo`에 `findOneBy` mock 추가 — 기존 테스트에 영향 없음
  - 위치: `execution-engine.service.spec.ts` diff 라인 38 (`findOneBy: jest.fn().mockResolvedValue(null)`)
  - 상세: `beforeEach` 내 `mockNodeRepo` 초기화에 `findOneBy` 가 추가됐다. 기본값 `null` 이므로 기존 테스트 중 `nodeRepository.findOneBy` 를 호출하지 않던 경로는 그대로 통과하며, `armSlowPathResume` 헬퍼가 이미 `mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(nodeDef)` 로 per-test override 하는 패턴과 일관된다. 부작용 없음.

- **[INFO]** `assertFormSubmissionValid` 내부에서 `nodeExecutionRepository.findOne` + `nodeRepository.findOneBy` 두 번의 DB 조회 추가
  - 위치: `execution-engine.service.ts` 라인 1471~1476 (`assertFormSubmissionValid`)
  - 상세: `continueExecution` 호출 시 기존에는 `resolveWaitingNodeExecutionId` 에서의 `find` 1회뿐이었으나, 신규 검증 단계에서 `nodeExecutionRepository.findOne({ where: { id } })` + `nodeRepository.findOneBy({ id })` 가 순차적으로 추가된다. 이 조회들은 read-only 이며 execution 상태·DB 레코드를 변경하지 않는다. `findOne`/`findOneBy` 가 null 을 반환하면 early return 으로 검증을 건너뛰는 방어 경로가 존재한다(의도적 설계).

- **[INFO]** `coerceFormSubmission` / `coerceFormValue` 는 static private 메서드로 외부 상태를 변경하지 않음
  - 위치: `execution-engine.service.ts` 라인 1495~1521
  - 상세: 두 메서드 모두 순수 변환 함수(입력 → 출력)이며, 전역 변수·공유 상태·파일시스템·네트워크에 접근하지 않는다. 부작용 없음.

- **[INFO]** `FormValidationError` 클래스 추가 — 기존 `ExecutionError` 계층의 확장
  - 위치: `workflow-errors.ts` diff 라인 1620~1630
  - 상세: 신규 `FormValidationError extends ExecutionError` 클래스가 추가됐다. `code = 'VALIDATION_ERROR' as const` 는 새로운 리터럴 코드이며, 기존 에러 코드 enum(`ErrorCode`)과 충돌하지 않는다. `ExecutionError` 기반이므로 `buildContinuationErrorAck` 에서 `errorCode` 로 surface 되는 기존 계약을 상속한다. 기존 에러 클래스 계층·핸들러에 변경 없음.

- **[INFO]** `badRequest` 함수 시그니처 변경 — 선택적 `details` 파라미터 추가
  - 위치: `interaction.service.ts` diff (`-function badRequest(code, message)` → `+function badRequest(code, message, details?)`)
  - 상세: `details` 는 optional 이며, 기존 모든 호출부는 두 인자만 전달하므로 하위 호환 유지. 모듈 내부 private 함수이므로 외부 API 영향 없음.

- **[INFO]** `executions.controller.ts` 의 `continueExecution` 핸들러에 `FormValidationError` catch 분기 추가
  - 위치: `executions.controller.ts` 라인 172~191
  - 상세: 기존에 `InvalidExecutionStateError` 만 잡던 `try/catch` 에 `FormValidationError` 처리가 추가됐다. 이 분기가 없으면 `FormValidationError` 는 NestJS 글로벌 필터를 타서 500 으로 처리될 수 있었으나, 이제 400 으로 명시 매핑된다. 기존 `InvalidExecutionStateError` → 422 분기에는 변경 없음.

- **[INFO]** `interaction.controller.ts` — Swagger `@ApiBadRequestResponse` description 문자열만 변경
  - 위치: `interaction.controller.ts` diff 라인 2219~2221
  - 상세: OpenAPI 명세 문자열 수정(`VALIDATION_FAILED` → `VALIDATION_ERROR`)이며, 런타임 동작 변화 없음.

- **[INFO]** e2e 테스트 케이스 G 추가 — 실제 DB INSERT 포함
  - 위치: `external-interaction.e2e-spec.ts` diff 라인 3369~3409
  - 상세: 테스트 케이스 내에서 `node`, `execution`, `node_execution` 을 직접 DB 에 삽입한다. `beforeAll`/`afterAll` 에 cleanup 로직이 없으나, 이는 이 e2e 파일 전체의 기존 패턴과 동일하다(기존 F 케이스도 동일). e2e 환경 고립성은 테스트 인프라 설계에 의존하며, 이번 변경이 새로 도입한 문제가 아니다.

- **[INFO]** `armSlowPathResume` 내 `mockNodeRepo.findOneBy` 직접 프로퍼티 재할당
  - 위치: `execution-engine.service.spec.ts` 라인 671 (`mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(nodeDef)`)
  - 상세: 이 헬퍼는 특정 테스트 전에 명시적으로 호출되며, `beforeEach` 가 매 테스트마다 `mockNodeRepo` 를 새로 초기화하기 때문에 상태 누출은 없다.

## 요약

이번 변경은 `continueExecution` publisher 경로에 form 필드 서버 측 동기 검증(`assertFormSubmissionValid`)을 추가하고, 검증 실패를 `FormValidationError` 라는 신규 타입 에러로 표면화하며, REST(executions controller, interaction service) 및 e2e 경로에서 이를 400 VALIDATION_ERROR + details[] 로 매핑한다. 의도치 않은 상태 변경·전역 변수 도입·파일시스템 부작용·네트워크 부작용은 없다. `assertFormSubmissionValid` 가 추가하는 두 번의 DB 조회는 read-only 이며 execution 상태를 변경하지 않는다. `badRequest` 함수의 `details` 파라미터 추가는 선택적이므로 기존 호출부에 영향이 없다. 기존 에러 처리 계층(`ExecutionError`, continuation ack 빌더)과 계약이 일관되게 유지된다.

## 위험도

NONE
