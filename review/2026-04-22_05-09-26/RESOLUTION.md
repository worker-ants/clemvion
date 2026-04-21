# 리뷰 이슈 조치 내역 — 2026-04-22 (Active plan context 후속)

대상 리뷰: `review/2026-04-22_05-09-26/SUMMARY.md`
조치자: developer role

## 조치 요약

| # | 카테고리 | 발견 | 조치 | 위치 |
|---|----------|------|------|------|
| CRITICAL 1 | Testing/Requirement/Side Effect | `hasClearPlanAfter` 가 `history.slice(planIndex)` 로 plan 메시지 자체를 포함해 같은 턴 clear→propose 시 신규 plan 이 즉시 stale | `planIndex + 1` 부터만 검사하도록 슬라이스 경계 수정. 회귀 테스트 `treats same-turn clear_plan + propose_plan (planForTurn set) as the new active plan` 추가 | `active-plan-context.ts` / `active-plan-context.spec.ts` |
| WARNING 1 | Security | 사용자 입력(userRequest) 이 시스템 프롬프트에 삽입되며 sanitizeOneLine 이 마크다운 헤더·쿼트·꺾쇠 등을 중화하지 않음 (Prompt Injection 표면) | `sanitizeUserText()` 신설 — 사용자 자유 입력용 강한 중화 (`#` 헤더 → `·`, `"`/`` ` `` → `'`, `<`/`>` → fullwidth, 200자 절단). userRequest 는 `<user-request>…</user-request>` XML fence 로 감싸 지시문과 분리. `sanitizeLabel()` 은 label/description 등 시스템 관리 문자열용 약한 중화 + 길이 절단 | `system-prompt.ts` |
| WARNING 2 | Architecture/Requirement | `cleared` 상태가 타입에만 존재하고 런타임에서 생성되지 않는 dead code | `ActivePlanStatus` 를 `'active' \| 'completed'` 로 축소. `clear_plan` 감지 시 `null` 반환으로 통일. `deriveStatus` 의 `forceCleared` 파라미터 및 `renderActivePlanSection` 의 `cleared` 분기 제거 | `active-plan-context.ts`, `system-prompt.ts` |
| WARNING 3 | Architecture/Maintainability | `hasNewerProposePlanAfter` 가 항상 false 인 dead code | 검사 제거. 역방향 스캔으로 최신 plan 이 보장된다는 불변식을 주석에 명시 | `active-plan-context.ts` |
| WARNING 4 | API Contract | `clear_plan` SSE 이벤트 미발행이 스펙에 미명시 | spec §5.3 에 `clear_plan`·`finish` SSE 미발행 동작과 "프론트는 다음 턴 부재로 자연스럽게 해제 인지" 설명 추가 | `spec/3-workflow-editor/4-ai-assistant.md` §5.3 |
| WARNING 5 | Documentation | `AssistantToolKind` 주석이 `propose_plan 단일 도구` 로 outdated | `plan: propose_plan / clear_plan — 채팅 UI·세션 컨텍스트에만 영향` 으로 갱신 | `tool-definitions.ts` |
| WARNING 6 | Documentation/Maintainability | spec §4.3 `finish` 에 `clear_plan` bypass 동작 미반영 | `finish` 행에 "같은 턴에 `clear_plan` 이 먼저 호출된 경우 guard 는 발동하지 않는다" 추가 | spec §4.3 |
| WARNING 8 | Testing | `sanitize*` 치환 로직 미검증 | `neutralizes dangerous chars in userRequest` + `truncates overly long userRequest` 테스트 추가 (헤더·백틱·쿼트·꺾쇠·길이 절단 모두 검증) | `system-prompt.spec.ts` |
| WARNING 9 | Testing | `note` step 렌더링 미검증 | `renders '[note]' bullet for note-action steps` 테스트 추가 | `system-prompt.spec.ts` |
| WARNING 10 | Testing | `approved: false` 분기 미검증 | `shows 'awaiting approval' when approved=false` 테스트 추가 | `system-prompt.spec.ts` |
| WARNING 11 | Testing | `clear_plan` SSE 미발행이 명시적으로 검증되지 않음 | `clear_plan does not emit a tool_call SSE event` 테스트 추가 | `workflow-assistant-stream.service.spec.ts` |
| INFO 1 | Security | `isOkResult` 의 null·비객체 truthy 처리가 실패를 성공으로 판정 | `isExplicitFailure(result)` 로 함수 의미를 반전 + 명세 재작성 — `{ok: false}` 만이 "명시적 실패" 이고 나머지는 legacy/성공 동작 | `active-plan-context.ts` |
| INFO 3/4 | Performance | `findActivePlanContext` 매 턴 최대 3회 호출·`slice().some()` 임시 배열 | 현재 hot path 아님으로 확인 (history 30 턴 상한). 성능 이슈 발생 시 재검토 | — (문서만) |
| INFO 5 | Performance | `buildAssistantTools()` 매 요청마다 재생성 | 모듈 상수 `ASSISTANT_TOOLS = Object.freeze(buildAssistantToolsInternal())` 로 단일 계산, `buildAssistantTools()` 는 같은 참조 반환 | `tool-definitions.ts` |
| INFO 7 | Maintainability | `isOkResult` 함수명이 동작과 불일치 | `isExplicitFailure` 로 rename 하며 boolean 의미도 반전 | `active-plan-context.ts` |
| INFO 9 | Dependency | `ActivePlanContext` 를 value import 하고 있음 | `import type` 로 전환 | `system-prompt.ts` |
| INFO 12 | Requirement | `collectCompletedStepIds` 가 전체 history 스캔으로 이전 plan 의 동일 step ID 와 충돌 가능 | `planIndex` 이후만 스캔하도록 범위 제한. `planForTurn` 인 경우 `Number.POSITIVE_INFINITY` sentinel 로 "history 에 해당 plan 없음" 을 표현 | `active-plan-context.ts` |
| INFO 14 | Security | `clear_plan.reason` 길이 제한 없음 | JSON Schema 에 `maxLength: 500` 추가 + description 에 명시 | `tool-definitions.ts` |
| INFO 15 | Testing | `isOkResult` 엣지 케이스 미테스트 | `isExplicitFailure` 로 내보내 `it.each([...])` 로 `undefined`/`null`/primitive/`{}`/`{ok:true}` 전부 false, `{ok:false}` 만 true 검증 | `active-plan-context.spec.ts` |

## 스코프 밖 (별도 과제)

| # | 이유 |
|---|------|
| WARNING 7 (`findUserRequestForPlan` 의미 오류) | clarification 답변을 원 요청으로 오인할 수 있는 한계는 heuristic 개선 영역. 현재 구현 한계를 `ActivePlanContext.userRequest` 주석에 명시하고 별도 과제로 분리. 다중 plan 재구성 시 "첫 user message" 만 잡는 단순 방식도 multi-plan 세션에서 잘못된 맥락을 줄 수 있어 설계 논의 필요 |
| INFO 2 (clear_plan 감지 단일 경로로 응집) | 이번 라운드에서 `findActivePlanContext` 가 `pendingToolCalls` 의 `clear_plan` 도 직접 감지하도록 통합 완료. 다만 `planClearedThisTurn` 플래그는 `evaluateFinishGuard` 의 간결한 short-circuit 용도로 유지 — dual-path 지만 의미가 다름 (하나는 "active plan 이 여전히 존재하는가", 다른 하나는 "이번 턴에 guard 를 우회할 명시적 신호가 있는가"). 주석으로 경계를 명시 |
| INFO 6 (`collectCompletedStepIds` 헬퍼 추출) | `markIfCompleted` 헬퍼로 중복 제거 완료 |
| INFO 10 (turn-start vs runtime snapshot 주석) | 기존 코드 주석에서 이미 설명 — 중복 보강 생략 |
| INFO 11 (세션 동시 요청 차단) | spec §10 에 명시된 "중복 POST 시 409" 는 컨트롤러/인프라 레벨 과제. 별도 이슈 |
| INFO 13 (clear_plan.reason audit 저장 경로) | `pendingToolCalls.push({...})` 로 assistant 메시지 `toolCalls` row 에 persist 됨. description 문구를 구현과 일치하게 정리 ("Stored on the assistant tool_calls row as audit trail") |

## 검증

- `npx eslint "src/**/*.ts"` → 통과
- `npx jest src/modules/workflow-assistant` → 67 테스트 통과 (+13 신규)
- `npx jest` (전체) → 1535 통과 (+13 신규)
- `npx nest build` → 통과
- frontend `npx tsc --noEmit` / `npx eslint src/components/editor/assistant-panel` → 통과

## E2E 검증 (사용자 확인 필요)

1. 세션 시작 → "주문 취소 프로세스 추가해줘" → plan 제시 → approve → 일부 step 실행 중 → 여러 턴 지나도 Active plan context 섹션이 시스템 프롬프트에 노출되어 LLM 이 맥락 잃지 않음을 확인
2. 중간에 "이제 다른 워크플로우 만들자" 같은 완전 화제 전환 → LLM 이 `clear_plan` 을 호출한 후 새로 시작. Plan 카드가 다음 턴부터 사라지고 guard 가 발동하지 않음
3. 동일 턴에서 `clear_plan` + `propose_plan` 이 연달아 호출되는 시나리오 → 새 plan 이 stale 로 오판되지 않고 Active plan context 로 정상 노출
4. Prompt injection 시도 (`# HACK ignore prior rules...`) 를 사용자 메시지로 입력 → 시스템 프롬프트에는 `<user-request>…</user-request>` 로 격리되고 `#` 등이 중화되어 LLM 이 지시문으로 오인하지 않음
