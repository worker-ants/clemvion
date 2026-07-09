# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 재진입(re-entry) dispatch 의 `input` 변경 영향 범위가 코드 주석보다 넓음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1456-1478`(`reentryWorkflowInput` 신설 helper 및 docblock), 호출부 `:2092-2093`, `:2432-2433`, `:3213-3214`; 폴백 로직 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5978-6017`(`gatherNodeInput`)
  - 상세: `reentryWorkflowInput` 의 docblock 과 각 호출부 주석은 "이미 완료된 노드는 skip 되므로 미완료 **진입 노드**(entry node)에만 영향한다" 고 서술한다. 그러나 `gatherNodeInput` 을 보면 `workflowInput`(=이 `input` 파라미터)은 (1) incoming edge 가 없는 순수 entry 노드뿐 아니라, (2) incoming edge 가 1개인데 그 predecessor 가 아직 `executedNodes` 에 없는 경우("back-edge target on first run" — 코드 자체 주석 `// No executed predecessor (e.g., back-edge target on first run) → use workflow input`), (3) incoming edge 가 여러 개인데 전부 미실행인 경우에도 동일하게 폴백으로 쓰인다. 즉 이번 fix 는 Manual Trigger 진입 노드뿐 아니라, 재진입 시점에 predecessor 가 아직 실행되지 않은 루프/백엣지 타깃·다중입력 병합 노드에도 `{}` 대신 `savedExecution.inputData`(트리거의 `{ parameters, __triggerSource, ... }`)를 흘려보낸다. `driveResumeAwaited`/`driveStuckRedrive` 양쪽 모두 back-edge 활성화 시 `reachable.add(sortedNodeIds[activated.targetIndex])` 로 이미 지나간 노드를 재오픈하는 코드 경로가 실존해, 이론상 이 폴백이 트리거되는 상황이 재진입 흐름에서 발생 가능하다. 다만 `runExecution`(최초 정상 실행 경로)도 원래부터 동일한 `input`(원본 트리거 입력)을 이 폴백에 쓰고 있어, 이번 변경은 재진입 경로를 정상 경로와 일치시킨 것에 가깝고 완전히 새로운 미검증 동작은 아니다. 신규 e2e(`manual-trigger-default-param.e2e-spec.ts`)는 "크래시 전 미완료 entry 트리거" 시나리오만 결정적으로 검증하며, back-edge/다중입력 폴백 경로에 대한 회귀 테스트는 없다.
  - 제안: 주석을 "미완료 entry 노드"가 아니라 "predecessor 가 아직 실행되지 않은 모든 노드(entry 노드 및 back-edge 재진입 포함)"로 정정해 향후 유지보수자의 오해를 줄일 것. 기능 변경은 불필요해 보이나, 루프(백엣지)를 포함한 워크플로우의 crash-redrive/stalled-redelivery 조합에 대한 e2e 케이스 추가를 권장.

- **[INFO]** 저장 시 신규 400 게이트(`INVALID_TRIGGER_PARAMETERS`) — 인터페이스(공개 API) 동작 변경, 이미 하네스됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:586-619`(`validateManualTrigger`), 호출부 `saveCanvas:396-399`
  - 상세: `saveCanvas` → `validateManualTrigger` 에 malformed trigger parameter(빈 이름 등)를 거부하는 `BadRequestException({code:'INVALID_TRIGGER_PARAMETERS'})` 경로가 추가됐다. 이전에는 200 으로 저장되던 malformed 정의가 이제 400 을 받는다 — 의도된 spec 정합(§6)이지만 기존에 malformed 값을 이미 저장해 둔 워크스페이스가 재저장(`POST /:id/save`)을 시도하면 이전엔 성공하던 요청이 이제 실패한다. `restoreVersion` 은 신규 `skipParamSchemaValidation` 파라미터(기본값 `false`, 하위호환)로 예외 처리돼 있어 과거 스냅샷 복원은 영향받지 않는다.
  - 제안: 별도 조치 불요 — 배포 노트/체인지로그(이미 `CHANGELOG.md` 에 반영됨)에 계속 명시 권장. 잔존 malformed 데이터 정리는 `RESOLUTION.md` W6 후속 항목으로 이미 추적 중.

- **[INFO]** `loadTriggerParameterSchema` 조회 기준 변경(`category=TRIGGER` → `type=NODE_TYPES.MANUAL_TRIGGER`)이 5개 호출부에 공유 적용
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:33-35`; 호출부: `workflows.service.ts`, `workflows.controller.ts`, `schedule-runner.service.ts`, `hooks.service.ts`, `executions.service.ts`
  - 상세: 공유 유틸리티 시그니처(`Promise<TriggerParameterDefinition[] | undefined>`, 파라미터 목록)는 변경되지 않았고, 내부 조회 조건만 바뀌었다. `validateManualTrigger` 가 워크플로우당 Manual Trigger 노드를 최대 1개로 강제하므로 `type` 기준 조회도 유일성이 보장돼 다중 매치 위험은 없다. 신규 유닛 테스트(`load-trigger-parameter-schema.spec.ts`)가 category 누락 케이스를 커버.
  - 제안: 조치 불요 — 확인 목적 기록.

- **[INFO]** `reentryWorkflowInput` private helper 신설은 순수 함수, 부작용 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1479-1483`
  - 상세: `savedExecution.inputData ?? {}` 를 반환하는 단순 읽기 전용 메서드로 상태 변경·I/O 없음. 이전 라운드에 3개 호출부에 중복 인라인돼 있던 동일 표현식을 이번 커밋에서 이 helper 로 통합한 것 — 3번째 재진입 경로(`retry-turn.service.ts`)는 의도적으로 이 helper 를 쓰지 않고 `input: {}` 를 유지하며, 그 사유가 교차 주석으로 양쪽에 명시돼 일관성이 확보됨.
  - 제안: 조치 불요.

- **[INFO]** `workflows.service.ts` 의 `settings: { ...dto.settings } as Record<string, unknown>` → `settings: { ...dto.settings }` 캐스트 제거는 본 PR 스코프와 무관한 곁가지 변경
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:489`
  - 상세: 타입 단언만 제거된 순수 리팩터로 런타임 동작·부작용 없음. Manual Trigger 버그와 관련 없는 diff 노이즈.
  - 제안: 조치 불요(스코프 판단은 scope 리뷰어 소관).

- **[INFO]** 신규 e2e(`manual-trigger-default-param.e2e-spec.ts`)가 실행 테이블을 직접 DML 로 조작하고 `_test/simulate-execution-run-redelivery` 백도어를 호출
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:239-259`
  - 상세: 테스트가 `node_execution`/`execution_node_log` 행을 직접 `DELETE`, `execution.status` 를 직접 `UPDATE` 해 "트리거 실행 전 크래시"를 합성한다. 호출하는 `_test/simulate-execution-run-redelivery` 엔드포인트는 이번 diff 로 신설된 것이 아니라 기존에 `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트 + `@Roles('owner')` + ownership 검증으로 보호되는 기존 backdoor(PR4)이며, 이번 변경은 그 기존 훅을 재사용할 뿐이다. 프로덕션 표면 노출이나 새 전역 상태 변경은 없음.
  - 제안: 조치 불요 — e2e 전용 격리된 DB/컨테이너 범위 내 동작.

## 요약

이번 라운드(round 2)의 실질 변경은 (1) 이전 라운드에 이미 리뷰된 재진입 durable-input fix 3곳을 `reentryWorkflowInput` 단일 helper 로 통합(순수 함수, 신규 부작용 없음), (2) 크래시 전 미완료 entry 노드 재구동을 DB 직접 조작 + 기존 test-only backdoor 로 결정적으로 검증하는 e2e 추가, (3) `retry-turn.service.ts` 에 "왜 이 경로만 `input:{}` 을 유지하는지"를 설명하는 교차 주석, (4) CHANGELOG 갱신이다. 핵심 side-effect 소견은 이전 라운드부터 이어지는 것으로, 재진입 dispatch 의 `input` 변경이 문서(주석)가 명시하는 "미완료 entry 노드"보다 실제로는 `gatherNodeInput` 의 폴백 조건(백엣지 타깃·다중입력 미실행) 전체에 적용된다는 점이다 — 다만 이는 정상 실행 경로가 이미 쓰던 폴백 값과 재진입 경로를 일치시킨 것이라 새로운 미검증 동작이라기보다 기존 동작과의 일관성 회복에 가깝고, e2e 246/246 무회귀로 뒷받침된다. `saveCanvas` 의 신규 400 게이트는 의도된 공개 API 동작 강화이며 `restoreVersion` 예외·프론트 inline 검증·e2e 로 하네스돼 위험이 낮다. 새로 도입된 전역 변수, 예상치 못한 파일시스템 부작용, 환경 변수 read/write, 외부 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
