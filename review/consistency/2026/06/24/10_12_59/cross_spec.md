# Cross-Spec 일관성 검토 결과

검토 대상: M-3 3단계 — `AssistantTurnPersistenceService` 분리 완료
검토 기준: diff-base=origin/main, 대상 spec=`spec/3-workflow-editor/4-ai-assistant.md`
검토 모드: --impl-done (behavior-preserving, spec 무변경)

---

## 발견사항

이번 변경은 순수 구조적 리팩토링(메서드 이동 + 생성자 주입)이다. 비즈니스 로직·엔티티 필드·API 계약·상태 전이 등 어떤 스펙 약속도 변경하지 않는다. 아래 분석은 6가지 검토 관점 각각에 대해 기술한다.

### 발견사항 1

- **[INFO]** spec 의 `stream.service` 코드 snippet 이 메서드 소유자를 암묵적으로 지칭
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §7 stall 복구 블록 (line 1290–1308)
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §7 내 `await this.persistAssistantTurn(...)` 코드 예시, line 1293
  - 상세: spec 예시 코드가 `this.persistAssistantTurn(...)` 형태로 `WorkflowAssistantStreamService` 의 private 메서드인 것처럼 기술하고 있다. 실제 구현에서는 `this.turnPersistence.persistAssistantTurn(...)` 으로 호출 경로가 바뀌었다. behavior 는 동일하고 spec 은 "stream.service 변경" 의 의미론적 설명을 하는 것이므로 기능 모순은 아니다. 단, 향후 개발자가 spec 예시를 보고 `streamMessage` 내부에 동일 메서드가 있다고 오해할 가능성이 있다.
  - 제안: spec 동기화 선택 사항 (behavior-preserving 리팩토링이므로 즉시 필수 아님). 다음 spec 수정 시 코드 예시를 `this.turnPersistence.persistAssistantTurn(...)` 로 교체하거나, `(M-3 3단계 이후 위임됨)` 주석을 달아 혼동 방지.

### 발견사항 2

- **[INFO]** `spec/data-flow/7-llm-usage.md` 의 행위자 표기가 클래스 이름을 직접 참조
  - target 위치: 해당 없음 (spec 무변경)
  - 충돌 대상: `spec/data-flow/7-llm-usage.md` line 108 — `WorkflowAssistantStreamService (workflow-assistant-stream.service.ts)` 가 `persistAssistantTurn → appendMessage.usage` 흐름의 소유자로 기술됨
  - 상세: M-3 3단계 이후 usage persist 는 `AssistantTurnPersistenceService.persistAssistantTurn` 을 경유한다. data-flow spec 의 표에서 행위자를 `WorkflowAssistantStreamService` 로 명시하고 있으나, 위임 경로(`turnPersistence.persistAssistantTurn → appendMessage.usage`)는 최종 동작이 동일하므로 기능 모순은 없다. 파일명 참조(`workflow-assistant-stream.service.ts`)는 여전히 유효한 진입점이다.
  - 제안: spec 동기화 선택 사항. 정확성을 높이려면 행위자 셀을 `WorkflowAssistantStreamService → AssistantTurnPersistenceService` 위임 형태로 표기하거나 파일명을 추가하는 것이 좋다.

---

## 6가지 관점별 요약

1. **데이터 모델 충돌** — 없음. `WorkflowAssistantMessage` 엔티티 필드(`autoResumed`, `autoResumeReason`, `autoResumeAttempt`, `usage`, `finishReason` 등)는 변경 없이 동일하게 persist 된다. `UsageSnapshot` / `ResumeMeta` 인터페이스는 기존 private 메서드의 인라인 타입을 명명된 export 로 격상한 것으로, spec 엔티티 정의와 1:1 대응한다.

2. **API 계약 충돌** — 없음. HTTP endpoint · SSE 이벤트 · request/response shape 변경 없음.

3. **요구사항 ID 충돌** — 없음. 신규 요구사항 ID 부여 없음.

4. **상태 전이 충돌** — 없음. stall 복구 흐름(`auto_resume_pending` → 최종 row `autoResumed=true`)의 상태 전이가 spec §7 과 완전히 일치한다. `makeResumeMeta` 헬퍼는 logic 그대로 공유 import 로 이동됐다.

5. **권한·RBAC 모델 충돌** — 없음. 신규 서비스는 기존 RBAC guard 를 우회하지 않는다. NestJS `@Injectable()` 모듈 프로바이더 추가로 기존 DI 컨테이너에 등록되었을 뿐이다.

6. **계층 책임 충돌** — 없음. `AssistantTurnPersistenceService` 는 `workflow-assistant/tools/` 하위에 위치하며, M-3 1단계(`AssistantToolRouter`) · 2단계(`AssistantFinishGuard`)와 동일한 collaborator 분리 패턴을 따른다. 스트림 상태(`assistantText`, `pendingToolCalls`, stall counter)는 `streamMessage` 가 계속 소유하고, persist 책임만 이동했으므로 계층 책임이 명확해진 방향이다.

---

## 요약

M-3 3단계는 `WorkflowAssistantStreamService` 의 영속 책임을 `AssistantTurnPersistenceService` 로 이동하는 behavior-preserving 리팩토링이다. spec 을 변경하지 않았으며, 6가지 Cross-Spec 검토 관점 어디서도 기능 모순이 발견되지 않는다. 유일한 관찰 사항은 두 spec 문서(`4-ai-assistant.md` §7 코드 예시, `data-flow/7-llm-usage.md` 행위자 표기)가 리팩토링 이전의 클래스 소유 구조를 암묵적으로 가리키고 있다는 점이나, 이는 동작 모순이 아닌 표기 정확도 문제로 INFO 등급이다.

---

## 위험도

NONE
