# 신규 식별자 충돌 검토 결과

## 검토 대상 요약
- 검토 모드: `--impl-prep`, scope=`spec/3-workflow-editor/`
- Target 번들: `0-canvas.md`, `1-node-common.md`, `2-edge.md`, `3-execution.md` (전체 스냅샷, diff 아님)
- 실제 착수 대상 작업(`plan/in-progress/spec-sync-edge-gaps.md` 잔여 유일 항목): `2-edge.md` §4 "엣지 중간에 노드 드롭" (`엣지를 분리하고 중간에 노드 삽입 (source→새노드, 새노드→target)`, 현재 "미구현 (Planned)")
- §1.2/§1.3/§3.2/§4-preview/§5 는 이미 구현 완료(PR #940/#941/#942/#943) 상태로 번들에 포함 — 신규 식별자 재검토 대상 아님

## 발견사항

- **[INFO]** §4 mid-insert 행 자체는 새 식별자를 전혀 도입하지 않음
  - target 신규 식별자: (없음) — `spec/3-workflow-editor/2-edge.md` §4 "엣지 중간에 노드 드롭" 행은 새 요구사항 ID·엔티티명·엔드포인트·이벤트명·ENV 키·파일 경로를 하나도 명명하지 않는다 (line 1352, prose-only: "엣지를 분리하고 중간에 노드 삽입 (source→새노드, 새노드→target)")
  - 기존 사용처: 같은 파일의 §1.2/§1.3 구현 서술은 각각 `onConnectEnd`/`onConnect`/`buildAndAddNode`/`edge-utils.ts`(`connectionDragSource`, `buildAutoConnectConnection`, `firstInputHandleId`) 및 `onReconnect`/`onReconnectEnd`/`useEdgeReconnect`/`reconnectEdge` 를 이미 정의·사용 중
  - 상세: §4 행은 새 컴포넌트/훅/DTO/엔드포인트 이름을 spec 레벨에서 예약하지 않으므로, 구현 시 developer 가 기존 `onConnect`/`addEdge`/`removeEdge`/`edge-utils.ts` 계열 헬퍼를 재사용/확장할 것으로 보인다. 이는 신규 식별자 충돌의 "재료"가 spec 문서 자체에는 아직 없다는 뜻이며, 충돌 여부는 실제 구현 PR 단계(코드 리뷰)에서 새로 붙는 함수/훅 이름을 대상으로 재검토해야 한다.
  - 제안: (조치 불요, 참고용) — spec 갱신 시 §1.2/§1.3 처럼 "현재 구현" 인용구를 붙일 때, 새로 만드는 헬퍼 이름이 `edge-utils.ts` 기존 export(`connectionDragSource`, `buildAutoConnectConnection`, `isSelfConnection`, `isDuplicateConnection`, `resolveEdgeExecutionState`, `buildEdgeStyle` 등)와 겹치지 않는지 구현 시점에 한 번 더 확인 권장.

- **[WARNING]** "엣지 분리" 용어가 §1.3(detach=삭제)와 §4(split=삽입)에서 서로 다른 의미로 재사용됨
  - target 신규 식별자: §4 "엣지를 **분리**하고 중간에 노드 삽입" (`spec/3-workflow-editor/2-edge.md` line 1352)
  - 기존 사용처: §1.3 "기존 연결이 있는 엣지의 끝점을 드래그하면 그 엣지를 **분리**하여 재연결(빈 영역에 놓으면 삭제)" (line 1247) 및 그 구현 주석 "끝점을 **빈 캔버스에 놓으면**(detach) `onReconnectEnd` 가 엣지를 삭제한다" (line 1251)
  - 상세: 같은 한국어 동사 "분리"가 §1.3 에서는 이미 코드화된 **detach**(엣지 끝점을 놓아 삭제, `onReconnectEnd`/`removeEdge`) 개념을 가리키는 반면, §4 에서는 **split**(엣지 하나를 두 개로 나누고 사이에 새 노드를 끼움, 원본 엣지 삭제 없이 source→새노드→target 재배선) 개념을 가리킨다. 두 동작은 결과가 다르다(§1.3=엣지 소멸, §4=엣지 존속+재배선). 구현자가 spec 문구를 그대로 따라 새 함수/이벤트를 "detachEdge"·"splitEdge" 등으로 명명할 때, 기존 §1.3 detach 어휘(`onReconnectEnd`, "detach" 라는 코드 주석 용어)와 이름/의미가 혼동될 여지가 있다.
  - 제안: §4 행의 서술을 "엣지를 **분할(split)**하고 중간에 노드 삽입"처럼 §1.3 의 "분리(detach)"와 구별되는 표현으로 정정 권장. 구현 시 신규 헬퍼 명명은 `splitEdgeWithNode`/`insertNodeOnEdge` 류로 "detach" 계열과 겹치지 않게.

- **[INFO]** mid-insert 삽입 노드의 `containerId` 처리 규칙이 spec에 명시되지 않음 (신규 식별자 문제는 아니나 향후 §11.2.1 규약과 이름 충돌 가능성 있는 지점)
  - target 신규 식별자: (없음, §4 행 자체는 컨테이너 관련 언급 없음)
  - 기존 사용처: `spec/3-workflow-editor/0-canvas.md` §11.2.1 "자동 containerId 동기화 (edge-driven)" — `Container.body → X` / `Y → Container.emit` 전파 규칙 (line 637-654)
  - 상세: 컨테이너 경계에 걸친 엣지(`Container.body → child`, `child → Container.emit`) 중간에 노드를 삽입하면 새 노드가 자동으로 컨테이너 멤버가 되어야 하는지 여부가 §4 행에 정의되어 있지 않다. 이는 naming collision 은 아니지만, 구현 단계에서 "mid-insert 시 자동 containerId 재계산"을 별도 함수로 만들 경우 §11.2.1 의 기존 "전체 재계산"(fixed-point) 로직과 이름·책임이 겹치지 않게 재사용 여부를 결정해야 한다는 점만 참고로 남긴다.
  - 제안: 이 항목은 로직/커버리지 리뷰(요구사항 충돌·논리 검토) 소관이므로 별도 관점 리포트에서 다루는 것을 권장. 본 리뷰는 참고 표기만 함.

- **[NONE]** 요구사항 ID·엔드포인트·이벤트명·ENV 키·파일 경로 충돌 없음
  - `spec/3-workflow-editor/` 4개 target 파일 전체에서 재사용되는 요구사항 ID(`ED-PL-03`, `ED-PL-04`, `ED-SP-05`, `ND-BG-05` 등)를 검색 대상 코퍼스(`0-overview.md`, `1-data-model.md`, `plan/in-progress/*`, `conventions/*`) 전역에서 교차 검색한 결과, 동일 ID 가 다른 의미로 쓰인 사례를 발견하지 못했다. `2-edge.md` §9(API) 의 기존 엔드포인트(`/api/workflows/:id/execute`, `/api/workflows/:id/nodes/:nodeId/execute`, `/api/executions/*`) 도 §4 mid-insert 기능과 무관하며 새 엔드포인트가 필요하지 않다(순수 캔버스/프론트 상태 변경 후 기존 워크플로우 저장 API 로 커밋).

## 요약
검토 대상인 `spec/3-workflow-editor/2-edge.md` §4 "엣지 중간에 노드 드롭" 항목(이번 작업의 실질 구현 대상)은 spec 문서 레벨에서 새로운 요구사항 ID·엔티티/DTO명·API 엔드포인트·이벤트명·ENV 변수·파일 경로를 전혀 도입하지 않는 순수 UI 인터랙션 서술이며, 기존 코퍼스(canvas/node-common/execution, 0-overview, 1-data-model, 관련 plan·convention 문서) 전역과 대조했을 때 직접적인 식별자 재사용/충돌은 발견되지 않았다. 다만 §1.3 에서 이미 코드화된 "엣지 분리(detach)" 개념과 §4 의 "엣지 분리(사실상 split)" 서술이 같은 한국어 동사를 다른 의미로 재사용하고 있어, 구현 시 함수/훅 명명이 뒤섞일 여지가 있다는 WARNING 1건을 남긴다. 나머지는 참고용 INFO다.

## 위험도
LOW
