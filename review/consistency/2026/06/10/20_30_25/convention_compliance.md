# Convention Compliance Review

**검토 모드**: `--impl-done` (구현 완료 후)
**대상 범위**: `spec/5-system/4-execution-engine.md`, `spec/data-flow/4-file-storage.md`, `spec/4-nodes/1-logic/10-parallel.md`, `spec/3-workflow-editor/3-execution.md` 에 관련된 구현 변경 (diff base: `origin/main`)
**검토 일시**: 2026-06-10

---

## 발견사항

### [INFO] `startedAtEpoch` 필드 — spec/conventions 에 명시 없음
- **target 위치**: `codebase/frontend/src/lib/stores/execution-store.ts` — `NodeResult` 인터페이스 신규 필드 `startedAtEpoch?: number`
- **위반 규약**: `spec/conventions/node-output.md` — NodeResult 의 내부 캐시 필드 추가는 spec/conventions 에 명시 없음. 단 `node-output.md` 규약은 backend `NodeHandlerOutput` 에 관한 것이므로 frontend store 에 대해서는 직접 규제 범위가 아님.
- **상세**: `startedAtEpoch` 는 AGENTS.md 참조(표시용 아님)를 JSDoc 에 명시하고 있어 의도가 명확히 주석화됨. 표기 규약(`@/lib/utils/date` 사용 원칙)과 충돌 없이 설계됨. 단순 내부 성능 캐시이므로 INFO 수준.
- **제안**: 현행 유지. 필요하다면 `spec/3-workflow-editor/3-execution.md` 의 execution-store 설계 설명에 내부 캐시 필드 존재를 한 줄 기재하면 문서 완결성 향상.

---

### [INFO] `S3Service.deleteMany` 반환 타입 `{ errored: string[] }` — 스펙 표기와 일관성 확인 필요
- **target 위치**: `codebase/backend/src/common/services/s3.service.ts` — `deleteMany(keys: string[]): Promise<{ errored: string[] }>`
- **위반 규약**: `spec/data-flow/4-file-storage.md` 에 `deleteMany(keys)` 가 등재됨. 반환 타입은 `{ errored: string[] }` 로 spec 본문과 일치함.
- **상세**: `spec/data-flow/4-file-storage.md` line 18 에 `deleteMany(keys)` 가 `delete(key)` 와 함께 메서드 목록에 기재되어 있으며 Rationale(line 138–140)에도 `Errors[].Key` 를 일괄 warn 하는 best-effort 의미론이 명시됨. 구현과 스펙 기술이 일치한다.
- **제안**: 해당 없음.

---

### [INFO] `execution-store` 내 인덱스 Map 3종 추가 (`nodeResultIndexByExecId`, `lastIndexByNodeId`, `firstNoExecIdIndexByNodeId`) — spec 미기재
- **target 위치**: `codebase/frontend/src/lib/stores/execution-store.ts` — `ExecutionState` 인터페이스 3개 Map 필드 추가
- **위반 규약**: `spec/3-workflow-editor/3-execution.md` 가 execution-store 의 state shape 을 기술하는 경우, 새 파생 index Map 이 spec 에 미반영이면 spec-impl 갭.
- **상세**: 해당 Map 들은 외부에 직접 노출되지 않는 성능 구현 세부 사항(O(1) predicate)으로 JSDoc 에 "not meant to be React-subscribed" 가 명시됨. 노출 API(`findNodeResult`) 만 spec 에 기재되면 충분하며, 내부 파생 자료구조는 구현 세부에 해당함.
- **제안**: `spec/3-workflow-editor/3-execution.md` 에서 execution-store 의 공개 인터페이스(`findNodeResult`, `selectSortedNodeResults`) 를 언급하는 단락이 있다면 해당 accessor 를 등재하면 충분. 내부 Map 3종 자체는 spec 기재 불요.

---

### [INFO] `resolveMaxNodeIterations` / `resolveParallelEngineFlag` — spec §1.6 의 "모듈 로드 시 1회 읽음" 규약에서 "lazy 초기화"로 구현 방식이 달라짐
- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 803–818 — `private maxNodeIterationsOnce: number | null = null` + `resolveMaxNodeIterations()` lazy 패턴
- **위반 규약**: `spec/5-system/4-execution-engine.md` §1 표의 `MAX_NODE_ITERATIONS` 설명 — "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 (§11 worker env 들과 동일 규약)". `EXECUTION_RUN_WORKER_CONCURRENCY` 등 §11 env 들도 동일 표현.
- **상세**: spec 은 "모듈 로드 시 1회" 를 기술하나 구현은 "최초 실행 시 lazy 초기화" 임. 인스턴스 재시작 후 최초 `execute()` 호출 전까지는 env 를 아직 읽지 않는 시점 차이가 있음. 그러나 spec 의 핵심 불변식("변경은 인스턴스 재시작 시 반영")은 유지됨 — lazy 도 같은 인스턴스 내에서 캐시됨. JSDoc 에도 "lifecycle hook 대신 lazy 초기화라 단위 테스트에서도 안전하다" 를 명시해 의도가 문서화됨.
- **제안**: spec §1 표의 `MAX_NODE_ITERATIONS` 설명을 "첫 실행 경로 진입 시 1회 읽음(lazy, 인스턴스 수명 동안 캐시됨) — 변경은 인스턴스 재시작 시 반영" 으로 미세 조정하거나, 현행 "모듈 로드 시" 기술을 허용 범위로 보고 spec 갱신 불요 처리하면 됨. 규약 핵심 불변식("인스턴스 재시작 시 반영") 은 보존되므로 INFO 수준.

---

### [INFO] `assertNoContainerCycle` 시그니처 변경 — spec 미기재
- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — private 메서드 시그니처 `(containerNode, allNodes)` → `(containerNode, children, byId)` 변경
- **위반 규약**: spec/conventions 에 private 메서드 시그니처는 규약 대상이 아님.
- **상세**: private 메서드이므로 명명 규약·API 문서 규약 적용 외. 에러 코드(`CONTAINER_CYCLE`) 는 `spec/conventions/error-codes.md` §1 의 의미 기반 명명 원칙을 준수(`CONTAINER_CYCLE` = 조건 기술). 변경은 순수 리팩터링으로 외부 계약 불변.
- **제안**: 해당 없음.

---

### [INFO] `importWorkflow` 배치 insert — `spec/conventions/swagger.md` DTO 명명 비해당
- **target 위치**: `codebase/backend/src/modules/workflows/workflows.service.ts`
- **위반 규약**: 없음. 해당 변경은 내부 서비스 로직(트랜잭션 내 ORM 호출 최적화)이며 DTO 명명·Swagger 데코레이터 변경이 없음.
- **상세**: `QueryDeepPartialEntity<Node>` 단언 사용은 TypeORM 내부 quirk 대응으로 api-convention 과 무관. JSDoc 에 "향후 hook 추가 시 배열 save 로 되돌릴 것" 주석으로 소비 조건이 명확히 기록됨.
- **제안**: 해당 없음.

---

### [INFO] `selectSortedNodeResults` — `spec/3-workflow-editor/3-execution.md` 에 미등재 가능성
- **target 위치**: `codebase/frontend/src/lib/stores/execution-store.ts` — 신규 export `selectSortedNodeResults`
- **위반 규약**: `spec/3-workflow-editor/3-execution.md` 이 execution-store 공개 API 를 기술하는 경우 누락.
- **상세**: `selectSortedNodeResults` 는 WeakMap-memo 로 구현된 read-only accessor 로, 3개 소비처(run-results-drawer, use-expression-context, transform/preview) 에서 import 됨. 공개 API 변경으로서 spec 에 언급이 있으면 이상적이나, execution-store 의 구현 세부를 spec 이 상세 기술하는 영역인지 먼저 확인 필요.
- **제안**: `spec/3-workflow-editor/3-execution.md` 또는 관련 execution 설계 문서에 "정렬은 store 내부가 아닌 `selectSortedNodeResults` accessor 가 담당" 을 한 줄 기재하면 spec-impl 정합성 향상.

---

## 요약

이번 구현 변경(perf 백로그 01 — rehydration 배치/KB deleteMany/dashboard 집계/import 배치/env read-once/frontend execution-store B안)은 정식 규약(`spec/conventions/**`) 을 직접 위반하는 CRITICAL/WARNING 항목이 없다. 주요 관찰 사항은 다음과 같다: (1) `S3Service.deleteMany` / KB best-effort 배치 삭제 구현이 `spec/data-flow/4-file-storage.md` Rationale 과 정확히 일치함. (2) `MAX_NODE_ITERATIONS` 환경변수의 "모듈 로드 시 1회" spec 기술과 실제 lazy 초기화 구현 사이에 미세한 시점 차이가 있으나 핵심 불변식("인스턴스 재시작 시 반영")은 유지되어 INFO 수준에 해당함. (3) frontend execution-store 의 신규 내부 Map 3종 및 `selectSortedNodeResults` accessor 는 spec/conventions 직접 규제 대상이 아닌 구현 세부로, spec 문서 보완이 권장되나 블로킹 사안은 아님. (4) 에러 코드(`CONTAINER_CYCLE`) 는 `spec/conventions/error-codes.md` §1 의미 기반 명명 원칙을 준수함. 모든 발견사항은 INFO 수준이며 규약 invariant 를 깨는 항목은 없음.

## 위험도

**NONE**
