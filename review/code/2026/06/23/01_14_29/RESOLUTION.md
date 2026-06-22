# Code Review 후속 처리 (RESOLUTION) — 2차 (수렴)

리뷰 대상: `refactor(workflow-assistant): M-3 1단계 review fix` (commit `07de6ff1`)
처리 일시: 2026-06-23
전체 위험도: **LOW** — Critical 0, **Warning 1**, INFO 10.

1차 리뷰(`review/code/2026/06/23/01_00_21`) 대비: Warning **3 → 1**. 직전 WARNING #1
(`dispatchExplore` 인라인 캐시/하드스톱)·#3(생성자 doc) 해소 확인. 잔존 1건은 1차에서
이미 M-3 2단계로 defer 결정한 항목이다.

## 수렴 판정: **CONVERGED**

수렴 기준(Critical 0 + 잔존 WARNING 이 deliberate-defer/planner-only 로 근거 기록됨)을 충족.
유일 잔존 WARNING 은 리뷰 본문이 직접 "현 단계 추가 조치 불요" 로 명시한 계획된 defer 다.
추가 codebase 수정은 review-gate 재무장 루프를 유발하므로, 이후는 review/** 전용으로 종결한다.

---

## 잔존 WARNING (deliberate-defer, 조치 불요)

| 출처 | 항목 | 처분 |
|------|------|------|
| **WARNING #1** (Architecture) | `ExploreDispatchResult.reviewCompleted` 가 router→guard 경계를 암묵 연결 | **M-3 2단계 defer (계획)**. 리뷰 본문이 "JSDoc 으로 추적성 확보됨, 현 단계 추가 조치 불요" 명시. 2단계(`AssistantFinishGuard`/`AssistantReviewGuard`) 착수 시 `reviewCompleted` 를 guard 도메인 타입으로 승격하거나 guard 객체가 결과를 직접 소비하도록 전환. JSDoc(라우터 `ExploreDispatchResult` + `streamMessage` 호출부 주석) 이미 명시 |

---

## INFO 처분

| 출처 | 항목 | 처분 |
|------|------|------|
| #1 (SPEC-DRIFT) | spec §"schemaCache 정책"(L928/935/990) 이 `SCHEMA_LOOKUP_HARD_STOP` 구 위치 cross-ref | **planner-only** (developer `spec/` read-only). 행위 계약(hits=1/2/≥3) 코드 보존. project-planner 가 `dispatchNodeSchema` 기준으로 §갱신 — 보류 중 `M-1 spec-sync` 묶음과 함께 처리 |
| #2 (Requirement) | `verify_workflow` `requestCoverage`/`concerns` 미저장 | **pre-existing, 별건**. 2차 리뷰가 확인: 1차 RESOLUTION 이 인용한 spec 문구 "Stored on the tool_calls row" 는 **현 spec 에 실재하지 않음**(1차 requirement reviewer 의 추정 인용). 따라서 spec 약속 위반이 아니라 단순 미사용 인자 — `buildVerifyWorkflowResult` 는 verbatim 이동. 필요 여부는 planner 논의 후 별건 |
| #3 (Testing) | `list_knowledge_bases`/`get_workflow_executions`/`get_execution_details` 위임 케이스 미커버 | **수용(후속)**. 1차에서 핵심 위임(`list_integrations`·`get_workflow` mode)·default(`UNKNOWN_EXPLORE_TOOL`)·캐시 3단계·verify 를 이미 커버. 나머지 단순 위임은 동일 switch 패턴이라 회귀 위험 낮음 — 후속 보강 후보 |
| #4 (Testing) | `verify_workflow` 비배열 인자 경로 미테스트 | **수용(후속)**. `Array.isArray` 방어 명확, 리스크 낮음 |
| #5 (Documentation) | 클래스 JSDoc "dispatchExplore 가 ... 관리" 가 `dispatchNodeSchema` 위임 구조 미반영 | **수용(minor)**. 클래스 레벨 서술("라우터가 explore dispatch·캐시/하드스톱을 담당")은 여전히 정확 — `dispatchNodeSchema` 는 그 내부 sub-method. 추가 codebase 수정은 재무장 루프 유발하므로 종결 차원에서 보류, 2단계 정리 시 동반 |
| #6 (Documentation) | `handleExploreCall` 내 `list_integrations`/`list_workflows` 인라인 삼항 잔류 | **비적용**. 두 케이스는 `string | undefined`(선택 파라미터) 강제라 `string` fallback 인 `asString` 으로 치환 불가(`asString` 은 빈 문자열이 아닌 `undefined` 를 못 돌려줌). INFO #10 의 `asString` 통일은 `string` fallback 인 `typeArg`/`id` 에만 적용된 것이며, 본 케이스는 의미가 달라 의도적 미통일 |
| #7, #8 (Security) | LLM 인자 길이 상한·safety-net 내부 메시지 SSE 노출 | **pre-existing, 범위 밖**. verbatim 이동·`ExploreToolsService` 진입 경로. 신규 취약점 0 |
| #9 (Maintainability) | `cached.hits += 1` 단독 변이 의도 주석 | **수용(optional)**. 추가 codebase 수정 보류(재무장 회피), 2단계 정리 시 주석 동반 가능 |
| #10 (Testing) | safety-net 브랜치 미커버 | **수용(후속)**. 도달 불가 방어 코드. INFO #9(1차) 의 `throw` 전환은 behavior-preserving 원칙으로 defer — 전환 시 자연스럽게 테스트 추가 |

---

## 결론

Critical 0, Warning 1(계획된 M-3 2단계 defer). 1차 fix 로 dispatchNodeSchema 추출·테스트 보강 완료,
2차 리뷰가 해소 확인. 잔여 항목은 전부 planner-only / pre-existing / 후속단계 / 비적용으로 분류·근거 기록.
**수렴 종결** — 이후 `/consistency-check --impl-done` 으로 spec 정합 확인 후 PR.
