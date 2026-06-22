# 요구사항(Requirement) 리뷰

리뷰 대상: `refactor(workflow-assistant): M-3 1단계 review fix — dispatchNodeSchema 추출 + 테스트 보강`
리뷰 일시: 2026-06-23

---

## 발견사항

### [INFO] [SPEC-DRIFT] schemaCache 정책 위치 cross-reference 미갱신
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` L928, L935, L990
- 상세: spec L928 은 `workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache`를 위치 SoT로 서술하고, L935 는 "서비스 L137–142 주석 + L459–462 inline 주석"을 동시 수정 대상으로 명시한다. L990 유지보수 체크리스트도 동일 전제로 작성되어 있다. 본 PR 로 `SCHEMA_LOOKUP_HARD_STOP` 상수·캐시 정책 로직이 `assistant-tool-router.service.ts`의 `dispatchNodeSchema` 로 이전됐으므로 spec 서술이 낡았다. 행위 계약(hits=1 정상·hits=2 warning·hits≥3 hard-stop)은 코드에서 완전히 보존되어 있다.
- 제안: 코드 유지 + spec 반영. `spec/3-workflow-editor/4-ai-assistant.md` §"schemaCache 정책"(L928)을 "`assistant-tool-router.service.ts`의 `dispatchNodeSchema` 메서드" 기준으로, L935 유지보수 지시를 상수 위치 `assistant-tool-router.service.ts` 기준으로 갱신. project-planner 위임.

### [INFO] verify_workflow 인자 `requestCoverage`/`concerns` 미사용 (pre-existing gap)
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` — `buildVerifyWorkflowResult` 메서드
- 상세: spec §4.1 표(L208)는 `verify_workflow` 인자로 `requestCoverage: string`과 `concerns?: string[]`을 정의한다. 구현의 `buildVerifyWorkflowResult` 는 `verifiedNodeIds`/`verifiedEdgeIds` 만 읽고 `requestCoverage`·`concerns` 인자는 무시한다. RESOLUTION.md 가 "spec §4.1 'Stored on the tool_calls row'" 를 인용하는데, 해당 문구는 현재 spec 본문 어디에도 존재하지 않는다(전체 grep 결과 0건) — 즉 "저장해야 한다"는 명시 요구사항이 spec 에 없어 RESOLUTION 의 근거가 부정확하다. 그러나 `requestCoverage`·`concerns` 를 완전히 무시하는 것은 spec §4.1 인자 정의와 어긋난다. 이 gap 은 본 PR 이전부터 존재했으며(`buildVerifyWorkflowResult` verbatim 이동), 본 PR 이 새로 도입한 결함이 아니다.
- 제안: pre-existing gap. 별도 이슈 추적. 코드에서 `requestCoverage`/`concerns` 를 읽어 로깅하거나 tool_calls row 에 보조 데이터로 저장하는 별건 구현 필요 여부를 project-planner 와 논의.

### [INFO] 기능 완전성 — M-3 1단계 목표 완전 충족
- 위치: `assistant-tool-router.service.ts` 전체, `assistant-tool-router.service.spec.ts` 신규 테스트
- 상세: 이번 커밋의 명시 목표(WARNING #1 `dispatchNodeSchema` 추출, INFO #10 `asString` 통일, INFO #3/#4/#5/#6/#7 테스트 보강)가 모두 구현됐다. `dispatchNodeSchema` 추출은 로직 이동만이고 `hits=1/2/≥3` 세 경로가 이전 코드와 동일하게 작동한다. `asString(args.type, '')` 통일은 `typeof args.type === 'string' ? args.type : ''`과 완전 동치다. 신규 테스트 4건(비문자열 type 캐시 우회·UNKNOWN_EXPLORE_TOOL·get_workflow mode 분기·빈 캔버스 verify_workflow)이 각 경로를 고정한다.

### [INFO] 에러 시나리오 — `handleExploreCall` safety-net 동작 보존
- 위치: `assistant-tool-router.service.ts` L215–L221 (`get_current_workflow` safety-net)
- 상세: 도달 불가 `get_current_workflow` safety-net이 `{ ok: false, error: 'INTERNAL' }` 반환으로 verbatim 보존됐다. behavior-preserving 원칙에 따라 `throw` 전환 없이 원본 유지가 옳다(본 PR 범위 밖). RESOLUTION.md INFO #9 에 올바르게 defer 기록.

### [INFO] 비즈니스 로직 — verify_workflow 빈 캔버스 경계값 처리 명시화
- 위치: `assistant-tool-router.service.ts` L261–L282 (`buildVerifyWorkflowResult`), spec §4.1 L208
- 상세: 빈 캔버스(nodes=[], edges=[]) + 빈 verifiedIds 조합에서 `ok:true`·`verifiedNodeCount:0`·`verifiedEdgeCount:0` 을 반환하는 동작이 신규 테스트로 명시적으로 고정됐다. spec §4.1은 "전부 커버되면 `ok:true`"로 기술하며, 빈 캔버스에서 전부 커버(0/0)는 논리적으로 통과다. spec 과 구현이 일치한다.

### [INFO] 반환값 — 모든 경로에서 `ExploreDispatchResult` 반환
- 위치: `assistant-tool-router.service.ts` `dispatchExplore`, `dispatchNodeSchema`
- 상세: `dispatchExplore` 의 모든 분기(get_current_workflow, verify_workflow, get_node_schema, 기타)가 `{ result, reviewCompleted }` 를 반환한다. `dispatchNodeSchema` 의 cached-hit·hard-stop·첫 호출 세 경로 모두 동일 타입 반환. 누락 경로 없음.

---

## 요약

이번 커밋은 동작 보존 리팩터링(`dispatchNodeSchema` 추출 + `asString` 통일 + 테스트 보강)으로, 요구사항 충족 관점에서 기존 비즈니스 로직(schemaCache 정책·verify_workflow 로직·UNKNOWN_EXPLORE_TOOL 반환)이 완전히 보존됐다. 신규 테스트 4건이 핵심 경계 케이스를 명시적으로 고정해 회귀 방지 커버리지가 강화됐다. spec 대비 주요 불일치는 두 건인데, 둘 다 pre-existing이거나 SPEC-DRIFT 성격이다: (1) spec §"schemaCache 정책"의 위치 cross-reference가 이전 파일명을 가리키는 SPEC-DRIFT(코드가 옳고 spec만 낡음), (2) `verify_workflow`의 `requestCoverage`/`concerns` 인자 미처리는 본 PR 이전부터 존재한 gap이다. 기능 완전성·에러 시나리오·반환값 관점에서 신규 결함이 없다.

---

## 위험도

LOW
