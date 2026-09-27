# 동시성(Concurrency) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 신설 소속 검증(check-then-act)이 전부 별도 트랜잭션 없이 "조회 → 이후 문장에서 `save`/`insert`" 형태라, 조회와 저장 사이에 대상 행이 동시에 삭제되면 검증을 통과한 참조가 결국 FK 위반으로 저장 실패(500)할 수 있는 좁은 race window 가 있다
  - 위치:
    - `codebase/backend/src/common/utils/reference-in-scope.ts:43` (`assertReferenceInScope` — `repo.exists({ where })` 후 호출부가 별도 `save`)
    - `codebase/backend/src/modules/alerts/alerts.service.ts:31-38` (`AlertsService.create` — `assertReferenceInScope` 후 `repository.save`)
    - `codebase/backend/src/modules/folders/folders.service.ts:48`, `:149-160` (`assertParentInWorkspace` 후 `folderRepository.save`)
    - `codebase/backend/src/modules/schedules/schedules.service.ts:186-193` (`SchedulesService.create` — 워크플로 검사 후 `triggerRepository.save`/`scheduleRepository.save`)
    - `codebase/backend/src/modules/triggers/triggers.service.ts:482-492` (`TriggersService.create` — 워크플로 검사 후 `triggerRepository.save`)
    - `codebase/backend/src/modules/edges/edges.service.ts:72-95` (`assertEndpointsInWorkflow` 후 `edgeRepository.save`)
    - `codebase/backend/src/modules/nodes/nodes.service.ts:97-130` (`assertPlacementInWorkflow` 후 `saveWithUniqueConstraint`)
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:200-235` (`assertModelConfigRefsInWorkspace`)
    - `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:199-210` (`assertLlmConfigInWorkspace`)
  - 상세: 예를 들어 `EdgesService.create` 가 `assertEndpointsInWorkflow` 로 두 끝점 노드가 존재함을 확인한 직후, 동시 요청이 그 노드를 삭제하면 이어지는 `edgeRepository.save`(node FK, `ON DELETE CASCADE` — `codebase/backend/migrations/V001__initial_schema.sql:126-129`)가 FK 위반으로 실패한다. `NodesService.assertPlacementInWorkflow` 가 지키는 `container_id`/`tool_owner_id` 는 `ON DELETE SET NULL`(같은 파일 109-110행), `AlertsService`/`SchedulesService`/`TriggersService` 의 `workflow_id` 는 `ON DELETE CASCADE`(V001 100·126·146행, V016 7행)다. 즉 이 race 가 실제로 맞아떨어져도 결과는 "조용한 데이터 오염" 이 아니라 요청 실패(500) 또는 (SET NULL 케이스) 참조 자동 해제이지, 남의 워크스페이스 자원이 저장되는 보안 회귀는 아니다.
    다만 이 shape 자체는 **이번 PR 이 새로 도입한 위험이 아니다** — 기존 `assertWorkflowInWorkspace`(`codebase/backend/src/modules/workflows/workflow-ownership.util.ts:14-26`, `repo.findOne` 후 호출부가 별도로 저장)와 `assertAuthConfigInWorkspace` 가 이미 이 shape 를 쓰고 있고, 데이터베이스 리뷰(`review/code/2026/09/27/22_11_22/database.md`)도 같은 결론(기존 컨벤션과 동형, FK 가 최종 방어선)으로 이 자리를 넘겼다. 동시성 관점에서 추가할 내용은 "FK 액션이 CASCADE/SET NULL 로 실제 백스톱이 확인된다" 는 실측뿐이다.
  - 제안: 별도 조치 불요(기존 컨벤션 추종, 신규 결함 아님). 트랜잭션-스코프 검증(같은 `manager`로 `exists`+`save`)으로 창을 완전히 닫는 것은 가능하지만 이 PR 의 대부분이 단건 INSERT 라 이득 대비 리팩터 비용이 크다 — 재발이 실제로 관측되면 그때 고려.

- **[INFO]** `KnowledgeBaseService.assertModelConfigRefsInWorkspace` 는 서로 독립적인 세 검사(`extractionLlmConfigId`/`rerankConfigId`/`rerankLlmConfigId`)를 `Promise.all` 없이 순차 `await` 한다
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:214-234`
  - 상세: 세 필드는 서로 의존성이 없어 병렬 실행이 가능하지만 순차로 짜여 있다. 개수가 최대 3개로 고정돼 레이턴시 영향은 미미하고(이미 1R 리뷰에서 N+1 성격 아님으로 처리됨), 정합성·race 관점에서도 각 필드가 독립된 검증이라 순서를 병렬로 바꿔도 동시성 위험이 늘거나 줄지 않는다. 기능 결함은 아니다.
  - 제안: 조치 불요(선택적 최적화 여지로만 기록).

- **[INFO]** (긍정) `assertEndpointsInWorkflow`(edges)와 `assertPlacementInWorkflow`(nodes)는 여러 필드의 존재 확인을 `In()` 단일 쿼리로 묶고, 무효 필드를 모두 모은 뒤 한 번만 `throwInvalidReferences` 한다
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:76-94`, `codebase/backend/src/modules/nodes/nodes.service.ts:118-129`
  - 상세: 필드마다 개별 `exists()` 호출을 순차로 하는 형태보다 check-then-act 창을 좁히고 왕복 횟수를 줄인다. 2R RESOLUTION(`review/code/2026/09/27/22_11_22/RESOLUTION.md`)이 W2 로 "네 자리 전략 통일"을 수렴 예외로 트래커에 남긴 것과 일관된 방향이며 이번 diff 자체에서 퇴행은 없다.
  - 제안: 없음(확인 목적 기록).

- **[INFO]** 신규 검증 호출은 기존 잠금 경로(`WorkflowVersionsService.createVersion` 의 pessimistic lock, `acquireTriggerConfigLock`)와 겹치지 않는다 — 락 순서 변경/신규 락 중첩으로 인한 데드락 가능성 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:696`(`validateCanvasReferences` — DTO 자체 정합성만 검사, DB I/O 없음, 트랜잭션 진입 전), `codebase/backend/src/modules/schedules/schedules.service.ts:186-193`(`create` — `acquireTriggerConfigLock` 은 삭제 경로 전용이라 겹치지 않음)
  - 상세: `validateCanvasReferences`(캔버스 저장)는 요청 페이로드 안의 `nodes`/`edges` id 집합만 메모리에서 대조하므로 DB 조회가 없고, 따라서 이 자리엔 애초에 race window 가 없다(다른 리뷰가 이 함수를 지적했다면 오탐).
  - 제안: 없음.

- **[INFO]** 신규 async 함수 전부 `await` 누락 없이 정상 체이닝됨을 확인 — 검증 실패 시 `throwInvalidReferences`(동기 `throw`)가 항상 그 다음 `save`/`insert` 문장보다 먼저 실행되므로, 검증 실패 경로에서 부분 쓰기가 발생하는 사례는 diff 안에 없다
  - 위치: 위 발견사항 1의 파일 목록 전체
  - 제안: 없음(확인 목적 기록).

## 요약

이번 PR 은 Node.js/NestJS 단일 이벤트 루프 위에서 도는 신규 "소속 검증" 유틸(`assertReferenceInScope`/`throwInvalidReferences`)과 그 호출부 8곳(alerts·folders·schedules·triggers·edges·nodes·knowledge-base·workflow-assistant)을 추가한다. 새 뮤텍스·세마포어·워커 풀은 없고, 기존 pessimistic lock(`createVersion`)이나 advisory lock(`acquireTriggerConfigLock`) 경로와도 겹치지 않아 데드락 리스크는 없다. 유일하게 주목할 지점은 신규 검증이 전부 check-then-act(TOCTOU) 형태로, 검사와 저장 사이에 참조 대상이 동시에 삭제되면 저장이 FK 위반으로 실패할 수 있는 좁은 race window 가 있다는 점인데 — 이 shape 자체는 기존 `assertWorkflowInWorkspace`/`assertAuthConfigInWorkspace` 와 동형이고, 실측한 FK 액션(`ON DELETE CASCADE`/`SET NULL`)이 최종 방어선이라 최악의 결과가 요청 실패(500)에 그친다(데이터 오염이나 신규 보안 노출 없음). `KnowledgeBaseService` 의 순차 `await` 3회는 개수가 고정돼 있어 병목·경쟁 모두 아니다. 종합적으로 신규 concurrency 결함은 없고, 기존에 문서화된 TOCTOU 컨벤션의 반복일 뿐이다.

## 위험도
LOW
