---

### 발견사항

---

#### **[WARNING]** 핵심 tool loop ~130줄 구조 중복 — `executeSingleTurn` / `processMultiTurnMessageInner`
- **위치:** `handler.ts:487–618` (single-turn) / `handler.ts:868–1001` (multi-turn)
- **상세:** "classify → condition-only route → push assistant msg → provider loop → condition stub loop → normal tool loop → LLM 재호출" 흐름이 두 메서드에 거의 동일하게 복사되어 있다. 한 쪽 버그 수정이 다른 쪽에 반영되지 않을 위험이 상시 존재한다.
- **제안:** `runToolLoop(params)` 공통 메서드 추출 (plan 파일 WARN #9 에 이미 추적됨).

---

#### **[WARNING]** `buildConditionOutput` 이 `buildMultiTurnFinalOutput` 본문 80%를 중복
- **위치:** `handler.ts:1158–1212` vs `handler.ts:1103–1153`
- **상세:** `meta` 객체 빌드, `config` 구조, `port`/`status` 필드가 거의 동일하다. `buildConditionOutput`은 `condition` 필드와 다른 `port` 값만 추가된다. 두 메서드를 독립 관리하면 `meta` 필드 추가 시 양쪽 모두 수정해야 한다.
- **제안:** `buildMultiTurnFinalOutput`을 `port`/`condition` 옵션 파라미터를 받도록 확장하거나, 내부 `buildOutputShape()`을 추출해 두 곳에서 공유한다.

---

#### **[WARNING]** `config`/`state` 필드를 모두 `as Type` 캐스팅으로 추출 — 타입 안전성 없음
- **위치:** `handler.ts:403–413` (`executeSingleTurn`), `handler.ts:793–835` (`processMultiTurnMessageInner`)
- **상세:** `const llmConfigId = config.llmConfigId as string | undefined` 패턴이 10개 이상 나열된다. `Record<string, unknown>` 기반이라 오탈자·타입 불일치를 컴파일러가 잡을 수 없다. `processMultiTurnMessageInner`의 `turnConfig` 재조립(lines 829–835)은 state 필드를 수동으로 골라내는 코드로, 필드 누락 가능성이 높다.
- **제안:** `MultiTurnResumeState` interface 명시 정의 (plan 파일 WARN #11 참조). `executeSingleTurn` 파라미터도 `AiAgentConfig` zod 타입을 활용하거나, 검증 후 typed 객체로 변환.

---

#### **[WARNING]** `classifyToolCalls` 내부에서 `condNameToCondition` Map 을 tool loop 매 이터레이션마다 재구성
- **위치:** `handler.ts:1223–1226`, 호출 지점 `handler.ts:488–491`, `handler.ts:869–872`
- **상세:** tool loop 한 회전마다 `new Map` 생성 + `conditions` 배열 순회가 반복된다. conditions 개수와 tool loop 횟수가 곱해져 불필요한 반복이 발생한다.
- **제안:** `runToolLoop` 추출 시 루프 외부에서 Map을 한 번 구성해 전달 (plan 파일 WARN #17 참조).

---

#### **[WARNING]** `conditionToolCalls` 처리 시 `toolCallCount` 증가 정책 비일관
- **위치:** `handler.ts:570–579` (single-turn, 미증가) vs `handler.ts:957–967` (multi-turn, 증가)
- **상세:** 같은 condition tool stub 처리인데 single-turn은 카운트하지 않고 multi-turn은 카운트한다. `maxToolCalls` 제한 동작이 모드에 따라 달라져 사용자가 설정한 한도가 다르게 작동한다.
- **제안:** 정책을 명시적으로 통일 (plan 파일 WARN #20 참조). 어느 쪽이 의도인지 주석이나 테스트로 명시.

---

#### **[INFO]** `sanitizeToolError` 내 매직 넘버 `200` — `TOOL_RESULT_PREVIEW_CHARS`와 동일한 값 중복
- **위치:** `handler.ts:70`
- **상세:** `if (firstLine.length > 200)` 의 `200`은 상단에 정의된 `TOOL_RESULT_PREVIEW_CHARS = 200`와 의미상 다른(에러 메시지 최대 길이) 상수이나 같은 숫자가 재사용된다. 나중에 둘 중 하나만 바꾸면 의도치 않은 동작이 생긴다.
- **제안:** `const MAX_SANITIZED_ERROR_CHARS = 200` 등 별도 상수 선언.

---

#### **[INFO]** 동일 개념 변수명 불일치 — `callStartedAt` vs `callStart`, `loopRequest` vs `loopReq`
- **위치:** `handler.ts:470` vs `handler.ts:854`; `handler.ts:594` vs `handler.ts:981`
- **상세:** `executeSingleTurn`과 `processMultiTurnMessageInner`이 같은 로컬 변수를 다른 이름으로 선언한다. 두 메서드를 나란히 읽을 때 혼동을 유발한다.
- **제안:** `runToolLoop` 추출과 함께 자연스럽게 통일된다.

---

#### **[INFO]** `aiAgentNodeOutputSchema` 에 구형 필드(`conversationConfig`, `metadata`) 잔존
- **위치:** `schema.ts:343–383`
- **상세:** 오토컴플리트용 힌트 스키마에 CONVENTIONS §8 마이그레이션 전 형태의 `conversationConfig`, `metadata` 필드가 남아 있다. 핸들러는 이미 `output.result.*` / `meta.*` 구조로 반환하며, 테스트(`spec.ts:498–499`)도 `conversationConfig`가 실제 출력에 없어야 함을 검증한다. 힌트 스키마가 낡아 프론트엔드 자동완성이 잘못된 경로를 제안할 수 있다.
- **제안:** `aiAgentNodeOutputSchema`를 현행 핸들러 출력(`output.result.response`, `output.result.messages`, `meta.inputTokens` 등)에 맞게 갱신.

---

#### **[INFO]** 테스트 state fixture 반복 구성 — 공통 factory 부재
- **위치:** `spec.ts:587–608`, `638–659`, `694–714`, `730–752` 등
- **상세:** 15–25개 필드의 state 객체가 최소 10회 이상 수동으로 복붙된다. `createResumeState(overrides?)` 헬퍼 함수 하나면 tests 전체 길이를 대폭 줄이고, state shape 변경 시 단일 지점만 수정하면 된다.
- **제안:** `spec.ts` 상단에 `baseResumeState` / `createResumeState` 팩토리 추가.

---

#### **[INFO]** `readSingleTurnMeta` 헬퍼가 파일 하단에 선언, 사용은 상단
- **위치:** `spec.ts:1975–1978` (선언) vs `spec.ts:151` (사용)
- **상세:** 헬퍼를 파일 최하단에 두는 것은 프로젝트의 다른 spec 파일 패턴과 다르다. 파일을 위에서 읽을 때 함수 정의를 찾기 어렵다.
- **제안:** `beforeEach` 블록 직전이나 파일 상단 헬퍼 섹션으로 이동.

---

### 요약

`ai-agent.handler.ts`는 핵심 기능이 잘 분리되고 주석이 충실하며, `RagAccumulatorGroup` 같은 내부 설계도 의도가 명확하다. 다만 `executeSingleTurn`과 `processMultiTurnMessageInner` 사이의 ~130줄 tool loop 중복이 가장 큰 유지보수 리스크다 — 이미 plan 문서에 WARN #9로 추적되고 있으나, 이를 공통 `runToolLoop()`으로 추출하지 않으면 버그 수정·기능 추가 때마다 두 곳을 동기화해야 하는 부담이 지속된다. `buildConditionOutput`의 `buildMultiTurnFinalOutput` 중복, `_resumeState` 암묵 스프레드, `config`의 비타입 추출도 같은 범주의 잠재 오류 지점이며, 도구 연결 재작성 시 일괄 해소할 수 있다. 스키마의 `aiAgentNodeOutputSchema` 는 현행 핸들러 출력 형태와 괴리가 있어 자동완성 오안내를 유발할 수 있으므로 단독 수정도 고려할 만하다.

### 위험도
**MEDIUM**