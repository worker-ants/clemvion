# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 guard 로직의 spec 불일치·미구현 항목과 DB 저장 누락이 실사용에서 LLM 오동작을 유발할 수 있음

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | **`openQuestions` 독립 gating 미구현** — spec §4.3·§8은 "pending step이 남아있거나 `openQuestions`가 있으면 서버가 실패를 반환"이라고 명시하지만, `evaluateFinishGuard`는 `pendingSteps.length === 0`이면 `openQuestions` 잔존 여부와 무관하게 `null`(정상 finish 허용)을 반환함 | `workflow-assistant-stream.service.ts` — `evaluateFinishGuard` | `pendingSteps.length === 0` 조건을 `pendingSteps.length === 0 && (activePlan.openQuestions ?? []).length === 0`으로 변경 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / API | **`note` action 스텝이 pending으로 오인** — `note` 스텝은 edit tool call이 없어 `completedStepIds`에 절대 포함되지 않아 plan에 note 스텝이 있으면 항상 PLAN_NOT_COMPLETE 반환 (`finishBlockCount` 안전밸브로 무한루프는 방지되나 LLM이 존재하지 않는 편집 시도) | `evaluateFinishGuard()` L531~L554 | `pendingSteps` 필터에 `s.action !== 'note'` 조건 추가 |
| 2 | Side Effect | **성공적인 `finish`가 DB에 저장되지 않아 미래 세션 맥락 유실** — 차단된 finish(`ok: false`)는 `pendingToolCalls`에 저장되지만 최종 성공 finish는 저장되지 않아, 다음 세션 rehydrate 시 LLM이 완료된 플랜을 미완료로 인식해 이미 완료된 step을 재실행할 수 있음 | `workflow-assistant-stream.service.ts` — finish 성공 처리 블록 | 성공한 finish도 `pendingToolCalls`에 push하거나, 차단 레코드에 `resolution: 'succeeded_in_later_round'` 필드 추가 |
| 3 | Spec 정합 | **2차 finish 차단 시 동작 spec·구현 불일치** — spec은 "반복 실패 시(2회 연속) error 이벤트로 종료" 명시, 구현은 두 번째 finish를 정상(`finishReason: 'stop'`)으로 통과시켜 미완성 plan이 성공으로 오인됨 (documentation·architecture·api_contract·requirement 4개 에이전트 공통 지적) | `evaluateFinishGuard` `finishBlockCount > 0` 분기 / spec §4.3·§10 | spec을 현재 구현 기준("정상 탈출")으로 수정하거나, 구현에서 2차 차단 시 `ASSISTANT_PLAN_ABANDONED` warning 이벤트 방출 |
| 4 | Requirement | **히스토리 plan 참조로 인한 false positive** — `planForTurn`이 null인 단독 편집 턴에서 `findLatestPlanInHistory`로 과거 미완성 plan(safety escape로 저장된)을 가져와 현재 무관한 편집이 잘못 차단됨 | `evaluateFinishGuard()` — `findLatestPlanInHistory` 호출 경로 | `planForTurn`이 null이고 현재 턴에 해당 plan의 `planStepId`를 가진 edit tool call이 없으면 history plan 체크 스킵 |
| 5 | Side Effect / Concurrency | **Round 1 usage 이벤트 소실** — finish 차단 후 `break`로 내부 루프를 탈출하면 이후 오는 `done` 이벤트(usage 정보 포함)가 소비되지 않아 Round 1 토큰 사용량이 클라이언트에 전달되지 않고 로그도 누락 (2개 에이전트 공통 지적) | `workflow-assistant-stream.service.ts` L229 (`break` 직후) | `break` 전 남은 이벤트 drain 또는 `done` 이벤트까지 계속 읽도록 수정 |
| 6 | Architecture / Data | **`isDynamicPorts` / `dynamicPorts` 이중 필드 불일치** — 동일한 의미의 필드명이 두 가지로 혼재. 향후 세 번째 변형 추가 시 누락 위험 (4개 에이전트 공통 지적) | `system-prompt.ts:30-32` | `NodeDefinitionView.metadata`를 `isDynamicPorts: boolean`으로 표준화, `dynamicPorts` deprecated 처리 후 제거 |
| 7 | Testing | **`findLatestPlanInHistory` 경로 및 히스토리 기반 `completedStepIds` 집계 미테스트** — 신규 3개 테스트 모두 동일 턴 `planForTurn`이 항상 세팅되어, 승인 후 다음 턴에서 finish하는 실제 사용 시나리오가 커버되지 않음 | `workflow-assistant-stream.service.spec.ts` | history에 plan을 가진 assistant 메시지를 포함한 fixture로 `planForTurn=null` 상태 PLAN_NOT_COMPLETE 테스트 추가; 이전 턴 완료 step이 집계에서 제외됨을 검증하는 테스트 추가 |
| 8 | Testing | **`openQuestions` 단독 차단 미구현 및 미테스트** — 모든 step 완료 후 `openQuestions`만 남은 경우 차단 로직 없음(Critical #1과 연계), 테스트도 부재 | `evaluateFinishGuard` L523-525 / spec | Critical #1 구현 후 해당 케이스 테스트 추가 |
| 9 | Testing | **`system-prompt.spec.ts` `dynamicPorts` 속성명 미테스트** — 프로덕션 코드는 `isDynamicPorts || dynamicPorts` 두 속성 확인하지만 테스트는 `isDynamicPorts: true`만 사용 | `system-prompt.spec.ts` | `dynamicPorts: true`만 있는 노드 fixture 추가 및 `[dynamic-ports]` 마커 부착 검증 |
| 10 | Security | **openQuestions 답변 입력창 길이 제한 부재** — 일반 MessageInput과 달리 plan 카드 textarea에 `maxLength` 미설정. 수 MB 답변 전송 시 SSE 과부하 및 LLM 컨텍스트 낭비 | `plan-card.tsx` — `<textarea>` | textarea에 `maxLength` 설정(예: 4000자); 백엔드 DTO에도 `@MaxLength` 추가 |
| 11 | Side Effect | **스트리밍 중 PlanCard 재전송 가능** — `submitAnswer`가 `isStreaming` 여부를 확인하지 않아 응답 스트리밍 중 추가 전송 가능 (하단 MessageInput은 `disabled={streaming}` 처리되어 있으나 plan-card textarea는 미처리) | `plan-card.tsx` — `submitAnswer` | `onAnswerQuestions` prop과 함께 `isStreaming` 상태를 받거나 `canSubmitAnswer` 조건에 포함 |
| 12 | Documentation | **Spec §13 i18n 테이블 누락** — `planQuestionsTitle`, `planQuestionsPlaceholder`, `planQuestionsSend` 3개 키가 `en.ts`/`ko.ts`에 추가됐으나 spec §13 테이블에 미반영 (2개 에이전트 공통 지적) | `spec/3-workflow-editor/4-ai-assistant.md` §13 | spec §13에 3개 키·한국어·영어 행 추가 |
| 13 | Documentation | **`system-prompt.ts` JSDoc few-shot 개수 불일치** — JSDoc이 "3개"라고 명시하지만 실제로는 5개 | `system-prompt.ts:8` (JSDoc 헤더) | JSDoc을 "5개 (간단 수정 / 캔버스 조회 / 신규 워크플로우 / 동적 포트 분기 / 복잡 요청)"으로 수정 |
| 14 | Documentation | **클래스 JSDoc에 `finish` 가드 흐름 누락** — PLAN_NOT_COMPLETE 블로킹·루프 재순환 핵심 동작이 클래스 JSDoc에 없어 유지보수자 오해 위험 | `workflow-assistant-stream.service.ts:90~106` | `- finish` 항목에 `evaluateFinishGuard` 동작 및 `finishBlockCount` 설명 추가 |
| 15 | Requirement | **승인된 plan에도 answer input 노출** — `plan.approved` 체크 없이 `onAnswerQuestions`가 있으면 항상 답변 입력창 표시, 실행 완료된 plan 카드에서 사용자 혼동 유발 | `plan-card.tsx` — openQuestions 렌더 조건 | `{!plan.approved && onAnswerQuestions && ...}`로 제한 |
| 16 | API Contract | **`AssistantMessageView.onAnswerPlanQuestions` 필수 prop 추가** — optional 없이 필수로 추가되어 현재 확인된 호출지 외 다른 소비자(Storybook, 테스트)가 있으면 빌드 오류 (2개 에이전트 공통 지적) | `assistant-message.tsx:10` | optional(`onAnswerPlanQuestions?: ...`)로 선언하거나 코드베이스 전체 호출지 확인 |
| 17 | Architecture | **`WorkflowAssistantStreamService` God Class 심화** — `evaluateFinishGuard`, `findLatestPlanInHistory` 추가로 단일 서비스가 7가지 이상 책임 담당, 700줄+ SRP 위반 | `workflow-assistant-stream.service.ts` 전체 | `PlanCompletionGuard` 또는 `FinishGuardService`로 플랜 검증 로직 분리 고려 |
| 18 | Performance | **시스템 프롬프트 토큰 비용 급증** — few-shot 예시 2개 추가·규칙 섹션 확장으로 프롬프트 볼륨 증가, MAX_TOOL_CALLS_PER_TURN=32 상황에서 루프가 길어질수록 누적 비용 증가 | `system-prompt.ts` 전체 / `workflow-assistant-stream.service.ts:68` | Anthropic prompt caching 적용 여부 확인; 대형 워크플로우용 slim 직렬화 전략 검토 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | **`WorkflowAssistantMessage` top-level import 미선언** — `evaluateFinishGuard`, `findLatestPlanInHistory` 파라미터에 인라인 `import('./entities/...').WorkflowAssistantMessage[]` 반복 (3개 에이전트 공통) | `workflow-assistant-stream.service.ts:491, 521` | 파일 상단에 `import type { WorkflowAssistantMessage }` 추가 후 3곳 정리 |
| 2 | Maintainability | **`evaluateFinishGuard` 반환 타입 인라인 리터럴** — 6개 필드 복잡한 객체 타입이 메서드 시그니처에 직접 기술 | `workflow-assistant-stream.service.ts` — `evaluateFinishGuard` 반환 타입 | `type FinishGuardError = { ... }`로 추출 후 `FinishGuardError \| null`로 선언 |
| 3 | Concurrency | **PlanCard 이중 제출(double-submit) 가능성** — React 상태 업데이트 배치로 인해 버튼 연속 클릭 시 첫 번째 disabled 렌더 전에 두 번째 제출 통과 가능 | `plan-card.tsx` — `submitAnswer` | `isSubmitting` ref 기반 가드 또는 서버 측 중복 턴 감지 |
| 4 | Side Effect | **Plan step ID 네임스페이스 미지정** — LLM이 `s1`, `s2` 같은 단순 ID 생성 시 이전 플랜의 `s1`과 새 플랜의 `s1`이 충돌해 guard가 "이미 완료됨"으로 오판(false negative) | `evaluateFinishGuard` — `completedStepIds` 집계 | step ID를 플랜 ID로 네임스페이스(`${planId}::${stepId}`) 또는 이번 턴 신규 plan이면 히스토리 completed IDs 무시 |
| 5 | Testing | **PLAN_NOT_COMPLETE 응답의 `openQuestions` 필드 미검증** | `workflow-assistant-stream.service.spec.ts:648~656` | `expect(Array.isArray(parsed.openQuestions)).toBe(true)` 또는 실제 값 검증 추가 |
| 6 | Testing | **차단된 `finish` tool call의 DB persist 내용 미검증** | `workflow-assistant-stream.service.spec.ts` | `appendMessage`로 저장된 assistant 메시지의 `toolCalls` 내용 검증 추가 |
| 7 | Testing | **프론트엔드 `plan-card.tsx` 신규 UI 테스트 부재** — Enter 키 제출, 제출 후 state 초기화, `canSubmitAnswer` 조건 등 | `frontend/src/components/editor/assistant-panel/plan-card.tsx` | 해당 인터랙션 로직에 대한 컴포넌트 테스트 추가 |
| 8 | Testing | **`system-prompt.spec.ts` 정규식 분기 `without .*finish` 의미 불일치** | `system-prompt.spec.ts` — `toMatch(/do ?not call .*finish\|must not .*finish\|without .*finish/)` | 실제 프롬프트 어구 기반으로 좁히거나 `do not call.*finish`로 정리 |
| 9 | Performance | **대형 워크플로우에서 `JSON.stringify(current)` 선형 증가** — 수백 노드 워크플로우에서 단일 시스템 프롬프트가 수만 토큰 차지 | `system-prompt.ts:84` | 노드 수 임계치(예: 50개) 초과 시 id·type·label만 포함하는 slim 모드 분기 |
| 10 | Architecture | **`[dynamic-ports]` 규칙 4곳 분산 서술** — 향후 규칙 변경 시 4곳 동기화 필요 | `system-prompt.ts` — catalog·rules·2개 few-shot 섹션 | 핵심 규칙을 `const DYNAMIC_PORTS_RULE = '...'`로 추출 후 인터폴레이션으로 단일 출처 유지 |
| 11 | Side Effect | **`kind: 'finish'` DB 저장 신규 데이터 패턴** — `tool_calls` JSONB를 직접 쿼리하는 분석 코드나 exhaustive switch가 있으면 `'finish'` 케이스 누락 위험 | `workflow-assistant-message.entity.ts:14` + `toChatMessages` | `toChatMessages` 및 tool_calls 소비 코드에서 `kind === 'finish'` 케이스 명시적 처리 |
| 12 | Documentation | **spec과 구현 간 `finish` 2회 블록 종료 동작 불일치** (WARNING #3 후속) — 테스트 spec 파일 커버리지 목록 미갱신 | `workflow-assistant-stream.service.spec.ts:7~16` 파일 헤더 | PLAN_NOT_COMPLETE 3가지 시나리오를 목록에 추가 |
| 13 | Maintainability | **테스트 내 마법 문자열 상수 산재** — `'sess-1'`, `'ws-1'`, `'u-1'`, `'gpt-4o'` 등 반복 | `workflow-assistant-stream.service.spec.ts` | 파일 상단 `const TEST_IDS = { ... }` 상수 객체 정의 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | MEDIUM | `openQuestions` gating 미구현(CRITICAL), `note` step 오인, false positive |
| Testing | MEDIUM | `findLatestPlanInHistory` 경로 및 히스토리 집계 미테스트 |
| API Contract | MEDIUM | `note` step guard 누락, 2차 차단 spec 불일치, finish 계약 미문서화 |
| Side Effect | MEDIUM | 성공 finish DB 미저장, usage 이벤트 소실, step ID 충돌 |
| Documentation | MEDIUM | spec·JSDoc 불일치 다수 (spec §13 누락, 2차 차단 동작 불일치) |
| Security | LOW | 워크플로우 프롬프트 인젝션(구조적), 답변 입력창 길이 미제한 |
| Performance | LOW | 시스템 프롬프트 토큰 증가, 대형 워크플로우 직렬화 |
| Architecture | LOW | God Class 심화, 인라인 import 타입, 플랜 닫기 메커니즘 부재 |
| Concurrency | LOW | finish 차단 시 usage 소실, PlanCard 이중 제출 |
| Maintainability | LOW | 이중 필드 체크, 인라인 반환 타입, 테스트 마법 문자열 |
| Dependency | LOW | `WorkflowAssistantMessage` 인라인 import |
| Database | LOW | JSONB 타입 확장만, 마이그레이션 불필요 |
| Scope | NONE | 모든 변경이 의도된 범위 내 |

---

## 발견 없는 에이전트

- **Scope** — 의도된 범위를 벗어난 변경 없음

---

## 권장 조치사항

1. **[즉시 필수]** `evaluateFinishGuard`에 `openQuestions` blocking 추가 — `pendingSteps.length === 0 && openQuestions.length === 0` 조건으로 변경 (spec §4.3 이행)
2. **[즉시 필수]** `note` action 스텝을 `pendingSteps` 필터에서 제외 — `s.action !== 'note'` 조건 추가로 불필요한 PLAN_NOT_COMPLETE 방지
3. **[즉시 필수]** 성공적인 `finish`를 `pendingToolCalls`에 저장 — 다음 세션 rehydrate 시 LLM이 완료된 플랜을 미완료로 인식하는 버그 차단
4. **[단기]** Spec §4.3·§10 수정 — 2차 차단 시 동작을 "정상 탈출(`finishReason: stop`)"로 명시하여 구현과 일치
5. **[단기]** Spec §13 i18n 테이블에 `planQuestionsTitle`, `planQuestionsPlaceholder`, `planQuestionsSend` 3개 키 추가
6. **[단기]** `findLatestPlanInHistory` 경로 및 히스토리 기반 `completedStepIds` 집계 테스트 추가 — 승인 후 다음 턴 finish 시나리오 커버
7. **[단기]** `openQuestions` 답변 textarea에 `maxLength` 설정 및 스트리밍 중 재전송 방지 처리
8. **[중기]** `isDynamicPorts` / `dynamicPorts` 필드명 통일 — `NodeDefinitionView.metadata` 타입 표준화
9. **[중기]** Plan step ID 네임스페이스 도입 — `${planId}::${stepId}` 형태로 이전 플랜 completed IDs 충돌 방지
10. **[중기]** `WorkflowAssistantMessage` top-level import 정리 및 `FinishGuardError` 타입 추출