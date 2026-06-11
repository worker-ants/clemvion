# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경된 파일 5개를 동시성/병렬 처리 관점에서 분석했습니다.

- `llm.module.ts` — NestJS 모듈 등록, 정적 메타데이터 선언만 포함
- `llm.service.spec.ts` — 테스트 파일, 런타임 동시성 없음
- `llm.service.ts` — 핵심 서비스 로직 (신규 `testConnection` / `listModels` 경로)
- `model-config-response.dto.ts` — DTO 필드 추가만
- `model-config-manager.test.tsx` — 프론트엔드 컴포넌트 테스트

### llm.service.ts — `listModels` 캐시 경쟁 조건 (기존 코드에도 존재, 변경에서 확장됨)

- **[INFO]** `listModels` 에서 캐시 읽기(miss 판정) → 외부 I/O(DB + 원격 API) → 캐시 쓰기가 비원자적으로 수행됩니다.
  - 위치: `/codebase/backend/src/modules/llm/llm.service.ts` `listModels()` (라인 1553–1580)
  - 상세: NestJS는 단일 Node.js 이벤트 루프 위에서 동작하므로 진정한 스레드 병렬 경쟁은 없습니다. 그러나 `await this.modelConfigService.findEntity(...)` 와 `await withTimeout(...)` 사이에 동일 `cacheKey` 로 다른 코루틴이 동일한 경로를 통과할 수 있습니다(duplicate fetch). 결과적으로 같은 엔드포인트에 대해 짧은 시간 안에 다수 요청이 들어오면 provider API 를 중복 호출하게 됩니다. 데이터 오염은 없고 캐시 최종 상태도 일관적이나, 불필요한 외부 호출이 발생합니다.
  - 제안: in-flight 요청을 `Map<string, Promise<ModelInfo[]>>` 로 dedup 하는 패턴("promise coalescing")을 적용하면 해소됩니다. 다만 이는 이번 변경이 새로 도입한 문제가 아니라 기존 코드에 이미 존재했던 것이며 이번 diff 가 확장한 정도이므로 즉각 차단 사항은 아닙니다.

### llm.service.ts — `testConnection` embedding 경로, 동시성 안전

- **[INFO]** 신규 `config.kind === 'embedding'` 분기는 `await client.embed(...)` 한 번만 호출하고 바로 반환합니다. 공유 가변 상태를 건드리지 않으며, `clientCache` 는 `createClient` 를 통해 동일한 단일 Map 접근 패턴을 따릅니다. 경쟁 조건 없음.
  - 위치: `llm.service.ts` 라인 1529–1536

### llm.service.ts — `clientCache` / `listModelsCache` (Map) 스레드 안전성

- **[INFO]** `clientCache` 와 `listModelsCache` 는 `private readonly Map` 으로 선언되어 있고 Node.js 싱글 스레드 이벤트 루프 위에서만 접근됩니다. Worker Threads 나 Cluster 모드를 사용하지 않는 이상 스레드 안전 이슈 없음. `clearClientCache` 가 두 캐시를 동시에 수정하는 것도 동기 코드이므로 안전합니다.

### llm.service.spec.ts, model-config-manager.test.tsx — 테스트 격리

- **[INFO]** `beforeEach` 에서 `mockModelConfigService` 를 매 케이스마다 새로 생성하므로 describe 간 상태 누출 없음. `jest.useFakeTimers` / `jest.useRealTimers` 가 `try/finally` 로 정리되어 타이머 누출도 없음.

## 요약

이번 변경(embedding testConnection 경로 추가, kind-agnostic ModelConfigService 주입)은 동시성 관점에서 새로운 위험을 도입하지 않습니다. 핵심 변경은 단순한 `await` 직렬 호출로 구성되며, 공유 상태를 변경하지 않습니다. 기존 `listModels` 캐시에서 발생할 수 있는 duplicate-fetch 패턴(캐시 미스 후 동시 요청이 provider 를 중복 호출하는 coalescing 미적용 문제)은 이번 diff 가 `modelConfigService.findEntity` 로 교체하면서 약간 확장되었으나, 이는 기존 설계 한계이며 데이터 일관성에는 영향이 없습니다.

## 위험도

NONE
