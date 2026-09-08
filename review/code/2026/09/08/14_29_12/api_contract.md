# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정 확장 — raw 표면(`err.code`) 23505 가 이제 모든 엔드포인트에서 500 대신 409 `RESOURCE_CONFLICT` 로 응답한다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` 함수 `catch()`, `} else if (isPostgresUniqueViolation(exception)) {` 분기 (파일 내 라인 70 부근)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해, TypeORM 이 감싸지 않은 raw 표면(`err.code === '23505'`) 오류는 이 분기를 타지 못하고 500 `INTERNAL_ERROR` 로 응답됐다. 신설 `isPostgresUniqueViolation`(`codebase/backend/src/common/db/pg-error.ts`)은 `instanceof` 검사 없이 `err.code ?? err.driverError?.code` 두 표면만 보므로, `@Catch()` 전역 필터를 거치는 **모든** 엔드포인트에 이 분기가 적용된다. 국소 처리가 없는 서비스가 raw query 로 23505 를 내면 응답이 500→409 로 바뀐다. 회귀는 양방향 테스트(`http-exception.filter.spec.ts` 신설 두 케이스, raw 23505→409 / raw 23502→500 불변)로 고정되어 있고, plan(`plan/in-progress/spec-followups-batch-b.md` B-3, `spec-draft-nullable-notation-followups.md`)이 "현재 blast radius ~0 — 우리 스키마를 치는 raw query 가 요청 경로에 없다"고 실측·명시한다. 스펙 방향(§1.10 계열, unique 위반=409)에도 부합하는 의도된 버그 수정이다. 다만 상태 코드가 **전역적으로** 바뀌는 변경이므로, 만약 이 필터 뒤에서 500 을 재시도 트리거로 쓰던 클라이언트/모니터링이 있다면 관측치가 달라질 수 있다는 점은 참고할 가치가 있다.
  - 제안: 현재 조치로 충분(의도된 수정 + 회귀 테스트 존재). `CHANGELOG.md` 에 이미 등재돼 있어 추가 조치 불요.

- **[INFO]** `listMembers` 를 DB 레벨 `select` 투영으로 전환 — 응답 wire 스키마(필드 이름·타입) 는 그대로 유지되어 breaking change 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 함수 `listMembers()` — `select` 절 추가, 반환 `.map()` 바로 아래
  - 상세: 쿼리가 `relations: ['user']` + 전체 컬럼 로드에서 `relations: ['user']` + `select: { id, userId, role, joinedAt, user: { id, email, name } }` 병행으로 좁혀졌지만, 뒤따르는 `.map()` 이 만드는 응답 객체(`id, userId, email, name, role, joinedAt`)는 변경 전과 동일하다(직접 확인). 신설 단위 테스트가 `memberRepo.find` 호출 인자의 `select.user` 형태(`{id:true,email:true,name:true}`, 불리언이 아닌 객체)까지 단언해, 투영이 되돌려져도 반환 키 단언만으론 못 잡던 회귀를 봉쇄한다. API 계약 관점에서는 순수 방어 심화(검출→강제)이고 클라이언트 영향 없음.
  - 제안: 없음(확인 사항).

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 백엔드 내부 타입 개명 — wire 응답에 영향 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 타입 선언부 및 `findOne()` 반환 타입
  - 상세: 이 타입은 컨트롤러 응답 타입이나 Swagger DTO 데코레이터와 직접 연결되지 않는 서비스 내부 타입이며, 참조처는 선언·`findOne` 반환 타입 두 곳뿐이다(`.spec.ts` 제외). 프런트엔드 동명 미러 타입(`codebase/frontend/src/lib/api/workflows.ts` `WorkflowVersionDetail`)은 이번 diff 에서 JSDoc 만 갱신되고 필드는 불변이며, 두 타입의 형태 차이(`creator` optional/nullable vs 3필드 고정, `createdAt` string vs Date)는 이 PR 이전부터 있던 것으로 이번에 새로 만든 불일치가 아니다(백엔드가 더 좁아 런타임 오류 방향 위험 없음). 순수 리네임이라 API 계약 변경 아님.
  - 제안: 없음. 두 타입을 실제로 합치려면 wire 계약(`Date` vs `string`, nullable 여부) 정합화가 선행돼야 한다는 점은 plan 에 이미 기록돼 있어 추적 가능.

- **[INFO]** 트리거 `endpoint_path` 409 충돌 경로에 e2e 계약 검증 신설 — §1.10 wire 형태(상태 코드·`error.code`·`details` 객체·드라이버 원문 비노출)를 실 DB 경로로 고정, 스펙과 정합 확인
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` 신규 `it('B4. …')` 블록
  - 상세: `spec/5-system/3-error-handling.md §1.10` 을 직접 열어 대조한 결과, 스펙이 규정하는 형태(`error.code='RESOURCE_CONFLICT'`, `error.details={field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}`)와 신설 테스트의 단언이 정확히 일치한다. `details` 를 부분 필드가 아니라 `{field, code}` 객체 전체로 `toEqual` 단언하고(하나만 보면 다른 키 유실을 놓친다), `JSON.stringify(dup.body)` 에 `'duplicate key'` 가 없는지도 함께 검사해 드라이버 원문 비노출(CWE-209) 축까지 포괄한다. 단위 mock 이 아니라 실 UNIQUE 제약을 밟는 유일한 경로라 계약 검증 커버리지가 실질적으로 개선됐다.
  - 제안: 없음 — 긍정적 강화.

- **[INFO]** `integration-oauth.service.ts` 의 두 콜백에서 손-작성 constraint 추출을 `pgErrorConstraint()` 로 치환 — 로직 동치, 동작 변경 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (두 `catch` 콜백, `STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 비교 직전)
  - 상세: 종전 인라인 `(err as {...}).constraint ?? (err as {...}).driverError?.constraint` 와 신설 `pgErrorConstraint(err)`(`common/db/pg-error.ts`)의 구현을 직접 대조 확인 — 두 표면(flat/wrapped) 을 같은 순서(`??`)로 흡수해 동치다. 짝을 이루는 두 spec 파일(cafe24/makeshop)이 `it.each` 로 flat·wrapped 두 표면을 모두 확인하도록 확장돼, 409 `*_ALREADY_CONNECTED` 매핑이 TypeORM 실제 wrap 형태(`driverError.*`)에서도 성립함을 실측 검증한다. API 계약(에러 코드·상태) 변경 없음, 커버리지만 개선.
  - 제안: 없음.

## 요약

이번 배치의 실질적인 API 표면 변경은 하나다 — `GlobalExceptionFilter` 가 지역 `isUniqueViolation`(QueryFailedError-only) 대신 SoT `isPostgresUniqueViolation`(`pg-error.ts`)를 쓰도록 통합되면서, raw 표면 23505 오류가 모든 엔드포인트에서 500→409 로 바뀐다. 현재 그 raw-표면 경로를 타는 요청이 없어 즉시 영향(blast radius)은 0 으로 실측·문서화돼 있고 양방향 회귀 테스트로 고정됐으므로 breaking change 로 보기는 어렵지만, 상태 코드 매핑이 넓어지는 전역적 동작 변경이라는 성격은 기록해 둔다. 나머지 변경 — `listMembers` DB 투영 전환, `WorkflowVersionDetail`→`…Projection` 개명, `integration-oauth.service.ts` 의 constraint 추출 헬퍼화 — 은 모두 wire 응답 스키마·에러 코드·인증/인가·URL 설계에 영향을 주지 않는 내부 리팩터이며, 직접 스펙(§1.10)과 대조 확인한 신설 트리거 409 e2e 는 에러 봉투 계약(코드·`details` 객체 형태·비노출)의 실측 커버리지를 정확히 개선한다. 페이지네이션·버전 관리·요청 검증 축에는 이번 diff 에서 변경된 표면이 없다. 하위 호환성·응답 형식·인증/인가 관점에서 breaking change 나 누락된 검증은 발견되지 않았다.

## 위험도

LOW
