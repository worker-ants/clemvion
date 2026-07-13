# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 신규 CSS 클래스 접두사 `wc-` 가 동일 파일의 기존 네이밍 컨벤션과 불일치
  - 위치: `codebase/frontend/src/app/globals.css:129-146` (`.wc-edge-flowing`, `.wc-edge-completed`, `@keyframes wc-edge-complete-flash`), `codebase/frontend/src/lib/utils/edge-utils.ts` (`FLOWING_EDGE_CLASS = "wc-edge-flowing"`, `COMPLETED_EDGE_CLASS = "wc-edge-completed"`)
  - 상세: 같은 `globals.css` 안의 인접 엣지 관련 클래스들(`edge-highlighted`, `node-edge-glow`, keyframe `edge-flow`)은 접두사 없이 명명돼 있는데, 이번 변경만 `wc-` 접두사를 새로 도입했다. 저장소 전체를 검색해도 이 접두사는 이 변경분 3곳(css)+2곳(ts)에서만 등장해, 기존 컨벤션 확장인지 국소적 신규 규칙인지 불명확하다. (참고: `WEBCHAT_`/webchat- 접두사는 별도 채널 위젯 코드 전용으로 이미 쓰이고 있어 혼동 소지도 있다.)
  - 제안: 접두사 없이 `edge-flowing`/`edge-completed`(다른 엣지 클래스와 통일) 또는 접두사 도입 배경(예: React Flow 내장 클래스와의 네임스페이스 충돌 방지)을 주석으로 남겨 다음 작성자가 규칙을 추정하지 않게 한다.

- **[INFO]** 마칭 점선 스타일(`stroke-dasharray: 8 4` + `animation: edge-flow 0.6s linear infinite`)이 두 selector 에 그대로 중복
  - 위치: `codebase/frontend/src/app/globals.css:97-101`(기존 hover 하이라이트 애니메이션 블록) 및 신규 `:129-134`(`.wc-edge-flowing .react-flow__edge-path`)
  - 상세: keyframe 자체는 의도적으로 재사용한다고 주석에 명시돼 있으나(좋은 판단), 두 selector 가 완전히 동일한 두 선언(`stroke-dasharray`, `animation`)을 각각 따로 갖고 있어 값이 바뀌면 두 곳을 함께 고쳐야 한다.
  - 제안: 두 selector 를 comma-separated 로 묶거나 공용 클래스(`.edge-marching-dashes`)로 추출해 단일 소스로 유지.

- **[WARNING]** `useEdgeExecutionState` 가 동일 폴더의 자매 훅(`useEdgeHighlighting`)이 확립한 "영향받지 않은 엣지는 참조 재사용" 패턴을 따르지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:523-551`
  - 상세: `useEdgeHighlighting.enhancedEdges` 는 배열 전체 bail-out 외에도 `edges.map` 내부에서 상태가 실제로 바뀌지 않은 개별 엣지는 `return edge`(동일 참조)로 반환해 React Flow diff 를 최소화한다(파일 상단 주석에 "Performance: only highlighted edges get new objects"로 명시된 설계 원칙). 반면 신규 훅은 배열 전체 bail(모두 비활성·미실행·상태없음일 때만) 이후에는 `edges.map` 안에서 **모든** 엣지를 무조건 `{...edge, className, data: {...}}` 로 새 객체화한다 — 실행 중 노드가 1개만 있어도 나머지 수백 개 엣지까지 매 렌더 새 객체가 된다. 같은 파일 그룹에서 상반된 최적화 전략이 공존하면 이후 작업자가 어느 패턴이 "정석"인지 헷갈리기 쉽다.
  - 제안: `resolveEdgeExecutionState` 결과가 모두 `false`인 엣지는 원본 엣지 객체를 그대로 반환하도록 `useEdgeHighlighting` 과 동일한 per-edge bail 을 적용.

- **[INFO]** 중첩 삼항(nested ternary)으로 className 결정
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:537-541`
  ```ts
  const className = state.flowing
    ? FLOWING_EDGE_CLASS
    : state.completed
      ? COMPLETED_EDGE_CLASS
      : undefined;
  ```
  - 상세: 2단 중첩이라 즉각적인 가독성 저해는 크지 않으나, `flowing`/`completed` 가 상호배타라는 불변식(둘 다 true 인 경우 없음)에 암묵적으로 의존한다. 주석에 상호배타 근거는 있지만 코드 자체는 이를 강제하지 않는다.
  - 제안: 간단한 `if/else if` 또는 `state.flowing ? A : state.completed ? B : undefined` 대신 조회 테이블(`{flowing: A, completed: B}[key]`)이나 헬퍼 함수로 추출해 향후 상태 종류가 늘어날 때 확장 부담을 줄인다. (선택 사항, 현재 범위에선 문제 없음)

- **[INFO]** 초록색 hex `#22c55e` 가 CSS 리터럴과 TS 상수(`PORT_TYPE_COLORS.data`)에 이중으로 존재
  - 위치: `codebase/frontend/src/app/globals.css:135-137`(`wc-edge-complete-flash` keyframe), `codebase/frontend/src/lib/utils/edge-utils.ts` `PORT_TYPE_COLORS.data = "#22c55e"`
  - 상세: 두 값이 우연히 같은 그린이지만 의미는 다르다(포트 색 vs "실행 완료" flash 색). 현재는 문제 없지만, 두 값 중 하나만 디자인이 바뀌면(예: data 포트색 변경) flash 색이 의도치 않게 달라 보이거나, 반대로 flash 색만 바꾸려다 포트색까지 착각해서 건드릴 여지가 있다.
  - 제안: 변경 범위 밖이라 지금 고칠 필요는 없으나, 두 값이 독립적인 의미임을 주석에 한 줄 남겨두면(이미 "포트색과 무관한 고정 성공색" 정도로) 다음 리팩터 때 오인을 막는다.

## 요약

이번 변경은 스코프가 좁고(신규 훅 1개, 순수 함수 1개, CSS 추가, 기존 파일에 대한 최소 배선), 기존 §3.3 하이라이팅 훅과 동일한 아키텍처(순수 판정 함수 + `useMemo` 기반 훅 + 원본 참조 보존 bail)를 의식적으로 재사용하려 한 흔적이 뚜렷하며, 각 상태 전이(`inactive`/`flowing`/`completed`)의 의도와 우선순위가 코드 주석·테스트(`resolveEdgeExecutionState` 7케이스)에 잘 문서화돼 있다. 다만 (1) 새 CSS 클래스 접두사 `wc-` 가 같은 파일 안의 기존 무접두사 컨벤션과 어긋나고, (2) 새 훅이 자매 훅이 확립한 "미변경 엣지는 참조 재사용" 최적화 패턴을 따르지 않아 동일 관심사 코드 사이에 스타일 분기가 생겼다는 점은 다음 작업자에게 혼란을 줄 수 있어 보완이 필요하다. 나머지(CSS 중복, 중첩 삼항, 색상 값 중복)는 경미한 참고 사항이다.

## 위험도

LOW
