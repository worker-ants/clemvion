# 아키텍처 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 새 공용 유틸 `reference-in-scope.ts` 는 SRP·응집도가 좋다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:21`(`throwInvalidReferences`), `:37`(`assertReferenceInScope`)
  - 상세: "요청 본문 참조 id → 소속 검사 → 400 `VALIDATION_ERROR`" 라는 하나의 책임만 지고, 응답 포맷(파이프가 내는 형태와 동일)까지 문서화해 재사용성을 확보했다. 호출부(`alerts.service.ts`, `folders.service.ts`, `schedules.service.ts`, `triggers.service.ts`, `workflows.service.ts` 의 `folderId` 검사)가 전부 `{ id, <scope column> }` 형태의 `where` 를 넘기는 동일한 계약을 지켜, 개방-폐쇄 원칙(새 참조 필드 추가 시 기존 코드 수정 없이 호출만 추가) 도 잘 지켰다.
  - 기존 `modules/workflows/workflow-ownership.util.ts::assertWorkflowInWorkspace` 와 형태(리포지토리+where+없으면 예외)가 거의 같지만 예외 타입·코드가 다르다(404 `RESOURCE_NOT_FOUND` vs 400 `VALIDATION_ERROR`/`INVALID_FIELD`) — 이는 `spec/5-system/3-error-handling.md` §1.11 이 URL 경로 리소스(IDOR)와 본문 참조(입력값 유효성)를 의도적으로 다른 에러 계층으로 분리한 결과이므로 중복이 아니라 의도된 분화다. 제안 없음(설계 확인용 기록).

- **[WARNING]** 같은 PR·같은 날 작성된 "워크플로 범위 내 노드 참조" 배치 검증이 두 가지 다른 쿼리 전략으로 중복 구현됐다
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`) vs `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow`)
  - 상세: 둘 다 "같은 워크플로에 속한 노드인지, 여러 필드를 동시에 검사해 전부 `details[]` 에 싣는다" 는 동일한 문제를 푼다. `edges.service.ts` 는 `In([sourceNodeId, targetNodeId])` 로 **한 번의 배치 쿼리**(`nodeRepository.find`)를 쓰는 반면, `nodes.service.ts` 는 `containerId`·`toolOwnerId` 를 **순차 `await` 루프**로 각각 `nodeRepository.exists()` 호출한다(최대 2회 왕복). 두 서비스 다 "필드 배열 → invalid 수집 → `throwInvalidReferences`" 라는 동일 패턴을 반복 작성했고, 공용화됐다면(`assertReferenceInScope` 를 확장한 "복수-필드·배치" 버전) 왕복 횟수 불일치도 함께 제거됐을 것이다. `assertReferenceInScope` 자체가 단일 필드·단일 `exists()` 만 지원해서 두 서비스가 각자 우회 구현을 선택한 것으로 보인다.
  - 제안: 필수는 아니지만, `reference-in-scope.ts` 에 "같은 스코프의 여러 id 를 배치로 검사"하는 버전(`assertReferencesInScope(repo, scopeWhere, refs: {field, id}[])` 형태로 `In()` 을 내부에서 씀)을 추가해 두 서비스가 공유하면, 왕복 횟수 일관성도 얻고 세 번째 유사 사례(다음 PR)가 또 다른 전략을 고르는 것을 막을 수 있다.

- **[INFO]** `assertReferenceInScope` 의 핵심 불변식이 타입 시스템이 아니라 JSDoc 산문으로만 강제된다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:34`(주석 "`where` 에 소속 조건... 을 반드시 싣는다 — id 만 넣으면 이 검사가 존재 확인으로 줄어든다")
  - 상세: `where: FindOptionsWhere<T>` 는 `{ id }` 만 넘겨도 타입 에러가 나지 않는다. 이번 PR 의 5개 호출부는 전부 규약을 지켰지만(`{ id, workspaceId }`/`{ id, workflowId }`), 이 불변식을 지키는 유일한 장치가 "문서를 읽고 기억하기" 라서, 다음 참조 필드가 추가될 때 소속 조건을 빠뜨리면 조용히 "존재만 확인"으로 퇴화한다 — 이번 PR 이 고친 것과 같은 클래스의 결함이 재발할 수 있는 자리다.
  - 제안: 강제하려면 시그니처를 `assertReferenceInScope(repo, id, scope: { column: string; value: string }, field, message)` 처럼 스코프 컬럼을 별도 필수 인자로 분리하거나, 최소한 런타임 가드(`where` 키가 2개 미만이면 throw)를 추가하는 방안을 고려.

- **[INFO]** 모듈 결합 방식은 기존 컨벤션(리포지토리만 주입, 모듈 import 금지)을 일관되게 따랐다
  - 위치: `codebase/backend/src/modules/alerts/alerts.module.ts`(변경 없음, 하지만 서비스가 `Workflow` repo 를 직접 주입받음) / `codebase/backend/src/modules/edges/edges.module.ts:10`(`Node` 추가) / `codebase/backend/src/modules/workflows/workflows.module.ts`(`Folder` 추가) / `codebase/backend/src/modules/triggers/triggers.module.ts`(`Workflow` 추가)
  - 상세: 이미 `workflows.module.ts` 주석이 명시한 "서비스에 repository 만 주입하고 상대 모듈을 import 하지 않아 순환을 피한다" 는 패턴을 새 5개 지점(`AlertsModule`→Workflow, `EdgesModule`→Node, `SchedulesModule`→Workflow, `TriggersModule`→Workflow, `WorkflowsModule`→Folder)이 그대로 재사용했다. `TypeOrmModule.forFeature` 로 엔티티만 등록하고 서비스 모듈 자체는 import 하지 않아 순환 의존성이 생기지 않는다 — 확인 결과 새 순환 경로 없음.

- **[INFO]** 레이어 책임 분리 유지 — 검증 로직이 서비스 계층에만 위치
  - 위치: 전체 diff (컨트롤러·DTO 파일은 이번 PR 에서 변경되지 않음)
  - 상세: 형식 검증(UUID 형태 등)은 기존 DTO/파이프 계층에, "다른 워크스페이스/워크플로 소속" 이라는 비즈니스 규칙은 서비스 계층의 `assert*` 사설 메서드에 위치해 계층 경계가 유지된다. `workflows.service.ts` 의 `validateCanvasReferences`/`assertNewNodeIdsUnused` 도 트랜잭션을 감싸는 같은 서비스 내부에 있어 프레젠테이션 계층 누출이 없다.

- **[INFO]** 확장성 — 이 규칙이 전방위로 늘어날 때의 구조적 안전망 부재는 PR 도 스스로 인지하고 트래커로 넘김
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(교차 워크스페이스 참조 후속 항목), `spec/1-data-model.md` §1.1 표
  - 상세: 현재 10개 참조 지점을 전부 사람이 기억해 개별 `assert*` 호출로 배선했다. 새 참조 필드가 추가될 endpoint 마다 이 검사를 빠뜨리지 않는다는 보장은 코드 구조(예: DTO 데코레이터·인터셉터로 선언적 강제)가 아니라 spec 표 + 개발자 규율에 의존한다. PR 자신이 "이미 저장된 교차 행 방어선" 등 인접 후속 항목을 의도적으로 범위 밖으로 넘겼음을 트래커에 명시했으므로 이번 PR 의 결함은 아니지만, 다음에 유사 필드가 생길 때 재발을 막을 선언적 메커니즘(예: DTO 필드에 `@ReferencesEntity(Entity, scopeKey)` 커스텀 데코레이터 + 공용 파이프/인터셉터)을 검토할 가치가 있다.

## 요약

이번 변경은 "요청 본문의 참조 id가 다른 워크스페이스/워크플로를 가리켜도 그대로 저장된다"는 구조적 결함을, 새 공용 유틸 `common/utils/reference-in-scope.ts` 로 책임을 분리해 10곳에 걸쳐 일관되게 적용한 설계다. SRP·계층 분리(검증은 서비스 계층)·모듈 결합(리포지토리만 주입, 모듈 import 회피로 순환 없음)·spec-코드 추적성 모두 기존 컨벤션을 잘 따르며 완성도가 높다. 다만 (1) 같은 클래스의 "워크플로 범위 내 다중 노드 참조 배치 검증"이 `nodes.service.ts`와 `edges.service.ts`에서 서로 다른 쿼리 전략(순차 vs 배치)으로 중복 구현됐고, (2) `assertReferenceInScope`의 핵심 불변식(소속 조건 포함)이 타입 시스템이 아닌 문서로만 강제돼 향후 유사 결함 재발의 여지가 남아 있다. 둘 다 병합을 막을 사안은 아니며, 다음 확장 시 개선 여지로 기록해 둘 만하다.

## 위험도

LOW
