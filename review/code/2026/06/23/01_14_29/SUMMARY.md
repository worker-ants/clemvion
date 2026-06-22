# Code Review 통합 보고서

리뷰 대상: `refactor(workflow-assistant): M-3 1단계 review fix — dispatchNodeSchema 추출 + 테스트 보강`
리뷰 일시: 2026-06-23

---

## 전체 위험도
**LOW** — 동작 보존(behavior-preserving) 리팩터링으로 신규 결함 없음. 아키텍처 개선 방향 적절하며, 잔여 이슈는 모두 pre-existing이거나 계획된 defer 항목.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `reviewCompleted` 암묵적 guard 신호 패턴 미해소 — M-3 2단계 defer 결정된 항목. `ExploreDispatchResult.reviewCompleted`가 guard 도메인의 구체 동작을 암묵적으로 연결해 router가 guard 상태 변이 방식을 알고 있는 구조. JSDoc으로 추적성은 확보됨. | `assistant-tool-router.service.ts` L36–L44, `workflow-assistant-stream.service.ts` L1019–L1021 | 2단계(`AssistantFinishGuard`/`AssistantReviewGuard`) 착수 시 `ExploreDispatchResult`를 guard 도메인 타입으로 대체하거나 guard 객체가 결과를 직접 소비하는 구조로 전환. 현 단계 추가 조치 불요. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/3-workflow-editor/4-ai-assistant.md` §"schemaCache 정책"(L928, L935, L990)이 `SCHEMA_LOOKUP_HARD_STOP` 상수·캐시 정책 로직의 구 위치를 cross-reference. 본 PR로 `dispatchNodeSchema`로 이전됐으나 spec 미갱신. 행위 계약(hits=1/2/≥3)은 코드에서 완전 보존. | `spec/3-workflow-editor/4-ai-assistant.md` L928, L935, L990 | 코드 유지 + spec 갱신. project-planner 위임 — §"schemaCache 정책" 절을 `assistant-tool-router.service.ts`의 `dispatchNodeSchema` 기준으로 갱신. |
| 2 | Requirement | `verify_workflow` 인자 `requestCoverage`/`concerns` 미처리 — pre-existing gap. `buildVerifyWorkflowResult`가 `verifiedNodeIds`/`verifiedEdgeIds`만 읽고 해당 인자 무시. RESOLUTION.md가 인용한 spec 문구("Stored on the tool_calls row")는 현 spec에 존재하지 않음(0건). 본 PR 이전부터 존재한 gap. | `assistant-tool-router.service.ts` — `buildVerifyWorkflowResult` | 별도 이슈 추적. `requestCoverage`/`concerns` 저장/로깅 필요 여부를 project-planner와 논의. |
| 3 | Testing | `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details` 단순 위임 케이스 단위 테스트 미추가. workspaceId/currentWorkflowId 전달 정확성 검증 갭. | `assistant-tool-router.service.spec.ts` — `dispatchExplore` describe | 각 도구 위임 단언 테스트 추가 권장. 특수 케이스: `get_workflow_executions`의 `status`·`limit` 파라미터, `get_execution_details`의 비문자열 id 처리. |
| 4 | Testing | `verify_workflow` — `verifiedNodeIds`/`verifiedEdgeIds` 비배열 인자(null, 미전달) 처리 경로 미테스트. `Array.isArray` 방어 로직은 존재하나 해당 경로 커버 없음. | `assistant-tool-router.service.ts` L251–L258 (`buildVerifyWorkflowResult`) | INFO 수준. 방어 로직이 명확해 리스크 낮음. 추후 보강 권장. |
| 5 | Documentation | 클래스 JSDoc의 "dispatchExplore가 직접 관리" 서술이 `dispatchNodeSchema` 위임 구조로 미갱신. | `assistant-tool-router.service.ts` L47–L61 (클래스 JSDoc) | "private `dispatchNodeSchema`로 위임해 turn-scoped 캐시/하드스톱을 관리한다"로 소폭 수정 검토. 낮은 우선순위. |
| 6 | Documentation | `handleExploreCall` 내 `list_integrations`·`list_workflows` 케이스에 인라인 삼항 잔류. `asString` 통일 후 잔류 케이스 추적 누락. RESOLUTION.md INFO #10 항목이 잔류 케이스를 언급하지 않아 향후 혼동 여지. | `assistant-tool-router.service.ts` L182–L191, RESOLUTION.md | RESOLUTION.md INFO #10 항목에 "handleExploreCall 내 인라인 삼항 후속 단계 일괄 정리 예정" 부기 또는 코드에 `// TODO(M-3 후속): asString 통일` 주석 추가. |
| 7 | Security | LLM 제공 문자열 인자 길이 상한 미적용 — pre-existing. `typeArg`, `args.id`, `args.search` 등 길이 검증 없이 캐시 키·DB 파라미터로 전달. ORM 바인딩으로 SQL 인젝션 위험은 낮으나 과도한 문자열의 메모리 낭비 가능성 잔재. | `assistant-tool-router.service.ts` — `dispatchNodeSchema`·`handleExploreCall` | 리팩터링 범위 밖. 향후 `handleExploreCall` 진입 전 공통 길이 상한(256자) 검증 레이어 추가 검토. |
| 8 | Security | 내부 오류 메시지(safety-net 분기의 구현 세부 문자열)의 SSE 노출 가능성 — pre-existing, verbatim 이동. | `assistant-tool-router.service.ts` — `get_current_workflow` safety-net 분기 | 별건 처리. 클라이언트에는 `'INTERNAL_ERROR'` 코드만 반환하도록 개선 고려. |
| 9 | Maintainability | `cached.hits += 1` 위치가 early-return 전 단독 변이로 처음 읽을 때 의도 불명확. | `assistant-tool-router.service.ts` L136 | `// increment first so both branches see the updated count` 인라인 주석 추가(선택적). |
| 10 | Testing | `get_current_workflow` safety-net 브랜치(`handleExploreCall` L215-L222) 미커버 — 도달 불가 방어 코드이므로 우선순위 낮음. | `assistant-tool-router.service.ts` L215–L222 | `throw` 전환(behavior-preserving 원칙으로 defer) 시 자연스럽게 테스트 추가 가능. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | pre-existing INFO 2건(인자 길이 상한, safety-net SSE 노출 가능성). 신규 취약점 없음. |
| architecture | LOW | WARNING 1건: `reviewCompleted` 암묵적 guard 신호 패턴(M-3 2단계 계획 defer). 이전 WARNING #1 해소 확인. |
| requirement | LOW | SPEC-DRIFT 1건: schemaCache 정책 spec cross-reference 낡음. pre-existing gap 1건(requestCoverage/concerns 미처리). |
| scope | NONE | 변경 범위가 선언 의도와 정확히 일치. review/ 산출물 포함도 규약 허용 범위. |
| side_effect | NONE | schemaCache 변이 turn-scoped 의도 설계. 공개 API 시그니처 미변경. 신규 전역 상태 없음. |
| maintainability | NONE | `dispatchNodeSchema` 추출로 가독성 개선. 잔여 사항 모두 선택적 개선 수준. |
| testing | LOW | 이전 리뷰 지적 4건 해소. 잔여: 단순 위임 3개 케이스 미커버, verify_workflow 비배열 인자 처리 미테스트. |
| documentation | LOW | SPEC-DRIFT spec cross-reference 갱신 필요(planner 위임). RESOLUTION.md 잔류 케이스 추적 누락. |

---

## 발견 없는 에이전트

- **scope**: 변경 범위 완전 일치, 지적 사항 없음.
- **side_effect**: 동작 보존 확인, 부작용 없음.

---

## 권장 조치사항

1. **(project-planner 위임)** `spec/3-workflow-editor/4-ai-assistant.md` §"schemaCache 정책"(L928, L935, L990)의 구현 위치 cross-reference를 `assistant-tool-router.service.ts`의 `dispatchNodeSchema` 기준으로 갱신. [SPEC-DRIFT — 코드가 옳고 spec만 낡음]
2. **(선택적, 낮은 우선순위)** RESOLUTION.md INFO #10 항목에 `handleExploreCall` 내 잔류 인라인 삼항 후속 처리 예정을 부기해 혼동 방지.
3. **(선택적)** `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details` 단순 위임 경로에 workspaceId/currentWorkflowId 전달 정확성 단언 테스트 추가.
4. **(별건 이슈 등록)** `verify_workflow` `requestCoverage`/`concerns` 인자 처리 여부를 project-planner와 논의 후 별도 작업으로 추적.
5. **(M-3 2단계 착수 시)** `ExploreDispatchResult.reviewCompleted` 암묵적 guard 신호를 guard 도메인 타입으로 대체.

---

## 라우터 결정

라우터가 선별 실행함 (routing_status=done).

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명)
- **강제 포함 (router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
- **제외**: performance, dependency, database, concurrency, api_contract, user_guide_sync (6명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 동작 보존 리팩터링 — 알고리즘·쿼리·캐시 구조 변경 없음 |
| dependency | 신규 외부 의존성 없음 |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 동시성 패턴 변경 없음 (turn-scoped Map 구조 유지) |
| api_contract | 공개 API 시그니처 변경 없음 |
| user_guide_sync | 사용자 문서 변경 없음 |