## 발견사항

### [WARNING] `parallel.handler.ts` — `context` 파라미터 optional화로 `NodeHandler` 인터페이스 불일치

- **위치**: `parallel.handler.ts:32` — `execute(input, config, context?: ExecutionContext)`
- **상세**: 다른 모든 핸들러와 `NodeHandler` 인터페이스는 `context: ExecutionContext`를 필수로 요구하는데, `parallel`만 optional(`context?`)로 선언했다. TypeScript 파라미터 assignability 규칙상 컴파일 오류는 나지 않지만, `parallel.schema.spec.ts`에서 context 없이 `execute({}, {...})` 2인수로 호출하는 기존 테스트를 살리기 위한 타협이다. 인터페이스 계약 일관성이 깨진다.
- **제안**: 테스트에서 최소 context 객체를 주입하거나, 인터페이스 레벨에서 전체 핸들러에 걸쳐 optional 여부를 통일한다.

---

### [WARNING] `parallel.handler.ts` — 클램핑 제거로 `maxConcurrency` / `waitAll` 무제한 값 echo

- **위치**: `parallel.handler.ts:46-52`
- **상세**: 기존 코드는 `maxConcurrency`를 `[0, 16]`으로, `waitAll`을 `true`로 기본값 처리한 뒤 echo했다. 변경 후 `rawConfig.maxConcurrency`(예: 100, -3, undefined)와 `rawConfig.waitAll`(undefined 가능)을 그대로 echo한다. "engine이 `outputData.config`가 아닌 `node.config`를 읽는다"는 가정이 성립해야만 안전하다. `parallel.schema.spec.ts`도 이 변경을 명시적으로 확인(`toBe(100)`, `toBe(-3)`)하지만, engine 측에서 `outputData.config.maxConcurrency`를 읽어 분기 제어에 활용하는 경로가 있는지 별도 검증이 없다.
- **제안**: engine 코드에서 `outputData.config.maxConcurrency`를 읽지 않음을 grep 또는 주석으로 명시적으로 확인·기록한다.

---

### [WARNING] `table.handler.ts` — `columns: resolvedColumns`가 `config` → `output`으로 이동

- **위치**: `table.handler.ts` payload 구성부
- **상세**:
  - **전**: `config.columns = resolvedColumns`(표현식 평가 완료된 컬럼 정의), `output`에 columns 없음
  - **후**: `output.columns = resolvedColumns`, `config.columns = rawConfig.columns`(미평가 raw 템플릿)
  
  이는 출력 계약의 구조 변경이다. 프론트엔드나 다운스트림 노드가 `outputData.config.columns`에서 렌더링된 컬럼 label을 읽고 있다면, 이제 `{{ $col.label }}` 같은 미해석 문자열을 받게 된다. `output.columns` 경로는 기존에 없었으므로 이를 읽는 소비자도 없다.
- **제안**: 프론트엔드 및 다운스트림 노드에서 `outputData.config.columns` 참조 여부를 grep으로 확인하고, 필요 시 마이그레이션 처리한다.

---

### [WARNING] `loop.handler.ts` — `void parseNumeric()` 는 실제 효과 없는 dead code

- **위치**: `loop.handler.ts:54-55`
- **상세**: 주석에 "parseNumeric is still invoked for its side-effect of validating the resolved values"라고 쓰여 있지만, `parseNumeric`은 순수 함수로 사이드 이펙트가 없다. `void` 처리로 반환값을 버리므로 검증도, 클램핑도, 에러도 발생하지 않는다. 기존 코드에서 `resolvedCount`/`resolvedMax` 계산 시 이루어지던 수치 파싱 결과가 이제 완전히 사라졌다. engine이 `outputData.config.count`를 읽어 반복 수를 결정한다면 raw 문자열(`"{{ $input.count }}"`)이 NaN 반복을 유발할 수 있다.
- **제안**: `void parseNumeric()` 호출을 제거하고, 주석을 "validate-time에 schema가 검증"으로 수정한다.

---

### [INFO] `ai-agent.handler.ts` — 멀티턴 재개 시 `state.rawConfig` 부재 케이스

- **위치**: `ai-agent.handler.ts:1175` — `(state.rawConfig as Record<string, unknown> | undefined) ?? {}`
- **상세**: Phase 1에서 첫 턴에 `state.rawConfig`를 스냅샷하도록 변경되었으나, 배포 전에 이미 WAITING_FOR_INPUT 상태로 진입한 인-플라이트 실행은 `state.rawConfig`가 없다. 이 경우 `turnRawConfig = {}`가 되어 `systemPrompt: undefined`가 echo된다. 기존에는 multi-turn waiting echo에 `systemPrompt` 자체가 없었으므로 `undefined`로 추가되는 셈이다. UI가 `config.systemPrompt`를 렌더링한다면 표시 이상이 발생할 수 있다.
- **제안**: 배포 시 인-플라이트 실행의 동작 차이를 확인하거나, `turnRawConfig.systemPrompt ?? systemPrompt`로 폴백을 추가한다.

---

### [INFO] `chart.handler.ts` — `void chartType; void title;` TS 경고 억제용 dead statement

- **위치**: `chart.handler.ts:74-75`
- **상세**: `chartType`과 `title` 변수는 선언 후 config echo에 사용되었으나, 이제 `rawConfig.chartType`/`rawConfig.title`으로 대체되면서 미사용이 됐다. `void` 문으로 "사용"처럼 보이게 하는 것은 코드 노이즈다.
- **제안**: 변수 선언 자체를 제거하고 직접 `rawConfig.chartType`, `rawConfig.title`을 echo 객체에서 참조한다.

---

### [INFO] `workflow.handler.ts` — `buildSubWorkflowError` 파라미터 타입 widening

- **위치**: `workflow.handler.ts:145`
- **상세**: private 메서드의 파라미터 타입이 `{ workflowId: string; mode: 'sync' | 'async' }` → `Record<string, unknown>`으로 완화됐다. 내부에서 `configEcho.workflowId`, `configEcho.mode`를 `unknown`으로 접근하게 되어 TypeScript 타입 안전성이 저하된다. runtime 동작은 동일하지만, 타입 체커가 잘못된 필드 접근을 잡아주지 못하게 된다.
- **제안**: 필요한 최소 필드를 포함하는 인터페이스(`{ workflowId: unknown; mode: unknown }`)로 파라미터 타입을 명시한다.

---

### [INFO] `information-extractor.handler.ts` — `rawConfig.outputSchema` 필드명 일치 여부

- **위치**: `information-extractor.handler.ts:160`
- **상세**: `schema: rawConfig.outputSchema ?? outputSchema` — `rawConfig`의 키가 `outputSchema`인지, 아니면 사용자가 `schema`로 입력하는지 schema 정의와의 일치 여부를 확인해야 한다. 불일치 시 `rawConfig.outputSchema`가 항상 undefined가 되어 폴백으로만 동작한다(기능 이상 없지만 Principle 7 미적용).
- **제안**: `ai-agent/information-extractor.schema.ts`에서 실제 config 필드명을 확인한다.

---

## 요약

이번 변경은 CONVENTIONS Principle 7(config echo에 평가 전 원본 raw 값 반영)을 18개 핸들러에 일관되게 적용한 대규모 리팩토링이다. 패턴 자체는 `rawConfig = context.rawConfig ?? config` 폴백 구조로 하위 호환성을 유지하며 안전하게 구현됐다. 그러나 `table.handler.ts`에서 `columns`가 `config`에서 `output`으로 이동한 구조적 계약 변경과, `parallel.handler.ts`의 비클램핑 echo(engine이 `outputData.config`를 읽지 않는다는 가정 의존), `loop.handler.ts`의 실효 없는 `void parseNumeric()` 호출은 실질적인 side effect 리스크를 내포한다. 특히 프론트엔드가 `outputData.config.columns`를 의존하고 있다면 table 노드의 변경이 즉각적인 회귀를 유발할 수 있다.

## 위험도

**MEDIUM**