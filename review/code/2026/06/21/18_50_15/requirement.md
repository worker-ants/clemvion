# Requirement Review — AiConditionEvaluator 추출 (M-1 1단계)

리뷰 대상: `ai-condition-evaluator.ts`, `ai-condition-evaluator.spec.ts`, `ai-agent.handler.ts` (diff)

---

## 발견사항

### [INFO] spec §5.1 도구 스키마 — `required: []` 명시는 SPEC-DRIFT 아님 (오히려 정합)
- 위치: `ai-condition-evaluator.ts` L46–50 (`buildConditionTools` 의 `required: []`)
- 상세: 원 핸들러 코드에서는 `required` 필드를 생략했으나, 새 구현에서 `required: []` 를 명시했다. 코드 주석에도 "spec §5.1 의 도구 스키마 명시값" 이라고 표기돼 있으며, spec §5.1 테이블의 `parameters` 셀은 `required: []` 를 명시하고 있다 (`{ type: "object", properties: { reason: { ... } }, required: [] }`). 이는 spec 과의 일치이므로 spec fidelity 향상에 해당한다. 문제 없음.

### [INFO] spec §5.1 시스템 프롬프트 안내문 — 문구 경미한 편차
- 위치: `ai-condition-evaluator.ts` `buildConditionSystemPromptSuffix` (L55)
- 상세: spec §5.1 에 명시된 안내문 원문은 `"다음 조건 중 상황이 충족되면 해당 도구를 호출하세요. 조건이 충족되지 않으면 대화를 계속하세요."` 이다. 구현은 `[조건 안내] 대화 중 아래 조건에 해당하는 상황이 감지되면, 해당 조건 도구를 호출하세요:\n${condList}\n조건에 해당하지 않으면 대화를 계속하세요.` 로 구조화된 형태이다. 이 차이는 이번 리팩터 전부터 존재했던 것으로(기존 핸들러 코드와 동일 문구), 이번 추출에서 새로 도입한 편차가 아니다. spec §5.1 의 문구는 의도("조건 안내문 자동 주입")를 기술한 예시 수준이며, 구조화된 현행 구현이 그 의도를 더 잘 충족한다. 코드 fix 대상이 아니다.

### [INFO] `classifyToolCalls` — spec §5.2 원문과 분류 로직 표현 차이
- 위치: `ai-condition-evaluator.ts` `classifyToolCalls` (L72–110)
- 상세: spec §5.2 원문은 "`toolCalls`를 조건 도구와 일반 도구로 분류"라고 2분류처럼 기술하나, 실제 구현(그리고 spec §6.1 본문 §3.a의 상세 기술)은 provider / condition / normal 3분류다. 이 역시 이번 추출 전부터 존재하던 패턴으로, spec §6.1 §3.a의 더 상세한 기술과는 일치한다. `classifyToolCalls` 메서드 JSDoc 과 spec §6.1 문언이 일치한다. INFO 수준 — spec §5.2 절의 2분류 표현이 구현의 완전한 그림을 담지 못하는 약식 기술이나, spec §6.1 이 보완하고 있다.

### [INFO] `classifyToolCalls` 시그니처 변경 — `toolProviders` 인자 추가
- 위치: `ai-agent.handler.ts` diff, L141–146 / `ai-condition-evaluator.ts` L73
- 상세: 이전 핸들러의 `private classifyToolCalls(toolCalls, conditions)` 는 `this.toolProviders` 를 암묵적으로 캡처했다. 새 구현에서는 `toolProviders: AgentToolProvider[]` 를 명시 인자로 받는다. 모든 호출부에서 `this.toolProviders` 를 전달하고 있어 동작은 동일하다. spec §6.1 의 "먼저 등록된 `toolProviders` 중 `matches(tc.name)` 가 참인 첫 provider 를 찾고" 기술과 정확히 일치한다. 문제 없음.

### [INFO] TODO/FIXME 없음 확인
- 위치: `ai-condition-evaluator.ts`, `ai-condition-evaluator.spec.ts` 전체
- 상세: 미완성 작업을 시사하는 주석 없음. 코드 주석은 모두 설명적이다.

### [INFO] 빈 `conditions` 배열에 대한 `buildConditionSystemPromptSuffix` 동작
- 위치: `ai-condition-evaluator.ts` L55, `ai-condition-evaluator.spec.ts` L83
- 상세: 빈 배열 전달 시 항목 없는 안내문을 반환한다. 호출부(`ai-agent.handler.ts`)는 `conditions.length > 0` 가드를 통해 빈 경우 호출 자체를 방지하므로, 이 경로는 방어적으로 동작한다. 테스트에서 "호출부 가드와 무관하게 안전" 으로 명시됨. 정상.

### [INFO] `condToolName` — 빈 문자열 입력 처리
- 위치: `ai-condition-evaluator.ts` `sanitizeId` / `condToolName`
- 상세: `conditionId` 가 빈 문자열이면 `cond_` 를 반환한다. 유효성 검증 규칙(spec §5.1 "각 조건의 `id`는 필수")이 `handler.validate` 단계에서 상류 차단하므로, evaluator 내부의 이 경계값은 실제로 도달하지 않는다. INFO 수준.

---

## 요약

이번 변경은 `AiAgentHandler` 의 조건 평가 로직 5개 메서드와 2개 타입을 순수 무상태 collaborator `AiConditionEvaluator` 로 추출한 behavior-preserving 리팩터다. plan 02-architecture §M-1 Option A 1단계의 정확한 구현이다. 모든 호출부(단일턴·멀티턴 두 경로)에서 동일하게 위임이 적용됐으며, `toolProviders` 의존성은 인자로 명시화해 무상태성을 확보했다. 추출된 코드는 원본과 동일한 로직을 유지하고, spec §5.1(도구 스키마 `required: []` 명시), §5.2(분류 로직), §7.2·§7.6(`condition.reason` 최대 500자 제한)과 line-level 로 일치한다. 신설 단위 테스트는 빈 배열·빈 toolCalls·멀티바이트 절단·provider 우선·winner 선택 등 엣지 케이스를 전방위 커버한다. CRITICAL·WARNING 발견사항 없음.

## 위험도

NONE
