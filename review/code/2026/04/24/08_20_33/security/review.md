## Security Code Review

### 발견사항

---

**[WARNING]** API 키가 클라이언트 컴포넌트 props로 직접 전달됨
- **위치**: `model-combobox.tsx` — `mutationFn` 클로저, `apiKey` prop
- **상세**: `apiKey`가 React 컴포넌트 prop으로 전달되고 `mutationFn` 클로저에 캡처된다. React DevTools, 브라우저 메모리 스냅샷, 또는 `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` 접근으로 키 값이 노출될 수 있다. 특히 클라이언트에서 직접 LLM provider API를 호출하는 구조라면, 브라우저 Network 탭에서 키가 그대로 노출된다.
- **제안**: API 키는 서버 측에서만 보관·사용해야 한다. 백엔드 프록시를 경유해 `configId` 기반 참조만 프론트엔드에 노출하고, `apiKey` 문자열은 절대 클라이언트로 내려오지 않도록 설계 검토 필요.

---

**[WARNING]** `baseUrl` 입력이 백엔드로 전달될 경우 SSRF 위험
- **위치**: `model-combobox.tsx` — `mutationFn` 내 `baseUrl` 처리
- **상세**: 리뷰 내용에서 `PROVIDERS_REQUIRING_BASE_URL.has(provider) && !(baseUrl?.trim())` 조건으로 로컬 프로바이더의 baseUrl을 검사한다고 명시되어 있다. 이 `baseUrl`이 백엔드로 전송되어 서버가 해당 URL로 요청을 보내는 구조라면, 공격자가 `http://169.254.169.254/` (AWS 메타데이터), `http://internal-service/` 등의 내부 URL을 주입해 SSRF(Server-Side Request Forgery)를 유발할 수 있다.
- **제안**: 백엔드에서 `baseUrl`을 허용 목록(allowlist) 또는 정규식으로 검증하고, 프라이빗 IP 대역(`10.x`, `172.16.x–31.x`, `192.168.x`, `169.254.x`, `::1` 등) 접근을 명시적으로 차단해야 한다.

---

**[WARNING]** 에러 메시지가 백엔드 응답을 그대로 렌더링할 경우 정보 노출 가능
- **위치**: `model-combobox.tsx` — `onError` 핸들러, 에러 메시지 표시 로직
- **상세**: 테스트에 `'Authentication failed. Please check your API key.'`라는 백엔드 응답 메시지가 그대로 UI에 표시되는 패턴이 확인된다. "sanitized error message"라는 표현이 있으나, 실제로 어떤 필드를 표시하는지 불분명하다. `response.data.message`를 무조건 렌더링하면, 백엔드가 내부 스택 트레이스, DB 오류, 또는 민감한 설정 정보를 포함한 메시지를 반환할 경우 사용자에게 그대로 노출된다.
- **제안**: 에러 메시지는 허용된 상수 문자열 또는 i18n 키로만 표시하거나, 백엔드에서 이미 안전한 사용자 메시지를 별도 필드(`userMessage`)로 구분해 반환하는 방식을 권장한다.

---

**[INFO]** stale 클로저로 인한 자격증명 교차 적용 위험
- **위치**: `model-combobox.tsx` — `mutationFn` / `onSuccess` 간 props 불일치 (side-effect 리뷰에서 지적됨)
- **상세**: `provider`가 `openai → anthropic`으로 변경된 상태에서 이전 요청의 `onSuccess`가 실행되면, openai `apiKey`로 가져온 모델 목록이 anthropic 컨텍스트에 적용된다. 보안 측면에서 이는 의도하지 않은 자격증명 혼용을 의미한다. 기능적 버그이나, 한 provider의 API 키 유효성이 다른 provider 컨텍스트에서 검증된 것처럼 보일 수 있다.
- **제안**: `onSuccess` 내에서 반드시 `variables`와 현재 props를 비교 후 상태를 업데이트해야 한다. 이는 기능 수정이지만 자격증명 격리 관점에서도 필수.

---

**[INFO]** `as never` 타입 우회가 테스트에서 보안 관련 인터페이스 변경을 숨길 위험
- **위치**: `llm-config.controller.spec.ts` — `new LlmConfigController(mockLlmConfigService as never, ...)`
- **상세**: `as never`는 TypeScript 타입 검사를 완전히 우회한다. 컨트롤러가 인증·인가 관련 메서드(가드, 데코레이터)를 추가하더라도 테스트 컴파일 단계에서 경고가 발생하지 않아 보안 로직이 테스트에서 누락될 수 있다.
- **제안**: `as unknown as LlmConfigService`로 변경하면 최소한 `unknown`을 거치므로 인터페이스 변경 시 컴파일 오류가 발생한다.

---

**[INFO]** 에러 경로 미검증으로 인한 sanitize 로직 회귀 위험
- **위치**: `llm-configs.test.ts` — 성공 경로만 테스트
- **상세**: API 호출 실패 케이스가 테스트되지 않으므로, 향후 에러 처리 코드 변경 시 민감한 정보(예: raw axios 에러 객체, 내부 URL, 헤더 등)가 UI로 누출되는 회귀가 자동으로 감지되지 않는다.
- **제안**: `mockRejectedValue`로 다양한 에러 형태(네트워크 오류, 401, 403, 500)를 테스트하고, 각 케이스에서 UI에 표시되는 메시지가 예상된 안전한 문자열인지 assert해야 한다.

---

### 요약

이 변경사항의 핵심 보안 리스크는 클라이언트 측 API 키 노출과 `baseUrl` 입력의 SSRF 가능성이다. `apiKey`가 React props를 통해 클라이언트에서 직접 처리되는 구조는 브라우저 DevTools 및 네트워크 탭에서의 노출 경로를 만들며, `baseUrl`이 백엔드로 전달되어 서버가 직접 사용한다면 SSRF 공격 경로가 된다. 에러 메시지의 표면적 sanitize는 확인되지만 실제 구현 범위가 불명확해 정보 노출 위험이 남아 있다. 테스트 측에서는 에러 경로 미검증으로 인해 향후 보안 회귀가 자동 탐지되지 않을 수 있다. 현재 코드만으로는 실제 익스플로잇 가능성을 단정할 수 없으나, API 키 흐름과 baseUrl 사용 방식에 대한 아키텍처 수준의 검토가 권고된다.

### 위험도

**MEDIUM**

> `baseUrl` SSRF 여부와 `apiKey`의 실제 전송 경로(클라이언트 직접 vs 백엔드 프록시)가 확인되면 HIGH로 상향될 수 있다.