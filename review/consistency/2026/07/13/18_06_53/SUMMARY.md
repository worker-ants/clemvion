# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — `2-edge.md` §4 "엣지 중간에 노드 드롭"(mid-insert, 유일한 잔여 Planned 항목) 착수를 막는 CRITICAL 은 없으나, 5개 checker 중 4개가 독립적으로 **컨테이너 경계(body/emit) 엣지 위 mid-insert 시 containerId 동기화·emit 단일성 invariant 상호작용 미정의**에 수렴했고, 다중/동적 포트 노드의 연결 대상 포트 규칙도 spec 에 없다. 구현 착수 전 이 gap 들을 §4 문구에 명시하는 것이 안전하다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 다중/제로 포트 노드(If/Else, Switch, Merge, Loop/ForEach/Map 등)를 mid-insert 시 "source→새노드, 새노드→target" 중 어느 포트에 연결할지 규정 없음 | `spec/3-workflow-editor/2-edge.md` §4 | `1-node-common.md` §1.3 "노드별 포트 구성" · §1.2 "빈 영역 드롭"의 대칭 규칙(`firstInputHandleId` 전례는 출력 포트엔 미적용) | §4 에 (a) 다중 출력 노드의 target 연결 포트 선택 규칙 (b) 다중 입력 노드의 source 연결 포트 선택 규칙 (c) 무입출력 노드(트리거 등) 드롭 시 동작(자동 연결 생략 여부)을 명시 |
| 2 | Cross-Spec / Rationale Continuity / Plan Coherence / Naming Collision (4개 checker 수렴) | 컨테이너 경계(`body`/`emit`) 엣지 위 mid-insert 가 §11.2.1 edge-driven containerId 동기화·§6.1 emit 단일성 invariant(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`)와 어떻게 상호작용하는지 미정의 | `spec/3-workflow-editor/2-edge.md` §4 | `0-canvas.md` §11.2.1(트리거를 `onConnect`/로드 2가지로만 한정 서술) · `2-edge.md` §6.1/§6.2(경계 불가침, emit 정확히 1개) | §4 에 "삽입 대상 엣지가 `body`/`emit` 핸들을 포함하면 신규 엣지는 원본 핸들을 보존하고 표준 `onConnect`/`evaluateConnection` 경로를 재사용해 §11.2.1 재계산·§6.1 invariant 를 그대로 적용한다"를 명시(또는 최소 상호참조 추가) |
| 3 | Rationale Continuity / Cross-Spec | mid-insert(엣지 삭제 1 + 노드 추가 1 + 엣지 추가 2, 복합 변경)의 Undo 원자성 정책이 §1.2/§1.3 의 "단일 undo 체크포인트" 확립 관행과 연계돼 있지 않음 | `spec/3-workflow-editor/2-edge.md` §4 | `2-edge.md` §1.2(`onConnect` `skipUndo` 옵션) · §1.3(재연결/삭제 단일 체크포인트) | §4 에 "§1.2/§1.3 와 동일하게 단일 undo 체크포인트로 처리"를 명시. 다단계 undo 로 의도적으로 설계한다면 그 사유를 `## Rationale` 신규 항목으로 기록 |
| 4 | Rationale Continuity | mid-insert 구현 시 엣지 hit-test(ReactFlow 지오메트리 의존)를 어디에 둘지(`editor-store` 순수 액션 vs canvas 전용 seam)가 R-2 계층분리 원칙과 연계돼 명시돼 있지 않음 | `spec/3-workflow-editor/2-edge.md` §4 | `0-canvas.md` `## Rationale` R-2("팔레트→캔버스 노드 추가는 브리지 경유", 뷰포트/RF 의존 로직을 store 에 두지 않는 계층 분리) | 구현 착수 시 (a) hit-test/드롭 판정은 canvas 컴포넌트(또는 하위 훅)에 두고 (b) `editor-store` 는 "엣지 분리+노드 삽입+엣지 2개 재생성"을 단일 원자적 액션으로만 노출해 R-2 seam 재사용. 다른 경로를 택하면 R-2 옆에 후속 Rationale 기록 |
| 5 | Naming Collision | "엣지 분리"라는 동일 한국어 표현이 §1.3(detach=삭제)과 §4(split=삽입, 원본 엣지 존속)에서 서로 다른 의미로 재사용돼 구현 시 함수/훅 명명 혼동 위험 | `spec/3-workflow-editor/2-edge.md` §4 line ~1352 | `2-edge.md` §1.3 "엣지를 분리하여 재연결(빈 영역에 놓으면 삭제)" (line ~1247), `onReconnectEnd`/"detach" 코드 주석 | §4 문구를 "엣지를 **분할(split)**하고 중간에 노드 삽입"으로 정정해 §1.3 "분리(detach)"와 구별. 신규 헬퍼는 `splitEdgeWithNode`/`insertNodeOnEdge` 류로 명명(`detach` 계열과 비겹침) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `0-canvas.md` §3.3 "팔레트에서 드래그" ↔ `2-edge.md` §4 "엣지 중간 드롭" 간 상호참조 부재 (엣지 히트박스 우선순위 불명확) | `0-canvas.md` §3.3, `2-edge.md` §4 | §3.3 행에 "엣지 위 드롭 예외는 §4 참조" 각주 추가 |
| 2 | Cross-Spec | mid-insert 대응 PRD 요구사항 ID(`ED-EG-07` 등) 부재 — 다른 신규 항목은 PRD ID 로 spec-sync 됨 | `_product-overview.md` §3.3 (ED-EG-01~06) | 구현 시점에 신규 ID 추가는 project-planner 소관 |
| 3 | Rationale Continuity | "새노드"(팔레트 드래그) 한정 스코프가 §4 문구에 명시적이지 않음 — 향후 "기존 캔버스 노드 재배치"로 스코프 확장 시 §2.2/R-2 자기연결·순환 판정과 재검토 필요 | `2-edge.md` §4 문구 | 스코프 명시 또는 확장 시 신규 Rationale 기록 |
| 4 | Convention Compliance | `0-canvas.md` frontmatter `pending_plans` 에 완료된 `plan/complete/spec-sync-canvas-gaps.md` 가 in-progress 항목과 함께 잔존 (가드는 통과, 위반은 아님) | `0-canvas.md` frontmatter | 완료 사실은 본문/Rationale 각주로 옮기고 `pending_plans` 는 in-progress 항목만 유지 권장 |
| 5 | Convention Compliance | 컨테이너 포트 "보라색" 서술이 `1-node-common.md`(emit 핸들)와 `2-edge.md`(body 기원 엣지선)에 다른 대상으로 분산 — 코드 대조 결과 실제 모순은 아니나 §4 구현 시 혼동 소지 | `1-node-common.md` §1.2/§1.3, `2-edge.md` §3.1 | §3.1 "컨테이너 포트" 행에 대상 구분 각주 추가 권장 |
| 6 | Plan Coherence | `ai-agent-tool-connection-rewrite.md` 의 Tool Area 미해결 결정(5개 TBD)은 엣지 기반이 아니라 이번 mid-insert 스코프와 무교차 확인 | `0-canvas.md` §12, `2-edge.md` §7 | 조치 불요 (참고용) |
| 7 | Convention Compliance (절차) | 본 세션 prompt payload 의 `spec/conventions/**` 번들이 `cafe24-api-catalog/**` 알파벳 순 우선 배치로 크기 한도 초과·조기 절단되어 실제 관련 규약(`swagger.md`/`error-codes.md`/`node-output.md`/`interaction-type-registry.md` 등)이 누락됨 (해당 checker 는 직접 파일시스템 Read 로 우회 완료, target 문서 위반 아님) | prompt_file 생성 스크립트 (orchestrator) | target 영역 관련도 우선 정렬 또는 용량 초과 시 전체 파일 목록(제목만이라도) 포함하도록 번들링 로직 개선 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 다중/제로 포트 노드 연결 대상 미정의, 컨테이너 경계 엣지 상호작용 미정의 |
| Rationale Continuity | LOW | R-2 계층분리 hit-test 배치 미확정, 복합 변경 undo 원자성 관행 미반영 |
| Convention Compliance | LOW | 규약 위반 없음. prompt payload 절단(절차 이슈), pending_plans/포트색상 INFO |
| Plan Coherence | NONE | plan(`spec-sync-edge-gaps.md`)·target 문서 정합. 세부 결정 기록만 얕음 |
| Naming Collision | LOW | 신규 식별자 충돌 없음. "엣지 분리(detach)" vs "엣지 분리(split)" 용어 오버로드 |

## 권장 조치사항
1. (구현 착수 전 권장) `2-edge.md` §4 를 확장해 WARNING #1(다중/제로 포트 연결 규칙), #2(컨테이너 경계 body/emit 상호작용), #3(undo 단일 체크포인트) 을 명시. 세 항목 모두 §1.2/§1.3/§11.2.1 의 기존 원칙을 재사용하는 방향으로 결론 낼 수 있어 대규모 신규 설계는 불필요.
2. §4 문구를 "엣지 분할(split)"로 정정해 §1.3 "분리(detach)"와의 용어 충돌(WARNING #5) 해소.
3. 구현 착수 시 hit-test/드롭 판정 로직을 canvas 전용 seam 에 두어 R-2 계층분리(WARNING #4) 준수.
4. INFO #1~#5 는 문서 명료성·추적성 개선으로 비차단 — 여유 있을 때 반영.
5. INFO #7(prompt payload 절단)은 orchestrator 스크립트 측 개선 사항으로 별도 트래킹 권장(이번 세션은 직접 Read 우회로 실질 영향 없음 확인).