이제 전체 분석을 바탕으로 리뷰를 작성합니다.

---

## 발견사항

### **[WARNING]** `rawConfig` 얕은 동결(shallow freeze) — nested 객체 mutation 차단 안 됨
- **위치**: `execution-engine.service.ts:2327`, `execution-engine.service.ts:1591`
- **상세**: `Object.freeze({ ...(node.config ?? {}) })`는 **top-level 필드만** immutable로 만든다. `node.config`에 객체나 배열이 중첩된 경우(예: `fields: [...]`, `messages: [...]`) 핸들러가 내부를 변이시켜도 에러가 발생하지 않는다. CONVENTIONS Principle 7 ("mutation 차단")의 의도를 완전히 충족하지 못한다. 스펙(`§5.5`, `§6.1`)이 요구하는 불변 보장은 deep freeze 또는 `structuredClone(node.config)`+freeze 조합으로만 달성된다.
- **제안**: `Object.freeze(structuredClone(node.config ?? {}))` 사용 — 혹은 spec에 "shallow only" 제한을 명시하고 CONVENTIONS 문서를 일치시킬 것.
- **테스트 gap**: `spec.ts`의 동결 테스트(line 1443)는 top-level 필드만 검증하며, 중첩 객체 mutation은 검증하지 않는다.

---

### **[WARNING]** `waitForAiConversation` — `_resumeState`가 없을 때 `buildConversationMetaFromResumeState(undefined)` 런타임 크래시
- **위치**: `execution-engine.service.ts:1583, 1646`
- **상세**: `resumeState = nodeOutput._resumeState as Record<string, unknown>`은 핸들러가 `_resumeState`를 누락한 채 `waiting_for_input`을 반환할 경우 `undefined`가 된다. line 1590에서 `if (resumeState && ...)` 가드가 있지만 line 1646의 `buildConversationMetaFromResumeState(resumeState)` 호출은 동일 가드 없이 `state.totalInputTokens` 접근을 시도해 `TypeError: Cannot read properties of undefined`가 발생한다.
- **제안**: 

```ts
const resumeState = (nodeOutput._resumeState as Record<string, unknown>) ?? {};
```
또는 `buildConversationMetaFromResumeState`의 파라미터 타입을 `Record<string, unknown> | undefined`로 변경하고 내부에서 방어적으로 처리.
- **테스트 gap**: spec.ts에 `_resumeState` 없는 `waiting_for_input` 시나리오 테스트 없음.

---

### **[WARNING]** `executeInline` — `execution === null` 시 블로킹 노드(Form/Button/AI) 무음 스킵
- **위치**: `execution-engine.service.ts:705`
- **상세**: `const execution = await this.executionRepository.findOneBy({ id: executionId })` 결과가 `null`이면 `if (execution)` 블록 전체가 실행되지 않아 Form/Button/AI 노드의 `waitForFormSubmission` / `waitForButtonInteraction` / `waitForAiConversation`이 호출되지 않는다. 서브 워크플로우 내 대화형 노드가 사용자 입력 없이 그냥 통과된다. 실행 레코드 조회 실패는 드물지만 경쟁 조건, 롤백, 테스트 환경에서 발생 가능하다.
- **제안**: `execution`이 null이면 로그 경고가 아닌 명시적 에러를 throw하거나, 블로킹 노드 감지 시 별도로 guard를 추가할 것.
- **테스트 gap**: spec.ts에 해당 경로 테스트 없음.

---

### **[WARNING]** `NodeHandler.execute` 반환 타입 `Promise<NodeHandlerOutput> | Promise<unknown>` — 컴파일 타임 보장 없음
- **위치**: `node-handler.interface.ts:119-123`
- **상세**: `Promise<NodeHandlerOutput> | Promise<unknown>`은 사실상 `Promise<unknown>`과 동일하다. 핸들러가 `config`/`output` 필드 없이 임의 객체를 반환해도 컴파일 에러가 없다. `adaptHandlerReturn`이 런타임 정규화를 담당하지만, 인터페이스 자체가 계약을 강제하지 못해 실수가 테스트에서만 발견된다.
- **제안**: `execute(...): Promise<NodeHandlerOutput>` 단일 타입으로 변경하고, `adaptHandlerReturn`은 레거시 핸들러 호환용 내부 변환 레이어로만 사용. 신규 핸들러 계약을 인터페이스 수준에서 강제.

---

### **[INFO]** `recoverStuckExecutions` — `RUNNING` 상태 체류 실행 미처리
- **위치**: `execution-engine.service.ts:338-360`
- **상세**: 서버 재시작 시 `WAITING_FOR_INPUT` 상태만 `FAILED`로 복구한다. 서버 크래시로 `RUNNING` 상태에 묶인 실행은 무한정 `RUNNING`으로 남는다. 요구사항에 명시적으로 처리 범위가 `WAITING_FOR_INPUT`으로 한정되어 있다면 정상이나, 스펙 문서 확인이 필요하다.
- **제안**: 정책 결정 사항 — `RUNNING` 복구도 같은 방식으로 처리하거나, 스펙에 제외 이유를 명시.

---

### **[INFO]** spec.ts 테스트명 오해 — `"still populates rawConfig when nodeMap is empty"`
- **위치**: `execution-engine.service.spec.ts:1467`
- **상세**: 테스트 제목은 "nodeMap이 비어있을 때"라고 하지만 실제 `executeNode` 내 `nodeMap`은 항상 채워져 있다(`runExecution`에서 노드 배열로 생성). 테스트가 실제로 검증하는 것은 "expression placeholder가 없는 literal config도 rawConfig가 주입된다"는 것이다. 오해를 주는 제목은 나중에 유지보수자가 잘못 판단할 수 있다.
- **제안**: 테스트 이름을 `"still populates rawConfig when config has no expression placeholders"`로 변경.

---

### **[INFO]** `executeInline` — `manual_trigger` 외 트리거 타입(webhook/schedule) 미처리
- **위치**: `execution-engine.service.ts:614`
- **상세**: 서브 워크플로우 내에서 `manual_trigger`만 pass-through 처리하고, `webhook_trigger`·`schedule_trigger` 등은 일반 노드처럼 실행된다. 서브 워크플로우에 다른 트리거 타입이 포함될 경우 의도치 않은 부수 효과(웹훅 등록, 스케줄 활성화)가 발생할 수 있다.
- **제안**: `NodeCategory.TRIGGER` 카테고리를 기준으로 모든 트리거를 pass-through 처리하거나, 지원 트리거 타입을 spec에 명시.

---

### **[INFO]** `buildAiMessageDebugFromResumeState` 얕은 복사 — 개별 call 객체 mutation 미보호
- **위치**: `execution-engine.service.ts:206`
- **상세**: `result.llmCalls = [...lastTurnDebug.llmCalls]`는 배열을 shallow copy하지만 각 `LlmCallRecord` 객체는 참조를 공유한다. 이후 turn에서 `resumeState` 내의 동일 객체가 변이되면 이미 emit된 이벤트 페이로드의 내용도 변경될 수 있다(JavaScript 객체 참조 특성). 주석이 의도를 설명하고 있으나 보호가 불완전하다.
- **제안**: `result.llmCalls = lastTurnDebug.llmCalls.map(c => ({ ...c }))` 또는 `structuredClone`.

---

## 요약

핵심 기능(rawConfig 노출, 멀티-턴 AI 대화, 서브 워크플로우 인라인 실행, 취소/재개)은 전반적으로 구현되어 있으며 테스트 커버리지도 주요 경로를 잘 다루고 있다. 그러나 세 가지 요구사항 위험이 존재한다: (1) `rawConfig`의 얕은 동결은 CONVENTIONS Principle 7의 mutation 차단을 중첩 객체에서 보장하지 못하고, (2) `_resumeState`가 없는 `waiting_for_input` 응답 시 `buildConversationMetaFromResumeState(undefined)` 호출로 런타임 크래시가 발생하며, (3) `executeInline`에서 실행 레코드가 null이면 블로킹 노드가 무음으로 통과된다. `NodeHandler.execute`의 반환 타입이 `Promise<unknown>`과 동치여서 인터페이스 계약이 컴파일 타임에 강제되지 않는 점도 신규 핸들러 작성 시 실수의 온상이 된다.

## 위험도

**MEDIUM**