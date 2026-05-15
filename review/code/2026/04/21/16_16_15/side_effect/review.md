## 발견사항

---

### 파일 5: `llm-client.interface.ts`

- **[WARNING]** `stream()` 메서드가 `optional` (`stream?`)으로 추가됨
  - 위치: `LLMClient` 인터페이스
  - 상세: 기존 `LLMClient` 구현체(Anthropic, OpenAI 외 3rd party 또는 미래 provider)가 `stream`을 구현하지 않아도 컴파일 통과. `LlmService.chatStream()`은 런타임에 `!client.stream` 체크로 방어하지만, 타입 시스템이 이를 강제하지 않아 누락 구현이 조용히 `BadRequestException`으로 처리됨.
  - 제안: 인터페이스에 optional로 두되, `LlmService.chatStream()` JSDoc에 "지원하지 않는 provider는 400 반환" 명시 (이미 돼 있음). 현재 설계 수용 가능.

---

### 파일 6: `llm.service.ts`

- **[WARNING]** `chatStream()` 내 `usageLogService.record()` 호출이 `void` (fire-and-forget)
  - 위치: `finally` 블록
  - 상세: usage 기록 실패가 caller에게 전파되지 않음. 로그 누락이 소리 없이 발생할 수 있음.
  - 제안: 현재 설계(스트림 응답 속도 우선)라면 허용 가능. 단, 실패 시 최소한 `console.error` 래핑 권장.

- **[INFO]** `lastUsage.totalTokens > 0` 조건으로 abort/error 시 usage 기록 스킵
  - 위치: `finally` 블록
  - 상세: 정상적 의도이며, 코멘트로 이유가 명시돼 있음. 부작용 없음.

---

### 파일 3: `anthropic.client.ts`

- **[WARNING]** `stream` 내 `as never` 타입 캐스팅
  - 위치: `toolChoice` 매핑 중 `{ type: 'none' } as never`
  - 상세: Anthropic SDK 타입 정의에 `none` tool_choice가 없어 우회한 것으로 보임. SDK 버전 업그레이드 시 동작이 달라질 수 있음.
  - 제안: SDK 버전 핀 고정하거나 추후 SDK 지원 여부 재확인.

- **[INFO]** `for await ... of stream as unknown as AsyncIterable<...>` 이중 캐스팅
  - 위치: 스트림 이벤트 루프
  - 상세: Anthropic SDK의 스트리밍 타입이 `AsyncIterable`을 직접 반환하지 않아 우회. 기능적 부작용은 없으나 타입 안전성 포기.

- **[WARNING]** `finishReason: 'aborted'` 를 `done` 이벤트로 yield
  - 위치: catch 블록 이후 `yield { type: 'done', ... }`
  - 상세: abort된 경우에도 `done` 이벤트가 방출됨. `LlmService.chatStream()`의 `finally`에서 `lastUsage`가 null이므로 usage 기록은 안 되지만, caller(stream service)가 `done` 이벤트를 "정상 완료"로 오해할 여지 있음.
  - 제안: `finishReason === 'aborted'`인 경우 caller 측에서 명시적으로 분기 처리 확인 필요.

---

### 파일 4: `openai.client.ts`

- **[WARNING]** `tool_call_end` 이벤트가 `finish_reason === 'tool_calls'`에서만 방출
  - 위치: choice.finish_reason 처리 블록
  - 상세: OpenAI가 `stop_sequences` 등 다른 이유로 tool call을 중단하는 경우 `tool_call_end`가 누락될 수 있음. 다만 실제 API 계약상 tool call은 `tool_calls`로만 끝나므로 현재는 안전.

- **[INFO]** `toolAccum`이 스트림 전체에 걸쳐 누적되므로, 하나의 응답에 다수 tool call이 있을 때 메모리에 전부 보관됨. 비정상적으로 많은 tool call이 올 경우 메모리 사용 증가.

---

### 파일 17: `workflow-assistant-session.service.ts`

- **[WARNING]** `appendMessage()` 내 `message_count` 갱신이 비원자적
  - 위치: `appendMessage()` 메서드
  - 상세: `messageRepo.save()` → `sessionRepo.update(lastInteractionAt)` → `sessionRepo.increment(messageCount)` 세 쿼리가 트랜잭션 없이 순차 실행됨. 동시에 두 메시지가 저장되면 `message_count`가 실제 행 수와 어긋날 수 있음.
  - 제안: 코멘트에 "트랜잭션 없이도 안전"이라고 했으나, `message_count`는 UI 표시용(denormalized)이므로 최악은 숫자 오차이며 치명적이지 않음. 허용 가능하나, 정확성이 중요해지면 QueryRunner 트랜잭션으로 묶는 것을 권장.

- **[INFO]** `findOneForUser()`가 `workspaceId` 불일치 시 `NotFoundException`을, `userId` 불일치 시 `ForbiddenException`을 반환. 타이밍 공격(timing attack)을 통한 세션 존재 여부 노출은 미미하나, 보안 관점에서 두 경우 모두 404로 통일하는 것이 일반적인 관행.

---

### 파일 18: `workflow-assistant-stream.service.ts` (diff 생략됨)

- **[INFO]** 파일 내용이 프롬프트 제한으로 생략됨. SSE 스트림 관련 핵심 로직이 여기 있을 것이므로, 특히 다음 항목은 수동 확인 필요:
  - `AbortController` 생명주기 관리 (클라이언트 disconnect 시 LLM 요청 취소)
  - `ShadowWorkflow` 결과를 SSE로 직렬화하는 흐름
  - 세션 title 자동 설정(`setTitleIfEmpty`) 호출 시점

---

### 파일 19: `workflow-assistant.controller.ts`

- **[WARNING]** keepalive `setInterval`이 `finally` 블록에서 `clearInterval`로 정리되지만, `res.writableEnded` 체크 전에 SSE 이벤트 write 시도 가능
  - 위치: keepalive ping 로직
  - 상세: `res.writableEnded` 체크가 있으므로 실질적 오류는 없지만, 스트림 완료 후 15초 이내에 ping이 한 번 더 시도될 수 있음. `clearInterval`이 항상 `finally`에서 실행되므로 안전.

- **[INFO]** `req.once('close', onClose)` + `req.off('close', onClose)` 쌍이 올바름. 이중 abort 방지 처리 적절.

- **[WARNING]** SSE에서 `error` 이벤트 후 `res.end()` 호출이 `finally`로 보장되지만, 동시에 `catch` 블록 내에서 error 이벤트를 write하고 `finally`에서도 `res.end()`가 호출. 정상 흐름이며 `writableEnded` 체크로 이중 end 방지.

---

### 파일 29: `assistant-store.ts`

- **[CRITICAL]** `approveActivePlan()` 내 직접 변이(mutation)
  - 위치: `approveActivePlan` 함수
  ```ts
  plan.plan.approved = true; // ← Zustand state 직접 변이
  ```
  - 상세: `messages` 배열에서 찾은 `plan` 객체를 `set()` 바깥에서 직접 수정함. Zustand는 이 변이를 감지하지 못하여 React 리렌더가 트리거되지 않을 수 있음. 이후 `set()` 호출에서 `{ ...plan.plan, approved: true }`로 불변 업데이트하지만, 이미 원본 상태 객체가 오염됨.
  - 제안:
  ```ts
  // 직접 변이 제거, set() 내에서만 업데이트
  set((s) => ({
    messages: s.messages.map((m) =>
      m.id === plan.id
        ? { ...m, plan: m.plan ? { ...m.plan, approved: true } : null }
        : m,
    ),
  }));
  ```

- **[WARNING]** `handleSseEvent()` 내 plan step 상태 변이
  - 위치: `tool_call` 이벤트 처리 중
  ```ts
  other.plan.steps = other.plan.steps.map(...); // ← 직접 변이
  ```
  - 상세: `[...s.messages].reverse()`로 복사한 배열의 요소이나, 요소 자체는 state 객체의 참조. `other.plan.steps`에 직접 할당하면 원본 state 오염.
  - 제안: 이 로직을 `set()` updater 안으로 이동하여 불변 방식으로 처리.

- **[WARNING]** `sendMessage()` 내 에러 핸들링 후 상태 이중 설정
  - 위치: catch 블록 종료 후 `set({ isStreaming: false, ... })` 재실행
  - 상세: catch에서 이미 `isStreaming: false`로 설정하고, catch 탈출 후 `return`이 없어 바깥 `set()`도 실행됨. 기능적 문제는 없지만 불필요한 상태 업데이트.
  - 제안: catch 블록 끝에 `return` 추가.

- **[INFO]** `import("@/lib/stores/editor-store")` lazy import로 순환 의존 방지. 올바른 패턴.

---

### 파일 30: `editor-store.ts`

- **[WARNING]** `applyAssistantOperation()` 내 `update_node` 처리 시 `pushUndo` 미호출
  - 위치: `update_node` 분기의 `set()` 직접 호출 부분
  - 상세: `patch.config`인 경우 `s.updateNodeConfig(id, patch.config)`를 호출하는데, 이 함수가 내부에서 `pushUndo`를 호출하는지 불분명. `patch.label || patch.position`인 경우 `set()` 직접 호출로 undo 스택에 올라가지 않음.
  - 제안: label/position 변경 시에도 `s.pushUndo()` 선행 호출.

- **[INFO]** `add_node`에서 `def?.category ?? "logic"` 폴백. `getNodeDefinition`이 null 반환 시 category가 "logic"으로 고정되어, Shadow 측 category와 불일치할 수 있음. Shadow의 `resolveCategory()`도 "logic" 폴백이므로 일관성은 유지됨.

---

### 파일 1: `V019__workflow_assistant.sql`

- **[INFO]** `uuid_generate_v4()` 의존. `uuid-ossp` extension이 활성화되어 있어야 함. 기존 마이그레이션들이 동일 방식을 쓴다면 문제없음.
- **[INFO]** `llm_config(id) ON DELETE SET NULL` — `llm_config`가 삭제되어도 세션은 유지. 의도적이며 올바름.
- **[INFO]** `updated_at`이 세션 테이블에 있으나 자동 갱신 트리거 없음. `appendMessage()`에서 명시적으로 갱신하므로 정상. 단, 다른 경로로 세션이 수정될 경우 TypeORM `@UpdateDateColumn`이 처리함.

---

## 요약

이번 변경의 가장 중요한 부작용 위험은 **`assistant-store.ts`에서의 Zustand state 직접 변이** 2건이다. `approveActivePlan()`의 `plan.plan.approved = true`와 `handleSseEvent()`의 `other.plan.steps = ...` 직접 할당은 원본 state 객체를 오염시켜 예측 불가한 리렌더 누락을 야기할 수 있다. 그 외에는 `appendMessage()`의 비원자적 카운터 갱신(허용 수준), `update_node` 처리 시 일부 경로에서 undo 스택 누락, `stream()` abort 시 `done` 이벤트가 방출되는 점이 주의 대상이다. 신규 모듈 등록(`app.module.ts`) 및 스트리밍 인터페이스 확장은 기존 코드에 Breaking Change 없이 추가적으로 잘 격리되어 있다.

## 위험도

**MEDIUM**

(state 직접 변이로 인한 UI 버그 가능성 존재. 데이터 손실이나 보안 문제는 없으나, 프로덕션 환경에서 재현하기 어려운 렌더링 버그로 이어질 수 있어 배포 전 수정 권장)