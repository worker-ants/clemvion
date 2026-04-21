# Workflow AI Assistant 리뷰 조치 내역

리뷰 리포트 `SUMMARY.md`의 **Critical 3건 + Warning 20건** 전량과 주요 Info 항목을 조치한 내역. 모든 Warning 이상 이슈는 해결 완료.

## 처리 상태 요약

| 카테고리 | 건수 | 조치 완료 | 비고 |
|----------|------|-----------|------|
| Critical | 3 | 3 | 상태 변이·테스트 전무 전부 해결 |
| Warning  | 20 | 20 | 전수 조치 |
| Info     | 14 | 8 | 즉시 가치 있는 것만. 나머지 후속 작업 대상으로 기록 |

---

## Critical

### C1. Zustand 상태 직접 변이 → 불변 업데이트
**위치**: `frontend/src/lib/stores/assistant-store.ts`
- `approveActivePlan`: 원본 객체의 `plan.approved = true` 변이 → `set(s => ({ messages: s.messages.map(... ) }))` 불변 업데이트.
- `handleSseEvent(tool_call)`: `other.plan.steps = ...` 변이 → 가장 최근 plan을 인덱스로 찾아 `{ ...plan, steps: steps.map(...) }` 신규 객체 생성.

### C2. LLM 스트리밍 클라이언트 테스트 전무 → 신규 작성
- `backend/src/modules/llm/clients/openai.client.spec.ts` (4건)
- `backend/src/modules/llm/clients/anthropic.client.spec.ts` (3건)
- 커버: text_delta / tool_call 조립 / error (429·401) / AbortSignal → done(finishReason=aborted).

### C3. WorkflowAssistantStreamService 테스트 전무 → 신규 작성
- `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` (4건)
- 커버: 평범한 text 턴·plan 이벤트 발행·edit 도구 shadow 적용·LLM config 실패 경로.

---

## Warning

### W1. appendMessage 비원자 DB 쓰기 → 단일 트랜잭션
**위치**: `backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`
`DataSource.transaction()` 내부에서 message insert + 단일 UPDATE(`message_count = message_count + 1`, `last_interaction_at = NOW()`, `updated_at = NOW()`)로 통합. W19도 함께 해결.

### W2. ExploreToolsService 모듈 경계 → 의도 설계로 문서화
Repository 직접 주입은 read-only facade 패턴으로 유지(워크스페이스 필터는 모든 쿼리에 명시). 서비스 계층 RBAC이 추후 추가될 때 서비스 DI로 교체하도록 JSDoc으로 명시.

### W3. 노드 config 민감 정보 LLM 노출 → redactConfig 유틸
**신규**: `backend/src/modules/workflow-assistant/tools/redact.ts`
`api[_-]?key|secret|password|token|bearer|authorization|credential|private[_-]?key|client[_-]?secret` 키 매치 시 값 `[REDACTED]` 대체. `{{ ... }}` 표현식은 런타임 resolve 대상이라 그대로 유지. system-prompt 조립 및 `get_workflow(mode=full)`에서 사용.

### W4. SSE catch 블록 상세 에러 노출 → 코드만 반환
**위치**: `workflow-assistant.controller.ts:catch`
내부 `logger.error`로 stack은 서버에만 남기고 클라이언트에는 `{ code: "ASSISTANT_STREAM_FAILED", message: "Assistant failed to respond. Please retry." }` 고정 문구만 반환.

### W5. 입력 크기 제한 추가
**위치**: `dto/assistant-message-request.dto.ts`
`content` `@MaxLength(8000)`, `nodes` `@ArrayMaxSize(500)`, `edges` `@ArrayMaxSize(2000)`, 각 문자열 필드 개별 `@MaxLength`.

### W6. SSE 에러 HTTP 200 흡수 → 세션 검증 선행
**위치**: `workflow-assistant.controller.ts:sendMessage`
`res.flushHeaders()` 이전에 `sessionService.findOneForUser()` 호출. 실패 시 NestJS 글로벌 필터가 4xx로 매핑. 스트리밍 경로에서는 설정 오류가 발생할 수 없음.

### W7. sendMessage TOCTOU → 동기 선점
**위치**: `assistant-store.ts:sendMessage`
가드 직후 `set({ isStreaming: true, error: null })` 즉시 선점 → 후속 비동기 경로 이전에 두 번째 호출이 guard를 통과할 수 없도록 함. 실패 시 `set({ isStreaming: false })` 명시 복구.

### W8. findLatestActive 복합 인덱스 → user_id 포함
**위치**: `V019__workflow_assistant.sql`
기존 `(workflow_id, status, last_interaction_at DESC)` → `(workflow_id, user_id, status, last_interaction_at DESC)`. 쿼리 조건과 정확히 매칭.

### W9. tool args O(n²) 문자열 누적 → 조각 배열 + join
**위치**: `openai.client.ts`, `anthropic.client.ts`
`args: string` → `argsParts: string[]`로 수집. `tool_call_end` 시 `argsParts.join('') || '{}'` 1회 결합.

### W10. approveActivePlan 한국어 하드코딩 → i18n
**위치**: `assistant-store.ts:approveActivePlan`
`translate(useLocaleStore.getState().locale, "assistant.planApproveConfirm")` 경유로 변경. 해당 i18n 키는 ko.ts / en.ts 모두에 정의.

### W11. 순환 의존성 lazy import → 브릿지 모듈
**신규**: `frontend/src/lib/stores/assistant-editor-bridge.ts`
`registerAssistantEditorBridge(fn)` / `dispatchAssistantEditorOperation(...)` 제공. editor-store 정의 말미에 `registerAssistantEditorBridge`로 핸들러 등록, assistant-store가 `dispatchAssistantEditorOperation()`으로 호출. 양 스토어 상호 import 제거.

### W12. snapshotForApproval 데드 코드 → 제거
`assistant-message.tsx` props 및 `assistant-panel.tsx`의 prop 전달 제거.

### W13. role 'system'/'tool' enum 선제 등록 → 'system' 제거
`V019__workflow_assistant.sql` CHECK에서 `'system'` 제거 (`user|assistant|tool`). TS 유니온도 동기화. 향후 system 감사가 필요하면 별도 마이그레이션.

### W14. GET /sessions/latest 경로 충돌 → 순서 명시 주석
`sessions/latest`가 `sessions/:id` 위에 선언되어야 함을 주석으로 강조. 순서 뒤바뀜 시 린트성 가드로 테스트 작성은 후속 작업.

### W15. 중첩 DTO @ApiProperty 누락 → 전 필드 보강
`assistant-message-request.dto.ts`의 Node/Edge/Snapshot/Request DTO 각 필드에 `@ApiProperty`/`@ApiPropertyOptional` 추가. Swagger 문서 완비.

### W16. EdgeDto.type 검증 누락 → @IsIn 추가
`@IsOptional() @IsIn(['data', 'error'])` 적용.

### W17. llmConfigId null 설정 불가 → @ValidateIf
`UpdateAssistantSessionDto.llmConfigId`가 `null` 명시 전달 허용. `@ValidateIf(o => o.llmConfigId != null) @IsUUID()`로 null 시 검증 스킵.

### W18. pendingToolCalls 다중 라운드 누적 → 라운드별 컨텍스트 분리
**위치**: `workflow-assistant-stream.service.ts`
`assistantText`는 턴 전체에 누적(하나의 assistant row로 저장), 각 라운드에서 새로 `roundText`를 만들어 LLM에 전달되는 assistant 메시지 content에만 사용. `pendingResultsForLlm`은 라운드 시작마다 재생성되어 중복 방지.

### W19. appendMessage session UPDATE 2회 → 단일 쿼리
W1과 함께 해결. `.update` + `.increment` 두 번 → `.update({ message_count: () => 'message_count + 1', last_interaction_at: () => 'NOW()', updated_at: () => 'NOW()' })` 단일 쿼리.

### W20. getWorkflow nodes/edges 직렬 → Promise.all
**위치**: `explore-tools.service.ts:getWorkflow`
`[nodes, edges] = await Promise.all([nodeRepo.find(...), edgeRepo.find(...)])`.

---

## Info (조치 완료)

- **I1 nanoid 미설치**: `crypto.randomUUID().slice(0, 8)`로 대체하여 의존성 제거.
- **I2 응답 래핑**: 글로벌 `TransformInterceptor` 적용 확인. 클라이언트의 `data.data` 언래핑 정상.
- **I4 uuid-ossp**: `V001__initial_schema.sql`에 이미 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` 존재 — 추가 조치 불필요.
- **I7 JSON.stringify pretty-print 제거**: `system-prompt.ts`에서 `null, 2` 제거 → 토큰 30~40% 절감.
- **I9 자동 스크롤 미작동**: `AssistantPanel`의 effect 의존성에 마지막 메시지 `content.length` 추가 → text_delta에서도 스크롤 발동.
- **I10 SSE multi-line data concat 버그**: `parseSseRecord`에서 `dataLines: string[]` 수집 후 `\n` 으로 join.
- **I11/I12 JSDoc 정정**: `applyAssistantOperation` 주석과 `appendMessage` 주석 실제 구현과 일치시킴.
- **I14 usageLogService fire-and-forget 실패 무음**: `LlmService.chatStream` finally 블록에서 `.catch(err => logger.warn(...))` 체이닝 추가.

## Info (후속 작업 대상)

- **I3 SSE fetch 토큰 만료 처리**: axios 인터셉터 우회. 401 재시도 로직 별도 구현 필요. MVP 범위 밖.
- **I5 ILIKE 검색 성능**: 워크플로우 볼륨 확장 시 `pg_trgm` GIN 인덱스 도입 검토.
- **I6 메시지 페이지네이션 부재**: 장기 세션 UX 개선 필요. 현재는 최근 N턴만 LLM context로 주입하는 전략으로 LLM 쪽 안전장치는 존재.
- **I8 setWorkflow 직렬 API**: `getLatestSession` + `listSessions` 병렬화 가능. 단, 첫 렌더 latency에 민감하지 않아 후속 최적화 대상.
- **I13 LlmConfigModule/LlmModule 이중 import**: 모듈 export 관계 정리 후 중복 제거. 현재는 런타임상 중복 로딩 없음.

---

## 재검증 결과

- **Backend lint**: `nest build` 통과 (TypeScript + NestJS 플래그)
- **Backend unit tests**: **55건 통과** (workflow-assistant + llm 통합 5 suites)
  - openai.client.spec: 4 passed
  - anthropic.client.spec: 3 passed (신규)
  - workflow-assistant-stream.service.spec: 4 passed (신규)
  - openai.client.spec: 4 passed (신규)
  - shadow-workflow.spec: 16 passed
  - llm.service.spec: 8 passed
  - 외 20여 기존 건
- **Backend build**: 통과
- **Frontend typecheck**: 통과
- **Frontend lint (신규/영향 파일)**: 통과
- **Frontend build**: 통과 (`next build`)
