# Code Review 통합 보고서

리뷰 대상: `refactor(workflow-assistant): M-3 1단계 — AssistantToolRouter 추출`
리뷰 일시: 2026-06-23

---

## 전체 위험도

**LOW** — 순수 리팩터링(verbatim 이동)으로 신규 보안 취약점·동시성 위험·행동 변경이 없다. Warning 3건은 모두 과도기 설계 인지 및 소규모 문서 확인 사항으로, 즉각 수정 의무는 없다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `dispatchExplore` 내 `get_node_schema` 캐시/하드스톱 정책 로직이 메서드에 인라인되어 추상화 경계 혼재. 신규 도구에 유사 정책이 붙을 경우 메서드가 계속 길어지는 구조 | `assistant-tool-router.service.ts` L481–L548 (`dispatchExplore`) | `get_node_schema` 처리를 private `dispatchNodeSchema()` 메서드로 추출, 또는 M-3 2/3단계 설계 시 `ToolDispatchPolicy` 인터페이스 도입 검토 |
| 2 | Architecture | `ExploreDispatchResult.reviewCompleted` 신호가 router→guard 경계를 암묵적으로 연결. router가 guard 도메인의 구체 동작 방식을 알고 있는 과도기 패턴 | `workflow-assistant-stream.service.ts` L1019–L1021, `assistant-tool-router.service.ts` `ExploreDispatchResult` | M-3 2단계(`AssistantFinishGuard`/`AssistantReviewGuard`) 완료 시 guard 객체가 결과를 직접 소비하도록 명시적 경계로 전환. 현 단계에서는 JSDoc 유지 |
| 3 | Documentation | `WorkflowAssistantStreamService` 생성자 파라미터가 `ExploreToolsService → AssistantToolRouter`로 교체됐는데, 생성자 JSDoc `@param exploreTools` 잔류 여부 미확인 | `workflow-assistant-stream.service.ts` — 생성자 JSDoc 전체 | 생성자 JSDoc에 `@param exploreTools ExploreToolsService` 언급이 있다면 `@param toolRouter AssistantToolRouter`로 갱신 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `spec/3-workflow-editor/4-ai-assistant.md` §Part A "schemaCache 정책" 절이 리팩터링 전 파일명·라인번호(서비스 L137–142) 기준으로 남아 있음. policy 로직·상수는 `assistant-tool-router.service.ts`로 이전됐으나 spec 서술이 미갱신 | `spec/3-workflow-editor/4-ai-assistant.md` §Part A (L928, L990) | 코드 유지 + spec 갱신: "policy 로직·상수는 `assistant-tool-router.service.ts`의 `dispatchExplore`로 이전, 캐시 맵 할당 소유는 `streamMessage`에 잔류"로 서술 수정 |
| 2 | Requirement | `verify_workflow` 인자 `requestCoverage` / `concerns`가 서버 측에서 읽히거나 저장되지 않음(pre-existing gap). spec §4.1 "Stored on the tool_calls row" 약속 미이행 | `assistant-tool-router.service.ts` `buildVerifyWorkflowResult` | 별도 이슈로 추적. 본 PR 범위 밖 |
| 3 | Testing | `coerce.ts` `asString` 헬퍼에 독립 단위 테스트 없음. 경계값(null, undefined, number, object, 빈 문자열) 명시 테스트 부재 | `coerce.ts`, `assistant-tool-router.service.spec.ts` | `coerce.spec.ts` 신설 또는 spec 상단 섹션 추가. 최소 케이스: null/undefined/42/{} → fallback, `''` → `''` |
| 4 | Testing | `get_node_schema` 비문자열 type 인자(`typeArg === ''`) 경로 미커버. 이 경우 하드스톱 없이 무제한 위임 발생하는 특수 케이스 | `assistant-tool-router.service.spec.ts` — `get_node_schema cache` describe | `{ type: 123 }` 또는 `{}` 인자로 호출 시 캐시 우회 동작 테스트 추가. 의도적 설계인지 코드 주석으로도 명시 |
| 5 | Testing | `handleExploreCall` `default` 브랜치(`UNKNOWN_EXPLORE_TOOL`) 및 `get_current_workflow` safety-net 브랜치 미커버 | `assistant-tool-router.service.ts` L203–L213 | 미등록 도구명으로 `dispatchExplore` 호출 시 `UNKNOWN_EXPLORE_TOOL` 반환 테스트 추가 권장 |
| 6 | Testing | `verify_workflow` 빈 스냅샷(nodes=[], edges=[]) + 빈 verifiedIds 케이스 미커버. "아무것도 없는 워크플로우도 verify 통과"가 의도적 설계인지 미확인 | `assistant-tool-router.service.spec.ts` — `verify_workflow` 테스트들 | 빈 스냅샷 + 빈 verifiedIds 호출 테스트로 설계 의도 문서화 |
| 7 | Testing | `get_workflow`, `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details` 위임 케이스 단위 테스트 미커버. 특히 `get_workflow`의 `mode` 파라미터 분기 로직 | `assistant-tool-router.service.spec.ts` — `dispatchExplore` describe | 위임 호출 확인 수준의 테스트 추가. `get_workflow` `mode: 'full'` vs 기본 summary 분기 최소 커버 권장 |
| 8 | Maintainability | `buildVerifyWorkflowResult` / `buildCurrentWorkflowResult` 반환 타입이 `unknown`이어서 호출부에서 타입 단언(`as { ok?: boolean }`) 필요 | `assistant-tool-router.service.ts` L235, L104–105 | 후속 단계에서 `VerifyWorkflowResult` 구체 유니온 타입 도입 시 타입 단언 제거 가능 |
| 9 | Maintainability | `handleExploreCall` 내 `get_current_workflow` safety-net case가 도달 불가 경로임에도 `ok: false` 응답으로 조용히 반환. 프로그래밍 오류를 즉각 드러내지 않음 | `assistant-tool-router.service.ts` L203–L210 | `throw new Error('AssistantToolRouter: get_current_workflow must be intercepted before handleExploreCall')`로 변경 권장 |
| 10 | Maintainability | `args.type` 추출이 일부 위치(L113)에서 인라인 삼항으로 작성돼 `handleExploreCall` 내 `asString()` 사용과 스타일 불일치 | `assistant-tool-router.service.ts` L113 vs L168 | L113을 `const typeArg = asString(args.type, '');`으로 통일 |
| 11 | Security | LLM 제공 문자열 인자(`args.type`, `args.id`, `args.search` 등)에 길이 상한 검증 없음. SQL 인젝션은 ORM이 처리하나 비정상 긴 문자열이 DB 쿼리 파라미터로 전달될 수 있음 | `assistant-tool-router.service.ts` — `handleExploreCall` switch 내 인자 처리 | 리팩터링 범위 밖 선행 기술 부채. 향후 `ExploreToolsService` 진입 전 유효성 검증 레이어 확인 또는 상한(256자) 적용 고려 |
| 12 | Security | `get_current_workflow` safety-net의 내부 오류 메시지("stream loop", "shadow access")가 LLM tool_result를 통해 클라이언트 SSE로 전달될 수 있음 | `assistant-tool-router.service.ts` L596–L603 | 클라이언트 노출 우려 시 상세 메시지를 서버 로그 전용으로 분리하고 클라이언트에는 `'INTERNAL_ERROR'` 코드만 반환 고려 |
| 13 | Architecture | `ExploreToolsService` 구체 클래스 직접 주입 — `IExploreToolsService` 인터페이스 미추출 | `assistant-tool-router.service.ts` L457 생성자 | 낮은 우선순위. `ExploreToolsService` 메서드 시그니처 안정화 후 인터페이스 추출 검토 |
| 14 | Scope | consistency-check 산출물이 동일 커밋에 포함됨. 별도 커밋이 이상적이나 프로젝트 규약상 허용 범위 | `review/consistency/2026/06/23/00_33_41/` 하위 파일들 | 향후 일관성 검토 산출물은 별도 커밋으로 분리 권장 |
| 15 | Performance | `buildVerifyWorkflowResult` — `filter + map` 이중 순회 및 Set 생성 중간 배열 할당. 노드/에지 수 통상 수십 개 수준으로 실측 차이 없음 | `assistant-tool-router.service.ts` L632–L648 | 실측 차이 없으므로 현행 유지 가능. 명확성 개선 목적 시 단일 for...of 순회로 대체 가능 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | LLM 인자 길이 상한 미적용(INFO), 내부 오류 메시지 SSE 노출 가능성(INFO). 신규 취약점 없음 |
| performance | NONE | 이중 순회·중간 배열 할당 등 실측 차이 없는 수준의 INFO 사항만 |
| architecture | LOW | `dispatchExplore` 추상화 경계 혼재(WARNING), `reviewCompleted` 암묵적 guard 신호 패턴(WARNING) |
| requirement | LOW | SPEC-DRIFT: schemaCache 정책 spec 미갱신(INFO), requestCoverage 저장 누락 pre-existing gap(INFO) |
| scope | NONE | 변경 범위가 M-3 1단계 목표에 충실하게 제한됨. consistency 산출물 포함은 허용 범위 |
| side_effect | NONE | schemaCache 변이가 의도된 설계이고 테스트로 검증됨. 의도하지 않은 부작용 없음 |
| maintainability | LOW | `unknown` 반환 타입으로 인한 타입 단언, unreachable case 조용한 반환, asString 사용 불일치, 테스트 커버리지 갭 |
| testing | LOW | coerce.ts 독립 테스트 부재, 경계 케이스 4건 미커버, 위임 도구 4개 단위 테스트 미커버 |
| documentation | LOW | 생성자 JSDoc @param 갱신 여부 미확인(WARNING). 신규 파일 JSDoc 품질 우수 |
| concurrency | NONE | 완전 무상태 singleton 설계로 경쟁 조건 없음. schemaCache hits 연산은 await 경계 없이 동기 실행 |
| user_guide_sync | NONE | 사용자 가시 기능·API·노드·i18n에 영향 없는 순수 내부 리팩터링 |

---

## 발견 없는 에이전트

- **concurrency**: 동시성 위험 해당 없음
- **user_guide_sync**: 사용자 가이드 갱신 트리거 0건
- **scope**: 범위 이탈 없음 (consistency 산출물 포함은 허용 범위로 판정)

---

## 권장 조치사항

1. **(즉시 권장)** `spec/3-workflow-editor/4-ai-assistant.md` §Part A "schemaCache 정책" 절을 `AssistantToolRouter` 기준으로 갱신 — `SPEC-DRIFT` 항목 (INFO #1). 코드는 올바르고 spec만 낡음.
2. **(M-3 2단계 착수 전)** `dispatchExplore` 내 `get_node_schema` 블록을 private `handleNodeSchemaWithCache()` 메서드로 추출, `reviewCompleted` 신호 경로를 guard 객체 직접 소비로 전환 계획 명시 (WARNING #1, #2).
3. **(소규모 즉시 수정 가능)** `WorkflowAssistantStreamService` 생성자 JSDoc `@param exploreTools` 잔류 여부 확인 및 수정 (WARNING #3).
4. **(소규모 즉시 수정 가능)** `handleExploreCall` `get_current_workflow` safety-net case를 `throw new Error(...)` 로 변경하여 프로그래밍 오류를 즉각 드러냄 (INFO #9).
5. **(소규모 즉시 수정 가능)** L113 `args.type` 추출을 `asString(args.type, '')` 으로 통일 (INFO #10).
6. **(테스트 보강 — M-3 후속 단계 전)** `coerce.spec.ts` 경계값 테스트, `get_workflow` mode 분기 테스트, `UNKNOWN_EXPLORE_TOOL` default 브랜치 테스트 추가 (INFO #3, #5, #7).
7. **(별도 이슈 추적)** `verify_workflow`의 `requestCoverage` 필드 미저장 — spec §4.1 "Stored on the tool_calls row" 약속 이행 (INFO #2).

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync (11명)
- **제외**: dependency, database, api_contract (3명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 외부 패키지 추가/변경 없는 내부 리팩터링 |
| database | DB 스키마·마이그레이션·쿼리 변경 없음 |
| api_contract | 공개 API 엔드포인트 변경 없음 |