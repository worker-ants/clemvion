# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md`, `spec/data-flow/4-file-storage.md`, `spec/4-nodes/1-logic/10-parallel.md`, `spec/3-workflow-editor/3-execution.md` 관련 perf 백로그 01 구현 (diff-base: origin/main)

---

## 발견사항

### 요약: 신규 식별자 충돌 없음

이번 diff 에서 도입된 신규 공개 식별자는 총 6종이다.

1. `S3Service.deleteMany(keys)` — `spec/data-flow/4-file-storage.md` 에 이미 `deleteMany(keys)` 로 명시돼 있으며, spec 과 구현이 일치한다. 기존 코드베이스 내 다른 서비스에 동명 메서드가 없다.

2. `selectSortedNodeResults(results)` — 기존 `sortByStartedAt` 를 대체하는 read-only accessor 로 새로 export 된다. `sortByStartedAt` 은 내부(비공개) 함수였고 spec 에 등장하지 않는다. `selectSortedNodeResults` 는 spec 에도 plan 에도 기존 정의가 없다. 충돌 없음.

3. `resetNodeCatalogCacheForTesting()` — `system-prompt.ts` 에 신설된 test-only export. 동일 파일의 기존 `resetExpressionCacheForTesting()` 패턴을 명시적으로 따른다. 네이밍이 중복되지 않으며 spec 에 등장하지 않는다. 충돌 없음.

4. `ExecutionEngineService.findNodeResult(nodeExecutionId, nodeId)` — 새 공개 메서드(state 인터페이스). 기존 코드베이스·spec 에 동명 식별자 없음. 충돌 없음.

5. `resolveMaxNodeIterations()` / `resolveParallelEngineFlag()` — private 메서드 2종. spec 에는 `resolveExecutionRunWorkerConcurrency` 패턴이 §11 에 기술돼 있으며, 동일 read-once 규약을 명시적으로 준수한다. 두 메서드 이름은 기존 어디에도 없다. 충돌 없음.

6. `NodeResult.startedAtEpoch` — `NodeResult` 인터페이스에 추가된 optional 필드. spec 의 `NodeResult` 정의(`spec/3-workflow-editor/3-execution.md`)나 기존 코드에 동명 필드 없다. 충돌 없음.

### [INFO] `sortByStartedAt` 주석 잔존 (코드 내 참조)

- target 신규 식별자: `selectSortedNodeResults`
- 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 4007·4180·5584·5910·6575 행의 주석; `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` 294·403 행 주석
- 상세: `sortByStartedAt` 은 삭제됐으나 백엔드 execution-engine 코드 내 여러 인라인 주석과 프런트엔드 테스트 주석에 여전히 구(舊) 이름으로 언급된다. 기능 충돌은 아니지만 독자가 구 이름을 찾아 혼동할 수 있다.
- 제안: 해당 주석을 `selectSortedNodeResults` 로 일괄 교체하거나 "(구 `sortByStartedAt`)" 병기 추가. 기능에 영향 없으므로 INFO 등급.

---

## 요약

이번 구현이 도입한 공개 식별자(`deleteMany`, `selectSortedNodeResults`, `resetNodeCatalogCacheForTesting`, `findNodeResult`, `resolveMaxNodeIterations`, `resolveParallelEngineFlag`, `startedAtEpoch`)는 기존 spec·codebase 어느 곳에서도 다른 의미로 사용 중인 동명 식별자가 없다. `deleteMany` 는 spec 에 이미 선언된 이름과 정확히 일치하며, 신규 private 메서드들은 기존 `resolveExecutionRunWorkerConcurrency` 네이밍 패턴을 일관되게 따른다. 유일한 지적사항은 `sortByStartedAt` 라는 구 이름이 주석에 남아 있어 독자 혼란 가능성이 있으나 동작에 영향 없는 INFO 수준이다.

---

## 위험도

NONE
