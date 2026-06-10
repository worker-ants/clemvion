# 신규 식별자 충돌 검토 결과

## 발견사항

신규 충돌에 해당하는 항목이 없었다. 각 식별자에 대한 점검 결과는 아래와 같다.

### [INFO] `selectSortedNodeResults` — 기존 `sortByStartedAt` 대체, 충돌 없음

- target 신규 식별자: `selectSortedNodeResults` (exported function, `execution-store.ts`)
- 기존 사용처: `origin/main` 의 `execution-store.ts` 에는 `sortByStartedAt` 라는 module-private 함수만 존재하며, 동명의 exported 식별자는 없었다. 현재 브랜치에서 `sortByStartedAt` 는 완전히 제거되고 `selectSortedNodeResults` 로 대체됐다.
- 상세: 네이밍은 `selectPendingFormToolCallId` (기존 select-prefix export) 패턴과 정합하며, 기존 코드베이스 어디에도 `selectSortedNodeResults` 라는 이름의 다른 식별자가 없다. 소비 지점 4곳(run-results-drawer, use-expression-context, preview, use-execution-events 주석) 모두 동일 의미로 참조한다.
- 제안: 없음.

### [INFO] `S3Service.deleteMany` — 기존 TypeORM Repository 의 `delete`/`deleteMany` 와 혼동 가능성 점검

- target 신규 식별자: `S3Service.deleteMany(keys: string[]): Promise<{ errored: string[] }>` (`s3.service.ts`)
- 기존 사용처: TypeORM `Repository<T>.delete(…)` 및 `EntityManager.delete(…)` 가 광범위하게 사용되나, `deleteMany` 라는 이름은 이 브랜치 전체 백엔드 코드베이스에서 `S3Service` 와 그 소비처(`knowledge-base.service.ts`) 이외에는 등장하지 않는다. 동명의 메서드가 다른 서비스/리포지토리에 없다.
- 상세: 반환 형태 `{ errored: string[] }` 는 TypeORM `DeleteResult` 와 명시적으로 다르고, 주석에서도 "TypeORM `DeleteResult` 와 무관" 임을 명시한다. 기존 `s3Service.delete(key)` 와의 구분도 단수/복수 suffix 로 충분히 구별된다.
- 제안: 없음.

### [INFO] `resetNodeCatalogCacheForTesting` / `nodeCatalogCache` / `renderNodeCatalogCached` — `resetExpressionCacheForTesting` 패턴 그대로 반영

- target 신규 식별자: 세 이름 모두 `system-prompt.ts` 모듈 내부 식별자
- 기존 사용처: 동일 파일에 `expressionReferenceCache` / `resetExpressionCacheForTesting` / `getExpressionReferenceSection` 이 이미 존재하며, 새 식별자는 그것과 명확히 구분되는 이름을 사용한다. 다른 모듈에 동명의 export 가 없다.
- 상세: `resetNodeCatalogCacheForTesting` 은 테스트 전용 export 로 네이밍 규약(…ForTesting suffix)을 따른다. 모듈 외부에서는 `system-prompt.spec.ts` 만이 import 한다.
- 제안: 없음.

### [INFO] `resolveMaxNodeIterations` / `resolveParallelEngineFlag` / `maxNodeIterationsOnce` / `parallelEngineFlagOnce` — 기존 `resolveExecutionRunWorkerConcurrency` 패턴과 정합

- target 신규 식별자: `ExecutionEngineService` 의 private 멤버 4종 (`execution-engine.service.ts`)
- 기존 사용처: 동일 서비스 클래스에 해당 이름이 없었다. 인근 파일 `execution-limits.ts` 의 `resolveExecutionRunWorkerConcurrency` 는 module-level 함수이고 서비스 내부 메서드 이름과 namespace 가 다르다. 이름 중복 없음.
- 상세: `resolve*` prefix 는 "lazy 1회 읽기" 의미론을 표현하는 기존 컨벤션(execution-limits.ts 참고)과 정합한다.
- 제안: 없음.

### [INFO] `nodeResultIndexByExecId` / `lastIndexByNodeId` / `firstNoExecIdIndexByNodeId` / `findNodeResult` — execution-store 내부 신규 상태 필드

- target 신규 식별자: `ExecutionState` 인터페이스 필드 3종 + 메서드 1종 (`execution-store.ts`)
- 기존 사용처: `origin/main` 의 `ExecutionState` 에는 이 필드들이 없었다. `findNodeResult` 는 `use-execution-events.ts` 에서 4개 call-site 로 소비되며, 다른 스토어 파일에 동명의 함수/메서드가 없다.
- 상세: 필드명이 충분히 구체적(…IndexByExecId, …IndexByNodeId, firstNoExecId…)이어서 기존 `nodeResults` / `nodeStatuses` 와 의미 혼동 없음.
- 제안: 없음.

### [INFO] `buildAggQB` — 동일 spec 파일 내 두 describe 블록에서 동명 정의

- target 신규 식별자: `buildAggQB` (const, `dashboard.service.spec.ts` 라인 42, 328)
- 기존 사용처: 동일 파일 내에서만 두 번 정의되며, 각각 별도의 `describe(…)` 클로저(라인 33, 322) 내부에 있다. JavaScript lexical scope 상 충돌이 발생하지 않는다.
- 상세: 두 구현의 내용이 거의 동일하다. 중복 제거를 고려할 수 있으나 기능 충돌은 아니다.
- 제안(선택적): `describe` 블록 바깥 파일 top-level로 `buildAggQB` 를 한 번만 정의하면 중복이 사라지나, 현재 상태도 기능적으로 안전하다.

### [INFO] `completedStatus` SQL 파라미터 — dashboard와 background-runs 양쪽에서 사용

- target 신규 식별자: `:completedStatus` named parameter (`dashboard.service.ts` 라인 92, 103)
- 기존 사용처: `background-runs.service.ts` 에도 동명의 `:completedStatus` 파라미터가 있으나 별도 QueryBuilder 인스턴스 내에서 사용된다. TypeORM named parameter 는 QB 인스턴스 scope 로 완전히 격리된다.
- 상세: 충돌 없음. 각각의 QB 는 독립적인 파라미터 바인딩 컨텍스트를 가진다.
- 제안: 없음.

### [INFO] `DELETE_OBJECTS_MAX_KEYS` / `seenNodeIdSet` / `latestCompletedByNodeId` — 내부 상수/지역 변수

- 모두 단일 클래스 private 상수 또는 메서드 내 지역 변수로, 외부 노출 없음. 동명 식별자가 코드베이스 전체에서 확인되지 않는다.
- 제안: 없음.

---

## 요약

이번 변경(perf 백로그 01 전 항목 구현 완료 후 W1 테스트/주석 커밋 포함)이 도입하는 모든 신규 식별자는 기존 코드베이스의 다른 의미를 가진 식별자와 충돌하지 않는다. `selectSortedNodeResults` 는 기존 private `sortByStartedAt` 를 명시적으로 대체한 것이고, `S3Service.deleteMany` 는 기존 TypeORM Repository API 와 의미·반환형 모두 구분된다. `resetNodeCatalogCacheForTesting` 은 기존 `resetExpressionCacheForTesting` 패턴을 복제한 것으로 이름이 충분히 구별된다. 나머지 식별자들도 모두 새로 도입된 것으로 기존 등록된 이름과 겹치지 않는다. `buildAggQB` 중복 정의는 lexical scope 충돌이 없어 기능 문제는 아니나 INFO 수준의 개선 제안을 남긴다.

## 위험도

NONE

STATUS: SUCCESS
