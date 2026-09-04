# 테스트(Testing) 리뷰 — §5.4 drift 배치 후속 fix(RESOLUTION `14_54_36` W1/W2 대응)

## 범위 요약

이번 diff 는 직전 리뷰 라운드(`14_54_36`)의 testing WARNING 2건(W1: 배치 범위 83→15 축소, W2:
`execution-status-response.dto.spec.ts` 의 `required` 미검증)에 대한 fix 다. 실질 코드 변경은:

- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` — `ExecutionDto` 10필드
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` — `ExecutionStatusDto` 5필드
- `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts` — **신규 `required` 단언 + `it.each` 확장**

나머지(`CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/**` 산출물)는
문서·리뷰 부속물이다.

## 검증 방법

- `execution-status-response.dto.spec.ts` 를 실제로 `npx jest execution-status-response.dto.spec.ts` 로
  실행해 **20/20 GREEN** 확인(저장소 트리는 건드리지 않았다 — 순수 실행).
  RESOLUTION.md 가 주장하는 "GREEN 20건 / 뮤턴트 RED 1건·19 pass" 의 분모(20)가 실측과 일치한다.
- `swagger-dto-contract-guard.ts` / `swagger-dto-contract.spec.ts` 원문을 읽어 AST 가드가 정확히 무엇을
  검사하는지(데코레이터 `required`/`nullable` ↔ TS `?`/`| null` 의 **소스 내부 정합성**) 확인 — 캐너리
  테스트(`@nestjs/swagger` alias 가정)까지 갖춘 견고한 가드임을 확인했다.
- `ExecutionDto` 를 참조하는 `*.spec.ts` 전체를 grep 해 `schemasOf`/`createDocument` 를 함께 쓰는 파일이
  있는지 확인 — **0건**.
- `toExecutionDto`(`executions.service.ts`)의 실제 조립부를 읽어 `redactStoredFieldsForResponse` 의 반환
  타입이 옵셔널 필드 없이 전부 required 임을 확인 — object-spread widening 함정에 해당하지 않음(api_contract
  리뷰의 INFO #22 우려가 이 지점에는 적용되지 않는다).

## 발견사항

- **[WARNING]** `ExecutionDto`(10필드)는 `ExecutionStatusDto` 와 달리 **문서-생성 레벨 테스트가 아예
  없다** — 이번 PR 이 막으려던 것과 같은 종류의 "전체 되돌림(decorator+TS 동시 원복)" 회귀를 어떤
  자동화도 잡지 못한다
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    (`ExecutionDto` 클래스, 예: 19행 `triggerId`, 42-43행 `finishedAt`, 46-47행 `durationMs`,
    57-62행 `inputData`, 72-77행 `outputData`, 88-93행 `error`, 96-97행 `executedBy`, 100-101행
    `parentExecutionId`, 112-113행 `reRunOf`, 116-117행 `chainId`) — 부재하는 파일:
    `execution-response.dto.spec.ts`
  - 상세: 이번 라운드의 W2 fix 는 `ExecutionStatusDto` 의 유일한 스키마-레벨 테스트에 `required`
    단언을 추가해, **decorator 와 TS 타입을 동시에** `@ApiPropertyOptional`/`field?:` 로 되돌리는
    회귀(자기-정합적이라 AST 가드가 못 잡고, 타입이 optional 로 넓어지는 방향이라 `tsc` 도 안 잡는
    방향)를 실제 생성 문서 레벨에서 고정했다. 그런데 같은 커밋이 함께 바꾸는 `ExecutionDto` 10필드에는
    **애초에 `SwaggerModule.createDocument()` 를 빌드해 스키마를 검사하는 테스트 자체가 존재하지 않는다**
    (`grep` 으로 `ExecutionDto` 를 참조하는 모든 `*.spec.ts` 를 훑었으나 `schemasOf`/`createDocument` 를
    함께 쓰는 파일 0건). 남는 방어선은 `swagger-dto-contract.spec.ts`(AST 가드) 뿐인데, 이 가드는 파일
    **내부** 의 decorator↔TS 정합만 본다 — 누군가 `triggerId: string | null` 을
    `triggerId?: string | null` 로, `@ApiProperty({...nullable:true})` 를
    `@ApiPropertyOptional({...nullable:true})` 로 **함께** 되돌리면 가드는 여전히 "정합"이라 통과하고,
    `toExecutionDto` 의 반환식도 optional 필드에 non-undefined 값을 채우는 것은 TS 에서 항상 합법이라
    `tsc` 도 통과한다. 즉 이 10필드에 한해서는 **이번에 고친 것과 동일한 종류의 회귀를 어떤 자동
    테스트도 잡지 못하는 상태**가 그대로 남아 있다. (오늘 시점 위험도는 낮다 — 런타임 wire 불변,
    되돌림이 일어나야 발현.)
  - 제안: `execution-status-response.dto.spec.ts` 와 같은 패턴으로 `ExecutionDto` 에 대해서도
    `buildSwaggerDocument`+`schemasOf` 기반 스펙을 최소 1개 신설하고, 이번에 뒤집은 10필드에 대한
    `required` 배열 단언(`expect.arrayContaining([...])`)을 추가할 것을 권장. 후속 티켓(2단계, 68곳)과
    묶어도 되지만, 이 10필드는 **이미 이번 PR 이 손댄 필드**이므로 우선순위가 더 높다.

- **[INFO]** W2 fix 자체는 정확하고 뮤테이션으로 실측 검증됨 — 추가 지적 없음
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:110-141`
  - 상세: `it.each` 를 3→5필드(`currentNode`/`context` 추가)로 넓히고, `required` 배열에 대해
    `expect.arrayContaining([...5개])` 단언을 별도로 추가했다. `arrayContaining` 을 써서 다른(무관한)
    required 필드가 배열에 더 있어도 깨지지 않도록 정확히 설계됨 — 과잉 명세(over-specification) 없음.
    독립적으로 `npx jest execution-status-response.dto.spec.ts` 를 실행해 **20/20 GREEN** 을 재확인했고,
    RESOLUTION.md 가 보고한 총 테스트 수(20)와 일치한다. `beforeAll` 에서 `doc`/`schemas` 를 1회 빌드해
    이후 모든 `it` 이 읽기 전용으로 공유하므로 테스트 간 상호 의존성(mutation)도 없다 — 격리 양호.
  - 제안: 없음(양호).

- **[INFO]** `nullable` `it.each`(5필드)와 `required` 단일 `it`(같은 5필드)이 필드 목록을 중복 나열
  — 사소한 가독성 관찰, 결함 아님
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:110-141`
  - 상세: 같은 5개 필드명(`result`/`error`/`durationMs`/`currentNode`/`context`)이 두 블록에 각각
    하드코딩돼 있어, 필드가 하나 추가될 때 두 곳을 함께 고쳐야 한다(현재는 그렇게 됐다 — `it.each` 는
    5개로, `required` 단언도 5개로 함께 갱신됨). 상수 배열로 한 번만 선언해 두 단언이 그것을 공유하게
    하면 drift 여지가 줄어든다.
  - 제안: 선택 사항. 상수 `const NULLABLE_PRESENT_FIELDS = ['result','error','durationMs','currentNode','context']` 로
    추출해 `it.each` 와 `arrayContaining` 양쪽에서 재사용.

- **[INFO]** `ExecutionDto` 조립부(`toExecutionDto`)의 object-spread(`...redactStoredFieldsForResponse(execution)`)는
  이번 리뷰가 우려할 만한 "widening" 함정에 해당하지 않음을 실측 확인 — 안심 근거
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `toExecutionDto`(977행 부근),
    `codebase/backend/src/shared/utils/redact-stored-error.ts` `redactStoredFieldsForResponse`(97-111행)
  - 상세: 스프레드 소스의 반환 타입이 `{ inputData: X|null; outputData: X|null; error: X|null }` 로
    **옵셔널 마커가 전혀 없다** — 그래서 `: ExecutionDto` 로 타입된 반환 리터럴에 스프레드해도 `tsc`
    가 세 필드의 상시 존재를 실제로 검사한다. 위 WARNING(첫 항목)이 지적하는 갭은 "테스트가 없다"는
    것이지 "오늘 값이 비어 있을 수 있다"는 것이 아니다 — 이 부분은 혼동하지 않도록 명시한다.
  - 제안: 조치 불요.

## 요약

이번 fix 는 직전 라운드의 W1(범위 축소)·W2(`required` 미검증)를 정확히 고쳤다 — 특히 W2 는 뮤테이션으로
검증됐고 독립 재실행(20/20 GREEN)으로도 확인된다. 다만 같은 커밋이 함께 뒤집는 `ExecutionDto` 10필드는
`ExecutionStatusDto` 와 달리 문서-생성 레벨 테스트가 전혀 없어, 이번에 고친 것과 **같은 종류의 회귀**
(decorator+TS 타입을 동시에 되돌리는 편집)를 어떤 자동 테스트도 잡지 못하는 상태가 남아 있다. 오늘
시점 결함은 아니지만(런타임 wire 불변, 회귀가 실제로 일어나야 발현), 이번 PR 이 "이 정확한 축을
테스트가 놓치고 있었다"는 교훈을 스스로 남긴 직후라는 점에서 남은 10필드에도 같은 처방을 적용하는
후속 조치의 우선순위가 낮지 않다.

## 위험도

LOW
