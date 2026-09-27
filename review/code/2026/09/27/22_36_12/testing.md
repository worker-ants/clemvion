# 테스트(Testing) 리뷰 — cross-workspace-refs (22_36_12, 3R)

## 컨텍스트

이 라운드(`22_36_12`)의 diff 베이스(`origin/main`)에서 실제 `codebase/**` 변경은 1R(`698ad8ab7`)·2R(`421b69088`) 커밋까지 누적된 것과 동일하다 — 이번 라운드에 추가된 `b2780f3f6` 는 `plan/**`·`review/**` 문서만 건드리는 docs-only 커밋이다(`git show --stat b2780f3f6` 로 확인, `codebase/` 변경 0). 즉 테스트 관점에서 새로 리뷰할 프로덕션 코드 변경은 없고, 이미 1R·2R 테스트 리뷰가 지적한 항목(W1 소속 검사 단위 테스트 부재·M6 뮤턴트)은 각각 `698ad8ab7`·`421b69088` 로 이미 조치됐다(`review/code/2026/09/27/21_43_01/RESOLUTION.md`, `review/code/2026/09/27/22_11_22/RESOLUTION.md`). 아래는 프롬프트에서 생략된 파일(9·13·18·24·25·26번, "생략" 표기)을 포함해 전체 diff 를 직접 열어 재검증한 결과다.

## 발견사항

- **[INFO]** 폴더 **수정**(`PATCH /api/folders/:id`) 경로의 `parentId` 교차 워크스페이스 케이스가 e2e 스위트에 없다 — "생성" 만 e2e 로 커버된다
  - 위치: `codebase/backend/test/cross-workspace-references.e2e-spec.ts:188-194`("폴더 생성의 parentId" 케이스만 존재, "폴더 수정의 parentId" e2e 케이스 없음)
  - 상세: CHANGELOG(`CHANGELOG.md` "그 밖의 참조" 항목, 게이트 37-38줄)는 "폴더 수정 parentId" 도 거부 대상으로 명시한다. e2e negative test 는 생성만 검증하고 수정은 유닛 테스트(`codebase/backend/src/modules/folders/folders.service.spec.ts` "rejects parent in another workspace / nonexistent")로만 커버된다. 다만 생성·수정이 같은 `FoldersService.assertParentInWorkspace` 헬퍼를 공유하므로(`folders.service.ts:150` 부근 `assertParentInWorkspace`) 서비스 로직 자체의 리스크는 낮다 — 컨트롤러·검증 파이프 레이어까지 통과하는지만 미검증 상태.
  - 제안: 필수는 아니나, e2e 에 "폴더 수정의 parentId" 케이스 1개를 추가하면 생성/수정 두 라우트 모두 HTTP 계층까지 실측된다. 급하지 않으면 유예 가능(동작 결함 근거 없음).

- **[INFO]** 소속 판별에 쓰이는 falsy 조건이 파일마다 다르다(`AlertsService.create` 는 `if (dto.workflowId)` truthy 체크, `FoldersService`/`NodesService`/`WorkflowsService`/`WorkflowAssistantSessionService` 는 `!= null`/`== null`) — 빈 문자열(`''`) 입력에 대한 명시적 경계값 단위 테스트가 없다
  - 위치: `codebase/backend/src/modules/alerts/alerts.service.ts`(`create` 메서드, `if (dto.workflowId)` 조건) vs `codebase/backend/src/modules/nodes/nodes.service.ts`(`assertPlacementInWorkflow`, `dto.containerId != null`)
  - 상세: 이 불일치 자체는 이미 2R(`review/code/2026/09/27/22_11_22`)에서 INFO 로 지적되고 "조치 불요"(동작 결함 아님, DTO 검증 파이프가 빈 문자열을 UUID 검증에서 선행 차단)로 처분된 사안이라 재-flag 는 아니다. 다만 테스트 관점에서는 "`workflowId: ''`이 검증을 우회하지 않는다"를 고정하는 단위 테스트가 이 서비스들 어디에도 없다는 점만 기록한다 — 파이프 계층(`CustomValidationPipe`)에 대한 신뢰가 유일한 방어선이라, 파이프가 바뀌면 이 서비스 코드는 무방비다.
  - 제안: 우선순위 낮음. 유예해도 무방하나, 백로그에 "빈 문자열 workflowId 경계 테스트"를 남겨두면 다음 사람이 재조사하지 않아도 된다.

- **[INFO]** `edges.service.spec.ts`/`nodes.service.spec.ts` 의 `mockNodeRepo.find` 목이 TypeORM `In()` 오퍼레이터의 내부 구조(`where.id.value`)에 의존한다
  - 위치: `codebase/backend/src/modules/edges/edges.service.spec.ts`(`mockNodeRepo` 정의, `where.id.value as string[]`)
  - 상세: TypeORM `FindOperator.value` 는 공개 getter라 당장 깨지는 결합은 아니다(이미 2R INFO 9(c)에서 "공개 getter" 로 확인·조치 불요 처분됨). 다만 이 mock 은 실제 리포지토리 동작(SQL `IN (...)`)을 흉내내는 대신 TypeORM 내부 오퍼레이터의 표현 방식을 그대로 읽어 재구성한다 — TypeORM 메이저 업그레이드로 `FindOperator` 내부 표현이 바뀌면(예: `value` → `getValue()` 전용) 이 mock 만 조용히 깨지고 실제 서비스 코드는 멀쩡할 수 있어 "테스트가 실제 동작과 반대로 거짓 RED/GREEN 을 낼 여지"가 남는다. 새 지적은 아니며 참고 기록.
  - 제안: 조치 불요(선례와 동일 판단). 리팩터링 여유가 생기면 `where` 객체 형태 대신 `find` 호출 인자 전체를 `toHaveBeenCalledWith({ where: { id: In([...]), workflowId }, select: { id: true } })` 로 단언하는 현재 방식(이미 그렇게 하고 있음, 예: `nodes.service.spec.ts` "containerId 는 같은 워크플로의 노드인지 한 번에 조회한다")이 mock 내부 구현보다 안전하다.

## 긍정 평가 (커버리지 확인)

- 신규 공용 유틸(`reference-in-scope.ts`)은 `throwInvalidReferences`(details 배열 모양)와 `assertReferenceInScope`(존재/부재 양쪽, `where` 그대로 전달 확인)를 직접 단위 테스트한다(`reference-in-scope.spec.ts`).
- 이 유틸을 새로 붙인 6개 서비스(Alerts·Folders·Schedules·Triggers·KnowledgeBase·WorkflowAssistantSession·Workflows) 전부에 대해 "다른 워크스페이스 id → 400/404 + 저장 안 함", "같은 워크스페이스 → 통과", "미지정/`null` → 조회 안 함"의 3분기가 각 서비스 spec 에 개별로 존재한다(예: `alerts.service.spec.ts`, `workflow-assistant-session.service.spec.ts` 신설).
- 엣지 끝점(`EdgesService.assertEndpointsInWorkflow`)·노드 배치(`NodesService.assertPlacementInWorkflow`)는 `In()` 배치 조회 형태를 정확히 단언하고, "한쪽만 무효"·"둘 다 무효"·"둘 다 없으면 스킵" 분기를 모두 커버한다(`edges.service.spec.ts`, `nodes.service.spec.ts`).
- `WorkflowsService.saveCanvas` 는 캔버스 내부 참조(페이로드 밖 `containerId`/`toolOwnerId`/엣지 끝점)와 신규 노드 id 충돌(`assertNewNodeIdsUnused`, 다른 워크플로가 이미 쓰는 id)을 분리해서 각각 테스트하고, 버전 복원 경로(`skipLegacyDataGates=true`)에서도 참조 검사가 스킵되지 않음을 별도로 고정한다(`workflows.service.spec.ts` "참조의 소속" describe 블록) — 이 회귀는 2R 에서 실제로 뮤턴트(M6: 검사를 `if (!skipLegacyDataGates)` 안으로 이동)로 검증되어 KILLED 확인됨(`review/code/2026/09/27/22_11_22/RESOLUTION.md`).
- e2e(`codebase/backend/test/cross-workspace-references.e2e-spec.ts`)는 워크스페이스 범위(트리거·스케줄·알림·워크플로 생성/수정 folderId·폴더 생성 parentId·어시스턴트 세션 생성/수정) 8케이스, 워크플로 범위(노드 생성/수정 containerId·수정 toolOwnerId·엣지 생성 양 끝점) 5케이스, 캔버스 저장(신규 노드 id 충돌·containerId·toolOwnerId·엣지 끝점) 5케이스 = 총 18케이스로 CHANGELOG 가 서술한 결함 표면을 거의 1:1로 매핑한다. 특히 "다른 워크스페이스 노드의 id 를 새 노드로 실으면 거부하고, 그 노드는 그대로다" 케이스는 HTTP 응답뿐 아니라 실제 DB 행(`SELECT workflow_id, label FROM node WHERE id = $1`)이 변경되지 않았음까지 확인해 "저장이 실제로 스킵됐다"를 증명한다(단순 응답 코드만 보는 얕은 e2e 아님).
- 지식 베이스 3개 필드(`extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId`)는 픽스처 비용을 이유로 e2e 대신 단위 테스트로만 커버한다는 결정이 파일 상단 주석과 spec 양쪽에 명시돼 있어 "왜 빠졌는지"가 코드에서 바로 드러난다(회피가 아니라 문서화된 스코프 결정).
- 테스트 격리: e2e 는 매 테스트가 자기 액터(`a`/`b`)·고유 이름(`uniqueName`/`uniqueEmail`)으로 새 리소스를 만들어 실행 순서에 의존하지 않는다. `ids.workflowCanvas` 를 캔버스 저장 케이스 전용으로 분리해 "고치기 전 코드에서 성공한 저장이 다른 케이스의 픽스처를 지우지 않게 한다"는 격리 의도가 주석으로 명시돼 있다. 단위 테스트는 `beforeEach(() => jest.clearAllMocks())`(Alerts) 또는 매 describe 블록마다 독립된 `TestingModule`(Triggers)로 상태를 리셋한다.
- 1R·2R 에서 이미 뮤테이션 테스트(M1~M6)를 돌려 KILLED 를 확인했고(`plan/in-progress/cross-workspace-refs.md`, RESOLUTION 두 건), 3R(이번 라운드)은 코드 변경이 없어 재뮤테이션 불필요.

## 요약

이번 PR 은 교차 워크스페이스/교차 워크플로 참조를 저장 전에 거부하는 공용 유틸과 이를 적용한 7개 서비스 전부에 대해 유닛(성공/실패/미지정 3분기 + 배치 조회 형태 단언) 과 e2e(18케이스, DB 상태까지 확인) 양쪽에서 매우 두꺼운 테스트를 갖췄고, 이미 두 차례 리뷰 라운드를 거치며 지적된 테스트 갭(Alerts 단위 테스트 부재·버전 복원 경로 우회 가능성)이 실제 뮤턴트로 검증되어 조치됐다. 이번 3R 라운드는 코드 변경 없이 문서만 추가된 상태라 새로운 Critical/Warning 은 없으며, 남은 것은 저위험 INFO 3건(폴더 수정 parentId 의 e2e 미커버·falsy 조건 불일치의 경계값 테스트 부재·`In()` 내부 구조에 의존하는 mock)뿐이고 모두 기존 컨벤션/이전 라운드 처분과 동형이라 즉시 조치를 요구하지 않는다.

## 위험도
LOW
