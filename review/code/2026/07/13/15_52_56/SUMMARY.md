# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — 신규 `edge-data-preview.tsx` 가 저장소의 i18n 회귀 가드(`hardcoded-korean-ratchet.test.ts`)를 실측으로 깨뜨린다(2 tests failed, 재현 확인). 이 1건 외 기능 자체(hover 미리보기 + 전체 데이터 모달)는 spec §4/§5 요구사항을 구조적으로 충실히 구현했으며, 나머지는 성능 반패턴 재도입·문서-구현 불일치·테스트 커버리지 갭 수준의 WARNING 이다.

## 데이터 갭 (재확인 필요)

`documentation`, `user_guide_sync` 두 리뷰어는 워크플로 매니페스트상 `status=success` 로 보고됐으나, 해당 `output_file`(`documentation.md`, `user_guide_sync.md`)이 세션 디렉터리에 실제로 존재하지 않는다(Read 시도 시 "File does not exist", `ls` 로도 미확인 — disk-write gap). 이 두 리뷰어의 실제 발견사항은 **본 통합 보고서에 반영되지 못했다.** 특히 `documentation` 리뷰어는 (다른 리뷰어들이 이미 부분적으로 지적한) i18n 컨벤션·spec/mdx 동기화 이슈를 더 상세히 다뤘을 가능성이 있다. **"발견 없음"으로 간주하지 말고 두 리뷰어를 재실행하거나 output 을 재확인할 것.**

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / maintainability | 신규 `edge-data-preview.tsx` 가 하드코딩 문자열(영문 `"Data Flow Preview"`/`"Size:"` + 한글 `"전체 데이터 보기"`/`"표시할 데이터가 없어요."`, 언어 혼용)을 도입해 기존 i18n 회귀 가드를 실제로 깨뜨림 — `npx vitest run src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 실행 결과 2 tests failed(`components/editor/canvas/edge-data-preview.tsx: 0 → 2 (+2)`), `hardcoded-korean-baseline.json` 미갱신. 같은 디렉터리의 다른 캔버스 컴포넌트·`workflow-canvas.tsx` 자신은 모두 `useT()`/`dict/{ko,en}/editor.ts` 로 정식 localize 되어 있어 이 파일만 관례를 벗어남. (참고: CHANGELOG/spec §5 의 ASCII 목업 자체가 이 문구를 그대로 명시하긴 하나, 그렇다고 `useT()` 우회가 정당화되지는 않음 — scope 리뷰어도 이 문자열 선택 자체는 spec 준수로 판단했지만 i18n 컨벤션 준수 여부는 별개 관점) | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`EdgeDataPreviewTooltip`, `EdgeDataModal`) | `dict/ko/editor.ts`/`dict/en/editor.ts` 에 키(`editor.viewFullData`, `editor.noDataToShow`, 헤더/`Size:` 라벨 포함) 추가 후 `useT()` 로 교체(`workflow-canvas.tsx` 가 이미 `useT`/`useLocale` 사용 중이므로 prop 전달 또는 자체 `useT()` 호출로 배선). 병합 전 필수 수정. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | performance / architecture / requirement | `useEdgeFlowData` 가 "nodeId 의 최신 실행 결과 찾기"를 스토어의 O(1) 인덱스(`lastIndexByNodeId`, 그 도입 주석 자체가 "reverse 스캔 대체" 목적을 명시)를 쓰지 않고 O(n) 역방향 선형 스캔으로 재구현했다. 동일 로직이 `node-settings-panel.tsx`(`InfoTab`)·`use-expression-context.ts` 계열에도 이미 서로 다른 변형으로 중복 존재(3중 중복). 게다가 이 훅의 JSDoc·`CHANGELOG.md`·`spec/3-workflow-editor/2-edge.md` §5 는 모두 "`findNodeResult` 로 찾는다"고 서술하지만 실제로는 `findNodeResult` 를 호출하지 않으며, `findNodeResult(undefined, nodeId)` 의 실제 시맨틱("exec-id 없는 첫 행")은 이 훅이 필요로 하는 "최신 행"과 달라 그대로 대체하면 회귀가 난다 — 문서와 구현이 어긋난 상태로 남겨짐. 실행 중(Loop/ForEach 로 `nodeResults` 가 크게 자라는 워크플로) hover 상태에서 무관한 노드 결과가 도착할 때마다 전체 재스캔이 반복된다. | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` `useEdgeFlowData`; 비교 대상 `node-settings-panel.tsx` `InfoTab`, `use-expression-context.ts`; `execution-store.ts`(`lastIndexByNodeId`, `findNodeResult`) | `lastIndexByNodeId` 를 감싼 공유 O(1) selector(예: `findLatestResultByNodeId(nodeId)`)를 스토어에 추가해 세 소비처가 공유하도록 단일화. JSDoc/CHANGELOG/spec §5 의 `findNodeResult` 서술을 실제 메커니즘("`nodeResults` 역순 스캔으로 최신 행 탐색" 또는 신규 selector 명)으로 정정(spec 수정은 project-planner 경로). |
| 3 | performance | 바이트 크기 계산(`summarizeDataForPreview` 의 `JSON.stringify(value)` 전체 + `new TextEncoder().encode`)과 `EdgeDataModal` 의 `JSON.stringify(data, null, 2)`(useMemo 미적용, JSX 인라인)가 크기 상한·디바운스·메모이제이션 없이 hover/렌더 경로에서 동기 실행된다. `show()` 는 `scheduleHide()` 와 달리 즉시 실행이라 캔버스에서 여러 엣지 위로 빠르게 마우스를 지나갈 때마다, 대용량 노드 출력에서 메인 스레드 블로킹이 반복될 수 있다(security 리뷰어도 동일 지점을 "공격 벡터는 아니나 로컬 UX 성능 이슈"로 확인). | `codebase/frontend/src/lib/utils/edge-data-preview.ts` `summarizeDataForPreview`; `edge-data-preview.tsx` `EdgeDataModal` | 바이트 크기는 `new Blob([full]).size` 등으로 구하거나 상한 초과 시 근사치로 대체. `show()` 에 짧은 디바운스 추가. `EdgeDataModal` 의 `JSON.stringify` 를 `data` 키 `useMemo` 로 감싸기. |
| 4 | architecture | `EdgeDataModal` 이 이미 존재하는 재사용 가능한 `JsonContent` 컴포넌트(`run-results/renderers/presentation-renderers.tsx`, `result-detail.tsx` 등에서 동일 데이터에 대해 이미 사용 중)와 거의 동일한 `<pre>{JSON.stringify(data, null, 2)}</pre>` 마크업을 인라인으로 새로 작성했다 — 표시 포맷 변경 시 한쪽만 갱신되는 drift 위험. | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`EdgeDataModal`) | `JsonContent` 를 import 해 재사용하거나 공용 위치로 승격해 두 구현이 공유하도록 리팩터. |
| 5 | requirement / testing | 신규 `useEdgeHoverPreview` 훅(200ms hide-delay 상태기계: `show`/`scheduleHide`/`keepAlive`/`dismiss`)과 `EdgeDataPreviewTooltip`/`EdgeDataModal` 컴포넌트에 대한 테스트가 전무하다. 같은 디렉터리의 형제 훅·컴포넌트(`use-edge-execution-state.test.ts`, `use-edge-reconnect.test.ts`, `container-delete-dialog.test.tsx` 등)는 예외 없이 `renderHook`/RTL 테스트를 갖추고 있어 이 파일들만 관례를 벗어난다. 미검증 상태로 남은 항목: (1) `scheduleHide` 후 재진입 시 타이머 취소, (2) 지연 후 실제 `null` 전환, (3) unmount 시 pending 타이머 정리 여부, (4) `data===undefined || summary.isEmpty` 시 툴팁 미렌더, (5) "전체 데이터 보기" 클릭 → `onOpenModal` 인자, (6) `useEdgeFlowData` 의 "최신 iteration 우선" 선택 로직. | `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts`, `edge-data-preview.tsx` | `use-edge-hover-preview.test.ts`(`vi.useFakeTimers()` + `renderHook`, 재진입 취소·지연 후 숨김·unmount cleanup) 및 `__tests__/edge-data-preview.test.tsx`(렌더 분기·클릭 핸들러·최근 결과 선택 로직) 신설. |
| 6 | testing | `EdgeDataModal` 의 "데이터 없음" 판정이 `data === undefined` 만 검사한다. `unwrapNodeOutput` 은 `waiting_for_input` 등 partial-output 상태에서 `output: null` 을 반환하도록 설계돼 있어, 이 경로를 타면 `JSON.stringify(null, null, 2)` → 리터럴 `"null"` 문자열이 그대로 렌더될 수 있다. 현재는 툴팁(`isEmpty` 체크)이 게이트라 도달 불가능하지만, 모달이 향후 다른 진입점(예: context 메뉴 직접 열기)으로 독립 호출되면 조용히 깨질 잠재 결함이다. | `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:305-307` | `data === undefined || data === null` 로 통일하거나, "툴팁을 통해서만 열려 null 이 도달 안 함" 불변식을 회귀 테스트로 고정. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 7 | side_effect / requirement | `use-edge-hover-preview.ts` 의 `hideTimer` 가 컴포넌트 unmount 시 정리되지 않음(cleanup `useEffect` 없음). React 18 은 unmount 후 state 갱신을 무시해 크래시/경고는 없으나 불필요하게 타이머·클로저가 남음. | `use-edge-hover-preview.ts` | `useEffect(() => () => clearTimer(), [clearTimer])` 추가. |
| 8 | requirement / maintainability | `connecting-nodes.mdx`/`.en.mdx` frontmatter `code:` 목록이 신규 파일 3개(`edge-data-preview.tsx`/`use-edge-hover-preview.ts`/`lib/utils/edge-data-preview.ts`)로 갱신되지 않음(`spec/3-workflow-editor/2-edge.md` 쪽은 정상 반영됨). | `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`(`.en.mdx`) | mdx 두 파일의 `code:` 배열에 3개 신규 파일 추가. |
| 9 | performance / testing | `useEdgeHoverPreview()` 가 매 렌더 새 객체 리터럴을 반환(개별 콜백은 `useCallback` 이나 반환 객체 자체는 `useMemo` 미적용). `workflow-canvas.tsx` 의 `onEdgeMouseEnter`/`onEdgeMouseLeave` 가 이 객체 전체를 deps 로 잡아 매 리렌더마다 재생성되며, 형제 훅(`use-edge-execution-state`)이 갖춘 참조안정성 관례와 반대 방향. | `use-edge-hover-preview.ts`, 소비처 `workflow-canvas.tsx` | 훅 반환값을 `useMemo` 로 감싸거나, 최소한 참조안정성 회귀 테스트 추가. |
| 10 | performance | `EdgeDataModal` 이 닫혀 있어도(`dataModalEdgeId === null`) 매 렌더 `useEdgeFlowData("", edges)` 를 호출해 무의미한 O(E) `edges.find` 스캔을 반복. | `edge-data-preview.tsx` `EdgeDataModal` | 훅 내부에서 `edgeId` 빈 문자열/미존재 시 스캔 자체를 건너뛰는 가드 추가. |
| 11 | architecture | `canvas/` 디렉터리가 처음으로 `run-results/output-shape.ts` 의 `unwrapNodeOutput` 을 import(전수 grep 확인) — 재사용은 타당하나 위치상 "run-results 소유 세부사항"처럼 보여 모듈 경계가 모호해짐. | `edge-data-preview.tsx:6` | 세 번째 소비처 발생 전에 `output-shape.ts` 를 `lib/utils/` 등 중립 위치로 이동 고려. |
| 12 | architecture | 전체 `edges` 배열이 `EdgeDataPreviewTooltip`/`EdgeDataModal` 양쪽에 prop-drilling 되고 각자 동일한 `.find()` 를 반복 수행(hover 시점에 이미 `RFEdge` 객체를 쥐고 있음에도). | `workflow-canvas.tsx`, `edge-data-preview.tsx` `useEdgeFlowData` | hover 시 `sourceNodeId` 를 함께 커밋하거나 `useEdgeFlowData` 시그니처를 `edge: Edge | undefined` 직접 수신으로 변경. |
| 13 | architecture | `workflow-canvas.tsx`(1034줄) 에 이번 PR 이 hover/modal state·콜백을 추가로 얹어 기존에 이미 plan(`spec-sync-edge-gaps.md`)이 인지·추적 중인 오케스트레이션 누적(God-component)이 한 겹 더 쌓임. 새 결함은 아니며 개별 로직 자체의 응집도는 양호. | `workflow-canvas.tsx` | 기존 계획대로 후속 "§4 오케스트레이션 정리" 시 이번 배선도 함께 이동 대상에 포함. |
| 14 | maintainability | `formatBytes` 내부 `1024`/`1024 * 1024` 가 named 상수 없이 리터럴로 반복(다른 상수는 이미 이름 있음). | `codebase/frontend/src/lib/utils/edge-data-preview.ts` (`formatBytes`) | `BYTES_PER_KB` 등으로 추출해 스타일 통일(낮은 우선순위). |
| 15 | testing | `summarizeDataForPreview` 의 경계값(최상위 배열 정확히 5개/객체 필드 정확히 20개, `formatBytes` 의 1024/1024*1024 정확 경계)이 테스트되지 않음(현재 테스트는 초과 케이스만 커버). | `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts` | 경계 케이스(5개·21개, `formatBytes(1024)`/`formatBytes(1024*1024)`) 추가. |
| 16 | requirement / security | 툴팁 위치가 `left: x+12, top: y+12` 로 고정되고 뷰포트 경계 clamp 이 없어 화면 우측/하단 근처 hover 시 잘릴 수 있음. spec §4/§5 는 이 처리를 요구하지 않아 결함이라기보다 잔여 UX 리스크(보안 영향 없음). | `edge-data-preview.tsx:249-252`, `workflow-canvas.tsx` `onEdgeMouseEnter` | 필요 시 clamp 로직 추가(낮은 우선순위). |
| 17 | security | hover 미리보기가 이미 클라이언트에 로드된 실행 결과(`useExecutionStore.nodeResults`, 동일 인증 세션·워크스페이스 권한 범위)를 저마찰(hover)로 노출 — 권한 상승이나 신규 데이터 접근 경로는 아니나, 노드 출력에 우연히 시크릿/PII 가 섞이면 화면공유·shoulder-surfing 시 우발적 노출 가능성이 hover 로 인해 다소 높아짐. | `edge-data-preview.tsx` (`useEdgeFlowData`, `EdgeDataPreviewTooltip`, `EdgeDataModal`) | 별도 강제 조치 불필요(기존 Run Results 와 동일 노출 범위). 향후 노드 출력 마스킹/redaction 정책 도입 시 이 경로도 포함 대상에 넣을 것. |

## 확인된 정상 동작(결함 아님)

- 렌더링은 전 구간 React 텍스트 자식으로만 처리되어 `dangerouslySetInnerHTML`/`eval` 등 인젝션 벡터 없음(security).
- 200ms hide-delay 는 spec 문면에 규정된 수치는 아니나 "전체 데이터 보기" 버튼 클릭을 가능하게 하는 데 필요한 최소 장치로, over-engineering 이 아님(scope).
- UI 문자열의 영·한 혼용 자체는 CHANGELOG·spec §5 ASCII 목업이 명시한 문구를 그대로 따른 것이라 스코프 확장은 아님(다만 `useT()` 미사용은 별개로 Critical #1 참고)(scope).
- `summarizeDataForPreview`/`formatBytes` 순수 함수 로직·10개 vitest 케이스 실행 확인, `tsc --noEmit` 전체 통과, `unwrapNodeOutput`/`NodeResult` 필드 시그니처 일치, 순환 의존성 없음(requirement, architecture).
- `plan/in-progress/spec-sync-edge-gaps.md` 체크박스 갱신 및 `spec/3-workflow-editor/2-edge.md` §4/§5 "Planned"→구현 전환은 실제 구현과 부합(i18n 이슈 제외)(requirement, scope).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | hover 노출 정보성 관찰 3건, XSS 벡터 없음 확인 |
| performance | MEDIUM | O(n) 스캔 재도입(O(1) 인덱스 미사용), 무가드 직렬화·비메모이제이션 |
| architecture | LOW | 3중 중복 로직, JSON 뷰어 재구현, 모듈 경계·prop-drilling 관찰 |
| requirement | HIGH | i18n ratchet 실측 FAIL(CRITICAL), 문서-구현 불일치, 테스트 갭 |
| scope | NONE | plan 항목과 정확히 일치, 범위 이탈 없음 |
| side_effect | LOW | hideTimer 언마운트 미정리 |
| maintainability | CRITICAL | i18n 컨벤션 위반 — ratchet 테스트 실측 FAIL |
| testing | MEDIUM | 신규 훅/컴포넌트 테스트 전무, null 처리 미검증 |
| documentation | 확인 불가 | output 파일 디스크 누락(disk-write gap) — 재실행 필요 |
| user_guide_sync | 확인 불가 | output 파일 디스크 누락(disk-write gap) — 재실행 필요 |

## 발견 없는 에이전트

scope — plan 항목과 정확히 대응, 범위 이탈 없음(NONE). security — 실질 결함 없음(NONE, 정보성 관찰만 존재).

## 권장 조치사항

1. (최우선, 병합 차단) `edge-data-preview.tsx` 의 하드코딩 문자열을 `dict/{ko,en}/editor.ts` 키로 이관하고 `useT()` 로 교체해 `hardcoded-korean-ratchet.test.ts` 를 통과시킨다.
2. `documentation`, `user_guide_sync` 두 리뷰어의 output 파일 디스크 누락(disk-write gap)을 재확인 — 재실행하거나 journal 로그에서 복구해 실제 발견사항 유무를 확정한다.
3. `useEdgeFlowData` 의 "nodeId 최신 결과 찾기"를 스토어의 O(1) `lastIndexByNodeId` 기반 공유 selector 로 통합하고(`node-settings-panel.tsx`/`use-expression-context.ts` 와 공유), JSDoc/CHANGELOG/spec §5 의 `findNodeResult` 서술을 실제 메커니즘으로 정정한다.
4. `useEdgeHoverPreview` 훅(타이밍 경쟁 3케이스)과 `EdgeDataPreviewTooltip`/`EdgeDataModal` 컴포넌트(렌더 분기·클릭 핸들러)에 대한 단위/RTL 테스트를 추가한다.
5. `EdgeDataModal` 의 데이터-없음 판정을 `undefined || null` 로 통일하고, byte 크기 계산에 상한/디바운스를 적용하며 `JSON.stringify` 호출을 `useMemo` 로 감싼다.
6. 낮은 우선순위: `JsonContent` 컴포넌트 재사용, `edges` prop-drilling 최소화, `useEdgeHoverPreview` 반환 객체 메모이제이션, `connecting-nodes.mdx`/`.en.mdx` `code:` 목록 갱신, `formatBytes` 리터럴 상수화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (10명)
  - **제외**: 표 (reviewer · 이유, 4명) — 구체 사유는 매니페스트에 미포함(라우터가 이 변경을 프런트엔드 순수 UI 기능으로 판단, 해당 도메인 무관으로 추정)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync` (8명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 신규 의존성 변경 없음(순수 프런트엔드 UI 기능, 기존 라이브러리만 사용) — 라우터 판단, 상세 사유 매니페스트 미포함 |
  | database | DB 스키마/쿼리 변경 없음 — 라우터 판단, 상세 사유 매니페스트 미포함 |
  | concurrency | 서버측 동시성/레이스 조건과 무관(클라이언트 hover UI) — 라우터 판단, 상세 사유 매니페스트 미포함 |
  | api_contract | API/wire 프로토콜 변경 없음(순수 프런트엔드) — 라우터 판단, 상세 사유 매니페스트 미포함 |