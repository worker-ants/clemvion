# 테스트(Testing) 리뷰 — 2026/06/21 21_43_55

대상 커밋: e904c5c5 — M-1 2단계 AiMemoryManager 단위 테스트 + 주석

---

## 발견사항

### [WARNING] recall 호출 인자 검증의 scopeKey 불일치 가능성
- **위치**: `ai-memory-manager.spec.ts` line 241–248 (injectMemoryContext - recall 호출 인자 케이스)
- **상세**: `resolveScopeKey` fake 는 `(key, execId) => key ?? \`exec:${execId}\`` 를 반환한다. 테스트는 `recall` 의 두 번째 인자로 `'k1'` 을 직접 기대한다. 이는 fake 의 반환값(`'k1'`)과 일치하므로 현재는 통과하지만, 실제 소스(`ai-memory-manager.ts` line 166)는 `resolveScopeKey` 의 **반환값**을 `recall` 에 전달한다 — 입력 `memoryKey` 가 아니다. `key=null` 이거나 서비스 구현이 변환을 적용하는 케이스에서 이 테스트는 침묵하고 실제 동작은 달라질 수 있다. `resolveScopeKey` 반환값을 캡처해 `recall` 두 번째 인자와 대조하거나, `resolveScopeKey` 의 반환값이 `recall` 로 흘러가는 경로를 직접 고정하는 케이스를 추가하면 테스트가 SUT 구조를 더 정확히 반영한다.
- **제안**: `memoryKey` 가 `null`/`undefined` 인 케이스(exec-scope fallback 경로)를 추가하고, `recall` 호출의 두 번째 인자가 `resolveScopeKey` 반환값(`exec:exec-1`)임을 검증.

### [WARNING] `system_text` contextInjectionMode 경로 미커버
- **위치**: `ai-memory-manager.spec.ts` — `injectMemoryContext` describe 블록
- **상세**: 소스(`ai-memory-manager.ts` line 321–334)에 `mode === 'system_text'` 분기가 존재한다. 이 경로는 휘발성 꼬리를 `messages` 배열 대신 `systemPrompt` 텍스트에 붙이고 system 메시지를 갱신한다. 현재 테스트는 모두 기본 `'messages'` 모드만 커버하므로, `system_text` 경로는 전용 직접 단위 테스트가 없다. `ai-agent.memory.spec.ts` 통합 경로에서 간접 커버될 수 있으나, 분기 로직이 매니저 내에 있으므로 단위 수준에서 고정하는 것이 behavior-preserving 회귀 격리 목적에 부합한다.
- **제안**: `config: { contextInjectionMode: 'system_text' }` 를 주입하는 케이스 1개 추가 — `finalSystemPrompt` 에 꼬리 텍스트가 append 되고 `messages` 길이가 변하지 않음을 검증.

### [WARNING] `summaryModelConfigId` 분기 경로 미커버
- **위치**: `ai-memory-manager.spec.ts` — `injectMemoryContext` describe 블록
- **상세**: 소스(`ai-memory-manager.ts` line 220–226)에 `summaryModelConfigId` 가 설정되면 `llmService.resolveConfig` 를 호출해 요약 전용 config 를 교체하는 분기가 있다. 현재 테스트 케이스 중 `summaryModelConfigId` 를 전달하는 것이 없어, `resolveConfig` 호출 경로와 `resolvedSummaryModel` 교체 동작이 단위 수준에서 고정되지 않았다. `llmFake` 의 `resolveConfig` 가 mock 이므로 케이스 추가 비용이 낮다.
- **제안**: `summaryModelConfigId: 'sum-cfg'` 를 전달하는 케이스 추가 후 `llmFake().resolveConfig` 가 1회 호출됐는지 검증.

### [INFO] `resolveMemoryStrategy` describe 블록의 `mgr` 인스턴스 공유
- **위치**: `ai-memory-manager.spec.ts` line 76 (`const mgr = new AiMemoryManager(llmFake())`)
- **상세**: `describe` 블록 최상단에서 `mgr` 를 한 번 생성해 세 `it` 케이스가 공유한다. `resolveMemoryStrategy` 가 무상태 순수 함수이므로 현재는 테스트 간 간섭이 없다. 다만 미래에 이 describe 블록에 상태를 가진 케이스가 추가될 경우 격리가 깨질 수 있다. `beforeEach` 로 이동하거나 각 케이스에서 로컬 인스턴스를 생성하는 패턴이 더 방어적이다. 동작에 영향 없으므로 비차단.

### [INFO] `injectMemoryContext` 서비스 미주입 케이스의 strategy 고정
- **위치**: `ai-memory-manager.spec.ts` line 183–198
- **상세**: 서비스 미주입 graceful 케이스는 `strategy: 'summary_buffer'` 만 테스트한다. `strategy: 'persistent'` 이고 `agentMemoryService` 가 미주입인 경우(graceful no-op 경로)는 별도 케이스가 없다 — 단 `scheduleMemoryExtraction` 에서 이 조합은 커버된다. `injectMemoryContext` 에서 `persistent` + 서비스 미주입 시 `recall` 이 실행되지 않고 `recalledCount=0` 으로 degrade 되는 경로도 명시적으로 고정하면 recall 분기 경계가 더 명확해진다.

### [INFO] `tailMode=prepend` + 빈 꼬리(turns=[]) 케이스 미커버
- **위치**: `ai-memory-manager.spec.ts` — `injectMemoryContext` describe 블록
- **상세**: `baseInject` 기본값은 `target: undefined` 이고 `tailMode: 'prepend'` 인데, 이 조합에서 꼬리가 비어 `tailMessages` 가 `[]` 일 때 `splice` 가 messages 배열을 변경하지 않는다는 동작(= 메시지 수 불변)은 서비스 미주입 케이스(line 183)가 간접 커버한다. 별도 명시 케이스가 없어도 현재 커버리지 갭은 아니다.

---

## 요약

`ai-memory-manager.spec.ts` 는 14케이스로 `AiMemoryManager` 의 3개 public 메서드를 직접 고정하며, behavior-preserving 추출의 단위 회귀 격리 목적을 잘 달성한다. fake 팩토리 + baseXxx 헬퍼 패턴은 가독성·재사용성 양면에서 양호하고 #665 선례와 일관되다. 테스트 격리는 `scheduleMemoryExtraction` 케이스들이 매 케이스마다 새 인스턴스를 생성해 적절히 보장된다. 단 `system_text` contextInjectionMode 분기, `summaryModelConfigId` resolveConfig 분기, `scopeKey → recall` 전달 경로 검증 3개가 누락되어 해당 코드 라인이 단위 수준에서 커버되지 않는다. `ai-agent.memory.spec.ts` 통합 경로에서 일부 간접 커버가 될 수 있으나 매니저 분리 의의를 살리려면 단위 케이스 추가가 바람직하다.

---

## 위험도

LOW
