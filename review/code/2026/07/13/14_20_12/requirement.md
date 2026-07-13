### 발견사항

- **[WARNING]** 신규 `useEdgeExecutionState` 훅 자체에 대한 renderHook 단위 테스트 부재
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (신규 파일, 대응 테스트 파일 없음)
  - 상세: 같은 디렉터리의 형제 훅들(`use-edge-highlighting.ts` → `__tests__/use-edge-highlighting.test.ts`, `use-edge-reconnect.ts` → `__tests__/use-edge-reconnect.test.ts`)은 모두 renderHook 기반으로 훅 자체(스토어 연동·fast-path 참조 안정성·상태 변화 시 재계산)를 검증하는 반면, 이번 PR 은 순수 함수 `resolveEdgeExecutionState` 만 `edge-utils.test.ts` 에 7케이스로 커버하고 훅의 글루 로직은 테스트가 전혀 없다. 훅에는 (1) `nodes` 배열에서 `disabledNodeIds` 를 구성하는 로직, (2) `nodeStatuses` Map 에서 `nodeStatusById` 를 구성하는 로직, (3) "실행/비활성 컨텍스트가 전혀 없으면 원본 `edges` 참조를 그대로 반환"하는 fast-path 최적화, (4) `className`/`data.edgeInactive` 조합 로직 등 순수 함수 밖의 자체 로직이 존재하며 이 부분은 검증되지 않는다.
  - 제안: `use-edge-highlighting.test.ts` 와 동일한 패턴(`renderHook` + `useExecutionStore.setState`/`act`)으로 `use-edge-execution-state.test.ts` 를 추가해 fast-path 참조 동일성, `disabledNodeIds`/`nodeStatusById` 파생, `className`/`edgeInactive` 최종 조합을 전수 검증할 것을 권장.

- **[WARNING]** 사용자 문서(한국어) 문구 "비활성(끈) 노드" — 어휘/문법 오류로 추정
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx:82`
  - 상세: 신규 추가된 문장 `"**비활성(끈) 노드**에 연결된 연결선은 항상 **반투명한 점선**으로 흐리게 보여요."` 에서 괄호 안 "끈" 은 프로젝트 전반에서 쓰이는 "비활성화(된)"/"꺼진" 표현과 다른 낯선 단어다. 영문판(`connecting-nodes.en.mdx:1535`)의 동일 문장은 `"disabled (turned-off) node"` 로, 괄호 부연이 "turned-off" 상태를 가리키는데 이 프로젝트의 기존 국문 표현(`editing-nodes.mdx`: "비활성화된 노드는 캔버스에서 흐리게 표시", "노드 비활성화" 등)과 대조하면 "끈" 이 "꺼진"(state adjective)의 오탈자/오역일 가능성이 높다. "끈"(끄다의 관형사형)은 통상 목적어를 동반하는 타동사적 표현("불을 끈")이라 "끈 노드" 단독으로는 어색하다.
  - 제안: "비활성(꺼진) 노드" 또는 괄호를 생략하고 기존 관용 표현과 통일해 "비활성화된 노드"로 수정 권장(문서 콘텐츠 수정이며 spec 본문은 아님 — 직접 손대도 무방한 층).

- **[INFO]** `useEdgeExecutionState` 는 실행/비활성 컨텍스트가 하나라도 있으면 매 재계산마다 **모든** 엣지 객체를 새로 생성 — 형제 훅과의 참조 안정성 정책 불일치
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts:36-43` (`edges.map(...)` 전체 재생성)
  - 상세: `useEdgeHighlighting` 은 상태가 바뀐 엣지만 새 객체로 만들고 나머지는 원본 참조를 그대로 반환해(`if (wasHighlighted && edge.className?.includes(...)) return edge;`) React Flow diff 를 최소화하는 반면, 신규 훅은 fast-path(컨텍스트 전무) 밖에서는 각 엣지의 실제 상태 변화 여부와 무관하게 항상 새 객체(`{...edge, className, data: {...}}`)를 만든다. 워크플로우 하나의 노드 상태가 바뀔 때마다(웹소켓 이벤트 매번) 그래프의 모든 엣지가 리렌더 대상이 된다 — 기능적 오류는 아니고 일반적인 워크플로우 규모에서는 체감 영향이 낮지만, 같은 파일 내 확립된 "불필요한 재렌더 방지" 패턴과는 결이 다르다.
  - 제안: 기능상 문제는 아니므로 필수 수정 대상은 아님. 후속 성능 튜닝 시 참고.

- **[INFO]** `.wc-edge-flowing` 애니메이션이 error 포트 엣지를 제외하지 않음 — 기존 하이라이트 규칙과의 차이(spec 침묵 영역)
  - 위치: `codebase/frontend/src/app/globals.css:65-68` (`.wc-edge-flowing .react-flow__edge-path`) vs 기존 `[data-edge-focus-active] .react-flow__edge.edge-highlighted:not([class*="error"]) path.react-flow__edge-path` (line ~205)
  - 상세: 기존 hover/선택 하이라이트의 흐름 애니메이션은 error 포트 엣지를 명시적으로 제외(`:not([class*="error"])`)하지만, 이번에 추가된 실행 중 데이터-흐름 마칭 점선(`wc-edge-flowing`)은 그런 제외가 없다. HTTP Request → error 포트 → 에러 핸들러 노드처럼 소스가 정상 완료(`completed`)로 종료됐지만 실제로는 에러 포트를 통해 나간 경우, 해당 엣지도 "flowing" 스타일을 받는다. spec §3.2 본문·Rationale 모두 이 예외를 요구하지 않으므로 spec 위반은 아니며, 의도적 설계 차이일 수도, 누락일 수도 있어 판단이 모호하다(회색지대) — CRITICAL/SPEC-DRIFT 로 격상하지 않고 참고 사항으로만 기록.
  - 제안: 의도된 동작인지 확인 필요 시 별도 결정. 현재로선 조치 불필요.

### 검증 수행 내역
- `codebase/frontend/src/lib/utils/__tests__/edge-utils.test.ts` 전체(66 케이스, 신규 `resolveEdgeExecutionState` 7케이스 포함) 실제 실행 → 전부 통과.
- `tsc --noEmit -p tsconfig.json` (frontend) 실행 → 0 진단(diagnostics 없음).
- spec 본문(`spec/3-workflow-editor/2-edge.md` §3.2 표 + "현재 구현" 노트)과 구현 line-level 대조: 함수 시그니처(`resolveEdgeExecutionState(edge, ctx)`), 필드명(`inactive`/`flowing`/`completed`, `edge.data.edgeInactive`), className 상수(`wc-edge-flowing`/`wc-edge-completed`), 우선순위(inactive > flowing/completed), 색상(`#22c55e`) 모두 일치. `plan/in-progress/spec-sync-edge-gaps.md` 체크박스·CHANGELOG 항목도 실제 구현 내용과 일치.
- 상호배타성(`flowing`/`completed` 는 target 상태값이 단일 문자열이라 구조적으로 동시에 true 가 될 수 없음), `useExecutionStore.startExecution`/`startHistoryView` 가 `nodeStatuses` 를 새 실행마다 초기화함(stale completed 상태가 다음 실행에 새어들지 않음)을 소스에서 확인.
- `useEdgeExecutionState` → `useEdgeHighlighting` 합성 순서(className Set 병합)가 `use-edge-highlighting.ts` 실제 구현과 부합함을 확인 — 실행 상태 className 을 지우지 않고 보존.

### 요약
§3.2 "엣지 실행 상태 스타일" 구현은 spec 본문(표·"현재 구현" 노트)과 함수 시그니처·필드명·클래스명·우선순위까지 line-level 로 일치하며, 판정 순수 함수는 7개 단위 테스트로 상호배타·우선순위·기본값 케이스를 모두 커버하고 실제로 통과한다. CHANGELOG·plan 체크박스·spec 갱신도 실제 diff 내용과 정확히 대응한다. TODO/FIXME 류의 미완성 표식은 없고, 반환값·에러 시나리오도 모든 분기에서 정의된 boolean 조합만 반환해 undefined 누락이 없다. 다만 (1) 신규 훅 자체의 렌더-훅 단위 테스트가 형제 훅들과 달리 빠져 있고, (2) 새로 추가된 국문 사용자 문서 문구("비활성(끈) 노드")에 어휘 오류로 보이는 부분이 있어 두 건을 WARNING 으로 남긴다. 그 외 두 건은 기능 결함이 아닌 참고성 INFO(성능 패턴 차이, error 포트 예외 처리 불일치)다.

### 위험도
LOW
