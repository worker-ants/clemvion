# 아키텍처(Architecture) 리뷰

리뷰 대상: `ai-turn-executor.ts` (W7 SPEC-DRIFT 버그픽스 커밋 c7e9574f)

---

## 발견사항

### **[INFO]** 단일 책임 원칙 — 3,353줄 클래스의 비대화 (pre-existing, 이번 변경 무관)
- 위치: `AiTurnExecutor` 클래스 전체 (`/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`)
- 상세: `AiTurnExecutor`는 single-turn 실행, multi-turn 실행, 도구 루프 관리, 메시지 조립, 텔레메트리 emit, ConversationThread push, form 제출 처리, RAG 누적, 메모리 주입 등 다수의 책임을 단일 클래스에서 수행한다. 이번 커밋은 이 구조를 변경하지 않으며 기존 메서드 분해(03 C-2 1차) 방향과 일치하는 리팩터링 경로를 따르고 있다. 현재 변경 범위 내에서 새로운 SRP 위반이 추가되지는 않았다.
- 제안: 현재 진행 중인 refactor-03 시리즈가 완료되면 `RagAccumulator`, `capFormDataBytes`, `handleMultiTurnUserMessageEntry` 등 순수 유틸리티와 side-effect 성 루프 메서드를 별도 collaborator로 분리하는 것을 검토할 것.

### **[INFO]** `recordSingleTurnNonProviderToolResults`와 `recordMultiTurnNonProviderToolResults`의 대칭 정책 도달 — 긍정적
- 위치: `ai-turn-executor.ts:1983`, `ai-turn-executor.ts:1974`
- 상세: 이번 W7 수정으로 두 메서드가 condition 도구를 `toolCallCount`에 합산하지 않는 동일 정책으로 통일됐다. 이전에는 JSDoc이 명시적으로 "의도적으로 다름"을 선언했는데, 이제 `spec §7.1` 의미에 맞춰 두 메서드가 대칭을 이룬다. 중복 로직을 두 메서드로 나눠 유지하는 구조는 이후 정책 변경 시 두 곳을 동기화해야 하는 OCP 측면의 잠재 리스크다.
- 제안: 두 메서드의 `conditionToolCalls` 처리 블록(push deferral content, 미합산)은 현재 완전히 동형이다. 공통 private 헬퍼(`recordConditionDeferralMessages`)로 추출해 정책 단일화 지점을 만드는 것을 고려할 것. `normalToolCalls` 블록도 거의 동형이지만 `isToolTurnsEnabled` 호출 인자(`config` vs `state.rawConfig`)가 다르므로 헬퍼 추출 시 파라미터화 필요.

### **[INFO]** `TOOL_BUDGET_EXCEEDED_ERROR` 상수 추출 — 레이어 경계 명확화 긍정적
- 위치: `ai-turn-executor.ts` 모듈 레벨 상수
- 상세: 인라인 문자열 `'tool_call_budget_exceeded'`를 상수로 추출하고 JSDoc으로 "LLM-internal 신호 / 공개 에러코드와 다른 레이어"임을 명시한 것은 레이어 책임 분리 관점에서 올바른 방향이다. 해당 값이 외부 API에 노출되지 않음을 코드 수준에서 문서화한 것이 구조적 명확성을 높인다.
- 제안: 없음.

### **[INFO]** `condRouteDurationMs` 단일 캡처 — 관측 일관성 개선
- 위치: `ai-turn-executor.ts:1300`(single-turn), `ai-turn-executor.ts:2143`(multi-turn)
- 상세: `Date.now()` 이중 호출을 단일 변수 캡처로 교정했다. trace의 `durationMs`와 `turnDebug`가 동일 시각을 참조하게 되어 텔레메트리 정합성이 보장된다. 설계 관점에서 `Date.now()`와 같은 side-effect 있는 호출을 단일 캡처로 제한하는 것은 시간 계산의 응집도를 높이는 관행이다.
- 제안: 없음.

### **[INFO]** 테스트 구조 — 행동 표면 명시적 고정
- 위치: `ai-turn-executor.spec.ts:64~97` (신규 테스트)
- 상세: 신규 테스트 `'does not count condition tools toward toolCalls in multi-turn, only normal tools'`는 `processMultiTurnMessage` 경로에서 condition 도구 미합산을 `_resumeState.toolCalls`로 직접 단언한다. 기존 single-turn 동명 테스트(line 278~312)와 대칭을 이루며 두 경로가 동일 정책을 가짐을 spec 레벨에서 고정한다. `buildExecutor()`가 실제 collaborator(`AiConditionEvaluator`, `AiMemoryManager`)를 주입받는 방식은 테스트 격리 vs 통합 커버리지 균형에서 의도적 선택으로 JSDoc에 명시되어 있다.
- 제안: 없음.

### **[INFO]** `processMultiTurnMessage` 타입 — `state: Record<string, unknown>` 런타임 캐스팅 집중
- 위치: `recordMultiTurnNonProviderToolResults`, `handleMultiTurnConditionRoute` 등 다수
- 상세: multi-turn 경로 전반에서 `state`가 `Record<string, unknown>`으로 전달되고 내부에서 `state.rawConfig as Record<string, unknown>`, `state.conversationThreadRef as ConversationThread` 등 명시적 캐스팅이 반복된다. 이는 이번 커밋의 변경이 아니라 pre-existing 구조이나, 이 패턴은 런타임 타입 안전성이 낮고 캐스팅 실수가 정적 분석에서 잡히지 않는 약점이다.
- 제안: `_resumeState` 셰이프에 대한 명시적 인터페이스(`MultiTurnResumeState`)를 정의해 캐스팅 지점을 경계(entry/exit)로 국한하는 것을 장기 개선 과제로 검토할 것. 현재 리팩터 시리즈 범위는 아니다.

---

## 요약

이번 커밋(W7 SPEC-DRIFT)은 `recordMultiTurnNonProviderToolResults`에서 condition 도구를 `toolCallCount`에 합산하던 기존 버그를 제거해, single-turn의 동명 헬퍼와 의미론적으로 통일했다. 아키텍처 관점에서 변경은 좁은 범위에 국한되며, SOLID 원칙 위반이나 새로운 순환 의존성·레이어 위반을 도입하지 않는다. `TOOL_BUDGET_EXCEEDED_ERROR` 상수 추출과 `condRouteDurationMs` 단일 캡처는 응집도를 높이는 소폭 개선이다. 두 `recordXxxNonProviderToolResults` 메서드의 condition 블록이 완전히 동형이 된 만큼, 향후 공통 헬퍼로 추출해 변경 지점을 단일화하는 것이 OCP 관점의 다음 자연스러운 개선 방향이다. 현재 변경 내에서 차단적 아키텍처 이슈는 없다.

---

## 위험도

NONE
