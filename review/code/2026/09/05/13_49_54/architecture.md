# Architecture Review — response-contract 테스트 인프라 + e2e 배선 (2026-09-05 13:49:54)

## 발견사항

- **[WARNING]** DTO 식별자가 "클래스 참조"와 "문자열 리터럴" 두 형태로 이중 표현되어 호출부마다 반복된다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:162-167`(`assertMatchesDtoSchema(payload, schema, dtoName: string, ...)`), `181-183`(`schemaForDto(Dto: Type<unknown>)`)
  - 사용 예: `codebase/backend/test/workflow-crud.e2e-spec.ts:161-165`, `codebase/backend/test/audit-logs.e2e-spec.ts:76-80`, `codebase/backend/test/session-revocation.e2e-spec.ts:107-111`, `codebase/backend/test/workflow-execution.e2e-spec.ts:150`
  - 상세: `schemaForDto`는 `Type<unknown>`(클래스 참조)을 받고, `assertMatchesDtoSchema`는 그 결과 스키마와 별개로 `dtoName: string`을 또 요구한다. 그 결과 모든 호출부가 `schemaForDto(WorkflowDto)` 와 `'WorkflowDto'` 처럼 **같은 이름을 식별자와 문자열로 두 번** 적는다. 두 함수가 같은 파일 안에 있고 `schemaForDto` 내부에서 이미 `Dto.name`(`schemaOf(doc, Dto.name)`)을 실제로 쓰고 있으므로, `assertMatchesDtoSchema`도 `Type<unknown>`을 받아 `Dto.name`을 파생시키는 편이 자연스럽다. 이 doc 자체가 "78곳/60개 DTO로 넓히는 기계적 스윕"을 명시적 목표로 삼고 있어(`response-contract.ts:18`, `spec-draft-nullable-notation-followups.md` §5.4 2단계), 클래스명이 바뀌었는데 문자열 리터럴을 안 고치는 실수가 스윕 규모(약 60곳)에 비례해 반복될 수 있다. 컴파일 타임에 안 잡히고 실패 메시지(`formatViolations`의 `dtoName`)만 조용히 stale 해지는 방식이라 발견이 늦다.
  - 제안: `assertMatchesDtoSchema(payload, schema, Dto: Type<unknown>, options)` 형태로 바꿔 내부에서 `Dto.name`을 쓰거나, 최소한 `schemaForDto`가 `{ schema, name }` 형태를 반환해 호출부가 이름을 별도로 타이핑하지 않게 한다.

- **[INFO]** `schemaForDto()` 호출 방식이 4개 배선 지점에서 서로 다르다 — 3곳은 매 테스트마다 재생성, 1곳만 `beforeAll`에서 캐시
  - 위치: 인라인 재생성 — `codebase/backend/test/audit-logs.e2e-spec.ts:78`, `codebase/backend/test/session-revocation.e2e-spec.ts:109`, `codebase/backend/test/workflow-crud.e2e-spec.ts:163`. 캐시 — `codebase/backend/test/workflow-execution.e2e-spec.ts:63,68`(`executionSchema` 필드에 저장 후 재사용, `150`에서 소비)
  - 상세: `schemaForDto`는 매 호출마다 `Test.createTestingModule(...).compile()` → `createNestApplication()` → `SwaggerModule.createDocument()` → `app.close()`를 거치는, 결코 공짜가 아닌 in-process 부트스트랩이다. 4개 배선 지점 중 3곳은 이걸 해당 `it()` 블록 안에서 매번 새로 돌리고, 1곳(`workflow-execution`)만 `beforeAll`에서 한 번 만들어 재사용한다. 지금은 각 파일이 그 DTO를 한 번씩만 쓰므로 정확성에는 영향이 없지만, 이 patch의 plan 문서(`spec-draft-nullable-notation-followups.md`)가 이 패턴을 나머지 응답 DTO ~56곳으로 "기계적으로" 넓히는 것을 다음 작업으로 못박아 두었다 — 그 스윕에서 한 스펙 파일이 같은 DTO 스키마를 여러 `it()`에서 재사용하게 되면(예: 목록+상세 두 엔드포인트가 같은 DTO를 공유), 캐시하지 않는 3곳의 패턴을 그대로 복사할 경우 불필요한 반복 부트스트랩이 누적된다.
  - 제안: 스윕을 시작하기 전에 "스키마는 `beforeAll`에서 1회 생성, 대조는 `it()`에서" 를 규약으로 명시(또는 `response-contract.ts` 자체에 프로세스 내 메모이제이션을 얹어 파일마다 캐싱 코드를 반복하지 않게 한다).

- **[INFO]** `ContractViolationKind`가 "필드 누락"과 "payload 자체가 객체가 아님"에 같은 `'missing'` 값을 재사용한다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:79-87`(`payload === null || typeof payload !== 'object'` 분기가 `kind: 'missing'` 반환) vs `102-110`(`required.has(name)` 분기의 진짜 "필드 누락" `kind: 'missing'`)
  - 상세: 두 경우는 의미가 다르다 — 하나는 "이 필드가 없다", 다른 하나는 "응답 자체가 구조를 갖추지 못했다"인데 동일한 `ContractViolationKind` 값을 공유한다. `property: '(payload)'`로 구분은 되지만(`response-contract.spec.ts:150-153`가 이를 근거로 검증), `kind`만 보고 집계하는 소비자가 생기면(예: "missing 필드 개수" 리포트) 두 종류가 섞인다. 지금은 소비자가 헬퍼(`schemaForDto`+`assertMatchesDtoSchema`) 밖에 없어 실질적 위험은 낮다.
  - 제안: 3번째 kind(예: `'malformed-payload'`)를 추가하거나, 지금처럼 유지한다면 그 이유(payload 형태 오류는 필드 단위 위반과 다른 축임)를 주석으로 남긴다.

- **[INFO]** §5.4 시행 코드(`response-contract.ts`)가 아직 어떤 spec 의 `code:` frontmatter glob 에도 걸리지 않는다 — 이미 작성자 스스로 추적 중인 항목
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:266-271`(신규 등재 항목), 대상 코드는 `codebase/backend/src/shared/testing/response-contract.ts` 전체
  - 상세: 이 검증자는 `spec/5-system/2-api-convention.md` §5.4의 유일한 실제 enforcement 인데, 그 spec 문서의 `code:` glob 이 아직 이 파일을 가리키지 않는다. 즉 이 파일을 나중에 고쳐도 `--impl-done` 의 SPEC-CONSISTENCY 게이트가 그 변경을 spec 준수 검증 대상으로 인식하지 못한다 — 코드와 spec 거버넌스 레이어 사이의 추적 경계에 구멍이다. developer 는 `spec/` 쓰기 권한이 없어 이번 PR 에서 등재만 해 두었다고 plan 문서에 명시돼 있으므로 새로운 발견은 아니지만, 아키텍처 관점에서 "시행 코드가 그 시행 대상 spec 의 커버리지 밖에 있다"는 사실 자체는 기록해 둔다.
  - 제안: (이미 plan 에 등재됨) planner 턴에서 `2-api-convention.md` frontmatter `code:` 에 `codebase/backend/src/shared/testing/response-contract.ts` 를 추가.

## 요약

`response-contract.ts`는 기존 `swagger-probe.ts`(문서 생성 레이어) 위에 "응답 1건 vs DTO 선언" 이라는 단일 도메인 규칙(§5.4)을 얹은 얇고 응집도 높은 계층이다 — `PropertyContract`로 필요한 축만 좁혀 참조하고, `allowUndeclared` 옵션에는 남용을 경계하는 주석까지 달려 있으며, DTO 클래스에 대한 의존은 호출부가 주입하므로(`Type<unknown>`) 순환 의존이나 레이어 역전은 없다. e2e 스펙 4곳의 배선도 기존 "테스트가 `src/`를 relative import" 관례를 그대로 따라 새로운 모듈 경계 위반을 만들지 않는다. 다만 이 인프라가 앞으로 ~56개 DTO/엔드포인트로 기계적으로 넓혀질 것이 plan 문서에 명시돼 있는데, (1) DTO 이름을 클래스 참조와 문자열 리터럴로 이중 기입해야 하는 API 설계와 (2) `schemaForDto()`의 캐싱 여부가 배선 지점마다 다른 점은 그 스케일에서 누적될 수 있는 유지보수 비용이다. 둘 다 지금 당장 동작을 깨뜨리지는 않는다.

## 위험도

LOW
