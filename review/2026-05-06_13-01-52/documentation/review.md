### 발견사항

---

**[CRITICAL]** `aiAgentNodeOutputSchema` JSDoc이 현재 핸들러 출력 구조와 불일치
- **위치**: `ai-agent.schema.ts` L372-385
- **상세**: 주석이 "The AI Agent handler returns a **legacy bare object** (no `config/output` wrapper)"라고 명시하지만, 핸들러는 이미 `{ config, output: { result: {...} }, meta: {...} }` 구조를 반환한다(handler.ts L640-681). 스키마 필드도 최상위에 `response`, `messages`, `condition`, `metadata`를 두는데, 실제 데이터는 `output.result.response`, `output.result.messages`, `meta.*`에 위치한다. 이 스키마는 `z.toJSONSchema()`로 직렬화되어 프론트엔드 `$node["X"].output.<field>` 자동완성을 구동하므로, 잘못된 경로(예: `output.response` vs 실제 `output.result.response`)를 제안하게 된다.
- **제안**: 주석을 CONVENTIONS §8 적용 이후 실제 출력 구조로 갱신하고, 스키마 필드를 `result: z.object({ response, messages, turnCount, endReason, condition }).optional()` 구조로 교정한다. 또는 flat → nested 매핑이 외부 어댑터에서 처리된다면 그 사실을 명시한다.

---

**[WARNING]** `AiAgentHandler` 클래스 레벨 JSDoc 부재
- **위치**: `ai-agent.handler.ts` L241
- **상세**: 핸들러의 두 가지 실행 모드(single/multi-turn), tool provider 위임 구조, WebSocket 텔레메트리 선택적 의존성 등의 설계 의도가 클래스 레벨에 기록되어 있지 않다. 개발자가 클래스를 처음 열었을 때 전체 그림을 파악하기 어렵다.
- **제안**: 클래스 상단에 두 모드의 실행 흐름, tool provider 인터페이스 역할, `websocketService` optional 파라미터의 영향 범위를 한 단락으로 정리한 JSDoc을 추가한다.

---

**[WARNING]** `conditionToolCalls` 루프의 `toolCallCount` 처리 비대칭에 주석 없음
- **위치**: `ai-agent.handler.ts` L575 vs L966
- **상세**: single-turn에서 condition tool 루프는 `// Condition tool: send deferral message (does not count toward toolCallCount).`라는 명시적 주석과 함께 카운트를 증가시키지 않는다(L575). 반면 multi-turn 경로(L966)는 동일한 루프에서 `toolCallCount++`를 실행한다. 이 비대칭이 의도적 설계 차이인지, 버그인지 코드만으로 판단할 수 없다.
- **제안**: multi-turn 경로에 카운트를 증가시키는 이유를 한 줄 주석으로 명시하거나, 동일한 의미가 맞다면 single-turn과 동일하게 처리한다.

---

**[WARNING]** `buildMultiTurnFinalOutput` public 메서드 JSDoc 부재
- **위치**: `ai-agent.handler.ts` L1112
- **상세**: `private`이 아닌 public 메서드로, 테스트 파일에서도 직접 호출된다(spec.ts L1228, L1710). 파라미터 `turnDebug`와 `turnDebugHistory`의 차이, `turnDebug`가 `undefined`일 때의 동작 등이 시그니처만으로 명확하지 않다.
- **제안**: 파라미터별 역할과 `turnDebug`(현재 턴 디버그 정보) vs `turnDebugHistory`(누적 이력) 구분을 JSDoc으로 추가한다.

---

**[WARNING]** `buildTools` private 메서드 JSDoc 부재
- **위치**: `ai-agent.handler.ts` L1309
- **상세**: provider tools → normal tools → condition tools의 우선순위 결합, feature-out으로 강제 비어있는 `toolNodeIds`/`toolOverrides` 처리, provider `buildTools` 실패 시 swallow 정책 등 세 가지 비자명한 결정이 있지만 메서드 수준 설명이 없다.
- **제안**: 세 도구 범주의 조합 순서와 feature-out 상태를 JSDoc에 명시한다. (내부 인라인 주석으로 보완해도 무방하나, 현재 `// Provider tools` 한 줄만 있어 부족하다.)

---

**[INFO]** 테스트의 "Stage 5" 참조는 문맥 없이 낡을 주석이 될 수 있음
- **위치**: `ai-agent.handler.spec.ts` L512, L808, L1524
- **상세**: `"Stage 5: single_turn now emits status:'ended'"` 형태의 주석이 3군데 있다. 마이그레이션이 완료된 후에는 "Stage 5"가 무엇인지 알 수 없어 노이즈가 된다.
- **제안**: 마이그레이션 완료 시점에 "현재 기대 동작" 설명으로 교체하거나 제거한다. 예: `// single_turn 은 항상 status:'ended' 를 반환한다 (CONVENTIONS §8)`.

---

**[INFO]** `aiAgentNodeOutputSchema`의 `metadata` 필드명이 실제 `meta`와 불일치
- **위치**: `ai-agent.schema.ts` L411-424
- **상세**: 스키마는 autocomplete 힌트용 `metadata` 키를 정의하지만, 핸들러 출력은 `meta` 키를 사용한다. 사용자가 `$node["X"].output.metadata`로 접근을 시도하면 `undefined`를 얻는다.
- **제안**: CRITICAL 항목 수정과 함께 `metadata` → `meta`로 교정하거나, 이 필드가 실제 autocomplete 경로와 다른 이유를 주석으로 명시한다.

---

**[INFO]** `ConditionDef`, `ConditionClassification` 인터페이스 JSDoc 부재
- **위치**: `ai-agent.handler.ts` L91-102
- **상세**: 두 인터페이스 모두 모듈 내부에서만 사용되고 구조 자체가 직관적이나, `ConditionClassification.matchedCondition`의 "가장 앞에 정의된 조건이 winner" 규칙은 인터페이스만으로 알 수 없다.
- **제안**: `matchedCondition`에 인라인 주석 추가: `/** conditions 배열 인덱스 기준 가장 앞 항목, 호출 없으면 null */`

---

### 요약

세 파일에서 가장 심각한 문제는 `aiAgentNodeOutputSchema`의 JSDoc과 스키마 구조가 CONVENTIONS §8 적용 이후의 실제 핸들러 출력(`output.result.*`, `meta.*`)을 반영하지 못하고 있다는 점이다. 이 스키마는 프론트엔드 표현식 자동완성을 직접 구동하므로, 현 상태로는 사용자가 잘못된 경로(`output.response`, `output.metadata`)를 참조하도록 유도할 수 있다. 핸들러 자체는 복잡한 로직에 한국어/영어 인라인 주석이 충실하게 달려 있고, 특히 RagAccumulator 클래스·feature-out 처리·sanitize 정책 등은 이유 중심 주석이 잘 갖춰져 있다. 테스트 파일도 스킵된 테스트에 복원 조건을 명시한 점이 우수하다. 보완이 필요한 부분은 클래스 레벨 JSDoc 부재, condition toolCallCount 비대칭, 그리고 시간이 지나면 문맥을 잃는 "Stage 5" 스타일 마이그레이션 참조다.

### 위험도

**MEDIUM**