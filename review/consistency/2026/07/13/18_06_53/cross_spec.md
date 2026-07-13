# Cross-Spec 일관성 검토 — spec/3-workflow-editor/ (edge-mid-insert, --impl-prep)

## 발견사항

- **[WARNING]** "엣지 중간에 노드 드롭" 삽입 시 다중/제로 포트 노드의 연결 대상 포트가 미정의
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4 엣지 조작 표 — `엣지 중간에 노드 드롭 | 엣지를 분리하고 중간에 노드 삽입 (source→새노드, 새노드→target) | 미구현 (Planned)`
  - 충돌 대상: `spec/3-workflow-editor/1-node-common.md` §1.3 "노드별 포트 구성" (If/Else 2출력, Switch/AI Agent/Text Classifier N출력, Merge N입력, Loop/ForEach/Map 2입력+2출력, Filter 2출력 등) · 같은 파일 §1.2 "빈 영역 드롭 시"(대비 사례)
  - 상세: §4 의 서술은 "source→새노드, 새노드→target" 라는 **1입력·1출력 단순 노드**를 전제로 한 문구다. 그러나 1-node-common.md §1.3 은 팔레트에서 드래그 가능한 노드 다수가 다중/동적 포트를 갖는다고 명시한다 — If/Else(true/false), Switch(case_0..N/default), AI Agent(cond_0..N + 시스템 포트), Text Classifier(class_0..N+fallback+error), Filter(match/unmatched), Merge(N개 동적 **입력**), 컨테이너 Loop/ForEach/Map(입력 `in`/`emit` 2개, 출력 `body`/`done` 2개+error) 등. 이런 노드를 엣지 중간에 드롭했을 때 "새노드→target" 이 어느 출력 포트로 연결되는지(즉시 완성되는 `body` 인지 반복 종료 `done` 인지 등), "source→새노드" 가 어느 입력 포트(Merge 의 N개 중 어디, 컨테이너의 `in` vs `emit`)로 연결되는지 spec 이 규정하지 않는다. 같은 파일 §1.2 는 대칭 상황(빈 영역 드롭 후 자동 연결)에서 "대상 노드에 입력 포트가 없으면(예: 트리거) 노드만 생성하고 자동 연결은 생략" 이라는 명시적 규칙과 `firstInputHandleId` 헬퍼(입력 포트 선택 전례)를 갖고 있지만, 대응하는 "첫 출력 포트" 선택 규칙·헬퍼는 어디에도 없다 — mid-insert 는 새 노드의 **출력** 포트를 target 에 연결해야 하므로 이 전례가 그대로 이식되지 않는다.
  - 제안: 구현 전 §4 를 확장해 (a) 다중 출력 노드는 어떤 포트를 target 에 연결할지(예: 첫 data 포트, 또는 자동 연결 생략) (b) 다중 입력 노드는 어떤 포트에 source 를 연결할지 (c) 입력/출력 포트가 없는 노드(Manual Trigger 등)를 mid-insert 대상으로 드롭했을 때의 동작(§1.2 의 "자동 연결 생략" 전례를 따를지)을 명시. `1-node-common.md` §1.3 은 변경 불필요 — `2-edge.md` §4 만 보강.

- **[WARNING]** 컨테이너 경계 엣지(body/emit) 위에서의 mid-insert 가 §11.2.1 edge-driven containerId 동기화·§6 컨테이너 내부 엣지 규칙과 상호작용 미정의
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4 (동일 행)
  - 충돌 대상: `spec/3-workflow-editor/0-canvas.md` §11.2.1 "자동 containerId 동기화 (edge-driven)" (전파 규칙은 "`onConnect` 및 workflow 로드 시" 에만 fixed-point 로 재계산된다고 명시) · `2-edge.md` §6.1 "출력 수집(emit 포트)" (Loop/ForEach/Map 은 emit 입력에 **정확히 1개** 자식만 연결되어야 함, 위반 시 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`) · §6.2 "경계 규칙"(엣지가 컨테이너 경계를 직접 넘을 수 없음)
  - 상세: §11.2.1 은 containerId 재계산 트리거를 "onConnect" 와 "workflow 로드" 두 가지로 한정해 서술한다. mid-insert 는 기존 엣지 1개를 제거하고 신규 엣지 2개를 추가하는 복합 동작인데, 이 신규 엣지 2개가 표준 `onConnect`/`evaluateConnection` 경로(컨테이너 충돌 거부·중복 검사 포함)를 거쳐 생성되는지, 아니면 전용 "split" 액션이 raw 배열을 직접 조작하는지 §4 의 현재 문구로는 판별할 수 없다. 만약 분리된 대상 엣지가 `Container.body → X` 또는 `Y → Container.emit` 처럼 컨테이너 경계 포트를 낀 엣지라면, 두 신규 엣지가 원래 핸들(`body`/`emit`)을 그대로 물려받아 표준 connect 경로로 생성되지 않는 한 §11.2.1 의 강제 containerId 동기화·§6.1 의 "정확히 1개 emit" invariant·§6.2 의 경계 불가침 규칙이 조용히 깨질 위험이 있다(예: 새 노드가 컨테이너 멤버로 인식되지 않거나, emit 소스가 일시적으로 0개/2개가 되는 상태 전이가 발생).
  - 제안: §4 에 "삽입 대상 엣지가 컨테이너 `body`/`emit` 핸들을 포함하면 §11.2.1 전파 규칙을 그대로 적용한다(신규 엣지는 원본 핸들 보존 + 표준 `onConnect`/`evaluateConnection` 경로 재사용)" 는 문장을 명시하거나, 최소한 §6/§11.2.1 상호참조를 추가해 구현자가 별도 판단 없이 기존 invariant 를 재사용하도록 유도. 근거가 이미 있다면(구현 설계에서 onConnect 재사용이 확정됐다면) 그 사실을 spec 문구에 반영.

- **[INFO]** `0-canvas.md` §3.3 "팔레트에서 드래그" 규칙과 `2-edge.md` §4 "엣지 중간 드롭" 규칙 간 상호 참조 부재
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4
  - 충돌 대상: `spec/3-workflow-editor/0-canvas.md` §3.3 노드 조작 — `팔레트에서 드래그 | 캔버스에 새 노드 추가 (드롭 위치에 배치)`
  - 상세: 팔레트에서 드래그한 노드를 기존 엣지 위에 드롭하는 경우, `0-canvas.md` §3.3 문구만 읽으면 "드롭 위치에 배치"(빈 캔버스에 노드만 추가)로 해석되고, `2-edge.md` §4 문구만 읽으면 "엣지를 분리하고 삽입"으로 해석된다. 두 섹션이 서로를 참조하지 않아 어느 쪽이 우선하는지(엣지 히트박스 판정 우선순위, 판정 임계값) 명시돼 있지 않다.
  - 제안: `0-canvas.md` §3.3 "팔레트에서 드래그" 행에 "엣지 위 드롭 시 예외는 [Spec 엣지 §4](./2-edge.md#4-엣지-조작) 참조" 각주를 추가해 두 섹션을 명시적으로 연결.

- **[INFO]** mid-insert 의 Undo 번들링 정책 미명시 — 기존 "빈 영역 드롭" 패턴과의 일관성 필요
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4
  - 충돌 대상: `spec/3-workflow-editor/2-edge.md` §1.2 (`onConnect` 의 `skipUndo` 옵션으로 노드+엣지 추가를 Ctrl+Z 1회로 묶는 전례) · `spec/3-workflow-editor/0-canvas.md` §6 Undo/Redo
  - 상세: mid-insert 는 엣지 삭제 1건 + 노드 추가 1건 + 엣지 추가 2건으로 구성된 복합 동작이다. §1.2 는 유사한 복합 동작(노드 추가+엣지 연결)을 단일 undo 체크포인트로 묶는 것을 이미 확립된 패턴으로 명시하는데, §4 의 mid-insert 행은 이에 대한 언급이 없어 구현 시 Ctrl+Z 1회로 전체가 복원되는지, 여러 단계로 나뉘는지 불명확하다.
  - 제안: §4 에 "§1.2 와 동일하게 단일 undo 체크포인트로 처리" 또는 별도 정책을 명시.

- **[INFO]** mid-insert 기능에 대응하는 `_product-overview.md` 요구사항 ID 부재
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4
  - 충돌 대상: `spec/3-workflow-editor/_product-overview.md` §3.3 "엣지 연결" 표 (ED-EG-01~06)
  - 상세: PRD 표는 ED-EG-01~06 까지 6개 요구사항만 나열하며 mid-insert 에 대응하는 ID 가 없다. 다른 신규/변경 항목(예: §4.1 팔레트 Recent 는 ED-PL-04, §8 저장 모델은 ED-SP-05)은 PRD ID 와 함께 spec-sync 되어 있는 관례와 대비된다. 기능 자체의 충돌은 아니나 추적성 공백.
  - 제안: 구현 시점에 `_product-overview.md` §3.3 에 신규 ID(예: `ED-EG-07`)를 추가해 PRD ↔ 상세 spec 매핑을 맞출 것을 권고 (project-planner 소관).

## 요약
가장 실질적인 리스크는 두 WARNING 이다 — (1) mid-insert 대상 노드가 다중/동적 포트를 가질 때 어느 포트에 연결할지 spec 이 규정하지 않아 구현자가 임의로 기본값을 정하게 될 위험, (2) 컨테이너 경계(body/emit) 엣지 위에서 삽입할 때 §11.2.1 의 edge-driven containerId 동기화·§6.1 의 emit 단일성 invariant 가 표준 connect 경로를 우회하면 조용히 깨질 위험이다. 두 항목 모두 기존 spec 텍스트와 직접 모순되는 CRITICAL 은 아니지만(§4 행 자체가 아직 "미구현 Planned" 상태로 상세 설계가 비어 있는 것뿐), 구현 착수 전 명시적 결정 없이 진행하면 이미 구현·테스트된 컨테이너 invariant 를 깨뜨리거나 노드 유형별로 비일관된 기본 포트 선택이 발생할 수 있다. 나머지 INFO 3건은 문서 간 상호참조·추적성 공백으로 비차단.

## 위험도
MEDIUM
