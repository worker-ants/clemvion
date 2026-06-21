# 테스트(Testing) 리뷰 결과

> 대상: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` (신규 케이스 3건 추가, 14→17)
> 리뷰 세션: 2026/06/21 21_55_05

---

## 발견사항

### **[INFO]** WARNING #1 해소 — memoryKey 미설정 scopeKey 변환 경로 직접 고정
- 위치: `ai-memory-manager.spec.ts` line 330–347
- 상세: `recall.mock.calls[0][1]` 로 변환된 scopeKey(`'exec:exec-1'`) 를 직접 검증한다. 기존 `'k1'` 직접 기대와 달리 `resolveScopeKey` 반환값이 실제로 `recall` 두 번째 인자로 흐르는지 구현 계약을 확실히 고정한다. 추가로 `resolveScopeKey(undefined, 'exec-1')` 호출 여부도 동시에 검증해 이중 고정.
- 제안: 수렴. 단, `mock.calls[0][1]` 접근은 인자 순서 변경 시 묵묵히 오탐할 수 있으므로 장기적으로 `expect(am.recall).toHaveBeenCalledWith('ws-1', 'exec:exec-1', ...)` 형식으로 전환하면 의도가 더 명확해진다 (비차단).

### **[INFO]** WARNING #2 해소 — `contextInjectionMode=system_text` 분기 커버
- 위치: `ai-memory-manager.spec.ts` line 349–380
- 상세: `messages` 길이 불변(`toHaveLength(2)`) + 마지막 user 메시지 보존으로 `system_text` 모드가 splice 대신 system prompt 에 꼬리를 접는 동작을 확인한다. `prepend` 모드와의 대비가 명확하다.
- 제안: `res.finalSystemPrompt` 에 꼬리 텍스트가 실제로 append 됐는지 추가 단언을 넣으면 "system 메시지에 접는다" 는 서술을 완전히 고정할 수 있다. 현재 검증은 부정("splice 안 함") 만 확인하고 긍정("system_text 에 포함됨") 은 확인하지 않는다 (낮은 수준 미흡).

### **[INFO]** WARNING #3 해소 — `summaryModelConfigId` resolveConfig 경로 커버
- 위치: `ai-memory-manager.spec.ts` line 382–399
- 상세: 케이스 내에서 `llm` 인스턴스를 직접 생성해 `resolveConfig` mock 을 독립적으로 주입한다. `toHaveBeenCalledWith('sum-cfg', 'ws-1')` 로 §12.12 요약 콜 provider 디커플 계약을 고정.
- 제안: `resolveConfig` 가 반환하는 `{ defaultModel: 'sum-model' }` 이 실제 요약 호출 `model` 파라미터로 반영되는지까지 검증하면 end-to-end 계약을 완전히 고정할 수 있다. 현재는 호출 자체만 확인 (비차단).

### **[INFO]** `resolveMemoryStrategy` describe — shared 인스턴스 격리 취약점 잔존
- 위치: `ai-memory-manager.spec.ts` line 76 (`const mgr = new AiMemoryManager(llmFake())`)
- 상세: 이번 변경에서 수정 없이 잔존. 현재 `resolveMemoryStrategy` 는 순수 함수라 문제 없으나, 향후 상태를 가진 케이스가 추가되면 `beforeEach` 없이 인스턴스가 공유되어 격리가 깨질 수 있다. 이전 리뷰(SUMMARY INFO #11)에서도 지적됐으나 "비차단"으로 분류됐고 이번에도 수정되지 않았다.
- 제안: `beforeEach(() => { mgr = new AiMemoryManager(llmFake()); })` 로 이동 또는 각 `it` 블록에 로컬 인스턴스 생성 (비차단, 스타일 이슈).

### **[INFO]** `persistent 회수 성공` 케이스 recall 인자 검증 불일치 (기존 케이스 미수정)
- 위치: `ai-memory-manager.spec.ts` line 241–248
- 상세: `memoryKey: 'k1'` 을 주입하는 기존 케이스에서 `am.recall` 의 두 번째 인자를 `'k1'` (입력 원시값) 으로 기대한다. `agentMemFake` 내 `resolveScopeKey` 구현은 `key ?? \`exec:\${execId}\`` 이므로 `'k1'` 이 들어오면 `'k1'` 을 그대로 반환해 현재는 통과한다. 그러나 이 케이스는 "`resolveScopeKey` 가 key 를 변환할 수 있다" 는 가능성을 전혀 고정하지 않는다. 이번 신규 케이스(WARNING #1 해소)와 의도가 분리되어 있어 일관성 갭이 남는다.
- 제안: 기존 케이스를 `'k1'` → `resolveScopeKey` 반환값(`am.resolveScopeKey.mock.results[0].value`) 으로 교체하거나, 주석에 "key 가 제공될 때는 변환 없이 그대로 전달됨을 검증" 이라고 명시해 의도를 분리한다 (비차단).

---

## 요약

이번 변경은 이전 fresh review(`21_43_55`) 에서 지적된 테스트 커버리지 WARNING 3건(scopeKey 변환 미고정, `system_text` 분기 미커버, `summaryModelConfigId` resolveConfig 미고정)을 단위 케이스로 직접 해소한다. 세 케이스 모두 독립적으로 인스턴스를 생성하고 mock 을 주입하는 격리 원칙을 따르며, `agentMemFake` overrides 패턴을 일관되게 활용해 기존 테스트와 동형이다. 소규모 미흡으로 `system_text` 케이스가 "splice 안 함" 부정 검증에 그치고 `finalSystemPrompt` append 여부를 확인하지 않는 점, `mock.calls[0][1]` 직접 접근이 인자 순서 변경에 취약한 점이 남으나 전부 비차단 INFO 수준이다. production 코드 변경은 없으며 17개 케이스 모두 의도를 명확하게 서술하고 있어 회귀 격리 목적을 달성한다.

## 위험도

NONE
