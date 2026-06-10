# Testing Review

## 발견사항

### **[WARNING]** `resolveParallelEngineFlag` read-once 캐시 회귀 가드 누락
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `describe('env read-once cache (perf #14) — W2')`
- **상세**: 코멘트(라인 13708–13710)에 "resolveMaxNodeIterations / resolveParallelEngineFlag 가 configService.get 을 최초 1회만 호출하는지"라고 두 메서드 모두 명시했으나, 실제 테스트 케이스는 `MAX_NODE_ITERATIONS` 경로(`resolveMaxNodeIterations`)에만 2개 작성됐고 `PARALLEL_ENGINE` 키에 대한 `resolveParallelEngineFlag` read-once 검증 케이스는 구현되지 않았다. Parallel 실행 테스트 블록(라인 8710~)은 `PARALLEL_ENGINE=v1` 값을 반환하는 mock 을 설정하지만 configService.get 의 호출 횟수를 단언하지 않는다. 캐시가 깨져 매 실행마다 `PARALLEL_ENGINE` 을 재읽기해도 값이 동일하면 침묵하는 회귀가 발생할 수 있다.
- **제안**: W2 describe 블록에 다음 두 케이스를 추가한다. (1) `PARALLEL_ENGINE` 키로 첫 `execute` 에서 `configService.get` 이 1회만 호출됨을 단언, (2) 두 번째 `execute` 에서 `PARALLEL_ENGINE` 키 재호출 없음을 단언. 패턴은 동일 블록의 `MAX_NODE_ITERATIONS` 케이스를 그대로 준용한다.

---

### **[INFO]** `use-execution-events.test.ts` 주석의 `sortByStartedAt` 구 이름 잔존
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` 라인 294, 403
- **상세**: `sortByStartedAt` 함수는 삭제됐고 `selectSortedNodeResults` 로 대체됐다. 해당 테스트 주석 두 곳이 구 이름을 그대로 사용하고 있어, 이 주석이 설명하는 동작(timeline 정렬 회귀 가드)을 이해하려는 독자가 존재하지 않는 함수를 찾아 혼동한다. 일관성 검토(`naming_collision.md`)에서도 동일 사안을 INFO 로 기록하였다.
- **제안**: 주석 내 `sortByStartedAt` 를 `selectSortedNodeResults` 로 교체하거나 "(구 `sortByStartedAt`, 현 `selectSortedNodeResults`)" 병기를 추가한다. 기능 영향 없음.

---

### **[INFO]** `execution-engine.service.ts` 주석의 `sortByStartedAt` 구 이름 다수 잔존
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 4007, 4180, 5584, 5910, 6575
- **상세**: 백엔드 서비스 코드 5개 위치의 인라인 주석이 구 함수명 `sortByStartedAt` 을 참조한다. 테스트 용이성 측면에서 이들 주석은 `startedAtEpoch` 필드 또는 `selectSortedNodeResults` accessor 가 관여하는 코드 경로의 의도를 기술하므로, 새 이름을 반영하지 않으면 향후 해당 코드 경로를 테스트 케이스로 추적하려는 개발자가 오도될 수 있다.
- **제안**: 해당 주석 5개를 `selectSortedNodeResults` / `startedAtEpoch` 로 일괄 교체한다.

---

### **[INFO]** 스펙/리뷰 문서 변경 대상 — 테스트 적용 범위 외
- **위치**: `review/consistency/2026/06/10/20_30_25/` (파일 1~3), `spec/4-nodes/1-logic/10-parallel.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/4-file-storage.md`
- **상세**: 이번 diff 의 파일 1~6은 spec 문서·일관성 검토 보고서이며 테스트 대상 코드가 아니다. 이들 문서 변경 자체에 자동화 테스트를 적용하는 것은 범위 밖이다. 코드 동작 변경은 별도 구현 파일에 있으며 해당 파일들의 테스트 상태는 아래 요약에 기술한다.

---

## 요약

이번 변경의 핵심 구현(S3 `deleteMany`, `selectSortedNodeResults`, `resolveMaxNodeIterations`/`resolveParallelEngineFlag` read-once 캐시, rehydration N+1 배치 전환, `importWorkflow` 배치 insert, dashboard `getSummary` 쿼리 통합)은 전반적으로 테스트가 잘 갖춰져 있다. `s3.service.spec.ts` 는 `deleteMany` 엣지 케이스(빈 배열, 1000키 청크, 부분 실패, 네트워크 오류)를 명시적으로 커버하고, `knowledge-base.service.spec.ts` 는 best-effort 의미론 회귀 가드를 포함한다. `execution-engine.service.spec.ts` 의 W2 describe 블록은 `MAX_NODE_ITERATIONS` read-once 를 검증하지만, 동일 블록 주석에 명시된 `PARALLEL_ENGINE`(`resolveParallelEngineFlag`) 에 대한 대응 케이스가 누락된 것이 유일한 WARNING 사항이다. 나머지 두 INFO 사항은 삭제된 `sortByStartedAt` 이름이 주석에 남아 있는 테스트 가독성 문제로, 기능 회귀 위험은 없다.

## 위험도

LOW
