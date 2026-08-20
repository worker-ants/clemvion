STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard (16_51_19)

## 컨텍스트

이 changeset(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커 가드)은
이미 같은 브랜치에서 6라운드의 `/ai-review` + 5라운드의 `--impl-prep/--impl-done` consistency
검토를 거쳤다(`review/code/2026/08/20/{14_08_45,14_44_08,15_10_25,15_32_34,15_59_17,16_25_35}`).
직전 라운드(`16_25_35`)가 잡은 WARNING(재귀 깊이 상한 부재·plan 라운드 카운트)은 커밋
`6f1d4d41d`("라운드6 처분")로 이미 반영돼 있고, 현재 `HEAD` 는 그 커밋과 동일하다 — 이번
라운드는 그 최종 상태를 독립적으로 재검토한 결과다.

핵심 로직 파일을 직접 열어 확인했다:
`codebase/frontend/src/lib/utils/masked-markers.ts`(신규, 111줄),
`codebase/frontend/src/components/executions/rerun-modal.tsx`,
`codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 의 `jsonError` `useMemo`,
`codebase/backend/src/modules/executions/executions.service.ts` 의 `toResponseExecution`/
`toExecutionDto`, 그리고 신규·확장된 테스트 3파일.

## 발견사항

- **[INFO]** `touchedMaskedKeys` 라는 이름이 실제 저장 내용보다 좁다 (기존 라운드에서 이미 인지·defer)
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:238`(선언), `:308-313`(`setParam` 갱신)
  - 상세: `setParam` 은 마스킹 여부와 무관하게 사용자가 편집한 **모든** 키를 이 집합에 추가한다(`prev.has(key) ? prev : new Set(prev).add(key)` 에 분기가 없다). 실제로는 "touched keys 전체" 집합이고, `blockedByMaskedInput`(라인 368-375) 계산에서 `maskedKeys` 와의 교집합만 의미가 있다. 이 판정은 `14_44_08` 라운드 maintainability 리뷰가 이미 지적했고, `RESOLUTION.md` 가 "최종 판정이 `maskedKeys` 교집합만 보므로 이름이 오해를 낳지 않는다"는 근거로 명시적으로 defer 했다(`15_10_25` 라운드도 재확인 후 재지적하지 않음). 독립적으로 다시 읽어봐도 그 판단은 여전히 유효하다 — 새 결함은 아니지만, 이름이 계속 남아 있는 한 다음 편집자가 이 집합을 다른 용도로 재사용할 때 "이미 마스킹 필터링이 돼 있다"고 오독할 여지는 그대로다.
  - 제안: (선택, 유지 결정 존중) `touchedKeys` 로 개명하거나, 선언부 주석에 "모든 편집 키를 담고 `maskedKeys` 와의 교집합만 의미가 있다"를 한 줄 명시.

- **[INFO]** `blockedByMaskedInput` 판정 표가 코드 안에서 유일한 근거 문서가 되어, 넷째 조건이 추가될 때 이 표를 잊으면 회귀가 말없이 재발할 수 있다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:344-375` (`blockedByMaskedInput` JSDoc 표 + 술어)
  - 상세: 3라운드에 걸쳐 조건이 하나씩 늘었고(터치 여부 → 마커 부재 → 구조 필드 파싱 성공), 각 행이 "그 조건이 없던 시절 실제로 뚫린 경로"를 `RESOLUTION.md` 회차 번호로 남겨 잘 추적된다. 다만 이 근거가 JSDoc 표 하나에만 있고 술어 자체(`374-375`행)에는 조건 이름 외에 표를 가리키는 짧은 포인터가 없어, 넷째 조건을 급하게 추가하는 편집자가 표 갱신을 건너뛰기 쉬운 구조는 그대로 남아 있다. 실질 위험은 낮다 — 코드-주석 인접성이 이미 최선에 가깝고, 이 구조 자체가 과거 결함을 막기 위해 의도적으로 촘촘해진 결과다.
  - 제안: (선택) 술어 바로 위 한 줄 주석에 "넷째 조건 추가 시 위 표도 같은 편집에서 갱신" 을 명시하면 그 습관을 코드 옆에 한 번 더 못박을 수 있다. 조치 불요에 가깝다.

## 확인했으나 재지적하지 않는 것

- `masked-markers.ts` 의 `hasMaskedMarkerLeaf`/`scanForMarker` — 깊이 상한(`MAX_MARKER_SCAN_DEPTH = 10`)이 backend `MAX_REDACT_DEPTH` 미러임을 JSDoc 이 명시하고, 값 검사를 깊이 검사보다 먼저 두는 순서(off-by-one 방지)도 주석과 코드가 일치한다(`16_25_35` WARNING 2 가 잡아 고친 결과, 재확인). 함수는 짧고 단일 책임이며 순환 복잡도가 낮다(분기 3개).
- `editor-toolbar.tsx` 의 `jsonError` `useMemo` — 파싱과 마커 검사를 한 `try` 블록에 두는 이유(재귀 탐색이 못 따라가는 깊이를 `JSON.parse` 는 통과시킨다)가 주석에 명확하고, 함수 자체는 분기 2개로 짧다. 이 diff 는 기존의 큰 `EditorToolbar` 컴포넌트(900줄+)에 로직 몇 줄만 추가했을 뿐이라, 컴포넌트 전체 길이는 이 PR 이 만든 문제가 아니다.
- `executions.service.ts` 의 `toResponseExecution`/`toExecutionDto` — `MASKED_INPUT_DATA_REASON` 앵커 상수가 전수 삭제됐고(코드베이스 grep 0건, 테스트 파일 제외 실측 확인), 마스킹 표면 목록이 `toResponseExecution` JSDoc 표 한 곳으로 정본화돼 있다(§ "읽기 표면 목록 — 이 주석이 정본이다"). 세 곳(목록/상세-체인-stop/노드 레벨)의 인라인 주석은 전부 그 표를 가리키기만 해 SoT 분산 없이 일관적이다.
- 신규·확장 테스트 3파일(`rerun-modal.test.tsx` +292줄, `editor-toolbar-run-input.test.tsx` +92줄, `masked-markers.test.ts` 신규 107줄) — 각 `it` 가 서로 다른 회귀 경로(캐너리)를 겨누고, 각 캐너리가 어느 라운드에서 어떤 결함을 막는지 회차 번호로 추적돼 있다. `rerun-modal.test.tsx` 의 신규 테스트들은 기존 `renderModal`/`seedDefinitions` 헬퍼를 재사용해 새 중복을 만들지 않는다.
- `dynamic-form-ui.tsx` 에서 `masked-markers.ts` 로의 상수·함수 이관 — 순환 의존(모달·툴바가 무관한 폼 컴포넌트를 import) 해소가 실질적인 구조 개선이고, 이관 후 남은 파일 쪽 주석은 일반 블록 코멘트(`/* */`)로 격하돼 JSDoc 앵커 잔재가 없다.

## 요약

이 changeset 은 이미 6라운드의 코드 리뷰와 5라운드의 일관성 검토를 거치며 유지보수성 관점의 실질 결함(연속 JSDoc 블록 분리, describe 소제목 방치, 재귀 깊이 상한 부재 등)이 전부 해소된 상태다. 이번 독립 재검토에서 핵심 로직 파일(`masked-markers.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx`, `executions.service.ts`)과 신규 테스트를 직접 열어 확인한 결과 새로운 CRITICAL/WARNING 은 없다. 함수들은 짧고 단일 책임이며 중첩 깊이·순환 복잡도가 낮고, 판정 로직의 "왜 이 조건이 필요한가"가 과거 회귀 사례와 함께 코드 옆에 상세히 남아 있어 다음 편집자가 조건을 실수로 줄이기 어렵게 돼 있다. 유일하게 남는 항목은 이전 라운드가 이미 인지하고 명시적으로 defer 한 `touchedMaskedKeys` 이름 정밀도 하나이며, 재확인 결과 그 판단은 여전히 타당하다.

## 위험도

LOW
