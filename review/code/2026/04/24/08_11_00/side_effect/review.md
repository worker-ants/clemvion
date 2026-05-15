## 발견사항

### [WARNING] Google AI SDK 전면 교체 — 스트림 Usage 메타데이터 Fallback 제거
- **위치**: `google.client.ts` `stream()` 메서드
- **상세**: 구 SDK(`@google/generative-ai`)는 `sendMessageStream()` 호출이 `{ stream, response }` 쌍을 반환했고, 스트림 청크에 `usageMetadata`가 없으면 `await result.response`로 최종 집계값을 보조 조회했다. 신 SDK(`@google/genai`)의 `generateContentStream()`은 `AsyncGenerator`만 반환하므로 이 Fallback 경로가 통째로 삭제됐다. Gemini 모델 중 일부는 청크별 Usage를 스트리밍하지 않는 경우가 있어 **토큰 사용량이 0으로 기록될 수 있다**. 과금·모니터링 데이터에 직접 영향을 준다.
- **제안**: 스트림 종료 후 `done` 이벤트에서 `totalTokens === 0`이면 별도 `generateContent` (non-stream) 경량 호출로 usage를 보완하거나, 신 SDK가 `finalUsageMetadata`를 별도 제공하는지 확인해 반영한다.

---

### [WARNING] Anthropic `listModels` — 하드코딩 목록에서 실시간 API 호출로 전환
- **위치**: `anthropic.client.ts:132-143`
- **상세**: 이전에는 `Promise.resolve(ANTHROPIC_MODELS)`로 즉시 반환하던 것이 `client.models.list()`를 통해 실제 HTTP 요청을 보내게 됐다. **기존에 `listModels`가 실패 없이 항상 완료된다고 가정한 코드 경로**(예: 서비스 부팅 시 모델 목록 캐싱, `testConnection` 내부 호출 등)는 이제 네트워크 오류·401·429를 받을 수 있다. 또한 API Key가 잘못된 경우 종전과 달리 `listModels`도 실패한다.
- **제안**: 호출처(특히 `llm.service.ts`의 `listModels` 래퍼)에서 이미 타임아웃·에러 sanitize를 처리하고 있음을 확인했다. 단, `testConnection()` 구현이 내부적으로 `listModels`를 우회 없이 직접 쓰는 경우가 없는지 점검 필요.

---

### [WARNING] `llm.service.ts` `listModels` 에러 타입 변경
- **위치**: `llm.service.ts:197-209`
- **상세**: 기존 `client.listModels()` 호출은 프로바이더 원본 에러를 그대로 전파했다. 변경 후에는 `BadRequestException({ code: 'LLM_MODEL_LIST_FAILED', ... })`로 래핑된다. **기존에 특정 에러 타입(예: `AxiosError`, `APIError`)을 catch해 분기하던 상위 호출자**가 있다면 동작이 달라진다.
- **제안**: 이 메서드의 호출자(`llm-config.controller.ts`의 `GET :id/models` 핸들러)가 에러를 그대로 NestJS 파이프라인에 올리는지 확인. 현재 컨트롤러 코드에 별도 catch 없이 `throw`가 그대로 올라가므로 큰 문제는 없지만, 명시적 문서화가 권장된다.

---

### [WARNING] Google `embed()` — 순차 호출에서 배치 API로 전환
- **위치**: `google.client.ts:490-494`
- **상세**: 구현이 `for` 루프로 텍스트당 `embedContent(text)` 1건씩 호출하던 것이 `embedContent({ contents: texts })`의 단일 배치 호출로 바뀌었다. `@google/genai`의 배치 embed 응답 구조가 `response.embeddings[i].values`인지 실제 SDK 문서/타입을 검증해야 한다. **`embeddings`가 `undefined`이면 `[]`를 반환하고, `values`가 없으면 `[]` 벡터를 반환한다** — 호출자가 빈 벡터를 받아도 에러를 감지하지 못하면 임베딩 없이 저장되는 silent failure가 생긴다.
- **제안**: 배치 결과의 길이가 입력 `texts.length`와 일치하는지 assertion 또는 로그를 추가한다. 빈 `values`를 받았을 때 명시적으로 에러를 던지는 방어 코드를 고려한다.

---

### [INFO] `LLMClient` 인터페이스 시그니처 변경 — `signal` 파라미터 추가
- **위치**: `llm-client.interface.ts:107`
- **상세**: `listModels(): Promise<ModelInfo[]>` → `listModels(signal?: AbortSignal): Promise<ModelInfo[]>`. Optional 파라미터이므로 기존 구현체들은 컴파일 호환성을 유지한다. 단, 이 인터페이스를 구현하는 외부 또는 커스텀 클라이언트가 있다면 `signal`을 무시하더라도 AbortSignal 전달 후 취소 요청이 반영되지 않을 수 있다.
- **제안**: 현재 구현체(OpenAI, Anthropic, Google)는 모두 `signal`을 처리하므로 문제 없음. 단, `LocalClient`(OpenAI-compatible)는 변경 diff에 포함되지 않아 signal 지원 여부를 별도 확인 필요.

---

### [INFO] `previewModels` SSRF 방어 — DNS 리바인딩 미처리
- **위치**: `llm.service.ts` `isPrivateHost()`
- **상세**: IPv4 리터럴과 `localhost`, `::1`을 차단하지만, `internal.corp`, `attacker.example.com` 등 DNS를 통해 RFC1918 주소로 해석되는 호스트명은 통과한다. 이는 DNS 리바인딩 공격의 경로가 된다. 코드 주석(`// DNS 이름은 해석 비용상 제외`)에서 의도적 결정임을 밝히고 있다.
- **제안**: 허용 가능한 트레이드오프이나, `PreviewLlmModelsDto`의 `@IsUrl({ protocols: ['http','https'] })` 검증이 첫 번째 방어선임을 감안할 때, 실제 HTTP 요청 시 Node.js가 해석한 IP를 애플리케이션 레벨에서 재검증하거나 (`lookup` 후 체크), 또는 네트워크 정책(egress 방화벽)으로 보완해야 한다.

---

### [INFO] `package.json` transformIgnorePatterns — pnpm 가상 스토어 대응
- **위치**: `backend/package.json:124`
- **상세**: Jest의 `transformIgnorePatterns` 정규식이 pnpm의 `.pnpm/<pkg>/node_modules/<name>/` 경로를 처리하도록 수정됐다. 런타임에는 영향 없으며 테스트 전용 변경이다.
- **제안**: 현재 CI 환경이 npm/yarn을 사용하는 경우 기존 정규식에서도 동작하는지 확인 필요.

---

### [INFO] TypeScript `as unknown as T` → 리터럴 값 직접 대입 (전반적)
- **위치**: spec 파일들 전반 (파일 2~9, 11~16, 29~40 등)
- **상세**: 테스트 코드에서 타입 오버라이드를 위해 사용하던 `as unknown as T` 캐스팅을 제거하고 실제 값(`null`, `undefined`, `{}` 등)을 그대로 대입했다. 런타임 동작은 동일하며 TypeScript 컴파일러의 타입 검사가 실제로 적용된다.
- **부작용 없음**. 타입 안전성이 개선된 변경이다.

---

## 요약

이번 변경의 핵심은 **Google AI SDK 전면 교체**(`@google/generative-ai` → `@google/genai`)와 **`listModels` 실시간 API 전환**, 그리고 `previewModels` 신규 엔드포인트 추가다. 부작용 관점에서 가장 주목할 사항은 세 가지다: ① Google 스트림에서 토큰 usage fallback이 제거돼 일부 모델의 사용량 집계가 0이 될 수 있고, ② `listModels`가 이제 실제 HTTP 요청을 보내므로 종전에 항상 성공하던 코드 경로가 네트워크 오류를 받게 됐으며, ③ Google `embed()`의 배치 전환에서 빈 벡터 반환이 silent failure로 이어질 가능성이 있다. 나머지 변경(TypeScript 캐스팅 정리, DTO 추가, 프론트엔드 컴포넌트)은 의도하지 않은 부작용이 없다.

## 위험도

**MEDIUM**