# 요구사항(Requirement) Review — 미니맵/토글 버튼 겹침 수정

## 스코프 확인
- 리뷰 대상 커밋: `607bba715` (`fix(editor): 미니맵이 맵 토글 버튼을 가리지 않도록 위로 띄움`).
- `git diff main...HEAD` 상 함께 보이는 `spec/3-workflow-editor/0-canvas.md`, `plan/in-progress/spec-sync-canvas-gaps.md`, `spec/conventions/cross-node-warning-rules.md` 변경은 **선행 커밋 `56879279c`(§11.4 grooming)** 소속이며 이번 fix 커밋(`607bba715`)에는 포함되지 않음 (`git show 607bba715 --stat` 로 확인, payload 4개 파일과 정확히 일치). 즉 이번 변경은 spec 파일을 건드리지 않는다.
- 관련 spec: `spec/3-workflow-editor/0-canvas.md` §7 "미니맵" — `> 구현됨 (canvas-minimap.tsx): @xyflow MiniMap 을 캔버스 우하단에 렌더하고(pannable/zoomable), 토글 버튼으로 표시/숨김한다.` + 5개 bullet(우하단 오버레이/조감도/뷰포트 사각형/드래그 이동/토글). **토글 버튼과 미니맵의 상대적 배치(위/아래)는 spec 본문에 명시돼 있지 않다** — 이번 fix 의 "버튼 코너 고정 + 미니맵이 그 위로 뜸" 설계는 spec 이 침묵하는 영역(gray zone)이라 spec 위반이 아니다.

## 발견사항

- **[INFO]** spec §7 이 토글-미니맵 상대 위치를 규정하지 않아 이번 변경은 spec 저촉이 아니지만, 문서(mdx) 는 "미니맵 위" → "미니맵 아래" 로 갱신됨
  - 위치: `spec/3-workflow-editor/0-canvas.md:492-500`, `codebase/frontend/src/content/docs/03-workflow-editor/canvas-basics.mdx:591`, `canvas-basics.en.mdx:422`
  - 상세: spec 본문은 "토글 버튼으로 표시/숨김"만 요구하고 버튼이 미니맵 위/아래 어디에 위치해야 하는지는 정의하지 않는다. 따라서 이번 fix(버튼을 우하단 코너에 고정하고 미니맵이 그 위로 뜨는 설계)는 spec 위반도 SPEC-DRIFT 도 아니며, 순수 UI 버그 수정 + 이에 맞춘 사용자 매뉴얼(mdx, ko/en 모두) 동기화다. mdx 문서 자체는 `spec/` 폴더가 아니라 `codebase/frontend/src/content/docs/`(제품 매뉴얼) 소속이라 line-level spec fidelity 규약 대상은 아니지만, 구현과 정확히 합치한다(버튼이 항상 `!bottom-2`=8px, 미니맵이 `!bottom-12`=48px → 미니맵이 버튼보다 위).
  - 제안: 없음 (참고용). 필요하면 project-planner 판단 하에 spec §7 에 "토글 버튼은 우하단 코너 고정, 미니맵이 그 위로 플로트" 문구를 선택적으로 보강할 수 있으나 필수는 아니다.

- **[WARNING]** 겹침 방지 보장이 mock 기반 단위 테스트의 상대 수치 계산에만 의존, 실제 xyflow CSS 상호작용은 검증되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx:15-16`(주석 "Both live in a `<Panel>` with the same default margin, so it cancels out"), `__tests__/canvas-minimap.test.tsx:238-256`("floats the minimap above the toggle button" 테스트)
  - 상세: 새 구현은 `!bottom-12`/`!bottom-2`(tailwind `!important`) 로 두 오버레이의 `bottom` 값을 직접 지정해 겹침을 없애는 접근으로, 이전 버그(`mb-[168px]` 마진 기반 리프트가 xyflow 기본 `.react-flow__panel` CSS 와의 specificity/cascade 문제로 실제로는 씹혔을 가능성)의 근본 원인을 정면으로 해결하는 합리적 수정이다. 다만 테스트는 `@xyflow/react` 의 `Panel`/`MiniMap` 을 전부 mock 으로 대체해 컴포넌트가 넘기는 className 문자열의 산술 관계(`48 >= 8+32`)만 검증하며, 실제 라이브러리가 렌더링하는 진짜 DOM/CSS(예: `.react-flow__panel` 공유 기본 margin 이 정말로 Panel 과 MiniMap 양쪽에 동일하게 적용되는지, `!important` 오버라이드가 xyflow 번들 CSS 로드 순서와 무관하게 항상 이기는지)는 어떤 테스트로도 검증되지 않는다. 원래 버그가 "수치상으로는 맞아 보이는 계산"에서 발생했던 점을 감안하면, 동일한 종류의 실환경 회귀를 이 테스트 스위트가 다시 잡아낼 보장은 없다.
  - 제안: 필수는 아니나, 실제 렌더링(mock 없이 `@xyflow/react` 그대로 사용하거나 e2e/시각 회귀 스냅샷)으로 두 오버레이의 실측 `getBoundingClientRect()` 겹침 여부를 한 번은 확인하는 것을 권장. 최소한 devbox/실제 브라우저에서 수동 확인 여부를 PR 설명이나 plan 에 남기면 위험을 낮출 수 있다.

- **[INFO]** "keeps the toggle pinned..." 회귀 테스트는 항상 통과하는 정적 문자열 비교
  - 위치: `__tests__/canvas-minimap.test.tsx:260-267`
  - 상세: 버튼을 감싼 `Panel` 의 `className` 이 `visible` 상태와 무관하게 고정 문자열(`"!bottom-2 !right-2"`)이 되도록 구현이 바뀌었으므로, 이 테스트는 사실상 "className 이 정적 문자열이다"만 확인한다. 그 자체로 틀린 테스트는 아니고(과거 버그처럼 `visible` 에 따라 값이 달라지는 재도입을 막는 회귀 가드로서 의미 있음), 다만 강도는 낮다.
  - 제안: 없음(참고).

## 기타 점검 결과 (문제 없음)
- **기능 완전성**: 토글 클릭 시 표시/숨김 로직(`useState`, `onClick`), `aria-pressed`, `aria-label` 모두 기존 동작 유지. `pannable`/`zoomable` prop 유지로 spec §7 의 "미니맵 내 클릭/드래그로 뷰포트 이동" 요구 충족 지속.
- **엣지 케이스**: `twSpacingPx` 헬퍼는 매칭 실패 시 명시적 `Error` throw(무음 NaN 비교 방지), regex 는 `bottom-N`/`h-N` 을 다른 접두사(`right-`, `w-`)와 혼동하지 않도록 앵커링(`^`/`\s` 경계) 처리됨. `!` important 접두사 유무 모두 처리.
- **TODO/FIXME**: 4개 파일 전체에서 미검출.
- **의도-구현 일치**: JSDoc 주석("토글은 우하단 코너 고정, 미니맵이 그 위로 플로트")과 실제 배치 값(`!bottom-2` vs `!bottom-12`, 버튼 `h-8`=32px)이 정확히 일치. 8px 갭 계산(48-(8+32)=8) 검증됨.
- **에러 시나리오**: UI 순수 표시 로직으로 별도 에러 경로 없음 — 해당 없음.
- **데이터 유효성**: 외부 입력 없음(로컬 state 뿐) — 해당 없음.
- **비즈니스 로직**: "미니맵이 버튼을 가리면 안 된다"는 회귀 규칙이 `minimapBottomPx >= toggleBottomPx + toggleHeightPx` 로 정확히 인코딩됨.
- **반환값**: 컴포넌트/헬퍼 함수 모든 경로에서 적절한 값 반환(헬퍼는 실패 시 명시적 throw).
- **spec fidelity**: 위 INFO 참고 — spec §7 은 이번 변경 영역(버튼-미니맵 상대 위치)에 대해 침묵하므로 불일치 없음. 코드 3파일(diff)에 spec 필드/에러코드/기본값 같은 것은 없음(순수 CSS 포지셔닝).

## 요약
`canvas-minimap.tsx` 의 버그 수정은 "버튼을 우하단 코너에 고정하고 미니맵이 그 위로 8px 갭을 두고 뜨도록" 설계를 바꿔, 이전에 `mb-[168px]` 마진 기반으로 버튼을 들어올리던 방식(추정상 xyflow 기본 Panel CSS 와의 cascade 충돌로 실제 겹침이 발생했을 가능성이 있는 접근)의 근본 원인을 정면으로 제거한다. 새 단위 테스트는 렌더된 className 의 상대적 산술 관계를 통해 회귀를 잡아내도록 잘 설계됐고, ko/en 매뉴얼 문구("위"→"아래")도 구현과 정확히 합치한다. spec(`0-canvas.md` §7)은 이 배치를 규정하지 않는 gray zone 이라 spec 위반은 없다. 유일한 아쉬운 점은 mock 기반 단위 테스트만으로는 실제 `@xyflow/react` 렌더링에서의 진짜 겹침 여부(원래 버그의 근본 성격)를 끝까지 보증하지 못한다는 점으로, CRITICAL 은 아니지만 e2e/시각 확인으로 보완할 가치가 있다.

## 위험도
LOW
