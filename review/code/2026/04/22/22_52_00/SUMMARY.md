# Code Review 통합 보고서

## 전체 위험도
**LOW** — 핵심 설계(이중 방어선, 순수 함수 분리)는 건전하나, 멀티-라운드 오탐 경로·타입 동기화 누락·취약한 mock 어서션 등 유지보수·정확성 위험이 다수 중첩됨

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 사이드이펙트 | **복구 스캔 대상이 단일 라운드가 아닌 turn 전체 누적 `assistantText`** — 이전 라운드에서 설명 목적으로 emit된 plan-shaped JSON이 최종 라운드보다 먼저 탐지되어 오탐 복구가 발동할 수 있음 | `workflow-assistant-stream.service.ts` 복구 블록 | `lastRoundText`를 별도 추적하여 마지막 라운드 텍스트만 스캔 대상으로 한정 |
| 2 | 아키텍처 / 유지보수 | **`VALID_STEP_ACTIONS`가 엔티티 타입 유니온과 단절된 중복 정의** — 새 action 추가 시 컴파일러가 불일치를 감지하지 못함 | `recover-leaked-plan.ts:26-33` | 엔티티에서 `PLAN_STEP_ACTIONS as const`를 export하고 `VALID_STEP_ACTIONS = new Set(PLAN_STEP_ACTIONS)`로 파생; `ReadonlySet<AssistantStepAction>` 타입 지정 |
| 3 | 성능 | **`recoverLeakedPlan`의 O(n²) 최악 케이스** — `{`마다 `findMatchingBrace`를 재호출하며 내부 `{`를 재탐색; 매칭 실패 후 `i = end`로 점프하지 않음 | `recover-leaked-plan.ts` `recoverLeakedPlan` 함수 | 유효하지 않은 후보 이후 `i = end`로 점프하여 O(n) 보장; 상단에 `includes('"title"') && includes('"steps"')` fast-path 추가 |
| 4 | 보안 | **간접 프롬프트 인젝션 신규 공격 표면** — 공유 워크플로우 노드 데이터에 plan-shaped JSON을 심으면 LLM이 이를 텍스트로 echo → 자동 plan 생성·영속화 가능 | `workflow-assistant-stream.service.ts:640-683` | 복구 시 클라이언트에 "자동 복구된 계획"임을 시각적으로 구분 표시; `isProposePlanShape` 엄격 검증은 현재 유지 |
| 5 | 요구사항 | **plan JSON 누출과 편집 도구 동시 호출 시 상태 불일치** — `planForTurn`이 null인 채로 편집이 먼저 canvas에 적용되고 복구 후에야 plan이 생성되어 "승인 대기"가 되는 불일치 | `workflow-assistant-stream.service.ts` 복구 조건 | 복구 시 성공한 편집 tool call이 존재하면 경고 로그 추가 또는 복구 스킵; 최소한 코드 주석에 예외 케이스 명시 |
| 6 | 테스트 / 유지보수 | **`mock.calls[1][1]` 위치 기반 mock 어서션** — 서비스 내부 호출 순서 변경 시 무음 통과 위험 | `workflow-assistant-stream.service.spec.ts` `"scrubs the leaked JSON"` 외 | `appendMessage.mock.calls.find(([_, msg]) => msg.role === 'assistant')?.[1]` 역할 기반 탐색으로 교체 |
| 7 | 테스트 | **`steps: []` 빈 배열 케이스 미테스트** — `isProposePlanShape`가 빈 배열을 거부하지만 회귀 테스트 없음 | `recover-leaked-plan.spec.ts` | `recoverLeakedPlan('{ "title": "plan", "steps": [] }')` → `null` 케이스 추가 |
| 8 | 테스트 | **멀티-delta 분할 스트리밍 시나리오 미테스트** — JSON이 여러 `text_delta`로 쪼개져 도착하는 실사 패턴 미반영 | `workflow-assistant-stream.service.spec.ts` | `text_delta` 3~4개로 JSON을 분할 전송하는 it-block 추가 |
| 9 | 테스트 / 요구사항 | **SSE `plan` 이벤트의 `openQuestions` 필드 미검증** — 픽스처에 포함됐으나 SSE 이벤트 shape 계약이 고정되지 않음 | `workflow-assistant-stream.service.spec.ts` `"emits a synthetic plan SSE event"` | `expect(planEvent!.data).toMatchObject({ openQuestions: [...] })` 추가 |
| 10 | 문서화 | **공개 함수 `recoverLeakedPlan`에 JSDoc 누락** — 파일 레벨 설명만 있고 `@param`/`@returns` 없음 | `recover-leaked-plan.ts:45` | `@param text`, `@returns RecoveredPlan \| null` JSDoc 추가 |
| 11 | 문서화 | **`streamMessage` 클래스 JSDoc에 복구 단계(4.5) 미반영** — 4→5 흐름 기술에 누출 감지·합성 plan 발행 단계 누락 | `workflow-assistant-stream.service.ts` 클래스 JSDoc | `* 4.5 turn 종료 직전 propose_plan leak 감지 → 합성 tool call 로 변환 (option B)` 항목 추가 |
| 12 | 문서화 | **`workflow-assistant-stream.service.spec.ts` 파일 상단 JSDoc에 신규 테스트 그룹 미반영** | 파일 최상단 JSDoc | `- propose_plan JSON leak recovery → synthetic plan SSE event, text scrub, non-duplication guard` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / 유지보수 / 아키텍처 | **`findMatchingBrace`의 단일 따옴표 처리** — JSON 표준 외 `'`를 문자열 경계로 처리; `"it's done"` 내 apostrophe에서 depth 오염 이론상 가능 (실제 영향은 `JSON.parse` 단계에서 차단) | `recover-leaked-plan.ts:63-64` | `inString` 추적에서 `"'"` case 제거, double-quote만 처리 |
| 2 | 다수 | **`String.prototype.replace(string, '')` 첫 번째 발생만 제거** — 동일 JSON 블록이 두 번 등장 시 두 번째 잔류; 설계 의도와 부합하나 불명확 | `workflow-assistant-stream.service.ts:669` | `replaceAll` 또는 명시적 RegExp 사용, 또는 "first occurrence only" 주석 추가 |
| 3 | API 계약 | **합성 plan 이벤트 `id`가 `leak_${uuid}` 형태** — 정상 경로의 `call_abc123`과 포맷 다름 | `workflow-assistant-stream.service.ts` 복구 블록 | 프론트엔드가 opaque key로만 처리하는지 확인; 그렇지 않으면 포맷 통일 또는 문서화 |
| 4 | API 계약 | **`result.recovered: true` 필드가 `AssistantToolCallRecord` 타입과 불일치** — LLM history rehydration 시 예상치 못한 필드 포함 가능 | `workflow-assistant-stream.service.ts` 복구 블록 | history 전달 시 `recovered` 필드 strip 또는 별도 타입 가드 추가 |
| 5 | API 계약 | **markdown code fence 내 JSON 스크럽 시 fence 마커 잔류 가능** — `matched`가 `{`부터 시작하므로 fence 마커가 `assistantText`에 남을 수 있음 | `recover-leaked-plan.ts`, `workflow-assistant-stream.service.ts` | code fence 전체를 감지하는 별도 경로 추가 또는 `matched` 반환 시 fence 포함 여부 명시 |
| 6 | 동시성 | **`expressionReferenceCache` 모듈 스코프 뮤터블** — 현재 단일 스레드에서 안전하나 worker_threads 도입 시 benign race 가능 | `system-prompt.ts:28` | 현재 불필요; Worker 도입 시 `onModuleInit`으로 초기화 이동 |
| 7 | 유지보수 | **`describe('option B')` 구현 세부사항 노출** — 설계 문서 명칭이 테스트 이름에 포함 | `workflow-assistant-stream.service.spec.ts:2303` | `describe('server-side plan leak recovery')`로 변경 |
| 8 | 유지보수 | **`STATIC_BLOCK_1_ROLE_AND_TURN_OP` 지속 성장** — 수백 줄 템플릿 리터럴에 섹션 계속 추가 | `system-prompt.ts` | 즉각 불필요; 향후 `const SELF_CHECK_SECTION = ...` 등 섹션별 분리 고려 |
| 9 | 유지보수 | **`workflow-assistant-stream.service.spec.ts` 2450줄+** — 단일 파일 과대 성장 | 파일 전체 | leak recovery 관련 케이스를 `workflow-assistant-stream.leak-recovery.spec.ts`로 분리 고려 |
| 10 | 테스트 | **`system-prompt.spec.ts` 패턴 매칭이 지나치게 관대** — `/BAD|❌|wrong/i` 등은 self-check 섹션 삭제 시에도 통과 가능 | `system-prompt.spec.ts` 신규 테스트 | `BAD ❌`, `GOOD ✅` 복합 리터럴로 어서션 강화 |
| 11 | 테스트 | **recovered plan + `evaluateFinishGuard` 상호작용 미테스트** — `approvedAt` 없는 복구 plan 상태에서 finish guard 동작 미검증 | `workflow-assistant-stream.service.spec.ts` | 복구 plan 존재 상태에서 finish tool_call_end → `PLAN_NOT_COMPLETE` 없이 정상 종료 케이스 추가 |
| 12 | 보안 | **`openQuestions` 타입 캐스팅 런타임 보장 없음** — `as string[]`이 원소 타입을 보장하지 않음 | `workflow-assistant-stream.service.ts` `buildPlanFromArgs` | `.filter((q): q is string => typeof q === 'string')` 사용 |
| 13 | 성능 | **`prompt.toLowerCase()` 테스트 내 반복 호출** — 동일 테스트에서 매번 새 문자열 할당 | `system-prompt.spec.ts` | `const promptLower = prompt.toLowerCase()` 한 번만 변환 |
| 14 | 유지보수 | **`String(leak.args.title)` 불필요한 캐스트** — `buildPlanFromArgs` 내 `asString()`으로 이미 처리됨 | `workflow-assistant-stream.service.ts` logger.warn 호출 | `asString(leak.args.title, 'Plan').slice(0, 60)` 로 일관성 유지 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | 간접 프롬프트 인젝션 신규 표면; `openQuestions` 타입 캐스팅 |
| Performance | LOW | O(n²) 최악 케이스; fast-path `includes` 부재 |
| Architecture | LOW | 전체 누적 텍스트 스캔; `VALID_STEP_ACTIONS` 타입 분리 |
| Requirement | LOW | 누출+편집 동시 발생 상태 불일치; `openQuestions` SSE 미검증 |
| Maintainability | LOW | `mock.calls[1][1]` 위치 의존; `VALID_STEP_ACTIONS` 수동 동기화 |
| Testing | LOW | 위치 기반 mock; `steps:[]` 미테스트; 멀티-delta 미테스트 |
| Side Effect | LOW | 멀티-라운드 누적 텍스트 오탐 경로 |
| Documentation | LOW | 공개 함수 JSDoc 누락; 처리 흐름 미반영 |
| API Contract | LOW | `leak_` prefix ID 포맷; `recovered` 필드 포함 |
| Concurrency | LOW | 모듈 스코프 캐시 (현재 환경 안전) |
| Scope | NONE | 변경 범위 적절; 무관 코드 없음 |
| Dependency | NONE | 외부 의존성 추가 없음; 순환 없음 |
| Database | NONE | 데이터베이스 관련 코드 변경 없음 |

---

## 발견 없는 에이전트

- **Database** — 변경 범위가 DB와 무관
- **Dependency** — 신규 외부 패키지 없음, 내부 단방향 의존만 추가
- **Scope** — 변경 범위가 문제 정의에 완전히 집중됨

---

## 권장 조치사항

1. **[W1] 복구 스캔 범위를 마지막 라운드로 한정** — 멀티-라운드 오탐은 현재 설계에서 가장 실질적인 정확성 위험. `lastRoundText` 추적으로 해결
2. **[W2] `VALID_STEP_ACTIONS`를 엔티티 타입에서 파생** — action 유니온 확장 시 누락이 조용히 서비스에 반영되는 유지보수 폭탄 제거
3. **[W3] O(n²) → O(n) 수정** — `i = end` 점프 한 줄 추가 + 상단 fast-path `includes` 두 줄로 해결; 구조적 비효율 제거
4. **[W6] `mock.calls[1][1]` → 역할 기반 탐색으로 교체** — 서비스 리팩토링 시 무음 실패 방지
5. **[W5] 동시 누출+편집 엣지 케이스 주석 문서화** — 당장 수정 불가하면 최소한 코드 주석으로 명시하여 미래 디버깅 비용 절감
6. **[W7/W8/W9] 누락 테스트 케이스 추가** — `steps:[]`, 멀티-delta, `openQuestions` SSE 검증 세 케이스로 회귀 보호
7. **[W4] 간접 프롬프트 인젝션 클라이언트 표시** — 복구된 plan임을 UI에서 구분 표시하여 사용자 인지 강화
8. **[I1] `findMatchingBrace` 단일 따옴표 처리 제거** — dead code 정리 및 JSON 전용임을 코드로 명확화
9. **[W10/W11/W12] JSDoc 갱신** — `recoverLeakedPlan` 함수 레벨 + 서비스 클래스 처리 흐름 + spec 파일 상단 요약
10. **[I2] `replace` → `replaceAll` 또는 주석** — 의도 명확화 (우선순위 낮음)