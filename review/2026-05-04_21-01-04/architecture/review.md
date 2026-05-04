### 발견사항

- **[INFO]** `fromConversationMessages` 의 암묵적 순서 의존성
  - 위치: `llm-call-trace.ts`, `fromConversationMessages` 함수 전체
  - 상세: `callIndexByTurn` Map이 메시지 배열이 이미 시간 순으로 정렬되어 있다고 가정한다. 이 불변 조건이 함수 시그니처나 주석에 명시되지 않아, 호출자가 순서를 바꿔 넘기면 `callIndexInTurn`이 틀린 값이 된다.
  - 제안: 주석에 `// messages must be ordered chronologically within each turn` 한 줄 추가하거나, 타입 수준에서 `OrderedConversationItem[]` 같은 브랜드 타입을 활용.

- **[INFO]** 폴백 경로의 아키텍처적 출처가 외부 제약에 묻혀 있음
  - 위치: `extractLlmCalls` JSDoc — "Live waiting sessions never ship `_turnDebugHistory` over WebSocket (the engine strips it)"
  - 상세: 백엔드 WebSocket 제약(trace 미포함)을 프론트엔드 유틸리티 함수가 대신 보완하는 구조다. 이 선택은 이미 JSDoc에 설명되어 있어 의도는 명확하지만, 추후 백엔드가 trace를 포함하기 시작해도 `fallbackMessages` 코드 경로가 남아 있을 위험이 있다.
  - 제안: 현재로선 허용 가능. 다만 백엔드가 trace를 실어 보내는 시점이 되면 `fallbackMessages` 분기를 제거해 데드 코드화를 막아야 한다.

- **[INFO]** 데이터 형태(shape) 판별 로직이 단일 함수에 집중
  - 위치: `extractFromOutputData` (legacy flat / output._turnDebugHistory / output._llmCalls 세 분기)
  - 상세: 현재는 세 가지 형태인데, 새 형태가 추가될 때마다 `extractFromOutputData` 를 직접 수정해야 한다(OCP 미충족). 변경량이 작아 지금은 관리 가능하지만, 네 번째 이후부터는 형태 판별 전략을 테이블/맵으로 분리하는 편이 낫다.
  - 제안: 즉시 수정은 불필요. 네 번째 shape 추가 시 `[predicate, extractor][]` 형태의 전략 배열로 리팩토링 고려.

### 요약

변경 범위는 `fromConversationMessages` 안의 `callIndexInTurn` 할당 로직으로 좁게 한정되어 있고, `Map<number, number>` 를 함수 스코프 내에 두어 순수 함수 특성을 유지하면서 tool loop 시나리오를 정확히 처리한다. SRP·저결합·응집도 모두 기존 수준을 유지하며, 테스트는 실제 tool loop 시퀀스(user → assistant with toolCall → tool result → assistant)를 end-to-end로 검증해 회귀 가능성을 효과적으로 차단한다. 구조적으로 우려할 만한 사항은 없으며, 위 INFO 항목은 장기 유지보수 관점의 참고 사항이다.

### 위험도
**NONE**