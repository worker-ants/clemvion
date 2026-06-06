### 발견사항

- **[INFO]** 모델 ID 기반 정규식 패턴 매칭 — ReDoS 잠재성 검토
  - 위치: `codebase/backend/src/modules/llm/embedding-input-type.ts` — `E5_PREFIX_PATTERN`, `/instruct/i`
  - 상세: `E5_PREFIX_PATTERN = /(?:^|[/_-])(?:multilingual-e5|e5-(?:small|base|large))/i` 는 구조가 단순하고 역추적(backtracking) 증폭 경로가 없어 ReDoS 위험 없음. `embedding-model-recommendation.ts`의 `KOREAN_RECOMMENDED_PATTERNS` 배열도 동일하게 단순 패턴. 외부 입력이 `model` 파라미터로 주입되는 경로는 있으나 패턴 구조상 worst-case 복잡도는 O(n). 현 코드에서는 위험하지 않으나, 향후 패턴 추가 시 교차 반복 패턴(catastrophic backtracking) 주의 필요.
  - 제안: 현재 패턴 유지. 향후 패턴 확장 시 `(?:a|ab)*` 형태의 교차 대안 피할 것.

- **[INFO]** 사용자 제어 가능 `model` 문자열이 텍스트 접두사 생성에 영향
  - 위치: `codebase/backend/src/modules/llm/embedding-input-type.ts` — `applyEmbeddingInputPrefix()`, `resolveEmbeddingInputStrategy()`
  - 상세: `model` 파라미터는 API 요청에서 유입된 사용자 입력일 수 있다. 이 값이 `e5-prefix` 전략을 트리거하면 `texts` 배열의 모든 원소 앞에 `"query: "` 또는 `"passage: "` 리터럴 문자열이 붙는다. 이는 LLM provider 로 전달되는 임베딩 입력을 변형하는 부작용이다. 그러나 이 로직은 의도된 설계(asymmetric retrieval)이며, 접두사 내용은 하드코딩 상수(`E5_PREFIX`)이고 사용자 입력이 접두사 내용 자체를 제어하지는 않는다. 따라서 인젝션 위험은 없음.
  - 제안: 이슈 없음. 확인 완료.

- **[INFO]** `inputType` 파라미터의 TypeScript 타입 안전성
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `embed()` 시그니처
  - 상세: `inputType: EmbedInputType = 'document'` 는 TypeScript의 `'query' | 'document'` 유니온 타입으로 컴파일 타임에 제한된다. 런타임에서 외부에서 임의 문자열이 주입될 경우 `E5_PREFIX[inputType]` 인덱스 접근이 `undefined` 를 반환할 수 있으나, 이 함수는 백엔드 내부 서비스 계층에서만 호출되며 HTTP 요청에서 직접 역직렬화되지 않는다. HTTP DTO 계층에서 별도로 검증되는 구조라면 런타임 위험도 낮음.
  - 제안: `applyEmbeddingInputPrefix` 내에서 `E5_PREFIX[inputType]`가 `undefined` 일 경우 fallback 처리(예: prefix 없이 원문 반환)를 명시적으로 추가하면 방어적 코딩 관점에서 더 안전하다.

- **[INFO]** 프론트엔드 i18n 문자열이 UI에 직접 렌더링
  - 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` — `renderOption` 콜백
  - 상세: `renderOption`이 반환하는 문자열(`base`, `koreanRecommendedBadge`)은 `<option>` 텍스트 콘텐츠로만 렌더링된다. `<select>/<option>` 요소는 브라우저가 텍스트 콘텐츠를 자동으로 HTML 인코딩하므로 XSS 벡터가 아님. `m.name`, `m.id`는 서버 API 응답에서 오지만 `<option>` 텍스트에서는 HTML 삽입이 불가하다.
  - 제안: 이슈 없음.

### 요약

이번 변경은 임베딩 비대칭 입력(`inputType`: `query` / `document`) 지원을 위한 내부 서비스 계층 확장이다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증·인가 변경, 암호화 알고리즘, 민감 정보 노출, 외부 의존성 추가 등의 보안 관련 변경 사항은 없다. 신규 외부 입력 경로가 추가되지 않았으며, 모든 `inputType` 처리는 컴파일 타임 타입 안전 계층 내에서 수행된다. `embedding-input-type.ts`의 정규식 패턴은 구조적으로 안전하고 ReDoS 위험이 없으며, 프론트엔드 `renderOption`은 `<option>` 텍스트 컨텍스트에서 XSS 벡터가 아니다. 발견된 INFO 항목 모두 즉각적 위험이 없는 방어적 코딩 개선 제안 수준이다.

### 위험도
NONE
