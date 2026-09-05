# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `ContractViolationKind.'missing'` 이 서로 다른 두 의미로 재사용된다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:42-45`(타입 정의 주석) 및
    `:83`(payload 자체가 객체가 아닌 경우) vs `:106`(required 키가 실제로 누락된 경우)
  - 상세: `ContractViolationKind` 타입은 `'missing'` 을 `// required 인데 키가 없다` 로 주석
    달아 문서화한다. 그런데 `findContractViolations` 첫머리(`payload === null || typeof payload
    !== 'object'`)에서 "payload 전체가 객체가 아니다" 라는, 필드 단위 required 누락과는 범주가
    다른 오류에도 같은 `kind: 'missing'` 값을 재사용한다(`property: '(payload)'` 로만 구분).
    타입 주석과 실제 동작이 어긋나 있어, 나중에 `violations.filter(v => v.kind ===
    'missing')` 처럼 "필드 누락만" 걸러내려는 호출부가 의도치 않게 "payload 자체가 깨졌다"
    는 별개 상황까지 같이 잡게 될 위험이 있다. `response-contract.spec.ts` 의 "payload 가
    객체가 아닌 경우" 테스트(`describe('payload 가 객체가 아닌 경우'`)는 `property`/길이만
    검증하고 `kind` 값은 단언하지 않아, 이 재사용이 회귀 테스트로 고정돼 있지도 않다.
  - 제안: `ContractViolationKind` 에 `'invalid-payload'` 같은 전용 kind 를 추가하거나, 최소한
    주석에 "`missing` 은 필드 단위 누락과 payload 자체 결함 두 경우에 쓰인다" 는 사실을
    명시한다.

- **[WARNING]** `assertMatchesDtoSchema` 의 `dtoName: string` 이 `Dto.name` 에서 파생 가능한
  값을 콜사이트마다 손으로 다시 타이핑하게 만든다
  - 위치: 정의부 `codebase/backend/src/shared/testing/response-contract.ts:162-167`
    (`dtoName: string` 파라미터) — 호출부 4곳: `codebase/backend/test/audit-logs.e2e-spec.ts:79`
    (`'AuditLogDto'`), `codebase/backend/test/session-revocation.e2e-spec.ts:110`
    (`'SessionDto'`), `codebase/backend/test/workflow-crud.e2e-spec.ts:164`(`'WorkflowDto'`),
    `codebase/backend/test/workflow-execution.e2e-spec.ts:150`(`'ExecutionDto'`)
  - 상세: 모든 호출부가 `await schemaForDto(XxxDto)` 로 **클래스 참조**를 넘기면서, 바로 다음
    인자로 그 클래스 이름을 **문자열 리터럴로 다시** 적는다(`schemaForDto` 내부는 이미
    `Dto.name` 을 씀 — 같은 정보가 두 형태로 중복). DTO 클래스가 리네임돼도 TS 컴파일러는 이
    문자열이 실제 클래스명과 일치하는지 검사하지 않으므로, 리네임 후 문자열만 stale 로 남아도
    빌드는 통과하고 실패 메시지(`formatViolations` 의 `${dtoName} 응답이 선언과...`)만 옛
    이름을 계속 출력하는 조용한 drift 가 가능하다.
  - 제안: `assertMatchesDtoSchema` 가 `dtoName: string` 대신 `Dto: Type<unknown>` 을 받아
    내부에서 `Dto.name` 을 파생하거나, `schemaForDto` 가 `{ schema, name }` 을 함께 반환하게
    바꿔 콜사이트의 수동 문자열을 제거한다.

- **[WARNING]** "find + `toBeDefined` + `assertMatchesDtoSchema`" 3문장 패턴이 이미 2개
  e2e 파일에서 반복되고, 첨부된 plan(`spec-draft-nullable-notation-followups.md`)이 이 패턴을
  **56개 DTO 로 확장**할 계획을 명시하고 있어 중복이 곧 커질 것이 예견된다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:159-165`,
    `codebase/backend/test/workflow-execution.e2e-spec.ts:148-150` (동일 3문장 구조:
    `items.find(...)` → `expect(mine).toBeDefined()` → `assertMatchesDtoSchema(mine, ...)`).
    plan 근거: `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift
    2단계" 항목이 "응답 DTO 60개 중 4개 배선 완료... 남은 것은 스윕" 이라고 적어 같은 3문장이
    수십 개 e2e 파일에 그대로 반복될 예정임을 스스로 밝히고 있다.
  - 상세: 지금은 2곳뿐이라 즉각적인 문제는 아니지만, 계획대로 스윕이 진행되면 "find →
    defined 단언 → 스키마 대조" 보일러플레이트가 파일 수십 개에 그대로 복제된다. 위 두 번째
    발견(`dtoName` 문자열 중복)과 함께 해결하면 `response-contract.ts` 에 헬퍼 하나를
    추가하는 것으로 향후 56곳의 반복을 원천 차단할 수 있다.
  - 제안: 예) `assertItemMatchesDto(items, id, Dto)` 형태의 헬퍼를
    `src/shared/testing/response-contract.ts` 에 추가해 find/defined/schema-assert 3단계와
    `Dto.name` 파생을 한 번에 캡슐화한다. 스윕 착수 **전에** 도입하면 56개 콜사이트를 3줄이
    아닌 1줄로 유지할 수 있다.

- **[INFO]** `schemaForDto` 캐싱 여부가 e2e 파일마다 다르다
  - 위치: `codebase/backend/test/workflow-execution.e2e-spec.ts:67-68`(`beforeAll` 에서
    `executionSchema = await schemaForDto(ExecutionDto)` 로 1회 계산 후 재사용) vs
    `codebase/backend/test/audit-logs.e2e-spec.ts:78`,
    `codebase/backend/test/session-revocation.e2e-spec.ts:109`,
    `codebase/backend/test/workflow-crud.e2e-spec.ts:163`(테스트 본문에서 매번 인라인
    `await schemaForDto(...)` 호출)
    각 파일에서 실제로는 1회씩만 호출되므로 성능 영향은 미미하지만, 같은 헬퍼를 쓰는 4개
    형제 파일 사이에 "왜 이 파일만 다르게 하는가" 를 설명하는 근거가 코드에 남아있지 않아
    다음 사람이 패턴을 따라 쓸 때 어느 쪽이 정석인지 판단하기 어렵다.
  - 제안: 위 헬퍼 추출과 함께, "같은 describe 블록 안에서 여러 테스트가 같은 DTO 를 대조할
    때만 `beforeAll` 캐싱, 단발성이면 인라인" 같은 기준을 짧은 주석으로 남기거나, 헬퍼 내부에
    캐싱을 흡수시킨다.

## 요약

핵심 신규 코드(`response-contract.ts`/`.spec.ts`)는 JSDoc 이 "왜 있는지·왜 이 방식인지·왜
개별 단언을 쓰지 않는지" 를 반증 이력까지 포함해 상세히 남기고, `findContractViolations` 는
중첩 깊이 3 이내·단일 관심사(선언 대 응답 대조)로 잘 절제돼 있으며, `.spec.ts` 는 각 규칙을
독립적으로 무는 대조군 테스트로 잘 구성돼 있어 전반적으로 유지보수성이 높다. 다만 (1)
`kind: 'missing'` 이 문서화된 의미와 다른 상황에도 재사용되는 점, (2) `Dto.name` 에서 파생
가능한 값을 콜사이트마다 문자열로 재입력해야 하는 점, (3) 그 결과로 생기는 3문장 보일러플레이트가
동봉된 plan 문서가 예고한 대로 56곳까지 확장될 예정이라는 점은 지금 손대면 저렴하고 나중에
손대면 비싸지는 유형의 결함이라 WARNING 으로 등재한다. `plan/`·`review/consistency/**` 하위의
문서/리포트 파일들은 생성된 산출물 성격이라 함수 길이·중첩 깊이 같은 코드 메트릭이 적용되지
않으며, 열람 결과 특별한 가독성 문제는 없었다.

## 위험도

LOW
