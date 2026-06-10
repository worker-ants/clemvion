# 문서화(Documentation) Review

## 발견사항

### [INFO] `sortByStartedAt` 주석이 코드에 잔존 — 독자 혼동 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 4007, 4180, 5584, 5910, 6575행 인라인 주석; `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` 294, 403행 주석
- 상세: `sortByStartedAt`는 삭제됐고 `selectSortedNodeResults`로 대체됐으나, 백엔드 실행 엔진 서비스와 프론트엔드 테스트 파일의 인라인 주석이 구(舊) 이름을 그대로 참조한다. 함수는 존재하지 않으므로 코드 독자나 IDE 탐색 시 혼동을 유발한다. 이미 일관성 검토(naming_collision.md)에서 INFO로 식별된 사항이다.
- 제안: 해당 주석에서 `sortByStartedAt` → `selectSortedNodeResults` 또는 "(구 `sortByStartedAt`, 현 `selectSortedNodeResults`)" 로 교정.

### [INFO] `selectSortedNodeResults` 함수 — JSDoc 적절, 단 WeakMap 캐시 만료 조건 미기재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/frontend/src/lib/stores/execution-store.ts` 382–394행
- 상세: 함수 JSDoc이 memoization 의미·정렬 기준·NaN 처리를 잘 기술하고 있다. 다만 WeakMap 기반 캐시의 만료 시점("같은 `results` 배열 참조가 교체되면 새 sort 발생")이 문서화되지 않아, 캐시가 언제 무효화되는지 독자가 추론해야 한다. INFO 수준이며 현재 주석으로도 합리적인 수준이다.
- 제안: 한 줄 추가 — `// Cache is keyed on the array reference; a new array (after addNodeResult replaces the ref) triggers a fresh sort.`

### [INFO] `S3Service.deleteMany` JSDoc — 문서화 충분, 반환형 설명 정확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/common/services/s3.service.ts` 85–92행
- 상세: JSDoc이 `errored` 필드 의미, 비실존 키 멱등 의미론, 호출자 용도(best-effort warn)를 명확히 기술하고 있다. spec `data-flow/4-file-storage.md`와의 정합도 갱신 완료됨이 확인된다. 별도 조치 불필요.
- 제안: 없음.

### [INFO] `resetNodeCatalogCacheForTesting` — JSDoc 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 49–55행
- 상세: "테스트 전용 진입점 — `resetExpressionCacheForTesting` 과 동일 규율. 프로덕션 코드는 호출하지 말 것."이라는 경고가 JSDoc에 명시돼 있다. 패턴 일관성도 유지된다.
- 제안: 없음.

### [INFO] `resolveMaxNodeIterations` / `resolveParallelEngineFlag` — private 메서드 주석 블록 JSDoc 수준 적절
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 862–884행
- 상세: 두 메서드를 묶어 설명하는 클래스 필드 수준 주석 블록(862–868행)이 spec §1.6/§11의 read-once 규약 참조, lazy 초기화 선택 이유, 단위 테스트 안전성을 기술하고 있다. private 메서드이므로 public JSDoc 필요성은 낮다. 기존 `resolveExecutionRunWorkerConcurrency` 패턴과 일관된다.
- 제안: 없음.

### [INFO] `findNodeResult` (Zustand state 인터페이스) — JSDoc 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/frontend/src/lib/stores/execution-store.ts` 265–275행
- 상세: `findNodeResult` 메서드는 인터페이스에 JSDoc이 있으며 O(1) 대체 목적, `nodeExecutionId` 존재 여부에 따른 predicate 분기, 기존 `.find()` 4개 사이트와의 의미 동치를 기술한다. 충분한 수준이다.
- 제안: 없음.

### [INFO] spec `10-parallel.md` 변경 — 문서화 적절, `PARALLEL_ENGINE` read-once 규약 명시됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/4-nodes/1-logic/10-parallel.md` 14행
- 상세: `PARALLEL_ENGINE` 환경변수에 "모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영" 문구가 추가됐다. `spec/5-system/4-execution-engine.md`의 `MAX_NODE_ITERATIONS` 행에도 동일 문구가 추가됐다. 두 spec 문서가 코드의 read-once 캐시 구현을 정확하게 반영한다.
- 제안: 없음.

### [INFO] `importWorkflow` 배치 insert 전제 — spec Rationale 미기재 (rationale_continuity.md 에서도 INFO로 식별)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/2-navigation/1-workflow-list.md` `## Rationale` 섹션 (변경 없음)
- 상세: `workflows.service.ts`의 `importWorkflow()`가 `manager.insert` 배치로 전환되면서 `@BeforeInsert` hook·cascade 부재를 런타임 전제로 둔다. 이 전제는 코드 주석에만 기술되고 spec Rationale에는 미기재돼 있다. "향후 hook 추가 시 배열 save 로 되돌릴 것" 경고도 코드 주석에만 있다. 기능 문서(spec의 외부 계약)는 변경되지 않았으나 Rationale의 단일 진실 원칙 관점에서 미흡하다.
- 제안: `spec/2-navigation/1-workflow-list.md` Rationale에 "현 구현은 `manager.insert` 배치를 사용 — `@BeforeInsert` hook·cascade 부재 전제; 향후 hook 추가 시 배열 `save` 로 복귀 필요" 를 1문장 추가하면 코드 주석 ↔ spec 정합 완성.

---

## 요약

이번 변경의 문서화 수준은 전반적으로 양호하다. 신규 공개 API(`S3Service.deleteMany`, `selectSortedNodeResults`, `findNodeResult`, `resetNodeCatalogCacheForTesting`, read-once private 메서드들)에 적절한 JSDoc 또는 인라인 주석이 있으며, spec 문서 2건(`10-parallel.md`, `4-execution-engine.md`, `4-file-storage.md`)도 코드 변경을 정확하게 반영한다. 주요 지적사항은 두 가지다: (1) 삭제된 `sortByStartedAt`이 백엔드 실행 엔진 서비스 5곳과 프론트엔드 테스트 2곳의 인라인 주석에 잔존해 독자 혼동을 유발하며(INFO), (2) `importWorkflow` 배치 insert의 hook 부재 전제가 코드 주석에만 있고 spec Rationale에 미기재된 점이 단일 진실 원칙에 미흡하다(INFO). 두 건 모두 기능 동작에 영향 없는 문서화 개선 과제다.

---

## 위험도

LOW
