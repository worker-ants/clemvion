# 신규 식별자 충돌 검토

target: `plan/in-progress/refactor/01-performance.md` (성능 refactor 백로그, 유효 13건 구현)

target 은 **기능 spec 이 아니라 기존 코드 성능 refactor 계획**이다. 새 요구사항 ID·엔티티·DTO·endpoint·이벤트·ENV var·spec 파일을 도입하지 않으며, 기존 식별자(KB-GR-SR-06, NAV-SC-06, CONTAINER_CYCLE, V034 인덱스, S3_BUCKET, MAX_NODE_ITERATIONS, PARALLEL_ENGINE 등)를 **참조**할 뿐이다. 따라서 충돌 검토 표면은 "신규 도입 메서드/필드/CTE 이름이 기존 사용처와 겹치는가" 로 한정된다.

## 발견사항

- **[WARNING] 신규 테스트 리셋 헬퍼 명명이 기존 자매 헬퍼 컨벤션과 불일치**
  - target 신규 식별자: `resetNodeCatalogCacheForTesting` (#7 개선방안 1, `workflow-assistant/prompts/system-prompt.ts`)
  - 기존 사용처: 같은 파일 `system-prompt.ts:35` 의 기존 헬퍼 명은 `resetExpressionCacheForTesting()` (line 26 주석 + line 35 export). target #7 이 "복제 대상" 으로 지목한 캐시 패턴(`expressionReferenceCache`)의 리셋 헬퍼다.
  - 상세: 충돌(동일 이름 재정의)은 아니다. 그러나 target 은 `resetNodeCatalogCacheForTesting` 으로, 기존은 `resetExpressionCacheForTesting` 으로 — 같은 파일·같은 패턴에서 `Cache` 토큰 위치/유무가 엇갈린다(`expressionReference**Cache**` 변수지만 헬퍼는 `resetExpression**Cache**ForTesting`; 변수 `expressionReferenceCache` ≠ 헬퍼 토큰 `ExpressionCache`). target 신규는 변수를 `nodeCatalogCache` 류로 둘지 `nodeCatalogReferenceCache` 류로 둘지에 따라 헬퍼명과의 정합이 또 갈린다.
  - 제안: 신규 헬퍼를 **기존 자매와 동일 토큰 구조**로 맞춘다 — 변수 `nodeCatalogCache` + 헬퍼 `resetNodeCatalogCacheForTesting` (현 plan 명 그대로 OK), 또는 기존을 따라 `resetNodeCatalogForTesting`. 한 파일 내 두 리셋 헬퍼의 토큰 패턴을 통일할 것. (코드 단계 결정 — plan 텍스트 수정 불요, 구현자 주의 사항.)

- **[INFO] `deleteMany` — 동일 모듈 내 동음이의(同音異義) 메서드 다수 존재**
  - target 신규 식별자: `S3Service.deleteMany(keys: string[]): Promise<{ errored: string[] }>` (#2 개선방안 1, `common/services/s3.service.ts`)
  - 기존 사용처: `S3Service`(s3.service.ts:12-80) 에는 `upload`/`download`/`delete` 만 존재 — **`deleteMany` 충돌 없음**. 다만 코드베이스 전역에 `deleteMany`(agent-memory 등 TypeORM repository 의 `deleteMany` 류), `deleteWebhook`/`deleteCredential`/`deleteEntity`/`deleteRelation`/`deleteMemory`/`deleteWorkspace` 등 `delete*` 메서드가 다수 있다.
  - 상세: 클래스 스코프가 다르므로 실제 충돌·혼선 위험 없음. `deleteMany` 라는 이름은 TypeORM `Repository.delete`/배치 의미와도 자연스럽다.
  - 제안: 없음. 현 명명 유지 무방. (`deleteMany` 반환 형 `{ errored: string[] }` 가 TypeORM `DeleteResult` 와 다른 모양이라는 점만 구현 시 JSDoc 으로 명시하면 충분.)

- **[INFO] 신규 CTE 이름 `traversal_stats` — 기존 RAG CTE 네임스페이스와 비충돌**
  - target 신규 식별자: `traversal_stats AS (SELECT COUNT(DISTINCT entity_id) FROM expanded)` CTE (#12 개선방안 2, `rag-search.service.ts`)
  - 기존 사용처: 같은 graph-traversal 쿼리(rag-search.service.ts:572-704)의 기존 CTE 명 — `seed`, `seed_entities`, `expanded_entities`, `expanded_chunks`, `max_mention`, `expanded`. `traversal_stats` 는 이 집합과 겹치지 않는다.
  - 상세: 충돌 없음. 다만 `traversal_stats` 의 카운트 결과는 기존 응답 필드 `traversedEntityCount`(rag-search.service.ts:97,698 + search-result.interface.ts:18, KB-GR-SR-06 표면 수치) 로 매핑돼야 한다 — target #12 가 "seed 동등성 검증 선행, 의미 변경 시에만 spec §4.3 갱신" 으로 이미 가드한 부분이다.
  - 제안: 없음. CTE 명은 `expanded`/`seed` 등 기존 snake_case prefix 컨벤션과 일관(`traversal_stats`). 권장: `traversed_stats` 보다 `traversal_stats` 가 출력 필드 `traversedEntityCount` 와의 어휘 연결이 약간 멀므로, 통합 시 SQL alias 를 `traversed_entity_count` 로 두면 매핑이 직관적.

- **[INFO] 신규 파생 인덱스/필드명 — 기존 store 자료구조와 비충돌**
  - target 신규 식별자: `nodeResultIndex: Map<nodeExecutionId, number>` + `latestIndexByNodeId` (#8), `startedAtEpoch` 캐시 필드(#3), `nodeIdMap`(#10)
  - 기존 사용처: `frontend/src/lib/stores/execution-store.ts` grep 상 `nodeResultIndex`/`latestIndexByNodeId`/`startedAtEpoch` 미존재 — 신규. `nodeIdMap` 은 `workflows.service.ts:269` 에 **이미 존재**하나, target #10 이 가리키는 바로 그 import 경로의 기존 지역 변수(`const nodeIdMap: string[]`)다 — target 은 이를 "UUID 사전 생성으로 insert 전 확정" 으로 **재사용/개선**할 뿐 새 의미로 충돌 도입하지 않음.
  - 상세: 충돌 없음. `nodeIdMap` 은 동일 함수의 기존 식별자를 그대로 활용하는 것이라 오히려 일관적.
  - 제안: 없음.

## 요약
target 은 기능 spec 이 아닌 기존 코드 성능 refactor 백로그로, 새 요구사항 ID·엔티티·DTO·API endpoint·이벤트·ENV var·spec 파일 경로를 일절 도입하지 않고 기존 식별자(KB-GR-SR-06·V034·S3_BUCKET·PARALLEL_ENGINE 등)를 참조만 한다. 신규로 도입되는 표면은 메서드 `S3Service.deleteMany`, 파생 인덱스 `nodeResultIndex`/`latestIndexByNodeId`, 캐시 필드 `startedAtEpoch`, CTE `traversal_stats`, 테스트 리셋 헬퍼 `resetNodeCatalogCacheForTesting` 정도이며, 코드 검증 결과 **기존 사용처와의 의미 충돌(동일 식별자 재정의)은 발견되지 않았다**. 유일하게 주의할 점은 #7 의 신규 리셋 헬퍼명이 같은 파일·같은 캐시 패턴의 기존 자매 헬퍼 `resetExpressionCacheForTesting` 와 토큰 구조가 엇갈릴 수 있다는 명명 일관성(WARNING) 한 건으로, 충돌이 아니라 구현 단계 컨벤션 정렬 사항이다.

## 위험도
LOW
