파일 쓰기 권한이 필요합니다. 아래가 통합 보고서 전문입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Security(API 키 클라이언트 노출·SSRF 가능성)와 Concurrency(`isDefault` 경쟁 조건·stale closure)에서 MEDIUM 등급 확인. 기능 동작은 정상이나 특정 타이밍·입력 조건에서 데이터 불일치 및 자격증명 노출 경로 존재.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **API 키가 React props로 직접 전달됨** — DevTools·Network 탭에서 `apiKey` 노출 가능. 클라이언트 직접 LLM 호출 구조라면 HIGH로 상향 | `model-combobox.tsx` — `apiKey` prop, `mutationFn` 클로저 | `configId` 기반 참조만 프론트에 노출, `apiKey`는 백엔드 프록시 경유 검토 |
| 2 | Security | **`baseUrl` SSRF 위험** — 사용자가 `http://169.254.169.254/` 등 내부 URL 주입 시 서버 내부 네트워크 요청 가능 | `model-combobox.tsx` — `baseUrl` 전달 경로 | 백엔드에서 allowlist + 프라이빗 IP 대역 차단 |
| 3 | Security | **에러 메시지 정보 노출 가능** — `response.data.message` 그대로 렌더링 시 스택 트레이스·DB 오류 노출 위험. sanitize 범위 불명확 | `model-combobox.tsx` — `onError` 핸들러 | 허용된 상수 문자열·`userMessage` 전용 필드로만 표시 |
| 4 | Concurrency | **`create()`/`update()`의 `isDefault` 플래그가 트랜잭션 없이 변경됨** — 동시 요청 시 `clearDefault()` + `save()` 인터리빙으로 `isDefault=true` 레코드 2개 생성 가능 | `llm-config.service.ts:93–108`, `135–142` | `clearDefault` + `save` 블록을 `manager.transaction()`으로 감싸 `setDefault()`와 동일 패턴 적용 |
| 5 | Concurrency · Side Effect | **`useMutation` stale closure — `onSuccess`가 현재 props 미검증** — 요청 중 `provider` 변경 시 openai 모델 목록이 anthropic 컨텍스트에 적용되는 자격증명 혼용 (5개 에이전트 공통 지적) | `model-combobox.tsx:55–75` | `mutationFn`에서 스냅샷 반환 후 `onSuccess`에서 `snapshot.provider !== provider` 가드, 또는 `AbortController` 활용 |
| 6 | Architecture · Maintainability | **`model-combobox.tsx` SRP 위반** — 네트워크 요청·concurrency 제어·에러 sanitize·UI 상태 관리 혼재. 경고 4·5번의 근본 원인 | `model-combobox.tsx` 전반 | `useModelLoader(provider, apiKey, baseUrl, configId)` 커스텀 훅으로 분리 |
| 7 | Architecture · Maintainability | **`as never` 타입 캐스팅** — TypeScript 구조적 타입 검사 전면 우회. 인터페이스 변경 시 컴파일 오류 없이 silent diverge (4개 에이전트 공통 지적) | `llm-config.controller.spec.ts:23–26` | `as unknown as LlmConfigService` 또는 `Partial<LlmConfigService>` 기반 typed mock |
| 8 | Maintainability · Architecture | **`useSavedConfig && configId` 이중 검사** — 파생 상태 정의·소비 양쪽에 분산된 숨은 결합 (5개 에이전트 공통 지적) | `model-combobox.tsx:44–47` | `if (useSavedConfig)` 단일 조건으로 단순화 |
| 9 | Maintainability | **mutation 상태 초기화 로직이 세 핸들러에 분산** — `setErrorMessage`·`setModels` 초기화가 `onMutate`/`onSuccess`/`onError`에 흩어짐 | `model-combobox.tsx` — `loadMutation` 전체 | `onMutate`에서 모든 비관적 초기화를 일괄 수행 |
| 10 | Maintainability | **`beforeEach(vi.clearAllMocks)` + `afterEach(vi.restoreAllMocks)` 이중 설정** — `vi.spyOn` 없는 파일에서 `restoreAllMocks` 무효. 의도 불명 보일러플레이트 (3개 에이전트 공통 지적) | `llm-configs.test.ts:15–19` | `afterEach(() => vi.restoreAllMocks())` 제거 |
| 11 | Maintainability | **동기 `throw` mock** — `mutationFn`이 `async`라서 동작하나 구현 세부사항에 암묵적 의존. `try/catch` 추가 시 `onError` silent 실패 위험 (2개 에이전트 공통 지적) | `model-combobox.test.tsx` — "shows a sanitized error message" | `mockRejectedValue(Object.assign(new Error(...), { isAxiosError: true, response: { ... } }))` |
| 12 | Performance | **요청 캐싱 없음** — 동일 `provider + apiKey` 조합 반복 클릭마다 새 네트워크 요청 | `model-combobox.tsx` — `useMutation` 사용 전반 | `useQuery` + `enabled` 플래그 패턴 전환, 또는 `useRef`로 이전 결과 보관 |
| 13 | Performance | **인-플라이트 요청 취소 미구현** — provider 빠른 전환 시 복수의 인-플라이트 요청 병행 실행 | `model-combobox.tsx` — `mutationFn` | `AbortController` + `signal` 전달 |
| 14 | Performance | **`setState` 다중 분리 호출** — `onSuccess`/`onError`에서 각각 2개씩 순차 호출, 자동 배치 미보장 컨텍스트에서 추가 리렌더 가능 | `model-combobox.tsx` — `onSuccess`/`onError` | `{ models, errorMessage }` 단일 `useReducer`로 통합 |
| 15 | Concurrency | **`remove()`에서 캐시 무효화가 DB 삭제 선행** — DB 삭제 실패 시 캐시만 제거된 불일치 발생 | `llm-config.controller.ts:224–229` | `remove()` 완료 후 `clearClientCache()` 순서로 변경 |
| 16 | Concurrency | **`listModels`에 스로틀 미적용** — `previewModels`는 분당 10회 제한이나 `listModels`는 없음 | `llm-config.controller.ts:192–208` | `listModels`에도 `@Throttle` 데코레이터 추가 |
| 17 | Testing | **`llm-config.controller.spec.ts` CRUD 핸들러 테스트 전무** — mock 선언은 있으나 `findAll`·`create`·`update`·`setDefault`·`remove` 테스트 케이스 없음 | `llm-config.controller.spec.ts` 전체 | 별도 spec 파일이 있으면 주석 명시, 없으면 최소 위임 테스트 추가 |
| 18 | Testing | **`onMutate` 에러 클리어 동작 미검증** — `onMutate: () => setErrorMessage(null)` 구현 후 테스트 없음 | `model-combobox.test.tsx` | 에러 발생 후 재클릭 시 에러 메시지 즉시 소멸 assert 케이스 추가 |
| 19 | Testing | **stale closure 시나리오 미검증** — `onSuccess` provider 불일치 버그 미수정 + 테스트 없음 | `model-combobox.test.tsx` | 요청 중 provider 변경 후 응답 도착 시 stale 모델 목록 미적용 assert |
| 20 | Requirement | **`provider` 변경 시 모델 목록 초기화 요구사항 미정의** — provider 전환 시 stale 목록 silent 적용 | `model-combobox.tsx` — provider prop 처리 | `useEffect(() => { setModels([]); }, [provider])` + 요구사항 문서화 |
| 21 | Requirement | **`apiKey` 변경 시 stale 모델 목록 처리 미정의** — apiKey 변경 후 이전 키로 로드된 모델 선택 가능 상태 유지 | `model-combobox.tsx` — apiKey prop 처리 | apiKey 변경 시 초기화 여부 요구사항 명시 후 구현 |
| 22 | Dependency | **`@types/jest-axe`(3.x) vs `jest-axe`(10.x) 메이저 버전 불일치** — 7 메이저 버전 구 타입 정의로 접근성 테스트 작성 시 잘못된 타입 추론 가능 | `frontend/package.json:66,71` | `jest-axe` 메이저에 맞게 `@types/jest-axe` 업데이트 또는 제거 |
| 23 | Scope | **`side_effect/review.md`에 Testing 범주 내용 2건 이탈·중복** — 동기 throw, mock 리셋 중복이 Side Effect 범주 아닌 Testing 내용이며 `testing/review.md`와 중복 수록 | `side_effect/review.md` | 해당 2건을 `side_effect/review.md`에서 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | **props 불일치 가드가 프레젠테이션 컴포넌트 내 위치** — concurrency 처리는 훅·서비스 레이어 담당이 원칙 | `model-combobox.tsx` — `onSuccess` 내 `provider` 비교 | 커스텀 훅 내 `AbortController` 또는 `variables` 비교로 이전 |
| 2 | Concurrency | **`update()`의 read-modify-write — 낙관적 잠금 없음** — 관리 UI 수준에서는 허용 가능 | `llm-config.service.ts:112–143` | 필요 시 `@VersionColumn()` 또는 `lockMode: 'pessimistic_write'` 검토 |
| 3 | Performance | **`onError` 시 `setModels([])` 불필요한 리렌더** — 이미 빈 배열 상태에서 새 `[]` 생성 시 `Object.is` 실패 | `model-combobox.tsx` — `onError` | `setModels([])` 제거 또는 `models.length > 0`일 때만 호출 |
| 4 | Performance | **테스트의 영구 대기 Promise 메모리 누수** — `() => new Promise(() => {})` 패턴이 GC 대상 아닌 Promise 누적 | `model-combobox.test.tsx` — `isPending` 케이스 | `vi.useFakeTimers()` 또는 deferred resolve 패턴 |
| 5 | Performance | **`document.querySelectorAll` 전체 DOM 탐색** | `model-combobox.test.tsx:119, 315` | `container.querySelectorAll(...)` 로 범위 제한 |
| 6 | Requirement | **`useSavedConfig` 비즈니스 규칙 우선순위 미정의** — apiKey 삭제 시 saved config 자동 전환이 의도된 것인지 불명확 | `model-combobox.tsx:44–47` | create/edit 플로우 의사결정 트리 문서화 |
| 7 | Requirement | **"chat-only" 모델 필터링 기준 미명시** — 기준 변경 시 silent regression 위험 | `model-combobox.tsx` — chatModels 필터링 | 요구사항 문서에 필터링 기준 명시 |
| 8 | Requirement | **`PROVIDERS_REQUIRING_BASE_URL` 목록 완전성 미검증** — 신규 provider 추가 시 누락 가능 | `model-combobox.tsx` — baseUrl 필수 여부 판별 | provider 목록 변경 시 동기화를 체크리스트에 포함 |
| 9 | Testing | **`baseUrl` 공백 케이스 미검증** | `model-combobox.test.tsx` | `provider="local"`, `baseUrl="   "` → 버튼 disabled assert |
| 10 | Testing | **`document.querySelectorAll` 사용 이유 주석 없음** | `model-combobox.test.tsx:119, 315` | `// datalist options are not accessible via Testing Library roles` 주석 추가 |
| 11 | Testing | **`.rejects.toBe(err)` 참조 동등성 검증** — 의미상 `.toThrow()` 패턴이 더 명확 | `llm-config.controller.spec.ts:58–60` | `.rejects.toThrow(err)` 전환 |
| 12 | Documentation | **소스 코드 Props JSDoc 문서화 미언급** — 리뷰 문서들이 props 목적·제약 조건 문서화 점검 누락 | `model-combobox.tsx` — Props 타입 정의 | 각 prop에 JSDoc 추가 |
| 13 | Dependency | **`zod ^4.3.6`·`uuid ^13.0.0` 도입 — LLM config DTO 영향 점검** | `backend/package.json` | LLM config DTO에 zod 직접 사용 시 v4 migration guide 재검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | API 키 클라이언트 노출, baseUrl SSRF 가능성, 에러 메시지 정보 노출 |
| Concurrency | MEDIUM | `isDefault` 경쟁 조건, stale closure 자격증명 혼용, 캐시-DB 순서 역전 |
| Architecture | LOW | SRP 위반, props 가드 레이어 역전, `as never` 타입 단언 |
| Maintainability | LOW | `useSavedConfig` hidden coupling, 상태 초기화 분산, `as never`, mock 리셋 의도 불명 |
| Performance | LOW | 캐싱 미적용, 인-플라이트 취소 미구현, 다중 setState 리렌더 |
| Requirement | LOW | provider/apiKey 변경 시 상태 초기화 정책 미정의, 필터링 기준 미명시 |
| Testing | LOW | `as never` 미수정, CRUD 테스트 전무, `onMutate` 미검증, stale closure 미검증 |
| Scope | LOW | `side_effect/review.md`에 Testing 범주 2건 이탈·중복 |
| Dependency | NONE | 신규 의존성 없음. `@types/jest-axe` 버전 불일치만 WARNING |
| Side Effect | NONE | 리뷰 문서 자체에 부작용 없음. 권고 적용 시 로컬 상태에만 영향 |
| Documentation | NONE | 리뷰 문서 서식 양호. 소스 코드 JSDoc 점검 누락은 INFO |
| API Contract | NONE | API 엔드포인트 계약 관련 변경 없음 |
| Database | NONE | DB 접점 없는 변경 |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| API Contract | UI 컴포넌트·테스트 변경으로 API 계약 변경 없음 |
| Database | 변경 전체가 DB와 접점 없음 |
| Side Effect | 리뷰 문서에 실행 가능한 부작용 없음 |
| Documentation | 리뷰 문서 서식 양호, 소스 코드 문서화 갭은 INFO |

---

## 권장 조치사항

### 즉시 (보안·데이터 정합성)
1. **`llm-config.service.ts`** — `create()`/`update()`의 `clearDefault` + `save` 블록을 `manager.transaction()`으로 감싸 `isDefault` 경쟁 조건 해소
2. **`model-combobox.tsx`** — `onSuccess`에 `snapshot.provider !== provider` 가드 추가로 stale closure 자격증명 혼용 차단
3. **보안 아키텍처 검토** — `apiKey` 클라이언트 노출 구조 검토; `configId` 기반 백엔드 프록시 패턴 적용 가능 여부 확인
4. **백엔드 `baseUrl` 검증** — allowlist + 프라이빗 IP 대역 차단으로 SSRF 위험 제거

### 단기 (코드 품질·안전망)
5. **`llm-config.controller.ts`** — `remove()` 캐시-DB 순서 수정 (`remove()` 완료 후 `clearClientCache()`)
6. **`llm-config.controller.ts`** — `listModels`에 `@Throttle` 데코레이터 추가
7. **`llm-config.controller.spec.ts`** — `as never` → `as unknown as LlmConfigService` 교체
8. **`model-combobox.tsx`** — `useSavedConfig && configId` → `useSavedConfig` 단순화, 상태 초기화를 `onMutate`에 집중
9. **`model-combobox.test.tsx`** — 동기 `throw` mock → `mockRejectedValue` 전환
10. **`llm-configs.test.ts`** — `afterEach(vi.restoreAllMocks)` 제거
11. **테스트 보완** — `onMutate` 에러 클리어, stale closure 시나리오, CRUD 위임 케이스 추가

### 중기 (구조 개선)
12. **`model-combobox.tsx`** — `useModelLoader` 커스텀 훅으로 네트워크 로직 분리 (SRP 해소, 테스트 계층화)
13. **`frontend/package.json`** — `@types/jest-axe` 버전을 `jest-axe 10.x`에 맞게 동기화
14. **요구사항 문서화** — provider/apiKey 변경 시 모델 목록 초기화 정책, chat-only 필터링 기준을 spec에 명시