### 발견사항

- **[INFO]** `callIndexInTurn` 반환값 행동 변경 — 의도적 버그 수정
  - 위치: `llm-call-trace.ts:108-114` (`fromConversationMessages`)
  - 상세: 기존에는 fallback 경로로 생성된 모든 `LlmCallTrace`의 `callIndexInTurn`이 항상 `0`이었다. 변경 후에는 동일 턴 내 여러 assistant 항목이 `0, 1, 2, …` 순서로 채워진다. `labelForCall`을 사용하는 호출자는 이제 중복 레이블 없이 올바른 결과를 얻는다. 이 행동 변경은 의도적이며 버그 수정에 해당하나, fallback 경로에서 `callIndexInTurn === 0`을 가정하던 다른 소비자가 있다면 영향을 받을 수 있다.
  - 제안: 현재 프로젝트에서 `callIndexInTurn`을 직접 읽는 컴포넌트(`LlmCallTrace`를 소비하는 UI 컴포넌트 등)를 grep하여 `0`을 하드코딩한 가정이 없는지 확인.

- **[INFO]** `callIndexByTurn` Map은 호출마다 새로 생성되는 지역 변수
  - 위치: `llm-call-trace.ts:101`
  - 상세: 전역·모듈 수준 상태를 전혀 건드리지 않는다. 공유 상태 오염 없음.

- **[INFO]** 테스트의 `as Parameters<typeof extractLlmCalls>[1]` 타입 단언
  - 위치: `llm-call-trace.test.ts:152`
  - 상세: 타입만 지정하는 컴파일 타임 단언으로 런타임 부작용 없음. 기존 두 테스트와 동일한 패턴.

---

### 요약

변경 범위는 `fromConversationMessages` 내부의 `callIndexInTurn` 계산 로직으로 엄격히 한정된다. 도입된 `callIndexByTurn` Map은 순수 지역 변수이며, 공개 API(`extractLlmCalls`, `labelForCall`, `countCallsPerTurn`)의 시그니처는 전혀 바뀌지 않았다. 전역 상태·파일시스템·네트워크·이벤트 등 외부 부작용은 없다. 유일한 관찰 포인트는 fallback 경로에서 `callIndexInTurn` 값이 달라진다는 점인데, 이는 중복 레이블 버그를 해결하기 위한 의도적 변경이다.

### 위험도

**LOW**