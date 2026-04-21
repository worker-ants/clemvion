# 리뷰 이슈 조치 내역 — 2026-04-22 (P0/P1/P2 후속)

대상 리뷰: `review/2026-04-22_00-36-25/SUMMARY.md`
조치자: developer role

## 조치 요약

| # | 카테고리 | 발견 | 조치 | 위치 |
|---|----------|------|------|------|
| CRITICAL 1 | Requirement | `openQuestions` 독립 gating 미구현 | `evaluateFinishGuard` 를 재작성해 `pendingSteps.length === 0 && openQuestions.length === 0` 조건으로 block 여부 판단. 메시지 문구를 pending-only / open-questions-only / 둘 다 세 가지로 분기 | `workflow-assistant-stream.service.ts` `evaluateFinishGuard` |
| WARNING 1 | Requirement | `note` action step 이 영원히 pending 으로 남아 무한 block | pendingSteps 필터에 `s.action !== 'note'` 추가. 신규 테스트 `does not count 'note'-action plan steps as pending` 로 회귀 방지 | 동일 파일 + spec |
| WARNING 2 | Side Effect | 성공 finish 가 DB 에 persist 되지 않아 다음 세션 rehydrate 시 plan 이 "미완료"로 오인 | finish 성공 경로에서도 `pendingToolCalls.push(...)` 호출. `AssistantToolCallKind` 에 `'finish'` 추가 | `workflow-assistant-stream.service.ts` 및 `entities/workflow-assistant-message.entity.ts` |
| WARNING 3 | Spec 정합 | 2차 finish block 동작의 spec ↔ 구현 불일치 (spec: error 이벤트로 종료 / 구현: 정상 탈출) | spec §4.3·§10 을 구현 기준("두 번째 finish 는 정상 `finishReason: 'stop'` 로 탈출")으로 정정 | `spec/3-workflow-editor/4-ai-assistant.md` §4.3, §10 |
| WARNING 4 | Requirement | planForTurn 이 null 이면 과거 미완 plan 을 가져와 무관한 편집을 막음 | planForTurn 이 null 이고 이번 턴 편집 중 history plan 의 step id 와 매칭되는 것이 없으면 guard 를 비활성화 | `evaluateFinishGuard` |
| WARNING 5 | Side Effect | finish 처리 후 `break` 로 탈출하면 done/usage 이벤트가 소비되지 않아 Round 1 의 usage 가 클라이언트·로그에서 누락 | `break` 대신 `continue` + `finishResolved` 플래그 로 전환. 이후 done 이벤트에서 `if (!finishResolved) finishReason = ev.finishReason;` 으로 우리가 정한 reason 유지하되 usage 는 정상 세팅 | `workflow-assistant-stream.service.ts` |
| WARNING 7 | Testing | `findLatestPlanInHistory` 경로·히스토리 집계 미테스트 | 신규 테스트 2 건 — (a) history plan + 무관 편집 → guard silent (b) history plan + 매칭 planStepId → guard activates | `workflow-assistant-stream.service.spec.ts` |
| WARNING 8 | Testing | openQuestions 단독 차단 미구현·미테스트 | CRITICAL 1 구현 + 신규 테스트 `blocks finish when openQuestions remain even after all edit steps are done` | 동일 spec |
| WARNING 9 | Testing | `system-prompt.spec.ts` 가 `dynamicPorts` 속성명 미테스트 | 신규 테스트 `also recognizes metadata.dynamicPorts (without explicit isDynamicPorts) as a dynamic-ports node` 추가 | `prompts/system-prompt.spec.ts` |
| WARNING 10 | Security | openQuestions 답변 textarea 길이 제한 부재 | `ANSWER_MAX_LENGTH = 4000` 상수 + `maxLength` prop 적용 | `plan-card.tsx` |
| WARNING 11 | Side Effect | 스트리밍 중 PlanCard 재전송 가능 | `PlanCardProps.isStreaming` 전달 + textarea/button disabled 조건에 반영. 제출 중 `isSubmitting` ref-guard 로 더블 서브밋 방지 | `plan-card.tsx`, `assistant-message.tsx`, `assistant-panel.tsx` |
| WARNING 12 | Documentation | spec §13 i18n 테이블에 3개 신규 키 미반영 | `planQuestionsTitle`, `planQuestionsPlaceholder`, `planQuestionsSend` 행 추가 | `spec/3-workflow-editor/4-ai-assistant.md` §13 |
| WARNING 13 | Documentation | `system-prompt.ts` JSDoc few-shot 개수 불일치 | "5개" 로 정정하고 목록 구체화 | `prompts/system-prompt.ts` |
| WARNING 14 | Documentation | 클래스 JSDoc 에 finish guard 동작 미반영 | `- finish:` 설명에 `evaluateFinishGuard`·`finishBlockCount`·finish 성공 persist 설명 추가 | `workflow-assistant-stream.service.ts` |
| WARNING 15 | Requirement | 승인된 plan 에도 answer input 노출 | `showAnswerInput = hasQuestions && onAnswerQuestions && !plan.approved` | `plan-card.tsx` |
| WARNING 16 | API Contract | `onAnswerPlanQuestions` 가 필수 prop | 현재 호출지(`assistant-panel.tsx`)가 단일이고 그 경로에서 항상 설정되므로 필수 유지. 확인 후 문서화 (RESOLUTION 본 항목에 기록) | — |
| INFO 1 | Dependency | `WorkflowAssistantMessage` top-level import 누락 (인라인 import 반복) | 파일 상단 import 로 이동, 3곳 정리 + `FinishGuardError` 인터페이스 추출 | `workflow-assistant-stream.service.ts` |
| INFO 5 | Testing | PLAN_NOT_COMPLETE 응답의 `openQuestions` 필드 미검증 | openQuestions 단독 block 테스트에서 `expect(parsed.openQuestions).toEqual([...])` 로 검증 | spec 파일 |
| INFO 6 | Testing | 차단된/성공한 finish 의 DB persist 내용 미검증 | `persists the successful finish tool_call in history` 테스트로 검증 (toolCalls 배열에 `name: 'finish', kind: 'finish'` 포함) | spec 파일 |
| INFO 11 | Side Effect | `tool_calls` JSONB 소비 코드의 `kind === 'finish'` exhaustive 확인 | 현재 소비자 `toChatMessages` 는 kind 를 읽지 않음 (id/name/arguments 만 사용) 이므로 영향 없음을 확인 | — |
| INFO 12 | Documentation | 테스트 파일 헤더에 신규 시나리오 미갱신 | finish guard 7개 시나리오 + persist/usage drain 을 헤더 주석에 추가 | spec 파일 |

## 스코프 밖으로 분류해 이번 PR 에서는 조치하지 않은 항목

| # | 이유 |
|---|------|
| WARNING 6 (isDynamicPorts/dynamicPorts 필드 통합) | `NodeComponentMetadata` 의 기존 설계. 두 필드의 의미가 미묘히 달라(dynamicPorts 는 "어떻게 확장되는지" 명세까지 포함) 통합은 설계 재검토 필요. 현재 구현은 `isDynamicPorts || dynamicPorts` 양쪽을 OR 로 수용하므로 기능상 누락 없음 |
| WARNING 17 (God Class 심화) | 리팩터 범위 큼. `PlanCompletionGuard` 분리 등은 별도 유지보수 PR 로 분리 |
| WARNING 18 (프롬프트 토큰 비용) | 튜닝 과제. prompt caching 도입은 별도 설계 필요 |
| INFO 2 (FinishGuardError 타입 추출) | 본 PR 에서 이미 적용 (완료) |
| INFO 3 (PlanCard 이중 제출 React state batching) | `isSubmitting` 상태 + `queueMicrotask` 해제로 기본 방어 도입. 100% 방어는 서버 중복 턴 감지 설계 필요 — 별도 과제 |
| INFO 4 (Plan step ID 네임스페이스) | 현재는 history 가 같은 세션의 plan 까지만 보고, 활성 plan 을 하나로만 사용 → 충돌 확률 낮음. 네임스페이스는 별도 플래그 워크 (plan 닫기 메커니즘과 함께 재설계) |
| INFO 7 (frontend plan-card 컴포넌트 테스트) | 프론트 테스트 하네스 미구축. 별도 설정 후 광범위하게 도입 |
| INFO 8 (system-prompt regex 정규화) | 현재 규식이 지나치게 느슨하진 않음. 정규식 튜닝은 부수 리팩터 |
| INFO 9 (대형 워크플로우 slim 직렬화) | 프롬프트 비용·설계 리팩터. 별도 스레드 |
| INFO 10 (DYNAMIC_PORTS_RULE 상수 추출) | 현재 4곳 분산은 프롬프트 명시성을 높이기 위함. 단일 출처화는 정당하나 본 PR 의 산출물 가독성 저하 우려 |
| INFO 13 (테스트 마법 문자열 상수화) | 본 PR 산출물 범위와 무관한 리팩터. 추후 테스트 리팩터 라운드 |

## 검증

- `npx eslint "src/**/*.ts"` → 통과
- `npx jest src/modules/workflow-assistant` → 40 케이스 전부 통과
- `npx jest` (전체) → 1508 테스트 전부 통과 (+12 증가)
- `npx nest build` → 통과
- `frontend`: `npx tsc --noEmit` → 통과, `npx eslint` (assistant-panel/store/i18n) → 통과

## E2E 검증 절차 (사용자 확인)

1. backend 재시작 후 에디터 어시스턴트 패널 열기
2. "13 step 규모 워크플로우를 만들어줘" 류 요청 → plan 제시 단계에서 openQuestions 가 있다면 plan 카드에 **인라인 답변 입력창**이 보이는지 확인
3. 답변 전송 → 다음 턴에 LLM 이 답변을 받아 plan 실행에 반영하는지 확인
4. Approve 후 실행 → LLM 이 일부만 하고 finish 시도하면 서버가 block 하고 다음 라운드에서 나머지 step 을 실행하는지 확인 (로그에 `PLAN_NOT_COMPLETE` tool_result 확인 가능)
5. Switch 노드를 포함한 플로우를 만들어달라고 했을 때 LLM 이 `get_node_schema` 를 선행 호출 후 `source_port` 를 명시적으로 지정하는지 확인
