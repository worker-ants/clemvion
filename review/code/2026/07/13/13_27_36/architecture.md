# 아키텍처(Architecture) Review

## 발견사항

- **[INFO, 긍정]** `useEdgeReconnect` 훅의 의존성 역전(DIP) 설계
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
  - 상세: 훅이 `reconnect`/`removeEdge` 콜백을 파라미터로 주입받고 `useEditorStore` 를 직접 import 하지 않는다. 오케스트레이션(제스처 판정) 계층이 구체적인 상태관리 구현(zustand store)에 의존하지 않고 함수 시그니처(추상)에만 의존해, `renderHook` + `vi.fn()` mock 만으로 detach 판정(자기연결/무효 핸들 드롭 시 원상유지, pane 드롭 시 삭제)을 순수 단위 테스트할 수 있다. `workflow-canvas.tsx`(프레젠테이션) → `use-edge-reconnect.ts`(오케스트레이션/훅) → `editor-store.ts`(비즈니스 규칙·상태) → `edge-utils.ts`(순수 헬퍼)로 이어지는 4계층 책임 분리가 이번 변경에서도 일관되게 유지된다.
  - 제안: 없음(모범 사례로 참고).

- **[INFO, 긍정]** `evaluateConnection` 판별 유니온 추출 — OCP/재사용성 개선
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` L610-630(`evaluateConnection`), L633-640(`buildEdgeDataForConnection`), 호출부 `onConnect`(L746-769)/`onReconnect`(L771-806)
  - 상세: 자기연결/중복/컨테이너 충돌 판정과 "sourceNode 조회→sourceNodeType 추출→buildEdgeData" 파생 로직이 `onConnect`/`onReconnect` 양쪽에서 공용 함수로 재사용된다. 반환 타입이 `{ ok: true } | { ok: false; message?: string }` 판별 유니온이라 호출부가 `if (!result.ok)` 로만 처리 가능 — 문자열 sentinel(`null`/`""`/문자열 3중 오버로드) 방식보다 타입 시스템이 truthy 단축 실수를 컴파일 타임에 차단한다. 재연결 시 "자기 자신을 제외한 edges" 를 호출자가 넘기는 구조라 향후 제3의 연결 생성 경로(예: API/어시스턴트 기반 엣지 생성)가 추가돼도 동일 검증 규칙을 재사용하기만 하면 되어 OCP 를 만족한다. 신규 검증 규칙 추가 시 한 곳만 수정하면 되므로 이전 라운드에서 지적된 duplication/drift 위험은 해소된 상태다.
  - 제안: 없음. 향후 거부 사유가 늘어나면 `message` 대신 `reason: "self" | "duplicate" | "container-conflict"` 같은 판별 필드를 추가해 호출부가 사유별로 분기하기 쉽게 하는 정도를 고려할 수 있으나 현재 필요성은 낮다.

- **[INFO]** 예약 입력 포트 집합(`emit`)이 FE/BE 경계를 넘는 암묵적 계약 — 공유 없이 독립 리터럴
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `RESERVED_INPUT_HANDLE_IDS = new Set(["emit"])` (주석상 SoT: backend `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS`)
  - 상세: 컨테이너 loopback 포트라는 동일 도메인 개념이 프런트엔드와 백엔드 양쪽에 독립적인 문자열 리터럴로 존재한다. 사이클 경고 규칙(`@workflow/graph-warning-rules`)처럼 FE/BE 공유 패키지로 동기화된 선례가 이미 있는 반면, 이 예약 포트 집합은 그런 컴파일타임 계약 없이 주석만으로 SoT 를 표시한다 — 한쪽이 바뀌어도 반대쪽은 침묵 실패(orphan 노드 재발)할 수 있는 모듈 경계 취약점이다. 원소가 1개뿐이라 즉각적 위험은 낮고, 과잉 추상화(공유 패키지 신설)를 지금 하는 것도 비용 대비 실익이 낮아 보인다.
  - 제안: 지금은 조치 불요. 예약 포트가 2개 이상으로 늘거나 다른 위치(예: 노드 정의 스키마)에서도 같은 개념을 참조하게 되면 공유 상수/패키지 승격을 검토.

- **[INFO]** `workflow-canvas.tsx` God Component(993줄) — 기존 부채, 이번 diff 로 악화되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
  - 상세: 컴포넌트는 컨텍스트 메뉴 3종·노드 검색 팝업 상태·단일 노드 실행·드래그앤드롭·줌 단축키·이제 재연결 배선까지 한 파일에서 계속 책임진다. 다만 이번 변경은 재연결 글루(`onReconnect`/`onReconnectEnd` 판정)를 `use-edge-reconnect.ts` 순수 훅으로 새로 추출해 컴포넌트에 로직을 더 얹지 않았다는 점에서 오히려 "훅으로 분리" 라는 좋은 선례를 하나 더 추가했다(§1.2 팝업 오케스트레이션은 여전히 인라인으로 남아 있으나 `plan/in-progress/spec-sync-edge-gaps.md` §1.2 이월 항목 (a)/(d) 로 이미 근거와 함께 추적 중이라 이번 diff 의 신규 결함은 아니다).
  - 제안: 별도 조치 불요. `use-edge-reconnect.ts` 패턴(순수 훅 + 콜백 주입)을 §1.2 팝업 오케스트레이션 정리 시에도 동일하게 적용 권장.

- **[INFO]** 구조적 엣지(컨테이너 `body`/`emit`)와 일반 데이터 엣지가 도메인 모델상 구분되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `<ReactFlow onReconnect=.../>` 배선, 엣지 데이터 스키마 전반
  - 상세: 컨테이너 소속을 결정하는 `body`/`emit` 핸들 연결과, 순수 데이터 흐름을 나타내는 일반 연결이 런타임 동작(재연결·drag-to-detach 가능 여부)에서 동일하게 취급된다 — "구조적 vs 데이터" 구분이 핸들 id 명명 규칙에만 암묵적으로 존재하고 엣지 객체 자체의 1급 필드(예: `edge.data.role`)로 승격돼 있지 않다. 이번 diff 가 도입 원인은 아니며(기존에도 Delete 로 지우면 동일 결과), reconnect 표면이 넓어지며 이 암묵적 구분에 기대는 지점이 하나 늘었다. 저장/실행 시점의 서버측 `CONTAINER_MISSING_EMIT` 검증이 최종 안전망으로 남아 즉각적 데이터 무결성 위험은 아니다.
  - 제안: 지금 조치 불요. 구조적 배선 보호가 필요해지면 엣지 데이터에 `structural: true` 같은 필드를 추가해 `reconnectable`/detach 대상에서 명시적으로 제외하는 방향을 검토(도메인 개념을 명명 규칙에서 데이터 필드로 승격).

## 요약

이번 변경은 워크플로 편집기 엣지 재연결/분리(§1.3)를 기존 4계층 구조(프레젠테이션 `workflow-canvas.tsx` → 오케스트레이션 훅 `use-edge-reconnect.ts` → 비즈니스 규칙/상태 `editor-store.ts` → 순수 헬퍼 `edge-utils.ts`)에 정확히 맞춰 확장했다. `useEdgeReconnect` 훅은 콜백 주입(DIP)으로 store 구현에 의존하지 않아 독립적으로 단위 테스트 가능하고, `onConnect`/`onReconnect` 간 검증·데이터파생 중복은 판별 유니온을 반환하는 `evaluateConnection`/`buildEdgeDataForConnection` 공용 헬퍼로 해소되어 향후 검증 규칙 추가 시 단일 지점만 수정하면 되는 구조다. 순환 의존성이나 레이어 위반, 새로운 안티패턴은 발견되지 않았다. 남은 관찰 사항은 모두 낮은 위험도의 기존/latent 이슈다 — FE(`RESERVED_INPUT_HANDLE_IDS`)/BE(`CONTAINER_LOOPBACK_PORTS`) 간 공유 계약 부재, `workflow-canvas.tsx` 의 지속적 책임 팽창(플랜에 이미 이월 기록됨, 이번 diff 는 오히려 완화 방향), 구조적 엣지와 데이터 엣지의 도메인 모델상 미구분이며 셋 다 즉시 조치가 필요한 수준은 아니다.

## 위험도
LOW
