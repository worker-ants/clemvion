# 보안(Security) 리뷰

리뷰 대상: LLM 모델 select-only 전환 (llm-model-select-4857c3)
리뷰 일시: 2026-05-26

---

## 발견사항

### **[WARNING]** 서버 에러 메시지가 검증 없이 UI 에 그대로 노출됨
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` — `onError` 핸들러 (lines 591-601)
- 상세: Axios 에러 응답의 `err.response?.data?.message` 값을 `setErrorMessage` 에 직접 전달하여 `<p>` 태그로 렌더링한다. 이 값은 백엔드 또는 upstream LLM provider 에서 반환한 메시지이므로, provider 가 내부 스택 트레이스, DB 쿼리 단편, API 엔드포인트 경로, 내부 서비스 이름 등 민감 정보를 포함한 에러 메시지를 반환할 경우 그대로 사용자 화면에 표시된다. 단, React 는 JSX 렌더링 시 자동으로 HTML 인코딩을 수행하므로 XSS 위험은 없다. 에러 정보 노출 관점의 문제이다.
- 제안: 에러 메시지 길이 상한(예: 200자)을 두고, 허용되지 않는 패턴(스택 트레이스 지표 키워드 등)을 필터링하거나, 단순히 i18n 키(`embeddingModelLoadFailed`)로만 표시하고 상세 메시지는 로그에만 기록하는 방식을 권장한다.

### **[WARNING]** 서버 에러 메시지가 검증 없이 UI 에 그대로 노출됨 (model-combobox)
- 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx` — `useModelLoader` 훅을 통한 에러 처리 경로
- 상세: `useModelLoader` 내부에서도 동일한 패턴으로 `err.response?.data?.message` 를 `errorMessage` state 에 저장하고 `<p>` 태그로 렌더링한다. 테스트 코드(`model-combobox.test.tsx`)에서 `"Authentication failed. Please check your API key."` 같은 provider 메시지가 그대로 UI 에 표시되는 것을 명시적으로 검증하고 있으므로 이 동작이 의도적임은 확인되나, provider 에 따라 더 민감한 정보가 포함될 수 있다.
- 제안: embedding-model-combobox 와 동일. 서버 반환 메시지를 그대로 노출하기보다 범주화된 에러 메시지(연결 실패/인증 실패/모델 없음 등)를 제공하는 방향이 바람직하다.

### **[INFO]** 테스트 코드에 더미 API 키 패턴이 하드코딩됨
- 위치: `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx` — `apiKey="sk-xxx"`, `apiKey="sk-new-key"`, `apiKey="bad-key"` 등 다수 줄
- 상세: 테스트 파일에 `sk-` prefix 패턴의 더미 API 키가 하드코딩되어 있다. 실제 유효한 키가 아닌 플레이스홀더이므로 직접적인 보안 위협은 없으나, 자동화된 시크릿 스캐너(예: GitLeaks, truffleHog)가 오탐(false positive)을 일으킬 수 있다. 또한 실수로 실제 키가 테스트 코드에 삽입될 경우의 패턴을 정착시키는 선례가 된다.
- 제안: `sk-test-placeholder` 처럼 명백히 더미임을 나타내는 패턴을 사용하거나, `FAKE_API_KEY` 상수로 추출해 파일 상단에 선언한다.

### **[INFO]** `savedValueMissingFromLoaded` 조건에서 외부 데이터가 option value 로 삽입됨
- 위치: `embedding-model-combobox.tsx` lines 631-635, `model-combobox.tsx` lines 484-488
- 상세: 이미 저장된 모델 ID(`value` prop)가 로드된 목록에 없을 경우 해당 값을 `<option value={value}>` 로 렌더링한다. `value` 는 백엔드에서 조회한 저장값이므로 사용자 직접 입력은 아니지만, 백엔드 DB에 악의적 내용이 저장되어 있거나 API 응답이 탈취·조작된 경우 해당 문자열이 option value 및 표시 텍스트(`embeddingModelSavedFallback`)에 사용된다. React 는 JSX 속성과 콘텐츠를 자동 인코딩하므로 XSS 위험은 없다.
- 제안: INFO 등급. 추가 완화 조치는 불필요하나, 향후 option value 가 innerHTML 방식으로 직접 삽입되는 코드 변경 시 주의가 필요하다.

### **[INFO]** i18n 문자열 내 따옴표 이스케이프 — XSS 무관, 렌더링 확인 권장
- 위치: `codebase/frontend/src/lib/i18n/dict/en/llmConfigs.ts`, `knowledgeBases.ts`, `ko/llmConfigs.ts`, `ko/knowledgeBases.ts`
- 상세: `"Click \"Load models\" to pick..."` 처럼 JS 문자열 내 이스케이프된 따옴표를 포함한 i18n 값이 추가되었다. React JSX 렌더링에서는 안전하게 처리되며 XSS 위험은 없다. 단, i18n 라이브러리가 이 값을 `dangerouslySetInnerHTML` 로 주입하는 방식을 사용한다면 재검토가 필요하다.
- 제안: 프로젝트의 `useT()` / i18n 구현이 `dangerouslySetInnerHTML` 를 사용하지 않는지 확인. 일반적인 텍스트 보간 방식이라면 문제없다.

---

## 요약

이번 변경은 프론트엔드 UI 컴포넌트를 자유 입력 방식에서 select-only 방식으로 전환한 것으로, 전반적으로 보안 관점에서 양호하다. 새로운 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 우회 경로, 안전하지 않은 암호화 알고리즘, 경로 탐색 등 OWASP Top 10 주요 위협은 발견되지 않았다. 가장 주목할 점은 Axios 에러 응답의 `message` 필드가 i18n 폴백 없이 그대로 UI 에 노출되는 패턴으로, 신뢰할 수 없는 upstream provider 가 내부 정보가 담긴 에러 메시지를 반환할 경우 정보 노출로 이어질 수 있다. React 의 자동 HTML 인코딩 덕분에 XSS 경로는 차단되어 있으나, 에러 메시지 노출 범위를 제한하는 방어적 처리를 권장한다.

---

## 위험도

LOW
