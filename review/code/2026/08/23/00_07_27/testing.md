# 테스트(Testing) 리뷰 — `execute` 요청 본문 OpenAPI 문서화

## 발견사항

- **[WARNING]** PR 의 실제 목적(OpenAPI 문서 노출)을 검증하는 테스트가 없다 — 추가된 테스트는 전부 "런타임 계약이 깨지지 않았는가"(안전망) 만 확인한다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (클래스 전체, 30~53줄) / `codebase/backend/src/modules/workflows/workflows.controller.ts:256` `@ApiBody({ type: ExecuteWorkflowDto, required: false })`
  - 상세: `workflows-execute-body.spec.ts` 는 두 갈래(캐너리 2건 + 대조군 `it.each` 3건) 모두 "`@Body()` 파라미터 타입이 여전히 `Object` 인가" · "파이프가 여분 키를 여전히 통과시키는가" 만 검증한다. 정작 이 PR 이 실제로 새로 만드는 산출물 — `ExecuteWorkflowDto` 가 `SwaggerModule.createDocument()` 결과의 `components.schemas` 에 올바르게 등록되는지, `/workflows/{id}/execute` 오퍼레이션의 `requestBody` 스키마가 `ExecuteWorkflowDto` 를 정확히 가리키는지, `required: false` 가 반영되는지 — 를 단언하는 테스트가 전혀 없다. 같은 컨트롤러 파일에 구조가 거의 동일한 형제 DTO `ExecuteNodeDto` 가 나란히 import 돼 있어(`workflows.controller.ts:57~58`), `@ApiBody({ type: ExecuteNodeDto })` 로 잘못 참조하는 복붙 실수를 해도 컴파일도 통과하고 런타임 파이프 동작(현재 테스트가 잡는 유일한 축)도 전혀 안 바뀌므로 지금 테스트 셋으로는 절대 잡히지 않는다.
  - 근거: 이 저장소에는 이미 이 정확한 패턴(`SwaggerModule.createDocument()` 로 문서를 빌드해 특정 DTO 의 스키마 등록·필드를 단언)의 정본 테스트가 존재한다 — `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts` (`InteractAckDto 가 components.schemas 에 등재된다` 등). 전체 e2e 스위트를 검색해도 `SwaggerModule`/swagger 문서 생성을 다루는 테스트는 이 두 DTO spec 뿐이라(`grep -rln "SwaggerModule.createDocument" src test` → 3개 파일, e2e 0개), `setupSwagger()`(main.ts, `isSwaggerEnabled` 게이팅) 경로 자체도 테스트에서 실행되지 않는다.
  - 제안: 위 `interact-ack-response.dto.spec.ts` 패턴을 따라 `ExecuteWorkflowDto` 전용 spec(또는 기존 `workflows-execute-body.spec.ts` 확장)에 (a) `components.schemas.ExecuteWorkflowDto` 존재, (b) `paths['/workflows/{id}/execute'].post.requestBody` 의 스키마 `$ref` 가 `ExecuteWorkflowDto` 를 가리키는지, (c) `requestBody.required === false` 를 단언하는 테스트 추가.

- **[INFO]** 캐너리가 "`@Body()` = 메서드의 마지막 파라미터" 라는 위치 가정에 의존 — 향후 시그니처 변경 시 조용히 무의미해질 수 있다
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:29` `return types[types.length - 1];`
  - 상세: `executeBodyParamType()` 은 `@Body()` 파라미터를 데코레이터·이름으로 식별하지 않고 `execute()` 시그니처의 마지막 위치라는 가정으로 찾는다. 지금은 `(id, workspaceId, user, res, body?)` 순서라 맞아떨어지지만, 이후 `execute()` 에 파라미터가 하나 더 추가되거나 순서가 바뀌면(예: 새 `@Query()` 필터를 body 뒤에 추가) 이 캐너리는 조용히 엉뚱한 파라미터의 타입을 검사하게 되고, 정작 `@Body()` 가 DTO 로 승격되는 회귀(이 테스트가 지키려는 바로 그 사고)를 놓칠 수 있다. `design:paramtypes` 만으로는 어느 인덱스가 `@Body()` 인지 라이브러리 차원에서 식별 불가하다는 근본 한계 때문에 불가피한 트레이드오프이긴 하다.
  - 제안: 최소한 "마지막 파라미터 = body 가정이 깨지면 이 캐너리는 무의미해진다"는 주석을 명시하거나, Nest 내부 라우트 인자 메타데이터(`__routeArguments__`)로 `@Body()` 위치를 직접 찾는 방식으로 강화 검토(현재 리스크는 낮아 선택 사항).

## 검증한 내용 (문제 없음 확인)

- `codebase/backend/src/common/pipes/validation.pipe.ts` 실제 소스를 대조해, 캐너리·대조군 테스트의 전제(① `toValidate()` 가 `Object` 를 제외해 인라인 타입은 파이프를 skip, ② `class-validator` 는 `forbidUnknownValues` 기본값(true)+타깃 메타데이터 0건이면 **빈 객체조차** `unknownValue` 에러로 전원 거부)가 라이브러리 실제 동작과 정확히 일치함을 `class-validator` 소스(`ValidationExecutor.js`)로 직접 확인했다. Mock 없이 실제 `CustomValidationPipe` 인스턴스를 그대로 쓰는 설계라 괴리 위험이 낮다.
- `npx jest src/modules/workflows` 전체(6 suites / 164 tests) 및 신규 스펙 단독 실행 모두 GREEN. 기존 `workflows.controller.spec.ts` 는 `controller.execute(...)` 를 직접 호출하는 단위 테스트라 `@ApiBody` 추가(메타데이터 전용)에 영향받지 않음을 확인 — 회귀 없음.
- `npx tsc --noEmit` 결과 이번 변경 3개 파일 관련 타입 에러 0건(기존에 무관한 파일들의 타입 에러는 이 PR 과 무관).
- (환경 노이즈, 코드 결함 아님) 최초 실행 시 ts-jest 캐시가 stale 상태여서 `design:paramtypes` 마지막 인자가 `ExecuteWorkflowDto` 로 잘못 리졸브돼 캐너리 2건이 RED 였다 — `jest --clearCache` 후 안정적으로 GREEN. 역설적으로 이는 "메타타입이 `ExecuteWorkflowDto` 로 바뀌면 캐너리가 즉시 RED" 라는 뮤테이션 방어력을 실측으로 증명해 준 셈이다(plan 의 "뮤테이션 검증 기준"이 실제로 충족됨을 별도 조작 없이 확인).
- 테스트 격리: 각 테스트가 `new CustomValidationPipe()` 를 개별 생성하고 공유 상태·`beforeEach` 순서 의존이 없어 독립 실행 가능. 가독성도 좋음(캐너리/대조군 구분, 한국어 docstring 이 "왜 이 테스트가 존재하는가"를 명확히 설명).

## 요약

`ExecuteWorkflowDto`/`@ApiBody` 자체는 순수 선언적 메타데이터라 단위 테스트 대상 로직이 거의 없고, 이번에 추가된 `workflows-execute-body.spec.ts` 는 "문서화 작업이 조용히 런타임 계약(파이프 스킵)을 깨지 않았는가"를 지키는 안전망 캐너리로서 실제 라이브러리 동작에 근거해 정확하고 견고하게 설계됐다(Mock 미사용, 격리 양호, 회귀 없음, 뮤테이션 방어력도 우연히 실측 확인됨). 다만 이 PR 의 본래 목적인 "OpenAPI 문서가 올바르게 노출되는가"(스키마 등록·`requestBody` 참조 정확성) 자체를 검증하는 테스트는 전혀 없어, 형제 DTO 오참조 같은 복붙 실수가 지금 테스트 스위트로는 전혀 잡히지 않는 커버리지 갭이 남아 있다. 저장소에 이미 같은 패턴(`interact-ack-response.dto.spec.ts`)이 존재하므로 추가 비용은 낮다.

## 위험도

LOW
