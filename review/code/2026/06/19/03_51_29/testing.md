# Testing Review

## 발견사항

### [INFO] 테스트 구성 — 순수함수 격리 테스트 추가는 명확하고 적절
- 위치: `resolveButtonInteraction` describe 블록 (line 89-285 in diff)
- 상세: `resolveButtonInteraction`·`buildResumedStructuredOutput` 두 순수함수가 별도 `describe` 블록으로 I/O 없이 독립 단위 테스트된다. fixture 인자만으로 결정론적으로 실행되므로 격리성 완전. 테스트명이 분기를 식별자 `(a)/(b)/(b2)/(c)/(d)` 로 명명해 의도를 명확히 전달한다.

### [WARNING] `buildResumedStructuredOutput` Array 분기 테스트: `{ ...array }` 인덱스 키 동작이 명세 vs 버그 경계 불명확
- 위치: `buildResumedStructuredOutput` describe, 케이스 (b) (line 323-338 in diff)
- 상세: 테스트는 배열 input에 대해 `out['0'] === { a: 1 }` 를 단언하지만, 프로덕션 코드(`structuredOutputPayload = { ...prevOutput, interaction, previousOutput }`)의 `{ ...array }` spread가 인덱스 키를 생성하는 것은 의도한 기능인지 명확하지 않다. 이 동작이 현재 명세상 정의된 계약인지, 아니면 `Array.isArray` 분기에서 실수로 허용된 것인지 구분하는 주석이나 테스트 내 설명이 없다. 소비자가 이 인덱스 키(`out['0']`)를 실제로 사용하는 경로가 없다면, 행위 보존 테스트임은 맞지만 개선 여지가 있는 동작을 그대로 못박는 것이다.
- 제안: 해당 케이스 테스트 코드에 "이 spread-인덱스 키 동작은 레거시 fallback이며 Array input 자체가 비정상 케이스임을 명시" 하는 인라인 주석 추가. 또는 `buildResumedStructuredOutput` 내부에서 Array 입력 시 `JSON.stringify` 경고 로그를 남기고, 해당 테스트에서 `console.warn` 호출 여부를 함께 단언.

### [WARNING] `processButtonResumeTurn` 통합 테스트 — `setStructuredOutput` 단언이 첫 번째 케이스에만 존재
- 위치: `ButtonInteractionService > processButtonResumeTurn` (기존 describe, 라인 208-230 in diff)
- 상세: `setStructuredOutput` spy 및 `port/status/interaction.type` 단언이 `button_click(port)` 케이스에만 추가됐다. `button_click(link)` 케이스(`node-btn-link`), `non-button_click fallback` 케이스(`node-btn-fb`), `item-level button` 케이스(`node-btn-item`)에서는 `setStructuredOutput`이 올바른 값으로 호출되는지 통합 레벨 단언이 없다. 순수함수 레벨 테스트(`resolveButtonInteraction` describe)가 이를 부분적으로 보완하지만, 통합 흐름에서 `buildResumedStructuredOutput` + `setStructuredOutput` 연결이 각 케이스별로 정상 작동하는지는 검증되지 않는다.
- 제안: 최소한 `button_click(link)` 케이스에 `setStructuredSpy.mock.calls.find(c => c[1] === nodeId)?.port` 가 `'continue'` 임을 확인하는 단언 1개 추가.

### [INFO] `isButtonClickPayload` type guard 테스트 위치 — `resolveButtonInteraction` describe 내부 중첩
- 위치: `resolveButtonInteraction > isButtonClickPayload (type guard)` describe (line 96-105 in diff)
- 상세: `isButtonClickPayload`는 별도 export 함수이지만 `resolveButtonInteraction` describe 안에 중첩되어 있다. 기능상 문제는 없으나, 이 guard가 독립 단위로 export되었음을 고려하면 최상위 `describe('isButtonClickPayload', ...)` 로 분리하면 가독성 및 찾기가 더 명확해진다. 현 구조도 허용 범위이므로 강제 사항은 아님.

### [INFO] `buttonId 누락 button_click → INVALID_BUTTON_ID` 테스트 (Fix 3)
- 위치: `resolveButtonInteraction`, line 250-261 in diff
- 상세: `payload = { type: 'button_click' }` (buttonId 키 자체 없음)에 대해 `INVALID_BUTTON_ID` throw 를 단언한다. 이는 `ButtonClickPayload` 유니온의 `buttonId?: string` 옵셔널 명세와 `buttons.find(b => b.id === undefined)` 미스 → throw 경로를 정확히 검증한다. 행위 보존 관점에서 중요한 케이스이며 잘 작성됨.

### [INFO] `processButtonResumeTurn` — `nodeExec null` 케이스 단언 완결성
- 위치: `ButtonInteractionService > processButtonResumeTurn > nodeExec null` (line 870-892 전체 파일)
- 상세: `nodeExec null` 케이스에서 `resolves.toBeUndefined()` + `save` 미호출 + `emitNode` 미호출 + `updateExecutionStatus` 호출을 모두 단언한다. `setNodeOutput`과 `setStructuredOutput` 호출 여부는 이 케이스에서 단언하지 않는다. nodeExec가 null이어도 context 갱신은 수행되는데, 이는 정상 동작이며 별도 assert 가 반드시 필요한 것은 아니나, 미래 변경 시 silent 회귀 가능성이 있다.

### [INFO] `buildResumedStructuredOutput` `(c)` 케이스 — `interaction` 자체가 previousOutput에 스트립되는지 미검증
- 위치: `buildResumedStructuredOutput > (c)` (line 340-355 in diff)
- 상세: `(c)` 케이스는 `previousOutput` 키 체인 방지를 검증하는데, `prevOutput` strip 후 top-level `out.x === 1` 을 확인한다. 하지만 만약 `prevOutput`에 `interaction` 키가 이미 있었을 경우(이전 재개 tick 결과가 prevOutput으로 들어온 경우), `interaction` 키는 `{ ...prevOutput }` spread 후 `interaction: structuredInteraction` 으로 덮어써진다. 이 덮어쓰기가 의도대로 동작하는지 테스트하는 케이스가 없다.
- 제안: `output: { x: 1, interaction: { type: 'OLD' } }` 를 입력으로 하는 케이스를 추가해 `out.interaction` 이 새 SI 로 교체됨을 단언.

### [INFO] `NOW` 상수 중복 선언
- 위치: `resolveButtonInteraction` describe (line 90)와 `buildResumedStructuredOutput` describe (line 294)
- 상세: `const NOW = '2026-06-19T00:00:00.000Z'` 가 두 describe 블록에서 각각 선언된다. 하드코딩 날짜가 오늘 날짜(2026-06-19)와 일치하는데, 추후 이 테스트를 읽는 개발자가 날짜를 임의 선택한 것인지 오늘 날짜를 기준으로 한 것인지 혼동할 수 있다. 순수함수 테스트이므로 `new Date().toISOString()` 이 아닌 고정 문자열을 쓰는 것은 옳다. 모듈 상단 공유 상수로 추출하면 유지 관리가 수월해진다. 기능 영향 없음.

## 요약

이번 변경은 `resolveButtonInteraction`·`buildResumedStructuredOutput` 두 순수함수 추출에 대응해 테스트를 체계적으로 확장했다. 순수함수 레벨 격리 테스트는 I/O 의존성 없이 각 분기(a/b/b2/c/d)를 완전히 커버하며, 경계값(buttonId 누락, url 부재, Array input, previousOutput 체인 방지) 을 꼼꼼하게 단언한다. 기존 `ButtonInteractionService` 통합 테스트에는 `setStructuredOutput` 호출 단언이 첫 번째 케이스에만 추가되어, link/fallback/item-level 케이스에서 structured output 경로가 통합 레벨에서 검증되지 않는 커버리지 갭이 남는다. `buildResumedStructuredOutput` Array 분기의 인덱스 키 spread 동작은 동작 보존 테스트로는 유효하나 의도 명시가 부족하다. 전반적으로 테스트 구조와 가독성은 양호하며, 신규 순수함수에 대한 커버리지는 충분하다.

## 위험도

LOW
