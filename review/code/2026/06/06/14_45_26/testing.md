# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] backend unit — `pending` 상태 노드 봉투 채택 경로 테스트 추가됨 (INFO#1 조치 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.spec.ts` 라인 72–96
- 상세: 이전 round 리뷰에서 지적된 `status='pending'` + `outputData.status='waiting_for_input'` 경로 테스트가 이번 diff 에 추가되어 있다. `form-node` 픽스처로 pending 상태 봉투 채택이 올바르게 검증된다. 지적 항목 해소됨.
- 제안: 없음.

### [INFO] backend unit — 복수 nodeExecutions 혼합 케이스 추가됨 (INFO#4 조치 확인)
- 위치: 동 파일 라인 122–163
- 상세: `completed` 노드와 `running+봉투=waiting` 노드가 공존하는 혼합 케이스가 추가됨. `trigger-node`(completed)는 그대로, `carousel-node`(intra-row inconsistent)만 정규화되는 것을 `nodeId` 기반 find 로 각각 단언한다. 선택적 변환 검증 완비.
- 제안: 없음.

### [INFO] backend unit — form/ai_agent nodeType 픽스처 미추가
- 위치: `executions.service.spec.ts` 추가된 테스트 케이스 전체
- 상세: `reconcilePreParkWaitingStatus` 는 nodeType 을 참조하지 않고 `outputData.status` 필드만 검사한다. 그러나 추가된 테스트 4건의 픽스처가 모두 `carousel-node` / `form-node` 에 한정되어 있다(form-node 는 pending 케이스에만 등장). `ai_agent` nodeType 에서 `outputData` 구조가 carousel 과 달라질 경우(`outputData.status` 필드 위치 동일 여부)를 명시 검증하는 케이스가 없다. 타입 캐스팅 `(ne.outputData as { status?: unknown } | null)?.status` 가 ai_agent 의 outputData shape 에서도 안전한지 구조 관점 coverage 가 비어 있다. 기능 회귀를 직접 유발하지는 않으나, 향후 ai_agent outputData 구조 변경 시 silent regression 위험이 있다.
- 제안: `ai_agent` nodeType + `running` + `outputData.status='waiting_for_input'` 픽스처로 케이스 한 건 추가하거나, 테스트 코멘트에 "nodeType 무관 — outputData.status 필드 위치 동일 보장됨" 을 명시해 의도를 드러낸다.

### [INFO] backend unit — `mockReturnValueOnce` 통일 (INFO#9 조치 확인)
- 위치: 동 파일 라인 45, 74, 101, 125
- 상세: 이번 diff 에 추가된 4개 테스트 모두 `mockReturnValueOnce` 를 사용하고 있음. 이전 round 지적(영구 mock 혼재) 해소됨.
- 제안: 없음.

### [INFO] frontend unit — `isNodeWaitingForInput` 직접 unit 테스트 9건 추가됨 (INFO#2 조치 확인)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/frontend/src/lib/websocket/__tests__/apply-execution-snapshot.test.ts` 라인 635 이하 `describe("isNodeWaitingForInput — 직접 unit")`
- 상세: `status=waiting_for_input`, `running+봉투`, `pending+봉투`, `completed+봉투(terminal 제외)`, `failed+봉투(terminal 제외)`, `skipped`, `outputData=null`, `outputData.status=undefined`, `outputData.status=completed` 등 9개 케이스를 직접 import 해 검증한다. null guard optional chaining(`?.`) 제거 시 회귀가 잡히는 케이스도 포함되어 있어 정밀한 회귀 가드를 제공한다.
- 제안: 없음.

### [INFO] frontend unit — `pending` 상태 intra-row inconsistency 케이스 추가됨 (INFO#1 프론트 조치 확인)
- 위치: 동 파일 라인 472 이하
- 상세: `ne.status='pending'` + `outputData.status='waiting_for_input'` 봉투 케이스에서 store.status 가 `waiting_for_input` 으로 격상되는지 검증하는 케이스가 추가됨. 이전 round 지적 해소됨.
- 제안: 없음.

### [INFO] frontend unit — form/ai_agent nodeType intra-row 케이스 추가됨 (INFO#3 조치 확인)
- 위치: 동 파일 라인 512 이하 form 케이스, 547 이하 ai_agent 케이스
- 상세: `form` 노드 + `meta.interactionType="form"` + `ne.status=running` + 봉투 waiting 조합이 `pauseForForm` 분기까지 올바르게 도달하는지 검증. `ai_agent` 도 동일하게 검증. carousel 전용 픽스처 지적 해소됨.
- 제안: 없음.

### [INFO] frontend unit — `prevStatus=waiting` 케이스에 `nodeStatuses` per-node 단언 누락 (이전 INFO#5 — 미조치)
- 위치: 동 파일 라인 338 이하 첫 번째 intra-row 테스트 (`prevStatus=waiting 시 waiting state 보존 (wipe 차단)`)
- 상세: 두 번째 케이스(라인 377, `prevStatus=running 첫 진입`)에는 `useExecutionStore.getState().nodeStatuses.get("carousel-node")?.status` 가 `"waiting_for_input"` 인지 단언이 있다. 그러나 첫 번째 케이스(wipe 차단 시나리오)에서는 per-node `nodeStatuses` 가 올바르게 유지/갱신됐는지 검증하는 단언이 없다. wipe 차단 경로에서 timeline 배지 상태가 의도치 않게 reset 되더라도 이 테스트가 통과할 수 있다.
- 제안: 첫 번째 intra-row 케이스에 `expect(useExecutionStore.getState().nodeStatuses.get("carousel-node")?.status).toBe("waiting_for_input")` 단언을 추가해 per-node 상태 보존도 검증한다.

### [INFO] channel-web-chat unit — race 수정 방향 올바름
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 라인 336–339
- 상세: `waitFor(() => callCount === 2)` → `waitFor(() => executionId === "e2")` 로 교체하고 `callCount` 단언을 후위로 이동했다. `executionId` state 커밋이 보장된 후 `callCount` 를 동기 단언하는 순서가 정확하며, 인라인 코멘트가 race 원인과 수정 이유를 명확히 설명한다. flaky 해소 방법 적절.
- 제안: 없음.

### [INFO] e2e — 기능 로직 변경 없음, 커버리지 유효
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: diff 전체가 Prettier 줄바꿈 정규화와 `expect(finalUserTexts).toEqual([...])` 배열 인라인화다. assertion 내용·순서·검증 값에 변경 없음. 기존 e2e 커버리지 완전히 유효.
- 제안: 없음.

### [INFO] 테스트 격리 — `mockReturnValue` 영구 mock 이 `beforeEach` 재생성으로 격리됨
- 위치: `executions.service.spec.ts` `beforeEach` (기존 코드)
- 상세: 이번 diff 에서 추가된 케이스는 모두 `mockReturnValueOnce` 를 사용하므로 영구 mock 오염 위험이 없다. 기존 `beforeEach` 에서 전체 mock 을 `jest.fn()` 으로 재생성하므로 테스트 순서 의존성도 없다. 격리 양호.
- 제안: 없음.

### [INFO] 테스트 가독성 — 의도 명확, 코멘트 충실
- 위치: 신규 추가된 모든 테스트 케이스
- 상세: 각 케이스에 pre-park window 메커니즘을 설명하는 블록 코멘트가 있고, describe 제목과 it 제목이 시나리오를 명확히 기술한다. `INFO#N` 참조 태그를 사용해 이전 리뷰 지적 항목과 연결고리가 있어 이력 추적이 용이하다.
- 제안: 없음.

---

## 요약

이번 변경은 Carousel blocking 노드 `pre-park window` intra-row inconsistency 회귀에 대한 테스트 커버리지가 크게 강화되었다. 이전 round 리뷰에서 지적된 INFO 항목 대부분(PENDING 분기, isNodeWaitingForInput 직접 unit, form/ai_agent nodeType, 복수 혼합 케이스, mockReturnValueOnce 통일)이 이번 diff 에서 조치됐다. 특히 frontend 의 `isNodeWaitingForInput` 직접 unit 테스트 9건은 null guard 및 terminal 제외 경계값을 정밀하게 검증하여 회귀 가드 완전성이 높다. 남은 미조치 항목은 (1) backend `ai_agent` nodeType 픽스처 부재(nodeType 무관 함수이나 outputData 구조 가정 명시 필요), (2) frontend 첫 번째 intra-row 케이스(`prevStatus=waiting` wipe 차단)의 per-node `nodeStatuses` 단언 누락으로 두 건 모두 INFO 수준이다. 전체적으로 테스트 구조가 TDD 원칙에 따라 설계됐으며, mock 격리·가독성·회귀 가드 측면에서 양호하다.

---

## 위험도

LOW

STATUS: SUCCESS
