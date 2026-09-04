# 테스트(Testing) 리뷰 — `QueryExecutionDto.workflowId` 제거

## 스코프

4개 파일: `CHANGELOG.md`(docs) · `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`(제거 대상 필드 삭제) · `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(JSDoc-only) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크리스트). 실질 프로덕션 코드 변경은 `query-execution.dto.ts` 하나뿐이고, 나머지는 문서/주석/plan.

검증을 위해 저장소 트리는 건드리지 않고 관련 테스트를 그대로 실행했다(뮤테이션 없음, 원복 불필요).

```
npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts   → 19 passed
npx jest src/modules/executions/executions.service.spec.ts \
         src/modules/executions/executions.controller.spec.ts    → 67 passed
```

## 발견사항

- **[WARNING]** `workflowId` 쿼리 제거가 만드는 breaking 동작(외부 클라이언트가 이 파라미터를 보내면 200→400)을 고정하는 자동화 테스트가 하나도 없다.
  - 위치: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (대응하는 `*.spec.ts` 파일 자체가 부재 — `find codebase/backend/src/modules/executions/dto -iname "*.spec.ts"` → `re-run.dto.spec.ts` 뿐) / `codebase/backend/test/workflow-execution.e2e-spec.ts` 기존 테스트 B (line 108, `GET /api/executions/workflow/:workflowId 가 해당 실행을 페이지네이션으로 반환`) — positive case 만 있고 `?workflowId=...` 를 실어 400 을 기대하는 negative case 는 없음.
  - 상세: 전역 `forbidNonWhitelisted: true`(`codebase/backend/src/common/pipes/validation.pipe.ts:31`)에 의해 이 엔드포인트로 `workflowId` 쿼리를 보내면 이제 400 이 나는데, 이 사실은 CHANGELOG.md 새 항목(§1 "영향 — 이 파라미터를 보내던 클라이언트는 400 을 받는다")에만 산문으로 적혀 있다. `CustomValidationPipe` 자체 단위 테스트(`validation.pipe.spec.ts`)도 whitelist 거부(unknown property rejection) 케이스를 전혀 다루지 않아, whitelist 동작을 검증하는 테스트가 이 저장소 어디에도 없다(전수 grep 확인: `forbidNonWhitelisted` 히트 파일 중 이 축을 검증하는 테스트 없음). 결과적으로 이 필드가 실수로 되살아나거나, `forbidNonWhitelisted` 전역 설정이 바뀌거나, 다른 미사용 쿼리 필드가 같은 패턴으로 추가돼도 어떤 테스트도 실패하지 않는다 — CHANGELOG 가 예고한 계약이 코드로 고정돼 있지 않다.
  - 제안: `workflow-execution.e2e-spec.ts` 에 `GET /api/executions/workflow/:workflowId?workflowId=<uuid>` → 400(`code: 'VALIDATION_ERROR'` 계열)을 단언하는 negative e2e 케이스를 추가하거나, 최소한 `CustomValidationPipe` 에 whitelist 거부를 검증하는 유닛 테스트를 추가해 이 클래스의 회귀를 잡을 수 있게 한다.

- **[INFO]** `swagger-dto-contract.spec.ts` 의 `[대조군] @Transform 예외` 픽스처(`class D { @ApiPropertyOptional() @Transform(...) workflowId?: string | null; }`)는 실제 소스에서 완전히 독립된 합성 클래스 문자열이다 — 그래서 이번 diff 로 실제 `workflowId` 필드가 사라져 `@Transform` 예외의 실사례가 0건이 돼도, 그 분기(면제되는 null 축 / 면제되지 않는 presence 축) 자체는 계속 양방향으로 고정된다. `judge()`/`axes()` 헬퍼로 소스 파일시스템과 무관하게 판정하는 구조라 격리도 좋다. 실행 결과 19개 테스트 전원 GREEN 을 확인했다. 이 설계는 "손으로 고른 코퍼스만 순회하면 아무도 적어두지 않은 형태가 판정 기회를 못 얻는다"는 이 저장소의 기존 교훈(생성 입력 vs 큐레이션 코퍼스)을 정확히 피해 간 사례로, 결함이 아니라 좋은 패턴이라 별도 조치는 불필요.

- **[INFO]** 회귀 테스트 유효성 — `executions.service.spec.ts`(1,000줄 이상, `findByWorkflow` 다수 테스트 포함)와 `executions.controller.spec.ts` 는 `workflowId` 쿼리 필터를 참조하지 않아(그 안의 `workflowId` 는 `Execution` 엔티티 필드이지 쿼리 DTO 필드가 아님) 이번 diff 로 깨지는 기존 테스트가 없다. 실행으로 확인(67 passed). `workflow-execution.e2e-spec.ts` 의 기존 테스트 B 도 `workflowId` 쿼리 파라미터를 보내지 않으므로 영향 없음.

- **[INFO]** `swagger-dto-contract-guard.ts` 변경은 JSDoc 주석(`@Transform` 예외 rationale 보강)뿐이고 `findSwaggerContractMismatches` 함수 로직은 무변경이다 — 이 파일 자체에 대한 신규/수정 테스트는 필요 없다.

- **[INFO]** `swagger-dto-contract.spec.ts` 의 전역 스캔 테스트(`'OpenAPI 선언과 TS 타입이 어긋난 필드가 없다'`, `expect(findSwaggerContractMismatches(files, SRC_ROOT)).toEqual([])`)가 `workflowId` 제거 후에도 GREEN 임을 실행으로 확인했다 — 필드 삭제가 다른 곳에 새 mismatch 를 남기지 않았다는 negative 증거다.

## 요약

실질 코드 변경은 죽은 쿼리 필드 하나를 제거하는 작은 diff이고, 기존 회귀 테스트(DTO·서비스·컨트롤러·e2e·swagger 계약 가드)는 전부 GREEN 으로 유지된다. 다만 이 변경이 CHANGELOG 에 명시적으로 적은 breaking 동작 — 외부 클라이언트가 `workflowId` 쿼리를 보내면 200 대신 400 을 받는다 — 을 고정하는 자동화 테스트가 저장소 어디에도 없다. `forbidNonWhitelisted` whitelist 거부라는 이 클래스의 동작 자체가 어떤 테스트로도 검증되지 않고 있어, 문서화된 계약과 실제 테스트 커버리지 사이에 갭이 있다. `[대조군] @Transform 예외` 픽스처는 소스와 독립된 합성 픽스처로 잘 설계돼 이번 필드 삭제에도 흔들리지 않는다.

## 위험도

LOW
