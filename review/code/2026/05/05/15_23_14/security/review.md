## 발견사항

- **[WARNING]** `buildCategoryPortIds`에서 `id` 재검증 부재 (defense-in-depth 누락)
  - 위치: `text-classifier.handler.ts`, `buildCategoryPortIds` 함수
  - 상세: `id`의 포맷 제약(`/^[a-zA-Z0-9_-]+$/`, max 64)은 Zod 스키마에만 존재. 핸들러 내부의 `Category` 인터페이스는 `id?: string`으로 임의 문자열을 수용하므로, 스키마 검증을 거치지 않고 핸들러가 직접 호출되거나 테스트/내부 경로를 통해 호출될 경우 임의 문자열이 port ID로 사용될 수 있음. 반환된 `port` 값이 워크플로우 엔진에서 라우팅 키 이외의 용도(HTML 렌더링, DB 저장 등)로 활용된다면 영향도가 높아짐.
  - 제안: `buildCategoryPortIds`에 인라인 포맷 검증 추가:
    ```typescript
    const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
    typeof c.id === 'string' && SAFE_ID_RE.test(c.id) ? c.id : `class_${i}`
    ```
    현재 `trim()` 기반 공백 처리와도 자연스럽게 통합됨.

- **[WARNING]** `resolve-dynamic-ports.ts`의 타입 캐스팅으로 인한 검증 우회 가능성
  - 위치: `resolve-dynamic-ports.ts:84`, `classifierCategoriesPorts`
  - 상세: `(config.categories as CategoryEntry[] | undefined)` 캐스팅은 TypeScript 타입 안전성을 우회함. 이 함수는 `config: Record<string, unknown>`을 받으므로, Zod 스키마를 경유하지 않은 raw config가 전달될 경우 `c.id`에 임의 문자열이 들어와도 `trim().length > 0` 체크만 통과하면 port ID로 사용됨. `switchPorts`와 동일한 패턴이며 기존 리스크가 이번 변경으로 확장된 것.
  - 제안: 위 `SAFE_ID_RE` 동일 패턴을 `classifierCategoriesPorts` 내부에도 적용하여 레이어를 통일.

- **[INFO]** `config.passthrough()`로 인한 미검증 필드 전파
  - 위치: `text-classifier.schema.ts`, `textClassifierNodeConfigSchema`
  - 상세: `.passthrough()`는 스키마에 정의되지 않은 필드를 검증 없이 통과시킴. 악의적 클라이언트가 예상치 못한 필드를 주입할 수 있으나, 핸들러가 명시적으로 필드를 꺼내 쓰는 구조이므로 직접적 영향은 제한적.
  - 제안: `.passthrough()` 사용 사유를 주석으로 명확히 기록. 불필요하다면 `.strict()`로 변경 고려.

- **[INFO]** LLM 에러 응답에 `originalInput` 포함
  - 위치: `text-classifier.handler.ts`, `truncateForErrorDetails` 사용 부분
  - 상세: 에러 경로에 `inputField` (사용자 입력)가 500자로 잘려 `output.error.details.originalInput`에 노출됨. `truncateForErrorDetails`로 크기 제한은 되어 있으나, 로그나 외부 모니터링에서 PII가 노출될 수 있는 구조. (기존 코드 패턴이며 이번 diff의 신규 추가는 아님.)
  - 제안: 에러 세부정보에 원문 입력을 포함할 필요성 여부를 재검토.

---

## 요약

이번 변경의 핵심 보안 구조는 Zod 스키마의 `id` 필드 regex 제약(`/^[a-zA-Z0-9_-]+$/`, max 64)으로, 포트 라우팅 키로 사용되는 사용자 입력을 경계에서 차단하는 올바른 접근이다. 테스트 코드도 공백-only ID, 특수문자 등 경계 사례를 명시적으로 검증하고 있어 스키마 수준의 보호는 충분하다. 다만 `buildCategoryPortIds`(핸들러)와 `classifierCategoriesPorts`(resolver) 두 곳 모두 `config: Record<string, unknown>`을 raw하게 받으면서 내부에서 포맷 재검증 없이 `id`를 그대로 사용하는 것이 방어 심층성 관점의 주요 취약점이다. 스키마 검증이 항상 먼저 실행된다는 보장이 코드 구조상 강제되지 않으므로, port ID 생성 지점 자체에 동일한 포맷 검증을 복제하는 것이 권장된다.

---

## 위험도

**LOW**