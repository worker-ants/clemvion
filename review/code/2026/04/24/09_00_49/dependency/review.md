## 발견사항

### [WARNING] `@google/generative-ai` → `@google/genai` SDK 교체
- **위치**: `backend/src/modules/llm/clients/google.client.ts`
- **상세**: 기존 `@google/generative-ai` 패키지를 새로운 통합 SDK인 `@google/genai`로 전면 교체. pnpm-lock.yaml diff가 생략되어 실제 추가/제거된 버전을 확인할 수 없으나, 두 패키지는 완전히 다른 API 구조를 가지므로 Breaking change에 해당함. `@google/genai`는 2024년 출시된 신 SDK로 라이선스는 Apache 2.0(프로젝트 호환).
  - `GoogleGenerativeAI` + `getGenerativeModel()` + `startChat()` → `GoogleGenAI` + `ai.models.generateContent()` 로 API 패러다임이 변경됨
  - `pnpm-lock.yaml` diff가 생략되어 실제 고정 버전을 검증할 수 없음. **lockfile을 직접 확인해 `@google/generative-ai`가 완전히 제거되고 `@google/genai`의 정확한 버전이 고정됐는지 확인 필요**
- **제안**: `pnpm list @google/genai @google/generative-ai`로 두 패키지가 공존하지 않는지, 고정 버전(`"^x.y.z"`가 아닌 정확한 버전)이 lockfile에 기록됐는지 확인

---

### [WARNING] `generateContentStream()` 반환 타입을 `unknown`으로 캐스팅
- **위치**: `google.client.ts` stream() 메서드
- **상세**:
  ```typescript
  stream = (await this.ai.models.generateContentStream({...})) as AsyncIterable<unknown>;
  ```
  신 SDK의 `generateContentStream()` 반환 타입이 맞지 않아 `unknown`으로 우회 캐스팅 후 내부에서 수동 타입 선언. SDK가 업데이트될 경우 응답 스키마 변경을 컴파일 타임에 감지할 수 없음.
- **제안**: `@google/genai`의 공식 타입(`GenerateContentResponse`)을 import해 캐스팅 없이 사용하거나, `as unknown` 대신 `as AsyncIterable<GenerateContentResponse>`로 타입 좁히기 적용

---

### [INFO] Jest `transformIgnorePatterns` — pnpm 가상 스토어 대응
- **위치**: `backend/package.json`
- **상세**: 기존 정규식이 pnpm의 `.pnpm/<pkg>@ver/node_modules/<pkg>` 경로 구조를 처리하지 못해 ESM 전용 패키지(`uuid`, `p-limit`, `yocto-queue`)가 Jest 변환에서 누락될 수 있었음. 새 정규식이 이를 올바르게 처리함:
  ```
  node_modules/(?!(?:\.pnpm/[^/]+/node_modules/)?(?:uuid|p-limit|yocto-queue)/)
  ```
  기능적으로 올바른 수정이며 추가 패키지 없음.

---

### [INFO] 기존 패키지 신규 활용 — `@nestjs/throttler`, `ApiBody`
- **위치**: `backend/src/modules/llm-config/llm-config.controller.ts`
- **상세**: `@nestjs/throttler`의 `@Throttle` 데코레이터와 `@nestjs/swagger`의 `ApiBody`를 `preview-models`, `GET :id/models` 엔드포인트에 적용. 모두 기존 의존성이므로 새 패키지 추가 없음. Rate limit(10req/60s)은 외부 LLM API 호출 비용과 SSRF 완화 측면에서 적절한 수준.

---

### [INFO] 내부 DTO 신규 모듈 — `PreviewLlmModelsDto`
- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts` (diff에 파일 내용 없음)
- **상세**: `llm-config.controller.ts`에서 import되는 내부 DTO. 외부 의존성 없으나 해당 파일 자체가 변경 목록에 없어 내용 검증 불가.
- **제안**: DTO에 `@IsIn(LLM_PROVIDERS)`와 `@IsUrl()` 등 적절한 `class-validator` 데코레이터가 적용됐는지 확인 필요

---

### [INFO] 다수 파일의 `as unknown as T` → 직접 값 제거
- **위치**: spec 파일 전반 (실행 엔진, 인터셉터, 인증, 스케줄러 등)
- **상세**: 테스트 픽스처에서 타입 강제 캐스팅을 제거하고 실제 값을 직접 전달하도록 개선. 의존성 관점에서 무관하며 타입 안전성을 높이는 긍정적 변경.

---

## 요약

이번 변경의 핵심 의존성 이슈는 **Google AI SDK의 전면 교체**(`@google/generative-ai` → `@google/genai`)다. 신 SDK 도입 자체는 Google의 공식 권장 방향에 부합하고 라이선스도 호환되나, `pnpm-lock.yaml` diff가 생략되어 실제 고정 버전과 구 패키지 제거 여부를 직접 검증할 수 없다는 점이 주요 우려사항이다. stream 응답 타입을 `unknown`으로 캐스팅하는 부분은 SDK 버전 업그레이드 시 런타임 오류가 묵인될 위험이 있어 보완이 필요하다. 나머지 변경들(Jest pnpm 정규식, Throttle 데코레이터 적용, 타입 캐스팅 정리)은 신규 외부 패키지 없이 기존 의존성을 올바르게 활용하거나 타입 안전성을 개선하는 방향이다.

## 위험도

**MEDIUM** — Google SDK 교체로 인한 런타임 동작 변화 가능성 및 lockfile 검증 불가가 주요 요인. 기능 자체는 테스트가 추가되어 있으나, stream 타입 캐스팅 우회가 향후 SDK 업그레이드 시 잠재적 위험을 남김.