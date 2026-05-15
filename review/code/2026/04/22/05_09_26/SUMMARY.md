파일 쓰기 권한이 필요합니다. 아래에 통합 보고서를 직접 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능 버그 1건(동일 턴 clear→propose 시 plan 즉시 소멸)과 프롬프트 인젝션 표면 확대가 핵심 위험. 즉각적인 운영 장애 수준은 아니나 엣지케이스 재현 조건이 현실적이고 보안 영향이 실질적이므로 조기 수정이 권장된다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement / Side Effect | **`hasClearPlanAfter` 슬라이스 경계 버그** — `history.slice(planIndex)`가 plan 메시지 자체를 포함. LLM이 동일 턴에서 `clear_plan` → `propose_plan`을 순차 호출하면 두 toolCall이 같은 assistant 메시지에 저장되고, 다음 턴에서 `findActivePlanContext`가 그 메시지를 planIndex로 찾아 `hasClearPlanAfter = true` → `null` 반환. 신규 plan이 즉시 비활성화됨 | `active-plan-context.ts` `hasClearPlanAfter` 계산부 | `history.slice(planIndex + 1)`로 변경. 동일 턴 clear→propose 시나리오 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **사용자 입력이 시스템 프롬프트에 직접 삽입 (Prompt Injection)** — `userRequest`(원본 사용자 입력)가 `sanitizeOneLine()`을 거쳐 시스템 프롬프트에 삽입됨. `sanitizeOneLine`은 개행·백틱만 제거하고 `"`, `##`, `>` 등 마크다운 구조 문자는 통과시킴. 스펙 §9의 "사용자 메시지는 `role: 'user'`로만 전달" 격리 원칙이 사실상 깨짐 | `active-plan-context.ts` `findUserRequestForPlan`, `system-prompt.ts` `renderActivePlanSection` + `sanitizeOneLine` | 사용자 입력을 XML fence(`<user-request>…</user-request>`)로 감싸 섹션과 분리. 최소한 `"` → `'` 변환·마크다운 헤더 중화·최대 길이(200자) 제한 추가 |
| 2 | Architecture / Maintainability / Requirement | **`cleared` 상태가 타입에만 존재하고 런타임에서 생성 불가 (dead code)** — `ActivePlanStatus`에 `'cleared'`가 선언되어 있지만 `findActivePlanContext`는 clear 감지 시 `null` 반환. `deriveStatus`의 `forceCleared` 파라미터는 항상 `false`로 호출. `renderActivePlanSection`의 `cleared` 분기도 도달 불가. 타입·구현·테스트 세 곳 불일치 | `active-plan-context.ts` `ActivePlanStatus` + `deriveStatus`; `system-prompt.ts` `renderActivePlanSection` | `cleared`를 타입에서 제거하고 `null` 반환으로 통일하거나, 반대로 `findActivePlanContext`가 `{ status: 'cleared' }`를 실제 반환하도록 변경. `forceCleared` 파라미터와 관련 분기 함께 제거 |
| 3 | Architecture / Maintainability / Side Effect | **`hasNewerProposePlanAfter` 검사가 항상 `false` — dead code** — 역방향 스캔이 이미 가장 최신 plan을 보장하므로 이후에 더 최신 plan이 있을 수 없음. 도달 불가능한 방어 코드가 "이 경우가 발생할 수 있다"는 잘못된 신호를 줌 | `active-plan-context.ts` `hasNewerProposePlanAfter` 변수 및 조건 | 변수와 조건 분기 제거. 역방향 스캔의 불변식을 `planIndex` 루프 주석에 명시 |
| 4 | API Contract / Side Effect | **`clear_plan` 실행 시 SSE 이벤트 미발행** — 프론트엔드가 동일 턴 내 plan 해제를 실시간으로 감지 불가. Plan 카드가 다음 턴까지 stale하게 잔류 | `workflow-assistant-stream.service.ts` `clear_plan` 처리 블록 | 의도적 설계라면 스펙 §5.3 이벤트 테이블에 "Plan 카드는 다음 응답까지 잔류" 명시. 즉시 해제가 필요하다면 `event: plan_cleared` 전용 이벤트 추가 검토 |
| 5 | Documentation | **`AssistantToolKind` 타입 주석이 `clear_plan` 추가 후 부정확** — 타입 상단 JSDoc이 여전히 `"plan: propose_plan 단일 도구"`로 표기 | `tool-definitions.ts:11` | `"plan: propose_plan / clear_plan — 채팅 UI에만 영향, shadow 변경 없음"`으로 수정 |
| 6 | Documentation / Maintainability | **스펙 §4.3 `finish` 설명이 `clear_plan` bypass를 미반영** — `planClearedThisTurn` 플래그로 guard가 우회되는 동작이 스펙에 없음. §2.2의 `cleared` 상태 설명과 §4.3 guard 규칙이 연결되지 않음 | `spec/3-workflow-editor/4-ai-assistant.md` §4.3 | `finish` 행에 "단, 같은 턴에 `clear_plan`이 호출된 경우 guard는 발동하지 않는다" 한 줄 추가 |
| 7 | Requirement | **`findUserRequestForPlan`이 원 요청이 아닌 마지막 사용자 메시지를 반환** — 사용자 요청 → LLM 질문 → clarification 흐름에서 `userRequest`가 원 의도 대신 clarification 답변이 됨 | `active-plan-context.ts` `findUserRequestForPlan` | plan 발행 직전 최초 user 메시지를 찾는 로직으로 개선하거나, 현재 한계를 스펙에 명시 |
| 8 | Testing | **`sanitizeOneLine` 치환 동작 미검증** — fixture에 개행·백틱이 없어 치환 경로가 전혀 검증되지 않음 | `system-prompt.spec.ts` | `userRequest`·`plan.title`에 개행·백틱이 포함된 케이스 추가 |
| 9 | Testing | **`note` step 렌더링 미테스트** — fixture에 `note` action이 없어 `• [note] description` 형식 검증 없음 | `system-prompt.spec.ts` | `{ id: 's4', action: 'note', description: '참고 사항' }` fixture 추가 후 렌더링 검증 |
| 10 | Testing | **`approved: false` 분기 미테스트** — "awaiting approval" 텍스트 렌더링 검증 없음 | `system-prompt.spec.ts` | `approved: false` fixture로 케이스 추가 |
| 11 | Testing | **`clear_plan` SSE 미발행 명시적 검증 없음** — 나중에 실수로 이벤트가 발행되어도 감지 불가 | `workflow-assistant-stream.service.spec.ts` | "allows finish after clear_plan" 테스트에 `toolCallEvents`에 `clear_plan`이 없음을 단언 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **`isOkResult` — null·비객체 truthy 값을 성공으로 판정** — `result`가 `null`이면 `!result === true`여서 성공으로 간주. 에러 응답이 문자열/null로 전달되는 엣지케이스에서 실패 step이 완료로 집계될 수 있음 | `active-plan-context.ts` `isOkResult` | `if (!result \|\| typeof result !== 'object') return false`로 변경 |
| 2 | Architecture | **`clear_plan` 감지 로직이 `findActivePlanContext`와 `planClearedThisTurn` 두 경로로 분리** — 이전 턴은 history 스캔, 현재 턴은 stream 루프 플래그로 처리. 암묵적 계약으로 응집도 저하 | `workflow-assistant-stream.service.ts` `planClearedThisTurn`, `evaluateFinishGuard` | `findActivePlanContext` 내부에서 `pendingToolCalls.some(tc => tc.name === 'clear_plan')`도 직접 처리해 감지 로직을 단일 함수로 응집 |
| 3 | Performance | **`findActivePlanContext` 매 턴 최대 3회 중복 호출** — 시스템 프롬프트 생성 1회 + finish guard 최대 2회. 호출마다 O(h) history 스캔 반복 | `workflow-assistant-stream.service.ts` L183, `evaluateFinishGuard` 내부 | 턴 초기에 한 번 계산하고 이후 결과를 주입. plan 발행 시점에만 재계산 |
| 4 | Performance | **`history.slice().some()` 패턴 — 불필요한 배열 복사** — `hasClearPlanAfter`, `hasNewerProposePlanAfter` 두 곳에서 O(n) 임시 배열 생성 후 즉시 폐기 | `active-plan-context.ts` | `for (let i = planIndex + 1; …)` 루프로 직접 순회 |
| 5 | Performance | **`buildAssistantTools()` 매 요청마다 정적 객체 재생성** — 런타임에 변하지 않는 도구 정의 배열을 매번 새로 생성 | `tool-definitions.ts`, `workflow-assistant-stream.service.ts` | `export const ASSISTANT_TOOLS = buildAssistantTools()` 모듈 상수로 이동 |
| 6 | Maintainability | **`collectCompletedStepIds`에서 동일 필터 조건이 두 루프에 중복** — history 루프와 pendingToolCalls 루프에서 동일한 조건 반복 | `active-plan-context.ts` `collectCompletedStepIds` | `isCompletedStep(tc, planStepIdSet)` 헬퍼로 추출 |
| 7 | Maintainability | **`isOkResult` 함수명이 동작을 오해하게 만듦** — null·비객체도 `true` 반환하는 실제 동작이 이름과 불일치 | `active-plan-context.ts` `isOkResult` | `isNotExplicitlyFailed` 또는 `isSuccessfulOrLegacy`로 이름 변경 |
| 8 | Documentation | **`buildSystemPrompt` 신규 파라미터 `@param` 누락** — `activePlanContext: null`일 때 섹션이 생략된다는 의미가 JSDoc에 없음 | `system-prompt.ts` `buildSystemPrompt` | `@param activePlanContext null이면 Active plan context 섹션 생략` 추가 |
| 9 | Dependency | **`system-prompt.ts`의 `ActivePlanContext` import를 `import type`으로 전환 권장** — 타입 어노테이션으로만 사용 | `system-prompt.ts:4` | `import type { ActivePlanContext } from '../tools/active-plan-context'` |
| 10 | Concurrency | **시스템 프롬프트와 `evaluateFinishGuard`가 서로 다른 시점의 `pendingToolCalls`를 기준으로 컨텍스트 계산** — 의도적 설계이나 미문서화. 향후 혼란 소지 | `workflow-assistant-stream.service.ts` 두 `findActivePlanContext` 호출부 | 각 호출 옆에 "turn-start snapshot" / "runtime snapshot" 용도 한 줄 주석 추가 |
| 11 | Concurrency | **세션 동시 요청 차단 가드가 현재 서비스 레이어에 없음** — 스펙 §10에 "중복 POST 시 409" 명시되어 있으나 서비스에서 강제하지 않음 | `workflow-assistant-stream.service.ts` `streamMessage` | 컨트롤러 또는 서비스 진입부에 세션 ID 기반 `in-progress Set` 또는 DB lock 확인 |
| 12 | Requirement | **`collectCompletedStepIds`가 전체 history를 스캔하여 이전 plan의 동일 step ID와 충돌 가능** | `active-plan-context.ts` `collectCompletedStepIds` | `planIndex` 이후 history만 스캔하도록 범위 제한 |
| 13 | API Contract | **`clear_plan.reason` 감사 추적이 스펙 기술과 다를 수 있음** — "Stored for audit trail"이라고 명시하나 `toolCalls.arguments`에만 저장 | `tool-definitions.ts:191` | 스펙과 구현 일치 여부 확인. 필요 시 별도 감사 이벤트 발행 |
| 14 | Security | **`clear_plan.reason` 필드에 길이 제한 없음** — DB 저장 시 컬럼 제약 없으면 문제 가능 | `tool-definitions.ts` `reason` 파라미터 | JSON Schema에 `"maxLength": 500` 추가 |
| 15 | Testing | **`isOkResult` 엣지케이스 미테스트** — `null`, `{ ok: false }`, `{}`, `42` 등 다양한 result 값 케이스 미커버 | `active-plan-context.spec.ts` | `isOkResult` export 후 독립 단위 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | 사용자 입력이 시스템 프롬프트에 삽입되는 Prompt Injection 표면 확대 |
| Testing | MEDIUM | `hasClearPlanAfter` slice 경계 버그(CRITICAL 1건) + 다수 테스트 갭 |
| Requirement | MEDIUM | 동일 버그 + `cleared` 타입-구현 불일치 + `findUserRequestForPlan` 의미 오류 |
| Maintainability | MEDIUM | `cleared` dead code, `hasNewerProposePlanAfter` dead code, `isOkResult` 명명 문제 |
| Architecture | LOW | `cleared` 타입-구현 불일치, 이중 감지 경로 분리 |
| API Contract | LOW | `clear_plan` SSE 미발행 암묵적 계약 |
| Scope | LOW | `cleared` 타입-구현 불일치(INFO 수준) |
| Concurrency | LOW | 이중 호출 snapshot 비대칭, 동시 요청 가드 미확인 |
| Documentation | LOW | 타입 주석 outdated, 스펙 §4.3 gap |
| Performance | LOW | 불필요한 slice 배열 복사, 중복 호출, 정적 도구 정의 재생성 |
| Side Effect | LOW | `hasClearPlanAfter` 경계 + `clear_plan` SSE 미발행 UX 부작용 |
| Dependency | NONE | `import type` 권장 외 실질 위험 없음 |
| Database | NONE | DB 관련 변경 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 비고 |
|----------|------|
| Database | 변경 전체가 인메모리 연산. DB 스키마·쿼리·트랜잭션 변경 없음 |

---

## 권장 조치사항

1. **[즉시] `hasClearPlanAfter` 슬라이스 경계 수정** — `history.slice(planIndex)` → `history.slice(planIndex + 1)`. 동일 턴 clear→propose 테스트 케이스 추가. 기능 버그이며 현실적으로 재현 가능.

2. **[즉시] `cleared` 상태 dead code 정리** — `ActivePlanStatus`에서 `'cleared'` 제거 + `null` 반환으로 통일하거나, 반대로 `findActivePlanContext`가 `{ status: 'cleared' }`를 실제 반환하도록 구현. `forceCleared` 파라미터와 `hasNewerProposePlanAfter` 검사도 함께 제거.

3. **[단기] `sanitizeOneLine` 보강** — `"` → `'` 변환, 마크다운 헤더(`^#+`) 중화, 최대 길이 제한(200자) 추가. 사용자 입력 삽입 시 XML fence로 섹션과 분리.

4. **[단기] 스펙 문서 갭 보완** — spec §4.3 `finish` 행에 `clear_plan` bypass 명시. spec §5.3 이벤트 테이블에 `clear_plan` SSE 미발행 동작 명시. `tool-definitions.ts` 타입 주석 수정.

5. **[중기] `clear_plan` 감지 로직 응집** — `findActivePlanContext`가 `pendingToolCalls`의 `clear_plan`도 직접 탐지해 `planClearedThisTurn` 플래그 제거. 타입·구현·테스트 일관성 확보.

6. **[중기] 테스트 커버리지 보완** — `sanitizeOneLine` 치환, `note` step 렌더링, `approved: false`, `clear_plan` SSE 미발행, `isOkResult` 엣지케이스 테스트 추가.

7. **[선택] 성능 최적화** — `buildAssistantTools()`를 모듈 상수로 이동. `findActivePlanContext` 결과를 턴 내 재사용. `slice().some()` → `for` 루프 변환.