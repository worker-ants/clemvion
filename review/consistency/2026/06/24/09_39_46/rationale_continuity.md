# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상 scope: M-3 3단계 — `persistAssistantTurn` + `makeResumeMeta` + 사용자/assistant 메시지 영속 로직을 무상태 `AssistantTurnPersistenceService`(`tools/assistant-turn-persistence.service.ts`)로 분리. behavior-preserving 백엔드 리팩터.
대상 spec: `spec/3-workflow-editor/4-ai-assistant.md` (경로 수정: prompt 내 `spec/5-system/4-ai-assistant.md` 는 실제 존재하지 않음)

---

## 발견사항

### INFO-1: SSE 순서 불변식 — persistAssistantTurn → auto_resume emit 선행 의무
- **target 위치**: 3단계 구현 착수 시 `WorkflowAssistantStreamService.streamMessage` 내 stall 복구 블록
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale §10 "Stall 자동 복구 UX — 메시지 박스 분리 + `auto_resume` SSE 이벤트"
- **상세**: Rationale 는 stall 복구 블록의 작업 순서를 명시적으로 규정한다 — "(1) 현재까지 누적된 assistant 텍스트를 `auto_resume_pending` 으로 먼저 persist, (2) 커서 리셋, (3) SSE `event: auto_resume` yield, (4) nudge 주입 + continue". `persistAssistantTurn` 을 `AssistantTurnPersistenceService` 로 이동할 때 이 **호출 순서가 stall 블록 내에서 그대로 유지**되어야 한다. 위임 레이어(service call)로 바뀌어도 await 완료 시점이 SSE yield 보다 앞임을 보장해야 함. 이 순서가 바뀌면 프론트엔드가 `auto_resume` 이벤트를 받은 뒤 아직 persist 되지 않은 "중간 row" 를 rehydrate 하려다 not-found 케이스가 발생한다. 현재 target 기술에는 "verbatim 이동" 임을 명시하고 있으나, 이 불변식을 명시적으로 언급하지 않아 구현 중 확인이 필요한 사항이다.
- **제안**: 구현 착수 전 `streamMessage` stall 블록 내 3곳의 `persistAssistantTurn` 호출 모두가 `AssistantTurnPersistenceService` 로 위임된 후에도 `await` 선행이 유지되는지 확인. 신규 spec 항목 추가 불필요 — 현 Rationale §10 의 "(1)→(2)→(3)→(4)" 코드 블록이 이미 SoT. 서비스 파일 상단 주석에 "순서 불변식: persist-before-SSE-emit" 을 명기하면 유지보수 시 인지 부담이 줄어든다.

---

### INFO-2: planPersisted 플래그 — plan 중복 방지 invariant 소유권
- **target 위치**: 3단계 구현 착수 시 `streamMessage` 내 `planPersisted` 로컬 변수 처리
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale §10 "Plan 중복 방지 — 같은 턴 안에 plan 이 최초로 emit 되는 row 에만 plan 을 싣고, 그 뒤로 분리된 row 는 `plan=null` 로 persist. 로컬 `planPersisted` 플래그로 관리."
- **상세**: `planPersisted` 플래그는 `streamMessage` 메서드의 **턴 스코프** 로컬 변수다. `persistAssistantTurn` 에 plan 을 넘기는 호출부가 "이번이 첫 persist 인가" 를 판단해 `plan` 인자를 `null` 로 변환하는 책임을 갖고 있다. 3단계에서 `persistAssistantTurn` 이 `AssistantTurnPersistenceService` 로 이동할 경우, 이 플래그의 평가와 `null` 변환 로직이 `streamMessage` (호출부) 에 잔류해야 하는지, 아니면 서비스로 이동해야 하는지에 대한 명확한 설명이 target 기술에 없다. Rationale 는 "로컬 `planPersisted` 플래그로 관리" 라고 명시해 이 플래그가 호출부 로컬에 있는 것을 설계 의도로 기록한다. 서비스가 이 플래그를 내부화하면 "무상태(stateless)" 서비스 원칙과 충돌한다 (target 기술도 "무상태 AssistantTurnPersistenceService" 라고 명시).
- **제안**: target 기술의 "무상태" 원칙과 일관되게, `planPersisted` 판정과 `plan` → `null` 변환 로직은 `streamMessage` 호출부에 잔류시킨다. `AssistantTurnPersistenceService` 는 plan 을 그대로 받아 DB 에 쓰는 역할만 수행. 구현 완료 후 신규 spec 갱신은 불필요 (Rationale §10 이미 기록).

---

### INFO-3: appendMessage Partial 수용 패턴 — 호출부 변경 최소화 원칙
- **target 위치**: 3단계 구현 착수 시 `WorkflowAssistantSessionService.appendMessage` 호출 경로
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` Rationale §10 "`appendMessage` 의 `Partial<WorkflowAssistantMessage>` 수용 패턴 덕분에 서비스 계층 호출부 변경은 불필요."
- **상세**: Rationale 가 `appendMessage` 의 `Partial<>` 설계를 명시적으로 "호출부 변경 최소화" 원칙으로 기록하고 있다. `AssistantTurnPersistenceService` 가 내부에서 `WorkflowAssistantSessionService.appendMessage` 를 호출하는 구조가 되면, 기존 원칙과 정합 — `persistAssistantTurn` 이 `appendMessage` 를 위임하는 구조가 유지되므로 호출부 최소화 원칙이 서비스 경계만 바뀌면서 보존된다. 다만 `WorkflowAssistantSessionService` 가 `AssistantTurnPersistenceService` 의 생성자 주입 의존성이 되면 서비스 간 순환 참조 위험이 있음 (1단계 AssistantToolRouter 가 `collect-pending-user-config.ts` 에 `NodeComponentRegistry` type-only import 로 런타임 순환 0을 달성한 동일 패턴 참조).
- **제안**: `AssistantTurnPersistenceService` 는 `WorkflowAssistantSessionService` 를 생성자로 주입받고, `streamMessage` 는 `AssistantTurnPersistenceService` 만 주입받는 구조로 방향 단방향 유지. 1·2단계의 `tools/` 위치 패턴과 동일하게 `tools/assistant-turn-persistence.service.ts` 에 배치 (target 기술과 일치). 순환 점검: `AssistantTurnPersistenceService` → `WorkflowAssistantSessionService` 방향만 성립하고, 역방향 의존 없는지 확인.

---

## 요약

M-3 3단계 target(AssistantTurnPersistenceService 분리)은 과거 Rationale 에서 명시적으로 기각된 대안을 채택하거나 합의된 설계 원칙을 직접 위반하는 요소가 없다. "무상태 서비스 + verbatim 이동 + 생성자 주입" 패턴은 1단계(AssistantToolRouter)·2단계(AssistantFinishGuard) Rationale 에서 확립된 M-3 분리 원칙과 일관된다. 다만 `spec/3-workflow-editor/4-ai-assistant.md` Rationale §10 이 기록한 세 가지 불변식(SSE 순서, planPersisted 플래그 소유권, appendMessage Partial 패턴)이 분리 경계에서 조용히 깨질 위험이 있어 구현 착수 전 체크포인트로 명시한다. 기각된 대안의 재도입(CRITICAL)이나 합의 원칙의 직접 위반(WARNING)은 발견되지 않았다.

## 위험도

LOW
