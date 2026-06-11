# 성능(Performance) 리뷰 결과

## 발견사항

- **[INFO]** testConnection에서 probe embed 벡터 할당 — 단발성 연결 테스트 경로
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` L1528–1533 (`testConnection` 내 embedding 분기)
  - 상세: `client.embed(['connection test'], config.defaultModel)` 호출은 실제 임베딩 API를 1개 텍스트에 대해 호출하고 반환된 벡터(최대 수천 float)를 메모리에 올린다. 차원 감지 후 `vectors[0]?.length` 만 사용하고 나머지는 즉시 GC 대상이 되므로 누수 위험은 없다. 그러나 사용하지 않을 전체 벡터를 수신하는 네트워크 비용은 피할 수 없다. 연결 테스트 전용 경량 엔드포인트가 없는 경우 현재 접근은 합리적 트레이드오프이며, 이미 withRetry 없이 직접 await하고 있어 추가 retry 비용도 없다.
  - 제안: 현재 구조에서 추가 최적화 불필요. 향후 provider 클라이언트에 `ping()` 추상을 추가한다면 불필요한 벡터 수신을 줄일 수 있다.

- **[INFO]** `testMutation.onSuccess`에서 직렬 async 체인 (testConnection → update → invalidate)
  - 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` L2943–2964
  - 상세: embedding kind 연결 테스트 성공 시 `await modelConfigsApi.update(config.id, { dimension: dim })` → `invalidate()` 순서로 직렬 실행된다. `invalidate()` 는 단순 QueryClient 캐시 무효화라 I/O 없이 즉시 완료되므로 병렬화 효과가 없다. update API 호출 자체가 유일한 추가 레이턴시 원천이고, 성공 실패 무관하게 toast는 표시된다. 연결 테스트 → 자동 저장이라는 UX 의도와 정합한다.
  - 제안: 현재 설계에서 최적 수준. 향후 복수 설정에 대해 동시에 "Test All" 기능을 추가한다면 `Promise.allSettled` 배치 패턴을 고려할 것.

- **[INFO]** `clearClientCache`에서 listModelsCache 선형 순회
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` L1374–1377
  - 상세: `for (const key of this.listModelsCache.keys()) { if (key.endsWith(...)) ... }` 는 캐시 항목 수(N)에 비례하는 O(N) 순회다. 워크스페이스당 설정 수가 수십 개 수준이고 `clearClientCache` 호출 빈도가 낮아(설정 변경·삭제 시에만 호출) 실제 성능 임팩트는 무시할 수준이다.
  - 제안: 현재 규모에서는 허용 가능. 설정 수가 수백~수천 단위로 늘어날 경우, 역방향 인덱스(`configId → Set<cacheKey>`)를 별도 Map으로 관리하면 O(1) 삭제가 가능하다.

- **[INFO]** `testConnection` 내 `modelConfigService.findEntity` DB 조회 + `createClient` 클라이언트 생성 순서
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` L1521–1525
  - 상세: `testConnection` → `findEntity`(DB) → `createClient`(캐시 히트 시 즉시 반환) 순서는 정상이다. `createClient` 는 `clientCache` Map을 사용해 동일 configId에 대해 두 번째 호출부터는 O(1)로 재사용한다. `testConnection` 자체는 캐시를 우회하고 항상 실제 연결을 수행하는 것이 의도된 동작이다. listModels 결과 캐시(5분 TTL)와 대칭성이 있지만 testConnection은 사용자가 명시적으로 요청하는 단발 작업이라 캐시 불필요하다.
  - 제안: 없음.

- **[INFO]** `embed` 배치 처리 — 직렬 for 루프
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` L1495–1509
  - 상세: 20개 단위 배치를 직렬(`await`)로 처리한다. 45개 텍스트라면 batch 3개가 순차 실행되어 provider API latency가 3배 누적된다. 이는 대용량 임베딩 적재(document ingestion) 경로에서 병목이 될 수 있다. 단, rate limit 관리 측면에서 직렬 처리가 안전하고, 현재 `testConnection` 용 probe embed는 1개 텍스트라 해당 없다.
  - 제안: 해당 변경의 직접 범위는 아니지만, 대규모 임베딩 적재 시 `Promise.all` 병렬 배치 + 동시성 제한(예: p-limit) 패턴을 고려할 수 있다. 기존 설계의 의도적 직렬화라면 주석에 근거를 남기는 것이 좋다.

## 요약

이번 변경의 핵심은 `testConnection`의 config 조회 경로를 `LlmConfigService(kind=chat 고정)` → `ModelConfigService(kind 무관)`으로 교체하고, embedding kind에 대해 probe embed로 차원을 감지·반환하는 흐름이다. 성능 관점에서 신규 도입된 비용 요소는 세 가지다: (1) testConnection 시 DB 조회 서비스 교체(동등한 단일 DB 쿼리), (2) probe embed 호출로 소량 벡터 수신, (3) 프론트엔드 onSuccess에서 dimension이 변경된 경우 추가 PATCH 1회. 이 세 가지 모두 연결 테스트라는 명시적 사용자 액션의 맥락에서 발생하며, 핫 경로(채팅·임베딩 실시간 처리)와 무관하다. `clearClientCache`의 선형 순회나 embed 배치 직렬화 등 기존 설계상 유의할 점은 있으나, 이 변경이 새로 도입한 문제는 아니다. 전반적으로 성능 위험도가 낮은 변경이다.

## 위험도

LOW
