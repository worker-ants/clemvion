# Rationale 연속성 검토 결과

> 검토 모드: --impl-prep, scope=spec/3-workflow-editor/
> 대상: spec/3-workflow-editor/{0-canvas,1-node-common,2-edge,3-execution}.md 및 spec 전역 `## Rationale` 발췌
> 실제 착수 대상으로 식별된 항목: `spec/3-workflow-editor/2-edge.md` §4 "엣지 중간에 노드 드롭"(미구현 Planned) — `plan/in-progress/spec-sync-edge-gaps.md` 의 유일한 잔여 체크박스와 일치.

## 발견사항

- **[WARNING]** 팔레트→캔버스 계층 분리 원칙(R-2)과 엣지-히트테스트 로직의 배치
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4 "엣지 중간에 노드 드롭" 행 (line ~1350, "미구현 (Planned)")
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md` `## Rationale` R-2 "팔레트→캔버스 노드 추가는 브리지 경유 (§4.2)"
  - 상세: R-2 는 "뷰포트 좌표·ReactFlow 인스턴스에 의존하는 로직은 `editor-store`(순수 상태) 에 두지 않고 `palette-canvas-bridge` 를 통해 canvas 컴포넌트에만 둔다"는 계층 분리를 명시적으로 확정했다(순환 의존 방지 목적, `assistant-editor-bridge` 와 동일 seam). "엣지 중간에 노드 드롭"을 구현하려면 드롭 좌표가 어떤 엣지의 path 위에 있는지 판정하는 **ReactFlow 지오메트리 의존 히트테스트**가 필요한데, 이는 §4.2 팔레트 클릭-추가(뷰포트 중앙 좌표)와 동일한 성격의 canvas-only 관심사다. 만약 구현 시 이 히트테스트나 엣지 분리(remove+2×add) 오케스트레이션을 `editor-store` 순수 액션에 직접 넣는다면 R-2 가 막으려던 계층 붕괴(React Query·RF 인스턴스 의존이 store 로 새어나가는 것)를 재현하게 된다. 아직 구현이 시작되지 않아 "위반"이 확정된 것은 아니지만, impl-prep 단계에서 이 경계를 명시적으로 지키도록 못박아야 한다.
  - 제안: 구현 착수 시 (a) 엣지 hit-test·드롭 판정은 `workflow-canvas.tsx`(또는 그 하위 훅)에 두고, (b) `editor-store` 에는 "엣지 분리 + 노드 삽입 + 2개 엣지 재생성"을 하나의 원자적 액션(예: `splitEdgeWithNode`)으로만 노출해 canvas 가 좌표 판정 결과(대상 edgeId)만 넘기는 방식으로 R-2 seam 을 그대로 재사용할 것. 이 경계를 지키면 새 Rationale 불요 — 다른 경로로 간다면 그 사유를 R-2 옆에 후속 Rationale 로 남길 것.

- **[WARNING]** 복합 캔버스 변경의 Undo 원자성 관행 미반영
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4 "엣지 중간에 노드 드롭" 행 — 구현 시 필요한 변경(엣지 1개 삭제 + 노드 1개 추가 + 엣지 2개 추가)에 대한 undo 처리 언급 없음
  - 과거 결정 출처: `spec/3-workflow-editor/2-edge.md` §1.2 "현재 구현" 서술(`onConnect` 의 `skipUndo` 옵션으로 "노드는 있고 엣지는 없는" 중간 상태를 별도 undo 스냅샷으로 남기지 않아 Ctrl+Z 1회로 노드+엣지를 함께 취소") 및 §1.3 "재연결·삭제 각각 단일 undo 체크포인트" — 단, 이 서술은 `## Rationale` 헤딩 안이 아니라 본문 "구현" 콜아웃에 있어 형식상 완전한 Rationale 항목은 아님(원칙과의 "거리감" 케이스)
  - 상세: 이 저장소는 동일 문서(`2-edge.md`) 안에서 두 차례(§1.2, §1.3) "복합 구조 변경 = 단일 undo 체크포인트"를 반복 확정한 확립된 관행을 갖고 있다. §4 mid-insert 는 구조적으로 §1.2 의 "빈 영역 드롭→노드 생성→자동 연결" 패턴보다 한 단계 더 복합적(엣지 제거 + 노드 추가 + 엣지 2개 추가)이라, 같은 원칙이 적용되지 않으면 사용자가 Ctrl+Z 를 눌렀을 때 절반만 되돌아가는(예: 새 엣지 2개는 사라졌는데 원래 엣지는 복원 안 됨, 또는 그 반대) 퇴행이 발생할 위험이 크다.
  - 제안: 구현 시 `skipUndo`/단일 체크포인트 패턴을 그대로 확장 적용하고, §4 스펙 본문에 "3-way 복합 변경도 Ctrl+Z 1회로 취소"를 명시할 것. 만약 의도적으로 다단계 undo(예: 삽입 후 노드 위치만 별도 취소)로 설계한다면, 그 이유를 `## Rationale` 에 새 항목으로 남겨 §1.2/§1.3 관행과의 편차를 정당화할 것.

- **[INFO]** containerId 자동 재계산(§11.2.1)과의 연계가 스펙 문구에 아직 명시되지 않음
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4 "엣지 중간에 노드 드롭" 행
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md` §11.2.1 "자동 containerId 동기화 (edge-driven)" (`containerId`는 엣지의 순수 함수로 매 변경 시 자동 재계산) — 이 자체는 `## Rationale` 항목은 아니고 본문 규칙이지만, R-4 가 "컨테이너 멤버십은 데이터 모델(containerId)로만 표현"이라는 원칙을 재확인하는 근거로 인용하는 핵심 invariant다.
  - 상세: mid-insert 는 기존 엣지(예: `Container.body → X` 또는 chain 엣지)를 분리하고 새 엣지 2개로 대체하는 엣지 변경이므로, §11.2.1 의 "매 변경 시 자동 재계산" 경로를 그대로 타야 새 노드의 `containerId` 가 body/emit/chain 규칙에 따라 정확히 산출된다. 별도의 bespoke 계산을 새로 만들면 SoT 가 두 곳으로 갈라질 위험이 있다. 현재 §4 문구는 이 연계를 언급하지 않아, 구현자가 이 사실을 놓칠 여지가 있다(치명적 위반은 아니고 사전 고지 성격의 gap).
  - 제안: §4 구현 반영 시 "노드 삽입 후 §11.2.1 의 엣지 기반 재계산 로직을 그대로 재사용한다"는 한 줄을 추가(§8 이 이미 "유사 사례: §11 컨테이너 로드 시 재계산"으로 교차 링크한 선례와 동일한 패턴).

- **[INFO]** "새노드" 한정 스코프와 §2.2/§2.3 하드 차단·warn-not-block 상호작용 확인 필요
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4 "엣지를 분리하고 중간에 노드 삽입 (source→새노드, 새노드→target)" 문구
  - 과거 결정 출처: `spec/3-workflow-editor/2-edge.md` `## Rationale` R-2 (순환 참조 warn-not-block) 및 §2.2 자기연결/중복 하드 차단
  - 상세: 스펙 문구가 "새노드"로 명시돼 있어 팔레트發 신규 노드 삽입만을 전제하는 것으로 읽힌다. 이 범위를 지키는 한 §2.2 하드 차단(자기연결)·R-2 warn-not-block 원칙과 충돌 소지가 없다. 다만 향후 구현·설계 논의에서 "기존 캔버스 노드를 드래그해 엣지 중간에 끼워넣기"로 스코프가 확장될 경우(별도 결정 없이), 자기 자신이 속한 하류 엣지 위로 끌어오는 시나리오 등에서 자기연결·사이클 판정 로직과의 재검토가 필요해진다.
  - 제안: 구현 착수 시 "새노드(팔레트 드래그)만 대상이며 기존 캔버스 노드 재배치는 별도 스코프"임을 §4 에 명시해 스코프 드리프트를 막을 것. 확장하기로 결정한다면 R-2/§2.2 와의 상호작용을 검토한 새 Rationale 항목을 추가할 것.

## 요약

이번 impl-prep 스코프(`spec/3-workflow-editor/`)에서 실제로 착수 대상인 항목은 `2-edge.md` §4 의 유일한 잔여 Planned 기능인 "엣지 중간 노드 드롭 삽입"이다. 이 기능 자체가 과거 `## Rationale` 에서 명시적으로 기각된 대안을 재도입하는 사례는 발견되지 않았다(git 이력상 이 한 줄 문구는 최초 작성 이후 변경 없이 유지돼왔고, 경쟁 설계가 논의·기각된 흔적도 없다). 다만 같은 spec 영역 안에 이미 확립된 두 원칙 — (1) `0-canvas.md` R-2 의 palette↔canvas 계층 분리(bridge seam), (2) `2-edge.md` §1.2/§1.3 의 복합 변경 단일-undo 관행 — 을 mid-insert 구현이 그대로 따라야 한다는 점이 스펙 문구에 아직 명시돼 있지 않아 WARNING 2건으로 표시했다. 컨테이너 `containerId` 자동 재계산과의 연계, "새노드" 스코프 한정은 사전 고지 목적의 INFO 로 남긴다. 전체적으로 착수를 막을 CRITICAL 사안은 없으며, 구현 시 위 두 WARNING 을 설계에 반영하면 연속성 리스크는 해소된다.

## 위험도

LOW
