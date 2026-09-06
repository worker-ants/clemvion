# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `pgErrorConstraint` 의 "제약 이름이 없으면 undefined" 케이스가 `driverError` 표면만 명시적으로 이름 붙여 검증하고, `flat`(top) 표면에서의 같은 시나리오는 파일 하단의 범용 "null/원시값/빈 Error" 테이블에 **우연히** 얹혀서만 커버된다
  - 위치: `codebase/backend/src/common/db/pg-error.spec.ts` — `it('제약 이름이 없으면 undefined …')` 블록(38행 부근, `wrapped(...)` 만 사용) vs `it.each([['null', null], ['원시값', 'boom'], ['빈 에러', new Error('x')]])` 블록(42행 부근)
  - 상세: `pgErrorConstraint` 는 `e.constraint ?? e.driverError?.constraint` 로 구현돼 있다(`codebase/backend/src/common/db/pg-error.ts:46`). "제약 이름이 없으면 undefined" 테스트는 `wrapped({ code: '23505' })` 만 태우므로 `e.driverError` 가 **실제로 존재하는(다만 constraint 키가 없는)** 경로만 확인한다. `e.driverError` 자체가 `undefined` 인 상태(= flat/top 표면에서 constraint 가 없을 때)에 `?.` 없이 `e.driverError.constraint` 로 잘못 고쳐지는 회귀는, 이 라벨이 붙은 테스트가 아니라 그 아래의 "빈 에러"(`new Error('x')`) 케이스가 **우연히** 잡아 준다. 이 PR 이 반복해서 강조하는 원칙("두 표면을 각각 관측해야 한다" — `pg-error.spec.ts` 자신의 파일 헤더 주석, `triggers.service.spec.ts` 의 `it.each([['update','driverError'],['update','top'], …])` 패턴)에 비추면, 이 자리만 표면 축 없이 한쪽 이름으로만 테스트가 붙어 있어 다음 사람이 "표면 커버리지가 있다" 고 오판하기 쉽다. 기능적 구멍은 아니다(현재는 간접적으로 커버됨) — 표시(라벨)와 실제 커버리지 경로가 어긋난다는 가독성 지적이다.
  - 제안: `it.each([['driverError 표면', wrapped(...)], ['최상위 표면', flat(...)]])` 형태로 두 표면을 명시적으로 나란히 두거나, 최소한 이 테스트가 의도적으로 한 표면만 대표로 쓴다는 주석을 남긴다.

## 요약

이번 diff(`User` 엔티티 컬럼 노출 검출 2축 + `pg-error` SoT 추출 + `WorkflowVersionsService.findOne` 투영 + endpoint_path UNIQUE 충돌 계약 + harness YAML 파서 정정)는 이미 다수 리뷰 라운드(`review/code/2026/09/06/10_13_22` ~ `16_29_00`)를 거치며 검출력 0인 술어, fixture 없는 래칫, 반쪽만 관측된 분기 등을 반복적으로 뮤테이션으로 잡아 닫은 상태다. 직접 확인한 결과 다음이 실제로 성립한다: `user-entity-exposure-guard.ts`/`.spec.ts` 는 양성(15개 위반 형태, `relations` 배열·객체·중첩·`as`/`satisfies`·이중 로드 등)과 음성(5개 준수 형태) 대조군을 fixture 로 갖추고 각 분기를 개별 단언으로 관측하며, `EXPECTED_USER_RELATION_LOADS` 화이트리스트·`entityColumnNames().toHaveLength(23)` 카나리아·`CREATOR_PROJECTION` ↔ `WorkflowVersionCreatorDto` OpenAPI 스키마 대조 등은 모두 실측(`grep -c '@Column' user.entity.ts` = 23, `WorkflowVersionCreatorDto` 필드 3개 = `id/name/email`)과 정확히 일치한다. `triggers.service.spec.ts` 의 endpoint_path 충돌 테스트는 `update`/`create` × `driverError`/`top` 표면을 대칭으로 걸고, 다른 UNIQUE 위반·비-UNIQUE 오류가 그대로 흘러가는 반대 방향 대조군도 갖췄다. `pg-error-fixtures.ts` 공유 헬퍼로 `pg-error.spec.ts`·`triggers.service.spec.ts` 가 표면 fixture 를 중복 재구현하지 않는다. `.claude/tests/test_review_guard.py` 의 YAML 파서 회귀 테스트 11건은 주석·빈 줄·다음 키 정지·트레일링 주석·인용부호 안팎·닫는 따옴표 부재·공백 없는 `#` 까지 양방향(넓힘/좁힘) 대조군을 갖춰 라벨과 실제 코드가 일치함을 직접 대조 확인했다. 새 e2e(`workspace-rbac.e2e-spec.ts` J., `workflow-crud.e2e-spec.ts` H., `audit-logs.e2e-spec.ts`)는 이름 축(`expectNoUserSecrets`)과 계약 축(`assertMatchesContract`)을 실행 순서까지 의도적으로 배치(이름 축을 먼저 두어 계약 축이 선점하지 않게)했다. 각 서비스 spec(`workspaces.service.spec.ts`, `workflow-versions.service.spec.ts`)은 NestJS 테스트 모듈을 매 테스트마다 새로 컴파일해 mock 이 격리되며, 발견한 유일한 항목은 `pg-error.spec.ts` 한 곳에서 테스트 라벨이 실제 커버리지 경로와 미묘하게 어긋나는 가독성 지적(기능 결함 아님)뿐이다.

## 위험도

NONE
