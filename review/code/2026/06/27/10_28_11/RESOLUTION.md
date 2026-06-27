# RESOLUTION — C-2 cluster 4 최종 검증 ai-review (full range)

리뷰 세션: `review/code/2026/06/27/10_28_11/SUMMARY.md` (Risk LOW · Critical 0 · **Warning 1** · INFO 3)
대상: `origin/main..HEAD` 전체 diff (코드 3 커밋 + spec-sync). 최종 코드(`c92f4e35`) 커버용 재리뷰.
배경: 직전 review-fix 커밋(`272a6764`·`c92f4e35`)이 push 가드를 재무장해, 최종 코드 전체를 커버하는 fresh 리뷰를 수행함.

## 조치 항목

| # | 분류 | 조치 |
|---|---|---|
| INFO #1·#2·#3 | Spec 등재/침묵 | INFO 수준 — #1(7-llm-client frontmatter 등재)·#2(7-llm-usage Overview 진입점 목록)은 navigation spec(6-config) 단독 등재로 충분(컨트롤러는 llm-client 본문 §8 Rationale 에 서술됨). #3 는 WARNING #1 과 동일 사안(아래). 별도 코드 조치 없음. |

## 보류·후속 항목

**[WARNING #1 — 보류: pre-existing authz, behavior-preserving 범위 밖 + 별도 spec 결정 필요]**

`POST /api/model-configs/:id/test`(`testConnection`)에 `@Roles('editor')`·`@ApiForbiddenResponse` 없음.

- **pre-existing & verbatim**: 종전 `ModelConfigController.testConnection` 도 `@Roles` 없이 throttle 만 적용했다. 본 refactor 는 핸들러를 **verbatim 이전**(behavior-preserving)했을 뿐 인가 동작을 바꾸지 않았다. 지금 `@Roles('editor')` 를 추가하면 **viewer 가 종전에 호출 가능하던 connection-test 가 403** 으로 바뀌는 **behavior change** — "forwardRef 순환 제거" PR 의 범위를 벗어난다.
- **spec 결정 사안**: `6-config.md §3` 은 "mutation(POST/PATCH/DELETE)=Editor+, 조회=Viewer+" 로 규정하나, `testConnection`(데이터 미변경 action-POST)·`listModels`(GET 조회)의 역할은 **명시 침묵**. 인가 매트릭스는 planner/product 소관.
- **권장(별도 follow-up)**: `testConnection` 은 `previewModels`(POST action, 이미 `@Roles('editor')`)와 동형의 과금성 provider 호출이고 spec §3 의 "POST=Editor+" 정신에 부합하므로 **`@Roles('editor')` 부여 + spec §3 에 action-POST 역할 명시**가 타당. `listModels`(GET 조회)는 Viewer+ 유지. → **planner 가 spec §3 에 `:id/test`·`:id/models` 역할 규칙을 명문화한 뒤, 그 결정에 맞춰 developer 가 `@Roles` 반영**하는 별 PR 로 처리(인가 동작 변경이므로 product sign-off 동반).
- 본 PR 에서는 **현행(verbatim) 유지** — 인가 회귀 0.

## TEST 결과

- **lint**: 통과 (직전 커밋들에서 검증; 본 세션은 코드 변경 없음)
- **unit**: 통과 (backend 377 suites / 7423 — 직전 검증)
- **build**: 통과 (직전 검증)
- **e2e**: 통과 (214 passed, 2026-06-27 재실행)
- *(본 리뷰 세션은 코드 변경이 없어 TEST WORKFLOW 재수행 불요 — 보류 1건은 문서/spec 결정 사안)*
