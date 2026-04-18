## 문서화 코드 리뷰 결과

### 발견사항

---

**[INFO] `INFO_EXTRACTOR_TYPE_MAP` 의 목적이 불명확함**
- 위치: `use-expression-context.ts:54-61`
- 상세: 이 맵은 `string → string` 이고 실질적으로 항등 함수입니다. 왜 `f.type` 을 직접 사용하지 않고 별도 맵을 두는지 이유가 없습니다. 타입 허용 목록 역할인지, 타입 이름 정규화용인지 알 수 없습니다.
- 제안: `// Only allow field types that JSON Schema recognizes; unknown types default to "string"` 같은 한 줄 주석으로 의도를 명시하세요.

---

**[WARNING] 텍스트 분류기와 정보 추출기의 출력 스키마 형태가 다른데 이유가 없음**
- 위치: `text-classifier.schema.ts:75-77` vs `information-extractor.schema.ts:124-130`
- 상세: 정보 추출기의 JSDoc은 "handler adapter unwraps → `{ config, output, meta }` 형태가 남는다"고 명시하나, 텍스트 분류기의 JSDoc은 "after adapter unwraps → `category/categories/confidence` 플랫 형태"라고 설명합니다. 동일 범주(AI 노드)인데 출력 중첩 깊이가 다른 이유가 설명되지 않아 미래 개발자가 혼동할 수 있습니다.
- 제안: 각 스키마 JSDoc에 핸들러가 반환하는 실제 구조의 차이(중첩 vs. 플랫)를 명시적으로 기술하거나, AI 에이전트의 스키마 주석처럼 형태를 통일하세요.

---

**[WARNING] `isExpandable` 주석이 외부 핸들러를 참조하나 위치를 특정하지 않음**
- 위치: `use-expression-suggestions.ts:207`
- 상세: `// handleSelect auto-appends "." so the next keystroke opens the accessor hint` 라는 주석이 `handleSelect` 를 언급하지만, 이 함수가 어느 컴포넌트에 있는지 참조가 없습니다.
- 제안: `// caller (ExpressionInput#handleSelect) auto-appends "."...` 처럼 컴포넌트명을 포함하거나, 파일 경로를 명시하세요.

---

**[WARNING] `getExpressionToken` 의 이스케이프 처리 엣지 케이스가 미문서화**
- 위치: `use-expression-suggestions.ts:57-59`
- 상세: `between[k - 1] !== "\\"` 에서 `k=0`일 때 `between[-1]`은 `undefined`이고, `undefined !== "\\"` 는 `true`이므로 첫 번째 문자의 따옴표는 항상 이스케이프되지 않은 것으로 처리됩니다. 이 동작은 올바르지만, 미래 독자가 버그로 오해할 수 있습니다.
- 제안: `// k=0 → between[-1] is undefined, correctly treated as unescaped` 인라인 주석을 추가하세요.

---

**[INFO] `resolveSchemaNode` 에 `@param` / `@returns` 태그 없음**
- 위치: `resolve-nested-path.ts:162-170`
- 상세: `dotPath` 인자가 비어 있을 때 스키마 자체를 반환한다는 동작이 JSDoc 본문에만 있고, `@returns` 로 명시되지 않았습니다.
- 제안: `@returns {JsonSchemaNode | null} — the schema node at path, or null if unresolvable` 추가.

---

**[INFO] `expression-resolver.service.ts` 에 대한 크로스파일 참조가 있음**
- 위치: `expression-constants.ts:28`
- 상세: `* Matches the shape built in expression-resolver.service.ts` — 해당 파일이 리팩터링되거나 이동될 경우 이 주석이 잘못된 경로를 가리키게 됩니다.
- 제안: 파일 경로 대신 개념("runtime node context built by the expression resolver")을 기술하거나, 경로를 `backend/src/.../expression-resolver.service.ts` 형식으로 명확히 표기하세요.

---

**[INFO] `dropStaleEdges` 의 `wildcard` Set 동작이 코드에서 불일치함**
- 위치: `edge-utils.ts:108-113`
- 상세: `validOutputs` 에서 미지의 노드 타입은 빈 `Set`을 반환하고, 필터 로직은 `sourceOutputs.size > 0` 을 확인해 빈 Set을 "permissive"로 해석합니다. 이 패턴은 영리하지만, 이름이 `wildcard`인 빈 Set은 직관에 반합니다. 주석은 존재하나 필터 로직의 `size > 0` 조건과 연결짓는 설명이 없습니다.
- 제안: `// Empty set = wildcard; filter below skips validation when size === 0` 를 필터 로직 직전에 추가하세요.

---

**[INFO] 새 공개 API(`dropStaleEdges`, `getSchemaKeys`, `NODE_ACCESSORS`)에 대한 상위 문서 없음**
- 상세: 이번 PR은 노드 변수 자동완성에 정적 스키마 지원을 추가하는 중요한 기능이지만, `spec/` 또는 `prd/` 문서 업데이트가 없습니다. 또한 frontend의 `/docs` 사용자 설명서도 갱신 여부가 확인되지 않습니다.
- 제안: CLAUDE.md 가이드라인에 따라 `spec/` 문서와 `/docs` 사용자 설명서를 갱신하세요.

---

### 요약

전반적인 문서화 품질은 양호합니다. 신규 공개 함수(`dropStaleEdges`, `getSchemaKeys`, `enrichInfoExtractorOutputSchema`)에 JSDoc이 있고, `ai-agent.schema.ts`의 "Superset" 설계 의도 설명, `edge-utils.ts`의 permissive wildcard 패턴 설명 등 핵심 비직관적 동작에 대한 인라인 주석이 충실합니다. 다만 `INFO_EXTRACTOR_TYPE_MAP`의 목적 불명확, 텍스트 분류기와 정보 추출기의 출력 형태 비대칭에 대한 설명 부재, `spec/` 문서 미갱신이 보완이 필요한 부분입니다.

### 위험도
**LOW**