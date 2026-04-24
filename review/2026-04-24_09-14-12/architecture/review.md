## 발견사항

---

### **[WARNING] `LlmService`의 추상화 레벨 이원화 — 단일 책임 원칙 위반**
- **위치**: `backend/src/modules/llm/llm.service.ts` — `previewModels()` vs. 기존 메서드
- **상세**: 기존 `chat()`, `embed()`, `testConnection()`, `listModels()`는 모두 DB에 저장된 `LlmConfig` 엔티티를 진입점으로 삼는다. `previewModels()`는 raw 자격증명(`provider`, `apiKey`, `baseUrl`)을 직접 받아 처리한다. 하나의 서비스 클래스가 "저장된 설정 기반 클라이언트 오케스트레이션"과 "임시 자격증명 기반 탐색"이라는 서로 다른 추상화 레벨을 동시에 관리하게 되었다. 이 패턴이 확장되면 클래스 응집도가 선형적으로 희석된다.
- **제안**: 즉각 분리는 불필요하나, `previewModels` 계열 기능 추가 시 `LlmPreviewService`로 분리하는 기준점으로 명확히 기록할 것. 현재 범위에서는 메서드에 `// NOTE: raw credentials path — does not use stored LlmConfig` 주석으로 설계 의도를 명시한다.

---

### **[WARNING] `LlmConfigController`가 두 서비스의 오케스트레이터 역할 수행 — 응집도 저하**
- **위치**: `backend/src/modules/llm-config/llm-config.controller.ts`
- **상세**: 컨트롤러는 `LlmConfigService`(CRUD)와 `LlmService`(모델 조회/테스트)를 동시에 주입받는다. `previewModels` 핸들러는 `LlmService`만, 나머지 CRUD 핸들러는 `LlmConfigService`만 사용한다. 두 서비스를 함께 가진 컨트롤러는 실질적으로 두 모듈의 진입점을 하나로 묶은 것이다. `previewModels`가 `LlmConfigService`를 전혀 사용하지 않는다는 사실이 컨트롤러 경계 설계의 미결 과제를 암시한다.
- **제안**: 중기적으로 `previewModels`를 `LlmController` 등 별도 컨트롤러로 이동하거나, `LlmConfigService`에 `previewModels` 위임 메서드를 추가해 컨트롤러가 단일 서비스만 호출하게 한다.

---

### **[WARNING] `ModelCombobox`의 SRP 위반 — UI 컴포넌트가 API 라우팅 전략을 직접 보유**
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:60-68`
- **상세**: `useSavedConfig` 분기("저장된 configId + 빈 apiKey → `listModels`, 그 외 → `previewModels`")는 도메인 라우팅 규칙이다. 이 판단이 UI 컴포넌트의 `mutationFn` 인라인에 위치해, 컴포넌트가 렌더링 책임과 API 선택 책임을 동시에 진다. provider가 추가될수록 `mutationFn` 내부 분기가 누적되는 구조적 취약점이다. 여러 리뷰에서 동일하게 지적됐으나 미조치 상태다.
- **제안**: `useModelLoader(provider, apiKey, baseUrl, configId)` 커스텀 훅으로 추출. 훅은 `{ models, isPending, errorMessage, load }` 인터페이스만 노출하고, `model-combobox.tsx`는 렌더링에 집중한다. 이 분리는 stale closure, 이중 setState, 테스트 결합 등 여러 파생 문제를 동시에 해소한다.

---

### **[WARNING] 프로바이더 도메인 규칙의 이중 하드코딩 — 컴파일 타임 동기화 보장 없음**
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:34-39` vs `backend/src/modules/llm-config/dto/create-llm-config.dto.ts`
- **상세**: 백엔드는 `LLM_PROVIDERS`, `LlmProvider` 유니온을 단일 출처로 관리한다. 프론트엔드는 `LOCAL_PROVIDER = "local"`, `PROVIDERS_REQUIRING_BASE_URL = new Set(["azure", "local"])` 등 동일 규칙을 컴포넌트 내부에서 독립 정의한다. `azure`가 `baseUrl` 필수 목록에 포함된다는 사실이 백엔드와 동기화되어 있는지 컴파일 타임에 검증할 방법이 없다. 프로바이더 추가/삭제 시 두 곳을 별도로 수정해야 하는 암묵적 의존성이 생긴다.
- **제안**: 단기: `@/lib/constants/llm-providers.ts`에 프론트엔드 공유 상수를 추출하고 "백엔드 `LLM_PROVIDERS`와 동기화 필요" 주석 명시. 중기: OpenAPI 스키마 코드젠 또는 monorepo `/packages/shared` 패키지로 단일 진실 소스를 확보한다.

---

### **[WARNING] `isPrivateHost`가 import 블록 사이에 위치 — 모듈 경계 위반**
- **위치**: `backend/src/modules/llm/llm.service.ts` 파일 상단
- **상세**: TypeScript는 호이스팅을 지원하지 않아 런타임 오류는 없으나, import 블록 중간에 함수가 삽입된 구조는 ESLint `import/first` 규칙을 위반하고 파일 가독성을 해친다. 더 근본적으로, SSRF 방어 유틸리티가 `LlmService` 파일 내 파일 스코프 함수로 존재하는 것은 모듈 경계 설계가 명확하지 않음을 나타낸다. 같은 유틸리티를 다른 서비스에서 재사용하려면 복제가 불가피하다.
- **제안**: `src/common/utils/ssrf.util.ts`로 분리하고 import 블록 정리. `isPrivateHost`를 exported 함수로 만들면 단위 테스트도 독립적으로 작성 가능하다.

---

### **[WARNING] `local` 프로바이더의 SSRF 가드 전면 우회 — 레이어 방어 설계 미흡**
- **위치**: `backend/src/modules/llm/llm.service.ts` — `previewModels()` 내 `if (params.provider !== 'local')` 분기
- **상세**: `local` 프로바이더는 `isPrivateHost` 검사를 완전히 건너뛴다. 이는 Ollama 같은 로컬 서버 지원을 위한 설계 결정이나, `editor` 권한 사용자가 `local` + `baseUrl: 'http://10.0.0.5:6379'` 조합으로 내부 서비스를 스캔할 수 있는 경로가 열린다. 보안 가드의 예외가 설계 문서화 없이 코드 조건으로만 존재하는 것은 아키텍처 리스크다.
- **제안**: `local` 프로바이더에 대해 `localhost` / `127.x.x.x` / `::1`만 허용하는 별도 화이트리스트 적용을 검토. 현행 유지 시 `spec/5-system/7-llm-client.md`에 "local 프로바이더는 IP 제한 없음 — 내부망 Ollama 배포 지원 목적, 운영 환경 egress 방화벽으로 보완 필요" 명시.

---

### **[WARNING] `create()`/`update()`의 `isDefault` 플래그 처리에 트랜잭션 없음 — 상태 일관성 설계 공백**
- **위치**: `backend/src/modules/llm-config/llm-config.service.ts:93-108` (`create`), `135-142` (`update`)
- **상세**: `setDefault()`는 `manager.transaction()`으로 "전체 unset → 대상 set"을 원자적으로 처리하는 올바른 설계다. 반면 `create()`와 `update()`는 `clearDefault()`(별도 UPDATE) + 트랜잭션 없는 `save()`를 순차 호출한다. 동시 요청 시 두 레코드에 `isDefault=true`가 공존하는 경쟁 조건이 발생한다. 동일한 도메인 불변식을 지키는 메서드들이 서로 다른 트랜잭션 전략을 사용하는 것은 아키텍처 불일치다.
- **제안**: `create()`와 `update()`의 `clearDefault()` + `save()` 블록을 `manager.transaction()`으로 감싼다. 또는 `setDefault()`를 내부 공통 메서드로 추출해 세 경로가 동일한 원자적 구현을 공유하도록 리팩터링한다.

---

### **[WARNING] `data?.data ?? data` fallback이 API 레이어 불일치를 계약으로 고착**
- **위치**: `frontend/src/lib/api/llm-configs.ts` — `listModels`, `previewModels`
- **상세**: `TransformInterceptor`가 모든 응답을 `{ data: T }`로 래핑한다면 프론트엔드 API 클라이언트는 `data.data`만 참조하면 된다. `?? data` 폴백은 인터셉터 적용 범위의 불일치를 클라이언트 레이어에서 방어적으로 흡수하는 것으로, 인터셉터 미적용 경로가 존재한다는 설계 미결 상태를 영속화한다. 두 계약이 공존하면 향후 인터셉터 중앙화 시 폴백이 걸림돌이 된다.
- **제안**: `apiClient` 인터셉터에서 envelope 언래핑을 일관되게 처리하고 클라이언트는 `data`를 직접 참조. 단기 유지 시 관련 코드에 `// TODO(W-12): remove after transform interceptor centralization` 명시.

---

### **[WARNING] `buildGenerationConfig`의 `Record<string, unknown>` 반환 — 타입 안전성 설계 포기**
- **위치**: `backend/src/modules/llm/clients/google.client.ts` — `buildGenerationConfig()`
- **상세**: 반환 타입이 `Record<string, unknown>`으로 SDK가 기대하는 타입 정보를 완전히 잃는다. `generateContent({ config })` 호출 시 컴파일러가 잘못된 config 필드나 타입 불일치를 잡지 못한다. SDK 마이그레이션 과정에서 타입 안전성을 포기한 결과로, 런타임 오류가 컴파일 단계에서 감지되지 않는 설계 공백이다.
- **제안**: `@google/genai`의 `GenerateContentConfig` 타입을 명시적으로 사용하거나, 최소한 `Partial<GenerateContentConfig>`로 좁혀 컴파일 타임 안전성을 확보한다.

---

### **[INFO] `remove()` 엔드포인트의 캐시-DB 삭제 순서 역전**
- **위치**: `backend/src/modules/llm-config/llm-config.controller.ts:224-229`
- **상세**: `clearClientCache(id)` → `remove(id)` 순서로 캐시를 DB 삭제보다 먼저 제거한다. DB 삭제 실패 시 "캐시 없음 + DB 있음" 불일치가 발생하는 짧은 윈도우가 생긴다. `update()`는 서비스 반환 후 캐시를 지워 순서가 반대다 — 동일 리소스에 대한 두 작업이 다른 순서 전략을 사용하는 아키텍처 불일치다.
- **제안**: `await remove()` 완료 후 `clearClientCache()` 호출로 순서 고정. 삭제 성공 확인 후 캐시를 지우는 것이 안전하며, `update()`와 일관성도 유지된다.

---

### **[INFO] `withTimeout`이 `private`으로 제한 — 재사용 설계 부재**
- **위치**: `backend/src/modules/llm/llm.service.ts`
- **상세**: `testConnection` 등 다른 외부 API 호출에도 동일한 타임아웃 패턴이 필요할 수 있으나, `private` 선언으로 서비스 내부에서만 사용 가능하다. 현재 `listModels`와 `previewModels`에만 적용되고, 동일 서비스 내 타임아웃 매직 넘버 `30_000`이 두 곳에 중복된다.
- **제안**: 즉각 변경 불필요. 타임아웃 적용 범위가 넓어지면 `src/common/utils/timeout.util.ts`로 분리. 현재 단계에서는 `private static readonly LIST_MODELS_TIMEOUT_MS = 30_000` 상수 추출로 중복 해소.

---

### **[INFO] `listModels` 스로틀 미적용 — 동일 기능의 엔드포인트 간 정책 불일치**
- **위치**: `backend/src/modules/llm-config/llm-config.controller.ts:154` vs `192-208`
- **상세**: `POST preview-models`는 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`으로 분당 10회 제한이 있다. `GET :id/models`(저장된 자격증명으로 Provider 실시간 호출)는 동일하게 외부 API를 호출하지만 스로틀이 없다. 동일한 리소스 소비 패턴을 가진 두 엔드포인트에 다른 보호 정책이 적용된 것은 설계 불일치다.
- **제안**: `listModels` 핸들러에도 동일한 `@Throttle` 데코레이터 추가.

---

## 요약

이번 변경의 핵심 아키텍처 강점은 `previewModels`의 레이어 분리(DTO 검증 → 서비스 비즈니스 로직 → Controller 라우팅)와 per-config 캐시 우회, API Key 비영속화 원칙이 명확히 구현된 점이다. 그러나 세 가지 구조적 문제가 잔존한다. 첫째, `LlmService`가 "저장된 설정 기반"과 "임시 자격증명 기반"이라는 두 추상화 레벨을 혼재하며, `LlmConfigController`는 두 서비스를 동시에 오케스트레이션해 응집도가 낮아졌다. 둘째, `ModelCombobox`가 API 라우팅 전략을 UI 컴포넌트 내부에 직접 보유하고, 프로바이더 도메인 규칙이 프론트엔드·백엔드에 이중 하드코딩되어 컴파일 타임 동기화 보장이 없다. 셋째, `isDefault` 플래그의 트랜잭션 전략 불일치, `remove()`의 캐시-DB 순서 역전, `data?.data ?? data` 이중 계약화가 각각 DB 일관성, 운영 안정성, API 레이어 신뢰성을 잠재적으로 약화시킨다. `isPrivateHost`의 DNS 미검증과 `local` 프로바이더 SSRF 가드 우회는 보안 리뷰에서 반복 지적되었으나 설계 결정으로 문서화하지 않은 채 코드 조건으로만 존재하는 것이 아키텍처 명확성 관점에서 가장 큰 미결 사항이다.

## 위험도

**MEDIUM** — 기능적 구조는 전반적으로 건전하나, `isDefault` 트랜잭션 누락이 데이터 일관성 위험을 내포하고, `local` 프로바이더 SSRF 가드 우회와 `ModelCombobox` SRP 위반이 보안·유지보수 양면에서 명시적 보안 결정 또는 구조적 개선이 필요한 상태다.