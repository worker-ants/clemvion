### 발견사항

- **[CRITICAL]** `previewModels` 엔드포인트에 Rate Limiting 없음
  - 위치: `llm.service.ts` `previewModels()` / `llm-config.controller.ts` `@Post('preview-models')`
  - 상세: 이 엔드포인트는 매 호출마다 외부 LLM Provider API를 실제로 호출한다. NestJS의 `@Throttle` 데코레이터나 별도 미들웨어 없이 노출되어 있어, 악의적이거나 버그 있는 클라이언트가 빠르게 반복 호출하면 Provider API 쿼터 소진 및 서버 커넥션 고갈로 이어질 수 있다. 기존 `testConnection`이나 `listModels` 엔드포인트에 Rate Limiting이 적용되어 있다면 이 엔드포인트도 동일하게 적용해야 한다.
  - 제안: `@Throttle({ default: { limit: 10, ttl: 60000 } })` 수준의 per-user Rate Limiting 적용

- **[WARNING]** `previewModels` 내 외부 HTTP 호출에 명시적 Timeout 없음
  - 위치: `llm.service.ts:220` `return await client.listModels();`
  - 상세: `client.listModels()`는 외부 Provider API로 나가는 HTTP 호출이다. Provider가 느리거나 응답 없을 경우 서버 스레드/이벤트 루프 자원이 무기한 점유된다. spec §6에서 타임아웃 120초를 언급하지만 `previewModels`에는 적용되지 않는다.
  - 제안: `Promise.race([client.listModels(), timeout(30_000)])` 혹은 clientFactory.create 시 timeout 옵션 전달

- **[WARNING]** `ModelCombobox`에서 동일 자격증명으로 반복 요청 시 결과 캐싱 없음
  - 위치: `model-combobox.tsx` `loadMutation`
  - 상세: `useMutation`은 결과를 캐시하지 않는다. 사용자가 "모델 불러오기"를 `provider=openai, apiKey=sk-xxx`로 두 번 클릭하면 동일 자격증명으로 외부 API 호출이 두 번 발생한다. 버튼이 `isPending` 중에는 비활성화되지만, 완료 후 즉시 재클릭하면 중복 호출이 발생한다.
  - 제안: `useQuery`로 전환하고 `queryKey: ['preview-models', provider, apiKey, baseUrl]`로 설정하면 동일 파라미터에 대해 자동 캐싱·중복 제거된다. 또는 마지막 성공한 `(provider, apiKey, baseUrl)` 조합을 `useRef`로 기록해 동일 시 스킵

- **[WARNING]** 새 `LLMClient` 인스턴스를 요청마다 생성
  - 위치: `llm.service.ts:196-207`
  - 상세: 보안 설계상 캐시 우회는 올바르다. 그러나 `clientFactory.create()`가 내부적으로 Axios 인스턴스, 헤더 파서, SDK 초기화 등을 수행한다면 요청당 생성 비용이 누적된다. 현재 구현이 per-request 빠른 생성을 보장하는지 factory 구현 확인 필요.
  - 제안: Factory가 무거운 경우 provider+options 해시로 임시 캐시(TTL 60초 등)를 두되 apiKey는 캐시 키에만 사용하고 인스턴스에는 포함하지 않는 방식 고려

- **[INFO]** `(data?.data ?? data)` 이중 언래핑 패턴
  - 위치: `llm-configs.ts:73, 84`
  - 상세: API 응답 구조가 일관되지 않아 방어적 unwrapping이 필요한 상태다. 기능 문제는 없으나 응답 페이로드를 두 번 평가하며, 구조 불일치를 런타임에 보정하는 패턴은 직렬화/역직렬화 계층에서 일관성이 있다면 제거될 수 있다.
  - 제안: API 클라이언트 인터셉터 레벨에서 response envelope을 일관되게 벗겨내면 모든 API 메서드에서 제거 가능

- **[INFO]** `sanitizeErrorMessage`의 순차 문자열 비교
  - 위치: `llm.service.ts` `sanitizeErrorMessage()`
  - 상세: 에러 경로(success path 아님)에서만 호출되고 비교 항목도 7개 미만이므로 현재는 무시 가능한 수준이다. 다만 Provider 종류가 늘어 비교 케이스가 증가하면 `Map<RegExp, string>` 패턴이 더 관리하기 쉽다.

---

### 요약

이번 변경의 핵심인 `previewModels` 기능은 전반적으로 적절하게 설계되었다. 캐시 우회, 에러 sanitize, apiKey 미로깅 등 보안/정확성 측면은 양호하다. 그러나 **성능 위험은 외부 LLM Provider 호출에 집중**된다. 백엔드에 Rate Limiting과 Timeout이 없으면 느린 Provider 응답이나 반복 호출 시 서버 자원이 점유되고 Provider 쿼터가 예상치 못하게 소진될 수 있다. 프론트엔드 `ModelCombobox`는 버튼 비활성화로 동시 중복을 막지만 완료 후 재클릭에는 무방비이므로 `useQuery` 기반 캐싱으로 보완하면 불필요한 외부 API 호출을 줄일 수 있다.

### 위험도

**MEDIUM** — 외부 API 호출 경로에 Rate Limiting/Timeout 미적용이 주요 위험이며, 트래픽이 많아지면 HIGH로 상승 가능