# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[CRITICAL]** 신규 UI 컴포넌트가 프로젝트 i18n 컨벤션을 우회하고 하드코딩 문자열(그것도 영/한 혼용)을 도입 — 실제로 기존 ratchet 테스트를 깨뜨림
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx` (`EdgeDataPreviewTooltip`/`EdgeDataModal`)
  - 상세: 같은 디렉터리의 다른 캔버스 컴포넌트(`canvas-minimap.tsx`, `container-delete-dialog.tsx`, `canvas-empty-state.tsx`, `custom-node.tsx`, `zoom-controls.tsx`, 그리고 이 파일을 사용하는 `workflow-canvas.tsx` 자신)는 전부 `useT()`/`t("...")` 로 문자열을 다국어화한다. 그런데 신규 `edge-data-preview.tsx` 는 `useT()` 를 전혀 쓰지 않고 `"Data Flow Preview"`/`"Size:"`(영문 하드코딩) 옆에 `"전체 데이터 보기"`/`"표시할 데이터가 없어요."`(한국어 하드코딩)를 섞어 넣었다 — 같은 툴팁 안에서 언어가 뒤섞이는 결과. 실행해 확인한 결과, 저장소에 이미 있는 회귀 가드 `src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 가 이 신규 파일 때문에 실제로 fail 한다:
    ```
    ❯ 기존 파일이 baseline 이상으로 한국어 라인을 늘리지 않아요
      - components/editor/canvas/edge-data-preview.tsx: 0 → 2 (+2)
    ❯ baseline 에 없는 신규 파일이 한국어 라인을 도입하지 않아요
      - components/editor/canvas/edge-data-preview.tsx: +2 라인
    ```
    (`cd codebase/frontend && npx vitest run src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts` 로 재현됨, 2 tests failed.) 이는 추측이 아니라 현재 커밋 상태에서 실패하는 테스트다.
  - 제안: 두 문자열을 `dict/{ko,en}/editor.ts`(또는 해당 섹션)에 키로 등록하고 `useT()` 로 교체한다. `workflow-canvas.tsx` 가 이미 `useT`/`useLocale` 을 사용 중이므로 `EdgeDataPreviewTooltip`/`EdgeDataModal` 에 `t` 를 prop 또는 자체 `useT()` 호출로 주입하면 된다. "Data Flow Preview"/"Size:" 도 같은 이유로 함께 키로 옮기는 것이 일관적이다.

- **[INFO]** `formatBytes` 의 단위 임계값이 리터럴 반복
  - 위치: `codebase/frontend/src/lib/utils/edge-data-preview.ts:2222-2224` (`formatBytes`)
  - 상세: `MAX_STRING`/`MAX_TOP_ARRAY`/`MAX_TOP_KEYS` 는 이미 이름 있는 상수로 잘 뽑혀 있으나, `formatBytes` 내부의 `1024`/`1024 * 1024` 는 리터럴로 두 번 반복된다. 관례적인 값이라 이해에 지장은 없지만, 파일 상단 다른 상수들과 스타일이 다르다.
  - 제안: `const BYTES_PER_KB = 1024;` 정도로 뽑아 상단 상수 블록과 통일하면 스타일 일관성이 좋아진다(선택적, 낮은 우선순위).

- **[INFO]** 신규 코드 파일이 spec 프런트매터의 `code:` 목록에는 반영됐으나 사용자용 mdx 문서(`connecting-nodes.mdx`/`.en.mdx`)의 `code:` 목록에는 반영되지 않음
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx` frontmatter `code:` (line 1874 부근, 신규 `edge-data-preview.tsx`/`use-edge-hover-preview.ts`/`lib/utils/edge-data-preview.ts` 미등재) — `spec/3-workflow-editor/2-edge.md` 쪽은 이미 정상 갱신됨.
  - 상세: 본문 텍스트는 정확히 갱신됐고 기능 자체와는 무관하지만, 이 저장소는 spec/doc 의 `code:` 메타데이터를 실제 소스와 동기화하는 관례를 갖고 있어(다른 리뷰어의 spec-doc 동기화 스코프일 수 있음) 참고용으로 남긴다.
  - 제안: mdx 두 파일의 `code:` 배열에 3개 신규 파일 추가.

## 요약

핵심 로직(`summarizeDataForPreview`/`formatBytes`, `useEdgeHoverPreview`, `useEdgeFlowData`)은 순수 함수·단일 책임 훅으로 잘 분리되어 있고, 이름 있는 상수(`MAX_STRING`/`MAX_TOP_ARRAY`/`MAX_TOP_KEYS`/`HIDE_DELAY_MS`)를 사용하며, JSDoc 주석이 의도(§ 섹션 참조 포함)를 명확히 설명하고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮아 전반적으로 가독성이 좋다. 다만 신규 UI 컴포넌트(`edge-data-preview.tsx`)가 같은 디렉터리의 다른 모든 컴포넌트가 따르는 `useT()` i18n 관례를 어기고 영/한 혼용 하드코딩 문자열을 도입했으며, 이는 실측으로 확인한 대로 저장소의 기존 회귀 가드(`hardcoded-korean-ratchet.test.ts`)를 실제로 깨뜨리는 결함이라 병합 전 수정이 필요하다.

## 위험도
CRITICAL
