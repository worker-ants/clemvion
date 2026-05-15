## 발견사항

### [WARNING] `listAllCafe24Operations()` 매 AI 실행 시 반복 배열 생성
- 위치: `metadata/index.ts` — `listAllCafe24Operations()` 함수
- 상세: `Cafe24McpToolProvider.buildTools()` 내에서 전체 작업 목록을 열거할 때 이 함수를 호출하면, AI Agent 실행이 시작될 때마다 ~100개의 `{ resource, operation }` 객체 쌍을 새로 생성합니다. 현재 규모(18 리소스 × ~5 ops)에서는 무시할 수준이나, 향후 메타데이터가 확장될 경우 hot path에서 반복 할당이 누적됩니다.
- 제안: 모듈 레벨에서 한 번만 계산해 상수로 캐싱 (`const ALL_CAFE24_OPERATIONS = listAllCafe24Operations()` 형태의 모듈 상수)

### [WARNING] `lookupMcpServers`에서 매 호출마다 배열 스프레드
- 위치: `candidate-lookup.service.ts:165` — `serviceType: [...MCP_CAPABLE_SERVICE_TYPES]`
- 상세: `[...MCP_CAPABLE_SERVICE_TYPES]` 스프레드는 호출 시마다 새 배열을 생성합니다. 이미 이 목적을 위해 `MCP_CAPABLE_SERVICE_TYPES_LIST: string[]`가 선언되어 있습니다.
- 제안: `serviceType: MCP_CAPABLE_SERVICE_TYPES_LIST` 로 교체 — 모듈 로드 시 한 번만 생성된 배열 재사용

### [WARNING] `findCafe24Operation()` 선형 탐색
- 위치: `metadata/index.ts` — `findCafe24Operation()` 함수
- 상세: 리소스별 ops 배열을 `.find()`로 선형 탐색합니다. 현재는 리소스당 최대 7개 연산으로 O(7) 수준이라 무해하지만, `cafe24.handler.ts`와 `cafe24-mcp-tool-provider.ts` 양측 모두의 **실행 hot path**에서 매 API 호출마다 호출됩니다. 리소스-연산 쌍 수가 늘면 직접 비용이 됩니다.
- 제안: 모듈 초기화 시 `Map<string, Map<string, Cafe24OperationMetadata>>` 형태로 index 구성 — O(1) 조회

### [WARNING] `encryptedJsonTransformer`의 동기 AES-256-GCM
- 위치: `integration-oauth-state.entity.ts` — `providerMeta` 컬럼 transformer
- 상세: `encryptedJsonTransformer`는 TypeORM entity hydration 시 동기적으로 AES-256-GCM 복호화를 수행합니다. OAuth state row는 TTL 10분 + callback 1회 소비이므로 트래픽은 낮지만, Node.js 단일 스레드에서 암호화 연산이 이벤트 루프를 짧게 차단합니다. `Integration.credentials`와 동일 transformer를 공유하므로 기존 결정과 일관성은 있습니다.
- 제안: 기존 `credentials` 컬럼과 동일 패턴이므로 현재는 허용 가능. 만약 OAuth begin 처리량이 증가한다면 `crypto.subtle`(WebCrypto, async) 기반 transformer로 마이그레이션 고려

### [INFO] 프론트엔드 `normalizeCafe24Fields` — memoization 없음
- 위치: `integration-configs.tsx` — `Cafe24Config` 컴포넌트 내 `normalizeCafe24Fields(config.fields)` 호출
- 상세: 부모 컴포넌트가 re-render될 때마다 `normalizeCafe24Fields`가 재실행됩니다. 설정 패널에서 다른 입력값이 변경될 때마다 불필요하게 호출됩니다. 현재 필드 수가 작아 실질적 영향은 없습니다.
- 제안: `const fields = useMemo(() => normalizeCafe24Fields(config.fields), [config.fields])` 로 래핑

### [INFO] `Cafe24ApiClient` 모듈 레벨 lock Map의 수명 관리
- 위치: `cafe24-api.client.ts` — `__resetCafe24LocksForTesting` 존재에서 추론되는 모듈 레벨 per-integration lock Map
- 상세: per-integration concurrency lock을 모듈 레벨 Map으로 관리할 경우, Integration이 삭제/비활성화되어도 lock 항목이 Map에서 제거되지 않으면 점진적 메모리 누수가 발생합니다. 장기 실행 서버에서 수백 개의 Integration이 생성/삭제되는 환경에서 누적됩니다.
- 제안: Integration 삭제 이벤트 또는 `Cafe24ApiClient`에 `releaseIntegrationLock(integrationId)` 메서드를 추가해 IntegrationsService의 삭제 흐름과 연동

---

## 요약

이번 변경셋은 전반적으로 성능 위험이 낮습니다. 대부분의 비용은 낮은 빈도의 OAuth 흐름(10분 TTL state row, 1회 callback)에 집중되어 있어 트래픽 부담이 작습니다. 주요 hot path인 AI Agent 실행 시 `listAllCafe24Operations()` 반복 호출과 `findCafe24Operation()` 선형 탐색은 현재 규모(~100 ops)에서는 무해하지만, Cafe24 API 커버리지가 확장될 경우 모듈 레벨 캐싱과 Map 인덱스로 선제 대응이 권장됩니다. `[...MCP_CAPABLE_SERVICE_TYPES]` 스프레드는 이미 준비된 `MCP_CAPABLE_SERVICE_TYPES_LIST`로 즉시 교체 가능한 trivial fix입니다.

## 위험도

**LOW**