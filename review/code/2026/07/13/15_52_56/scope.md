# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** hover 숨김 지연(200ms)은 spec 문면에 없는 구현 세부사항
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-hover-preview.ts` `HIDE_DELAY_MS`
  - 상세: spec §5 는 "클릭 시 전체 데이터 모달 표시" 만 요구하고 지연 숨김 수치를 규정하지 않는다. 다만 이 지연은 "전체 데이터 보기" 버튼 클릭을 가능하게 하는 데 기능적으로 필요한 최소 장치이며(즉시 숨기면 클릭 자체가 불가능), 주석(`workflow-canvas.tsx`, `use-edge-hover-preview.ts`)에 그 근거가 명시돼 있어 over-engineering 이 아니라 요구사항 이행에 필요한 구현 디테일로 판단된다.
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 툴팁/모달 UI 문자열이 영·한 혼용("Data Flow Preview" 영문 제목 + "전체 데이터 보기"/"표시할 데이터가 없어요." 한글) 이고 기존 에디터의 `useT`/i18n 체계를 거치지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/edge-data-preview.tsx`
  - 상세: `workflow-canvas.tsx` 는 이미 `useT`/`useLocale` 를 사용 중이나 신규 컴포넌트는 하드코딩 문자열을 쓴다. CHANGELOG·spec §5 ASCII 목업 자체가 "Data Flow Preview" 영문 제목·"전체 데이터 보기" 버튼을 그대로 명시하고 있어 구현이 명시된 요구사항을 그대로 따른 것이며, 새 기능·범위 확장은 아니다. i18n 정합성은 scope 밖의 별개 관점(기능/일관성 리뷰) 사안으로 판단해 이 리뷰에서는 정보성으로만 기록한다.
  - 제안: 조치 불필요(scope 관점). 필요시 별도 i18n 리뷰에서 다룰 사안.

## 요약
변경분은 `plan/in-progress/spec-sync-edge-gaps.md` 의 미완료 항목 "§4 / §5 엣지 호버 데이터 미리보기 툴팁(Data Flow Preview) + 축약 표시 + 전체 데이터 모달" 하나에 정확히 대응한다. 신규 파일(`edge-data-preview.tsx`, `use-edge-hover-preview.ts`, `lib/utils/edge-data-preview.ts`, 테스트)과 `workflow-canvas.tsx` 의 최소 배선 변경(새 훅 import, `onEdgeMouseEnter`/`onEdgeMouseLeave` 에 툴팁 트리거 추가, 툴팁/모달 렌더 블록 추가)만 있고, 기존 로직·다른 콜백·무관한 코드 영역에 대한 수정은 없다. `CHANGELOG.md` 는 최상단에 신규 항목 1건만 추가했고 기존 항목은 그대로다. `spec/3-workflow-editor/2-edge.md` 변경은 정확히 §4 hover 행과 §5 섹션(구현 상태 서술 갱신)에 국한되며 `code:` frontmatter 에 신규 파일 2개를 추가한 것도 이 저장소의 SoT 관례(구현 파일 목록 동기화)와 일치한다. `plan/in-progress/spec-sync-edge-gaps.md` 는 해당 체크박스 1줄만 `[ ]`→`[x]` 로 갱신했다. 두 `connecting-nodes` mdx(ko/en) 문서에 기능 설명 한 단락씩만 추가된 것도 리포지토리 관례(사용자 가이드 동반 갱신)에 부합한다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 노이즈, 미사용 임포트, 설정 변경은 발견되지 않았다.

## 위험도
NONE
