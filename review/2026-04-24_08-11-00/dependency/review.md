### 발견사항

- **[CRITICAL]** `@google/generative-ai` → `@google/genai` SDK 교체 시 스트림 반환 타입 불명확
  - 위치: `google.client.ts`, stream() 메서드
  - 상세: `this.ai.models.generateContentStream()`의 반환값을 `as AsyncIterable<unknown>`으로 강제 캐스팅하고 있음. 이는 `@google/genai` 패키지의 TypeScript 타입 정의가 불완전하거나, 실제 런타임 반환 타입이 SDK 문서와 다름을 의미함. 청크를 다시 `as { candidates?: ...; usageMetadata?: ... }` 로 캐스팅하는 코드가 120+ 라인 뒤에 위치해 실제 타입과 코드가 조용히 어긋날 경우 런타임 에러가 무방비 상태
  - 제안: `@google/genai` 의 제네릭 타입이 올바르게 정의된 버전을 확인하고, 가능하면 `unknown` 캐스팅 없이 SDK 제공 타입을 사용하도록 수정. 중간 타입 가드(`hasProperty`, `isChunkShape`)를 추가해 런타임 안전성 확보

- **[WARNING]** `pnpm-lock.yaml` diff가 생략되어 `@google/genai` 버전 고정 여부를 확인할 수 없음
  - 위치: `backend/pnpm-lock.yaml` (diff omitted)
  - 상세: `@google/generative-ai`에서 `@google/genai`로의 교체는 Breaking Change가 포함된 메이저 SDK 전환임. lock 파일에서 고정된 정확한 버전 및 이전 패키지가 완전히 제거되었는지 확인이 필요함. 두 SDK가 동시에 설치되어 있을 경우 번들 크기가 중복 증가함
  - 제안: `pnpm list @google/generative-ai @google/genai`로 두 패키지가 동시에 설치되지 않음을 확인. `package.json` dependencies에서도 이전 패키지가 제거되었는지 검토

- **[WARNING]** `Anthropic.models.list()`의 비동기 페이지네이션 추가 — 요청 수 무제한
  - 위치: `anthropic.client.ts`, `listModels()` 메서드
  - 상세: `for await (const m of this.client.models.list(...))` 로 전체 모델 목록을 순회하지만 페이지 상한이 없음. Google 클라이언트는 `MAX_MODELS = 100`으로 제한하는 반면 Anthropic 클라이언트는 제한 없음. Anthropic이 수백 개 모델을 반환할 경우 불필요한 HTTP 요청 누적 가능
  - 제안: Google 클라이언트와 동일하게 상한(`MAX_MODELS`)을 추가하거나, SDK의 `limit` 파라미터를 활용

- **[WARNING]** `isPrivateHost`의 SSRF 가드가 DNS 기반 공격에 취약
  - 위치: `llm.service.ts`, `isPrivateHost()` 함수
  - 상세: 함수 내 주석에도 언급되었듯 IPv4 숫자 리터럴만 차단하고 DNS 이름은 검사하지 않음. `http://internal.corp/` 또는 DNS rebinding으로 내부 서비스를 가리키는 도메인은 통과함. 의존성 문제는 아니나, 이 함수가 외부 라이브러리(`dns.lookup` 등) 없이 구현된 것이 제약으로 작용함
  - 제안: 현재 구현의 한계를 명시적 주석으로 문서화하거나, Node.js 내장 `dns.promises.lookup`으로 실제 IP 해석 후 검사하는 방어층 추가

- **[INFO]** `transformIgnorePatterns` 정규식 개선 — pnpm 호환성 확보
  - 위치: `backend/package.json`
  - 상세: 변경된 패턴 `node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:uuid|p-limit|yocto-queue)/)` 은 pnpm의 가상 스토어 경로(`node_modules/.pnpm/<pkg>@ver/node_modules/<pkg>/`)와 플랫 경로 양쪽을 올바르게 커버함. ESM-only 패키지(uuid, p-limit, yocto-queue)의 Jest 트랜스파일 누락 문제를 해결하는 적절한 수정

- **[INFO]** `@nestjs/throttler` — 기존 의존성, 신규 추가 아님
  - 위치: `llm-config.controller.ts`
  - 상세: `preview-models` 엔드포인트에 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`(분당 10회) 적용. NestJS throttler가 이미 프로젝트에 등록된 의존성이라면 올바른 사용

- **[INFO]** `ModelCombobox` 컴포넌트 및 `llmConfigsApi.previewModels` — 내부 의존성
  - 위치: `frontend/src/app/(main)/llm-configs/page.tsx`, `frontend/src/lib/api/llm-configs.ts`
  - 상세: `ModelCombobox`는 새로운 내부 컴포넌트이며 diff에 포함되지 않음. `data?.data ?? data` 패턴으로 응답 래핑 여부에 무관하게 동작하도록 방어적 처리가 되어 있음

---

### 요약

이번 변경의 핵심 의존성 이슈는 `@google/generative-ai`에서 `@google/genai`로의 SDK 전면 교체다. 코드 마이그레이션 자체는 신 SDK의 API 패턴을 잘 따르고 있으나, 스트림 반환 타입에 `as AsyncIterable<unknown>` 강제 캐스팅이 남아있어 TypeScript 타입 안전성에 공백이 생겼다. `pnpm-lock.yaml` diff가 생략되어 이전 패키지(`@google/generative-ai`) 완전 제거 여부와 `@google/genai` 고정 버전을 직접 검증하지 못하는 점이 아쉽다. 나머지 변경(`transformIgnorePatterns` 정규식 개선, `as unknown as T` 타입 단언 제거)은 코드 품질을 높이는 긍정적 정리이며 의존성 측면에서 문제가 없다.

### 위험도

**MEDIUM** — Google SDK 타입 캐스팅 공백과 pnpm-lock 검증 불가로 인한 잠재적 런타임 리스크. Anthropic `listModels` 페이지 상한 미적용은 부하 환경에서 문제가 될 수 있으나 치명적이지는 않음.