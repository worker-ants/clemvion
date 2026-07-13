# 요구사항(Requirement) Review — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (2-edge.md §4/§5)

## 발견사항

- **[CRITICAL]** 신규 `edge-data-preview.tsx` 가 하드코딩 한국어 문자열을 도입해 기존 i18n 회귀 가드(`hardcoded-korean-ratchet.test.ts`, spec/conventions/i18n-userguide.md Principle 1)를 깬다 — 실측 확인됨(FAIL).
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` — `EdgeDataPreviewTooltip` 의 `전체 데이터 보기` 버튼 텍스트, `EdgeDataModal` 의 `표시할 데이터가 없어요.` 폴백 텍스트.
  - 상세: 실제로 `npx vitest run src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 를 실행해 재현했다 — "기존 파일이 baseline 이상으로 한국어 라인을 늘리지 않아요" / "baseline 에 없는 신규 파일이 한국어 라인을 도입하지 않아요" 두 케이스가 `components/editor/canvas/edge-data-preview.tsx: 0 → 2 (+2)` 로 FAIL 한다. `hardcoded-korean-baseline.json` 은 이번 커밋(`6fb85fa8c`)에서 갱신되지 않았다. 같은 파일(`workflow-canvas.tsx`) 안의 인접 UI(노드 검색 팝업 placeholder `"editor.searchNodesPlaceholder"`, 컨텍스트 메뉴 `"editor.openSettings"` 등)는 전부 `useT()`/`dict/{ko,en}/editor.ts` 를 통해 정식 localize 되어 있고, 메인 에디터는 web-chat 위젯과 달리 en/ko locale 이 이미 전면 활성화된 영역이다(`lib/i18n/dict/en|ko/editor.ts` 존재, `openSettings`/`searchNodesPlaceholder` 등 파리티 확인). 이 feature 만 하드코딩 한국어(버튼·폴백 문구)와 하드코딩 영어(`"Data Flow Preview"`, `"Size:"` 헤더/라벨)가 섞여 있어 실제로는 어느 locale 에서도 완전히 localize 되지 않는다.
  - 제안: `dict/ko/editor.ts`/`dict/en/editor.ts` 에 키(예: `editor.viewFullData`, `editor.noDataToShow`, 필요 시 툴팁 헤더/`Size:` 라벨도)를 추가하고 `edge-data-preview.tsx` 에서 `useT()` 로 소비하도록 고친다. 의도적으로 예외를 두려는 것이라면 `BASELINE_UPDATE=1 npm test -- hardcoded-korean-ratchet` 로 baseline 을 갱신하고 그 사유를 PR/CHANGELOG 에 명시해야 하나, 다른 신규 UI가 전부 정식 localize 된 것을 보면 이는 실수(누락)로 보인다.

- **[WARNING]** 코드 주석·CHANGELOG·spec 본문이 모두 "source 노드 결과를 `findNodeResult` 로 찾는다" 고 서술하지만, 실제 구현은 `findNodeResult` 를 호출하지 않고 별도의 수동 역순 스캔을 한다 — 의도(문서)와 구현이 어긋난다.
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx:198-220`(`useEdgeFlowData` JSDoc "…`findNodeResult` 로 찾아…") / `CHANGELOG.md` 신규 항목("`findNodeResult` → `unwrapNodeOutput().output`") / `spec/3-workflow-editor/2-edge.md` §5 본문(동일 문구) — 모두 이번 커밋에서 함께 작성됨.
  - 상세: `useEdgeFlowData` 는 `nodeResults` 배열을 뒤에서부터 순회해 `nodeId === edge.source` 인 첫 매치(=가장 최근 실행)를 반환하는 자체 루프를 구현한다. 반면 실제 export 된 store 선택자 `findNodeResult(nodeExecutionId, nodeId)`(`execution-store.ts:688-704`)는 `nodeExecutionId` 가 없으면 `firstNoExecIdIndexByNodeId`(= **exec id 가 없는 행 중 첫 번째**)만 반환한다 — 즉 일반적으로 모든 결과 행이 `nodeExecutionId` 를 갖는 현재 엔진 흐름에서 `findNodeResult(undefined, edge.source)` 를 호출하면 사실상 항상 `undefined` 가 되어 툴팁이 절대 뜨지 않는다. 따라서 실제 코드(수동 스캔)가 기능적으로는 맞고 필요하지만, 문서화된 메커니즘 이름은 틀렸다 — 향후 유지보수자가 "이미 있는 `findNodeResult` 로 대체 가능"이라 오판해 리팩터링하면 회귀가 난다.
  - 제안: 코드 주석 / CHANGELOG / `spec/3-workflow-editor/2-edge.md` §5 세 곳의 문구를 "`nodeResults` 를 역순으로 스캔해 해당 nodeId 의 가장 최근 행을 찾는다" 로 정정한다(코드 변경 불요 — 서술만 수정). spec 수정은 본 reviewer 소관 밖이라 project-planner 경로로 반영 필요.

- **[WARNING]** 신규 상태 훅 `useEdgeHoverPreview`(200ms hide-delay 타이밍 상태기계) 와 `EdgeDataPreviewTooltip`/`EdgeDataModal` 컴포넌트에 대한 테스트가 전무하다 — 같은 plan 의 인접 항목과 비교해 커버리지 갭.
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts`, `edge-data-preview.tsx`.
  - 상세: CHANGELOG·plan 파일 모두 "테스트: `summarizeDataForPreview`/`formatBytes` vitest 10케이스" 만 언급 — 순수 함수만 테스트되고 `show`/`scheduleHide`/`keepAlive`/`dismiss` 의 타이머 상태 전이, 그리고 툴팁 렌더 조건(`data===undefined || summary.isEmpty` → null)은 미검증이다. 같은 plan 의 §3.2(`useEdgeExecutionState` renderHook 9케이스)·§1.3(`useEdgeReconnect` renderHook)은 훅 레벨 테스트를 갖췄다. 이 갭 자체가 회귀는 아니지만, "엣지 벗어나도 200ms 지연 후 숨김", "툴팁에 마우스 진입 시 숨김 취소" 같은 정확히 타이밍에 의존하는 로직이 fake-timer 테스트 없이 남아 있다.
  - 제안: `useEdgeHoverPreview` 에 대해 vi.useFakeTimers 기반 renderHook 테스트(show 후 scheduleHide→타이머 만료 전 keepAlive 취소, scheduleHide→만료 후 preview null, dismiss 즉시 null) 추가 권장.

- **[INFO]** `EdgeDataPreviewTooltip` 위치가 `left: x+12px, top: y+12px` 로 고정되고 뷰포트 경계 클램핑이 없다.
  - 위치: `edge-data-preview.tsx:249-252`.
  - 상세: 뷰포트 우측/하단 가장자리 근처의 엣지를 hover 하면 `w-80 max-w-[80vw]` 툴팁이 화면 밖으로 잘려 보일 수 있다. spec §4/§5 본문은 이 경계 처리를 요구하지 않아 결함이라기보다 잔여 UX 리스크.

- **[INFO]** `use-edge-hover-preview.ts` 의 `hideTimer` 가 컴포넌트 unmount 시 정리되지 않는다(cleanup effect 없음).
  - 위치: `use-edge-hover-preview.ts` 전체(unmount용 `useEffect` 없음).
  - 상세: `scheduleHide` 로 예약된 타이머가 대기 중 소유 컴포넌트가 unmount 되면 그대로 만료돼 `setPreview(null)` 이 호출된다. React 18 은 unmount 된 컴포넌트의 state 갱신을 조용히 무시하므로 크래시/경고는 없으나, 불필요하게 살아있는 타이머다.

- **[INFO]** `connecting-nodes.mdx`/`connecting-nodes.en.mdx` frontmatter `code:` 배열이 신규 파일(`edge-data-preview.tsx`/`use-edge-hover-preview.ts`/`lib/utils/edge-data-preview.ts`) 로 갱신되지 않았다 — 반면 `spec/3-workflow-editor/2-edge.md` 의 `code:` 리스트는 이 3개 파일을 정확히 추가했다.
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`/`.en.mdx` frontmatter.
  - 상세: 두 문서 모두 이미 `workflow-canvas.tsx` 를 code 목록에 포함하고 있어(신규 배선 지점) 완전한 누락은 아니지만, spec 문서와의 갱신 비대칭이 있다.

## 확인된 정상 동작(참고)

- `summarizeDataForPreview`/`formatBytes` 순수 함수 로직·10개 vitest 케이스(null/undefined/원시값/중첩 축약/최상위 배열 5개 컷/긴 문자열/바이트 계산/순환참조 no-throw/KB·MB 포맷)는 실제로 실행해 전부 통과 확인(`vitest run`).
- `unwrapNodeOutput`/`NodeResult.outputData`/`nodeId` 필드 시그니처와 실제 사용이 일치하며, 실행 대기(waiting)·미실행 상태에서 `output: null`/`undefined` 로 귀결돼 툴팁이 뜨지 않는 경로도 논리적으로 타당하다.
- `tsc --noEmit` 전체 통과, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` import 시그니처 일치.
- `plan/in-progress/spec-sync-edge-gaps.md` 체크박스 갱신과 `spec/3-workflow-editor/2-edge.md` §4/§5 "Planned"→"구현됨" 전환은 실제 구현과 부합(i18n 이슈 제외).

## 요약

핵심 기능(엣지 hover 시 source 노드의 최근 실행 출력을 축약해 보여주는 툴팁 + 전체 데이터 모달)은 spec §4/§5 가 요구한 동작을 구조적으로 충실히 구현했고, 축약 로직·바이트 계산·hover 타이밍(200ms)·모달 독립 생명주기 등 CHANGELOG/spec 서술과 코드가 대체로 일치한다. 다만 신규 파일이 도입한 하드코딩 한국어 문자열이 기존에 실제로 enforce 되는 i18n 회귀 가드(`hardcoded-korean-ratchet.test.ts`)를 깨는 것을 직접 실행으로 확인했다 — 이는 병합을 막는 확정적 결함이다. 추가로 "findNodeResult 사용" 이라는 코드 주석·CHANGELOG·spec 서술이 실제 구현(수동 재구현 스캔)과 다르다는 문서 정확성 문제, 그리고 신규 상태 훅에 대한 테스트 부재라는 커버리지 갭이 있다. 이 셋을 고치면(i18n 키 이관, 문서 서술 정정, 훅 테스트 보강) 기능적으로는 충분한 완성도다.

## 위험도

HIGH — i18n 회귀 가드 실측 FAIL(병합 차단 사유)이 있어 CRITICAL 1건 존재하지만, 그 외 결함은 문서 서술 부정확·테스트 커버리지 갭 수준으로 기능 자체의 정확성을 훼손하지는 않는다.
