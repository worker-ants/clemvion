### 발견사항

---

**[WARNING] SSRF 가드의 DNS 이름 미검증**
- 위치: `backend/src/modules/llm/llm.service.ts` — `isPrivateHost()`
- 상세: IPv4 리터럴과 `localhost`/`::1`만 차단하며, DNS 이름은 의도적으로 제외하고 있음 (`// DNS 이름은 해석 비용상 제외`). 따라서 `169.254.169.254.nip.io`나 내부망 IP로 DNS resolve되는 커스텀 도메인을 통해 SSRF 가드를 우회할 수 있음. API Key를 다루는 보안 민감 엔드포인트에서 이 트레이드오프는 의미있는 위험.
- 제안: 단기적으로는 현재 방식을 유지하되 문서에 명시. 장기적으로는 connect 전 DNS resolve 결과를 검사하거나(Node `dns.lookup`) 프록시 기반 egress 제어 도입.

---

**[WARNING] `local` 프로바이더의 내부망 접근 무제한 허용**
- 위치: `llm.service.ts` — `previewModels()`
- 상세: `provider !== 'local'` 조건으로 SSRF 가드를 완전히 우회. 사용자가 `{ provider: 'local', baseUrl: 'http://10.0.0.1:6379' }` 등으로 내부 서비스에 임의 HTTP 요청을 발생시킬 수 있음. 이는 설계 결정이지만 공격자가 `local`을 선언하기만 하면 내부망이 열리는 구조임.
- 제안: `local` 프로바이더에 대해 `baseUrl` 경로를 `localhost`/`127.x.x.x`/`::1`만 허용하는 화이트리스트 적용을 검토. 현재는 `editor` 권한만 있으면 누구든 내부망 스캔 가능.

---

**[WARNING] `isPrivateHost`가 import 블록 사이에 위치**
- 위치: `llm.service.ts` — 파일 상단
- 상세: `import { ... } from '@nestjs/common'` 이후, `import { LLMClient, ... }` 이전에 함수가 삽입됨. TypeScript는 호이스팅으로 동작하지 않아 실행 시 문제는 없으나, import 사이에 함수가 끼어있는 구조는 가독성과 린터 규칙을 위반하며 모듈 경계를 흐림.
- 제안: import 블록을 모두 완료한 뒤 함수 정의. 혹은 `src/common/utils/ssrf.util.ts`로 분리해 재사용성 확보.

---

**[WARNING] `buildGenerationConfig`가 `Record<string, unknown>` 반환**
- 위치: `google.client.ts` — `buildGenerationConfig()`
- 상세: 반환 타입이 `Record<string, unknown>`으로 SDK가 기대하는 타입 정보를 완전히 잃음. `this.ai.models.generateContent({ config })` 호출 시 타입 체크가 동작하지 않아, 잘못된 config 필드가 런타임까지 발견되지 않을 수 있음.
- 제안: `@google/genai`의 `GenerateContentConfig` 타입을 명시적으로 사용하거나, 타입을 최소한 `Partial<GenerateContentConfig>`로 좁혀 컴파일 타임 안전성 확보.

---

**[INFO] `buildGenerationConfig`에 `hasTools` 파라미터 전달**
- 위치: `google.client.ts`
- 상세: `hasTools: boolean`을 호출부에서 계산해서 넘기는데, 메서드 내부에서 `params.tools?.length`로 직접 도출 가능. 호출부가 계산 책임을 떠안고 있어 SRP 위반 소지.
- 제안: 메서드 시그니처에서 `hasTools` 제거하고 내부에서 `params`로 도출.

---

**[INFO] Gemini 특화 동작 설명 주석 대거 제거**
- 위치: `google.client.ts`
- 상세: `thoughtSignature` echo 이유, `functionResponse` role 규칙, `ObjectSchema.properties` 빈 배열 거부 이유 등 Gemini 특화 제약을 설명하던 주석이 SDK 마이그레이션 과정에서 삭제됨. 이 정보는 코드만으로 추론하기 어려운 외부 API 제약이므로 향후 유지보수 시 동일한 오류를 반복할 위험이 있음.
- 제안: 삭제된 설명 중 SDK 문서로 대체되지 않는 런타임 제약(thoughtSignature echo, empty properties 거부 등)은 한 줄 수준으로 복원.

---

**[INFO] `withTimeout`이 private으로 제한되어 재사용 불가**
- 위치: `llm.service.ts`
- 상세: `testConnection` 등 다른 외부 API 호출에서도 동일한 타임아웃 패턴이 필요할 수 있으나, `private`으로 선언되어 있어 서비스 내부에서만 사용 가능. 현재는 `previewModels`와 `listModels`에만 적용됨.
- 제안: 즉각적 변경 불필요. 향후 타임아웃 적용 범위가 넓어지면 `TimeoutHelper` 유틸로 분리 고려.

---

**[INFO] `listModels` 캐싱 부재 (live 호출 전환 후)**
- 위치: `anthropic.client.ts`, `google.client.ts`, `openai.client.ts`
- 상세: 기존 하드코딩 목록 → 프로바이더 API 실시간 호출로 변경. `GET /llm-configs/:id/models` 엔드포인트는 저장된 설정마다 매번 외부 API를 호출함. 트래픽이 늘거나 UI에서 폴링 시 프로바이더 rate limit에 도달할 수 있음.
- 제안: 현 규모에서는 무방. 부하가 늘면 TTL 기반 in-memory 캐시(e.g., 5분) 도입 검토.

---

### 요약

이번 변경의 핵심은 세 가지다: (1) 광범위한 `as unknown as X` 제거로 타입 안전성 향상, (2) Google AI SDK를 `@google/generative-ai`에서 `@google/genai`로 마이그레이션하면서 상태형 chat 세션 → 무상태 `generateContent` 방식으로 전환 (서비스 계층에 더 적합한 구조), (3) 저장 전 자격증명으로 모델 목록을 미리 조회하는 `previewModels` 기능 추가. `previewModels`는 timeout/AbortSignal/에러 sanitize/로깅 규율 모두 적절히 적용했으나, `isPrivateHost`의 DNS 미검증과 `local` 프로바이더의 내부망 접근 허용이 실질적 SSRF 위험으로 남아 있어 보안 정책 결정이 필요하다.

### 위험도
**MEDIUM** — 기능적 구조는 건전하나 `previewModels`의 SSRF 가드에 DNS 우회 경로가 존재하며, `local` 프로바이더로 내부망 접근이 가능한 설계는 명시적 보안 결정으로 문서화되어야 함.