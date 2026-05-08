### 발견사항

---

**[WARNING] 횡단 관심사(Cross-cutting Concern)가 추상화 없이 20+ 핸들러에 분산**
- 위치: 모든 핸들러 파일 (18개 handler.ts)
- 상세: `const rawConfig = context.rawConfig ?? config` 패턴이 각 핸들러에 반복 구현되어 있다. raw echo는 실행 엔진 레벨의 횡단 관심사로, 핸들러마다 직접 구현하면 신규 핸들러 작성 시 누락 위험이 생기고 정책 변경 시 20개 파일을 일괄 수정해야 한다.
- 제안: `NodeHandler` 기본 클래스에 `buildConfigEcho(rawConfig, evaluatedFields)` 헬퍼를 두거나, 엔진이 핸들러 반환 후 config echo를 자동으로 `rawConfig`로 교체하는 후처리 레이어를 도입한다.

---

**[WARNING] 구현 방식이 세 가지로 불일치 — 일관된 정책 부재**
- 위치: `background.handler.ts:38`, `form.handler.ts:37`, `foreach.handler.ts:51`, `loop.handler.ts:63`
- 상세: 같은 Principle 7을 따르는데 구현 방식이 세 종류다.
  1. 전체 spread: `config: { ...rawConfig }` (Background, Form)
  2. 선택적 echo + fallback: `config: { field: rawConfig.field ?? evaluated }` (대다수)
  3. 상태 소스: `state.rawConfig ?? {}` (ai-agent multi-turn resume)

  전체 spread 방식은 `rawConfig`에 존재하는 모든 키를 무차별 통과시키므로, 미래에 내부 전용 필드가 `rawConfig`에 포함될 경우 의도치 않게 노출된다.
- 제안: 전체 spread 방식을 선택적 echo로 통일하거나, spread 방식의 허용 범위를 CONVENTIONS 문서에 명시한다.

---

**[WARNING] `ParallelHandler.execute`의 `context` 파라미터를 optional로 변경 — LSP 위반 가능**
- 위치: `parallel.handler.ts:32` (`context?: ExecutionContext`)
- 상세: `NodeHandler` 인터페이스가 `execute(input, config, context: ExecutionContext)`를 필수로 정의한다면, 구현체에서 `context?`로 완화하는 것은 Liskov 치환 원칙 위반이다. 인터페이스 계약보다 느슨한 구현은 타입 시스템이 보호해야 할 null 접근을 허용한다. `rawConfig = context?.rawConfig ?? config`에서 `context`가 `undefined`면 항상 `config` 폴백으로 떨어져 Principle 7이 무력화된다.
- 제안: `NodeHandler` 인터페이스를 확인해 `context`를 optional로 바꾸거나, `parallel.handler.ts`에서 required로 되돌린다. 인터페이스와 구현을 일치시킨다.

---

**[WARNING] multi-turn resume의 `systemPrompt` — 폴백 없음**
- 위치: `ai-agent.handler.ts:863` (resume 경로 `waitingResult.config`)
- 상세: 첫 번째 turn의 echo는 `systemPrompt: rawConfig.systemPrompt ?? systemPrompt`로 evaluated 폴백이 있다. 그러나 resume turn의 echo는:
  ```ts
  systemPrompt: turnRawConfig.systemPrompt,  // 폴백 없음
  ```
  `state.rawConfig`가 설정되지 않았을 때 `turnRawConfig`는 `{}`이고 `systemPrompt`는 `undefined`가 된다. 이 비대칭은 두 경로 간 계약 불일치다.
- 제안: `systemPrompt: turnRawConfig.systemPrompt ?? systemPrompt`로 통일한다.

---

**[WARNING] `buildSubWorkflowError` 시그니처 타입 퇴보**
- 위치: `workflow.handler.ts:148-155`
- 상세: `configEcho: { workflowId: string; mode: 'sync' | 'async' }` → `configEcho: Record<string, unknown>`으로 변경됐다. 메서드 내부에서는 여전히 `configEcho.workflowId`, `configEcho.mode`를 사용하지만 타입 보장이 사라졌다. error details에 잘못된 타입의 값이 들어가도 컴파일 타임에 잡히지 않는다.
- 제안: `WorkflowConfigEcho` 인터페이스를 정의하고 해당 타입을 파라미터에 사용한다.

---

**[WARNING] `LoopHandler`의 `void parseNumeric()` — 주석 주장과 실제 동작 불일치**
- 위치: `loop.handler.ts:56-57`
- 상세: 주석은 "side-effect of validating the resolved values"라고 설명하지만, `parseNumeric`은 순수 함수로 반환값만 존재하고 부작용이 없다. `void`로 반환값을 버리므로 실질적인 검증도 일어나지 않는다. 이 코드는 읽는 사람에게 잘못된 확신을 준다. 실제 검증은 `validate()`에서 일어나며, `execute()`에서 재검증이 필요하다면 예외를 던지는 코드여야 한다.
- 제안: 두 `void` 호출을 제거하거나, 실제로 의도하는 동작(예: 런타임 타입 체크 후 로그)으로 교체한다.

---

**[INFO] `TableHandler`가 `columns`를 `output`에 추가 — Principle 7 범위 초과**
- 위치: `table.handler.ts:158` (`payload.columns = resolvedColumns`)
- 상세: 다른 핸들러는 config echo만 raw로 바꾸는 반면, `TableHandler`는 `output`에 `columns: resolvedColumns`를 추가로 노출한다. 이 변경은 Principle 7과 무관한 output shape 변경이다. downstream 노드가 `$input.columns`를 참조하는 기존 워크플로가 없다면 문제없지만, 변경 이유가 이 PR의 나머지와 섞여 있어 리뷰어가 인과를 추적하기 어렵다.
- 제안: output shape 변경은 별도 PR로 분리하거나, 변경 이유를 명시하는 주석을 추가한다.

---

**[INFO] `chart.handler.ts`의 `void chartType; void title;` — 불필요한 표현식**
- 위치: `chart.handler.ts:76-77`
- 상세: 변수를 "더 이상 안 쓴다"는 의도로 `void`를 쓰는 패턴은 TypeScript에서 관용적이지 않다. `void`는 함수 반환값을 버릴 때 사용하는 연산자다. 이 위치에서는 단순히 변수를 `rawConfig.chartType`으로 참조하면 되므로 `chartType`·`title` 로컬 변수 선언 자체를 제거하는 것이 의도를 더 명확히 한다.
- 제안: 두 로컬 변수 선언을 제거하고 `rawConfig.chartType`, `rawConfig.title`을 직접 사용한다.

---

### 요약

이번 변경은 CONVENTIONS Principle 7(config echo = raw user input)을 전 핸들러에 일괄 적용한 체계적인 리팩터링이다. 의도와 방향은 올바르나, raw echo라는 **횡단 관심사가 엔진/기반 클래스 레벨에서 추상화되지 않고** 20개 이상의 핸들러에 직접 분산 구현된 것이 핵심 아키텍처 약점이다. 여기에 세 가지 상이한 구현 방식, multi-turn resume 경로의 null 안전성 비대칭, `ParallelHandler`의 LSP 잠재 위반, `buildSubWorkflowError` 타입 퇴보 등 국소적 이슈가 중첩되어 향후 핸들러 추가·정책 변경 시 누락·불일치 위험이 존재한다.

### 위험도
**MEDIUM**