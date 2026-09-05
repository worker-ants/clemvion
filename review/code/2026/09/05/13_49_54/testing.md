# 테스트(Testing) 리뷰

## 대상 요약

- `codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}` — §5.4(API 응답 vs DTO 선언) 계약 검증 헬퍼 신설 + 유닛 스펙 18개.
- `codebase/backend/test/{audit-logs,session-revocation,workflow-crud,workflow-execution}.e2e-spec.ts` — 위 헬퍼를 각 1개 엔드포인트 응답에 배선(4개 DTO: `AuditLogDto`/`SessionDto`/`WorkflowDto`/`ExecutionDto`).
- `plan/in-progress/*.md`, `review/consistency/**` — 문서/추적 산출물(테스트 관점에서 직접 리뷰 대상 아님, 코드 없음).

검증 방법: 유닛 스펙은 실제로 `npx jest src/shared/testing/response-contract.spec.ts` 로 실행해 18/18 통과를 확인했다. `nullable`+`$ref` 중첩 조합(`AuditLogDto.user`)의 실제 생성 스키마 형태는 스크래치 디렉터리(저장소 트리 밖)에 별도 probe 스펙을 만들어 `--roots`/`--testRegex` CLI 오버라이드로 실행해 실측했다(`git status --short` 로 저장소 무변경 확인 완료). 원본 저장소 파일은 전혀 수정하지 않았다.

## 발견사항

- **[INFO]** `findContractViolations` 의 내부 정렬(`out.sort(...)`)이 실질적으로 미검증 — 테스트가 항상 재정렬 후 비교해 마스킹한다
  - 위치: `codebase/backend/src/shared/testing/response-contract.spec.ts` 게이트 134~141행("여러 위반이 한 번에 다 나온다 — 첫 건에서 멈추지 않는다" 테스트) / `codebase/backend/src/shared/testing/response-contract.ts` 게이트 141행(`return out.sort((a, b) => a.property.localeCompare(b.property));`)
  - 상세: 위반이 여러 건 나오는 유일한 테스트가 `kinds(findContractViolations(...)).sort()` 처럼 결과를 **테스트 쪽에서 다시 정렬**한 뒤 `toEqual` 로 비교한다. 실제 구현이 `property.localeCompare` 로 정렬해 반환하는 목적(진단 메시지의 결정적 순서 — `formatViolations` 출력이 매번 같은 순서가 되게 하려는 설계 의도로 보임)이 있는데, 이 순서 자체를 검증하는 테스트가 없다. `findContractViolations` 마지막 줄의 `.sort(...)` 호출을 통째로 지워도(뮤테이션) 현재 18개 테스트는 전부 그대로 통과한다 — 다건 위반 케이스에서 항상 테스트가 자체적으로 재정렬하기 때문이다.
  - 제안: 정렬을 검증하려면 `.sort()` 없이 원본 순서 그대로 `toEqual` 하거나, 별도로 "입력 순서와 무관하게 출력이 항상 property 알파벳순" 임을 직접 단언하는 케이스를 하나 추가한다(현재 재정렬 단언은 남겨 두어도 무방하나 최소 1건은 무재정렬 비교가 필요).

- **[INFO]** `findContractViolations` 의 "payload 가 객체가 아닌 경우" 스위트가 배열(Array) 케이스를 다루지 않는다
  - 위치: `codebase/backend/src/shared/testing/response-contract.spec.ts` 게이트 144~154행(`describe('payload 가 객체가 아닌 경우', ...)`, `it.each`) / 로직은 `response-contract.ts` 게이트 79행(`if (payload === null || typeof payload !== 'object')`)
  - 상세: `it.each` 는 `null`/`'str'`(원시값)/`undefined` 세 가지만 커버한다. 배열은 `typeof === 'object'` 이므로 이 최상위 가드를 통과해 `Object.entries(props)`/`Object.keys(body)` 로직으로 흘러 들어간다 — 그 경우 배열의 숫자 인덱스가 전부 `undeclared` 위반으로 잡히는(혹은 스키마에 `0`,`1`... 프로퍼티가 없으니 전부 위반) 의도치 않은 경로가 된다. 실제 4개 e2e 호출부는 전부 단일 레코드(`rows[0]`, `sessions[0]`, `mine`)만 넘겨 오늘 당장의 리스크는 낮지만, 이 헬퍼가 §5.4 drift 2단계(`spec-draft-nullable-notation-followups.md`)에서 나머지 56개 DTO 로 스윕될 예정이라는 점을 고려하면, 호출부가 실수로 배열 전체(`items`)를 넘기는 오용을 이 유닛 스펙이 방어적으로 잡아 주지 못한다.
  - 제안: `it.each` 목록에 `['배열', []]` 또는 `['배열(비어있지 않음)', [1,2]]` 케이스를 추가해 배열도 "payload 가 아니다" 로 분류되는지(또는 명시적으로 다른 처리를 받는지) 확정해 둔다.

- **[INFO]** 중첩 `$ref` + `nullable` 조합(예: `AuditLogDto.user`)의 "null/부재" 분기가 유닛·e2e 어느 쪽에도 걸리지 않는다
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts` 게이트 75~80행(`assertMatchesDtoSchema(rows[0], await schemaForDto(AuditLogDto), 'AuditLogDto')`) / 대상 필드는 `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` 의 `user?: AuditLogUserDto | null` (`@ApiPropertyOptional({ type: () => AuditLogUserDto, nullable: true })`)
  - 상세: `response-contract.spec.ts` 의 `ProbeDto` 픽스처는 네 축을 전부 스칼라 필드로만 구성한다(중첩 DTO 참조가 없다). 실제로 배선된 4개 DTO 중 `AuditLogDto` 만 유일하게 `type: () => X` 형태의 중첩 `$ref` + `nullable` 조합을 갖는데, `audit-logs.e2e-spec.ts` 의 시드 데이터는 `INSERT INTO audit_log (..., user_id, ...) VALUES (..., $2, ...)` 로 항상 실존 `ownerUserId` 를 심고, 서비스가 `leftJoinAndSelect('al.user', 'user')` 로 조인하므로 `rows[0].user` 는 **항상 채워진 객체**다 — `user` 가 `null`(탈퇴 사용자 등)이거나 키 자체가 생략되는 분기는 이 테스트가 절대 통과시키지 않는다.
    실측: 저장소 밖 scratch 디렉터리에서 별도 probe 스펙으로 확인한 결과, 이 필드의 실제 생성 스키마는 `{"nullable":true,"type":"object","allOf":[{"$ref":"#/components/schemas/AuditLogUserDto"}]}` 로, `nullable` 이 `allOf`/`$ref` 와 나란한 sibling key 로 나온다 — 즉 `PropertyContract.nullable` 을 직접 읽는 현재 로직(`response-contract.ts` 게이트 100행)은 **오늘은 정확히 동작한다.** 다만 그 사실을 확인하는 자동화된 테스트가 없다는 것이 이 발견의 요지다 — `@nestjs/swagger` 버전이 바뀌어 이 표현 방식(sibling nullable vs `oneOf`/`anyOf` wrapping)이 달라지면, 이 특정 조합만 조용히 깨지고 어떤 테스트도 그것을 잡지 못한다.
  - 제안: `ProbeDto` 에 중첩 DTO 참조 필드(스칼라 축 4개 외 5번째 축)를 하나 추가하거나, `audit-logs.e2e-spec.ts` 에 `user` 가 `null` 인 케이스(탈퇴 사용자로 시드 후 조회)를 별도 케이스로 추가해 이 분기를 실제로 밟게 한다.

- **[INFO]** `schemaForDto` 호출 패턴이 파일마다 갈린다 — 성능·가독성 일관성 문제
  - 위치: `codebase/backend/test/workflow-execution.e2e-spec.ts` 게이트 60~68행(`beforeAll` 에서 1회 `executionSchema = await schemaForDto(ExecutionDto)`) vs `codebase/backend/test/audit-logs.e2e-spec.ts` 게이트 71~80행, `session-revocation.e2e-spec.ts` 게이트 103~111행, `workflow-crud.e2e-spec.ts`(`it('A. ...')` 내부) — 이 셋은 매 `it()` 블록 안에서 매번 새로 `schemaForDto(...)` 를 호출한다
  - 상세: `schemaForDto` 는 호출마다 `Test.createTestingModule(...).compile()` → `app.init()` → `SwaggerModule.createDocument(...)` → `app.close()` 를 도는 무거운 작업이다(`swagger-probe.ts`). 기능적 결함은 아니고 각 스위트가 해당 DTO 를 1회씩만 대조하므로 오늘 비용은 미미하지만, 같은 헬퍼를 도입하면서 한 파일만 `beforeAll` 캐싱 패턴을 쓰고 나머지 셋은 인라인 호출로 남긴 것은 §5.4 drift 2단계 스윕(56개 DTO 추가 예정, `spec-draft-nullable-notation-followups.md` 참조)에서 그대로 복제되면 스위트당 테스트 수가 늘 때 선형으로 비용이 쌓이는 패턴이 굳어질 수 있다.
  - 제안: 스윕 착수 전에 "DTO 스키마는 `beforeAll` 에서 1회만 얻는다" 관례를 정해 두면 이후 착수자들이 패턴을 반복 조사할 필요가 없다.

## 좋았던 점 (참고)

- `response-contract.spec.ts` 의 `[전제] 스키마가 네 축을 실제로 담고 있다` 테스트는 "캐너리가 전부 통과해도 스키마가 비어 있으면 아무것도 검사하지 않은 것" 이라는 vacuous-test 함정을 스스로 문서화하고 방어한다 — 좋은 관례다.
- 스키마 생성이 mock 이 아니라 실제 `@nestjs/swagger`/`SwaggerModule.createDocument` 파이프라인을 그대로 태우므로(스텁 컨트롤러 하나만 최소한으로 사용), 데코레이터 조합이 실제로 어떤 OpenAPI 스키마를 내는지와 괴리될 여지가 거의 없다. `Mock 적절성` 관점에서 양호.
- 4개 e2e 스위트 모두 기존의 unique email/name 기반 격리 패턴을 그대로 따르며 새로 추가된 단언도 그 안에 자연스럽게 끼워져 있어 테스트 간 의존성을 새로 만들지 않는다.
- `assertMatchesDtoSchema` 의 실패 메시지 정규식 단언(`/ProbeDto.*1건[\s\S]*id \[missing\]/`)은 DTO 이름·건수·필드명이 실패 메시지에 실제로 담기는지를 검증하면서도 정확한 줄바꿈 형식까지 고정하지 않아 과도하게 깨지기 쉬운 테스트를 피했다.

## 검증 한계 (명시)

- e2e 스위트 4개(`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`)는 Docker 기반 실 인프라(DB·backend 컨테이너)가 필요해 이 리뷰 환경에서 실제로 실행해 통과 여부를 재확인하지 못했다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 개발자가 기록한 뮤테이션 근거("네 자리 모두 payload 를 `{}` 로 바꾼 뮤턴트가 그 자리만 RED 를 냈다, 51개 중 1개→3개")는 신뢰할 만한 관례(빈 페이로드 뮤턴트로 각 단언이 실제로 무는지 확인)이지만, 이 리뷰가 독립적으로 재실행해 확인한 것은 아니다.
- 유닛 스펙(`response-contract.spec.ts`)만 `npx jest` 로 직접 실행해 18/18 통과를 확인했다.

## 요약

신설된 §5.4 계약 검증 헬퍼(`response-contract.ts`)는 유닛 스펙이 vacuous-test 함정을 스스로 방어하는 캐너리 테스트를 포함하는 등 견고하게 설계됐고, mock 을 최소화해 실제 스키마 생성 파이프라인을 그대로 태우는 방식도 적절하다. e2e 4개 스위트로의 배선도 기존 격리 패턴을 해치지 않고 자연스럽게 얹혔다. 다만 (1) 다건 위반의 반환 순서 정렬 로직이 테스트 쪽 재정렬 때문에 사실상 미검증이고, (2) 배열 payload 오용 케이스, (3) 중첩 `$ref`+`nullable` 조합의 null/부재 분기가 유닛·e2e 어느 쪽으로도 실제로 밟히지 않는 점(실측으로 현재는 정상 동작함을 확인했으나 회귀를 잡을 테스트는 없음) 은 이번 스윕이 56개 DTO 로 확장되기 전에 보강할 가치가 있는 좁은 커버리지 갭이다. 전부 INFO 수준이며 병합을 막을 사유는 없다.

## 위험도

LOW
