### 발견사항

---

**[WARNING] loop.handler.ts — 순수 함수 `void` 호출 (dead computation)**
- 위치: `loop.handler.ts`, execute() 내 신규 추가 코드
- 상세:
  ```ts
  void parseNumeric(count);
  void (maxIterations !== undefined ? parseNumeric(maxIterations) : null);
  ```
  `parseNumeric`은 순수 함수(side-effect 없음)다. `void`로 반환값을 버리면 아무 관찰 가능한 결과가 없다. 그런데 이 함수는 내부에서 정규식 `/\{\{.*\}\}/.test(trimmed)`를 실행한다. 루프 노드가 실행될 때마다 정규식 매칭이 포함된 계산을 수행하고 결과를 버리는 것. 코드 주석("for its side-effect of validating the resolved values")은 사실과 다르다 — `validate()`는 별도 흐름으로 이미 담당하고 있고, `execute()`에서 중복 검증할 이유가 없다.
- 제안: 두 `void parseNumeric(...)` 호출 전체를 제거. 검증이 정말 필요하다면 `validate()`에 위임.

---

**[INFO] background.handler.ts, form.handler.ts — 불필요한 객체 스프레드**
- 위치:
  - `background.handler.ts`: `config: { ...rawConfig }`
  - `form.handler.ts`: `config: { ...rawConfig }`
- 상세: 이전 코드는 `config: config`로 참조를 직접 반환했다. 변경 후 `{ ...rawConfig }`로 얕은 복사를 수행한다. `rawConfig`가 `context.rawConfig`이고 코드 주석에서 "frozen" 스냅샷이라고 명시하고 있으므로, 방어적 복사의 근거가 없다. 노드 하나당 별도 객체 할당이 추가된다.
- 제안: `config: rawConfig`로 직접 반환. `rawConfig`가 변조될 경로가 실제로 존재하면 이유를 주석에 명시.

---

**[INFO] text-classifier.handler.ts — 조건부 스프레드에서 빈 객체 임시 생성**
- 위치: `text-classifier.handler.ts`, `configEcho` 생성 블록
- 상세:
  ```ts
  ...(rawConfig.llmConfigId !== undefined ? { llmConfigId: rawConfig.llmConfigId } : {}),
  ...(rawConfig.model !== undefined ? { model: rawConfig.model } : {}),
  ...(rawConfig.instructions !== undefined ? { instructions: rawConfig.instructions } : {}),
  ```
  각 false branch가 `{}`를 할당 후 즉시 버린다. 세 번의 임시 객체 생성. 분류 작업 자체는 LLM I/O 지배적이라 임팩트는 극소하지만, 코드 명확성과 일관성 측면에서 개선 여지가 있다.
- 제안:
  ```ts
  const configEcho: Record<string, unknown> = { categories: ..., inputField: ..., multiLabel: ... };
  if (rawConfig.llmConfigId !== undefined) configEcho.llmConfigId = rawConfig.llmConfigId;
  if (rawConfig.model !== undefined) configEcho.model = rawConfig.model;
  if (rawConfig.instructions !== undefined) configEcho.instructions = rawConfig.instructions;
  ```

---

**[INFO] ai-agent.handler.ts — 조건 분기 객체 생성 (3곳)**
- 위치: `executeSingleTurn` return (~L734), `executeMultiTurnWaiting` return (~L852), 재개 경로 return (~L1175)
- 상세: 중첩 삼항 연산자가 `{ conditions: rawConfig.conditions }` 또는 `{}` 를 생성하는 패턴이 세 군데 반복된다. LLM 호출 비용과 비교하면 무시 가능 수준이나, 로직이 동일한 패턴이 반복된다.
- 제안: 별도 헬퍼 함수 `buildConditionsEcho(rawConfig, fallbackConditions)` 로 추출하면 테스트도 용이하고 중복 코드가 제거된다. 성능보다는 유지보수 개선이 주목적.

---

### 요약

이번 변경의 핵심인 "rawConfig echo" 패턴 자체는 성능 영향이 미미하다. 대부분의 핸들러에서 추가된 작업은 `context.rawConfig ?? config` nullish coalescing 한 번과 이미 존재하는 객체 필드 참조뿐이며, 실제 실행 비용(LLM 호출, DB 쿼리, HTML 렌더링)에 비해 무시 가능하다. 주목할 만한 문제는 `loop.handler.ts`의 `void parseNumeric()` 호출 — 정규식 실행을 포함한 순수 함수를 결과를 버리면서 호출하는 코드로, 아무 효과 없이 CPU를 소모하며 코드 주석도 사실과 다르다. `background.handler.ts`와 `form.handler.ts`의 `{ ...rawConfig }` 스프레드는 이전에 없던 불필요한 얕은 복사다.

### 위험도

**LOW**