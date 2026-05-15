## 발견사항

---

### **[CRITICAL] ExecutionContext 인터페이스 파괴적 변경 — 기존 컨텍스트 생성 코드 전반 영향**

- **위치**: 테스트 파일 8개 전체 — `conversationThread` 필드 추가
- **상세**: `ExecutionContext` 인터페이스에 `conversationThread` 필드가 추가되었다. 테스트 파일들이 이 필드를 채우기 위해 일제히 수정된 것은 인터페이스가 **required 필드**로 추가되었음을 의미한다. 리뷰 대상 8개 파일 외에도 이 인터페이스를 직접 구현하거나 mock하는 코드가 존재한다면 — 특히 `backend/` 전체에 걸쳐 `ExecutionContext` 를 생성하는 모든 지점 — TypeScript 컴파일 오류 또는 런타임 `undefined` 접근 부작용이 발생한다.
- **제안**: `grep -r "ExecutionContext" backend/src --include="*.ts" | grep -v "spec"` 로 handler 이외 생성 지점 전수 확인. `conversationThread` 필드를 optional (`conversationThread?`) 로 선언하거나, 모든 생성 지점에 `createEmptyConversationThread()` 초기화를 일괄 추가해야 한다.

---

### **[HIGH] 모듈 레벨 공유 `context` — 테스트 간 상태 오염 위험**

- **위치**: `buttons.spec.ts` 3개 파일 (파일 1, 4, 6): `chart/buttons.spec.ts`, `table/buttons.spec.ts`, `template/buttons.spec.ts`
- **상세**: 이 파일들은 `context`를 `describe` 블록 바깥 모듈 레벨에서 **단일 객체로 선언**한다. `conversationThread`가 `ConversationThreadService.append*` 호출로 turns 배열이 변형되는 mutable 객체라면, 첫 번째 테스트에서 발생한 turn push가 이후 테스트에 누적된 채 실행된다. `chart.handler.spec.ts`, `form.handler.spec.ts` 등은 `beforeEach`에서 재생성하므로 안전하나, `buttons.spec.ts` 계열은 공유 인스턴스를 그대로 사용한다.
- **제안**: `buttons.spec.ts` 3개 파일도 `beforeEach(() => { context = { ..., conversationThread: createEmptyConversationThread() }; })` 패턴으로 변경하거나, `createEmptyConversationThread()`가 매번 새 배열 참조를 반환하는 pure factory임을 코드로 확인해야 한다.

---

### **[HIGH] Background shallow copy 격리 불변량 미달 위험 — 런타임 상태 오염**

- **위치**: `spec/5-system/4-execution-engine.md` §3.3 변경 — `conversationThread snapshot` 설명
- **상세**: spec은 background 격리를 "`{ ...thread, turns: [...thread.turns] }` 형태로 turns 배열까지 새 인스턴스로 복사"라고 명시하고 있으나, `ConversationTurn` 객체 내부(`data`, `metadata` 등 중첩 필드)는 여전히 원본 참조를 공유한다. background 핸들러가 `turn.data.someField` 같은 내부 필드를 mutate하면 main thread의 동일 turn 객체도 변형된다. consistency checker도 이를 지적(rationale_continuity WARNING)했으나 spec이 이 한계를 명시하지 않은 채 "격리 보장"으로 기술한다.
- **제안**: spec §3.3에 "ConversationTurn 객체 자체의 내부 필드는 shallow ref — 핸들러는 turn 내부를 mutate하지 않는다 (immutable turn 불변량)" 명시 또는 `JSON.parse(JSON.stringify(thread))` 수준의 deep copy로 격상.

---

### **[WARNING] `interaction_data.interactionType` 값 변경 — DB 기존 row 파괴적 변경**

- **위치**: `spec/1-data-model.md` — `"form_submit"` → `"form_submitted"` 정정
- **상세**: spec 문서 레벨에서 enum 값을 정정했지만, 이미 PostgreSQL `NodeExecution.interaction_data` JSONB 컬럼에 `"form_submit"` 값으로 저장된 기존 row들이 존재할 수 있다. 코드가 `form_submitted`를 기준으로 조회하면 기존 row가 누락된다. 실행 이력 화면, ConversationThread 재구성 로직 모두 영향을 받는다.
- **제안**: 구현 착수 전 `SELECT COUNT(*) FROM node_execution WHERE interaction_data->>'interactionType' = 'form_submit'`로 기존 row 존재 여부 확인. 기존 row가 있다면 마이그레이션 스크립트 필수. consistency checker plan_coherence 리뷰(파일 24)도 이를 INFO로 지적했으나 처리 계획이 없다.

---

### **[WARNING] `createEmptyConversationThread()` 반환 객체의 mutable 배열 공유 위험**

- **위치**: `conversation-thread.types.ts` 내 함수 (리뷰 범위 외이나 8개 파일 모두에서 호출)
- **상세**: 팩토리 함수가 `{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }` 처럼 매번 새 객체를 반환하면 안전하다. 그러나 구현이 `const EMPTY = { turns: [] }; return EMPTY;` 처럼 상수 참조를 반환하면, 어느 한 테스트의 push 연산이 전체 테스트 스위트의 `turns` 배열을 오염시킨다.
- **제안**: `conversation-thread.types.ts` 에서 해당 함수 구현 확인. 반드시 `turns: []` 를 매 호출마다 새 배열 리터럴로 반환해야 한다.

---

### **[INFO] `$thread` 표현식 변수 — 사용자 정의 변수 잠재 충돌**

- **위치**: `spec/5-system/5-expression-language.md` §4.1 `$thread` 추가
- **상세**: 기존 워크플로우 중 `$thread`를 변수명으로 사용한 경우는 없겠지만, 표현식 파서가 `$thread`를 예약어로 먼저 처리하면 같은 이름의 커스텀 변수는 shadowing된다. v1에서 `$loop`, `$item` 등도 동일 방식이므로 일관성은 있으나, 기존 실행 중인 워크플로우에서 `variables.__thread` 또는 유사한 이름이 있다면 표현식 평가 결과가 달라질 수 있다.
- **제안**: 표현식 엔진이 `$thread`를 컨텍스트 변수보다 먼저 resolve하는지, 또는 명시 구분 규칙이 있는지 확인.

---

## 요약

이번 변경의 핵심 부작용 위험은 두 가지 레이어에 집중된다. **코드 레이어**: `ExecutionContext` 인터페이스에 required 필드가 추가되어 테스트 외 모든 컨텍스트 생성 지점이 영향을 받으며, `buttons.spec.ts` 계열의 모듈 레벨 공유 context 객체가 mutable `conversationThread`를 담을 경우 테스트 간 상태 오염이 발생할 수 있다. **데이터 레이어**: `interaction_data.interactionType` 값 변경(`form_submit` → `form_submitted`)은 기존 DB row와의 비호환을 야기하며 마이그레이션 계획이 부재하다. Background thread isolation의 "shallow copy" 명세는 `ConversationTurn` 내부 필드의 shared reference를 허용하여 격리 불변량(ND-BG-05)을 완전히 충족하지 못한다.

## 위험도

**HIGH**