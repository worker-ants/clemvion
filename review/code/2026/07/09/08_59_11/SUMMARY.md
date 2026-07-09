# Code Review 통합 보고서

## 전체 위험도
**LOW** — 미니맵/토글 버튼 겹침 CSS 버그 수정 + 회귀 테스트 + 문서 동기화의 순수 프론트엔드 UI 변경. 보안·부작용 위험은 없으며, 유일한 유의사항은 회귀 테스트가 `@xyflow/react` mock 경계 안에서만 겹침을 검증한다는 구조적 한계(WARNING 1건)와 매직넘버 관계 비강제 등 유지보수성 INFO. `scope`, `documentation` 리뷰어는 STATUS=success 로 보고됐으나 출력 파일이 디스크에 생성되지 않아 내용 확인 불가(재시도 필요).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 미니맵-토글 버튼 겹침 방지 보장이 mock 기반 단위 테스트의 산술 관계 검증(`minimapBottomPx >= toggleBottomPx + toggleHeightPx`)에만 의존. 이 계산이 실제 겹침을 막는다는 전제는 "MiniMap 과 Panel 이 `@xyflow/react` 내부에서 동일 기본 margin 을 공유한다"는 가정에 있는데, 해당 라이브러리가 테스트에서 완전히 mock 되어 이 가정 자체는 어떤 테스트로도 검증되지 않음(실측: `@xyflow/react@12.10.2` 기준 현재는 가정이 유효하나, 라이브러리 내부 구현이 바뀌면 원래 버그와 같은 종류의 시각적 겹침이 재발해도 이 테스트는 계속 그린) | `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` (주석 "Both live in a `<Panel>` with the same default margin, so it cancels out"), `__tests__/canvas-minimap.test.tsx` | 필수는 아니나, 실제 렌더링(mock 없이 `@xyflow/react` 그대로 사용) 또는 e2e/시각 회귀로 두 오버레이의 실측 `getBoundingClientRect()` 겹침 여부를 한 번 확인 권장. (testing 리뷰어는 프로젝트 e2e 정책상 픽셀 단위 시각 회귀가 범위 밖이라 액션 불필요로 판단 — `@xyflow/react` 업그레이드 시 재확인 대상으로만 인지) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | 요구사항 | spec §7(`0-canvas.md`)이 토글 버튼과 미니맵의 상대적 배치(위/아래)를 규정하지 않는 gray zone이라 이번 fix는 spec 위반이 아님. mdx 매뉴얼(ko/en)은 "위"→"아래"로 구현과 정확히 합치하도록 갱신됨 | `spec/3-workflow-editor/0-canvas.md:492-500`, `canvas-basics.mdx`, `canvas-basics.en.mdx` | 없음(참고). 필요시 project-planner 판단 하에 spec §7에 버튼 코너 고정 배치를 선택적으로 보강 가능 |
| 3 | 요구사항/테스트 | "keeps the toggle pinned" 회귀 테스트는 `visible` 상태와 무관하게 고정 문자열(`"!bottom-2 !right-2"`)만 비교하는 정적 검증 — 과거 조건부 lift 로직 재도입을 막는 가드로서는 의미 있으나 강도는 낮음 | `__tests__/canvas-minimap.test.tsx` | 없음(참고) |
| 4 | 부작용 | MiniMap/Panel 렌더 순서가 뒤바뀌어(MiniMap 먼저 → Panel/버튼 나중) 버튼이 항상 위로 오도록 수정됨. 두 엘리먼트 모두 explicit z-index 없이 절대 위치 오버레이라 여전히 "소스 순서" 기반 painter's algorithm 에 암묵적으로 의존 — 현재는 오프셋으로 겹치지 않아 결과에 영향 없으나, 추후 순서 변경이나 세 번째 오버레이 추가 시 동일 계열 회귀 재발 가능 | `codebase/frontend/src/components/editor/canvas/canvas-minimap.tsx` (JSX 순서 변경 부분) | 현재 diff 범위에서 차단 사유 아님. 추가된 회귀 테스트가 관계를 검증하므로 충분한 안전망 |
| 5 | 유지보수성 | `MiniMap` bottom offset(`!bottom-12`=48px)이 `Button` `h-8`(32px)+코너 오프셋(8px)+간격(8px)의 합으로 산출되지만 이 관계가 코드로 강제되지 않고 두 JSX 리터럴에 암묵적으로 분산 인코딩됨. 버튼 크기 변경 시 함께 갱신 안 하면 겹침 회귀 재발 가능(단, 신규 테스트가 값 어긋남을 즉시 감지) | `canvas-minimap.tsx`(MiniMap className), `canvas-minimap.tsx`(Button `h-8 w-8`) | 값이 셋 이상으로 늘거나 재사용되면 공통 상수(`TOGGLE_SIZE_PX`, `CORNER_GAP_PX`)로 추출 고려. 현재 규모에서는 필수 아님 |
| 6 | 유지보수성 | 이번 diff에서 MiniMap/Panel JSX 렌더 순서가 바뀌었는데, 이 순서가 스태킹 관계에 왜 중요한지 컴포넌트 주석에 명시돼 있지 않음(JSDoc은 오프셋 수치 근거만 설명) | `canvas-minimap.tsx` (JSDoc) | 순서를 되돌리면 안 되는 이유를 한 줄 주석으로 남기면 추후 실수 방지에 도움 |
| 7 | 유지보수성 | 신규 테스트 헬퍼 `twSpacingPx`가 정규식으로 Tailwind 클래스 문자열을 파싱해 픽셀 값을 역산하는 "영리한" 접근 — 스타일이 `bottom-[52px]` 같은 임의값 문법으로 바뀌면 매치 실패(단, 명시적 `throw`로 fail-fast, 무음 실패 아님) | `__tests__/canvas-minimap.test.tsx` | 별도 조치 불필요. 향후 임의값 문법 전환 시 헬퍼 동반 갱신 필요성만 인지 |
| 8 | 테스트 | 새 회귀 테스트는 세로축(`bottom`)만 산술 검증하고 수평축(`right-2`)은 두 요소 하드코딩 값이 같다는 전제로 검증 대상에서 제외 — 대각선으로 스치는 겹침 케이스는 커버 안 됨 | `__tests__/canvas-minimap.test.tsx` | 현재 버그(세로 겹침)엔 정확히 대응하므로 우선순위 낮음. `data-position="bottom-right"` 어서션이 최소 정렬 보증 역할 |
| 9 | 유지보수성 | ko/en MDX 문서에서 동일 문구("above"→"below", "위"→"아래")를 각 파일에서 개별 수정 — 구조적 중복이나 기존 i18n 콘텐츠 페어 컨벤션과 일치 | `canvas-basics.en.mdx`, `canvas-basics.mdx` | 없음(기존 패턴 준수 확인) |
| 10 | 부작용 | `CanvasMinimap` 공개 시그니처(무인자 호출)·유일 호출부(`workflow-canvas.tsx`) 불변 확인 | `canvas-minimap.tsx` export, `workflow-canvas.tsx` | 없음(확인 목적) |
| 11 | 부작용 | `@xyflow/react` mock 정교화는 해당 테스트 파일 모듈 그래프에 격리되어 다른 테스트/프로덕션 번들에 영향 없음 | `__tests__/canvas-minimap.test.tsx` | 없음(확인 목적) |
| 12 | 부작용 | 문서(mdx) 텍스트만 변경, 런타임 영향 없음(실제 UI 배치 변경과 일치하는 정정) | `canvas-basics.en.mdx`, `canvas-basics.mdx` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 사용자 입력·인증·시크릿·암호화 무관한 순수 UI 레이아웃 변경, 공격 표면 없음 |
| requirement | LOW | spec §7 이 버튼-미니맵 상대 배치를 규정하지 않는 gray zone이라 위반 아님; mock 테스트 한계(WARNING) |
| scope | 재시도→확보 | 최초 STATUS=success 였으나 output_file 부재(FS-write flake) → main 이 직접 재실행해 확보 (별도 scope.md) |
| side_effect | NONE | 공개 시그니처/호출부/전역 상태/네트워크 영향 없음; stacking order 암묵 의존 잔존(INFO) |
| maintainability | LOW | 오프셋 값 관계 비강제(매직넘버 분산), 렌더 순서 의도 미문서화 |
| testing | LOW | mock 경계 밖 `@xyflow/react` 내부 가정 미검증; 수평축 미검증(둘 다 e2e 정책상 비차단) |
| documentation | 재시도→확보 | 최초 STATUS=success 였으나 output_file 부재(FS-write flake) → main 이 직접 재실행해 확보 (별도 documentation.md) |

## 발견 없는 에이전트

- security (발견사항 명시적으로 "없음")

## 권장 조치사항

1. (선택) 겹침 방지 회귀 테스트를 mock 없는 실제 렌더링 또는 e2e/시각 회귀로 1회 보완해, `@xyflow/react` 의 Panel 공유 margin 가정이 실제로 유효한지 확인 (WARNING #1). 프로젝트 e2e 정책(픽셀 단위 시각 회귀는 범위 밖)과 상충하므로 강제 아님 — `@xyflow/react` 업그레이드 시점에 재확인하는 것으로도 충분.
2. (선택) 버튼 크기와 미니맵 오프셋 간의 산술 관계를 공통 상수로 추출하거나, 최소한 렌더 순서가 스태킹에 미치는 영향을 주석으로 명시 (INFO #5, #6).
3. `scope`, `documentation` 리뷰어 결과가 STATUS=success 로 보고됐음에도 output_file 이 디스크에 없는 것은 알려진 workflow FS-write flakiness 로 추정됨 — 호출자(main) 는 해당 두 reviewer 를 직접 재실행해 누락분을 확보한 뒤 위험도 최종 판정에 반영 권장. → **RESOLUTION.md 에서 처리**.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: `performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync` (7명)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (documentation 은 router 가 mdx 변경 근거로 일반 선택)
