# Security Review

대상 PR: LLM model select follow-up refactor (21개 파일, 프론트엔드 전용)

---

## 발견사항

### [INFO] 서버 원본 에러 메시지 노출 차단 — 긍정적 변경

- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`
- 상세: 이전 구현은 서버가 반환한 `data.message` 를 최대 200자로 잘라 그대로 UI에 노출했다. 변경 후에는 백엔드 에러 봉투(`{ error: { code, message } }`)의 `code` 필드만 키로 사용해 사전 정의된 i18n 메시지로 매핑하고, 매핑에 없는 코드와 비-Axios 에러는 모두 제네릭 fallback을 반환한다. 서버 원본 `message` — 내부 엔드포인트 URL, 스택 트레이스 일부, provider 세부 정보 등 — 는 절대 UI에 도달하지 않는다. 이는 OWASP A05(보안 설정 오류) / 정보 노출 취약점의 능동적 방어이다.
- 제안: 현재 구현 유지. 단, `messagesByCode` 파라미터가 optional이므로 맵이 전달되지 않으면 모든 Axios 에러가 fallback으로 처리된다는 점을 호출 사이트에서 일관되게 인식해야 한다(현재 `model-combobox.tsx`, `embedding-model-combobox.tsx` 모두 `buildLoaderErrorMessages(t)`를 전달하고 있어 정상).

### [INFO] 하드코딩된 시크릿 없음

- 위치: 전체 변경 파일
- 상세: API 키, 토큰, 인증서 등 하드코딩된 시크릿이 없다. 테스트 파일의 `apiKey: "***"`, `apiKey: "sk-xxx"` 는 실제 키가 아닌 테스트 픽스처로, 실제 서버 호출에 사용되지 않는다.

### [INFO] 컨텍스트 기반 LLM 기본 설정 플래그 — 정보 노출 범위 적절

- 위치: `codebase/frontend/src/components/editor/canvas/has-default-llm-config-context.ts`
- 상세: `HasDefaultLlmConfigContext`는 boolean 하나만 전달한다. 구체적인 LLM config ID, 키, 엔드포인트 등 민감 정보가 컨텍스트를 통해 누출될 가능성이 없다. 기존의 `useQuery(["llm-configs"])` 를 노드별로 구독하던 패턴에서 단일 boolean으로 변경됨으로써 노드 수 × 쿼리 구독에 의한 재렌더링이 감소하고, 민감 데이터 전파 경로도 축소되었다.

### [INFO] 입력 검증 — apiKey/baseUrl trim 유지

- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` (fetchModels 내부)
- 상세: `apiKey.trim()` / `baseUrl?.trim()` 로 공백을 제거한 뒤 API를 호출하는 패턴이 refactor 이후에도 `fetchModels` 클로저 안에 그대로 유지되어 있다. 의도치 않은 공백이 포함된 API 키가 전달되는 것을 방지한다.

### [INFO] OWASP A01(접근 제어) — 클라이언트 측 canLoad 게이트

- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` (canLoad 로직)
- 상세: 클라이언트에서 `canLoad` 가 `false`이면 `load()` 호출 자체가 발생하지 않아 불필요한 API 요청을 막는다. 그러나 이는 UI 보호이며, 서버 측 인가 검증을 대체하지 않는다. 서버가 적절히 인증/인가를 수행한다는 전제 하에 문제가 없다.

### [INFO] 에러 코드 기반 매핑 — 화이트리스트 방식의 안전한 설계

- 위치: `codebase/frontend/src/components/llm-config/loader-error-messages.ts`
- 상세: 현재 매핑은 `LLM_CREDENTIALS_REQUIRED`, `LLM_CONFIG_INVALID` 두 코드만 포함한다. 이 외의 코드는 fallback 처리된다. 화이트리스트 방식이므로 서버에서 새로운 에러 코드가 추가되더라도 사전에 정의하지 않으면 raw 메시지가 UI에 노출되지 않는다는 점에서 보안적으로 안전한 설계이다.

### [INFO] 의존성 — 알려진 취약점 없음(코드 범위 내)

- 위치: 전체 변경 파일
- 상세: 이번 변경에서 새로운 npm 의존성이 추가되지 않았다. `@tanstack/react-query`, `axios`, `react` 등 기존 의존성을 그대로 활용한다. 해당 패키지들의 알려진 취약점은 이번 변경 범위 밖이다.

---

## 요약

이번 변경은 보안 관점에서 전반적으로 긍정적이다. 핵심 개선사항은 `sanitize-loader-error.ts`의 전략 변경으로, 서버 원본 에러 메시지(내부 엔드포인트 URL, provider 세부 오류 등)를 완전히 차단하고 사전 정의된 i18n 코드 매핑만 UI에 노출한다. 이는 이전에 잠재적으로 존재하던 정보 노출 취약점(OWASP A05)을 명시적으로 해결한 것이다. 하드코딩된 시크릿, 인젝션 취약점, 경로 탐색, XSS 가능성은 발견되지 않았으며, 컨텍스트 기반 리팩터링도 민감 정보 전파 범위를 축소하는 방향으로 작동한다. 새로운 취약점 도입 없이 기존 보안 취약점을 제거한 변경으로 평가한다.

---

## 위험도

LOW

(잔류 위험: `testFailed`/`connectionFailed` 에 `{{error}}` 를 포함한 i18n 키가 별도로 존재하나, 이는 이번 변경 범위 밖이며 해당 흐름의 에러 sanitization 은 별도 검토가 필요하다.)
