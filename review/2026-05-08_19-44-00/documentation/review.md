## 발견사항

### 파일: `execution-engine.service.ts`

- **[WARNING]** `// engine-config-bug —` 접두사 인라인 주석 패턴이 프로젝트 CLAUDE.md 지침 위반
  - 위치: 변경된 `setEngineResolvedConfig` 호출부, `runParallel` 진입부, `runContainerInner` 진입부 등
  - 상세: CLAUDE.md는 "Don't reference the current task, fix, or callers — those belong in the PR description and rot as the codebase evolves"라고 명시한다. `engine-config-bug` 태그는 현재는 의미 있지만 시간이 지나면 노이즈가 된다. 설명 내용(왜 두 config 뷰가 분리되어 있는가)은 보존 가치가 있으나, 버그 식별자 접두사는 불필요하다.
  - 제안: `// engine-config-bug —` 접두사를 제거하고 설명 본문만 남긴다. 예: `// Two config views are needed: echoConfig preserves raw {{ }} per CONVENTIONS Principle 7; engineResolvedConfig drives container parameters.`

---

### 파일: `utils/coerce-container-param.ts`

- **[INFO]** `UNRESOLVED_EXPRESSION_PATTERN = /\{\{.*\}\}/` 의 greedy `.*` 동작이 문서화되지 않음
  - 위치: 파일 상단 12번째 줄
  - 상세: `{{a}} text {{b}}` 같은 입력에서 greedy 매칭은 전체를 하나의 미평가 표현식으로 인식한다. 이는 의도된 동작이지만(어느 위치든 `{{ }}`가 포함되면 미평가로 간주), non-greedy `.*?` 와의 차이에 대한 설명이 없어 독자가 의도를 오해하거나 "버그 수정"을 시도할 수 있다.
  - 제안: 짧은 주석 추가. 예: `// greedy — any string containing {{ }} anywhere is rejected as unresolved`

- **[INFO]** `ContainerErrorPolicy` 타입이 코드베이스 내 `ErrorPolicyConfig` 등 관련 타입과의 관계를 문서화하지 않음
  - 위치: `coerce-container-param.ts:79`
  - 상세: `error-policy.handler` 쪽에 `ErrorPolicyConfig` 혹은 동일 개념의 타입이 별도로 존재할 경우, 중복 선언인지 의도적 분리인지 명확하지 않다.
  - 제안: JSDoc에 관련 타입 참조 추가 또는 기존 타입 재사용 여부 명시

- **[INFO]** `coerceContainerNumberOptional` JSDoc이 `null` 처리를 누락
  - 위치: `coerce-container-param.ts:65`
  - 상세: JSDoc은 "returns `undefined` when the value is missing"이라고만 기술하나, 구현은 `null`도 `undefined` 반환으로 처리한다. "missing (undefined or null)"으로 수정하면 더 정확하다.
  - 제안: `/** Same as {@link coerceContainerNumber} but returns \`undefined\` when the value is undefined or null. */`

---

### 파일: `node-handler.interface.ts`

- **[INFO]** `engineResolvedConfigCache` JSDoc의 "NOT exposed to expression context" 불변 조건이 어디서 강제되는지 명시하지 않음
  - 위치: 인터페이스 필드 JSDoc
  - 상세: 이 불변 조건은 중요하나, `expression-resolver.service.ts`의 `buildExpressionContext` 쪽에서 구체적으로 어떻게 배제되는지 독자가 직접 추적해야 한다. 추후 유지보수 시 실수로 노출될 위험이 있다.
  - 제안: JSDoc에 `@see ExpressionResolverService.buildExpressionContext` 또는 "enforced by buildExpressionContext — do not add this cache to $node builder" 한 줄 추가

---

### 파일: `spec/5-system/4-execution-engine.md`

- **[INFO]** `engineResolvedConfigCache` 테이블 셀이 너무 밀도가 높음
  - 위치: §6.1 컨텍스트 구조 표 신규 행
  - 상세: 다른 행(예: `rawConfig`, `nodeExecutionId`)보다 3~4배 긴 셀 내용이 단일 테이블 행에 압축되어 있다. 핵심 요약 + 별도 서브섹션으로 분리하면 가독성이 높아진다.
  - 제안: 셀은 "핸들러 종료 후 컨테이너 동작 파라미터 읽기용. expression 컨텍스트에 비노출 (Principle 7 보존)"로 축약하고, 상세 설명은 §6.1 하위에 `#### 6.1.x engineResolvedConfigCache` 소절로 분리

---

### 파일: `plan/in-progress/expression-config-bug.md`

- **[WARNING]** 구현 완료 상태임에도 `plan/in-progress/`에 잔류
  - 위치: `plan/in-progress/expression-config-bug.md` — "잔여 항목" 섹션
  - 상세: 문서 자체의 "잔여 항목" 절이 "`git mv plan/in-progress/expression-config-bug.md plan/complete/expression-config-bug.md` 로 이동"을 명시하고 있고, 구현 진행 표도 PR-1~4 모두 "완료"로 기록되어 있다. CLAUDE.md의 PLAN 문서 라이프사이클 규칙상 `in-progress/`에 잔류해서는 안 된다.
  - 제안: `git mv plan/in-progress/expression-config-bug.md plan/complete/expression-config-bug.md` 실행

---

## 요약

전반적으로 이번 변경의 문서화 품질은 높다. `coerce-container-param.ts`의 모듈·함수 JSDoc, `node-handler.interface.ts`의 인터페이스 필드 설명, 스펙 문서(`4-execution-engine.md`) 업데이트, 그리고 plan 문서의 상세한 진단·설계 내용은 모두 적절하다. 다만 `execution-engine.service.ts` 인라인 주석의 `engine-config-bug —` 접두사 패턴이 프로젝트 자체 문서 지침(`CLAUDE.md`)의 "현재 태스크·fix를 주석에 참조하지 말 것" 원칙과 충돌하며, plan 문서가 모든 항목 완료 후에도 `in-progress/`에 잔류한 점이 프로세스상 누락이다.

## 위험도

**LOW**