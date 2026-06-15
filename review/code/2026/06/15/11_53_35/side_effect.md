# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 신규 DB 마이그레이션에 의한 스키마 영구 변경 (의도된 부작용)
- 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql`
- 상세: `workflow_test_dataset` 테이블 신규 생성. `workflow`, `user`, `workspace` 세 테이블에 ON DELETE CASCADE FK 를 건다. 워크플로우/유저/워크스페이스 삭제 시 해당 데이터셋이 연쇄 삭제되는 부작용이 발생한다. 이는 주석에 명시된 의도된 동작이지만, 기존 `workflow`, `user`, `workspace` DELETE 경로 테스트가 이 새 연쇄 삭제를 커버하는지 확인이 필요하다.
- 제안: 기존 워크플로우/유저/워크스페이스 삭제 e2e 테스트에 `workflow_test_dataset` 행이 정리되는지 검증 케이스 추가를 권고한다.

### [INFO] ROOT_ENTITIES 배열에 신규 엔티티 추가 — 전역 TypeORM 메타데이터 변경
- 위치: `codebase/backend/src/database/root-entities.ts`, `codebase/backend/src/app.module.ts`
- 상세: `ROOT_ENTITIES` const 배열(모듈 전역 공유 상수)에 `WorkflowTestDataset` 가 추가된다. NestJS 부트스트랩 시 TypeORM이 이 배열 전체를 메타데이터로 등록하므로, 배열 변경은 애플리케이션 전체의 ORM 메타데이터 레지스트리에 영향을 준다. 단, 이는 신규 엔티티 추가 시 표준 절차이며 `as const` 로 불변 보장된다. 의도하지 않은 부작용 없음.
- 제안: 없음. `app.module.spec.ts` 의 cardinality guard 가 drift 를 방지하고 있어 충분하다.

### [INFO] `WorkflowTestDatasetsModule` 이 `WorkflowsModule` 과 별도로 `Workflow` 엔티티 repo 를 직접 import
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.module.ts` (line: `TypeOrmModule.forFeature([WorkflowTestDataset, Workflow])`)
- 상세: `WorkflowsModule` 을 import 하지 않고 `Workflow` 엔티티를 직접 `forFeature` 에 등록한다. NestJS/TypeORM 에서는 이 방식이 허용되지만, `WorkflowsModule` 이 `Workflow` repository 에 커스텀 훅·리스너·subscriber 를 등록하는 경우 해당 side effect 가 이 모듈의 repo 인스턴스에는 적용되지 않을 수 있다. 현재 코드에서는 `assertWorkflow` 내의 단순 `findOne` 조회만 사용하므로 실질적 문제가 없다.
- 제안: `Workflow` 에 subscriber/listener 가 추가되는 경우 이 모듈의 독립 import 패턴을 재검토한다.

### [WARNING] `update()` 메서드에서 entity 객체 직접 변이(mutation) 후 save
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts`, line 1741-1743
- 상세: `findAccessible()` 로 반환된 entity 인스턴스의 필드를 직접 변경(`entity.name = dto.name` 등)한 후 `saveUnique(entity)` 를 호출한다. TypeORM의 `save()` 는 이 entity 인스턴스를 UPDATE 쿼리로 flush 하는데, `saveUnique` 내부에서 `QueryFailedError` (UNIQUE 위반)가 throw 되면 entity 인스턴스는 이미 변경된 상태로 남는다. 동일 인스턴스가 상위 스코프에서 재사용될 경우 부분적으로 변이된 상태가 노출될 수 있다. 현재 구현에서는 `update()` 의 `entity` 가 에러 시 버려지므로 실질적 문제는 없으나, 방어적 코딩 관점에서 잠재 위험이다.
- 제안: 변이 전 `Object.assign({}, entity, updateFields)` 로 shallow copy 를 만들어 save 하거나, TypeORM `save()` 에 partial object 를 직접 전달하는 패턴을 사용하면 의도치 않은 상태 오염을 방지할 수 있다.

### [INFO] `clone()` 에서 source.input 객체 참조를 복사본에 그대로 전달
- 위치: `workflow-test-datasets.service.ts`, `clone()` 메서드 내 `input: source.input`
- 상세: `source.input` (JSONB에서 역직렬화된 `Record<string, unknown>`)의 참조를 clone entity 에 그대로 전달한다. TypeORM `save()` 가 직렬화하기 전에 두 entity 가 동일 객체를 참조하는 순간이 있다. 이는 TypeScript/Node.js 프로세스 내 메모리 참조일 뿐이며 실제 DB write 에는 각각 독립적 직렬화가 발생하므로 실질적 부작용은 없다.
- 제안: 없음. 허용 가능한 패턴.

### [INFO] e2e 테스트에서 `process.env.E2E_BASE_URL` 환경 변수 읽기
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts`, line `const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011'`
- 상세: `E2E_BASE_URL` 환경 변수를 읽는다. 쓰기는 없으며 기존 다른 e2e 테스트와 동일한 패턴이다. 의도치 않은 부작용 없음.
- 제안: 없음.

### [INFO] e2e 테스트 `beforeAll` 에서 외부 HTTP 요청 및 DB 연결 발생
- 위치: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts`, `beforeAll` 블록
- 상세: `db.connect()` (PostgreSQL 직접 연결), `registerAndLogin`, `createTeamWorkspace`, `inviteAndAccept`, 워크플로우 생성 API 호출 등 실제 외부 서비스 호출이 다수 발생한다. 이는 e2e 테스트의 표준 패턴이며 `beforeAll` 의 90초 타임아웃도 명시되어 있다. 단, DB 연결이 `afterAll` 에서 `db.end()` 로 정리되는지 확인이 필요하다.
- 제안: `afterAll` 에서 `db.end()` 호출이 누락된 경우 연결 누수가 발생할 수 있다. 현재 제공된 코드에서 `afterAll` 블록이 보이지 않으므로, e2e 파일에 `afterAll(() => db.end())` 가 있는지 확인 권고.

### [INFO] 공개 API 신규 노출 — 기존 클라이언트 영향 없음
- 위치: `workflow-test-datasets.controller.ts` (5개 엔드포인트 신규 등록)
- 상세: `GET /api/workflows/:workflowId/test-datasets`, `POST /api/workflows/:workflowId/test-datasets`, `PATCH /api/test-datasets/:id`, `DELETE /api/test-datasets/:id`, `POST /api/test-datasets/:id/clone` 가 새로 추가된다. 기존 엔드포인트를 변경하지 않으므로 기존 클라이언트에 대한 breaking change 없음.
- 제안: 없음.

## 요약

이번 변경은 `workflow_test_dataset` 기능의 완전 신규 도입이다. 기존 코드 경로의 시그니처 변경이나 전역 상태 변경은 없으며, `ROOT_ENTITIES` 배열 확장과 `AppModule` 에 신규 모듈 추가는 표준 NestJS 패턴을 따른다. 가장 주목할 부작용은 SQL 마이그레이션의 ON DELETE CASCADE — `workflow`, `user`, `workspace` 삭제 시 데이터셋이 연쇄 삭제되므로 기존 삭제 경로 테스트가 이 정리 동작을 암묵적으로 커버하는지 확인이 필요하다. `update()` 에서의 entity 직접 변이는 현재 구현 범위에서 문제가 없으나 방어적으로 개선 가능하다. e2e 테스트의 DB 연결 해제(`afterAll`) 누락 여부도 점검이 필요하다.

## 위험도

LOW
