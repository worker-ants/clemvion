# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** `onConnect`/`onReconnect` 간 유효성 검증 오케스트레이션 중복
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect`(자기연결 early-return → `isDuplicateConnection` + toast → `detectContainerConflict` + toast → `pushUndo`) vs 신규 `onReconnect`(동일 3단계, 중복검사 시 `oldEdge.id` 제외 필터만 다름)
  - 상세: 실제 판정 함수(`isSelfConnection`/`isDuplicateConnection`/`detectContainerConflict`)는 이미 모듈 공용으로 재사용되고 있으나, 그 판정을 감싼 "체크→toast→return" 오케스트레이션 시퀀스 자체는 두 액션에 거의 그대로 복붙되어 있다. 향후 검증 순서·메시지·정책이 바뀌면 두 곳을 동시에 고쳐야 하고, 이미 plan 문서(§1.2 이월 항목 (c))가 예견했듯 제3의 엣지 생성 경로(예: assistant/API 기반 엣지 생성)가 추가되면 동일 3단계가 또 복제될 위험이 있다.
  - 제안: `validateConnectionOrToast(nodes, edges, connection, { excludeEdgeId? })` 형태의 공용 가드 함수로 추출해 `onConnect`/`onReconnect` 양쪽에서 호출. `reconnectEdge`/`addEdge` 로 실제 반영하는 부분만 호출부에 남긴다.

- **[INFO]** `workflow-canvas.tsx` 책임 팽창 — 이번 PR 은 부분 완화, 잔여는 의도적 이월
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`
  - 상세: 이번 변경은 재연결 글루(`onReconnectStart`/`onReconnect`/`onReconnectEnd` 판정)를 `use-edge-reconnect.ts` 훅으로 분리해낸 점은 좋은 선례다(순수 콜백 조합 + 의존성 주입으로 `renderHook` 단위 테스트 가능). 다만 §1.2 의 팝업 오케스트레이션(`onConnectEnd`→`handleAddNodeFromSearch`→`onConnect`)은 여전히 컴포넌트 내부에 인라인으로 남아 있고, 컴포넌트는 컨텍스트 메뉴 3종·팝업 상태·단일 노드 실행·드래그앤드롭·줌 단축키·재연결 배선까지 계속 한 파일에서 책임진다. 이는 `plan/in-progress/spec-sync-edge-gaps.md` 가 §1.2 ai-review 이월 (a)/(d) 항목으로 이미 명시적으로 추적·이월한 결정이라 이번 diff 의 새로운 결함은 아니다.
  - 제안: 별도 조치 불요(이미 plan 에 근거 기록됨). 차후 "§4 오케스트레이션 정리" 시점에 팝업 글루도 동일 패턴(순수 훅 추출)으로 정리 권장.

- **[INFO]** 예약 입력 포트 집합(`emit`)이 FE/BE 양쪽에 독립 리터럴로 존재
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `RESERVED_INPUT_HANDLE_IDS = new Set(["emit"])` — 주석의 SoT 는 backend `shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS = {'emit'}`
  - 상세: 사이클 경고 규칙(`@workflow/graph-warning-rules`)은 이미 FE/BE 공유 패키지로 동기화하는 선례가 있는 반면, 이 예약 포트 집합은 두 곳에 독립적으로 유지되는 문자열 리터럴이라 컴파일/테스트 타임에 서로 어긋나도 감지되지 않는다. 현재는 원소가 1개뿐이라 과잉설계를 피하려는 실용적 선택으로 보이지만, 드리프트 위험은 latent 하게 남는다.
  - 제안: 지금 당장 조치 불요. 예약 포트가 2개 이상으로 늘어나는 시점엔 공유 상수/패키지로 승격 검토.

## 요약
`use-edge-reconnect.ts` 훅은 콜백을 매개변수로 주입받아 store 구현을 직접 참조하지 않는 방식(DIP)으로 설계되어 있고, React Flow 배선(프레젠테이션) · 제스처 판정 글루(훅) · 유효성 검증 및 상태 변경(store) · 순수 헬퍼(edge-utils) 간 레이어 경계가 명확히 유지된다. `firstInputHandleId` 의 예약 포트 필터링도 기존 계약(자동 연결 시 컨테이너 충돌 없음)을 코드 레벨로 승격시켜 이전에 JSDoc 에만 의존하던 암묵적 불변식을 명시적으로 강제한 점이 긍정적이다. 가장 눈에 띄는 개선 여지는 `onConnect`/`onReconnect` 사이의 유효성 검증 오케스트레이션 중복(WARNING)이며, `workflow-canvas.tsx` 의 책임 팽창은 이번 PR 범위에서 일부 완화됐고 나머지는 plan 문서에 근거와 함께 의도적으로 이월되어 있어 즉각적인 구조적 위험으로 보긴 어렵다. 순환 의존성이나 레이어 위반, 안티패턴은 발견되지 않았다.

## 위험도
LOW
