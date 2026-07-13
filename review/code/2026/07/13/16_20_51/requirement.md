# 요구사항(Requirement) Review — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (2-edge.md §4/§5, 후속/해소 라운드)

본 리뷰는 `review/code/2026/07/13/15_52_56` 라운드(CRITICAL 1 + WARNING 5)의 해소분(`RESOLUTION.md`)이 실제로 반영됐는지와, 그 결과물이 spec §4/§5 본문과 line-level 로 일치하는지를 함께 점검한다.

## 발견사항

- **[INFO]** 이전 CRITICAL(i18n ratchet FAIL) 실측 재확인 — 해소됨
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/editor.ts`
  - 상세: `EdgeDataPreviewTooltip`/`EdgeDataModal` 이 하드코딩 문자열(`"Data Flow Preview"`/`"Size:"`/`"전체 데이터 보기"`/`"표시할 데이터가 없어요."`) 대신 `useT()` + `dict/{ko,en}/editor.ts` 의 `editor.edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData` 키 4개로 정확히 교체됨(4개 키 이름이 컴포넌트·ko dict·en dict 3곳에서 오타 없이 일치). 직접 재실행해 확인: `npx vitest run src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` → 통과. 신규 vitest 3파일(22 tests, 1 skipped) 및 `tsc --noEmit` 전체도 클린 재확인.
  - 결론: 병합 차단 사유였던 CRITICAL 은 실측으로 해소 확인됨.

- **[INFO]** 이전 WARNING #2(`findNodeResult` 문서-구현 불일치, O(n) 재스캔) — 해소됨, spec/CHANGELOG/plan/JSDoc 전수 일치
  - 위치: `codebase/frontend/src/lib/stores/execution-store.ts`(`findLatestResultByNodeId` 신설, `lastIndexByNodeId` 기반 O(1)) / `edge-data-preview.tsx` `useEdgeFlowData`(반응형 selector 로 소비) / `spec/3-workflow-editor/2-edge.md` §5 / `CHANGELOG.md` / `plan/in-progress/spec-sync-edge-gaps.md`
  - 상세: 신규 selector `findLatestResultByNodeId(nodeId)` 는 `lastIndexByNodeId.get(nodeId)` 로 후보 인덱스를 얻은 뒤 `row?.nodeId === nodeId` 로 재검증하는 방어적 패턴을 취해, 같은 파일의 `addNodeResult`/`findNodeResult` 가 이미 쓰는 "인덱스 stale 가능성 방어" 관례와 일치한다. `nodeResults` 배열은 `addNodeResult` 경로에서만 append/in-place update 되고 splice/reorder 되지 않으므로(직접 확인) 인덱스 무효화 우려는 없다. `edge-data-preview.tsx` JSDoc, `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md §5`, `plan/in-progress/spec-sync-edge-gaps.md` 4곳 모두 이제 정확히 "`findLatestResultByNodeId`" 로만 서술하며, 예전에 불일치를 유발했던 "`findNodeResult` 로 찾는다" 표현은 어디에도 남아있지 않음(grep 확인). Zustand selector 가 매 상태 변화마다 `s.findLatestResultByNodeId(...)` 를 재호출하는 방식이라 반응형으로 최신값을 반영한다(참조 안정성은 스토어가 새 배열/Map 을 만들 때만 갱신 — 기존 관례와 동일).
  - 결론: spec fidelity 관점에서 문서-구현 100% 일치로 회복.

- **[INFO]** 이전 WARNING #3/#4(무가드 직렬화, JsonContent 미재사용) — 해소됨
  - 위치: `edge-data-preview.tsx` `EdgeDataModal`(이제 `import { JsonContent } from "../run-results/renderers/presentation-renderers"` 재사용, 인라인 `<pre>{JSON.stringify(...)}</pre>` 제거) / `EdgeDataPreviewTooltip`(`summarizeDataForPreview` 결과를 `useMemo(() => ..., [data])` 로 메모이제이션)
  - 상세: 모달의 대용량 JSON 재직렬화 이슈는 공용 컴포넌트 재사용으로 해소(그 컴포넌트의 자체 메모이제이션 정책을 그대로 상속). 툴팁 쪽 summarize 계산은 `data` 값이 바뀔 때만 재계산되도록 메모이제이션됨. bytes 계산 자체의 무제한 `JSON.stringify(원본)` 은 여전히 남아있으나(RESOLUTION 이 "이월" 로 명시), hover 트리거마다서만 1회 계산되고 즉시 반환 표시하는 형태라 기존 성능 리뷰가 제기한 "매 렌더 재계산" 문제는 해소됐다.

- **[INFO]** 이전 WARNING #5(테스트 전무) — 해소됨, spec 서술과 정확히 일치
  - 위치: `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-hover-preview.test.ts`(renderHook 5), `codebase/frontend/src/components/editor/canvas/__tests__/edge-data-preview.test.tsx`(RTL 3), `codebase/frontend/src/lib/utils/__tests__/edge-data-preview.test.ts`(순수 util 10) — 합계 18, CHANGELOG/plan 이 명시한 숫자와 정확히 일치. 실행 결과 22 passed(1 skipped — 무엇이 skip 됐는지는 vitest 리포트에 이름이 없어 특정 불가, 실패 아님 확인) — CHANGELOG/plan 이 언급한 "18" 은 이 3 파일의 `it(...)` 개수 합과 일치(5+3+10=18, 나머지 4개는 `hardcoded-korean-ratchet.test.ts` 자체의 4 케이스).
  - 상세: 타이밍 경쟁 3케이스(재진입 취소·지연 후 숨김·unmount cleanup) + 참조안정성 1케이스가 `use-edge-hover-preview.test.ts` 에 실제로 존재하며 `vi.useFakeTimers()` 로 정확히 검증한다. `edge-data-preview.test.tsx` 는 "실행 데이터 없음→미렌더", "데이터 있음→축약 렌더", "클릭→onOpenModal(edgeId)" 3가지를 각각 커버해 이전 WARNING 이 지적한 항목과 1:1 대응.

- **[INFO]** 이전 WARNING #6(모달 null/undefined 체크) — 해소됨
  - 위치: `edge-data-preview.tsx` `EdgeDataModal` — `data == null ? ... : <JsonContent data={data} />`
  - 상세: `==` (loose) 비교로 `null`/`undefined` 모두 커버. `unwrapNodeOutput` 이 partial(대기 상태) 케이스에서 반환하는 `output: null` 경로가 이제 안전하게 "표시할 데이터 없음" 문구로 귀결된다. falsy-but-valid 값(`0`, `""`, `false`)은 `== null` 이 아니므로 정상적으로 `JsonContent` 로 렌더 — 잘못된 falsy 단축평가(`!data`) 를 쓰지 않아 이 엣지 케이스를 올바르게 처리.

- **[INFO]** 이전 INFO #7/#9/#10/#8 — 모두 반영 확인
  - `useEffect(() => clearTimer, [clearTimer])` 로 unmount 시 pending 타이머 정리(`use-edge-hover-preview.ts`).
  - 훅 반환 객체가 `useMemo(() => ({ preview, show, scheduleHide, keepAlive, dismiss }), [...])` 로 참조 안정화 — 형제 훅(`use-edge-execution-state`) 관례와 정렬.
  - `EdgeDataModal`(`edgeId ?? ""`)·`useEdgeFlowData` 내부 `edgeId ? edges.find(...) : undefined` 가드로 닫힌 모달의 무의미한 스캔을 회피.
  - `connecting-nodes.mdx`(ko) frontmatter `code:` 배열에 신규 파일 3개 추가 확인(`.en.mdx` 는 애초에 frontmatter 자체가 없는 컴패니언 파일이라 해당 없음).

- **[INFO]** spec §4/§5 본문과 코드의 line-level 일치 — ASCII 목업까지 정확히 재현
  - 위치: `spec/3-workflow-editor/2-edge.md` §5 목업(`Data Flow Preview` 제목, `"items": [3 items]` 축약, `Size: 245 bytes` 푸터) vs `dict/en/editor.ts`(`edgeDataPreviewTitle: "Data Flow Preview"`, `edgeDataSize: "Size"`) + `formatBytes(245) === "245 bytes"`(실측 vitest 통과) + `abbreviate()` 의 중첩 배열 `[N items]` 규칙.
  - 상세: §5 표(`| 호버 | ... | 구현됨 |`), §4 hover 행 상태 전환("Planned"→"구현됨"), plan 체크박스(`[ ]`→`[x]`) 모두 실제 구현 상태와 부합한다. `HIDE_DELAY_MS=200`(spec 미규정 구현 세부사항)은 "전체 데이터 보기" 클릭 가능성 확보에 필요한 최소 장치로 기존 scope 리뷰의 판단과 동일하게 결함이 아니다.

- **[INFO]** 잔존 갭(모두 이전 라운드에서 명시적으로 이월 처리됨, 이번 라운드에서 재도입/악화 없음)
  - `summarizeDataForPreview` 의 정확한 경계값(배열 정확히 5개, 객체 필드 정확히 20개) 및 `formatBytes(1024)`/`formatBytes(1024*1024)` 등호 경계는 여전히 테스트되지 않는다(테스트는 초과 케이스만 커버). 기능 코드 자체는 정확해 보이나(로직 검토상 `> MAX_TOP_ARRAY`/`> MAX_TOP_KEYS` 비교라 경계에서 축약 안 함이 맞음) 회귀 가드는 아직 없다.
  - `useEdgeFlowData` 의 "nodeId 최신 결과 찾기" 로직이 `node-settings-panel.tsx`(`InfoTab`)·`use-expression-context.ts` 에 존재하는 유사 로직과 여전히 별개로 남아있음(RESOLUTION 이 "§4-insert/후속" 으로 명시 이월) — 이번 PR 범위 밖이라 결함으로 카운트하지 않음.
  - bytes 계산의 무제한 `JSON.stringify` 상한/디바운스 부재 — RESOLUTION 이 "이월" 명시, 기능 정확성에는 영향 없음(로컬 성능 이슈).

## 확인된 정상 동작(결함 아님)

- `tsc --noEmit` 전체 클린, 신규 vitest 4파일 실행 결과 22 passed(1 skipped), `hardcoded-korean-ratchet.test.ts` 통과(직접 재현).
- `execution-store.ts` 의 `findLatestResultByNodeId` 가 `addNodeResult`/`findNodeResult` 와 동일한 "인덱스 stale 방어(nodeId 재검증)" 패턴을 따라 안전하며, `nodeResults` 배열이 append/in-place 갱신만 되는 것을 직접 확인해 인덱스 무효화 위험 없음을 검증.
- CHANGELOG.md / `plan/in-progress/spec-sync-edge-gaps.md` / `spec/3-workflow-editor/2-edge.md §5` / JSDoc 4곳의 메커니즘 서술(`findLatestResultByNodeId`)이 실제 코드와 grep 기준 100% 일치, 예전 CRITICAL 의 근본 원인이었던 `findNodeResult` 오기재가 어디에도 남아있지 않음.
- `EdgeDataModal` 의 데이터-없음 판정(`== null`)이 falsy-but-valid(0/""/false) 값을 올바르게 구분해 렌더.

## 요약

이전 라운드(`review/code/2026/07/13/15_52_56`)가 지적한 CRITICAL 1건(i18n ratchet 실측 FAIL)과 WARNING 5건(O(n) 재스캔·문서-구현 불일치, 무가드 직렬화, JsonContent 미재사용, 테스트 전무, null 체크 누락)이 `RESOLUTION.md` 의 조치 내역대로 정확히 반영됐음을 코드 diff·grep·실측 테스트 실행(`vitest`, `tsc --noEmit`)으로 재확인했다. 특히 CRITICAL 의 근본 원인이던 i18n 하드코딩은 `dict/{ko,en}/editor.ts` 키 4개로 완전히 이관됐고, CHANGELOG·plan·spec §5·JSDoc 4곳이 실제 구현 메커니즘(`findLatestResultByNodeId`)과 한 글자도 어긋나지 않게 일치한다. 신규 selector 는 스토어의 기존 인덱스 방어 패턴을 그대로 따라 안전하다. 남은 항목(경계값 테스트 부재, 3중 로직 중복 미해소, bytes 계산 무상한)은 모두 이전 라운드에서 의도적으로 "이월"로 명시된 낮은 우선순위 사안이며, 이번 해소 라운드에서 새로 도입되거나 악화된 결함은 없다. spec §4/§5 본문(ASCII 목업·표·구현 상태 서술)과 코드가 line-level 로 일치하며, spec 자체의 결함이나 SPEC-DRIFT 는 발견되지 않았다.

## 위험도

LOW — 병합을 막던 CRITICAL 은 실측으로 해소 확인. 잔존 항목은 전부 사전에 "이월" 로 합의된 저우선순위 개선 여지(경계값 테스트·로직 중복 통합)로, 기능 정확성이나 spec 부합에 영향 없음.
