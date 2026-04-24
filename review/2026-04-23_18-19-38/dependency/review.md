### 발견사항

---

**[WARNING] `@google/generative-ai` → `@google/genai` SDK 메이저 마이그레이션**
- 위치: `google.client.ts` 전체 + `pnpm-lock.yaml`
- 상세: 구 SDK(`@google/generative-ai`)는 `chat session` 패턴(`startChat → sendMessageStream`)을 사용했으나, 신 SDK(`@google/genai`)는 `ai.models.generateContent*()` 직접 호출 방식으로 변경되었다. 이는 단순 버전 업이 아닌 API 계층 전체 교체다. 특히 스트리밍 반환 타입을 `AsyncIterable<unknown>`으로 강제 캐스팅하는 구간(`stream = (await this.ai.models.generateContentStream(...)) as AsyncIterable<unknown>`)이 있어, SDK 타입 정의와 런타임 실제 타입 간 불일치 가능성이 있다.
- 제안: `@google/genai`의 `generateContentStream` 반환 타입을 직접 확인하여 캐스팅 없이 사용 가능한지 점검. 불가능하면 `unknown` 대신 SDK 내부 청크 타입을 명시적으로 import해 사용 권장.

---

**[WARNING] 구 패키지 제거 여부 확인 불가**
- 위치: `backend/package.json`, `pnpm-lock.yaml` (diff 생략됨)
- 상세: `pnpm-lock.yaml` diff가 크기 제한으로 생략되어 `@google/generative-ai` 패키지가 실제로 제거되고 `@google/genai`로 대체되었는지 확인 불가. 두 패키지가 동시에 존재하면 불필요한 중복 번들이 발생한다. 또한 신 패키지의 버전 고정(exact version pin) 여부도 확인 불가.
- 제안: `pnpm list @google/generative-ai @google/genai`로 두 패키지 공존 여부 확인. `package.json`에서 `@google/generative-ai` 제거 여부 명시적으로 검증 필요.

---

**[WARNING] 스트리밍 usage token 집계 로직 제거**
- 위치: `google.client.ts` (구 `result.response` 폴백 제거 부분)
- 상세: 구 SDK는 청크에 `usageMetadata`가 없을 경우 `await result.response`에서 한 번 더 usage를 시도하는 폴백이 있었다. 신 SDK 마이그레이션 시 이 폴백이 제거되었다. 신 SDK가 항상 마지막 청크에 `usageMetadata`를 포함하는지 검증되지 않으면 `totalTokens === 0`이 되는 케이스가 발생할 수 있다.
- 제안: `@google/genai` SDK의 스트리밍에서 usage가 항상 청크에 포함된다는 공식 보장이 있는지 확인. 불확실하면 마지막 청크 이후 누적 usage가 0인 경우 경고 로그라도 남기는 것이 권장.

---

**[INFO] `@nestjs/throttler` `Throttle` 데코레이터 신규 사용**
- 위치: `llm-config.controller.ts:13`
- 상세: `preview-models` 엔드포인트에 `@Throttle({ default: { limit: 10, ttl: 60_000 } })`가 적용되었다. `@nestjs/throttler`가 이미 `package.json` dependencies에 있다면 문제 없으나, 신규 추가라면 `ThrottlerModule`의 전역 설정과 per-route 설정 간 우선순위를 확인해야 한다.
- 제안: `app.module.ts`에 `ThrottlerModule.forRoot()`가 등록되어 있는지, 전역 `ThrottlerGuard`가 있는지 확인. 없으면 `@Throttle` 데코레이터 단독으로는 동작하지 않는다.

---

**[INFO] Jest `transformIgnorePatterns` pnpm 대응 개선**
- 위치: `backend/package.json:124`
- 상세: 기존 패턴 `node_modules/(?!uuid|p-limit|yocto-queue)`은 pnpm의 가상 스토어 경로(`.pnpm/<pkg>@<ver>/node_modules/<pkg>`)를 처리하지 못했다. 신규 패턴 `node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:uuid|p-limit|yocto-queue)/)`은 일반 `node_modules`와 pnpm 중첩 경로를 모두 커버하여 ESM 패키지 transform 누락을 방지한다. 정확한 수정이다.

---

**[INFO] `embed()` 시퀀셜 → 배치 호출 변경**
- 위치: `google.client.ts` `embed()` 메서드
- 상세: 구 구현은 텍스트 배열을 순차적으로 `embedContent`를 호출했으나, 신 구현은 `contents: texts` 배열을 한 번에 전달한다. 신 SDK의 `embedContent`가 실제로 string[] 배치를 지원하는지, 응답 `embeddings` 배열의 순서가 입력 순서와 일치하는지 확인이 필요하다.
- 제안: `@google/genai` 공식 문서에서 `embedContent` 배치 동작 명세 확인. 순서 보장이 없다면 개별 호출 후 병합하는 방식으로 복구 필요.

---

### 요약

이번 변경의 핵심 의존성 리스크는 `@google/generative-ai`에서 `@google/genai`로의 메이저 SDK 교체이다. 코드 레벨에서의 마이그레이션 자체는 신 SDK API에 맞게 잘 적용되었으나, ① pnpm-lock.yaml 검증 불가로 인한 패키지 공존 위험, ② 스트리밍 usage 폴백 제거로 인한 token 집계 누락 가능성, ③ `AsyncIterable<unknown>` 캐스팅에 의한 런타임 타입 불일치 가능성이 잠재적 위험으로 남아 있다. `@nestjs/throttler` 사용은 기존 모듈 등록 여부에 따라 silent failure가 발생할 수 있어 확인이 필요하다. 나머지 변경(TypeScript cast 제거, transformIgnorePatterns 수정, 신규 DTO)은 모두 의존성 관점에서 안전하다.

### 위험도

**MEDIUM**