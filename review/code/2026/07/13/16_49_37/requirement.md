# 요구사항(Requirement) Review — 엣지 데이터 미리보기 툴팁 + 전체 데이터 모달 (2-edge.md §4/§5, 3라운드 누적 fix 반영본)

본 리뷰는 이미 2회 ai-review(`15_52_56` CRITICAL 1+WARNING 5 → 해소, `16_20_51` WARNING 6 → 해소)를 거친 changeset 을 diff·현재 워크트리 코드·실측 테스트 실행 기준으로 재검증한다. `spec/3-workflow-editor/2-edge.md` §4/§5 본문을 직접 Read 해 line-level 대조했다.

## 발견사항

- **[INFO]** spec §5 ASCII 목업의 축약 표기가 따옴표 없는 `[3 items]` 인데, 실제 렌더 결과는 따옴표로 감싼 문자열 `"[3 items]"` 이다 — 2회 이전 라운드 requirement 리뷰(`16_20_51/requirement.md` 등)가 "ASCII 목업까지 정확히 재현" 이라 결론 냈으나 이 세부는 놓친 것으로 보인다.
  - 위치: `spec/3-workflow-editor/2-edge.md` §5 목업(`"items": [3 items]`, 따옴표 없음) vs `codebase/frontend/src/lib/utils/edge-data-preview.ts` `abbreviate()`(중첩 배열을 `` `[${value.length} items]` `` **문자열**로 반환) → `JSON.stringify(abbreviate(value), null, 2)` 결과 `"items": "[3 items]"`(문자열이라 JSON 직렬화 시 따옴표가 붙음). 신규 테스트 `edge-data-preview.test.tsx`(§4/§5) 가 실제로 `expect(tip.textContent).toContain('"items": "[3 items]"')` 로 이 따옴표 포함 형태를 명시적으로 단언하고 있어, 이것이 우연한 렌더링 결과가 아니라 의도된 구현임을 확인했다.
  - 상세: 기능적으로는 문제가 없다 — 축약 규칙(배열 길이 요약)은 정확히 구현됐고, 전체 미리보기 문자열이 항상 유효한 JSON 이 되도록(순수 문자열 조립이 아니라 `JSON.stringify` 경로를 그대로 씀) 설계된 트레이드오프로 보인다. 다만 spec 의 시각적 계약(목업)과 코드가 한 글자 단위로는 어긋나 있어, "line-level 일치" 기준을 엄격히 적용하면 사소한 불일치다. 어느 쪽이 틀렸다고 단정하기 애매한 회색지대(코드가 "유효한 JSON 유지"를 택한 것도 합리적이고, 목업이 단순화된 예시였을 수도 있음)라 SPEC-DRIFT 로 단정하지 않는다.
  - 제안: 우선순위 낮음(병합 차단 아님). (a) spec 목업을 실제 출력(따옴표 포함)에 맞게 정정하거나, (b) 목업이 사용자에게 보여줄 "이상적" 표시를 의도한 것이라면 `abbreviate()` 결과를 문자열이 아닌 별도 마커로 처리해 `JSON.stringify` 후 따옴표를 벗기는 후처리를 추가. 어느 쪽이든 `project-planner`/`developer` 재량이며 이 reviewer 는 spec 을 직접 수정하지 않는다.

## 확인된 정상 동작 (직접 재검증)

- **CRITICAL 해소(i18n)** — `edge-data-preview.tsx` 는 하드코딩 문자열 없이 전부 `useT()` + `dict/{ko,en}/editor.ts`(`edgeDataPreviewTitle`/`edgeDataSize`/`edgeViewFullData`/`edgeNoData`)로 localize 됨. 실측: `npx vitest run src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 통과, `hardcoded-korean-baseline.json` 에 이 파일 항목 없음(=한국어 라인 0, 정상).
- **문서-구현 일치 회복** — `execution-store.ts` 신규 selector `findLatestResultByNodeId(nodeId)` 가 `lastIndexByNodeId` O(1) 인덱스 조회 + stale-index 재확인(`row?.nodeId === nodeId`)으로 구현되어 있고, `useEdgeFlowData` 가 이를 소비한다. JSDoc/CHANGELOG/spec §5/plan 4곳 모두 이 이름으로 일관되게 서술 — 이전 라운드가 지적한 "`findNodeResult` 문서 서술 vs 실제 수동 스캔" 불일치는 실제로 사라졌다(grep 확인, `findNodeResult` 오기재 잔존 없음).
- **테스트 커버리지** — 직접 실행 결과 관련 5개 테스트 파일 **92 passed | 1 skipped**(경계값: 배열 정확히 5/6개, 객체 필드 정확히 20/21개, `formatBytes` 1023/1024/1024²-1/1024² 등호 경계, 순환참조 no-throw/bytes=0, store stale-index/Loop 최신결과 등 모두 포함). `tsc --noEmit` 전체 클린.
- **에러 시나리오** — `summarizeDataForPreview` 는 순환 참조 등 직렬화 실패를 이중 try/catch(바이트 계산·미리보기 생성 각각)로 흡수해 예외를 던지지 않고 안전한 폴백(`bytes=0`, `String(value)`)을 반환한다. 실측 테스트로 확인됨.
- **null/undefined 구분** — `EdgeDataModal` 은 `data == null`(loose)로 `null`/`undefined` 모두 "표시할 데이터가 없어요" 문구로 귀결시키되 falsy-but-valid(`0`/`""`/`false`)는 정상적으로 `JsonContent` 로 렌더한다 — `!data` 같은 단축평가 오용 없음. `EdgeDataPreviewTooltip` 은 `data === undefined || summary.isEmpty` 로 툴팁 자체를 렌더하지 않아 "실행 데이터 없으면 렌더 안 함" 규칙과 일치.
- **모달 전체 데이터 무손실** — `JsonContent`(`run-results/renderers/presentation-renderers.tsx`)는 자체적인 축약/캡 없이 `JSON.stringify(data, null, 2)` 를 그대로 렌더해 "축약 없는 전체 데이터 모달" 요구사항을 정확히 만족.
- **실행별 데이터 격리** — `startExecution`/`startHistoryView`/`resetSession` 등이 `nodeResults`와 `lastIndexByNodeId`를 함께 초기화함을 확인, 이전 실행의 stale 데이터가 다음 실행 hover 에 새어나올 위험 없음.
- **반환값** — `useEdgeFlowData`/`summarizeDataForPreview`/`formatBytes`/`findLatestResultByNodeId` 모든 경로에서 명시적 값(또는 `undefined`)을 반환하며 암묵적 `undefined` 누락 경로 없음.
- **spec §4/§5 line-level 일치** — §4 표의 "호버" 행("구현됨 (`onEdgeMouseEnter` → `setHoveredEdge` + §5 데이터 미리보기 툴팁)")과 §5 "현재 구현" 문단(`edge-data-preview.tsx`/`use-edge-hover-preview.ts`/selector/90ms·200ms 지연/sweep 방어/모달 독립 생명주기)이 실제 코드와 함수명·상수명(`SHOW_DELAY_MS`/`HIDE_DELAY_MS`)까지 정확히 일치. 직전 라운드가 지적했던 "클릭 시 전체 데이터 모달 표시" 문구가 §4 "클릭=엣지 선택"과 상충하던 모호함도 "툴팁의 '전체 데이터 보기' 버튼 클릭 시 …(§4 와 별개)" 로 명확히 정정됨.
- **TODO/FIXME/HACK/XXX** — 신규·수정 파일(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`, `execution-store.ts` 변경분) 전수 grep 결과 미완성 표시 없음(`execution-store.ts` 의 기존 `@todo`는 이 PR 과 무관한 사전 존재 항목).
- **의도치 않은 스코프 확장 없음** — DRY 미이관(`node-settings-panel.tsx` `InfoTab`), byte 계산 무상한, 툴팁 뷰포트 clamp 미비는 모두 성능/유지보수성 관점 사안이고 spec 이 요구하지 않는 세부라 요구사항 미충족으로 보지 않는다. plan 비고에 근거·후속 task(`task_edb57ca2`)가 명시돼 있어 scope 관리도 적절하다.

## 요약

이 changeset 은 `spec/3-workflow-editor/2-edge.md` §4(호버 행)·§5(엣지 데이터 미리보기) 의 "미구현 · Planned" 요구사항을 정확히 구현한다 — 실행 완료 후 엣지 hover 시 source 노드의 최근 실행 출력을 축약해 보여주는 툴팁, "전체 데이터 보기" 클릭 시 축약 없는 전체 JSON 모달, sweep 방어(90ms 진입 지연)와 클릭 가능성 확보(200ms 이탈 유예)가 spec 서술·CHANGELOG·plan 체크박스와 함수/상수 이름 단위로 일치한다. 2차례의 선행 ai-review 가 지적한 CRITICAL(i18n 하드코딩)과 WARNING 다수(`findNodeResult` 문서-구현 불일치, JsonContent 미재사용, 테스트 전무, null 체크 누락, 훅 참조 불안정)를 직접 실행(vitest 92 passed, tsc 클린, ratchet 통과)으로 재확인해 모두 해소됐음을 검증했다. 이번 라운드에서 새로 포착한 것은 spec ASCII 목업(따옴표 없는 `[3 items]`)과 실제 렌더 결과(따옴표 있는 `"[3 items]"`) 사이의 사소한 문자 단위 불일치 하나뿐이며, 기능·비즈니스 로직에는 영향이 없는 INFO 수준이다. DRY 미이관·바이트 계산 무상한 등 이미 문서화된 잔여 항목은 이번 PR 스코프 밖으로 적절히 이월되어 있어 요구사항 충족을 저해하지 않는다.

## 위험도

LOW — 병합을 막는 CRITICAL/WARNING 없음. 유일한 신규 발견(spec 목업 따옴표 불일치)은 INFO 수준의 문서 정합성 참고 사항.
