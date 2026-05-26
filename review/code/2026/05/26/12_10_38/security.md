# 보안(Security) 리뷰

## 발견사항

### 에러 처리

- **[WARNING]** 서버 응답 에러 메시지의 클라이언트 노출 (부분 완화됨)
  - 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` L88, `use-embedding-model-loader.ts` onError
  - 상세: `sanitizeLoaderError` 가 서버의 `err.response?.data.message` 를 최대 200자까지 그대로 UI 에 노출한다. 이전 리뷰(SUMMARY #10)의 "200자 상한" 조치는 적용되었으나, 서버가 반환하는 `message` 필드 자체에 내부 경로, 쿼리 문자열, 프레임워크 스택 트레이스 일부가 포함될 수 있다. 200자 내에도 민감 정보(API endpoint 구조, 내부 서비스 이름 등)가 충분히 담길 수 있다.
  - 제안: 서버 오류 메시지를 그대로 노출하는 대신, 사전 정의된 오류 코드 기반으로 클라이언트측 i18n 메시지로 매핑하는 방식이 더 안전하다. 최소한 `message` 필드를 신뢰하기 전에 서버에서 해당 필드가 사용자-safe 임을 보장하도록 API 계약을 명확히 할 것을 권장한다.

### 입력 검증

- **[INFO]** `apiKey` / `baseUrl` trim 처리는 적절
  - 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` L506-507
  - 상세: `apiKey.trim()` / `baseUrl?.trim()` 이 `previewModels` 호출 직전에 적용되어 공백 포함 키가 그대로 전송되는 문제는 없다. 이 처리는 긍정적으로 유지된다.
  - 제안: 유지.

- **[INFO]** `model.id` / `model.name` 값이 서버에서 오며 JSX option 에 직접 렌더링됨
  - 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` L2846-2848
  - 상세: `<option key={m.id} value={m.id}>{renderOption ? renderOption(m) : defaultOptionLabel(m)}</option>` — React 는 JSX 내 텍스트 콘텐츠를 자동으로 이스케이프하므로 XSS 위험은 낮다. `value` 속성도 HTML attribute 로서 안전하게 처리된다. 다만 `renderOption` prop 이 `ReactNode` 를 허용하므로 호출자가 `dangerouslySetInnerHTML` 없이 마크업을 주입하는 경우는 안전하나, 미래에 해당 prop 을 통해 신뢰할 수 없는 HTML 을 렌더하는 경우를 주의해야 한다.
  - 제안: `renderOption` 문서에 "렌더 결과에 `dangerouslySetInnerHTML` 사용 금지" 를 명시할 것을 권장한다.

### 인증/인가

- **[INFO]** API 호출 인증 처리는 이번 변경 범위 외
  - 위치: `codebase/frontend/src/lib/api/llm-configs.ts`
  - 상세: `llmConfigsApi.list()` → `getAll()` → `apiClient.get("/llm-configs")` 경로에서 인증 토큰은 `apiClient` 의 axios 인터셉터 계층에서 처리되는 것으로 보인다. 이번 변경은 `getAll` → `list` 래핑 레이어 추가일 뿐 인증 흐름에는 영향을 주지 않는다.
  - 제안: 이번 변경 범위 내에서는 별도 조치 불필요.

### 하드코딩된 시크릿

- **[INFO]** 테스트 코드의 `apiKey: "***"` / `"sk-xxx"` 는 모의 값으로 실제 시크릿 아님
  - 위치: `codebase/frontend/src/components/llm-config/__tests__/llm-config-selector.test.tsx` L1944, `use-model-loader.test.tsx` 여러 줄
  - 상세: `baseConfig.apiKey: "***"` 와 `apiKey: "sk-xxx"` 는 테스트 픽스처 값으로, 실제 유효한 API 키가 아니다. `LlmConfigData.apiKey` 인터페이스 주석에도 `// masked` 로 표시되어 있어 서버가 마스킹된 값을 반환함을 나타낸다. 하드코딩된 진짜 시크릿은 발견되지 않음.
  - 제안: 현재 상태 유지.

### OWASP / 기타

- **[INFO]** `LlmConfigData.apiKey` 마스킹 의존
  - 위치: `codebase/frontend/src/lib/api/llm-configs.ts` L15 (`apiKey: string; // masked`)
  - 상세: 인터페이스에 `// masked` 주석이 있으나, 마스킹 보장은 전적으로 백엔드 구현에 의존한다. 프론트엔드는 이 값을 드롭다운 옵션 렌더링에 사용하지 않으므로 현 변경 범위에서는 직접적인 노출 경로가 없다. 그러나 미래에 `LlmConfigData.apiKey` 를 화면에 표시하는 코드가 추가될 경우 백엔드 마스킹 계약이 지켜지는지 별도로 확인해야 한다.
  - 제안: 타입 정의에 `@sealed` 또는 주석으로 "절대 UI 에 직접 렌더하지 말 것" 경고를 추가하는 것을 권장한다.

## 요약

이번 변경은 `llmConfigsApi.getAll()` 의 응답 정규화 책임을 새 `list()` 메서드로 이동하고, 여러 컴포넌트에서 반복되던 이중 타입-캐스팅 패턴을 제거하는 구조 리팩터링이다. 보안 관점에서 신규 취약점은 도입되지 않았으며, 이전 리뷰에서 지적된 서버 에러 메시지 무제한 노출 문제는 200자 상한(`sanitizeLoaderError`)으로 부분 완화되었다. 주요 관찰 사항은 서버 `message` 필드를 200자 이내에서도 그대로 노출하는 패턴이 여전히 남아 있다는 점과, `renderOption` prop 이 미래에 신뢰할 수 없는 콘텐츠 렌더링 경로가 될 수 있다는 점이다. SQL 인젝션·커맨드 인젝션·LDAP 인젝션·경로 탐색·하드코딩된 시크릿·안전하지 않은 암호화 알고리즘·인증 우회에 해당하는 문제는 발견되지 않았다.

## 위험도

LOW
