# 테스트(Testing) 리뷰

## 범위 요약

22개 변경 파일 중 20개가 backend 응답 DTO(`@ApiPropertyOptional` + `field?: T | null` →
`@ApiProperty` + `field: T | null`, 83개 필드)이고 나머지는 `CHANGELOG.md` ·
`plan/in-progress/spec-draft-nullable-notation-followups.md` 문서다. **테스트 코드 자체를
추가·수정한 파일은 diff 안에 없다.** 검증 근거로 CHANGELOG/plan 문서가 내세우는 것은
`tsc` 타입체크 결과("83곳 뒤집고 비-spec 오류 0건")와, 이전 PR(#1276)에서 이미 만들어진
저장소 전역 AST 가드 `swagger-dto-contract.spec.ts` 뿐이다.

## 발견사항

- **[INFO]** 이 배치 자체에 새 테스트가 없는 것은 타당하다 — 이미 존재하는 회귀 가드가 정확히 이 계약을 검사한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`, `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: `findSwaggerContractMismatches` 는 `SRC_ROOT` 전체(`collectTsFiles(SRC_ROOT)`)를 AST 로 스캔해 `@ApiProperty`/`@ApiPropertyOptional` 의 실효 `required` 와 TS `?`, `nullable` 과 TS 최상위 `| null` 이 어긋나는 모든 필드를 잡는다. `it('OpenAPI 선언과 TS 타입이 어긋난 필드가 없다')` 테스트가 매 backend 테스트 실행마다 이번에 바뀐 83개 필드를 포함해 전체를 재검증하므로, 이 배치 전용 테스트를 추가로 만들 필요는 낮다. `@nestjs/swagger` 별칭 구현(`ApiPropertyOptional` = `ApiProperty({required:false})`)에 대한 캐너리 테스트까지 갖춰 판정 근거 자체의 붕괴도 감지한다.
  - 제안: 없음 (양호).

- **[WARNING]** "`tsc` 가 판정자였다" 는 검증 방법론이 이 배치의 상당수 파일에는 적용되지 않는다 — 엔티티를 그대로 반환하는 컨트롤러는 DTO 타입 체크를 아예 통과하지 않는다
  - 위치: `codebase/backend/src/modules/alerts/alerts.controller.ts` `list()`(line 52, `return { data: rules }`) + `codebase/backend/src/modules/alerts/alerts.service.ts` `list()`(line 14, `Promise<AlertRule[]>`) — 대응 DTO `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` 의 `window`(25행)·`workflowId`(33행)가 이번에 optional→required 로 바뀜. 같은 패턴이 `codebase/backend/src/modules/folders/folders.controller.ts` `findAll()`(line 52, raw `Folder[]` 반환)과 `codebase/backend/src/modules/edges/edges.controller.ts` `findByWorkflow()`(line 55-59, raw `Edge[]` 반환)에도 확인된다.
  - 상세: 이 세 컨트롤러 모두 서비스 메서드가 `Promise<Entity[]>`(TypeORM 엔티티)를 그대로 반환하고, 컨트롤러도 그 값을 가공 없이 감싸 돌려준다. `AlertRuleDto`/`FolderDto`/`EdgeDto` 는 `@ApiOkWrappedArrayResponse(XxxDto, ...)` 데코레이터 인자로만 쓰일 뿐, 어떤 객체 리터럴도 `: XxxDto` 로 annotate 되지 않는다 — 즉 CHANGELOG 가 말하는 "83곳 뒤집고 tsc 에러 0건" 검증은 이 경로들에서 **애초에 발동하지 않는다**(tsc 가 검사할 대입 지점 자체가 없다). `AlertRuleDto.threshold: number` 와 엔티티 `AlertRule.threshold: string`(`numeric` 컬럼)이 이미 갈려 있다는 사실이 이 DTO 가 "문서 전용"이고 실제 반환값과 구조적으로 강제되지 않는다는 것을 보여준다. 오늘 시점에는 TypeORM 이 매핑된 컬럼을 항상(값이 NULL 이어도) 채워 돌려주므로 `window`/`workflowId`/`parentId`/`condition` 등이 실제로 항상 존재하긴 하지만, 이건 tsc 나 테스트가 아니라 "엔티티 컬럼 정의가 우연히 DTO 와 맞다"는 사실에 의존한다. 이 가드(`swagger-dto-contract.spec.ts`)도 DTO 소스 코드만 보고 어느 컨트롤러가 그 DTO 를 실제로 채우는지는 보지 않으므로 이 갭을 못 잡는다.
  - 제안: 이번 PR 을 막을 사안은 아니지만(런타임 동작 불변, 오늘 시점 필드는 실제로 항상 채워짐), 후속으로 (a) 이런 엔티티-패스스루 컨트롤러의 반환 타입을 명시적으로 `Promise<{ data: XxxDto[] }>` 로 annotate해 tsc 가 실제로 구조를 검사하게 하거나, (b) 최소한 대표 엔드포인트 1~2개에 대해 `execution-status-response.dto.spec.ts` 처럼 `buildSwaggerDocument` + 실제 e2e 응답을 대조하는 테스트를 추가해, "엔티티가 이 DTO 계약을 충족한다"는 사실을 코드가 아니라 사람의 판단에만 맡기지 않도록 하는 것을 권장한다.

- **[WARNING]** 유일하게 존재하는 OpenAPI 스키마 레벨 회귀 테스트가 이번 PR 이 바꾼 정확히 그 축(`required`)을 검사하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:110-118` (`it.each([['result'], ['error'], ['durationMs']])('%s 는 null 을 쓰는 형제 필드다 — nullable 이다', ...)`)
  - 상세: 이번 diff 로 `ExecutionStatusDto` 의 `durationMs`·`currentNode`·`context`·`result`·`error` 5개 필드가 `@ApiPropertyOptional`→`@ApiProperty` 로 바뀌어 OpenAPI `required` 가 `false`→`true` 로 뒤집힌다. 그런데 20개 파일 중 유일하게 실제 `SwaggerModule.createDocument()` 를 빌드해 스키마를 검사하는 이 테스트 파일은 `nullable` 만 3개 필드(`result`/`error`/`durationMs`)에 대해 확인할 뿐, `currentNode`·`context` 는 이 `it.each` 목록에 아예 없고, 5개 필드 어디에도 `required` 배열 포함 여부를 단언하지 않는다(테스트 파일에는 `ButtonsContextDto`/`NodeOutputContextDto` 의 `required` 는 검사하지만 — 141~161행 — 그건 이번에 바뀌지 않은 필드다). AST 가드가 소스 레벨 정합은 잡아 주지만, "`@nestjs/swagger` 가 실제로 만드는 문서에 `required` 가 반영됐는가"를 확인하는 계층은 이 파일에서 비어 있다. 이미 `buildSwaggerDocument`/`schemasOf` 인프라가 갖춰져 있어 추가 비용이 낮다.
  - 제안: 위 `it.each` 블록에 `currentNode`/`context` 를 추가하고, `expect(executionStatus.required ?? []).toEqual(expect.arrayContaining([...5개 필드]))` 같은 단언을 보태 이번 PR 이 만든 행위 변화(required 뒤집힘)를 실제 생성 문서 레벨에서도 고정할 것을 권장.

- **[INFO]** 런타임 동작 불변 주장은 근거가 있다 — `class-validator`/`ClassSerializerInterceptor` 미개입 확인
  - 상세: `@ApiProperty`/`@ApiPropertyOptional` 은 Swagger 메타데이터 전용이며 `main.ts`/`app.module.ts` 에 전역 `ClassSerializerInterceptor` 가 없어(grep 결과 0건) 응답 직렬화가 DTO 데코레이터에 의해 강제되지 않는다. 따라서 이번 변경이 wire 포맷을 바꾸지 않는다는 CHANGELOG 주장과 일치하며, e2e 응답 바디 테스트를 갱신할 필요가 없다는 판단도 타당하다.

## 요약

83개 필드에 걸친 이번 변경은 순수 타입/문서 메타데이터 수정이고, 회귀 방지는 이전 PR 에서 이미 만들어진 저장소 전역 AST 가드(`swagger-dto-contract.spec.ts`)가 소스 레벨에서 충분히 재검증한다 — 이 배치 자체에 전용 테스트를 새로 추가하지 않은 판단은 합리적이다. 다만 그 가드와 CHANGELOG 가 내세우는 "tsc 가 83곳을 전부 검증했다"는 근거는 엔티티를 그대로 반환하는 다수의 단순 CRUD 컨트롤러(alerts/folders/edges 등, 확인된 패턴)에는 실제로 적용되지 않는다 — 그 경로들에서는 tsc 가 검사할 DTO-typed 대입 지점 자체가 없고, 오늘 시점 "필드가 항상 채워진다"는 사실은 TypeORM 컬럼 매핑에 우연히 의존한다. 또한 유일한 OpenAPI 문서-생성 레벨 테스트(`execution-status-response.dto.spec.ts`)조차 이번 PR 이 바꾼 정확한 축(`required`)을 단언하지 않는다. 둘 다 오늘 당장의 결함은 아니지만(런타임 동작 불변, 필드는 실측상 항상 존재), 향후 회귀(부분 select, 컬럼 제거 등)를 잡아줄 안전망이 비어 있다는 점에서 후속 조치를 권한다.

## 위험도

LOW
