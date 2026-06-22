# Code Review 후속 처리 (RESOLUTION)

리뷰 대상: `refactor(workflow-assistant): M-3 1단계 — AssistantToolRouter 추출` (commit `c038cb4f`)
처리 일시: 2026-06-23
전체 위험도: **LOW** — Critical 0, Warning 3, INFO 15.

본 PR 은 **동작 보존(behavior-preserving) 리팩터링**이다. 따라서 처분 원칙:
fix 는 (a) 동작을 바꾸지 않으면서 (b) 추상화/테스트를 강화하는 항목만 즉시 적용하고,
동작 변경을 수반하거나 spec(`developer` read-only)·별 영역에 속하는 항목은 근거와 함께 defer 한다.

---

## 즉시 수정 (이번 후속 커밋)

| 출처 | 항목 | 조치 |
|------|------|------|
| **WARNING #1** (Architecture) | `dispatchExplore` 내 `get_node_schema` 캐시/하드스톱 로직 인라인 — 추상화 경계 혼재 | private `dispatchNodeSchema(args, ctx)` 메서드로 추출. `dispatchExplore` 는 위임 1줄. **동작 동일**(로직 이동만). 빈 `type` 캐시 우회 의도를 JSDoc 으로 명문화(INFO #4 의 "코드 주석 명시" 권고 동반 충족) |
| **INFO #10** (Maintainability) | L113 `typeof args.type === 'string' ? args.type : ''` 인라인 삼항이 `handleExploreCall` 의 `asString()` 과 스타일 불일치 | 추출된 `dispatchNodeSchema` 에서 `asString(args.type, '')` 로 통일. `asString` 정의(`typeof v === 'string' ? v : fallback`)와 **완전 동치** |
| **INFO #3** (Testing) | `coerce.ts` `asString` 독립 단위 테스트 부재 | `tools/coerce.spec.ts` 신설 — null/undefined/number/object/array/boolean → fallback, `''`·문자열 → passthrough 경계값 커버 |
| **INFO #4** (Testing) | `get_node_schema` 비문자열 `type`(캐시 우회) 경로 미커버 | router spec 에 `{ type: 123 }` 2회 호출 → 매번 위임·`schemaCache.size === 0` 테스트 추가 + 코드 주석 명시 |
| **INFO #5** (Testing) | `UNKNOWN_EXPLORE_TOOL` default 브랜치 미커버 | router spec 에 미등록 explore 도구명 → `{ ok:false, error:'UNKNOWN_EXPLORE_TOOL' }` 테스트 추가 |
| **INFO #7** (Testing) | `get_workflow` `mode` 분기(full vs summary) 위임 미커버 | router spec 에 `mode:'full'`·기본(summary) 위임 인자 단언 테스트 추가 |
| **INFO #6** (Testing) | 빈 스냅샷 `verify_workflow` 설계 의도 미문서화 | router spec 에 빈 캔버스 + 빈 verifiedIds → `ok:true`·`reviewCompleted:true` 테스트로 의도 고정 |

재검증: lint(touched clean) · backend build(exit 0) · unit **17 suites / 381 tests PASS**(+1 suite, +6 tests).

---

## 검증 후 비이슈 (조치 불요)

| 출처 | 항목 | 판정 근거 |
|------|------|-----------|
| **WARNING #3** (Documentation) | 생성자 JSDoc `@param exploreTools` 잔류 여부 미확인 | `grep '@param\|exploreTools'` 결과 생성자에 JSDoc 자체가 없고(파라미터 주석 0) `@param exploreTools` 도 부재. 유일한 `@param` 블록은 `evaluateFinishGuard`(무관). 클래스 doc 의 explore 위임 서술은 이미 router 기준으로 갱신함. **stale 항목 없음** |

---

## Deferred (근거 기록)

### planner-only (developer 는 `spec/` read-only)

- **INFO #1 (SPEC-DRIFT)** — `spec/3-workflow-editor/4-ai-assistant.md` §"schemaCache 정책"(L926–935) + Part B Rationale(L990)가 `SCHEMA_LOOKUP_HARD_STOP` 의 **이동 전 위치**(서비스 L137–142)를 cross-reference. 본 리팩터링으로 상수·정책 로직이 `assistant-tool-router.service.ts`(`dispatchNodeSchema`)로 이전됨.
  - **행위 계약은 보존**(hits=2 warning · hits≥3 hard-stop · 테스트 3회차 기대값 무변) — drift 는 spec 의 *구현 위치 cross-ref 주석*에 한정.
  - `developer` 역할은 `spec/` 쓰기 불가 → **project-planner 위임**. 기존 보류 중인 `M-1 spec-sync` 묶음(`spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 갱신 등)과 함께 처리 권장: §schemaCache 정책의 위치 주석을 "`assistant-tool-router.service.ts` 의 `dispatchNodeSchema` + 상수, 캐시 맵 소유는 `streamMessage` 잔류"로 갱신.

- **INFO #2 (Requirement)** — `verify_workflow` 의 `requestCoverage`/`concerns` 인자가 서버에서 저장되지 않음(spec §4.1 "Stored on the tool_calls row" 미이행). **pre-existing gap** — `buildVerifyWorkflowResult` 는 verbatim 이동되었을 뿐 본 PR 이 도입한 결함 아님. 별건(planner spec 명확화 + developer 후속) 추적.

### 동작 변경 수반 — behavior-preserving 원칙상 보존 (별건)

- **INFO #9 (Maintainability)** — `handleExploreCall` 의 `get_current_workflow` safety-net 을 `throw` 로 변경 권고. 그러나 원본은 `{ ok:false, error:'INTERNAL' }` 를 **반환**(verbatim 이동). `throw` 전환은 도달-불가 edge case 의 **동작 변경**이라 behavior-preserving PR 범위 밖. 현행 보존. (도달 불가 — `dispatchExplore` 가 `get_current_workflow` 를 먼저 가로채므로 방어용.)

- **INFO #11, #12 (Security)** — (a) LLM 문자열 인자 길이 상한 미적용, (b) safety-net 내부 오류 메시지의 SSE 노출 가능성. 둘 다 **pre-existing**(ExploreToolsService 진입 경로·verbatim 이동된 방어 응답)이며 본 PR 이 표면을 넓히지 않음. 신규 취약점 0(security reviewer NONE). 별건 기술 부채로 분류.

### M-3 후속 단계(2·3단계)로 설계 일관성 차원 defer

- **WARNING #2 (Architecture)** — `ExploreDispatchResult.reviewCompleted` 가 router→guard 경계를 암묵 연결(과도기 패턴). 리뷰 자체가 "M-3 2단계(`AssistantFinishGuard`/`AssistantReviewGuard`) 완료 시 guard 객체 직접 소비로 전환, **현 단계에서는 JSDoc 유지**" 를 권고. JSDoc(`ExploreDispatchResult.reviewCompleted` + 호출부 주석) 이미 명시. 2단계에서 명시 경계로 승격.

- **INFO #8 (Maintainability)** — `buildVerify/CurrentWorkflowResult` 반환 `unknown` → 타입 단언 필요. `VerifyWorkflowResult` 구체 유니온 도입은 verbatim 이동 원칙을 깨므로 후속 단계 정리 대상.

- **INFO #13 (Architecture)** — `IExploreToolsService` 인터페이스 미추출(구체 클래스 주입). 낮은 우선순위, 시그니처 안정화 후 검토.

### 규약 준수 — 결함 아님

- **INFO #14 (Scope)** — consistency-check 산출물이 동일 커밋 포함. **CLAUDE.md §정보 저장 위치 / 본 작업 규약 7** 이 "review/ 산출물(SUMMARY/RESOLUTION)도 커밋" 을 명시 → 규약 준수이지 범위 이탈 아님.

- **INFO #15 (Performance)** — `buildVerifyWorkflowResult` filter+map 이중 순회. 노드/에지 수십 개 수준으로 실측 차이 없음(performance reviewer NONE). verbatim 보존.

---

## 결론

Critical 0. Warning 3 중 #1 즉시 수정, #2 는 리뷰 권고대로 2단계 defer(JSDoc 유지), #3 은 검증 결과 비이슈.
Testing INFO(#3–#7) 보강으로 신규 router 커버리지 강화. 잔여 INFO 는 planner-only/별건/후속단계/규약준수로 분류·근거 기록.
재검증 green. fresh `/ai-review --commit HEAD` 로 수렴 확인 예정.
