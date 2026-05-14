## 발견사항

---

### **[WARNING]** Presentation 계층 테스트가 Execution Engine 모듈에 직접 의존
- **위치**: `buttons.spec.ts`, `chart.handler.spec.ts`, `form.handler.spec.ts` 등 8개 파일
- **상세**: 프레젠테이션 노드 테스트(`presentation/chart`, `presentation/table`, `presentation/template`, `trigger/manual-trigger`)가 `../../../modules/execution-engine/conversation-thread/conversation-thread.types`를 직접 import한다. 레이어 방향상 presentation → execution-engine 방향의 직접 의존이 생기며, `ExecutionContext` 인터페이스가 변경될 때마다 프레젠테이션 계층 테스트 전체가 영향을 받는다.
- **제안**: `ExecutionContext` 테스트 픽스처를 만드는 헬퍼(`createTestContext()`)를 `node-handler.interface` 또는 별도 `test-helpers` 레이어에 두고, 모든 핸들러 테스트가 그 헬퍼를 통해 context를 얻도록 통일한다. 이렇게 하면 `conversationThread` 같은 필드 추가 시 한 곳만 수정하면 된다.

---

### **[WARNING]** Mutable Array의 Shallow Copy — 격리 불변량 취약
- **위치**: `spec/5-system/4-execution-engine.md` §3.3 Background, §6.2
- **상세**: 스펙은 Background 격리를 위해 "conversationThread snapshot — `{ ...thread, turns: [...thread.turns] }` 형태로 turns 배열까지 새 인스턴스로 복사"라고 명시하여 consistency checker가 지적한 문제를 스펙 수준에서 수정하였다. 그러나 `ConversationTurn` 객체 내부에 중첩 객체(`data` 필드 등)가 있을 경우 1단계 shallow copy만으로는 완전한 격리를 보장하지 못한다. ND-BG-05 "백그라운드 실패가 메인 흐름 상태에 영향 없음" invariant는 turn 내부 nested object까지 deep copy되어야 완전히 성립한다.
- **제안**: `ConversationTurn`이 순수 값(primitive fields만 포함)인지 타입 정의에서 명시적으로 보장하거나, `ConversationThreadService`의 snapshot 메서드에서 `structuredClone(thread)`를 사용하여 deep copy를 강제한다.

---

### **[INFO]** `ExecutionContext`의 인터페이스 확장 — ISP 준수 여부
- **위치**: `ExecutionContext` 인터페이스, 모든 핸들러 테스트
- **상세**: `conversationThread`를 `ExecutionContext`에 추가하면 conversation에 무관한 핸들러(예: HTTP, DB, Code 노드)도 전체 context를 수신한다. 이는 인터페이스 분리 원칙(ISP)과 긴장 관계에 있다. 현재 구조에서는 opt-out(`excludeFromConversationThread: false` 기본값)이므로 핸들러가 직접 사용하지 않아도 되지만, 핸들러 계약상 "사용하지 않는 필드를 포함한 컨텍스트"가 전달된다.
- **제안**: 현재 단일 `ExecutionContext` 설계는 단순성 측면에서 실용적으로 수용 가능하다. 다만 핸들러 인터페이스 문서에 "핸들러는 `conversationThread`를 직접 mutate하지 않으며, hook 레이어(`ConversationThreadService`)가 단일 mutation 진입점"임을 명시하여 계약을 문서화한다.

---

### **[INFO]** 분산 SoT(Source of Truth) 패턴의 재구성 복잡도
- **위치**: `spec/5-system/4-execution-engine.md` §6.2, `spec/conventions/conversation-thread.md` §4
- **상세**: v1은 별도 DB 컬럼 없이 `NodeExecution.outputData`(`output.interaction`, `output.messages`, `output.result.response`)를 분산 SoT로 사용하고 실행 후 재구성한다. 이 패턴은 신규 DB 컬럼을 피한다는 장점이 있지만, 재구성 로직이 NodeExecution 레코드 쿼리 순서, waiting/resumed 상태 매핑, AI 노드의 messages 배열 병합 등 여러 복잡한 단계를 거친다. 재구성 로직과 실시간 in-memory thread가 동기화되지 않으면 실행 이력 뷰와 라이브 뷰가 불일치할 수 있다.
- **제안**: 재구성 로직을 `ConversationThreadService.reconstruct(executionId)` 단일 메서드로 캡슐화하고, 이 메서드가 단일 쿼리로 모든 NodeExecution 레코드를 가져와 순서대로 재현하는 방식으로 구현 책임을 명확히 한다.

---

### **[INFO]** `DEFAULT_THREAD_ID = 'default'` — 포트 예약어와 동일 값
- **위치**: `spec/conventions/conversation-thread.md` §1.3
- **상세**: Thread ID `"default"`가 `node-output.md` Principle 6의 포트 예약어 목록에도 존재한다. 런타임 namespace는 분리되어 있으나, 표현식 엔진이 `$thread.id`와 포트 참조를 같은 컨텍스트에서 평가할 때 오독 가능성이 있다. 스펙에 주의 문구가 있지만 아키텍처적으로 근본 해소가 더 안전하다.
- **제안**: Thread ID를 `"primary"`로 변경하는 방안을 v2 전환 시 검토. v1에서는 `DEFAULT_THREAD_ID` 상수 추출을 mandatory로 명시하여 리터럴 `'default'` 직접 비교를 코드베이스에서 금지한다.

---

## 요약

이번 변경의 핵심 아키텍처 결정인 `ConversationThread`의 `ExecutionContext` 1급 필드화, `ConversationThreadService` 단일 mutation 게이트웨이, Background 격리를 위한 snapshot 패턴은 전반적으로 올바른 방향이다. 다중 consistency check 세션을 통해 CRITICAL 위배(output.meta 경로 오기, v1 스코프 불일치)를 사전에 제거한 점도 긍정적이다. 다만 **프레젠테이션 계층 테스트가 execution-engine 모듈을 직접 import하는 계층 간 결합**이 가장 주목할 아키텍처 문제로, 테스트 헬퍼 추상화로 해소해야 한다. 이 외에 분산 SoT 재구성 복잡도와 Background shallow copy의 완전성 보장도 구현 착수 전 확인이 권장된다.

## 위험도

**LOW** — 핵심 설계는 건전하고 Critical 위배 없음. 계층 간 결합(테스트 헬퍼 추상화)과 Background snapshot 완전성 확인이 구현 착수 전 처리 권장 사항.