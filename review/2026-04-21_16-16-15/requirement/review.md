코드를 분석하겠습니다.

---

## 발견사항

### **[CRITICAL] plan step 상태 업데이트 시 직접 상태 변이**
- **위치**: `frontend/src/lib/stores/assistant-store.ts:401-411`
- **상세**: `handleSseEvent` 내 `tool_call` 처리 시 `[...s.messages].reverse()`로 얕은 복사 후 `other.plan.steps`를 직접 변이(mutation)합니다. 원본 state 객체가 수정되어 React 불변성 원칙이 깨지고, `set` 콜백에서 `updatedPlan = m.plan`을 그대로 반환하므로 plan 참조가 동일해 컴포넌트 리렌더링이 발생하지 않을 수 있습니다.
- **제안**: plan을 포함한 메시지 전체를 불변 방식으로 재구성:
  ```typescript
  set((s) => ({
    messages: s.messages.map((m) => {
      if (!m.plan) return m;
      if (m.plan.steps.some(step => step.id === stepId)) {
        return {
          ...m,
          plan: {
            ...m.plan,
            steps: m.plan.steps.map(step =>
              step.id === stepId ? { ...step, status: "done" } : step,
            ),
          },
        };
      }
      return m;
    }),
  }));
  ```

---

### **[WARNING] `appendMessage`가 비원자적 3단계 DB 연산 수행**
- **위치**: `backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:155-172`
- **상세**: `messageRepo.save()` → `sessionRepo.update(lastInteractionAt, updatedAt)` → `sessionRepo.increment(messageCount)` 세 단계가 트랜잭션 없이 실행됩니다. 중간 단계 실패 시 `message_count`와 `last_interaction_at`이 실제 메시지 수와 불일치하게 됩니다.
- **제안**: `@Transaction()` 또는 `DataSource.transaction()`으로 세 연산을 하나의 트랜잭션으로 묶거나, DB 트리거로 `message_count`를 자동 관리.

---

### **[WARNING] `approveActivePlan`의 하드코딩된 한국어 문자열**
- **위치**: `frontend/src/lib/stores/assistant-store.ts:324`
- **상세**: `sendMessage("계획대로 진행해 주세요.", snapshot)`로 하드코딩된 한국어 문자열이 전송됩니다. i18n 시스템을 우회하며, 영문 UI 사용자에게 한국어 메시지가 표시됩니다. 또한 직전 줄 `plan.plan.approved = true`도 직접 변이입니다.
- **제안**: i18n 키를 통해 번역된 문자열 사용, `plan.plan` 직접 변이 제거.

---

### **[WARNING] `AssistantWorkflowEdgeDto.type` 검증 누락**
- **위치**: `backend/src/modules/workflow-assistant/dto/assistant-message-request.dto.ts:54-56`
- **상세**: `type?: 'data' | 'error'`에 `@IsString()`만 있고 `@IsIn(['data', 'error'])` 검증이 없어 임의 문자열이 통과됩니다. Shadow workflow의 `ShadowEdge.type`이 `'data' | 'error'` union이므로 유효하지 않은 값이 들어오면 런타임에 암묵적으로 `'data'`로 처리됩니다.
- **제안**: `@IsOptional() @IsIn(['data', 'error'])` 추가.

---

### **[WARNING] `UpdateAssistantSessionDto`로 `llmConfigId` null 설정 불가**
- **위치**: `backend/src/modules/workflow-assistant/dto/update-assistant-session.dto.ts:14-19`
- **상세**: `@IsOptional() @IsUUID()` 조합으로는 명시적 `null` 값이 `@IsUUID()` 검증을 통과하지 못합니다. 세션의 LLM 설정을 제거하려는 사용자는 PATCH 요청으로 처리할 수 없습니다.
- **제안**: `@IsOptional() @ValidateIf(o => o.llmConfigId !== null) @IsUUID()` 또는 `class-validator`의 `@IsNullable()` 적용.

---

### **[WARNING] `setWorkflow` 동일 워크플로우 재진입 시 세션 갱신 안 됨**
- **위치**: `frontend/src/lib/stores/assistant-store.ts:132`
- **상세**: `if (state.currentWorkflowId === workflowId) return;` 조건으로 같은 워크플로우에 재진입 시 세션·메시지가 새로 로드되지 않습니다. 외부에서 세션이 삭제되거나 다른 탭에서 메시지를 추가한 경우 stale 데이터가 표시됩니다.
- **제안**: `isOpen` 토글 시 또는 명시적 새로고침 트리거 시 session reload 허용.

---

### **[WARNING] `pendingToolCalls` 루프 반복 간 누적**
- **위치**: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts:164, 169`
- **상세**: `pendingToolCalls`는 `while` 루프 밖에서 선언되어 모든 tool_call 라운드에 걸쳐 누적됩니다. `assistantText`는 매 이터레이션마다 `''`로 초기화되지만, 이전 라운드의 텍스트는 유실됩니다. 멀티 라운드 대화에서 중간 라운드 assistant 텍스트가 DB에 저장되지 않습니다.
- **제안**: `assistantText`를 누적 방식으로 변경하거나, 각 라운드를 별도 메시지로 저장.

---

### **[INFO] `system` role 메시지가 히스토리 재구성 시 무음 처리**
- **위치**: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts:488-514`
- **상세**: `toChatMessage` 함수가 `role === 'system'` 메시지에 대해 `null`을 반환하고 `.filter(!!m)`으로 제거됩니다. SQL 주석에 "future audit"으로 기록한다고 명시되어 있으나, 나중에 시스템 메시지를 실제로 저장하는 경우 히스토리 누락이 발생할 수 있습니다.

---

### **[INFO] 스트리밍 중 사용자 재시도 피드백 없음**
- **위치**: `frontend/src/lib/stores/assistant-store.ts:216`
- **상세**: `if (state.isStreaming) return;`에서 유저에게 아무런 피드백 없이 메시지 전송이 무시됩니다. 사용자가 응답이 없다고 오해할 수 있습니다.
- **제안**: `toast.info("응답을 받는 중입니다...")` 등으로 안내.

---

### **[INFO] 에러 발생 후 스트리밍 상태 중복 초기화**
- **위치**: `frontend/src/lib/stores/assistant-store.ts:280-306`
- **상세**: `catch` 블록이 abort가 아닌 경우에도 `return`하지 않아, 이후 296-307라인의 `set({ isStreaming: false, ... })` 및 `refreshSessions()`가 불필요하게 재실행됩니다.

---

## 요약

전체적으로 AI Assistant의 핵심 기능(세션 관리, SSE 스트리밍, Shadow workflow 검증, 편집 툴 적용)은 구현되어 있으나, 프론트엔드 상태 관리에서 **plan step 업데이트 직접 변이(CRITICAL)** 버그가 있어 계획 실행 중 UI가 올바르게 갱신되지 않을 수 있습니다. 백엔드에서는 `appendMessage`의 비원자적 연산이 트래픽 증가 시 `message_count` 불일치를 유발할 수 있으며, `llmConfigId` null 해제 불가, `approveActivePlan` i18n 누락 등 요구사항 완전성 측면의 결함이 존재합니다.

## 위험도

**HIGH**