# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 이번 라운드(17_13_05) diff 는 실질적으로 직전 3회차(`16_49_37`) ai-review 산출물 9건 + `spec/3-workflow-editor/2-edge.md` 상태 전환뿐이며 신규 프로덕션 코드 변경은 없다. 10개 reviewer 모두 독립적으로 이 사실을 확인했고, 그중 requirement 리뷰어만 실제 코드(같은 changeset 커밋 `9036bb565`에 번들된 3차 fix)를 직접 대조해 spec 문서가 새로 추가된 `bytesApprox`(100KB 초과 시 근사치 표시) 동작을 반영하지 못하는 **SPEC-DRIFT** 1건을 발견했다. 코드 자체의 결함은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/3-workflow-editor/2-edge.md` §5 "현재 구현" 문단이 3라운드 fix(커밋 `9036bb565`)에서 추가된 `bytesApprox` 동작(직렬화 문자열이 100KB 초과 시 정확 `TextEncoder` 인코딩 대신 문자 수 근사치 사용 + 툴팁에 `~` 접두어 표시)을 반영하지 못함. 코드·테스트는 의도대로 정확히 구현됨(코드는 정당한 review-fix). 이 detail 은 `plan/in-progress/spec-sync-edge-gaps.md` §29 에만 문서화되어 있고 기술 명세 SoT인 spec 본문은 갱신되지 않아 "정확 계산"인 것처럼 서술된 채로 line-level 불일치가 발생함 | `spec/3-workflow-editor/2-edge.md` §5 "현재 구현" 문단 vs `codebase/frontend/src/lib/utils/edge-data-preview.ts`(`BYTE_APPROX_THRESHOLD = 100_000`) + `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:85`(`~` 접두 표시) | 코드는 그대로 두고 spec §5 문단에 "직렬화 결과가 100KB 초과 시 정확 `TextEncoder` 인코딩 대신 문자 수 근사치를 쓰고 크기 표시에 `~`를 붙인다" 한 문장 추가. `project-planner` 경로로 spec 갱신(코드 revert 아님) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프/공통 | 이번 라운드 배정 파일 10개는 전부 이전 라운드(`16_49_37`) 리뷰 산출물 9건 + spec 문서 1건이며, 실제 프로덕션 코드 diff(`edge-data-preview.tsx`/`use-edge-hover-preview.ts`/`workflow-canvas.tsx`/`edge-data-preview.ts` 등, 커밋 `9036bb565`)는 이번 라운드 어떤 reviewer 에게도 배정되지 않음. 다수 reviewer(performance/architecture/scope/side_effect/maintainability/testing)가 이를 관측하고 직접 git 으로 실제 코드를 재확인해 갭을 메움 — 병합 차단 사유 아니나 향후 라운드의 diff base/router 산정 방식 재점검 여지 | `review/code/2026/07/13/17_13_05/meta.json`(`agents_forced` 목록) vs 실제 커밋 `9036bb565` 전체 diff | 조치 불필요(참고). 다음 라운드부터 `--route=all` 또는 코드 파일 명시 타겟팅으로 실제 프로덕션 diff 도달 여부 확인 권장 |
| 2 | 문서(spec) | spec §5 ASCII 목업 예제가 실제 렌더 출력과 문자 단위로 불일치(따옴표 유무): 목업 `"items": [3 items]` vs 실제 렌더 `"items": "[3 items]"`(문자열 반환 후 JSON.stringify). requirement/documentation 리뷰어 둘 다 회색지대 INFO 로 재확인, 병합 차단 아님 | `spec/3-workflow-editor/2-edge.md` §5 ASCII 목업 vs `edge-data-preview.ts` `abbreviate()` + 테스트 단언 | 우선순위 낮음. spec 목업을 실제 출력에 맞게 정정하거나 의도(이상적 표시) 각주 명시. `project-planner`/`developer` 재량 |
| 3 | 성능 | `summarizeDataForPreview` 바이트 계산 상한(`BYTE_APPROX_THRESHOLD`)은 `TextEncoder` 인코딩 단계에만 적용되고, 선행하는 `JSON.stringify(value)` 자체는 여전히 무제한 — "매우 큰 단일 출력에 hover 정착" 시 stringify 동기 비용은 부분적으로만 완화(근본 해결 아님) | `codebase/frontend/src/lib/utils/edge-data-preview.ts:66-78` | 우선순위 낮음(diminishing return). `full.length` 초과 케이스에서 stringify 자체를 스킵하고 `abbreviate()` 결과 근사치로 대체하는 방안 고려 |
| 4 | 성능 | `abbreviate()` 객체 분기의 eager `Object.entries` 전체 열거(배열 분기는 `.slice()`로 필요분만 처리해 비대칭) — depth-1 1회 한정, 영향 작음 | `codebase/frontend/src/lib/utils/edge-data-preview.ts:34-42` | 우선순위 낮음. 조치 불필요 |
| 5 | 성능 | `edge-data-preview.tsx` `useEdgeFlowData` 가 `edgeId` 문자열만 받아 매번 `edges.find()`로 재탐색(prop-drilling) — 대형 워크플로에서 반복 hover 시 누적 가능하나 일반 규모에서는 무시 가능 | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:26-29` | 우선순위 낮음. `edge: Edge` 직접 전달 또는 `sourceNodeId` 를 hover state 에 커밋해 `.find()` 제거 고려 |
| 6 | 아키텍처(defer, 추적됨) | "nodeId → 최신 실행 결과" 조회 로직이 `execution-store.ts`(`findLatestResultByNodeId`, O(1) 신규)와 `node-settings-panel.tsx`(원본 역순 선형 스캔, 미이관)·`use-expression-context.ts`(별도 bulk 패턴)로 3중 중복 잔존 — `plan/in-progress/spec-sync-edge-gaps.md`에 후속 task(`task_edb57ca2`)로 명시적 defer 됨, 이번 라운드 변동 없음 | `codebase/frontend/src/lib/stores/execution-store.ts` vs `.../settings-panel/node-settings-panel.tsx:508` | 조치 불필요(이번 PR 스코프 밖). 후속 task 진행 시 `node-settings-panel.tsx`부터 이관 |
| 7 | 아키텍처(defer, 추적됨) | `workflow-canvas.tsx` 오케스트레이션 누적(God-component 경향) — 신규 `openDataModal`/`closeDataModal` 콜백이 추가로 얹혔으나 개별 로직은 훅/유틸에 위임돼 응집도 저하 미미. 기존 plan 에 "§4 오케스트레이션 정리 시 이월"로 추적 중 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` | 조치 불필요 — 기존 계획대로 후속 오케스트레이션 정리 시 일괄 처리 |
| 8 | 테스트 | testing.md(직전 라운드)가 권고한 두 상태 변형(`running`/`failed`) 중 `failed`(에러만 있고 output 없음/부분 output) 케이스는 이번 fix 커밋에도 여전히 미추가 — "status 무관 렌더" 핵심 동작은 `running` 케이스로 이미 회귀 가드됨 | `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx` | 우선순위 낮음. `seedResult("a", undefined, "failed")` 케이스 1건 추가 고려 |
| 9 | 테스트 | `onOpenModal` 인라인 콜백 → `openDataModal`/`closeDataModal` `useCallback` 추출 시 `dismiss()`→`setDataModalEdgeId(id)` 순서는 보존 확인됐으나, 이를 검증하는 통합 테스트가 없음(canvas 레벨 테스트 하네스 부재는 기존 이월 갭) | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx:266-274` | 우선순위 낮음. 향후 canvas 통합 테스트 하네스 도입 시 "모달 오픈 시 툴팁 소멸" 케이스 포함 |
| 10 | 프로세스(리뷰 산출물 포맷) | 직전 라운드(`16_49_37`)에서 신설된 리뷰어 산출물 9건 중 5건(performance/requirement/scope/security/side_effect)이 agent definition 의 출력 형식(H3, 타이틀 없음)을 어기고 H1 타이틀 + H2 섹션으로 작성됨(maintainability/testing/user_guide_sync 는 정의된 H3 형식 준수). 기능적 파급은 낮으나 향후 파싱 도구 추가 시 두 형식 모두 처리해야 하는 부담 발생 가능 | `review/code/2026/07/13/16_49_37/{performance,requirement,scope,security,side_effect}.md` vs `.claude/agents/{performance,requirement,scope,security}-reviewer.md` "## 출력 형식" | 우선순위 낮음. 향후 라운드에서 해당 5개 sub-agent 가 자기 definition 의 H3 형식을 그대로 따르도록 유의 |
| 11 | 문서(스타일) | 신규 리뷰 산출물 3개(`maintainability.md`/`user_guide_sync.md`/`meta.json`)가 EOF 트레일링 개행 없이 저장됨 — 기능·내용 영향 없음, 정식 코드 스타일 가드 대상도 아님 | `review/code/2026/07/13/16_49_37/{maintainability,user_guide_sync}.md`, `.../meta.json` | 조치 불필요(참고, 최하 우선순위) |
| 12 | i18n/문서 동기 | user_guide_sync 매트릭스 21행 전수 재확인(실측 git 이력 + Bash 재실행) 결과 동반 갱신 누락 0건. `~` 근사 기호는 로케일 무관·기존 `t("editor.edgeDataSize")` 키 재사용이라 신규 UI 문자열 trigger 미해당. dict ko/en parity, spec frontmatter, mdx ko/en 대칭 모두 가드 pass(vitest 877 passed | 1 skipped) | `spec/3-workflow-editor/2-edge.md`, `dict/{ko,en}/editor.ts`, `content/docs/03-workflow-editor/connecting-nodes.{mdx,en.mdx}` 등 | 조치 불필요. 문제 없음으로 분류 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 diff 없음(문서/리뷰 산출물뿐). 하드코딩 시크릿·인젝션·인가 경계 확장 없음. 이전 라운드 hover 노출 판정(신규 인가 경계 아님) 재확인 |
| performance | LOW | byte-cap fix 확인(부분 해소, JSON.stringify 자체는 여전히 무제한), abbreviate eager 열거·edges prop-drilling 재확인(둘 다 우선순위 낮음, 병합 차단 아님) |
| architecture | NONE | 계층 구조(순수 유틸→타이밍 훅→프레젠테이션→오케스트레이터) 보존 확인. 3중 조회 중복·God-component 누적은 defer 추적 중, 변동 없음 |
| requirement | LOW | [SPEC-DRIFT] `bytesApprox` 동작 spec §5 미반영 WARNING 1건(유일한 WARNING). ASCII 목업 따옴표 불일치는 INFO 재확인 |
| scope | NONE | 배정 파일 10개 전부 리뷰 산출물+spec 상태전환, 요청 범위(§4/§5) 밖 변경·무관한 리팩터링 없음 |
| side_effect | NONE | 배정 파일은 실행되지 않는 정적 문서. 배정 밖 실제 fix 코드도 직접 대조해 전역 상태·공개 API·외부 I/O 영향 없음(내부 prop/순수 additive) 확인 |
| maintainability | NONE | 코드-레벨 유지보수성 기준 적용 대상 없음(문서/spec 뿐). 리뷰 산출물 포맷 불일치(H1 vs H3) 참고 관측 |
| testing | NONE | 직전 testing INFO 3건이 실제 회귀 테스트로 해소됨을 확인(vitest 92→96 passed). `failed` 상태 변형·콜백 순서 통합테스트 부재는 잔여 INFO |
| documentation | NONE | spec frontmatter/§4/§5 서술이 실제 구현과 line-level 일치. ASCII 목업 따옴표 불일치·EOF 개행 누락은 경미한 INFO |
| user_guide_sync | NONE | 매트릭스 21행 전수 재확인, 동반 갱신 누락 0건. dict parity·spec frontmatter·mdx ko/en 대칭 전부 가드 pass |

## 발견 없는 에이전트

없음 — 10개 에이전트 모두 최소 1건 이상의 INFO 를 보고했으나 CRITICAL 은 전무하며, WARNING 은 requirement 1건([SPEC-DRIFT])뿐이다.

## 권장 조치사항
1. (SPEC-DRIFT, 유일한 WARNING) `spec/3-workflow-editor/2-edge.md` §5 "현재 구현" 문단에 `bytesApprox` 근사 동작(100KB 초과 시 문자 수 근사 + 툴팁 `~` 표시) 한 문장 추가 — `project-planner` 경로로 spec 갱신, 코드 변경 불필요.
2. (낮은 우선순위, 선택) spec §5 ASCII 목업의 따옴표 표기를 실제 렌더 출력(`"items": "[3 items]"`)에 맞게 정정하거나 의도를 각주로 명시.
3. (낮은 우선순위, 선택) `edge-data-preview.test.tsx` 에 `failed` 상태 변형 케이스 1건 추가해 테스트 커버리지 완전화.
4. (프로세스 개선, 차기 라운드 참고) 향후 라운드에서 성능/요구사항/스코프/보안/부작용 리뷰어가 실제 프로덕션 코드 diff 에도 배정되도록 diff base/router 산정 방식 점검, 5개 sub-agent 의 출력 포맷(H3 표준) 준수 유의.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, user_guide_sync`

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 이번 changeset 이 리뷰 산출물(md/json)+spec 문서 갱신뿐이라 의존성 변경 대상 없음(router 판단, 상세 사유 미제공) |
  | database | 이번 changeset 에 DB 스키마/쿼리 변경 없음(router 판단, 상세 사유 미제공) |
  | concurrency | 이번 changeset 에 동시성/레이스 관련 코드 변경 없음(router 판단, 상세 사유 미제공) |
  | api_contract | 이번 changeset 에 API 계약 변경 없음(router 판단, 상세 사유 미제공) |