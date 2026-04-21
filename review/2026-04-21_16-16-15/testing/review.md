### 발견사항

---

**[INFO] shadow-workflow.spec.ts — 유일하게 존재하는 테스트**
- 위치: `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts`
- 상세: `ShadowWorkflow` 클래스의 주요 경로(add/update/remove node·edge, 사이클 검출)는 잘 커버되어 있음. 그러나 다음 분기가 누락됨:
  - `add_node` — `type` 또는 `label`이 빈 문자열일 때 → `INVALID_ARGUMENTS`
  - `add_node` — `containerId`가 존재하지 않는 노드를 가리킬 때 → `NODE_NOT_FOUND`
  - `add_node` — container 안에 trigger 타입 배치 시 → `CONTAINER_INVALID_CHILD`
  - `add_edge` — `sourceId`·`targetId` 모두 빈 문자열 → `INVALID_ARGUMENTS`
  - `update_node` — `position` 패치 경로
  - `remove_edge` — id 없이 source/target 튜플로 삭제하는 fallback 경로
  - `suggestLabel` — `(2)~(99)` 슬롯이 모두 점령된 경우 UUID suffix 분기
  - `snapshot()` 반환값이 deep copy인지 (불변성 보장 여부)
- 제안: 위 케이스를 각 `describe` 블록에 추가

---

**[CRITICAL] LLM 스트리밍 클라이언트(Anthropic/OpenAI) 테스트 전무**
- 위치: `anthropic.client.ts`, `openai.client.ts` — 각 `stream()` 제너레이터 전체
- 상세: 새로 추가된 `stream()` 메서드는 이벤트 타입별 분기(text_delta, tool_call_delta, tool_call_end, done, error), AbortSignal 처리, 에러 코드 문자열 매칭(`message.includes('429')`)까지 복잡한 로직을 담고 있으나 테스트가 없음. 특히 `'429'` 문자열 매칭은 SDK가 반환하는 실제 에러 메시지 포맷에 의존하므로 회귀에 취약
- 제안: Jest `AsyncIterable` 모킹으로 각 이벤트 타입별 단위 테스트 및 abort 경로 테스트 작성

---

**[CRITICAL] WorkflowAssistantStreamService 테스트 전무**
- 위치: `workflow-assistant-stream.service.ts` (diff 생략됨)
- 상세: SSE 스트림 전체 파이프라인의 핵심 서비스임에도 테스트 파일이 확인되지 않음. 도구 호출 라우팅, 플랜 승인 흐름, 메시지 영속화 타이밍 등이 모두 미검증 상태
- 제안: 서비스 레이어 단위 테스트 + e2e 스트림 통합 테스트 작성 최우선

---

**[HIGH] WorkflowAssistantSessionService CRUD 테스트 전무**
- 위치: `workflow-assistant-session.service.ts`
- 상세: 다음 경로가 미검증:
  - `findOneForUser` — 동일 워크스페이스·다른 유저 접근 시 `ForbiddenException(403)` vs 다른 워크스페이스 시 `NotFoundException(404)` 구분
  - `appendMessage` — `message_count` 증분과 `last_interaction_at` 갱신이 별도 쿼리 3개로 분리(트랜잭션 없음) → 동시 삽입 시 카운트 오염 가능성
  - `setTitleIfEmpty` — title이 NULL일 때만 업데이트되는 조건 분기
- 제안: `@nestjs/testing` + TypeORM 인메모리 DB 또는 Mock Repository로 단위 테스트 작성

---

**[HIGH] handleSseEvent — 상태 직접 변이(mutation) 버그, 테스트로 잡아야 함**
- 위치: `assistant-store.ts`, `handleSseEvent` 함수
  ```typescript
  // tool_call 이벤트 처리 시
  for (const other of [...s.messages].reverse()) {
    if (other.plan) {
      other.plan.steps = other.plan.steps.map(...)  // ← 상태 직접 변이
      break;
    }
  }
  ```
  또한 `approveActivePlan`:
  ```typescript
  plan.plan.approved = true;  // ← set() 호출 전 직접 변이
  ```
- 상세: Zustand 스냅샷을 직접 변이하는 패턴. 리렌더링이 누락되거나 상태가 불일치할 수 있으며, 테스트가 없어 발견되지 않음
- 제안: Zustand store 단위 테스트(vitest + `zustand/src/middleware` 없이 순수 함수 추출 후 테스트)로 변이 감지

---

**[HIGH] parseSseRecord — 멀티라인 data 필드 파싱 버그, 테스트 없음**
- 위치: `frontend/src/lib/api/assistant.ts:parseSseRecord()`
  ```typescript
  } else if (line.startsWith("data:")) {
    data += line.slice(5).trim();  // 줄 구분자 없이 단순 concat
  }
  ```
- 상세: SSE 스펙상 `data:` 필드가 여러 줄로 분할될 경우 `\n`으로 조인해야 하지만 현재는 구분자 없이 이어붙임 → 큰 JSON 페이로드가 멀티라인으로 오면 파싱 실패
- 제안:
  ```typescript
  data += (data ? "\n" : "") + line.slice(5).trim();
  ```
  + vitest로 멀티라인 레코드 파싱 단위 테스트 추가

---

**[HIGH] ExploreToolsService 워크스페이스 격리 미검증**
- 위치: `explore-tools.service.ts`
- 상세: `listIntegrations`, `listWorkflows`, `getWorkflow` 모두 `workspaceId`를 WHERE 조건으로 사용하지만 단위 테스트가 없어 격리 실패 시 다른 워크스페이스 데이터 노출 여부를 검증할 수 없음
- 제안: Repository 모킹 후 `workspaceId` 바인딩 파라미터가 올바르게 전달되는지 단위 테스트로 검증

---

**[MEDIUM] applyAssistantOperation — undo 스택 동작 미검증**
- 위치: `frontend/src/lib/stores/editor-store.ts`
- 상세: `add_node`, `update_node`, `remove_node`, `add_edge`, `remove_edge` 모두 기존 스토어 뮤테이터에 위임하지만 `remove_edge`만 명시적으로 `pushUndo()` 호출. 다른 도구들이 undo 스택을 올바르게 쌓는지 미검증
- 제안: Zustand 스토어 테스트에서 각 툴 디스패치 후 undo → 원상복구 경로 검증

---

**[MEDIUM] buildSystemPrompt 테스트 없음**
- 위치: `backend/src/modules/workflow-assistant/prompts/system-prompt.ts`
- 상세: 프롬프트 품질이 AI 동작 전체에 영향을 미치지만 단위 테스트 없음. 특히 노드 카탈로그가 비어 있을 때 fallback 텍스트(`'(no nodes registered)'`) 출력 여부, ports가 string이 아닌 객체 형태일 때 파싱 등
- 제안: 고정 입력으로 출력 스냅샷 테스트(snapshot testing) 또는 핵심 섹션 존재 검증

---

**[MEDIUM] AssistantController SSE 엔드포인트 테스트 없음**
- 위치: `workflow-assistant.controller.ts`, `sendMessage` 핸들러
- 상세: keepalive 인터벌 설정, `X-Accel-Buffering: no` 헤더, 클라이언트 disconnect 시 abort 연결 등 SSE 인프라 코드가 미검증
- 제안: Supertest + mock StreamService로 SSE 헤더 및 이벤트 포맷 통합 테스트

---

**[INFO] DTO 검증 테스트 없음**
- 위치: `assistant-message-request.dto.ts`, `create-assistant-session.dto.ts`, `update-assistant-session.dto.ts`
- 상세: `@ValidateNested`, `@IsUUID`, `@MaxLength` 등 데코레이터 조합이 중첩 객체에서 올바르게 동작하는지(특히 `AssistantWorkflowSnapshotDto` 중첩 검증) 미검증
- 제안: `class-validator`의 `validate()` 함수를 직접 호출하는 DTO 단위 테스트 추가

---

### 요약

변경된 코드 중 테스트가 존재하는 파일은 `shadow-workflow.spec.ts` 단 하나이며, 이 파일도 `CONTAINER_INVALID_CHILD`, `INVALID_ARGUMENTS`, `remove_edge` fallback 등 5~6개 경로가 누락되어 있다. 핵심 위험은 LLM 스트리밍 클라이언트(Anthropic/OpenAI `stream()`), `WorkflowAssistantStreamService` 전체, SSE 파싱 로직(`parseSseRecord` 멀티라인 버그), Zustand 상태 직접 변이(`approveActivePlan`, `handleSseEvent tool_call` 분기) 등이 완전히 미검증 상태라는 점이다. 특히 상태 변이 버그는 기존 테스트로 발견할 수 없어 프로덕션에서 예측 불가능한 렌더링 불일치를 일으킬 가능성이 있다.

### 위험도

**HIGH**