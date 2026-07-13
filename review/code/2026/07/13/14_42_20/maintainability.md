# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** flowing/completed 상호배타 className 결정이 중첩 삼항(nested ternary)으로 구현
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (`const className = state.flowing ? FLOWING_EDGE_CLASS : state.completed ? COMPLETED_EDGE_CLASS : undefined;`)
  - 상세: 2단 중첩 자체는 즉각적인 가독성 저해가 크지 않지만, `flowing`/`completed` 가 동시에 true 일 수 없다는 불변식에 암묵적으로 의존한다. 코드 자체는 이 불변식을 강제하지 않고 주석·`resolveEdgeExecutionState` 구현에만 의존한다(직전 라운드 리뷰에서도 INFO 로 지적, 이번에도 동일 형태로 남아있음).
  - 제안: 상태 종류가 늘어날 가능성이 낮다면 현행 유지도 무방하나, 확장 시 `{flowing: A, completed: B}` 형태의 조회 테이블이나 짧은 헬퍼로 추출하면 불변식이 코드에 더 명시적으로 드러난다.

- **[INFO]** 마칭 점선 CSS 선언이 두 selector 에 그대로 중복
  - 위치: `codebase/frontend/src/app/globals.css` — 기존 hover 하이라이트 규칙(`[data-edge-focus-active] .react-flow__edge.edge-highlighted:not([class*="error"]) path.react-flow__edge-path { stroke-dasharray: 8 4; animation: edge-flow 0.6s linear infinite; }`)과 신규 `.edge-flowing .react-flow__edge-path { stroke-dasharray: 8 4; animation: edge-flow 0.6s linear infinite; }` 가 완전히 동일한 두 선언을 각각 보유.
  - 상세: `edge-flow` keyframe 자체는 의도적으로 재사용한다고 주석에 명시돼 있어 좋은 판단이나, 값(`8 4`, `0.6s linear infinite`)이 바뀌면 두 곳을 함께 고쳐야 하는 이중 관리 지점이 생긴다. 직전 라운드 리뷰에서 INFO 로 지적됐고 이번 커밋에서도 의도적으로 이월(미조치)된 항목이다.
  - 제안: comma-separated selector 로 묶거나 공용 클래스(예: `.edge-marching-dashes`)로 추출해 단일 소스화. 우선순위는 낮음.

- **[INFO]** 초록색 `#22c55e` 가 CSS 키프레임과 TS 상수(`PORT_TYPE_COLORS.data`)에 이중으로 하드코딩
  - 위치: `codebase/frontend/src/app/globals.css`(`@keyframes edge-complete-flash { 0%, 20% { stroke: #22c55e; } }`), `codebase/frontend/src/lib/utils/edge-utils.ts`(`PORT_TYPE_COLORS.data = "#22c55e"`)
  - 상세: 두 값은 우연히 같은 색이지만 의미가 다르다(데이터 포트색 vs "실행 완료" flash 고정색). 하나만 디자인 변경되면 나머지가 의도치 않게 어긋날 수 있다. 직전 라운드에서도 INFO 로 지적, 범위 밖으로 이월된 항목.
  - 제안: 지금 당장 조치 불요. 향후 리팩터 시 "포트색과 무관한 고정 성공색"임을 주석으로 남기면 오인을 막는다.

- **[INFO]** 실행 상태 className 부여 방식이 자매 훅과 다른 합성 전략(overwrite vs Set 병합)을 사용
  - 위치: `use-edge-execution-state.ts`(`return { ...edge, className, ... }` — 계산된 값으로 직접 덮어씀) vs `use-edge-highlighting.ts`(`edge.className` 을 공백 분리 `Set` 으로 파싱해 `add`/`delete` 로 병합)
  - 상세: 현재는 `workflow-canvas.tsx` 에서 실행 상태 훅이 하이라이팅 훅보다 먼저 적용돼(원본 `edges` 에는 아직 다른 className 이 없음) 문제가 되지 않지만, 같은 폴더의 두 "엣지에 상태 className 을 입히는" 훅이 서로 다른 합성 패턴(직접 대입 vs Set 기반 add/delete)을 쓰고 있어, 향후 세 번째 훅이 추가되거나 합성 순서가 바뀌면 조용히 className 이 유실될 여지가 있다.
  - 제안: 당장 동작에는 문제 없으므로 필수 조치는 아니나, 두 훅 중 하나를 표준으로 정하거나(예: 모든 className 파생 훅이 Set 병합 사용) 상단 주석에 "이 훅은 합성 체인의 첫 단계라 직접 대입이 안전하다"는 전제를 명시하면 향후 순서 변경 시 실수를 예방한다.

- **[INFO]** `edge-utils.ts` 응집도 지속 확장 (기존 지적 이월)
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`
  - 상세: 포트 색상·연결 유효성·드래그 조립·stale pruning 에 이어 이번에 실행 상태 판정(`resolveEdgeExecutionState`, `FLOWING_EDGE_CLASS`, `COMPLETED_EDGE_CLASS`)까지 누적되어 파일이 계속 커지고 있다. 직전 리뷰에서 이미 INFO 로 지적·이월된 항목이며 이번 diff 로 인한 신규 문제는 아니다.
  - 제안: 당장 조치 불요. §4/§5 등 후속 작업 시 파일 분할 여지를 검토.

## 요약

이번 diff 는 직전 ai-review(2026-07-13 14:20)에서 지적된 WARNING 7건(자매 훅과 다른 재렌더 최적화 전략으로 인한 전체 엣지 재생성, 신규 훅 단위 테스트 부재, `custom-edge.tsx`/`workflow-canvas.tsx` 주석-구현 불일치, CSS 클래스 접두사 `wc-` 불일치, 한국어 문서 어휘 오류)을 RESOLUTION.md 서술대로 정확히 해소했다 — `FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS` 가 기존 무접두 컨벤션(`edge-highlighted`, `edge-flow`)과 통일됐고, `useEdgeExecutionState` 가 per-edge bail-out(상태 불변 엣지는 원본 참조 반환)과 `nodes` 참조 대신 정렬된 disabled-id 문자열에 의존하는 안정 키를 도입해 자매 훅(`useEdgeHighlighting`)의 최적화 패턴에 합류했으며, `use-edge-execution-state.test.ts`(5케이스)·`edge-utils.test.ts`(`resolveEdgeExecutionState` 7케이스)로 새 로직이 촘촘히 커버된다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, spec/CHANGELOG/plan/mdx(ko·en) 동반 갱신도 일관되게 이뤄졌다. 남은 항목은 모두 이전 라운드부터 의도적으로 이월된 경미한 INFO(CSS 중복 선언, 색상 값 이중 하드코딩, 중첩 삼항, edge-utils.ts 응집도)이며 신규 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
