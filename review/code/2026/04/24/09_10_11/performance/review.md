### 발견사항

---

- **[INFO]** `PROVIDERS_REQUIRING_BASE_URL`이 `ReadonlyArray`로 선언됨
  - 위치: `preview-llm-models.dto.ts:12-15`, `@ValidateIf` 클로저
  - 상세: `Array.includes()`는 O(n)이며, `@ValidateIf` 클로저 안에서 유효성 검사 호출마다 실행됨. 현재 요소가 2개(`'azure'`, `'local'`)여서 실측 차이는 없지만, provider 목록이 늘면 차이가 생김. `ReadonlySet`의 `has()`는 O(1).
  - 제안: `const PROVIDERS_REQUIRING_BASE_URL = new Set<LlmProvider>(['azure', 'local'] as const)` 로 변경. API 변경 없이 교체 가능.

---

- **[INFO]** `afterEach(() => vi.restoreAllMocks())` — `vi.mock()` 환경에서 실질적 no-op
  - 위치: `llm-configs.test.ts:14-16`
  - 상세: `vi.restoreAllMocks()`는 `vi.spyOn()`으로 만든 spy를 원본으로 돌리지만, 이 파일에서 사용한 `vi.mock('../client', ...)` 모듈 교체는 복원하지 않음. 매 테스트 종료 후 mock 레지스트리를 순회하는 비용이 발생하지만 효과는 없음.
  - 제안: `afterEach` 블록 제거. `beforeEach`의 `vi.clearAllMocks()`로 충분.

---

- **[INFO]** `(data?.data ?? data)` — data 접근 최대 2회
  - 위치: `llm-configs.test.ts:29, 73, 84` (실제 구현 파일 `llm-configs.ts` 기준)
  - 상세: `data?.data`가 falsy면 `?? data`로 다시 평가. 메모리 참조 두 번이라 실용적 영향은 없으나, transform interceptor 중앙화 후 이 패턴은 제거 대상임 (RESOLUTION W-12 참조).
  - 제안: 현행 유지. axios 인터셉터 통합 시 제거.

---

- **[INFO]** `plainToInstance` + `validate` 호출이 테스트마다 독립 수행됨
  - 위치: `preview-llm-models.dto.spec.ts:8-18` — `expectValidationError`, `expectNoErrors`
  - 상세: 14개 테스트 각각이 class-transformer 리플렉션 메타데이터 조회를 포함한 인스턴스 생성 + class-validator 실행을 반복. 개별 비용이 낮고 테스트 격리상 필요하므로 실용적 문제는 없음.
  - 제안: 현행 유지.

---

### 요약

이번 배치의 실제 구현 코드(`preview-llm-models.dto.ts`, `llm-configs.test.ts`)에서 주목할 성능 이슈는 경미한 수준이다. `PROVIDERS_REQUIRING_BASE_URL`의 Array→Set 전환은 provider 목록 확장 시를 대비한 방어적 개선이며, `vi.restoreAllMocks()` 제거는 테스트 실행 오버헤드를 줄이는 소소한 정리다. 백엔드의 Rate Limiting(10/60s), 30초 `withTimeout` + AbortSignal 전파, 외부 API 호출 차단 등 실질적 성능 위험 요소는 이미 RESOLUTION.md에서 모두 조치 완료된 상태다. 프론트엔드 `ModelCombobox`의 mutation 완료 시 이중 렌더 및 결과 캐싱 부재는 직전 리뷰(`2026-04-23_18-23-15/performance`)에서 WARNING으로 기록되어 있으며 본 배치 코드 범위 밖이다.

### 위험도

**LOW**