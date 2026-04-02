### 발견사항

- **[INFO]** `expression-resolver.service.ts` — `resolveString` 메서드의 혼합 텍스트 분기 주석이 코드와 불일치
  - 위치: `expression-resolver.service.ts:120-125`
  - 상세: `// Mixed text + expression: always string` 주석 아래에서 실제로는 `evaluate()`의 반환값을 그대로 리턴하고 있음. 혼합 텍스트의 경우 `evaluate()`가 이미 string으로 변환해 반환하지만, 두 분기가 동일한 `return result`를 실행하므로 `FULL_EXPRESSION_PATTERN` 분기가 사실상 무의미한 주석 역할만 함. 주석이 실제 동작을 오해하게 만들 수 있음.
  - 제안: `FULL_EXPRESSION_PATTERN` 분기에서 실제로 타입을 유지하는 처리가 없다면, 두 분기를 합치거나 주석을 "evaluate() handles both cases" 식으로 수정

- **[INFO]** `@workflow/expression-engine` 패키지에 README가 없음
  - 위치: `packages/expression-engine/` (신규 패키지)
  - 상세: 모노레포 내 신규 공유 패키지임에도 불구하고 패키지 자체의 README나 사용 가이드가 없음. `backend`와 `frontend` 모두 이 패키지를 의존하므로, `evaluate`, `validate`, `getAllFunctionNames`, `ExpressionContext` 타입의 공개 API 문서가 필요함.
  - 제안: `packages/expression-engine/README.md`에 설치 방법, 공개 API 목록, 기본 사용 예제 추가

- **[INFO]** `expression-exclusions.ts` 파일 수준 주석은 충분하나, `EXPRESSION_EXCLUSIONS` 객체에 새 핸들러 추가 시 어디서 참조해야 하는지 안내 없음
  - 위치: `expression-exclusions.ts:1-10`
  - 상세: `pdf` 핸들러 등 향후 제외 대상이 추가될 수 있으나 확장 방법에 대한 힌트가 없음
  - 제안: 주석에 "핸들러 추가 시 이 파일에 등록" 한 줄 안내 추가

- **[INFO]** `use-expression-context.ts` — JSDoc 주석에 반환 타입 설명 없음
  - 위치: `use-expression-context.ts:47`
  - 상세: `useExpressionContext` 함수에 "Must be called within a component..." 주석은 있으나 `ExpressionData` 각 필드의 의미나 사용 맥락이 없음. 인터페이스 필드에 JSDoc이 있으므로 일관성은 있으나, hook 주석이 인터페이스 주석과 분리되어 있어 찾기 불편함.
  - 제안: 현재 수준으로 충분하며 필수 수정 아님

- **[INFO]** `spec/5-system/4-execution-engine.md` — 섹션 번호 중복
  - 위치: `4-execution-engine.md`, 기존 `5.4 노드 유형별 리트라이 정책` 앞에 새 `5.4 Worker 실행 흐름` 추가
  - 상세: diff를 보면 기존 `5.4 노드 유형별 리트라이 정책`이 있는데, 새로 추가된 섹션도 `5.4`로 명명되어 있음. 이 경우 기존 `5.4`가 `5.5`로 밀려야 하나 문서상 명시적 재번호 매김 흔적이 없음.
  - 제안: 기존 `5.4 노드 유형별 리트라이 정책` 이후 섹션 번호를 일괄 갱신 확인 필요

- **[INFO]** `ExpressionAutocomplete` — 컴포넌트 수준 JSDoc 없음
  - 위치: `expression-autocomplete.tsx:29`
  - 상세: props 인터페이스는 잘 정의되어 있으나 컴포넌트 자체에 대한 설명 주석이 없음. 다른 컴포넌트(`expression-highlight.tsx`)는 파일 상단에 목적 주석이 있어 불일치.
  - 제안: `ExpressionHighlight`처럼 컴포넌트 상단에 1-2줄 목적 주석 추가

---

### 요약

전반적으로 문서화 품질은 양호하다. 스펙 문서(`4-execution-engine.md`, `5-expression-language.md`)가 구현 변경사항을 잘 반영하고 있으며, 핵심 서비스 메서드에 JSDoc이 작성되어 있고 복잡한 로직(exclusion 규칙, context 구성)에 인라인 주석이 적절히 배치되어 있다. 주요 문서화 결함은 신규 공유 패키지 `@workflow/expression-engine`의 README 부재와 `expression-resolver.service.ts`의 `resolveString` 주석-코드 불일치이며, 스펙 문서의 섹션 번호 중복도 확인이 필요하다.

### 위험도

**LOW**