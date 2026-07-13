# 아키텍처(Architecture) Review

대상: `spec/3-workflow-editor/2-edge.md` §1.3(입력 포트 역방향 연결 확인 + 기존 엣지 재연결/분리) — 4회차 fresh 검토. 직전 3라운드(`12_40_48` HIGH→`13_06_50` MEDIUM→`13_27_36` LOW)를 거쳐 수렴한 최종 상태(commit `77850f5f9`)를 독립적으로 재검증했다.

## 발견사항

- **[INFO, 긍정]** `useEdgeReconnect` 훅의 의존성 역전(DIP) 유지
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`
  - 상세: 훅은 `reconnect: (oldEdge, newConnection) => void` / `removeEdge: (edgeId) => void` 두 콜백을 파라미터로 주입받고 `useEditorStore` 를 직접 import 하지 않는다. detach 판정도 성공 플래그가 아니라 `onReconnectEnd` 의 `connectionState.toNode` (드롭 위치)로만 결정해 판정 로직이 store 구현·React Flow 내부 상태 흐름 어느 쪽에도 결합되지 않는다. `workflow-canvas.tsx`(프레젠테이션) → `use-edge-reconnect.ts`(오케스트레이션 훅) → `editor-store.ts`(비즈니스 규칙/상태) → `edge-utils.ts`(순수 헬퍼)로 이어지는 4계층 경계가 이번 기능에서도 그대로 유지된다.
  - 제안: 없음(모범 사례로 유지 권장).

- **[INFO, 긍정]** `evaluateConnection` 판별 유니온 추출로 `onConnect`/`onReconnect` 중복 해소
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:610-640`(`evaluateConnection`/`buildEdgeDataForConnection`), 호출부 `onConnect`(746-769)/`onReconnect`(771-806)
  - 상세: 자기연결/중복/컨테이너 충돌 판정과 "sourceNode 조회 → sourceNodeType 추출 → buildEdgeData" 파생 로직이 `{ ok: true } | { ok: false; message?: string }` 판별 유니온을 반환하는 공용 함수로 통합됐다. 문자열 sentinel(`null`/`""`/문자열 3중 오버로드)이 아니라 타입으로 강제되는 형태라 `if (!result.ok)` 단축이 자기연결 케이스를 놓칠 수 없다. `onReconnect` 는 재연결 중인 엣지 자신을 제외한 `edges` 목록만 인자로 다르게 넘겨 재사용하므로, 신규 검증 규칙이 추가돼도 한 곳만 고치면 된다(OCP). 1~3회차에서 지적된 검증 로직 중복·drift 위험은 코드 레벨에서 해소된 상태를 직접 확인했다.
  - 제안: 없음. 거부 사유가 더 늘면 `message` 대신 `reason` 판별 필드 승격을 고려할 수 있으나 현재는 과설계다.

- **[INFO]** 예약 입력 포트 집합(`emit`)이 FE/BE 경계에서 공유되지 않는 독립 리터럴
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `RESERVED_INPUT_HANDLE_IDS = new Set(["emit"])` (주석상 SoT: backend `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS`)
  - 상세: 컨테이너 loopback 포트라는 동일 도메인 개념이 FE/BE 양쪽에 독립 문자열로 존재한다. 그래프 사이클 경고 규칙(`@workflow/graph-warning-rules`)처럼 공유 패키지로 컴파일타임 동기화된 선례가 있는 반면, 이 집합은 주석만으로 SoT 를 표시해 한쪽이 바뀌면 반대쪽이 침묵 실패(orphan 노드 재발)할 수 있는 모듈 경계 취약점이 latent 하게 남는다. 원소가 1개뿐이라 즉각적 위험은 낮다.
  - 제안: 지금은 조치 불요. 예약 포트가 늘거나 다른 위치에서도 참조되면 공유 상수/패키지 승격 검토(plan 에도 이미 이월 기록됨).

- **[INFO]** `workflow-canvas.tsx` God Component(993줄) — 기존 부채, 이번 diff 로 악화되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
  - 상세: 컴포넌트는 컨텍스트 메뉴 3종·노드 검색 팝업 상태·단일 노드 실행·드래그앤드롭·줌 단축키에 더해 이번엔 재연결 배선까지 계속 한 파일에서 책임진다. 다만 이번 변경은 재연결 판정 글루를 `use-edge-reconnect.ts` 순수 훅으로 새로 추출해 컴포넌트에 로직을 더 얹지 않았다(오히려 완화 방향). §1.2 팝업 오케스트레이션(`onConnectEnd`→`handleAddNodeFromSearch`→`onConnect`)은 여전히 인라인으로 남아 있으나 `plan/in-progress/spec-sync-edge-gaps.md` §1.2 이월 항목 (a)/(d)로 이미 근거와 함께 추적 중이라 이번 diff 의 신규 결함은 아니다.
  - 제안: 별도 조치 불요. `use-edge-reconnect.ts` 패턴(순수 훅 + 콜백 주입)을 §1.2 팝업 글루 정리 시에도 동일 적용 권장(plan 이미 명시).

- **[INFO]** 구조적 엣지(컨테이너 `body`/`emit`)와 일반 데이터 엣지가 도메인 모델상 1급으로 구분되지 않음
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `<ReactFlow onReconnect=.../>` 배선, 엣지 데이터 스키마 전반
  - 상세: 컨테이너 소속을 결정하는 `body`/`emit` 핸들 연결과 순수 데이터 흐름 엣지가 재연결/detach 가능 여부에서 동일하게 취급된다 — "구조적 vs 데이터" 구분이 핸들 id 명명 규칙에만 암묵적으로 존재하고 엣지 객체의 1급 필드(예: `edge.data.role`)로 승격돼 있지 않다. 이번 diff 가 원인은 아니며(기존에도 Delete 로 지우면 동일 결과), reconnect 표면이 넓어지며 이 암묵적 구분에 기대는 지점이 하나 늘었다. 저장/실행 시점 서버측 `CONTAINER_MISSING_EMIT` 검증이 최종 안전망으로 남아 즉각적 데이터 무결성 위험은 아니다.
  - 제안: 지금 조치 불요. 구조적 배선 보호가 필요해지면 `structural: true` 같은 필드로 명명 규칙을 데이터 필드로 승격 검토(3회차 architecture 리뷰가 이미 동일하게 이월 권고).

## 요약

이번 §1.3 최종 상태는 프레젠테이션(`workflow-canvas.tsx`) → 오케스트레이션 훅(`use-edge-reconnect.ts`) → 비즈니스 규칙/상태(`editor-store.ts`) → 순수 헬퍼(`edge-utils.ts`) 4계층 경계를 일관되게 유지하며, `useEdgeReconnect` 훅은 콜백 주입(DIP)으로 store 구현에 의존하지 않아 독립 단위 테스트가 가능하다. 1회차에서 지적된 CRITICAL(자기연결 드롭 시 오삭제)은 성공 플래그가 아닌 드롭 위치(`connectionState.toNode`) 기준 판정으로 재설계돼 해소됐고, `onConnect`/`onReconnect` 간 검증·데이터파생 중복은 판별 유니온을 반환하는 `evaluateConnection`/`buildEdgeDataForConnection` 공용 헬퍼로 통합돼 향후 검증 규칙 추가 시 단일 지점만 수정하면 되는 구조로 개선됐다. 순환 의존성, 레이어 위반, 신규 안티패턴은 발견되지 않았다. 남은 관찰 사항(FE/BE 예약 포트 리터럴 비공유, `workflow-canvas.tsx` 의 누적된 책임 팽창, 구조적 엣지의 도메인 모델 미승격)은 모두 이전 라운드부터 관찰돼 온 낮은 위험도의 latent 항목이며 plan 문서에 근거와 함께 이미 이월돼 있어 이번 라운드의 신규 차단 사유가 아니다. 3라운드에 걸친 ai-review 수렴(HIGH→MEDIUM→LOW)이 아키텍처 관점에서도 실제 코드 레벨로 확인된다.

## 위험도
LOW
