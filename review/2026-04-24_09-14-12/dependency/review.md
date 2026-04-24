## 발견사항

---

### **[WARNING]** `@google/generative-ai` → `@google/genai` SDK 교체 — `pnpm-lock.yaml` 검증 불가

- **위치**: `backend/package.json`, `google.client.ts`
- **상세**: 여러 리뷰 라운드가 공통으로 지적했으나 미해결 상태. `pnpm-lock.yaml` diff가 생략되어 ① 구 패키지(`@google/generative-ai`) 완전 제거 여부, ② 신 패키지(`@google/genai`) 정확한 고정 버전, ③ 두 SDK 동시 설치로 인한 번들 중복 여부를 직접 검증할 수 없다. Breaking Change가 포함된 메이저 SDK 전환에서 lock 파일 미검증은 재현성 보장에 실질적인 공백이다.
- **제안**: `pnpm list @google/generative-ai @google/genai`로 동시 설치 여부 확인. `package.json` dependencies에서 구 패키지 제거 완료 여부 명시적으로 검토.

---

### **[WARNING]** `@google/genai` 스트림 반환 타입 — `as AsyncIterable<unknown>` 강제 캐스팅

- **위치**: `google.client.ts` — `stream()` 메서드
- **상세**: `generateContentStream()` 반환값을 `as AsyncIterable<unknown>`으로 캐스팅 후 청크를 다시 익명 인라인 타입으로 재캐스팅한다. SDK 타입 정의가 불완전하거나 런타임 반환 타입이 문서와 다름을 의미한다. 신 SDK 버전에 이 타입이 올바르게 정의된 버전이 있는지 확인하지 않은 채 `unknown` 우회에 의존하는 것은 의존성 계약 위반이다. 라운드 1 dependency/review.md에서 CRITICAL로 분류되었으나 3라운드 시점까지 미조치.
- **제안**: `@google/genai` changelog·타입 정의를 확인해 제네릭 타입이 정상 제공되는 버전으로 명시적 고정. `unknown` 캐스팅 없이 SDK 제공 타입 사용 또는 최소한 `interface GeminiStreamChunk` 네임드 인터페이스를 상단에 선언해 변경 추적 지점을 단일화.

---

### **[WARNING]** `@types/jest-axe` (3.x) vs `jest-axe` (10.x) 메이저 버전 불일치

- **위치**: `frontend/package.json`
- **상세**: `jest-axe: ^10.0.0`과 `@types/jest-axe: ^3.5.9`가 공존한다. 7 메이저 버전 차이로 타입 정의가 런타임 API를 정확히 반영하지 않는다. 접근성 테스트 작성 시 잘못된 타입 추론으로 silent bug가 유입될 수 있다. 라운드 3에서 처음 식별되었으나 이후 리뷰에서 재확인 없이 지나쳤다.
- **제안**: `jest-axe`가 자체 타입 선언을 포함하는지 확인 후 `@types/jest-axe` 제거. 포함하지 않는다면 `@types/jest-axe`를 메이저 버전에 맞게 업데이트.

---

### **[WARNING]** `axios` — UI 컴포넌트가 HTTP 클라이언트 구현에 직접 결합

- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:5`
- **상세**: `axios.isAxiosError()` 단일 호출을 위해 UI 컴포넌트가 `axios`를 직접 임포트한다. 번들 크기 증가는 없으나 추상화 경계가 깨진다. 향후 `apiClient`를 fetch 기반으로 교체할 때 이 컴포넌트도 수정 대상이 된다. 라운드 2, 3 모두 지적했으나 미조치.
- **제안**: `@/lib/api/client.ts`에서 `isApiError(e: unknown): e is AxiosError` 유틸리티를 export해 컴포넌트가 axios에 직접 의존하지 않도록 분리.

---

### **[INFO]** 프론트엔드 프로바이더 상수 독립 하드코딩 — 백엔드와 암묵적 동기화 의존성

- **위치**: `model-combobox.tsx:22, 34` vs `backend/src/modules/llm-config/dto/create-llm-config.dto.ts`
- **상세**: 백엔드 `LLM_PROVIDERS`가 단일 소스를 관리하는 반면 프론트엔드는 `LOCAL_PROVIDER = "local"`, `PROVIDERS_REQUIRING_BASE_URL = new Set(["azure", "local"])`을 독립 하드코딩한다. `azure` 추가·삭제 시 컴파일 타임에 불일치를 감지할 방법이 없다. 2·3라운드 공통 지적이나 미조치.
- **제안**: 단기적으로 `@/lib/constants/llm-providers.ts` 공유 상수 파일 도입. 중기적으로 monorepo 내 `/packages/shared`에 타입·상수 정의.

---

### **[INFO]** `transformIgnorePatterns` 정규식 변경 — 변경 의도 미문서화

- **위치**: `backend/package.json`
- **상세**: pnpm 가상 스토어 경로(`node_modules/.pnpm/<pkg>/node_modules/<name>/`)를 처리하도록 정규식이 복잡해졌으나 변경 이유가 주석이나 커밋 메시지에 없다. `uuid`, `p-limit`, `yocto-queue` 3개 ESM-only 패키지를 대상으로 하는 이유와 향후 패키지 추가 시 이 패턴에 추가해야 하는 기준이 불명확하다.
- **제안**: 정규식 위에 `// ESM-only packages require transpilation under pnpm's virtual store layout` 한 줄 주석 추가. 새 ESM-only 패키지 추가 시 이 목록을 갱신해야 함을 명시.

---

### **[INFO]** Anthropic `listModels` — 페이지 상한 미적용으로 SDK 의존성 부하 무제한

- **위치**: `anthropic.client.ts` — `listModels()`
- **상세**: Google 클라이언트는 `MAX_MODELS = 100`으로 페이지 순회를 제한하지만 Anthropic 클라이언트에는 상한이 없다. Anthropic SDK의 페이지네이션 구현에 의존해 `for await` 루프가 무제한 실행될 수 있다. 라운드 1, 2에서 공통 지적.
- **제안**: Google 클라이언트와 동일하게 `MAX_MODELS` 상한 또는 SDK의 `limit` 파라미터 적용.

---

### **[INFO]** `zod ^4.3.6`, `uuid ^13.0.0` — 최신 메이저 버전 사용 확인

- **위치**: `backend/package.json`
- **상세**: `zod` v4는 v3 대비 breaking change가 있으며, `uuid` v13은 ESM-first로 전환되어 `transformIgnorePatterns`에 이미 대응 중이다. 이번 리뷰 대상 파일과 직접 충돌하지는 않으나 `class-validator` 기반 DTO와 `zod`가 혼용될 경우 v4 migration guide(`safeParse()` 동작 변경) 재검토가 필요하다.
- **제안**: `zod`를 직접 사용하는 파일이 있다면 v4 API 사용 여부 점검.

---

### **[INFO]** `@nestjs/throttler` — 기존 의존성, 신규 추가 아님

- **위치**: `llm-config.controller.ts`
- **상세**: `@Throttle({ default: { limit: 10, ttl: 60_000 } })` 적용에 신규 패키지 없이 기존 등록 의존성을 올바르게 재사용. 문제 없음.

---

## 요약

이번 변경의 핵심 의존성 이슈는 세 라운드에 걸쳐 반복 지적되었으나 미조치된 항목들로 수렴한다. `@google/genai` SDK 교체는 `pnpm-lock.yaml` 검증 불가와 스트림 타입 `as AsyncIterable<unknown>` 강제 캐스팅이라는 두 가지 실질적 위험을 남기고 있으며, `@types/jest-axe` 메이저 버전 불일치는 접근성 테스트 타입 안전성에 공백을 만든다. `axios` UI 직접 의존과 프론트엔드 프로바이더 상수 이중 정의는 기능 장애로 이어지지는 않으나 향후 의존성 교체·확장 시 silent bug의 온상이 된다. 신규 외부 패키지 추가는 없어 번들 크기·라이선스·알려진 취약점 관련 신규 위험은 없다.

## 위험도

**MEDIUM** — Google SDK 타입 캐스팅 공백과 pnpm-lock 미검증으로 인한 잠재적 런타임 리스크. `@types/jest-axe` 버전 불일치는 접근성 테스트 신뢰도를 저하시킴.