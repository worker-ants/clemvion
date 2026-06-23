# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/3-workflow-editor/` (0-canvas, 1-node-common, 2-edge, 3-execution)

---

## 발견사항

- **[INFO]** `0-canvas.md §11.1` 시각 표현과 `§11.2` 결정 간 잔존 긴장
  - target 위치: `spec/3-workflow-editor/0-canvas.md §11.1` 시각적 표현 표 (최소 크기 400×300px, "바디 영역 확장 가능한 사각형, 내부 노드 자유 배치" 다이어그램)
  - 과거 결정 출처: `0-canvas.md §11.2` 인라인 Rationale 박스 — "시각 containment 미사용: 컨테이너는 기존 일반 노드와 동일한 크기로 렌더된다. 자식 노드는 캔버스 어디에든 자유롭게 배치할 수 있고, 컨테이너 멤버십은 데이터 모델(`containerId`)로만 표현된다."
  - 상세: §11.1 의 `최소 크기 400×300px`·자동 확장·바디 영역 다이어그램은 현재 렌더 모델(일반 노드와 동일 크기)이 아니라 시각 containment 도입 이후의 표현이다. §11.4 노트가 이를 명시적으로 경고("§11.2 와 정합 주의")하고 있어, 문서 안에서 긴장 관계를 인식하고 있음. 새 Rationale 없이 구현 착수 시 §11.1 의 치수·확장 로직이 실제 구현 대상인지 혼동될 수 있다.
  - 제안: 구현 대상이 "시각 containment 미사용(현재 모델)" 에 한정되면 §11.1 표의 최소 크기·자동 확장 행을 `_(미구현 Planned: 시각 containment 도입 시)_` 로 명시하거나, 구현 계획 자체가 시각 containment 도입이라면 §11.2 노트의 "미사용" 결정을 갱신하고 Rationale 항목을 추가한다.

- **[INFO]** `0-canvas.md §12` Tool Area 섹션 — 기각된 인터랙션이 본문에 잔류
  - target 위치: `spec/3-workflow-editor/0-canvas.md §12.2 인터랙션` (노드 드래그 인/아웃, §12.3 삭제 다이얼로그, §12.4 제약)
  - 과거 결정 출처: `0-canvas.md §12` 섹션 상단 박스 — "본 섹션의 Tool Area 시각·인터랙션은 현재 비활성이며, `toolNodeIds` / `toolOverrides` 도 스키마에서 제거됐다." `0-canvas.md §3.3` 행 — "Tool Area에 드래그 _(제거됨)_"
  - 상세: §12.2–12.4 는 이미 기각·비활성화된 인터랙션 정의다. 섹션 상단 경고 박스가 있어 인식은 되어 있지만, 본문 내용 자체(드래그 인/아웃 동작, `tool_owner_id = null` 복원 등)가 그대로 남아 있어 구현자가 착오할 위험이 있다. 결정을 번복하는 새 Rationale 없이 인터랙션 설명이 그대로 노출된다.
  - 제안: §12.2–12.4 전체를 `_(제거됨 — 새 디자인 결정 후 갱신)_` 으로 처리하거나, "재작성 예정" 박스를 §12 최상단 대신 각 서브섹션 위에도 적용해 구현 대상 아님을 명확히 한다. Rationale 항목은 현재 `1-ai-agent.md` 에 위임하고 있으므로 링크를 명시 확인해 구현 착수 전에 `spec/4-nodes/3-ai/1-ai-agent.md §1` 의 기각 사유를 숙지해야 한다.

- **[INFO]** `3-execution.md §6` 브레이크포인트 — Rationale 과 본문의 정합 재확인
  - target 위치: `spec/3-workflow-editor/3-execution.md §6`, `§8.1 execution.paused`, `§8.2 execution.continue/step`
  - 과거 결정 출처: `3-execution.md Rationale §6 브레이크포인트 약속 surface 의 v1 제외` — "별도 plan + spec 개정으로 재도입할 때까지 설계 참고용으로만 남긴다."
  - 상세: §6 상단 박스와 §8.1/§8.2 의 `_(계획·미구현)_` 표기가 Rationale 의 결정과 정합함. 위반 아님. 구현 착수 전 주의사항으로, 이 영역을 건드리려 할 경우 Rationale 에 명시된 "별도 plan + spec 개정 필수" 절차가 전제임.
  - 제안: 해당 없음 (정합 확인). 구현 스코프에서 §6 제외 여부를 plan에 명시하는 것 권고.

---

## 요약

`spec/3-workflow-editor/` 의 4개 문서는 각자의 Rationale 결정과 대체로 정합한다. CRITICAL 또는 WARNING 수준의 위반은 발견되지 않았다. 다만 두 곳에서 INFO 수준의 잔존 긴장이 있다: (1) `0-canvas.md §11.1` 은 시각 containment 도입 이후의 치수·확장 표현을 담고 있는데 §11.2 결정("시각 containment 미사용")과 충돌하는 내용이 Planned 표기 없이 일부 노출된다; (2) `§12` Tool Area 인터랙션 본문은 기각된 디자인이나 섹션 경고 박스 외 추가 보호 없이 노출되어 있다. 두 항목 모두 문서 안에서 이미 인식된 상태로, 별도 Rationale 번복은 없다. 구현 착수 전 구현 스코프를 plan에서 명확히 한정하면 혼선을 피할 수 있다.

---

## 위험도

LOW
