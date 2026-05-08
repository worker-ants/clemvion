## 발견사항

---

### **[CRITICAL] ai-agent 멀티턴 재개 경로에서 `systemPrompt` 폴백 없음**
- 위치: `ai-agent.handler.ts` diff +1180~+1206 (resume 경로)
- 상세: `turnRawConfig = (state.rawConfig as ...) ?? {}` — `state.rawConfig`가 없으면 빈 객체. 이때 `systemPrompt: turnRawConfig.systemPrompt`는 폴백이 전혀 없어 `undefined`가 됨. `model`은 `?? model` 폴백이 있는데 `systemPrompt`만 누락. Phase 1 이전 실행이나 `state.rawConfig` 미기록 실행에서 회귀 발생.
- 제안:
  ```ts
  systemPrompt: turnRawConfig.systemPrompt ?? systemPrompt,
  ```
  그리고 단위 테스트 — `state.rawConfig`가 undefined인 경우 `systemPrompt`가 evaluated 값으로 폴백되는지 커버.

---

### **[CRITICAL] loop.handler.ts — `void parseNumeric()` 호출은 dead code**
- 위치: `loop.handler.ts` 리팩토링 부분
- 상세: 주석이 "side-effect of validating"이라고 쓰고 있지만 `parseNumeric`은 순수 함수로 부수효과가 없다. `void fn()` 호출은 반환값을 버리는 것이며 아무 효과도 없다. 기존에는 validation이 `validate()` 에서 수행되므로 `execute()`에서 이를 호출하는 의미도 없다. 잘못된 주석이 코드 의도를 혼란스럽게 만든다.
- 제안: 두 `void parseNumeric(...)` 호출과 관련 주석 제거. 또는 실제로 validate가 필요하다면 그 로직을 명시적으로.

---

### **[WARNING] ai-agent.handler.ts — 3개 코드 경로 모두 테스트 없음**
- 위치: `ai-agent.handler.ts` 전체 diff (단일턴/멀티턴 초기/멀티턴 재개)
- 상세: 변경된 파일 중 가장 복잡하고 영향 범위가 큰 핸들러인데 새 rawConfig echo 경로에 대한 테스트가 하나도 추가되지 않았다. 특히 resume 경로는 `state.rawConfig`의 유무에 따라 동작이 달라지는 분기가 있다.
- 제안: 최소 3개 테스트 추가 — (1) 단일턴 rawConfig echo, (2) 멀티턴 초기 waiting tick echo, (3) 멀티턴 resume with/without `state.rawConfig`.

---

### **[WARNING] table.handler.ts — `columns` 위치 변경(config→output)은 파괴적 변경이며 테스트 없음**
- 위치: `table.handler.ts` diff +output columns 추가
- 상세: 기존 `config.columns`에 있던 resolvedColumns가 `output.columns`로 이동하고, `config.columns`는 raw 값이 들어간다. 다운스트림 노드에서 `$config.columns`로 평가된 컬럼 레이블을 참조하는 워크플로가 깨질 수 있다. 이 행동 변화에 대한 테스트가 없다.
- 제안: table.handler.spec.ts에 (1) rawConfig가 있을 때 `config.columns`가 raw, `output.columns`가 resolved임을 검증, (2) 기존 `config.columns` 소비자 회귀 테스트 추가.

---

### **[WARNING] 테스트 없는 핸들러 14개 (일괄)**
- 위치: `information-extractor`, `text-classifier`, `code`, `transform`, `workflow`, `database-query`, `background`, `merge`, `carousel`, `chart`, `form`, `template` handler + `parallel` (context 선택적 변경)
- 상세: 모두 `rawConfig ?? config` 패턴을 도입했으나 대응하는 spec 파일에 rawConfig 관련 테스트가 없다. `parallel.handler.ts`는 `context`가 `optional`로 변경되어 `undefined` 전달 시 `rawConfig` 분기가 `config`로 폴백하는 경로가 테스트되지 않는다.
- 제안: 각 핸들러에 최소 1개의 rawConfig echo 테스트 추가. 특히 workflow(async/sync/error 3경로), text-classifier(error/single/multi-label 3경로)는 우선순위 높음.

---

### **[WARNING] chart.handler.ts — buttons 경로에서 rawConfig 불일치**
- 위치: `chart.handler.ts` buttons 분기
- 상세: `configEcho`는 rawConfig를 사용하지만 buttons-present 분기에서 `buttons: config.buttons`(evaluated)를 그대로 사용. `template.handler.ts`는 `buttons: rawConfig.buttons ?? buttons`로 일관성 있게 처리하는 반면 chart는 다르다.
- 제안:
  ```ts
  buttons: (rawConfig.buttons as ButtonDef[] | undefined) ?? buttons,
  ```

---

### **[WARNING] filter/if-else/foreach/map/split — rawConfig 필드 누락 시 폴백 없음**
- 위치: 각 핸들러의 rawConfig 접근부
- 상세: `inputField: rawConfig.inputField`, `conditions: rawConfig.conditions` 등 핵심 필드에 폴백이 없다. `context.rawConfig`가 존재하지만 특정 필드만 없는 경우(부분적 rawConfig) echo가 `undefined`가 된다. 현재 테스트들은 rawConfig에 모든 필드가 있는 happy path만 커버한다.
- 제안: 부분 rawConfig 케이스 테스트 추가. 또는 `rawConfig.inputField ?? inputField`처럼 evaluated 값으로 폴백 추가.

---

### **[WARNING] parallel.handler.ts — `context?: ExecutionContext` optional 불일치**
- 위치: `parallel.handler.ts:29`
- 상세: 인터페이스 `NodeHandler['execute']`가 `context: ExecutionContext`(필수)로 정의되어 있다면, 여기서만 optional로 받는 것은 LSP 위반 가능성. 다른 모든 핸들러는 필수로 받음.
- 제안: 필수로 변경하거나 인터페이스 정의 확인. 테스트에서 context 없이 호출하는 케이스 커버도 누락.

---

### **[INFO] loop.handler.spec.ts — 기존 테스트 동작 변경의 의미 문서화 부족**
- 위치: `loop.handler.spec.ts` 기존 테스트 수정 부분
- 상세: `{ count: 10 }` → `{ count: '10' }`로 기대값이 바뀌었다. 이는 단순 echo 변경이지만, 만약 다운스트림에서 `result.config.count`를 숫자로 기대하는 코드가 있다면 런타임 오류 가능. 변경 이유 설명은 충분하나, 다운스트림 소비자 여부를 grep으로 검증했다는 근거가 없다.
- 제안: "outputData.config is never read back" 주장에 대한 grep 결과 또는 테스트를 evidence로 추가.

---

### **[INFO] makeContext 헬퍼 함수가 manual-trigger.spec.ts에만 추가**
- 위치: `manual-trigger.handler.spec.ts`
- 상세: `rawConfig`를 전달하는 `makeContext` 패턴이 이 파일에만 있고 다른 스펙 파일들은 `{ ...context, rawConfig: Object.freeze(...) }` 인라인 방식을 사용. 불일치하지만 기능상 동일.
- 제안: 공통 test util로 추출하거나 패턴 통일.

---

## 요약

Phase 3 raw-echo 마이그레이션은 `logic/` 하위 핸들러 9개에서 패턴이 일관되게 적용되었고 대응 테스트가 함께 추가된 점은 긍정적이다. 그러나 **변경된 36개 handler 중 14개에 새 테스트가 없으며**, 특히 `ai-agent.handler.ts`의 multi-turn resume 경로에서 `systemPrompt` 폴백 누락이 발견된 것은 실제 런타임 회귀 가능성이 있는 버그다. `loop.handler.ts`의 `void parseNumeric()` 호출은 의미 없는 dead code이며 혼란을 줄 수 있고, `table.handler.ts`의 `columns` 이동은 파괴적 변경임에도 테스트가 없다. `context?.rawConfig`의 partial 객체 케이스에 대한 방어적 테스트도 전반적으로 부족하다.

## 위험도
**HIGH**