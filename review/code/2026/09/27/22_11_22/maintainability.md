# 유지보수성(Maintainability) 리뷰 — cross-workspace-refs

## 발견사항

- **[WARNING]** "참조 배치 검사 → invalid 배열 생성 → throw" 패턴이 최소 4곳에서 서로 다른 모양으로 재구현됨(중복 코드 · 일관성)
  - 위치:
    - `codebase/backend/src/modules/edges/edges.service.ts:72-95` (`assertEndpointsInWorkflow` — `sourceNodeId`/`targetNodeId` 두 필드를 손으로 풀어 쓴 버전)
    - `codebase/backend/src/modules/nodes/nodes.service.ts:97-130` (`assertPlacementInWorkflow` — `refs` 배열로 일반화한 버전. 117번 줄 주석이 "엣지 끝점 검사와 같은 형태" 라고 스스로 명시하면서도 추출하지 않음)
    - `codebase/backend/src/modules/workflows/workflows.service.ts:1111-1143` (`validateCanvasReferences` — 같은 문제를 DB 조회 대신 `Set` 기반 in-memory 버전으로 4번 반복: `containerId`·`toolOwnerId`·`sourceNodeId`·`targetNodeId`)
    - `codebase/backend/src/modules/workflows/workflows.service.ts:1210-1233` (`assertNewNodeIdsUnused` — 같은 "In() 조회 → Set → filter → throwInvalidReferences" 뼈대를 또 반복)
  - 상세: 이번 PR 이 `reference-in-scope.ts` 에 `assertReferenceInScope`(단일 참조)를 잘 뽑아냈지만, "한 요청에 여러 필드를 한 번의 배치 쿼리로 검사" 하는 경우는 공용화하지 않아 edges/nodes/workflows 세 서비스가 서로 다른 손질(하드코딩 2필드 vs 일반화 N필드 vs in-memory Set)로 같은 로직을 반복한다. nodes.service.ts 의 주석이 이미 이 중복을 인지하고 있다는 점이, 지금 고치지 않으면 다음 사람이 또 다른 변형을 만들 가능성을 보여준다. 필드 하나(예: 에러 메시지 포맷, `INVALID_FIELD` 이외의 코드 분기)가 바뀌면 4곳을 손으로 맞춰야 한다.
  - 제안: `reference-in-scope.ts` 에 "여러 `{field, id, message}` 후보를 받아 한 번의 존재 조회(또는 주어진 `Set`)로 걸러 invalid 목록을 만들고 필요시 throw" 하는 범용 헬퍼(예: `assertAllReferencesFound(refs, isPresent)` 또는 batch 버전의 `assertReferenceInScope`)를 추가해 세 곳을 그 위에 재구성하는 것을 검토.

- **[INFO]** 동일한 리터럴 메시지 `'Workflow not found in this workspace'` 가 3개 파일에 중복(매직 스트링)
  - 위치: `codebase/backend/src/modules/alerts/alerts.service.ts:36`, `codebase/backend/src/modules/schedules/schedules.service.ts:192`, `codebase/backend/src/modules/triggers/triggers.service.ts:491` (모두 `assertReferenceInScope(...)` 네 번째 인자로 동일 문자열을 각자 타이핑)
  - 상세: 세 곳 다 "이 워크스페이스의 워크플로가 아니면" 같은 의미로 같은 문자열을 쓴다. 오탈자나 문구 변경 시 한 곳만 고치고 나머지를 놓치기 쉽다.
  - 제안: `reference-in-scope.ts` 나 별도 상수 모듈에 `WORKFLOW_NOT_IN_WORKSPACE_MESSAGE` 같은 공용 상수를 두고 세 호출부에서 재사용.

- **[INFO]** 같은 PR 안에서 "선택적 id 필드가 있는지" 판단하는 관용구가 파일마다 다름(일관성)
  - 위치: `codebase/backend/src/modules/alerts/alerts.service.ts:31` (`if (dto.workflowId)` truthy 체크), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:214,221,228` (truthy 체크), `codebase/backend/src/modules/nodes/nodes.service.ts:102,109` (`!= null`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:208` (`!llmConfigId`)
  - 상세: UUID 문자열이라 truthy 와 `!= null` 이 실질적으로 같은 결과를 내긴 하지만, 같은 문제(옵셔널 참조 id 존재 검사)를 처리하는 병렬 guard 함수들이 서로 다른 관용구를 섞어 써서 코드를 훑을 때 "여긴 왜 다르지" 하는 불필요한 의문을 만든다.
  - 제안: 이 PR 이 새로 만든 `assert*InWorkspace`/`assert*InWorkflow` 계열 함수만이라도 `!= null` (또는 truthy) 중 하나로 통일.

- **[INFO]** `KnowledgeBaseService.assertModelConfigRefsInWorkspace` 의 3개 if-블록이 필드명·kind 만 다르고 구조가 완전히 동일(중복 코드)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206-235`
  - 상세: `extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId` 세 블록이 각각 5줄씩 `if (dto.X) { await this.modelConfigService.findEntity(dto.X, workspaceId, 'kind'); }` 형태를 반복한다. 넷째 필드가 추가되면 같은 모양이 한 번 더 늘어난다.
  - 제안: `[[dto.extractionLlmConfigId, 'chat'], [dto.rerankConfigId, 'rerank'], [dto.rerankLlmConfigId, 'chat']]` 같은 배열을 순회하는 루프로 축약 가능(단, 순차 `await` 유지가 의도된 것이라면 — 이전 라운드 `review/code/2026/09/27/21_43_01` INFO 9 에서 이미 우선순위 낮음으로 접수됐으므로 재작업을 강제하는 항목은 아님).

- **[INFO]** 테스트 전용 provider stub 4줄 블록이 `triggers.service.spec.ts` 안에서 8회, `triggers.web-chat.spec.ts` 에서 1회, 총 9곳에 그대로 복사됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:75,152,469,672,1688,1854,2003,2395`, `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts:38`
  - 상세: 아래 블록이 9곳에 동일하게 붙었다.
    ```
    {
      // 생성의 workflowId 소속 검사(spec 1-data-model §1.1) — 기본은 같은 워크스페이스의 워크플로.
      provide: getRepositoryToken(Workflow),
      useValue: { exists: jest.fn().mockResolvedValue(true) },
    },
    ```
    파일에는 이미 일부 `describe` 블록이 쓰는 `createBaseProviders()` 헬퍼가 있지만, 나머지 `describe` 들은 `Test.createTestingModule` provider 배열을 각자 손으로 나열하는 기존 관행을 따르고 있어 이번 PR 이 그 자리마다 같은 4줄을 붙여 넣어야 했다. 이 자체는 이 PR 이 만든 문제가 아니라 파일의 기존 구조(공용 헬퍼 미채택 describe 다수)가 이번 변경의 복사-붙여넣기 비용을 키운 것이다.
  - 제안: 이번 PR 범위는 아니지만, 다음에 provider 하나가 더 필요해지면 같은 9곳을 또 고쳐야 한다는 점을 감안해 `createBaseProviders()` 로의 점진적 통합을 백로그에 남길 만하다.

## 요약

새로 도입한 `reference-in-scope.ts`(`assertReferenceInScope`/`throwInvalidReferences`)는 이름·문서화·에러 모양이 기존 컨벤션(`assertWorkflowInWorkspace`, 파이프의 `VALIDATION_ERROR` 모양)과 잘 맞고, 단일 참조 검사 중복을 실제로 줄였다. 함수 길이·중첩 깊이·네이밍·매직 넘버 측면은 전반적으로 양호하며, e2e/unit 테스트 구조도 헬퍼 함수 위주로 읽기 쉽게 짜여 있다. 다만 "한 요청에서 여러 필드를 배치로 검사" 하는 더 넓은 케이스는 공용화하지 못해 edges/nodes/workflows 세 서비스가 서로 다른 모양으로 같은 로직을 반복하고 있고(그 중 하나는 스스로 중복을 인지하는 주석까지 남겼다), 리터럴 메시지 문자열과 null 체크 관용구도 파일마다 미세하게 갈린다. 모두 기능 결함은 아니며 후속 정리로 충분히 미룰 수 있는 수준이다.

## 위험도
LOW
