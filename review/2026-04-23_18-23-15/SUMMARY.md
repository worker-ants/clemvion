파일 쓰기 권한이 필요합니다. 아래가 통합 보고서 전문입니다.

---

# Code Review 통합 보고서 (2라운드 — RESOLUTION 적용 후 검증)

## 전체 위험도
**LOW** — 이전 CRITICAL/HIGH 이슈(SSRF, Rate Limiting, Timeout, 에러 sanitize)는 모두 RESOLUTION에서 조치 완료. 잔존 위험은 테스트 커버리지 공백·코드 품질 수준으로 기능 동작에 즉각적 영향 없음.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing · Maintainability | **에러 mock에 동기 throw 사용** — `mutationFn`이 `async`여서 현재는 동작하지만 의미적으로 부정확. 향후 try/catch 추가 시 `onError` silent 실패 위험 | `model-combobox.test.tsx` "shows a sanitized error message" 케이스 | `mockRejectedValue(Object.assign(new Error("..."), { isAxiosError: true, response: { ... } }))` |
| 2 | Side Effect · UX | **`onError`에서 `setModels([])` 무조건 초기화** — 성공 후 재시도 실패 시 이미 렌더된 모델 목록 전체 소멸 | `model-combobox.tsx` `onError` | `setModels([])` 제거, 에러 메시지만 갱신 |
| 3 | Side Effect · UX | **`onMutate` 부재** — 재시도 시 이전 에러 메시지가 pending 중에도 노출 | `model-combobox.tsx` `loadMutation` | `onMutate: () => { setErrorMessage(null); }` 추가 |
| 4 | Maintainability · API Contract | **`useSavedConfig && configId` 이중 검사 중복** — `useSavedConfig`가 이미 `configId` truthy를 보장 | `model-combobox.tsx:47` | `if (useSavedConfig)` 로 단순화 |
| 5 | Maintainability | **verbose ternary** — `trimmedBaseUrl ? trimmedBaseUrl : undefined` | `model-combobox.tsx:52` | `trimmedBaseUrl \|\| undefined` |
| 6 | Maintainability | **axios 에러 mock 과도한 복잡도** — `Object.create` + `Object.assign` 2단계 불필요. `isAxiosError`는 플래그만 검사 | `model-combobox.test.tsx:164-179` | `Object.assign(new Error("..."), { isAxiosError: true, response: { ... } })` |
| 7 | Architecture · Type Safety | **`as never` 타입 단언으로 타입 안전성 포기** — 서비스 인터페이스 변경 시 컴파일 오류 없이 silent diverge | `llm-config.controller.spec.ts:24-26` | `jest.Mocked<Pick<LlmService, 'previewModels' \| ...>>` |
| 8 | Architecture · Maintainability | **"fallback to body" 테스트가 envelope 불일치를 계약으로 고정** — W-12 중앙화 리팩터 시 걸림돌 | `llm-configs.test.ts:38-43` | `// TODO: W-12 중앙화 완료 후 제거` 주석 또는 "interim:" 접두사 |
| 9 | Performance | **mutation 완료 시 이중 렌더 사이클** — useMutation 상태 전환(1차) + `setModels`/`setErrorMessage`(2차) | `model-combobox.tsx:57-70` | `loadMutation.data` 직접 파생, local state 제거 |
| 10 | Testing | **`isPending` 로딩 상태 UI 미검증** — 버튼 비활성화·스피너가 중복 클릭 방지 핵심이나 테스트 없음 | `model-combobox.test.tsx` | `mockImplementation(() => new Promise(() => {}))` 후 `expect(getLoadButton()).toBeDisabled()` |
| 11 | Testing | **빈 모델 목록 반환 시 "noModelsFound" UI 미검증** | `model-combobox.test.tsx` | `mockResolvedValue([])` 후 `noModelsFound` testid 렌더 확인 |
| 12 | Testing | **`previewModels` non-envelope fallback 케이스 미검증** — `listModels`는 2케이스인데 `previewModels`는 1케이스 | `llm-configs.test.ts` | 직접 배열 응답 케이스 추가 |
| 13 | Testing | **API 호출 실패 케이스 전무** — 성공 경로만 커버, 에러 전파 미검증 | `llm-configs.test.ts` | `mockRejectedValue(new Error('Network Error'))` 케이스 추가 |
| 14 | Testing | **`azure` 프로바이더 baseUrl 있고 apiKey 없을 때 버튼 비활성화 미검증** | `model-combobox.test.tsx` | `provider="azure"`, `baseUrl="https://..."`, `apiKey=""` → disabled 케이스 |
| 15 | Testing · Maintainability | **`beforeEach(clearAllMocks)` + `afterEach(restoreAllMocks)` 혼용** — `vi.mock()` 사용 시 `restoreAllMocks` 효과 없음 | `llm-configs.test.ts:15-19` | `afterEach` 제거 또는 의도 주석 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture · SRP | `ModelCombobox`가 `listModels` vs `previewModels` 라우팅 결정 로직 직접 보유 | `model-combobox.tsx:63-72` | `useModelLoader(provider, apiKey, baseUrl, configId)` 커스텀 훅 분리 |
| 2 | Concurrency | props 변경과 응답 도착 타이밍 겹칠 때 stale 모델 목록 노출 가능성 (빈도 낮음) | `model-combobox.tsx` `onSuccess` | `variables`와 현재 props 비교 가드 (현행 보류 판단 유지 가능) |
| 3 | Dependency | `axios` 직접 임포트로 UI 컴포넌트가 HTTP 클라이언트 구현에 결합 | `model-combobox.tsx` 임포트 | API 레이어에서 도메인 에러로 정규화 후 throw |
| 4 | Dependency | `LlmProvider`/`LLM_PROVIDERS` 상수가 프론트엔드에서 독립 하드코딩 | `model-combobox.tsx:22,35` | `@/lib/llm-providers.ts`에 공유 상수 추출 |
| 5 | Dependency · Type Safety | `mockLlmService`를 `Record<string, jest.Mock>`으로 선언 — 서비스 계약 drift 탐지 불가 | `llm-config.controller.spec.ts` | `Partial<Record<keyof LlmService, jest.Mock>>` |
| 6 | Documentation | `providerRequiresApiKey`의 `""` 처리 의도 미문서화 | `model-combobox.tsx:21` | `// "" = no provider selected — treated like local` |
| 7 | Documentation | `PROVIDERS_REQUIRING_BASE_URL`의 azure 포함 근거 미문서화 | `model-combobox.tsx:35` | `// azure: 배포 엔드포인트 URL이 모델 경로에 포함됨` |
| 8 | Security | 서버 에러 메시지 직접 렌더링 — React 이스케이핑으로 XSS 방지되나 백엔드 sanitize 계약 의존 | `model-combobox.tsx:81-82` | 현행 유지. 백엔드 sanitize 계약 유지가 선결 |
| 9 | Testing | `llm-config.controller.spec.ts`가 `previewModels`만 커버 | 파일 전체 | 기존 spec과 merge 또는 파일명 변경 |
| 10 | Testing | `clearClientCache` mock 선언되었으나 어떤 테스트도 검증 안 함 | `llm-config.controller.spec.ts` | 관련 테스트 없으면 mock 항목 제거 |
| 11 | Testing | `disabled` prop 전파 미검증 | `model-combobox.test.tsx` | `disabled={true}` 시 버튼·인풋 비활성화 케이스 |
| 12 | Performance | 동일 자격증명 반복 클릭 시 캐싱 없음 | `model-combobox.tsx` | `useQuery` 전환 고려. API Key 캐시 보안 정책 결정 선행 필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Database | NONE | DB 접점 없음 |
| Scope | NONE | 관련 변경만 포함, clearClientCache mock 미검증(INFO) |
| Security | LOW | 에러 메시지 직접 렌더링·프론트 baseUrl 형식 미검증(모두 INFO 수준) |
| Dependency | LOW | axios 직접 임포트, LlmProvider 상수 미공유, mock 타입 drift 위험 |
| Concurrency | LOW | stale response 이론적 가능성(빈도 낮음), withTimeout 올바름 |
| Performance | LOW | 이중 렌더 사이클, 캐싱 미적용 |
| API Contract | LOW | listModels 이중 응답 허용(W-12 의도적), useSavedConfig 이중 검사 |
| Side Effect | LOW | onError 모델 초기화, onMutate 미구현, stale response |
| Documentation | LOW | 빈 문자열 처리·azure 근거·transform interceptor 주석 누락 |
| Architecture | LOW | ModelCombobox SRP 위반, as never 타입 단언, fallback 계약화 |
| Maintainability | LOW | 이중 검사, verbose ternary, 복잡한 mock, 혼용 mock 리셋 |
| Testing | LOW | 에러 mock 패턴, isPending/empty/failure 케이스 미검증 |
| Requirement | LOW | previewModels fallback 미검증, azure 케이스, noModelsFound 미검증 |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| Database | 변경 전체가 DB와 접점 없는 순수 pass-through 기능 |

---

## 권장 조치사항

1. **[즉시]** 에러 mock을 `mockRejectedValue`로 전환 (`model-combobox.test.tsx`)
2. **[즉시]** `onError`에서 `setModels([])` 제거 (`model-combobox.tsx`)
3. **[즉시]** `onMutate: () => { setErrorMessage(null); }` 추가 (`model-combobox.tsx`)
4. **[단기]** `useSavedConfig && configId` → `useSavedConfig` 단순화 + verbose ternary 정리 (`model-combobox.tsx`)
5. **[단기]** `as never` → 타입 명시적 mock 선언 (`llm-config.controller.spec.ts`)
6. **[단기]** 테스트 커버리지 보완: isPending 상태, 빈 모델 목록, API 실패, previewModels fallback, azure 조건 케이스 (`model-combobox.test.tsx`, `llm-configs.test.ts`)
7. **[단기]** `beforeEach` + `afterEach` mock 리셋 중복 제거 (`llm-configs.test.ts`)
8. **[단기]** "fallback to body" 테스트에 W-12 TODO 주석 추가 (`llm-configs.test.ts`)
9. **[중기]** `loadMutation.data` 직접 파생으로 local state 제거 — 이중 렌더 해소 (`model-combobox.tsx`)
10. **[중기]** `LlmProvider` 상수 프론트엔드 공유 파일 추출 (`@/lib/llm-providers.ts`)
11. **[중기]** `ModelCombobox` 라우팅 로직을 `useModelLoader` 커스텀 훅으로 분리