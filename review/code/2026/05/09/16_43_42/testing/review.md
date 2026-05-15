## 발견사항

### `truncate-body.util.spec.ts` / `.ts`

- **[WARNING]** 단일 unserializable 요소 엣지 케이스 미테스트
  - 위치: `truncateArrayForOutput` 함수 전체
  - 상세: `arr = [cyclic]` 처럼 배열의 첫 번째 요소 자체가 직렬화 불가능한 경우, binary search 결과 `lo=0`이 되어 `{value: [], truncated: true, originalLength: 1}`을 반환한다. 이는 예상치 못한 동작이지만 테스트가 없다. cyclic 테스트는 직렬화 가능한 선행 요소(`{ok:1}`, `{ok:2}`)가 있는 경우만 검증한다.
  - 제안: `arr = [cyclic]` 단독 케이스 추가. 빈 배열 반환 + `truncated:true` 이 예상된 동작인지 주석으로 명시.

- **[INFO]** 단일 요소가 예산 초과하는 케이스 미검증
  - 위치: `truncateArrayForOutput`, `measure` 내부
  - 상세: 배열에 요소가 1개뿐인데 그 요소 자체가 `maxBytes`를 초과하면 `value: []`가 반환된다. 호출자(carousel, table)가 이 케이스를 어떻게 처리하는지 불분명.
  - 제안: `truncateArrayForOutput([{big: 'x'.repeat(2048)}], 1024)` 케이스 추가, `value.length === 0`, `truncated === true` 검증.

---

### `ai-agent.handler.spec.ts`

- **[WARNING]** `conditions: []` (빈 배열) 케이스 미테스트
  - 위치: `buildMultiTurnConfigEcho` 내부 조건 `(raw.conditions as unknown[]).length > 0`
  - 상세: 구현에서 빈 conditions 배열은 echo하지 않는다. 이 분기를 커버하는 테스트가 없어, 향후 실수로 조건을 제거했을 때 회귀를 잡지 못한다.
  - 제안: `conditions: []`가 포함된 rawConfig로 `buildMultiTurnFinalOutput` 호출 시 `config.conditions`가 `undefined`임을 검증하는 케이스 추가.

- **[INFO]** `userPrompt`, `responseFormat` 필드 echo 미검증
  - 위치: `buildMultiTurnFinalOutput` echo 테스트
  - 상세: `buildMultiTurnConfigEcho`가 `userPrompt`, `responseFormat`도 처리하지만 신규 테스트에 이를 검증하는 assertion이 없다.
  - 제안: 첫 번째 테스트 rawConfig에 `userPrompt: '{{ vars.prompt }}'`, `responseFormat: 'json'`을 추가하고 `config.userPrompt`, `config.responseFormat` 검증.

- **[INFO]** condition-triggered 테스트에서 tool name 하드코딩 의존
  - 위치: `'echoes raw conditions / systemPrompt in condition-triggered output.config'` 테스트
  - 상세: `name: 'cond_a1b2c3d4_refund'`가 `conditionConfig.conditions[0].id`와 매칭된다고 가정한다. `conditionConfig` 정의가 diff에 없어 ID 값 검증이 불가능하다. ID가 변경되면 이 테스트는 이유를 알기 어렵게 silently fail할 수 있다.
  - 제안: tool name 생성 로직을 `conditionConfig.conditions[0].id`에서 동적으로 조립하거나, 의존 관계를 주석으로 명시.

---

### `information-extractor.handler.spec.ts` / `.ts`

- **[WARNING]** `hydrateState`의 `rawConfig` 복원 경로 미테스트
  - 위치: `information-extractor.handler.ts:1279` — `rawConfig: raw.rawConfig as Record<string, unknown> | undefined`
  - 상세: multi-turn resumed 경로에서 DB state row를 역직렬화할 때 `rawConfig`가 올바르게 복원되는지 검증하는 테스트가 없다. 첫 waiting tick 이후의 resumed 턴에서 rawConfig가 echo되려면 이 hydration이 정확해야 한다.
  - 제안: `hydrateState`에 `rawConfig`가 포함된 state row를 넣어 반환 객체의 `rawConfig` 필드를 직접 검증하는 단위 테스트 추가.

- **[INFO]** `outputSchema → schema` 매핑 검증 누락
  - 위치: `buildMultiTurnFinalOutput` echo 테스트 1
  - 상세: rawConfig의 `outputSchema`가 `config.schema`로 매핑되는지 검증하는 assertion이 없다. 구현에서 `(raw.outputSchema as OutputField[] | undefined) ?? state.outputSchema`로 처리한다.
  - 제안: `expect(config.schema).toEqual(rawConfig.outputSchema)` 추가.

- **[INFO]** `state as never` 타입 캐스팅
  - 위치: 두 신규 테스트 모두
  - 상세: 타입 캐스팅으로 TypeScript 컴파일 타임 검증을 우회한다. `MultiTurnState` 인터페이스와 실제 state 구조의 불일치가 있어도 컴파일 오류가 발생하지 않는다.
  - 제안: test-internal builder helper(`buildTestState(overrides)`)를 만들어 타입 안전성을 유지하거나, partial 타입을 활용.

---

### `carousel.handler.spec.ts` / `table.handler.spec.ts`

- **[WARNING]** dynamic 모드에서의 1MB cap 미검증
  - 위치: carousel `output cap` describe 블록, table `output cap` describe 블록
  - 상세: 두 핸들러 모두 truncation은 모드(static/dynamic) 처리 이후에 적용되지만, 신규 테스트는 carousel은 `mode: 'static'`, table은 `mode: 'dynamic'`만 검증한다. carousel의 dynamic 모드(배열 소스 → items 생성 후 cap)는 미검증.
  - 제안: carousel에 dynamic 모드로 대량 배열 입력 시 truncation 동작 케이스 추가.

- **[INFO]** truncation 시 `rendered` HTML 완전성 미검증
  - 위치: carousel `'truncates items array...'` 테스트
  - 상세: items가 잘릴 때 `rendered` HTML이 존재하고 (잘리지 않은) 전체 HTML을 포함하는지 검증하지 않는다. 스펙에서 `rendered`는 cap 대상이 아님을 명시하나 이를 보장하는 테스트가 없다.
  - 제안: `expect(result.output.rendered).toBeDefined()` 및 잘린 items보다 더 많은 슬라이드가 rendered에 포함됨을 검증.

- **[INFO]** table 1MB pass-through 테스트에서 `totalRows` 검증 순서
  - 위치: `'passes through rows unchanged...'` 테스트
  - 상세: 이 테스트는 통과하지만 `totalRows: 2`가 맞는 이유(pageSize/sort 없음)를 주석으로 설명하면 유지보수성이 높아진다. (대비: truncation 테스트는 주석이 상세함)

---

## 요약

전체적으로 테스트 품질은 양호하다. 핵심 happy path(rawConfig echo/fallback, 1MB truncation/pass-through, cyclic 안전성)가 잘 커버되어 있고, plan 문서의 테스트 목록과도 일치한다. 주요 리스크는 세 가지다: (1) `hydrateState` rawConfig 복원 경로 — multi-turn resumed 턴에서 rawConfig가 실제로 DB 왕복 후에도 올바르게 echo되는지 보장할 테스트가 없다; (2) `truncateArrayForOutput`에서 단일 unserializable 요소처럼 모든 요소가 잘릴 때 `value: []` 반환이 호출자에게 예상치 못한 동작일 수 있다; (3) carousel dynamic 모드 + cap 조합이 미검증이다. 나머지는 가독성·완전성 수준의 INFO 항목이다.

## 위험도

**LOW**