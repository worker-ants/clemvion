# Architecture Review — workflow-test-datasets

## 발견사항

### [INFO] 모듈 경계 및 단일 책임 원칙 — 양호
- 위치: `workflow-test-datasets/` 전체 디렉토리
- 상세: Controller / Service / Entity / DTO 로 레이어가 명확히 분리되어 있다. Controller 는 HTTP 바인딩·라우팅만 담당하고 비즈니스 로직(권한 검사, clone 이름 생성, UNIQUE 위반 매핑)은 Service 에 집중되어 있다. 단일 책임 원칙이 잘 지켜진다.
- 제안: 없음

### [INFO] 레이어 책임 분리 — 양호
- 위치: `workflow-test-datasets.controller.ts`, `workflow-test-datasets.service.ts`
- 상세: 프레젠테이션 레이어(Controller)는 DTO 변환·HTTP 상태 코드 반환·Swagger 문서화에 집중하고, 비즈니스 레이어(Service)는 권한 모델·가시성 정책·UNIQUE 충돌 처리를 담당하며, 데이터 레이어(Repository + Entity)는 TypeORM 추상화 뒤에 숨겨져 있다. 계층 책임이 명확하다.
- 제안: 없음

### [WARNING] Service 가 Workflow Entity 를 직접 Import — 모듈 경계 약결합 위반
- 위치: `workflow-test-datasets.module.ts` line 4, `workflow-test-datasets.service.ts` line 10
- 상세: `WorkflowTestDatasetsModule` 이 `WorkflowsModule` 을 imports 하지 않고 대신 `TypeOrmModule.forFeature([..., Workflow])` 로 `Workflow` Repository 를 직접 import 하고 있다. 이는 모듈 경계를 우회하여 `workflows` 모듈의 내부 Repository 에 의존하는 패턴이다. `WorkflowsModule` 이 `WorkflowsService` 를 export 하고 있다면, `WorkflowTestDatasetsModule` 은 해당 서비스를 import 해서 워크플로우 존재 검증을 위임하는 것이 더 올바른 모듈 경계이다.
- 제안: `WorkflowsModule` 이 `WorkflowsService` (또는 경량 `WorkflowExistsGuard`)를 export 한다면 `WorkflowTestDatasetsModule.imports` 에 `WorkflowsModule` 을 추가하고, `assertWorkflow` 를 `WorkflowsService.assertExists(id, workspaceId)` 위임으로 교체한다. 현재 코드베이스 전반에서 이 패턴(forFeature 직접 등록)이 관행이라면 INFO 수준으로 강등 가능하다.

### [INFO] findAccessible 의 boolean 플래그 패턴
- 위치: `workflow-test-datasets.service.ts` `findAccessible` 메서드
- 상세: `requireOwner: boolean` 플래그 하나로 "소유자만/조회 가능"의 두 분기를 처리하는 설계다. 현재는 분기가 2개뿐이므로 관리 가능하지만, 향후 가시성 모델이 확장될 경우(예: `team`, `public` 등 추가) 이 플래그가 전략 패턴이나 별도 메서드로 분리되어야 한다. 현 규모에서는 과도한 추상화를 피한 합리적 선택이다.
- 제안: 가시성 레벨이 3개 이상으로 확장되는 시점에 `AccessPolicy` 타입(enum 또는 discriminated union)으로 교체를 고려한다.

### [INFO] Entity 컬럼명과 속성명 불일치 (`data` vs `input`)
- 위치: `workflow-test-dataset.entity.ts` line 50 (`@Column({ name: 'data', ... }) input`)
- 상세: DB 컬럼은 `data` 이고 TypeORM 엔티티 속성은 `input` 이다. 이유(TransformInterceptor 이중 래핑 회피)가 주석으로 충분히 문서화되어 있어 의도적인 결정임이 명확하다. 다만 이 불일치는 향후 QueryBuilder 에서 raw SQL 조건을 작성할 때 혼동을 야기할 수 있다.
- 제안: 현재 주석 수준으로 충분하다. `list` 의 QueryBuilder 가 `d.data` 가 아닌 `d.input` 컬럼명이 필요하다면 TypeORM entity column alias 가 정상 동작하는지 확인한다 (현재 쿼리는 `data` 컬럼을 직접 필터링하지 않으므로 문제없음).

### [INFO] `workspace_id` 비정규화 저장 — 의도적 결정, 아키텍처 일관성 확인 필요
- 위치: `V097__workflow_test_dataset.sql`, `workflow-test-dataset.entity.ts`
- 상세: `workspace_id` 를 `workflow` 테이블에서 비정규화하여 별도 저장한다. 이는 데이터셋 조회/격리 쿼리에서 JOIN 을 줄이는 성능 최적화이고, 마이그레이션 주석에도 명시되어 있다. 그러나 `workflow.workspace_id` 가 변경되는 경우(워크플로우 이동 기능이 존재하거나 향후 추가될 경우) 비정규화 데이터가 stale 해진다.
- 제안: 워크플로우의 워크스페이스 이동이 불가능한 도메인 제약이라면 문제없다. 가능성이 있다면 트리거(SQL) 또는 애플리케이션 레벨에서 sync 전략을 명시한다.

### [INFO] 순환 의존성 — 없음
- 위치: 전체 변경 파일
- 상세: `workflow-test-datasets` 모듈은 `workflows` 모듈 엔티티를 단방향으로만 참조하고, 역방향 참조는 없다. 순환 의존성 없음.

### [INFO] 확장성 — 양호
- 위치: `workflow-test-datasets.service.ts`
- 상세: `TestDatasetVisibility` enum 추가, `toDto` 분리, `saveUnique` 공유 저장 래퍼 패턴은 모두 Open-Closed 원칙에 부합한다. 향후 `team` visibility 추가 시 enum 값과 `findAccessible` 조건만 수정하면 된다. clone 이름 충돌 재시도 전략을 클라이언트 책임으로 명시한 점도 서버 복잡도를 낮추는 합리적 결정이다.

## 요약

`workflow-test-datasets` 모듈은 NestJS 표준 레이어(Controller/Service/Entity/DTO) 분리를 충실히 따르고 있으며, 권한 모델(owner-only write, workspace read-only sharing, clone 패턴)이 Service 레이어에 집중되어 가독성과 테스트 가능성이 높다. 주요 아키텍처 주의 사항은 `WorkflowsModule` 경계를 우회하여 `Workflow` Repository 를 직접 `forFeature` 로 등록한 점(WARNING)이며, 코드베이스 전반의 관행 여부에 따라 허용 가능하다. `workspace_id` 비정규화와 `data`/`input` 컬럼-속성 불일치는 의도적으로 문서화된 설계 결정으로 아키텍처 위험도는 낮다.

## 위험도

LOW
