# 동시성(Concurrency) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 신설 참조-소속 검증 유틸의 check-then-act(TOCTOU) 패턴 — 신규 결함 아님, 기존 컨벤션과 동형
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:43` (`assertReferenceInScope` — `if (await repo.exists({ where })) return;`), 호출부 다수: `codebase/backend/src/modules/alerts/alerts.service.ts:31`(`assertReferenceInScope` 호출), `codebase/backend/src/modules/folders/folders.service.ts:46`·`150`(`assertParentInWorkspace`), `codebase/backend/src/modules/schedules/schedules.service.ts:188`, `codebase/backend/src/modules/triggers/triggers.service.ts:487`, 그리고 직접 `repo.exists`/`repo.find` 를 쓰는 `codebase/backend/src/modules/edges/edges.service.ts:76`(`assertEndpointsInWorkflow`), `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`)
  - 상세: 모든 신규 검증은 "SELECT(존재+소속 확인) → (다른 쿼리들) → INSERT/UPDATE" 순서이며 같은 트랜잭션으로 묶여 있지 않다. 이론적으로는 검사와 쓰기 사이에 참조 대상 행이 삭제되면 경합 창이 존재한다. 다만 실측 결과 이 리스크는 낮다 — 관련 엔티티(`Node`·`Edge`·`Workflow`·`Folder`)는 `workspace_id`/`workflow_id`를 애플리케이션 코드 어디에서도 재대입(이동)하지 않는 것으로 확인했고(`moveTo`/`reassign`/`transferWorkspace` 류 부재), FK(`onDelete: CASCADE`/`SET NULL`)가 id 단위로 걸려 있어 경합 창에서 삭제가 겹치면 최악의 경우도 (a) DB 제약 위반 500 또는 (b) CASCADE로 인한 자연스러운 소거일 뿐, 이 PR 이 막으려는 "다른 워크스페이스/워크플로 행이 조용히 저장되는" 시나리오로 되돌아가지는 않는다. 또한 이 check-then-act 형태는 이 PR 이 새로 들여온 것이 아니라 기존 `codebase/backend/src/modules/workflows/workflow-ownership.util.ts` 의 `assertWorkflowInWorkspace`(동일하게 `findOne({ where: { id, workspaceId } })` 후 아무 트랜잭션 보호 없이 이어지는 쓰기)와 동형이다 — 이번 PR 은 기존 컨벤션을 다른 참조 필드로 확장한 것뿐이다.
  - 제안: 조치 불요(현 상태 수용 가능). 다만 향후 워크플로/워크스페이스 간 "이동" 기능이 생기면 이 가정이 깨지므로, 그때는 check 와 write 를 단일 트랜잭션(+ `SELECT ... FOR SHARE`/advisory lock)으로 묶는 재검토가 필요하다는 점을 후속 백로그에 남겨두면 좋다.

- **[INFO]** 신규 검증 루프는 모두 순차 `await` — 병렬화 관련 버그 없음
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:97`~`117`(`assertPlacementInWorkflow` — `containerId`·`toolOwnerId` 를 `for...of` + `await` 로 순차 조회), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206`~`235`(`assertModelConfigRefsInWorkspace` — `extractionLlmConfigId`·`rerankConfigId`·`rerankLlmConfigId` 순차 `await`)
  - 상세: `Promise.all` 로 묶지 않아 지연시간이 필드 수만큼 누적되지만(성능 이슈), 경쟁 조건·await 누락·이벤트 루프 블로킹은 없다. `edges.service.ts` 의 `assertEndpointsInWorkflow` 는 오히려 `In([sourceNodeId, targetNodeId])` 단일 쿼리로 두 끝점을 한 번에 조회해 두 개의 개별 존재-확인 사이의 경합 가능성 자체를 없앤 설계다.
  - 제안: 조치 불요. 성능 관점(요청당 DB round-trip 수)은 기능 리뷰어/성능 리뷰어 영역.

- **[INFO]** 신규 코드에 락(mutex/advisory lock) · 트랜잭션 · 재시도 로직 신설 없음, 기존 `acquireTriggerConfigLock` 임계구역과 겹치지 않음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:188`(신규 검증) vs `codebase/backend/src/modules/schedules/schedules.service.ts:338`(`acquireTriggerConfigLock` — `remove` 경로에서만 사용)
  - 상세: 신규 검증 호출은 `create()` 안, 잠금 사용은 `remove()`/`update` 계열 안으로 서로 다른 메서드에 위치해 잠금 보유 시간 연장이나 신규 데드락 경로를 만들지 않는다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 요청 본문의 참조 id 가 다른 워크스페이스/워크플로를 가리키는지 저장 전에 거부하는 **입력 검증(IDOR/무결성) 기능**이며, 새로 도입한 뮤텍스·세마포어·이벤트 루프 조작·병렬 프로미스 조합은 없다. 유일하게 동시성 관점에서 짚을 만한 지점은 신설 `assertReferenceInScope`/`assertEndpointsInWorkflow`/`assertPlacementInWorkflow` 가 모두 "확인 후 쓰기(check-then-act)" 형태라는 점인데, 이는 이 저장소에 이미 있던 `assertWorkflowInWorkspace` 컨벤션과 동형이고, 관련 엔티티의 소속 필드(workspace_id/workflow_id)가 애플리케이션 어디에서도 재대입되지 않는다는 점(실측: `moveTo`/`reassign`/`transferWorkspace` 부재)과 FK 제약으로 인해 경합 창의 최악 결과가 500 오류에 그쳐, 이 PR 이 막으려는 교차 워크스페이스 저장 시나리오로 되돌아갈 실질적 경로는 없다. 검증 루프도 모두 순차 `await`(또는 단일 `In()` 쿼리)로 작성돼 있어 await 누락·레이스·데드락 징후는 관찰되지 않았다. 저장소 뮤테이션 없이 정적 분석만 수행했다(`git status --short` 변경 없음).

## 위험도

LOW
