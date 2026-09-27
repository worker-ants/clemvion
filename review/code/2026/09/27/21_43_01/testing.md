# 테스트(Testing) 리뷰 — cross-workspace-refs

## 발견사항

- **[WARNING]** `AlertsService.create` 의 신규 소속 검사에 unit 테스트가 전혀 없다 — 헬퍼가 무력화돼도 unit 단계에서 죽는 테스트가 없다
  - 위치: `codebase/backend/src/modules/alerts/alerts.service.ts` (`assertReferenceInScope` 호출 블록, `create` 메서드) / `codebase/backend/src/modules/alerts/` 디렉터리 전체(`alerts.service.spec.ts` 파일 자체가 존재하지 않는다 — `alerts-evaluator.service.spec.ts` 는 다른 서비스)
  - 상세: `find codebase/backend/src/modules/alerts -iname "*.spec.ts"` 로 실측 확인 — `AlertsService` 를 대상으로 하는 spec 파일이 하나도 없다. 이 PR 이 같은 헬퍼(`assertReferenceInScope`)를 붙인 다른 7개 자리(트리거·스케줄·폴더 생성/수정·워크플로 folderId 생성/수정) 는 전부 대응하는 `*.service.spec.ts` 에 "없으면 400 + `details[].field`" 테스트가 있는데, alerts 만 짝이 없다. `plan/in-progress/cross-workspace-refs.md` 의 뮤턴트 표(M1: "헬퍼가 조회도 거부도 안 함" → KILLED 8)에 적힌 8개 죽은 테스트 목록도 "헬퍼 2 · 워크플로 folderId 생성·수정 2 · 트리거 1 · 스케줄 1 · 폴더 생성·수정 2" 로 정확히 8개이고 **alerts 는 포함돼 있지 않다** — 즉 개발자 자신의 뮤턴트 실측도 alerts 경로는 손대지 못했다는 뜻이다. `CreateAlertRuleDto.workflowId` 는 optional 이라 `if (dto.workflowId)` 스킵 분기도 있는데, 이 분기 역시 unit 레벨로는 전혀 검증되지 않는다. 현재는 e2e(`cross-workspace-references.e2e-spec.ts` "알림 규칙 생성의 workflowId")가 유일한 방어선이라, 이 서비스를 리팩터링하다 검사 호출이 실수로 빠지면 무겁고 느린 e2e 실패로만 드러난다.
  - 제안: `alerts.service.spec.ts` 를 새로 만들어 (1) `workflowId` 가 다른 워크스페이스면 400 + `details:[{field:'workflowId',code:'INVALID_FIELD'}]` + `repository.save` 미호출, (2) `workflowId` 미지정 시 `assertReferenceInScope`(또는 workflowRepository.exists)가 호출되지 않음, 두 케이스만이라도 추가.

- **[INFO]** `WorkflowAssistantSessionService` 도 unit 테스트 파일 자체가 없다 — 신규 `assertLlmConfigInWorkspace` 가 e2e 로만 검증된다
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts` (`assertLlmConfigInWorkspace` 메서드, `create`/`update` 호출부)
  - 상세: `workflow-assistant-session.service.spec.ts` 파일이 저장소에 없다(확인: `ls codebase/backend/src/modules/workflow-assistant/ | grep -i session` → 소스 파일만 나옴). e2e(`어시스턴트 세션 생성/수정의 llmConfigId — 404 MODEL_CONFIG_NOT_FOUND`) 가 `create`·`update` 양쪽을 실제로 때리므로 완전한 사각지대는 아니지만, 이 PR 의 다른 모든 서비스(폴더·워크플로·노드·엣지·트리거·스케줄·KB)는 unit 테스트로 "호출 인자(`where`/`kind`)가 정확한지"·"`null`/undefined 는 스킵하는지"를 별도로 고정해 두는 데 비해 이 파일만 그 계층이 없다.
  - 제안: 최소 스모크 수준(`assertLlmConfigInWorkspace` 가 `resolveConfig(id, workspaceId)` 를 정확한 인자로 부르는지, `null`/undefined 는 호출하지 않는지)만이라도 unit 으로 고정하면 리팩터링 시 빠른 피드백을 얻는다. 차단 사유는 아님.

- **[INFO]** `NodesService.assertPlacementInWorkflow` — `containerId` · `toolOwnerId` 가 **동시에** 둘 다 invalid 인 케이스가 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.spec.ts` (`containerId 는 같은 워크플로의 노드인지 조회한다` / `toolOwnerId 는 대상 노드의 워크플로로 조회한다` 두 테스트 — 각각 단일 필드만 invalid)
  - 상세: 같은 PR 의 동형 로직인 `EdgesService.assertEndpointsInWorkflow` 는 `sourceNodeId`·`targetNodeId` 가 **둘 다** invalid 인 케이스(`이 워크플로에 없는 끝점은 400 — 틀린 끝점을 전부 싣고 저장하지 않는다`)를 명시적으로 고정하는데, `NodesService` 쪽은 `containerId`/`toolOwnerId` 를 각각 따로만 테스트해 "틀린 참조를 전부 싣는다"(`details` 배열에 두 항목)는 이 PR 의 핵심 계약이 nodes 경로에서는 검증되지 않는다. 로직이 단순(두 참조를 순회하는 루프)해서 위험은 낮지만, `for...of` 안의 `await` 순서 실수(예: 두 번째 `if` 를 `else if` 로 잘못 바꾸는 뮤턴트)가 생겨도 이 파일만으로는 못 잡는다.
  - 제안: `containerId`·`toolOwnerId` 둘 다 존재하지 않는 케이스 하나만 추가해 `details` 에 두 field 가 모두 실리는지 확인.

## 긍정적으로 확인한 점 (참고용, 조치 불필요)

- `plan/in-progress/cross-workspace-refs.md` 에 고치기 전 e2e 18건 RED 실측 로그와 뮤턴트 M1~M5(KILLED) 표가 남아 있어, 이번 PR 의 핵심 검증기(`reference-in-scope.ts`, `EdgesService`/`WorkflowsService`/`NodesService`/`FoldersService` 의 소속 검사)는 회귀 테스트 근거가 실측으로 뒷받침된다.
- `workflows.service.spec.ts` 의 `saveCanvas` describe 는 `mockTransactionManager.find`/`.save` 재대입이 이전 `describe` 의 잔여로 다음 테스트를 오염시킬 수 있다는 점을 주석으로 명시하고 `beforeEach` 에서 매번 새 `jest.fn()` 으로 재설정한다 — 신규 "참조의 소속" 테스트들도 이 패턴을 그대로 따라 격리가 지켜진다.
- 캔버스 저장 e2e 는 거부 후 **부작용 부재**(B 의 노드가 실제로 옮겨지지 않았는지 DB 로 직접 확인)까지 검증해 "400 이지만 실제로는 저장됐다" 류의 거짓 성공을 잡는다.
- 폴더 `parentId` 소속 검사 도입으로 에러 응답 포맷이 바뀌었지만(`message` 단일 → `details` 배열), 저장소 전체에서 옛 포맷을 가정하는 다른 테스트를 grep 으로 확인한 결과 회귀는 없다.
- `assertReferenceInScope`/`throwInvalidReferences` 자체의 unit 테스트(`reference-in-scope.spec.ts`)가 성공/실패/details 배열 모양을 정확히 고정해, 이 헬퍼를 쓰는 8개 호출부가 이 계약에 의존할 수 있는 기반이 된다.

## 요약

이번 PR 은 교차 워크스페이스 참조 저장 방지라는 보안 성격 결함을 고치면서 e2e(18개 신규 케이스, 실측 RED→GREEN 전환 로그 포함) · unit(폴더/워크플로/노드/엣지/트리거/스케줄/지식베이스 서비스별 짝 테스트) · 뮤턴트 테스트(M1~M5 KILLED)까지 갖춘 드물게 탄탄한 테스트 설계를 보인다. 다만 같은 헬퍼를 쓰는 8개 자리 중 `AlertsService` 하나만 대응 unit 테스트 파일이 아예 없어(개발자 자신의 뮤턴트 실측 목록에도 alerts 가 빠져 있다) e2e 단독 방어로 남아 있고, `WorkflowAssistantSessionService` 도 마찬가지로 unit 테스트 계층이 없다. `NodesService` 는 `containerId`·`toolOwnerId` 동시 invalid 케이스가 빠져 자매 클래스인 `EdgesService` 대비 한 단계 약한 커버리지를 보인다. 셋 다 e2e 가 실제 엔드포인트를 때려 기능적 구멍은 아니지만, unit 계층 부재는 이 PR 이 스스로 세운 기준(검사 헬퍼마다 unit 짝 테스트)에서 벗어난 비일관성이다.

## 위험도

LOW
