# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
대상: `03-maintainability C-2 (1차 슬라이스)` — `ai-turn-executor.ts` 의 `executeSingleTurn` god-method 를 spec §6.1 단계에 정렬한 private 메서드로 behavior-preserving 분해

---

## 발견사항

### 발견사항 없음 (NONE)

이번 구현 범위는 `ai-turn-executor.ts` 의 `executeSingleTurn` 메서드를 spec `1-ai-agent.md §6.1` 의 기술된 단계(1→1.3→1.5→2→2.5→2.7→3 시퀀스)에 정렬해 private 메서드로 추출하는 **behavior-preserving 내부 분해**다. 아래 6개 관점을 전수 점검했으며 충돌·중복 정의는 발견되지 않았다.

#### 1. 데이터 모델 충돌

target 이 신규 엔티티·필드를 정의하지 않는다. 분리되는 메서드들이 운반하는 자료구조(`_resumeState`, `ConversationThread`, `AgentMemory` 주입 블록, `turnDebug` accumulator 등)는 모두 기존 spec 정의(`1-ai-agent.md §7.4`, `spec/conventions/conversation-thread.md`, `spec/5-system/17-agent-memory.md`)를 그대로 사용한다. 모델 레이어 변경 없음.

#### 2. API 계약 충돌

endpoint·HTTP method·request/response shape 변경 없음. 추출 대상은 내부 private 메서드뿐이며, 외부에 노출되는 `AiTurnExecutor` 의 public interface(`executeSingleTurn`, `executeMultiTurn`, `processMultiTurnMessage`)는 시그니처·행위 모두 불변이다.

#### 3. 요구사항 ID 충돌

target 은 요구사항 ID 를 신규 부여하지 않는다. 각 추출 메서드의 docstring 에 spec §6.1 단계 번호(`// §6.1 단계 1`, `// §6.1 단계 2` 등)를 명기하는 것은 기존 ID 의 참조이지 재정의가 아니다.

#### 4. 상태 전이 충돌

`executeSingleTurn` 이 구사하는 상태 전이 —
- tool-loop 내 `waiting_for_input` park (§6.1.d.ii `render_form`)
- `_resumeState.pendingFormToolCall` set/clear
- turn push ordering(`ai_assistant` 응답 직후, `ai_user` LLM 호출 전)

— 는 모두 분해 후에도 동일 순서로 실행되어야 한다. 이는 spec 이 명시한 행위 규칙(`§6.1 단계 2.5 "LLM 응답 직후"`, `§6.2 step 2.c`)이며, 추출 private 메서드가 해당 ordering 을 보존하면 모순이 없다. 분해 자체가 순서를 바꾸지 않는 이상 상태 전이 충돌 없음.

#### 5. 권한·RBAC 모델 충돌

RBAC 관련 변경 없음. `executeSingleTurn` 은 워크스페이스 권한 검증 이후 호출되는 실행 레이어 메서드로, RBAC boundary 바깥이다.

#### 6. 계층 책임 충돌

`spec/4-nodes/3-ai/1-ai-agent.md §6` 는 구현 레이어를 명시한다:

- `AiAgentHandler` = facade
- `AiTurnExecutor` = turn 실행 루프 (`executeSingleTurn` / `executeMultiTurn` / `processMultiTurnMessage`)
- `AiConditionEvaluator` = 조건 분류 (§6.1 단계 3.a)
- `AiMemoryManager` = 자동 메모리 전략 (§6.1 단계 1.3/1.5/2.7)

이번 1차 슬라이스는 `AiTurnExecutor` **내부**의 `executeSingleTurn` 메서드를 private 헬퍼들로 분해한다. spec 이 명시한 4-클래스 책임 분할 경계를 전혀 변경하지 않으므로 계층 책임 충돌 없음.

---

### [INFO] §6.1 / §6.2 단계 번호 혼용 방지

- target 위치: 추출될 private 메서드 JSDoc
- 충돌 대상: 없음 (사전 주의 사항)
- 상세: 분해 후 private 메서드 docstring 에 명기하는 단계 번호 참조 대상은 `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 이다. 동 문서 `§6.2` 는 이번 1차 슬라이스 대상이 아니며 2차 PR(`processMultiTurnMessage` 분해) 대상으로 명시되어 있다. doc 작성 시 `§6.1` 과 `§6.2` 단계 번호가 혼입되지 않도록 구분해 참조해야 한다.
- 제안: 각 private 메서드 JSDoc 에 `// spec: §6.1 단계 N` 형식으로 명기하고, §6.2 단계는 2차 PR 에서 추가

---

## 요약

이번 C-2 1차 슬라이스는 `ai-turn-executor.ts` 의 `executeSingleTurn` 메서드(~545줄) 를 spec `§6.1` 단계 순서에 정렬한 private 헬퍼들로 추출하는 순수 behavior-preserving 리팩토링이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 6개 관점 모두에서 기존 spec 과의 충돌이 발견되지 않았다. 신규 엔티티·필드·엔드포인트를 도입하지 않고, 외부 public interface 시그니처·행위·`_resumeState` 운반·checkpoint 호환을 불변으로 유지하는 한 cross-spec 일관성 위험은 NONE 이다. spec 갱신도 불요하다(`plan/in-progress/refactor/03-maintainability.md` C-2 항목의 "spec 갱신: 불요" 판정과 일치).

---

## 위험도

NONE
