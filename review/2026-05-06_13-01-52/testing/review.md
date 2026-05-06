---

### 발견사항

---

**[CRITICAL] `endMultiTurnConversation` 메서드 — 테스트 전무**
- 위치: `handler.ts:1086–1110`
- 상세: 엔진이 대화 종료 시 직접 호출하는 public API임에도 spec 파일에 테스트가 단 하나도 없다. 잘못된 `state` 구조가 들어와 `ragLastDiagnostics`, `turnDebugHistory`가 없을 때 런타임 오류 가능성이 있음.
- 제안: `user_ended` / `error` / `max_turns` / `condition` 각 `endReason`, 빈 `messages`, 누락된 선택 키(`ragLastDiagnostics`, `turnDebugHistory`) 시나리오를 포함한 테스트 추가.

---

**[WARNING] `buildConditionOutput`에서 단일턴 호출 시에도 `mode: 'multi_turn'` 하드코딩**
- 위치: `handler.ts:1190–1191`
- 상세: `executeSingleTurn`에서 조건 분기 시 `buildConditionOutput`이 호출되는데, 반환 객체의 `config.mode`가 `'multi_turn'`으로 고정된다. 정상 단일턴 종료 시 `mode: 'single_turn'`이 반환되는 것과 불일치하며, 하위 노드가 `config.mode`를 참조할 경우 오동작 가능. spec의 단일턴 조건 라우팅 테스트(line 1501)도 `result.config.mode` 값을 검증하지 않아 이 오류가 숨어 있다.
- 제안: `buildConditionOutput`에 `mode` 파라미터를 추가하거나, 호출 측에서 `config: { mode: 'single_turn', ... }`를 별도 생성. 테스트에서 `result.config.mode` 검증 추가.

---

**[WARNING] `maxTurns = 0` (무제한) 경로 미테스트**
- 위치: `handler.ts:1030`, `processMultiTurnMessageInner`
- 상세: 코드는 `if (maxTurns > 0 && turnCount >= maxTurns)`로 0을 무제한으로 처리하지만, spec에 `maxTurns: 0`을 사용하는 테스트가 없다. 0 값이 전달될 때 무한 루프 없이 `waiting_for_input`을 반환하는지 검증 불가.
- 제안: `processMultiTurnMessage`에 `maxTurns: 0` 상태를 전달해 `status`가 `'waiting_for_input'`인지 확인하는 테스트 추가.

---

**[WARNING] 조건 툴 카운트 단일/멀티턴 비대칭 — 미테스트**
- 위치: `handler.ts:575–585` (단일턴) vs `handler.ts:966–976` (멀티턴)
- 상세: 단일턴에서 condition tool call은 `toolCallCount`를 증가시키지 않는다고 주석에 명시되어 있지만, 멀티턴에서는 `toolCallCount++`가 실행된다. 이 비대칭이 의도적인지, `maxToolCalls`가 빡빡할 때 멀티턴에서 예상보다 일찍 루프가 종료될 수 있는 문제가 있는지 검증하는 테스트가 없다.
- 제안: 멀티턴에서 조건 툴과 provider 툴이 함께 호출될 때 `toolCallCount`가 어떻게 누적되는지 검증하는 테스트 추가. 비대칭이 의도적이면 단일턴 코드 쪽에도 주석 보완.

---

**[WARNING] Provider `buildTools` 실패 경로(warn-and-continue) 미테스트**
- 위치: `handler.ts:1326–1338`
- 상세: provider의 `buildTools`가 예외를 던지면 경고를 로깅하고 해당 provider를 건너뛰는 실용적인 방어 코드가 있으나, spec에 이를 검증하는 테스트가 없다. 실패 시 나머지 provider tool들이 정상 등록되는지, LLM 호출이 진행되는지 확인 불가.
- 제안: `provider.buildTools`를 `jest.fn().mockRejectedValue(new Error('init fail'))`로 설정하고, 다른 provider의 툴은 정상 등록되어 LLM에 전달되는지 검증하는 테스트 추가.

---

**[WARNING] `adaptHandlerReturn` 프로덕션 검증이 `waiting_for_input` shape만 커버**
- 위치: `spec.ts:588–603`
- 상세: 회귀 테스트가 `waiting_for_input` 출력에 대해 `NODE_ENV=production` 검증만 수행한다. `buildMultiTurnFinalOutput`이 반환하는 `ended` shape, 그리고 단일턴 최종 출력도 동일한 검증을 통과하는지 확인하는 케이스가 없다.
- 제안: `processMultiTurnMessage(maxTurns 도달)` 및 `executeSingleTurn` 반환값에도 `adaptHandlerReturn` 호출 테스트 추가.

---

**[WARNING] `should NOT pre-search KB on first call` 테스트 내 이중 execute 호출**
- 위치: `spec.ts:137–164`
- 상세: 단일 `it` 블록 안에서 `handler.execute`를 두 번 호출하고 각각 다른 assertion을 수행한다. 첫 번째 호출 후 mock 상태(특히 `mockLlmService.chat.mock.calls`)가 초기화되지 않아 두 번째 호출의 결과가 mock 누적 상태에 영향받을 수 있다. 두 assertion이 독립적이지 않다.
- 제안: 두 개의 독립적인 `it` 블록으로 분리.

---

**[INFO] `processMultiTurnMessage` 테스트의 state 객체 중복**
- 위치: `spec.ts:628~1139`
- 상세: `processMultiTurnMessage` describe 블록 내 각 테스트마다 거의 동일한 `state` 객체를 반복 정의한다. 필드 추가/삭제 시 모든 테스트를 함께 수정해야 하는 유지보수 부담이 있다.
- 제안: describe 블록 내 `const baseMultiTurnState = {...}` 공유 픽스처를 정의하고 각 테스트에서 필요한 필드만 spread override.

---

**[INFO] `readSingleTurnMeta` 헬퍼가 단 1개 테스트에서만 사용되면서 파일 최하단에 정의**
- 위치: `spec.ts:2081–2084`
- 상세: 함수가 사용되는 테스트(line 151)와 정의 위치가 멀리 떨어져 있고, 실제로는 한 곳에서만 쓰인다. 나머지 테스트들은 동일한 패턴을 인라인으로 처리한다.
- 제안: 사용하는 테스트 바로 위로 이동하거나 인라인 처리.

---

### 요약

전체적으로 테스트 스위트는 KB 툴 호출 흐름, 병렬/연속 검색, ragDiagnostics 누적, 조건 라우팅, 멀티턴 디버그 히스토리 등 핵심 비즈니스 로직을 촘촘하게 검증하고 있다. 그러나 엔진이 직접 호출하는 `endMultiTurnConversation`의 테스트 공백이 치명적이며, 단일턴 조건 출력의 `config.mode` 오류(항상 `'multi_turn'` 반환)가 테스트에서 가려져 있다는 점, 그리고 `maxTurns=0` 무제한 경로와 조건 툴의 단일/멀티턴 카운트 비대칭 미검증이 추가로 우려된다. feature-out된 테스트의 `it.skip` 처리와 회귀 가드 블록 구성은 적절하다.

### 위험도

**HIGH**