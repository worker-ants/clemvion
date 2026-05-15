# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — SSRF 방어가 HTTP 스킴 제한에 그쳐 사설 IP 대역(AWS IMDS, 10.x.x.x 등) 차단이 미구현. 그 외 기능 정확성에 영향을 주는 버그는 없으나 타입 안전성, 상태 관리, 이중 정의 관련 유지보수 경고가 다수 존재.

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **SSRF: `@IsUrl`이 스킴만 차단, 사설 IP 대역 무방비** — `http://169.254.169.254/`, `http://10.x.x.x/` 등이 DTO 검증을 통과함. `editor` 권한 + Rate Limit으로 공격 면이 좁으나 클라우드 환경에서 인프라 정보 수집 경로가 됨 | `preview-llm-models.dto.ts:47` | 서비스 레이어에서 `provider !== 'local'` 일 때 hostname이 루프백·링크로컬·사설 대역인지 차단하는 guard 추가 (`169.254.`, `10.`, `172.16-31.`, `192.168.` 블록) |
| 2 | Architecture / Maintainability | **`as never` 타입 단언으로 서비스 계약 drift 무음 허용** — `LlmService.previewModels` 시그니처 변경 시 컴파일 오류 없이 통과. 권한·인가 관련 메서드 변경도 테스트가 감지 못함 | `llm-config.controller.spec.ts:24-26` | `jest.Mocked<Pick<LlmService, 'previewModels' \| 'listModels' \| 'testConnection'>>` 로 명시적 타입 선언 |
| 3 | Architecture / Maintainability | **`useSavedConfig && configId` 이중 검사** — `useSavedConfig = Boolean(configId) && !trimmedKey`가 이미 `configId` 존재를 보장하므로 `&& configId` 는 항상 참. 분기 단일 진입점이 희석됨 | `model-combobox.tsx:65` | `if (useSavedConfig)` 로 단순화 |
| 4 | Side Effect | **`models` state가 props 변경 시 초기화되지 않음** — `provider`/`configId` 변경 후 버튼을 누르지 않으면 이전 프로바이더의 모델 목록이 datalist에 잔존해 autocomplete 오염 발생 | `model-combobox.tsx:27` | `useEffect(() => { setModels([]); }, [provider, configId])` 추가 |
| 5 | Maintainability / Testing | **`clearClientCache` mock이 어떤 테스트에서도 미검증** — `previewModels` 핸들러가 이 메서드를 호출하지 않음에도 mock에 포함되어 계약인 것처럼 오독됨 | `llm-config.controller.spec.ts:10, 22` | `clearClientCache` 항목 제거, 또는 `not.toHaveBeenCalled()` 어서트 추가 |
| 6 | Maintainability | **`onSuccess`에서 `setErrorMessage(null)` 중복 호출** — `onMutate`에서 이미 초기화되어 중복. 불필요한 렌더 유발 및 "성공 시 에러 발생 가능" 거짓 인상 | `model-combobox.tsx:69-71` | `onSuccess` 내 `setErrorMessage(null)` 제거 |
| 7 | Architecture / Testing | **`data?.data ?? data` fallback이 임시 우회를 영구 계약으로 고착화** — 인터셉터 중앙화 시 걸림돌이 됨. `previewModels`의 fallback 케이스에는 `(interim...)` 표시 없어 비대칭 | `llm-configs.test.ts:34-43` | `previewModels` fallback 케이스에 `// TODO: W-12 중앙화 후 제거` 주석 추가 및 테스트 이름에 `(interim...)` 명시 |
| 8 | Performance | **mutation 완료 시 이중 렌더** — `isPending → isSuccess` 전환 렌더 + `setModels()` / `setErrorMessage()` 호출 렌더가 별개로 발생. `models`와 `loadMutation.data` 이중 진실 소스 구조가 원인 | `model-combobox.tsx:57-70` | `loadMutation.data`에서 직접 파생하고 local `models` state 제거. `chatModels`는 `useMemo(() => (loadMutation.data ?? []).filter(m => m.type === 'chat'), [loadMutation.data])` 처리 |
| 9 | Architecture / Dependency | **프로바이더 도메인 규칙이 프론트·백엔드에 이중 하드코딩** — `PROVIDERS_REQUIRING_BASE_URL`, `LOCAL_PROVIDER` 등이 각각 독립 정의되어 컴파일 타임 동기화 보장 없음. `azure` 추가/제거 시 silent bug 발생 가능 | `model-combobox.tsx:22,34` vs `preview-llm-models.dto.ts:12` | 단기: `@/lib/constants/llm-providers.ts` 공유 상수 파일 도입. 중기: monorepo `/packages/shared` 에서 단일 출처 관리 |
| 10 | Architecture / Dependency | **`axios` 직접 import — UI 레이어가 HTTP 클라이언트에 직접 결합** — `axios.isAxiosError` 1회 호출을 위해 컴포넌트가 구현 세부사항에 의존 | `model-combobox.tsx:5` | API 레이어(`llm-configs.ts`)에서 에러를 domain 에러로 변환 후 throw하거나, `@/lib/api/client`에 `isApiError()` 유틸리티 export |
| 11 | Maintainability | **`trimmedBaseUrl` verbose ternary + `apiKey.trim()` 중복 평가** — `trimmedBaseUrl ? trimmedBaseUrl : undefined`는 `trimmedBaseUrl \|\| undefined`로 충분. `apiKey.trim()`이 `mutationFn`과 `canLoad` useMemo에서 각각 독립 계산됨 | `model-combobox.tsx:52-54, 44, 84` | `baseUrl: trimmedBaseUrl \|\| undefined` 로 단순화. `trimmedKey`를 컴포넌트 렌더 최상단에서 한 번 계산해 재사용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | **`afterEach(vi.restoreAllMocks)` 실질적 무효** — `vi.mock()`으로 교체된 모듈은 `restoreAllMocks()`로 복원되지 않음. `vi.clearAllMocks()`만으로 충분하며 현재 코드는 격리 보장처럼 오독됨 | `llm-configs.test.ts:12-14` | `afterEach(vi.restoreAllMocks)` 제거 |
| 2 | Testing | **`baseUrl: ''` (빈 문자열) 엣지 케이스 미테스트** — `ValidateIf`가 `dto.baseUrl !== undefined`를 조건으로 쓰므로 `baseUrl: ''` 전달 시 비로컬 프로바이더에서 예상치 못한 400 반환. 회귀 안전망 부재 | `preview-llm-models.dto.ts:42-50` | `baseUrl: ''` + 비로컬 프로바이더 케이스 테스트 추가 |
| 3 | Documentation | **`providerRequiresApiKey` 빈 문자열 처리 의도 미문서화** — `""` 가 "프로바이더 미선택" 상태임이 코드에서 비자명함. 프로바이더 추가 시 함께 갱신해야 하는 사실 알기 어려움 | `model-combobox.tsx:33-35` | `// "" = no provider selected — treated like local (no key required)` 인라인 주석 1줄 |
| 4 | Documentation | **`PROVIDERS_REQUIRING_BASE_URL`에 `azure` 포함 근거 미명시** — Azure OpenAI가 배포 엔드포인트 URL을 필요로 하는 이유가 코드에서 파악 불가 | `model-combobox.tsx:34` | `// azure: deployment endpoint URL is part of the model path` 인라인 주석 |
| 5 | Documentation | **`PreviewLlmModelsDto` 클래스 수준 JSDoc 부재** — "저장 전 평문 자격증명으로 모델 목록 조회, API Key 미저장" 맥락이 클래스 상단에 없음 | `preview-llm-models.dto.ts` | 1~2줄 JSDoc 추가 (`저장 전 평문 자격증명으로 프로바이더 모델 목록 조회. API Key는 요청 스코프 밖으로 저장·캐시되지 않음.`) |
| 6 | API Contract | **`apiKey` 빈 문자열 허용이 Swagger에 미반영** — DTO는 모든 프로바이더에서 `apiKey: ''` 통과. 비로컬 거부는 서비스 레이어 전담. Swagger 소비자가 400 원인 파악 어려움 | `preview-llm-models.dto.ts:29-32` | `@ApiProperty.description`에 "local 이외는 서비스에서 빈 값 거부 (`LLM_CREDENTIALS_REQUIRED`, 400)" 명시 |
| 7 | Testing | **`previewModels` `baseUrl` 생략 시 키 누락 명시적 검증 없음** — `undefined` 직렬화 → JSON 키 생략을 `toHaveBeenCalledWith`로 고정하는 케이스 부재 | `llm-configs.test.ts:45-73` | `expect.not.objectContaining({ baseUrl: expect.anything() })` 케이스 추가 |
| 8 | Concurrency | **props 변경 중 응답 도착 시 stale 모델 목록 렌더 가능** — `onSuccess` 콜백이 구(舊) provider의 모델로 state를 덮는 이론적 경쟁 조건 (버튼 클릭 기반으로 실 발생 빈도 낮음) | `model-combobox.tsx:57-70` | `useQuery` 전환 + `queryKey: ['preview-models', provider, apiKey, baseUrl]`로 stale 응답 자동 무효화 (API Key를 queryKey에 포함하는 보안 정책 사전 결정 필요) |
| 9 | Maintainability | **`!(baseUrl?.trim() ?? "")` 불필요한 `?? ""` 연산** — `baseUrl?.trim()` 자체가 falsy를 반환하므로 `?? ""`는 의미 없음 | `model-combobox.tsx:79` | `!baseUrl?.trim()` 으로 단순화 |
| 10 | Requirement | **`ValidateIf` + `@IsString()` 조합 시 `undefined` 전달 시 에러 메시지 3중 노출** — `@IsString`, `@IsNotEmpty`, `@IsUrl` 세 에러 동시 반환. `@IsNotEmpty` 하나만 의미 있음 | `preview-llm-models.dto.ts:40-50` | 에러 메시지 구조 정리 또는 클라이언트에서 첫 번째 메시지만 표시 |
| 11 | Testing | **컨트롤러 스펙이 `previewModels`만 커버** — 파일명 `llm-config.controller.spec.ts`가 전체 컨트롤러 커버리지를 암시하나 실제는 3개 케이스만 존재 | `llm-config.controller.spec.ts` 전체 | 파일 상단에 `// Only covers previewModels` 주석 추가 또는 파일명 분리 |
| 12 | Testing | **빈 chat 모델 목록 렌더 분기 미테스트** — `loadMutation.isSuccess && chatModels.length === 0` 시 `noModelsFound` 메시지 렌더 경로 테스트 부재 | `model-combobox.tsx:108-111` | embedding만 반환하는 mock으로 `noModelsFound` 텍스트 표시 케이스 추가 |
| 13 | Architecture | **`LlmService`가 저장 설정 기반/임시 자격증명 두 추상화 레벨 혼재** — `previewModels`만 raw 자격증명을 직접 수신. 계열 기능 추가 시 응집도 희석 | `backend/src/modules/llm/llm.service.ts` | 이번 범위 밖. 계열 기능 추가 시 `LlmPreviewService` 분리 기준점으로 기록 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **MEDIUM** | SSRF: `@IsUrl`이 사설 IP 대역 미차단 |
| Performance | **LOW** | mutation 이중 렌더, 동일 자격증명 재호출 캐싱 없음 |
| Architecture | **LOW** | `ModelCombobox` SRP 위반(API 라우팅 내재), 프로바이더 상수 이중 정의, `as never` 계약 무력화 |
| Maintainability | **LOW** | `useSavedConfig` 이중 검사, `models` 이중 진실 소스, `apiKey.trim()` 중복 평가, `clearClientCache` 미사용 mock |
| Testing | **LOW** | `as never` 서비스 계약 무력화, `restoreAllMocks` 무효, fallback 테스트 영구화 |
| Side Effect | **LOW** | `models` state props 변경 시 미초기화, `onMutate`/`onError` 비대칭 상태 관리 |
| Concurrency | **LOW** | props 변경 + 응답 도착 타이밍 겹칠 때 stale 모델 목록 |
| API Contract | **LOW** | `apiKey` 빈 문자열 DTO/서비스 분산, `useSavedConfig && configId` 이중 검사, fallback 계약 비대칭 |
| Requirement | **LOW** | SSRF 미완전 조치, DTO/서비스 검증 책임 분산 문서화 공백 |
| Documentation | **LOW** | `providerRequiresApiKey` 빈 문자열 의도, `azure` baseUrl 필수 근거, 클래스 JSDoc 미비 |
| Dependency | **LOW** | `axios` UI 직접 결합, 프론트엔드 프로바이더 상수 독립 하드코딩 |
| Scope | **NONE** | `clearClientCache` 미검증 mock, DTO 주석 컨벤션 초과 |
| Database | **NONE** | DB 접점 없음 — 해당 없음 |

---

## 발견 없는 에이전트
- **Database** — 변경 전체가 DB 레이어를 의도적으로 우회하는 설계로, 스키마·마이그레이션·쿼리 접점 없음

---

## 권장 조치사항

1. **[즉시] SSRF 사설 IP 차단 guard 추가** — `LlmService.previewModels` 또는 서비스 레이어에서 `provider !== 'local'` 조건으로 hostname이 RFC1918/링크로컬 대역인지 검증. 클라우드 배포 환경에서 실질적 보안 위협
2. **[단기] `as never` → `jest.Mocked<Pick<LlmService, ...>>` 타입 명시** — 서비스 계약 변경 시 테스트가 컴파일 단계에서 감지하도록 수정
3. **[단기] `models` state props 변경 시 초기화** — `useEffect(() => { setModels([]); }, [provider, configId])` 추가로 stale autocomplete 오염 방지
4. **[단기] `PROVIDERS_REQUIRING_BASE_URL` 공유 상수 파일 추출** — `@/lib/constants/llm-providers.ts` 도입으로 프론트/백엔드 이중 정의 해소
5. **[단기] `useSavedConfig && configId` → `if (useSavedConfig)` 단순화** + `onSuccess` 중복 `setErrorMessage(null)` 제거
6. **[단기] `afterEach(vi.restoreAllMocks)` 제거** — 실질적 무효 코드로 테스트 독자에게 잘못된 격리 기대 부여
7. **[중기] `axios` import를 API 레이어로 이동** — `llm-configs.ts`에서 에러 정규화 후 throw해 UI 컴포넌트의 HTTP 클라이언트 직접 결합 해소
8. **[중기] `models` local state 제거 → `loadMutation.data` 직접 파생** — 이중 진실 소스 제거 및 이중 렌더 해소
9. **[중기] `baseUrl: ''` + `previewModels` baseUrl 생략 테스트 케이스 추가** — 회귀 안전망 보완
10. **[중기] fallback 테스트에 `(interim...)` 명시 + TODO 주석** — 인터셉터 중앙화 시 제거 대상임을 명확히 추적 가능하게