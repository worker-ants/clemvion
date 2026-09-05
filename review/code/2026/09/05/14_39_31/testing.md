# 테스트(Testing) 리뷰

## 검증 방법

`codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}`, `audit-logs.service.ts`/`audit-logs.spec.ts`, 4개 e2e 스펙(`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`)을 `Read` 로 현재 저장소 상태 그대로 열어 프롬프트의 diff 게이트와 대조했다. `response-contract.ts` 가 실제로 참조하는 DTO 소스(`execution-response.dto.ts`, `execution-status-response.dto.ts`, `integration-response.dto.ts`, `audit-log-response.dto.ts`)를 직접 열어 `@ApiProperty`/`@ApiPropertyOptional` 선언과 테스트 단언이 실제로 일치하는지 대조했다. 저장소 트리에는 아무것도 쓰지 않았다(읽기만 수행, `git status --short` 변경 없음).

이전 라운드(`review/code/2026/09/05/13_49_54/testing.md`)가 낸 INFO 4건(정렬 미검증·배열 payload 미검증·중첩 `$ref`+`nullable` 미검증·`schemaForDto` 캐싱 비일관)을 현재 `response-contract.spec.ts`/4개 e2e 파일과 대조해 전건 해소를 확인했다 — `'위반은 property 알파벳순으로 나온다'`(재정렬 없는 비교), `it.each` 의 `['배열', [...]]` 케이스, `child`/`children` 중첩 픽스처, 4개 e2e 전부 `beforeAll` 캐싱으로 통일. 회귀 관점에서 이 부분은 양호하다.

## 발견사항

- **[WARNING]** `response-contract.ts` 의 중첩 강하(descend) 로직이 `oneOf`/`anyOf` 를 다루지 않는다 — 이 도구가 원래 잡으려던 것과 같은 종류의 누출을 놓칠 수 있는 미검증 사각지대
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` 의 `PropertyContract` 인터페이스(`nullable`/`$ref`/`allOf`/`items` 만 보유) 및 `referencedName()` 함수(`$ref` 직접 참조와 `allOf` 안의 `$ref` 만 순회)
  - 상세: `referencedName()` 은 프로퍼티 스키마가 `$ref` 를 직접 갖거나 `allOf` 배열 안에 `$ref` 를 가진 경우만 중첩 DTO 로 내려간다. `oneOf`(판별자 없는 닫힌 union)로 선언된 프로퍼티는 두 경우 모두 해당하지 않으므로 `referencedName` 이 `undefined` 를 반환하고 `descend()` 가 조용히 아무 것도 하지 않는다 — 즉 그 프로퍼티 값의 내부 키는 `undeclared`/`missing`/`null` 어떤 위반도 검사받지 않는다.
    이 형태는 이미 실제 코드베이스에 존재하고, 이번 PR 이 배선한 4개 DTO 와 같은 `src/**/dto/responses/**` 디렉터리 아래에 있어 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 명시한 "응답 DTO 60개 중 56개 남음" 스윕의 모집단에 포함된다:
    - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` 의 `ExecutionStatusDto.context` — `@ApiProperty({ oneOf: [{ $ref: ButtonsContextDto }, { $ref: NodeOutputContextDto }], nullable: true })`. `context` 가 채워진 응답이 오면(`waiting_for_input` 상태) 그 안에 `ButtonsContextDto`/`NodeOutputContextDto` 가 선언하지 않은 키(엔티티 패스스루 등)가 실려도 이 검증자는 통과시킨다.
    - `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 의 `data: oneOf` 래핑(`OAuthBeginPopupResultDto`/`OAuthBeginCafe24PendingResultDto`)도 같은 클래스의 문제다.
    `response-contract.spec.ts` 의 `ProbeDto`/`NestedDto`/`CycleDto` 픽스처는 `$ref`·`allOf`(nullable 조합)·배열·순환 참조는 각각 축으로 갖고 있지만 `oneOf` 축은 없다 — 즉 이 사각지대를 잡아 주는 유닛 테스트가 하나도 없다. 이 도구가 애초에 생긴 이유(§5.4 JSDoc 의 "왜 있나" 절)가 "컨트롤러가 엔티티를 그대로 반환하는 경로에서 문서화 안 된 필드가 새 나가는 것을 잡는다" 인데, 정확히 그 케이스가 유니온 분기 뒤에서는 조용히 면제된다. `AuditLogDto.user` 유출(Critical #1)과 같은 성격의 결함이 `oneOf` 분기 뒤에 숨으면 이 검증자가 지금 상태로는 못 잡는다.
  - 제안: (a) `PropertyContract` 에 `oneOf`/`anyOf: readonly PropertyContract[]` 를 추가하고 `referencedName()` 이 그 배열도 순회하도록 확장한다 — 단 판별자 없는 유니온은 "여러 후보 스키마 중 실제로 어느 것이 응답에 왔는지" 를 정적으로 알 수 없으므로, 후보 스키마들의 합집합 프로퍼티에 대해서만 `undeclared` 를 판정(각 스키마의 `required` 는 강제하지 않음)하는 식으로 규칙을 명확히 문서화해야 한다. (b) 최소한 `ProbeDto` 에 `oneOf` 축을 하나 추가해 "지금은 검사하지 않는다"를 실패 테스트가 아니라 **의도된 no-op** 임을 명시하는 캐너리를 남긴다 — 그래야 다음 스윕 착수자가 `ExecutionStatusDto` 를 배선할 때 이 사각지대를 재발견하지 않는다.

- **[INFO]** `AuditLogsService.findAll` 의 join/select 변경 이외 필터 경로(`action`/`resourceType`/`startDate`/`endDate`/`sort`/`order`/페이지네이션)는 여전히 유닛 테스트가 없다 — 이번 diff 가 새로 만든 갭은 아니지만 같은 메서드다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 의 `findAll()`(`getSortColumn` private 메서드 포함) / `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — `userId` 필터와 join/select 만 단언
  - 상세: `getSortColumn()` 의 허용 리스트(`created_at`/`action`/`resource_type`) 밖의 값이 들어왔을 때 `created_at` 으로 폴백하는 경로, `action`/`resourceType`/`startDate`/`endDate` 각각의 `andWhere` 절 추가 경로, `order` 대소문자 변환, `offset`/`limit` 계산은 어느 유닛 테스트에서도 단언되지 않는다. 이번 diff 자체는 이 경로들을 건드리지 않았으므로 회귀 위험은 낮지만, 같은 `qb` mock 이 이미 세워져 있어 각 필터당 한 줄씩 추가하는 비용이 낮다.
  - 제안: 이번 PR 범위는 아니지만, 다음에 이 서비스를 만질 때 `action`/`resourceType`/`startDate`/`endDate`/유효하지 않은 `sort` 값 각각에 대해 `qb.andWhere`/`qb.orderBy` 호출 인자를 단언하는 테스트를 추가한다.

## 좋았던 점 (참고)

- `Critical #1`(감사 로그 `user` 26개 키 유출)에 대해 unit(`qb.leftJoin`/`addSelect` 호출 단언 + `leftJoinAndSelect` 키 부재 단언)과 e2e(계약 대조 + `Object.keys(user).sort()` 독립 캐너리) 두 층에 회귀를 고정했고, `leftJoinAndSelect` 로 되돌리는 뮤테이션이 unit 3건·e2e 1스위트를 즉시 깨뜨리는 것을 RESOLUTION.md 가 실측으로 뒷받침한다 — 판별력이 확인된 회귀 테스트다.
- `response-contract.spec.ts` 는 §5.4 의 네 축(required+non-nullable / required+nullable / 키 생략형 / 키 생략형+nullable)을 한 픽스처(`ProbeDto`)에 전부 모아 각 축을 독립적으로 무는 대조군(`[대조군] 각 규칙이 실제로 무는가`)을 두었고, 스키마가 비어 있으면 통과 자체가 무의미해진다는 vacuous-test 함정을 `[전제]` 테스트로 스스로 방어한다.
- `DtoContract.name` 을 `Dto.name` 에서 파생시켜(문자열 인자 제거) 리네임 시 실패 메시지가 조용히 낡는 문제를 원천 차단한 것은 테스트 용이성 관점에서 좋은 설계다.
- 스키마 생성을 mock 하지 않고 실제 `@nestjs/swagger`/`SwaggerModule.createDocument` 파이프라인을 그대로 태운다 — 데코레이터 조합이 실제로 어떤 OpenAPI 스키마를 내는지와 괴리될 여지가 낮다.

## 요약

이번 diff 는 이전 라운드가 낸 Critical 1건(감사 로그 `user` 필드 26개 유출)을 select 축소로 고치고 unit+e2e 이중 회귀 캐너리로 고정했으며, 같은 라운드의 INFO 4건(정렬·배열 payload·중첩 `$ref`+nullable·`schemaForDto` 캐싱)도 전부 해소를 확인했다 — 회귀 테스트 관점에서 착실하다. 다만 이번 실사에서 새로 발견한 것은, `response-contract.ts` 의 중첩 강하 로직이 `$ref`/`allOf` 만 다루고 `oneOf`/`anyOf` 는 다루지 않는다는 점이다. 이 형태는 이미 `ExecutionStatusDto.context` 등 실제 코드베이스에 존재하고 §5.4 스윕이 명시적으로 겨냥하는 `dto/responses/` 모집단 안에 있어, 판별자 없는 유니온 뒤에 숨은 엔티티 패스스루는 이 검증자가 "통과" 판정을 내려도 실은 검사하지 않은 것일 수 있다 — 이 도구가 막으려던 것과 정확히 같은 성격의 결함이 사각지대에 남는다. 유닛 테스트에도 이 축의 캐너리가 없어 조용히 재발할 수 있다.

## 위험도

MEDIUM
