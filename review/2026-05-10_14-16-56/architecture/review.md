### 발견사항

---

**[WARNING]** `durationMs` 책임 분리 불일치 (성공 경로 vs 에러 경로)
- 위치: `text-classifier.handler.ts:130–163` (에러 경로), `processSingleLabelResult` / `processMultiLabelResult` (성공 경로 meta 구성)
- 상세: 성공 경로의 `meta.durationMs`는 스펙 §5.1 테이블 주석(`engine inject`)에 따라 엔진이 주입하고, 핸들러 반환 meta에는 없다. 에러 경로는 핸들러가 직접 `errorDurationMs = Date.now() - callStartedAt`을 계산해 주입한다. 이는 동일 필드에 대한 책임이 경로별로 엔진/핸들러로 분열됨을 의미한다. 엔진이 에러 경로에도 `durationMs`를 오버라이트하면 이중 할당, 오버라이트하지 않으면 성공/에러 경로의 `durationMs` 출처와 시맨틱이 달라지는 문제가 생긴다.
- 제안: `durationMs`를 핸들러 측에서 모든 경로에 일관되게 제공하거나, 엔진이 모든 경로에 균일하게 주입하는 쪽으로 단일 책임을 확정한다. 현재처럼 경로별로 책임자가 다른 구조는 향후 엔진 동작 변경 시 묵시적 회귀를 유발한다.

---

**[WARNING]** `meta.durationMs`와 `meta.llmCalls[0].durationMs`의 의미 중복
- 위치: `text-classifier.handler.ts:144–162` 에러 반환 블록
- 상세: 에러 경로에서 `meta.durationMs`와 `meta.llmCalls[0].durationMs`는 동일한 `errorDurationMs` 값을 공유한다. 단일 LLM 호출만 있는 현재 구조에서는 중복이다. 만약 재시도 로직이 추가되면 두 필드의 시맨틱이 분리(전체 소요 시간 vs 개별 호출 시간)될 것이나, 현재는 같은 값을 두 경로에 배치해 소비자를 혼란스럽게 할 수 있다.
- 제안: `meta.durationMs`는 핸들러 전체 실행 시간으로, `llmCalls[i].durationMs`는 개별 호출 시간으로 명확히 시맨틱을 분리하고 주석 또는 스펙으로 명시한다.

---

**[WARNING]** 에러/성공 meta 형상 비대칭 — 다운스트림 expression 안정성 저하
- 위치: `text-classifier.handler.ts` 전체 meta 구성, 스펙 §5.1~§5.3
- 상세: 성공 meta: `{ model, inputTokens, outputTokens, totalTokens, thinkingTokens, llmCalls }`. 에러 meta: `{ durationMs, model, llmCalls }`. 토큰 카운트 필드군이 에러 경로에 없고 `durationMs`가 성공 경로 핸들러 반환에 없다. 다운스트림 표현식(`$node[X].meta.inputTokens`)이 포트를 구분하지 않고 `meta.*`를 참조하면 에러 포트에서 `undefined`가 된다. CONVENTIONS Principle 2가 "모든 케이스에서 `meta.durationMs` 보장"을 요구함에도 성공 핸들러 반환 meta에 `durationMs`가 없다.
- 제안: 성공 경로 핸들러도 `durationMs`를 반환하거나, 에러 경로에도 토큰 카운트 0-값 기본값을 채워 meta 형상을 통일한다. 최소한 스펙 §5.1과 §5.3 테이블에 각 경로의 필드 유무를 명시해 다운스트림 소비자가 조건부로 접근해야 함을 알 수 있게 한다.

---

**[INFO]** `_llmCalls` → `meta.llmCalls` 이동 — 레이어 책임 개선
- 위치: `text-classifier.handler.ts` diff `output._llmCalls` 제거, `meta.llmCalls` 추가
- 상세: 운영 메트릭/디버그 트레이스가 도메인 출력(`output`)이 아닌 실행 메트릭(`meta`)에 배치되는 것은 레이어 책임 분리 관점에서 올바른 방향이다. 이 변경은 아키텍처적으로 긍정적이다.

---

**[INFO]** 테스트의 타입 회피 패턴(`as unknown as Record<string, unknown>`, `void _omit`)
- 위치: `text-classifier.handler.spec.ts:310–350`
- 상세: `NodeHandlerOutput`의 meta/output 타입이 `unknown`이어서 테스트에서 광범위한 캐스팅이 필요하다. `void _omit`은 린터 경고를 억제하기 위한 관용구이지만, 가독성을 저해한다. 아키텍처 문제라기보다 타입 설계의 세밀도 부족으로 볼 수 있다.
- 제안: `NodeHandlerOutput` 또는 핸들러별 반환 타입에 `meta`에 대한 구체적인 형상 타입을 부여해 테스트에서 캐스팅 없이 검증 가능하게 한다. `void _omit` 대신 `const { model: _, ...configWithoutModel }` 패턴을 사용하거나 `Omit<>` 타입을 활용한다.

---

### 요약

이번 변경의 핵심 의도(에러 경로에서 `meta.{durationMs, model, llmCalls}` 보장)는 CONVENTIONS Principle 2 준수를 위한 올바른 방향이며, `_llmCalls`를 `output`에서 `meta`로 이동한 것도 레이어 책임 분리 측면에서 개선이다. 그러나 `durationMs`를 누가 책임지는지(핸들러 vs 엔진)가 성공/에러 경로 간에 분열되어 있고, 에러/성공 meta의 필드 형상이 비대칭인 점이 미해결 구조적 문제로 남는다. 특히 엔진이 에러 경로에서 `durationMs`를 오버라이트하는지 여부가 코드 검색 없이 확인되지 않는 상황에서, 이 비대칭은 향후 엔진 동작 변경 시 묵시적 회귀를 유발할 수 있다. 단일 책임 원칙 관점에서 `durationMs` 책임자를 엔진 또는 핸들러 중 하나로 통일하고, meta 형상을 모든 경로에서 일관되게 유지하는 설계 결정이 필요하다.

### 위험도

**LOW**