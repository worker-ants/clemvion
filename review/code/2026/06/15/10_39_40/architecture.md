# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] WorkflowTestDatasetsModule — workspace_id 비정규화 전략의 레이어 책임
- 위치: `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` `workspaceId` 컬럼 / `codebase/backend/migrations/V097__workflow_test_dataset.sql`
- 상세: `workspace_id` 를 `workflow` 테이블로부터 비정규화해 저장하는 설계는 SQL 주석과 엔티티 JSDoc 에 "workflow 의 workspace 에서 채움"이라 명시되어 있다. 이 채우기 로직이 실제로 서비스 레이어(WorkflowTestDatasetsService)에서 수행될 때, 서비스가 `Workflow` 레포지토리를 직접 참조해야 한다. `workflow-test-datasets.module.ts` 가 `TypeOrmModule.forFeature([WorkflowTestDataset, Workflow])` 로 `Workflow` 엔티티를 임포트하고 있어 이 결합이 이미 형성되어 있다. 구현 diff 에 서비스 본체가 생략돼 있으나(`... (diff omitted due to prompt size limit) ...`), `WorkflowTestDatasetsModule` 이 `WorkflowsModule` 또는 `WorkflowsService` 를 imports/providers 에 명시하지 않고 직접 `Workflow` 엔티티 레포지토리만 가져오는 구조다. 이는 두 도메인 간 경계를 모듈 수준이 아닌 엔티티 레포지토리 수준에서 직접 교차하는 패턴으로, 향후 `Workflow` 로딩 로직 변경 시 `workflow-test-datasets` 모듈이 영향을 받는 묵시적 결합이 된다.
- 제안: `WorkflowsModule` 이 `WorkflowsService` (또는 `findWorkspaceId` 같은 제한된 인터페이스)를 `exports` 하고, `WorkflowTestDatasetsModule` 이 이를 `imports` 로 가져오는 방식으로 모듈 경계를 명시화하는 것이 SRP/DIP 관점에서 더 명확하다. 현 규모에서 즉시 리팩토링이 필요한 수준은 아니나 도메인 경계 확장 시 고려 대상.

### [INFO] `FormModalField` 에서 `min`/`max`/`pattern` 제거 — 추상화 수준 역전 가능성
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` (파일 7, 삭제 diff) / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (파일 8, docstring 갱신)
- 상세: 이번 PR 은 `FormModalField` 인터페이스에서 `min?`/`max?`/`pattern?` 를 제거하고, `execution-engine` docstring 에서도 이 필드들을 "미적용(Planned)" 목록으로 되돌렸다. 이는 이전 A-1 PR(form-validation-minmax-pattern)에서 추가했던 사항을 역행하는 것으로, 두 PR 이 같은 브랜치 히스토리에 포함된다면 A-1 변경이 revert 된 것이다. 아키텍처 관점에서 `FormModalField` 는 chat-channel 의 form 처리 추상화인데, 이 타입을 execution-engine 의 `assertFormSubmissionValid` 가 재사용하는 구조에서 타입의 필드 집합이 축소되면 두 레이어 간 계약이 암묵적으로 변경된다. `spec-sync-form-gaps.md` 의 해당 항목이 `[x]` 에서 `[ ]` 로 되돌려진 것을 보면 의도적인 revert 임이 확인된다.
- 제안: 이 변경이 의도된 revert 라면 문서 일관성을 위해 plan 파일 항목도 정확히 미구현 상태로 복원된 배경을 기록하는 것이 좋다. 두 PR 이 병렬로 작업되다 충돌한 경우라면 `FormModalField` 의 필드 집합이 단일 진실 소스임을 명확히 하고, 추상화 경계(chat-channel 내부 타입 vs execution-engine 에서 직접 사용)를 검토할 필요가 있다.

### [INFO] WorkflowTestDatasetsController — 중첩 라우트와 단독 라우트 혼재 패턴
- 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` (파일 13, diff 생략) / `codebase/frontend/src/lib/api/workflow-test-datasets.ts` (파일 20)
- 상세: 프론트엔드 API 클라이언트(`workflow-test-datasets.ts`)를 보면 `list`/`create` 는 `/workflows/:id/test-datasets` 경로(워크플로우 하위 중첩), `update`/`remove`/`clone` 은 `/test-datasets/:datasetId` 경로(최상위 독립)로 구분되어 있다. 이 라우트 분리는 REST 설계상 합리적이나, 단일 컨트롤러가 두 가지 라우트 계층을 처리하면 모듈 경계와 라우트 네임스페이스가 분산된다. 컨트롤러 diff 가 생략되어 백엔드 실제 구현을 확인할 수 없으나, `@nestjs/common` 의 `@Controller()` 가 두 접두사를 동시에 커버하려면 설계 방식에 따라 코드 분산이 발생할 수 있다.
- 제안: 현 REST 관례상 이 패턴은 허용 가능하다. 단, 컨트롤러 내에서 두 라우트 그룹의 가드·파이프·인터셉터 적용이 일관적으로 관리되는지 확인 필요.

### [INFO] 프론트엔드 API 타입 중복 — `TestDatasetVisibility`
- 위치: `codebase/frontend/src/lib/api/workflow-test-datasets.ts` L4 / `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` `TestDatasetVisibility` enum
- 상세: 백엔드의 `TestDatasetVisibility` enum(`'private'` / `'workspace'`)과 동일한 타입이 프론트엔드에 문자열 유니온 `type TestDatasetVisibility = "private" | "workspace"` 로 별도 정의되어 있다. 풀스택 TypeScript 모노레포임에도 공유 패키지(`codebase/packages/`)를 통한 타입 공유 없이 양쪽에 동일 타입이 중복 존재한다. 값이 변경될 경우 양쪽을 각각 수정해야 하는 동기화 부담이 생긴다.
- 제안: `codebase/packages/` 에 공유 DTO/타입 패키지가 이미 있다면 `TestDatasetVisibility` 를 그곳으로 이전하는 것이 DRY 원칙에 부합한다. 공유 패키지가 없거나 이전 비용이 크다면 현재 수준에서 허용 가능하나 장기적 부채로 기록 필요.

### [INFO] 엔티티 컬럼명(`data`)과 속성명(`input`) 불일치 — 레이어 간 개념 매핑 복잡도
- 위치: `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts` L489 (`@Column({ name: 'data', ... }) input: Record<string, unknown>`)
- 상세: 데이터베이스 컬럼명 `data` 와 TypeORM 엔티티 속성명 `input` 이 다르다. JSDoc 에 이유("TransformInterceptor 가 응답 객체의 top-level `data` 키를 '이미 래핑됨'으로 오판")가 명시되어 있어 의도적 결정임은 분명하다. 그러나 이는 인프라 인터셉터의 구현 세부사항(키 이름 충돌 회피)이 도메인 엔티티 설계에 영향을 미치는 패턴으로, 레이어 책임 분리 원칙에서 우려 지점이다. `TransformInterceptor` 의 특수 동작이 엔티티·마이그레이션·응답 DTO 등 여러 레이어에 걸쳐 명시적으로 언급되어야 하는 결합이 형성된다.
- 제안: `TransformInterceptor` 의 래핑 감지 로직(top-level `data` 키 존재 여부로 이미 래핑됨을 판단하는 휴리스틱)이 근본 문제다. 인터셉터가 타입 안전한 마커나 메타데이터로 래핑 여부를 결정하도록 개선하면 엔티티 컬럼명을 자유롭게 지정할 수 있다. 현재 scope 에서 즉시 변경은 어렵지만 이 결합을 아키텍처 부채로 기록해두는 것을 권장.

## 요약

이번 변경은 `workflow-test-datasets` 도메인을 표준 NestJS 모듈 패턴(entity, DTO, service, controller, module)으로 신설한 것으로, 전체적인 아키텍처 구조는 기존 모듈 컨벤션을 충실히 따르고 있다. `WorkflowTestDatasetsModule` 이 `WorkflowModule` 내부 서비스가 아닌 `Workflow` 엔티티 레포지토리를 직접 참조하는 점과, `TransformInterceptor` 우회를 위해 DB 컬럼명과 엔티티 속성명을 다르게 유지하는 점은 레이어 간 결합도를 높이는 설계 부채이나 현 규모에서 즉각적 위험 수준은 아니다. 프론트엔드-백엔드 간 `TestDatasetVisibility` 타입 중복, 그리고 `FormModalField` 에서의 `min`/`max`/`pattern` 역전(revert) 이 의도된 것이라면 plan/spec 레벨에서 명확히 추적되어야 SOLID 원칙 중 개방-폐쇄 원칙 관점의 혼동을 막을 수 있다. Critical 또는 Warning 수준의 아키텍처 결함은 발견되지 않는다.

## 위험도

LOW
