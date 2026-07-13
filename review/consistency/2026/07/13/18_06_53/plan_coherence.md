# Plan 정합성 검토 결과

검토 모드: --impl-prep, scope=`spec/3-workflow-editor/` (target: `0-canvas.md`, `1-node-common.md`, `2-edge.md`, `3-execution.md` + `plan/in-progress/**` 전체 동봉분)

## 발견사항

- **[INFO]** §4 엣지 중간 노드 드롭 삽입 — 트리거 UX·컨테이너 엣지 상호작용이 plan 에 세분화되어 있지 않음
  - target 위치: `spec/3-workflow-editor/2-edge.md` §4 "엣지 조작" 표 — `엣지 중간에 노드 드롭 | 엣지를 분리하고 중간에 노드 삽입 (source→새노드, 새노드→target) | 미구현 (Planned)`
  - 관련 plan: `plan/in-progress/spec-sync-edge-gaps.md` — 미구현 항목의 마지막 잔여 체크박스 `- [ ] §4 엣지 중간 노드 드롭 삽입 (source→새노드, 새노드→target)` (다른 §1.2/§1.3/§2.2/§2.3/§3.2 항목은 전부 `[x]` 완료 처리됨, PR 이력·구현 메커니즘까지 상세 기록)
  - 상세: target 문서 1행·plan 체크박스 1줄 모두 "이 항목만 남았다"는 사실 자체는 정합적이며 결정 필요 항목도 별도로 나열돼 있지 않다(§1.2/§1.3 처럼 이월/충돌 여부를 (a)~(e)로 명시한 패턴과 달리, §4 는 별도 세부 분석 없이 한 줄만 존재). 다만 target 문서 자체가 (1) 이 드롭 제스처가 팔레트 드래그인지 퀵애드 팝업 경로인지 트리거 메커니즘을 명시하지 않고, (2) §11.2.1 "자동 containerId 동기화(edge-driven)" — 즉 컨테이너의 `body→X` 또는 `X→emit` 엣지 위에 노드를 드롭했을 때 신규 노드가 어느 쪽 컨테이너 멤버십을 상속하는지 — 를 교차 서술하지 않는다. §1.2/§1.3 항목은 유사한 신규 엣지 조작 기능을 도입하며 "충돌 없음 확인" 서브 결정을 명시적으로 남겼던 것과 대비된다. CRITICAL/WARNING 수준의 결정 충돌은 아니다 — §11.2.1 자체가 "엣지의 순수 함수로 매 변경 시 자동 재계산"이라고 일반화돼 있어 이번 삽입도 그 규칙에 자연히 포섭되고, 별도 정책 결정이 필요하다는 근거는 plan 에도 없다.
  - 제안: 필수 갱신은 아니나, 구현 착수 시 `spec-sync-edge-gaps.md` §4 항목에 §1.2/§1.3 패턴처럼 "컨테이너 body/emit 엣지 위 드롭 시 동작"과 "undo 체크포인트 단일화 여부(§1.2 의 `skipUndo` 선례)"를 짧게 결정 기록으로 남기면 추후 ai-review 단계에서 재작업 리스크를 줄일 수 있음. target 문서 갱신은 구현 완료 후 통상적인 "구현 반영" 절차로 처리하면 충분.

- **[INFO]** AI Agent Tool Area 미해결 결정은 이번 target 스코프와 무관 — 참고용 확인
  - target 위치: `spec/3-workflow-editor/0-canvas.md` §12 (재작성 예정 박스), `spec/3-workflow-editor/2-edge.md` §7 "Tool Area 연결 규칙" (`엣지 없음`)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정 (사용자 합의 필요)" — 도구 등록 모델(a/b/c) 등 5개 TBD 항목 전부 미해결
  - 상세: `0-canvas.md` frontmatter `pending_plans` 에 이미 정확히 링크돼 있고, 본문도 "현재 비활성" 상태를 정확히 서술한다. `2-edge.md` §7 은 "Tool Area 에 등록된 노드는 데이터 흐름 엣지로 연결되지 않음"이라고 명시해 엣지 자체가 없으므로, 이번 작업 대상인 §4 엣지 중간 삽입 기능과 교차할 여지가 없다(Tool Area 는 엣지 기반이 아님).
  - 제안: 조치 불필요. 미해결 결정은 그대로 별도 plan 트랙에 남겨두는 것이 맞고, 이번 mid-insert 구현이 그 결정을 선점하거나 우회하지 않는다.

## 요약

target(`spec/3-workflow-editor/0-canvas.md`, `1-node-common.md`, `2-edge.md`, `3-execution.md`)과 `plan/in-progress/**` 사이에 CRITICAL 또는 WARNING 수준의 정합성 문제는 발견되지 않았다. 이번 작업 대상으로 보이는 "엣지 중간 노드 드롭 삽입"(`2-edge.md` §4)은 `plan/in-progress/spec-sync-edge-gaps.md` 의 유일한 잔여 미구현 항목과 정확히 일치하며, 같은 plan 의 나머지 §1.2/§1.3/§2.2/§2.3/§3.2 항목은 이미 완료 처리·구현 메커니즘까지 상세 기록돼 있어 target 문서의 "구현됨" 서술과 어긋나지 않는다. 인접 미해결 결정(`ai-agent-tool-connection-rewrite.md` 의 Tool Area 재설계 5개 TBD)은 스코프상 엣지 기반이 아니라 이번 작업과 교차하지 않으며, `0-canvas.md`/`2-edge.md` 의 `pending_plans` frontmatter 에 정확히 링크돼 있어 별도 조치가 필요 없다. 다른 in-progress plan(`node-output-redesign/**`, `execution-engine-residual-gaps.md`, `parallel-p2-followups.md`, `merge-p2-async-fanin.md` 등) 도 캔버스/엣지/포트 토폴로지 변경을 전제하지 않아 후속 항목 무효화 리스크가 없다. 유일한 INFO 는 §4 항목이 §1.2/§1.3 대비 세부 결정 기록(트리거 메커니즘, 컨테이너 엣지 상호작용, undo 단일화)이 얕다는 점으로, 구현 중 짧은 메모 추가를 권장하되 착수를 막을 사유는 아니다.

## 위험도
NONE
