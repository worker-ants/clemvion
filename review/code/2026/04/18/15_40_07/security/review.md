## 발견사항

### **[WARNING]** Zod `.passthrough()` 과도한 사용
- **위치**: `ai-agent.schema.ts:291`, `information-extractor.schema.ts:125`, `text-classifier.schema.ts:82` (출력 스키마 전반)
- **상세**: `aiAgentNodeOutputSchema`, `informationExtractorNodeOutputSchema` 등 모든 출력 스키마에 `.passthrough()`가 적용되어 있음. 명시되지 않은 임의의 필드가 검증 없이 통과함. 스키마 목적이 "자동완성 힌트"임은 주석에 명시되어 있으나, 동일 스키마가 데이터 파이프라인의 실행 컨텍스트에서도 재사용될 경우 악의적인 추가 필드(예: `__proto__`, `constructor` 등의 민감 키)가 하위 로직으로 전파될 수 있음.
- **제안**: 실행 컨텍스트와 자동완성 힌트 컨텍스트의 스키마를 명시적으로 분리하거나, 런타임 유효성 검사 경로에서는 `.strip()` 사용 검토.

---

### **[WARNING]** 사용자 정의 필드명이 스키마 키로 직접 삽입됨 (잠재적 오브젝트 인젝션)
- **위치**: `use-expression-context.ts:74–88` (`enrichInfoExtractorOutputSchema`)
- **상세**: `config.outputSchema`의 `f.name` 값(사용자가 직접 입력)을 `userProps[f.name]`으로 객체 키에 할당한 뒤 `{ ...existingProps, ...userProps }`로 스프레드. 스프레드 연산은 `[[DefineOwnProperty]]`를 사용하므로 `__proto__` 기반 프로토타입 오염은 방지됨. 그러나 `Object.assign` 경로로 소비될 경우 또는 `f.name === "constructor"` 등의 키가 하위 JSON 직렬화나 동적 접근 로직에서 의도치 않은 동작을 유발할 수 있음.
- **제안**: `f.name`에 대해 `if (['__proto__', 'constructor', 'prototype'].includes(f.name)) continue;` 형태의 명시적 차단 또는 식별자 정규식 검증(`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) 추가.

---

### **[WARNING]** 표현식 토큰 파서의 경계 조건
- **위치**: `use-expression-suggestions.ts:60` — `between[k - 1] !== "\\"`
- **상세**: `k === 0`일 때 `between[-1]`은 `undefined`이며, `undefined !== "\\"` → `true`이므로 첫 번째 문자가 `"`인 경우 탈출 여부 판별이 올바르지 않음. 표현식 자동완성 파서에서 문자열 경계 감지가 오염되면 `$node["..."]` 키 파싱이 잘못 처리될 수 있음.
- **제안**: `k > 0 && between[k - 1] !== "\\"` 조건으로 수정.

---

### **[INFO]** 내부 워크플로우 구조 콘솔 노출
- **위치**: `editor-loader.tsx:68–71`
- **상세**: `console.warn`으로 삭제된 stale 엣지 수를 출력. 브라우저 개발자 도구에서 워크플로우 내부 구조 변경 이력 추적이 가능. 직접적 취약점은 아니나 정보 노출(OWASP A09).
- **제안**: 프로덕션 빌드에서 `console.warn` 제거 또는 로깅 레벨 제어 적용.

---

### **[INFO]** 엣지 유효성 검사의 의도적 우회 로직
- **위치**: `edge-utils.ts:129–133`
- **상세**: 미지의 노드 타입에 대해 `wildcard = new Set<string>()`(크기 0)을 반환하고, `sourceOutputs.size > 0` 조건으로 검증을 건너뜀. 이는 의도적인 permissive fallback이나, 악의적으로 조작된 워크플로우 데이터에 알 수 없는 타입의 노드가 포함될 경우 스테일 엣지 필터링이 완전히 무력화됨.
- **제안**: 현재 로직은 개발 편의상 허용 가능. 단, `nodeDefinitions` 로딩 완료 여부(`status === 'ready'`)를 확인한 후에만 `dropStaleEdges`를 호출하도록 `editor-loader.tsx`에서 방어 조건 추가 권장.

---

## 요약

이번 변경은 자동완성 힌트 제공을 위한 정적 출력 스키마 추가와 스테일 엣지 정리 기능이 중심으로, 직접적인 인증/인가 취약점이나 하드코딩된 시크릿은 발견되지 않음. 주요 보안 관심사는 사용자 정의 필드명이 객체 키에 직접 삽입되는 부분(프로토타입 오염 경계)과, `.passthrough()` 스키마가 실행 경로로 재사용될 경우의 미검증 필드 전파 가능성임. 표현식 토큰 파서의 경계 조건 버그는 자동완성 파싱 오류를 유발할 수 있으며 수정이 필요함.

## 위험도

**LOW**