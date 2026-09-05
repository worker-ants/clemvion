# 성능(Performance) 리뷰

## 범위 요약

이번 변경 셋의 실질 코드는 (1) `audit-logs.service.ts` 의 쿼리 축소 1건, (2) 신규 §5.4
응답-계약 대조 테스트 헬퍼(`response-contract.ts`/`.spec.ts`, `swagger-probe.ts` 는 기존
파일) 및 이를 4개 e2e 스펙에 배선한 것이다. 나머지(`plan/**`, `review/**`)는 문서 산출물이라
성능 관점과 무관해 제외했다.

## 발견사항

- **[INFO]** `AuditLogsService.findAll` 의 `leftJoin`+`addSelect` 축소는 성능 관점에서 순수
  개선이다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:47-48`
  - 상세: `leftJoinAndSelect('al.user','user')` → `leftJoin` + `addSelect(['user.id','user.name','user.email'])` 로
    바뀌면서 `User` 전체 컬럼(26개, `passwordHash`·`totpRecoveryCodes` 등 대용량/민감 필드
    포함) 대신 3개 컬럼만 DB 에서 읽고 직렬화한다. 페이지당 `limit`(기본 20)행 기준으로
    행당 전송·역직렬화·JSON 직렬화 바이트가 크게 줄어든다. 보안 수정이 성능에도 이득인
    드문 경우라 긍정적으로 기록한다. (이 자리의 보안 함의는 security 리뷰 소관이라 여기선
    성능 축만 언급한다.)
  - 제안: 없음(개선 확인).

- **[INFO]** `contractForDto` 는 호출마다 in-process Nest 앱을 통째로 부트스트랩 — 현재는
  안전하게 캐싱되지만 계획된 스윕(56개 DTO) 규모에서 누적 비용이 선형으로 는다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:299-315`
    (`contractForDto`) → `codebase/backend/src/shared/testing/swagger-probe.ts:46-57`
    (`buildSwaggerDocument`: `Test.createTestingModule().compile()` → `createNestApplication()`
    → `app.init()` → `SwaggerModule.createDocument()` → `app.close()`)
  - 상세: 이번 diff 의 4개 e2e 스펙(`audit-logs`, `session-revocation`, `workflow-crud`,
    `workflow-execution`)은 전부 `beforeAll` 에서 한 번만 호출하고 재사용한다 —
    `contractForDto` 의 JSDoc 이 명시한 사용법("`beforeAll` 에서 한 번 부르고 결과를
    재사용할 것") 그대로다. 다만 모듈 metadata 를 `{ controllers: [ProbeController] }` 로
    최소화해 DB 연결 없이 DI 컨테이너만 컴파일하므로 개별 호출 비용 자체는 크지 않다.
    그럼에도 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이 패턴을
    나머지 응답 DTO ~56곳으로 넓히는 것을 다음 작업으로 명시했고, 이 헬퍼에는 DTO 간
    캐싱(메모이제이션)이 없어 스윕이 완료되면 e2e 스위트 전체에 최소 56회의 독립적인
    Nest 부트스트랩이 추가된다. 이미 `architecture.md`(같은 라운드) 가 캐싱 여부의
    파일 간 불일치를 별도로 지적했으므로 중복 등재는 피하되, 성능 축에서는 "지금은 무해,
    스윕 완료 시점엔 CI 시간에 누적 영향" 으로 구분해 둔다.
  - 제안: 스윕 착수 전에 DTO 이름을 키로 한 프로세스-내 메모이제이션(`Map<string, Promise<DtoContract>>`)을
    `response-contract.ts` 에 얹는 것을 검토한다. 같은 Jest worker 안에서 여러 e2e 파일이
    같은 DTO 를 다시 조회하는 경우(예: 목록/상세가 같은 DTO 공유) 중복 부트스트랩을 없앨 수
    있다. 단, Jest 는 파일별로 별도 모듈 레지스트리를 쓰는 경우가 많아 실효 범위는 사전
    확인이 필요하다.

- **[INFO]** `visit()` 이 배열 원소마다 동일한 중첩 스키마에 대해 `required` `Set` 을 매번
  재생성한다 — 점근적으로 무해하지만 회피 가능한 중복 연산
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:172-173`
    (`const required = new Set(schema.required ?? []);`), 호출 경로:
    `descend()`(151-153행, `value.forEach` 로 배열 원소마다 `visit` 재호출) →
    `visit()`(165행)
  - 상세: `children: NestedDto[]` 같은 배열 필드를 대조할 때 `descend` 가 원소마다
    `visit(element, nested, ...)` 을 호출하고, `visit` 은 매 호출마다 같은
    `nested.required` 배열로부터 새 `Set` 을 만든다. 원소 수를 `n` 이라 하면 스키마
    자체의 property/required 목록 크기는 고정이므로 총 작업량은 여전히 `O(n)` 으로
    점근적 복잡도 문제는 아니다. 다만 이 도구가 실 HTTP 응답(잠재적으로 수십~수백 개
    배열 원소를 가진 목록 엔드포인트)을 대상으로 스윕될 예정이라, 원소 수가 커지면
    불필요한 `Set` 재구성이 비례해서 누적된다.
  - 제안: `required` `Set` 을 `schema` 객체 기준으로 (예: `WeakMap<SwaggerSchemaObject, Set<string>>`)
    캐싱하거나, `descend` 가 배열을 순회하기 전에 `nested` 스키마의 `required` `Set` 을
    한 번만 계산해 `visit` 에 옵션으로 전달하도록 리팩터링할 수 있다. 우선순위는 낮음 —
    현재 테스트 픽스처 규모에서는 체감 차이가 없다.

## 요약

프로덕션 코드에 닿는 유일한 변경(`audit-logs.service.ts`)은 select 컬럼을 26개에서 3개로
좁혀 쿼리 I/O·직렬화 비용을 줄이는 순수 성능 개선이며 회귀는 없다. 신규 테스트 헬퍼
(`response-contract.ts`)는 재귀 대조 로직이 배열/중첩 DTO 크기에 선형으로 비례하는 정상
복잡도를 가지며, 배열 원소마다 `required` `Set` 을 재생성하는 미미한 중복 연산이 있지만
현재 테스트 규모에서는 무시할 수준이다. 유일하게 눈여겨볼 지점은 `contractForDto` 가
DTO 당 in-process Nest 앱을 매번 새로 띄운다는 것인데, 이번 PR 은 4곳 모두 `beforeAll`
캐싱 규약을 지켜 문제가 없고, 향후 56개 DTO 스윕이 실행될 때 CI 시간에 미칠 누적 영향만
사전에 검토 대상으로 남긴다. 전반적으로 이번 diff 는 성능 관점에서 안전하고, 감사 로그
쿼리 축소는 오히려 이득이다.

## 위험도

LOW
