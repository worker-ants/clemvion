# 보안(Security) 코드 리뷰

**리뷰 대상 커밋**: `1c17795c` — refactor(workflow-assistant): M-3 2단계 finish/review 가드 분리  
**리뷰 일시**: 2026-06-24  
**리뷰 범위**: 7개 TypeScript 파일 + 관련 review/consistency 산출물

---

## 발견사항

### **[INFO]** 프롬프트 인젝션 표면 — originalRequest 단순 절단만 적용
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` — `truncateReviewOriginalRequest()` 함수 (라인 549–553), `REVIEW_ORIGINAL_REQUEST_MAX_LEN = 200` 상수
- 상세: 사용자 입력 원문(`originalRequest`)이 `finish` tool_result 로 LLM 에 재주입될 때 길이 200자 절단만 적용하고, XML 태그 삽입·제어 문자·이스케이프 처리는 생략한다. JSDoc 주석 자체에 "(제어 문자 제거는 이후 LLM 이 context 파싱 시 문제되지 않는 수준이므로 생략)"이라고 명시되어 있다. 현 구조에서 사용자가 `</plan>` 같은 XML 닫힘 태그나 LLM 지시 패턴을 원문에 포함시키면 tool_result JSON 페이로드 내 `originalRequest` 필드를 통해 LLM 의 system prompt XML fence 이후 단계(review 라운드)에서 부분 인젝션 가능성이 존재한다. 단, system prompt 의 Active plan context 가 XML fence 로 중화되어 있다는 점을 JSDoc 이 언급하고 있으며, tool_result 는 JSON 직렬화 경로를 거치므로 HTML/XML 레벨 인젝션이 JSON 문자열 이스케이프로 1차 차단된다. 현시점 실제 익스플로잇 가능성은 낮으나, 200자 내에서도 LLM 행동 조작 문자열 삽입은 가능하다.
- 제안: `truncateReviewOriginalRequest` 에서 `\x00–\x1F` 범위 제어 문자 제거 및 `<`, `>` 를 HTML 엔티티(`&lt;`, `&gt;`)로 치환하거나, 호출부에서 JSON stringify 이전에 새니타이징 레이어를 추가한다. 또는 `originalRequest` 를 tool_result 에 직접 싣지 않고 별도 참조 ID 만 전달하는 구조로 전환을 검토한다.

---

### **[INFO]** `as never` 타입 캐스트 — 런타임 타입 안전성 우회
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.spec.ts` — `makeGuard()` 함수 내 `nodeRegistry as never`, `candidateLookup as never` (라인 187–191); `workflow-assistant-stream.service.spec.ts` — `mocks.nodeRegistry as never`, `candidateLookup as never` (라인 1013–1016)
- 상세: 테스트 파일에서 mock 객체를 `as never` 로 주입하는 것은 테스트 관행으로 흔하지만, 실제 서비스 코드(`workflow-assistant-stream.service.ts` 라인 252)의 생성자 주입 파라미터에도 `as never` 패턴이 전파될 경우 타입 컴파일러 검사를 완전히 우회한다. 현재 프로덕션 경로는 NestJS DI 를 통해 정상 주입되므로 직접적 보안 취약점은 아니다. 그러나 `as never` 를 테스트에서 과용하면 인터페이스 계약 위반(예: `nodeRegistry.getComponent` 가 실제와 다른 형태 반환)이 컴파일 단계에서 잡히지 않고 런타임 오류로만 드러난다.
- 제안: `as never` 대신 `jest.mocked()` 타입 헬퍼 또는 명시적 `Partial<NodeComponentRegistry>` 타입 mock 을 사용해 타입 안전성을 유지한다.

---

### **[INFO]** `(tc.result as { ok?: boolean } | undefined)?.ok` — 비검증 타입 캐스트
- 위치: `assistant-finish-guard.service.ts` — `shouldSkipReview` (라인 734–737), `evaluateFinishGuard` (라인 790–793)
- 상세: `AssistantToolCallRecord.result` 필드를 `{ ok?: boolean }` 으로 캐스팅 후 `.ok` 를 읽는다. 이 값은 외부 tool execution 에서 DB 에 저장된 결과이므로, DB 에 임의 구조가 저장되어 있을 경우 런타임에 예상치 못한 값을 반환할 수 있다. 현재 `ok: false, error: 'BOOM'` 처럼 문자열 오류 정보가 result 에 같이 실려 있으며, 이 오류 메시지가 가드 로직을 우회하는 조건으로 쓰이지 않는지 확인이 필요하다. 그러나 가드 로직은 `ok === true` 인 경우에만 "성공 edit" 으로 판단하므로, 취약한 방향(거짓 통과)은 아니다.
- 제안: `AssistantToolCallRecord` 엔티티에 `result` 필드의 타입 가드를 명시하거나 zod 스키마로 result 형태를 런타임 검증한다.

---

### **[INFO]** `plan.openQuestions` 배열이 LLM tool_result message 에 직접 삽입
- 위치: `assistant-finish-guard.service.ts` — `evaluateFinishGuard` (라인 821–836), `openQuestions: ctx.plan.openQuestions ?? []`
- 상세: `openQuestions` 배열은 LLM 이 생성한 문자열 목록으로, DB 에 저장된 후 `PLAN_NOT_COMPLETE` error payload 의 `openQuestions` 필드로 그대로 LLM 에 재주입된다. 이 경로에서는 절단이나 새니타이징이 적용되지 않는다. LLM 이 이전 턴에 악의적 콘텐츠를 `openQuestions` 에 포함시킨 경우, 다음 LLM 호출 시 인젝션 표면이 된다. 단, LLM 간 신뢰 경계가 동일 세션의 동일 LLM 이고 JSON 직렬화 경로를 거치므로 실질 위험은 낮다.
- 제안: `openQuestions` 각 항목에 최대 길이 제한(예: 500자)과 제어 문자 제거를 적용하거나, 개수 상한을 지정한다.

---

### **[INFO]** `pendingSteps` description 이 LLM tool_result 에 무제한 삽입
- 위치: `assistant-finish-guard.service.ts` — `evaluateFinishGuard` (라인 817–820), `pendingSteps = ctx.plan.steps.filter(...).map(s => ({ id: s.id, description: s.description }))`
- 상세: plan step 의 `description` 필드가 길이 제한 없이 `PLAN_NOT_COMPLETE` payload 에 삽입된다. `openQuestions` 와 동일한 경로 위험이 존재한다.
- 제안: `description` 에 최대 길이(예: 300자) 절단을 적용한다.

---

## 요약

이번 변경은 `WorkflowAssistantStreamService` 내부에 혼재하던 finish/review 가드 로직을 `AssistantFinishGuard` 무상태 collaborator 로 추출하는 순수 리팩터링이다. 신규 외부 입력 경로, 인증/인가 경계, 데이터베이스 직접 접근, 암호화 알고리즘, 하드코딩된 시크릿은 이번 변경에 포함되지 않는다. 보안 관점의 실질 위험은 낮으며, 발견된 4건 모두 INFO 등급이다. 주된 잠재 위험은 `originalRequest`·`openQuestions`·`pendingSteps.description` 세 필드가 LLM tool_result 페이로드로 재주입될 때 길이 제한 및 새니타이징 처리의 일관성 부재이며, 이는 JSON 직렬화와 동일 세션 LLM 신뢰 경계로 1차 완화되어 있다. `as never` 타입 캐스트는 테스트 관행 수준이며 프로덕션 DI 경로에는 영향을 미치지 않는다. 단기 조치보다는 향후 `originalRequest` 새니타이징 레이어를 `truncateReviewOriginalRequest` 에 통합하는 것을 권장한다.

## 위험도

LOW
