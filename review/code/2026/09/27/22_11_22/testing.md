# 테스트(Testing) 리뷰 — cross-workspace-refs

## 발견사항

- **[WARNING]** `saveCanvas` 가 버전 복원(`skipLegacyDataGates=true`) 경로에서도 `validateCanvasReferences` 를 건너뛰지 않는다는 명시적 설계 결정을 고정하는 회귀 테스트가 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:693-697`(호출부 — 주석: "버전 복원(`skipLegacyDataGates`)에서도 건너뛰지 않는다 — 옛 데이터 호환 게이트가 아니라 워크스페이스 경계다"), 정의부 `codebase/backend/src/modules/workflows/workflows.service.ts:1111`(`validateCanvasReferences`)
  - 상세: `saveCanvas` 안에서 `validateManualTrigger`/`validateReservedVariableNames` 는 `if (!skipLegacyDataGates)` 로 감싸 옛 스냅샷 복원 시 건너뛰는 반면, `validateCanvasReferences` 는 의도적으로 그 조건문 **밖**에 둬 복원 경로에서도 항상 실행되게 했다. 이는 보안·데이터 무결성상 올바른 설계지만, 정확히 이 비대칭("다른 legacy gate 는 스킵하는데 이것만 스킵하지 않는다")을 검증하는 테스트가 `workflows.service.spec.ts` 에 없다. `restoreVersion`/`saveCanvas` 테스트를 grep 한 결과 `skipLegacyDataGates: true` 인자와 함께 캔버스 참조 위반(페이로드 밖 `containerId`/`toolOwnerId`/엣지 끝점)을 조합한 케이스는 존재하지 않는다(`saveCanvasSpy` 로 인자만 확인하는 기존 테스트 두 건은 유효한 스냅샷만 사용). 이 상태에서 누군가 리팩터링 중 실수로 `validateCanvasReferences` 를 `if (!skipLegacyDataGates)` 블록 안으로 옮겨도(다른 세 검사와 "통일"하려는 유혹이 있을 수 있다) 어떤 테스트도 RED 로 잡지 못한다 — 정확히 이 PR 이 막으려던 교차 워크스페이스 노드 탈취가 "버전 복원"이라는 우회로로 되살아날 수 있다.
  - 제안: `saveCanvas(workflowId, ws, userId, dto, /* skipLegacyDataGates */ true)` 를 페이로드 밖을 가리키는 `containerId`(또는 엣지 끝점)와 함께 호출해 400 이 나는 것을 확인하는 단위 테스트 1건 추가. 함께 `validateManualTrigger`/`validateReservedVariableNames` 는 같은 조건에서 스킵됨을 대조하면 "이 검사만 예외" 라는 설계 의도가 테스트로도 명확해진다.

- **[INFO]** `NodesService.assertPlacementInWorkflow` 의 "한쪽 필드만 무효" 케이스 단위 테스트 부재 — 같은 형태의 `EdgesService.assertEndpointsInWorkflow` 에는 있음
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`) 대응 스펙 `codebase/backend/src/modules/nodes/nodes.service.spec.ts:155`(둘 다 유효한 경우는 없음), `:178`(둘 다 무효), `:295`(containerId 만 null). 비교 대상 `codebase/backend/src/modules/edges/edges.service.spec.ts:141`("한쪽만 없으면 그 끝점만 싣는다" — 테스트 존재)
  - 상세: 두 헬퍼는 "틀린 참조를 전부 싣는다"는 같은 계약을 구현하는데(둘 다 이 PR 에서 신설), 엣지 쪽은 "sourceNodeId 는 유효, targetNodeId 만 무효"인 혼합 케이스를 명시적으로 커버해 `invalid` 배열 필터링 로직(각 필드를 독립적으로 검사)을 검증한다. 노드 쪽은 "둘 다 무효" 케이스만 있고 "containerId 무효 · toolOwnerId 유효"(또는 반대) 혼합 케이스가 없어, 예컨대 `if (!foundIds.has(dto.toolOwnerId))` 앞에 있는 `if (!foundIds.has(dto.containerId))` 분기가 조기 반환하는 뮤턴트가 있어도 "둘 다 무효" 테스트만으로는 잡히지 않을 가능성이 있다(두 필드가 항상 같은 값으로 실패/성공하는 fixture 라 개별 분기를 가르지 못함 — MEMORY 의 "다중 분기 연산자는 각 항에 다른 값" 교훈과 같은 패턴).
  - 제안: nodes.service.spec.ts 에 "containerId 는 무효, toolOwnerId 는 이 워크플로의 노드"(또는 반대) 케이스 1건 추가해 `details` 배열이 무효 필드 하나만 담는지 확인.

- **[INFO]** `WorkflowsService.update` 경로에 `folderId` 미제공 시 조회를 건너뛰는 것을 명시적으로 검증하는 테스트가 없음 — `create` 경로에는 대칭 테스트가 있음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:368`(`describe('update — folderId 소속 검사 ...')` — 거부 케이스 1건만) vs `:600`(`create` 쪽 "folderId 가 없거나 null 이면 조회하지 않는다")
  - 상세: `assertFolderInWorkspace` 는 `create`·`update` 양쪽에서 호출되는 공용 private 메서드고 `folderId == null` 이면 조기 반환하는데, 이 스킵 분기는 `create` 쪽에서만 `mockFolderRepository.exists` 가 `not.toHaveBeenCalled()` 로 명시적으로 고정돼 있다. `update` 의 다른 기존 테스트들(예: settings spread-merge)은 `folderId` 를 안 보내면서도 통과하므로 *간접적으로는* 이 경로를 실행하지만, "왜 통과했는지"(스킵됐는지 vs 우연히 `exists` 기본 mock 이 `true` 라서인지)를 구분해서 고정하지 않는다.
  - 제안: `update` describe 블록에 `folderId` 미포함 호출 후 `mockFolderRepository.exists` 가 호출되지 않았음을 단언하는 테스트 1건 추가(비용 낮음, `create` 쪽과 대칭 유지).

- **[INFO]** `EdgesService` 단위 테스트의 `mockNodeRepo.find` 기본 구현이 TypeORM `In()` 의 내부 표현(`FindOperator.value`)에 의존
  - 위치: `codebase/backend/src/modules/edges/edges.service.spec.ts:44-51`(`mockNodeRepo = { find: jest.fn(({ where }) => Promise.resolve((where.id.value as string[]).map(...))) }`)
  - 상세: `In(...)` 이 반환하는 `FindOperator` 의 `.value` 프로퍼티는 TypeORM 의 공개 계약이 아니라 구현 세부사항이다(공식적으로 문서화된 API 는 아니고, 실제로는 안정적으로 유지돼 왔다). 이 mock 은 실제 리포지토리 동작(`In` 연산자를 SQL `WHERE id IN (...)` 로 변환)을 흉내 내려고 이 내부 구조를 그대로 읽는데, TypeORM 버전이 올라가며 내부 표현이 바뀌면 이 mock 만 조용히 깨지고 프로덕션 코드는 멀쩡한 상황이 생길 수 있다 — 실제 동작과의 괴리라기보다 mock 이 지나치게 구현 결합적이라는 점이 리스크다.
  - 제안: 시급하지 않음(당장 문제는 없음). TypeORM major 업그레이드 시 이 mock 을 재검증 대상으로 표시해 두면 좋다.

## 요약

이번 PR 의 핵심 로직(참조-소속 검증 유틸 `reference-in-scope.ts`, 6개 서비스의 개별 검증 호출부, 캔버스 저장의 페이로드-내부 참조·신규 노드 id 충돌 검사)은 단위 테스트와 26케이스 규모의 신규 e2e 스위트(`cross-workspace-references.e2e-spec.ts`)로 폭넓게 커버돼 있고, 직전 리뷰 라운드(`21_43_01`)에서 지적된 테스트 공백(알림 규칙·어시스턴트 세션 단위 테스트 부재, 노드 배치 검사 전략 불일치)은 `698ad8ab7` 로 이미 해소됐다(재지적하지 않음). 성공·실패·null-skip·저장 미호출까지 각 검증기마다 대칭적으로 테스트가 갖춰져 있고 unit 10447/e2e 477 전체 통과가 확인된 상태다. 남은 갭은 전부 기존 커버리지를 깨지 않는 보강 수준이며, 가장 의미 있는 것은 `saveCanvas` 가 버전 복원 경로에서도 캔버스 참조 검사를 예외적으로 유지한다는 **문서화된 설계 결정**을 고정하는 회귀 테스트가 없다는 점이다 — 이 결정이 실수로 뒤집혀도 현재 테스트 스위트는 감지하지 못한다. 나머지(노드 배치 검사의 혼합 무효 케이스, `update` 의 `folderId` 스킵 대칭 테스트, 엣지 mock 의 TypeORM 내부 구조 의존)는 INFO 수준의 사소한 보강 항목이다.

## 위험도

LOW
