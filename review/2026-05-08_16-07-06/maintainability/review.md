## 발견사항

### [WARNING] `void parseNumeric()` — 부작용 없는 함수를 부작용 목적으로 호출
- **위치**: `loop.handler.ts` execute() 내 수정된 블록
- **상세**: `parseNumeric`은 순수 함수(값을 계산해 반환만 함)로 부작용이 없다. 주석이 "side-effect of validating"이라고 설명하지만 실제로 반환값도 무시되고 컨텍스트 변경도 없다. 이 두 줄은 사실상 dead code이며, 향후 `parseNumeric` 시그니처가 변경될 때 이 호출이 남아 있는 이유를 파악하기 어렵다.
- **제안**: 주석이 말하는 "검증"이 실제로 필요하다면 반환값을 확인하는 명시적 assertion을 쓰거나, 필요 없다면 두 줄 모두 제거.

---

### [WARNING] `conditions` 분기 삼중 삼항 중첩 — 두 곳에서 중복
- **위치**: `ai-agent.handler.ts` — 단일 턴 config 블록 (~L734-743), 멀티 턴 대기 블록 (~L852-876), resume 블록 (~L1175-1207)
- **상세**: 아래 구조가 세 곳에 거의 동일하게 반복된다:
  ```typescript
  ...(rawConfig.conditions !== undefined
    ? Array.isArray(rawConfig.conditions) &&
      (rawConfig.conditions as unknown[]).length > 0
      ? { conditions: rawConfig.conditions }
      : {}
    : conditions.length > 0
      ? { conditions }
      : {}),
  ```
  중첩 삼항 + 스프레드 조합은 순환 복잡도를 높이고, 세 곳에 흩어져 있어 정책 변경 시 하나만 놓치기 쉽다. `knowledgeBases` 블록도 같은 패턴으로 반복된다.
- **제안**: `pickIfNonEmpty(raw, evaluated)` 같은 로컬 헬퍼로 추출.
  ```typescript
  function pickIfNonEmpty<T>(raw: T[] | undefined, evaluated: T[]): Record<string, T[]> {
    const arr = raw ?? evaluated;
    return arr.length > 0 ? { conditions: arr } : {};
  }
  ```

---

### [WARNING] `context?` 선택적 매개변수 — 인터페이스 불일치
- **위치**: `parallel.handler.ts:29` `async execute(..., context?: ExecutionContext)`
- **상세**: 다른 모든 핸들러(foreach, map, split, switch 등)는 `context: ExecutionContext`를 필수로 받는다. `parallel`만 선택적으로 받으면서 내부에서 `context?.rawConfig`로 옵셔널 체이닝을 사용한다. `NodeHandler` 인터페이스가 `context`를 필수로 선언한다면 이 차이는 컴파일 오류를 숨기는 서브타이핑 우회가 된다. 인터페이스가 선택적으로 선언되어 있다면 다른 핸들러들이 불필요하게 강한 타입을 요구하는 것이다. 어느 쪽도 의도가 불분명하다.
- **제안**: 인터페이스 정의를 확인한 후 `parallel`도 다른 핸들러와 동일하게 `context: ExecutionContext` 필수로 변경.

---

### [WARNING] `void chartType; void title;` — 잔류 변수 억제
- **위치**: `chart.handler.ts` execute() 내 rawConfig 블록
- **상세**: `chartType`과 `title`은 `config`에서 추출해 이전 코드에서 사용됐다. 리팩토링 후 실제 사용처가 `rawConfig.chartType`, `rawConfig.title`로 바뀌었지만 기존 변수 선언을 제거하지 않고 `void`로 TS 경고만 억제했다. 이 패턴은 "왜 이 변수가 여기 있는가"에 대한 불필요한 의문을 유발한다.
- **제안**: `chartType`과 `title` 변수 선언 자체를 제거.

---

### [WARNING] `buildSubWorkflowError` 타입 광역화 — 에러 봉투 상세 필드 타입 소실
- **위치**: `workflow.handler.ts:145-165`
- **상세**: 이전 시그니처는 `{ workflowId: string; mode: 'sync' | 'async' }`로 에러 봉투의 `details.workflowId`와 `details.mode` 접근이 타입 안전했다. `Record<string, unknown>`으로 광역화되면서 `configEcho.workflowId`와 `configEcho.mode` 접근이 컴파일러 입장에서 `unknown` 타입이 된다. 에러 봉투 형태가 런타임에서 변질되어도 컴파일 타임에 잡히지 않는다.
- **제안**: 확장된 configEcho 타입을 명시적 인터페이스로 정의하거나, `buildSubWorkflowError`가 받는 타입을 `{ workflowId: unknown; mode: unknown; [key: string]: unknown }`처럼 최소 필드만 요구하도록 유지.

---

### [WARNING] `rawConfig` / `turnRawConfig` 이중 네이밍 — 같은 파일 내 일관성 깨짐
- **위치**: `ai-agent.handler.ts` — `executeSingleTurn` 내 `rawConfig`, `processMultiTurnMessageInner` 내 `turnRawConfig`
- **상세**: 개념적으로 동일한 패턴(`context.rawConfig ?? config` 또는 `state.rawConfig`)을 서로 다른 이름으로 부른다. 리뷰어나 미래 개발자가 두 변수가 "같은 역할을 하는가, 다른 역할을 하는가"를 확인해야 한다.
- **제안**: 파일 내에서 하나의 이름으로 통일. 단, state에서 오는 경우 출처를 이름에 반영하는 것도 합리적이므로 — 대신 주석으로 차이를 명확히 기술.

---

### [INFO] 동일한 `rawConfig` 패턴 20개 파일에 산재 — 반복 증가
- **위치**: 전체 핸들러 파일 공통
- **상세**: `const rawConfig = context.rawConfig ?? config` (+ 필요시 타입 캐스트)가 20개 이상 핸들러에 동일하게 반복된다. 현재는 한 줄이라 복사-붙여넣기 비용이 낮지만, 추후 `rawConfig` 조회 방식이 바뀌면(예: 깊은 복사 필요, 검증 추가) 모든 파일을 수정해야 한다. `NodeHandler` 기반 클래스나 `ExecutionContext`의 헬퍼 메서드로 한 곳에 모아두면 정책 변경이 단일 지점으로 수렴된다.
- **제안**: 단기적으로는 현 상태 유지 가능. 중기적으로 `ExecutionContext`에 `getRawConfig(): Record<string, unknown>` 메서드 추가 검토.

---

### [INFO] `rawConfig.field` fallback 적용 기준이 핸들러마다 다름
- **위치**: 전체 핸들러 비교
- **상세**: 일부 핸들러는 `rawConfig.field ?? evaluatedField` 패턴(fallback 있음), 일부는 `rawConfig.field` 단독(fallback 없음)을 사용한다. 예: `filter.handler.ts`에서 `combineMode`는 `?? 'and'` fallback이 있지만 `inputField`와 `conditions`는 없다. `rawConfig`가 없거나 해당 필드가 없는 경우 `undefined`가 config에 출력된다. 이것이 의도인지, 누락인지 기준이 문서화되지 않았다.
- **제안**: 어떤 필드가 `rawConfig`에 항상 존재함이 보장되는지 주석이나 타입 수준에서 명시.

---

### [INFO] 계획 문서 내 이미 완료된 plan을 `plan/complete/`에 두면서 미완 항목 포함
- **위치**: `plan/complete/ai-agent-tool-connection-rewrite.md`
- **상세**: 파일 상단에 DEPRECATED 박스가 있고 "남은 작업" 섹션에 미체크 작업 항목들이 있다. `plan/complete/`는 CLAUDE.md 규약상 "모든 작업이 처리 완료된 경우만"이 기준인데, 이 문서는 미완 항목을 가지고 있다. 다만 DEPRECATED 선언으로 "이 plan 트랙을 포기"하는 맥락이라면, complete가 아닌 별도 archived 상태가 더 명확하다. (코드 품질 이슈는 아니나 plan 관리 규약과 충돌)
- **제안**: DEPRECATED 문서이지만 향후 참조가 필요하다면 현재 위치 유지는 합리적. 다만 문서 상단에 "이 파일의 체크리스트는 신규 디자인 트랙에서 처음부터 재작성 예정으로 의도적으로 미완 상태" 문장 추가.

---

## 요약

이번 변경은 20개 이상의 핸들러에 CONVENTIONS Principle 7("config는 raw 입력을 echo한다")을 일관되게 적용한 대규모 마이그레이션이다. 패턴 자체는 명확하고 테스트도 각 핸들러에 추가되어 검증 수준은 양호하다. 유지보수성 관점의 주요 우려는 두 가지다: 첫째, `conditions`/`knowledgeBases` 분기 삼중 삼항 구조가 `ai-agent.handler.ts` 세 곳에 중복되어 있어 정책 변경 시 누락 위험이 있다. 둘째, `void parseNumeric()`, `void chartType` 등 코드 의도를 흐리는 억제 패턴이 남아 있다. `buildSubWorkflowError`의 타입 광역화와 `parallel`의 선택적 `context` 매개변수는 타입 안전성 경계를 조용히 낮추므로 점검이 필요하다. 전반적으로 기능 정확성은 확보된 것으로 보이나, 복잡한 spread 삼항 로직과 잔류 dead code 처리를 정리하면 장기 유지보수 부담이 줄어든다.

## 위험도

**LOW**