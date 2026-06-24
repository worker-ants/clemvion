# Testing Review — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

### [INFO] persistUserTurn 단위 테스트: 공백-only 입력이 appendMessage 를 여전히 호출하는지 미검증
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` L154–158
- 상세: `'   \n\t  '` 입력 케이스에서 `setTitleIfEmpty` 미호출은 확인하나, `appendMessage` 가 공백 원문 그대로 저장되는지(빈 문자열 처리 없이 role:'user' content:'   \n\t  ' 로 저장)는 단언이 없다. 실제로 구현은 appendMessage 를 trim 없이 호출하므로 DB 에 공백 content 가 저장된다. 이 동작이 의도된 것이라면 테스트에 명시적으로 단언해 두는 게 가독성·회귀 안전성을 높인다.
- 제안: 해당 `it` 블록에 `expect(sessionService.appendMessage).toHaveBeenCalledWith('sess-1', { role: 'user', content: '   \n\t  ' })` 를 추가해 white-space content 저장이 의도임을 명시.

### [INFO] persistAssistantTurn: 'usage.thinkingTokens' optional 필드 커버리지 없음
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` L219–237
- 상세: 신규 단위 spec 의 usage 테스트는 `{ inputTokens, outputTokens, totalTokens, model }` 만 다루고 `thinkingTokens` 가 있는 경우를 테스트하지 않는다. 구현 시그니처에서 `thinkingTokens?: number` 가 optional 이므로 있을 때 / 없을 때 둘 다 appendMessage 에 그대로 전달되는지 확인이 필요하다.
- 제안: `thinkingTokens: 5` 가 포함된 usage 객체로 케이스 하나 추가.

### [INFO] persistAssistantTurn: resumeMeta 기본값 인자 생략 케이스 미검증
- 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` L171–192
- 상세: 현재 "default non-resumed meta" 테스트는 `resumeMeta` 인자를 명시적으로 생략해 기본값(`makeResumeMeta(0)`)이 적용되는 경로가 아닌, 단지 `stallRounds=0` 의 makeResumeMeta 반환값이 올바른지를 별도 describe 에서 검증하는 구조다. 실제 7번째 인자를 생략했을 때 persistAssistantTurn 이 기본값을 올바르게 사용하는지(TypeScript 기본 매개변수 경로)를 명시적으로 테스트하는 케이스가 없다.
- 제안: `persistAssistantTurn('sess-1', 'text', [], null, null, 'stop')` (resumeMeta 생략) 호출 후 `row.autoResumed === false` 를 단언하는 케이스 추가. 현재 "appends an assistant row with the default (non-resumed) meta" 테스트도 6개 인자만 넘기므로 기본값 경로는 이미 간접적으로 커버되나, L373 의 같은 패턴과 명확히 구분되는 케이스 이름과 단언을 두면 의도가 더 명확해진다.

### [INFO] 통합 spec(workflow-assistant-stream.service.spec.ts): turnPersistence mock 이 실제 구현 인스턴스로 주입됨
- 위치: `/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` L777–788
- 상세: `AssistantTurnPersistenceService` 를 jest.fn() mock 이 아닌 실제 생성자로 인스턴스화해 주입한다. 이 접근은 "같은 mock sessionService 를 공유하므로 appendMessage 단언이 성립한다"는 설계 의도가 있고 주석으로 명시되어 있어 현재는 합리적이다. 그러나 `AssistantTurnPersistenceService` 의 내부 로직 변경(예: persist 전 추가 가공)이 통합 테스트에 무언으로 반영되어 스트림 서비스 고유 동작 단언과 섞일 수 있다. 단위 경계가 약해지는 구조적 트레이드오프이므로, 팀 합의된 패턴이면 문제없으나 향후 `persistUserTurn` / `persistAssistantTurn` 를 jest.fn() spy 로 교체하는 방향도 고려할 수 있다.
- 제안: 현재 주석 설명을 유지하되, 향후 `AssistantTurnPersistenceService` 시그니처가 변경될 경우 통합 spec 의 `makeService()` 도 함께 업데이트해야 함을 주석에 명시.

### [INFO] makeResumeMeta 경계값: `stallRounds === 1` 최솟값 의미 추가 테스트 불필요 (충분)
- 위치: L111–122
- 상세: 0, -1, 1, 2 로 경계값 커버가 충분하다. `Number.MAX_SAFE_INTEGER` 같은 극단값은 현실적으로 도달 불가(MAX_STALL_ROUNDS=2)이므로 불필요. 현재 커버리지 적절.

## 요약

신규 `AssistantTurnPersistenceService` 에 대한 단위 spec 13개는 `makeResumeMeta` 경계값(0/-1/1/2), `persistUserTurn` 의 title derive/skip(4케이스), `persistAssistantTurn` 의 shape/resumeMeta(4케이스) 를 명확하게 격리 검증한다. 팩토리 함수(`makeService`, `makeSessionMock`)로 테스트 간 의존성을 완전히 분리하고, 각 `it` 블록이 독립 인스턴스를 사용해 격리 원칙을 잘 지킨다. 통합 spec 도 신규 DI 주입을 최소 변경으로 수용했으며, 기존 단언 경로(appendMessage/setTitleIfEmpty)가 위임 경유 후에도 동일하게 성립하는 구조임을 주석으로 설명한다. 발견된 갭(공백 content 의 appendMessage 단언 미명시, thinkingTokens 옵셔널 케이스 미테스트, resumeMeta 기본값 경로 명시적 케이스 부재)은 모두 INFO 수준이며 기존 커버리지를 깨는 문제는 없다. 기존 테스트(통합 72개)가 변경 후에도 그대로 유효하고 e2e 214개 PASS 가 보고되어 회귀 위험은 낮다.

## 위험도

LOW
