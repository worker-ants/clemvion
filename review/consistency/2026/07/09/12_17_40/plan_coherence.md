### 발견사항

- **[INFO]** EH-DETAIL-12 도입 이후 향후 참조는 신규 ID로 향해야 함 (선제 안내)
  - target 위치: `plan/in-progress/spec-draft-eh-detail-06-id-split.md` — "변경 (해소안: ID 분리)" 전체
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md`, `plan/in-progress/node-output-redesign/README.md`, `plan/in-progress/ai-agent-tool-connection-rewrite.md` (§의존성·리스크 "conversation-thread 와의 정책 의존")
  - 상세: 위 in-progress plan 들은 `conversation-thread.md` 의 "v2 로드맵"·"ConversationThread 정책"을 일반 텍스트로 참조하지만 `EH-DETAIL-06` ID 자체는 인용하지 않는다 (repo 전체 grep 확인 — `plan/in-progress/**` 안에서 `EH-DETAIL-06`을 언급하는 문서는 target 자신뿐). 따라서 이번 ID 분리로 즉시 stale 해지는 in-progress plan 항목은 없다. 다만 cross-node ConversationThread 재구성(v2) 을 실제로 착수하는 후속 plan이 신설되면, 그 plan은 `EH-DETAIL-06`이 아니라 신규 `EH-DETAIL-12`를 인용해야 한다 — target 문서에는 이 안내가 명시돼 있지 않다.
  - 제안: target Rationale 또는 배경 절에 "향후 cross-node ConversationThread 재구성 착수 plan은 `EH-DETAIL-12`를 인용할 것" 한 줄만 추가하면 후속 착수자의 혼동을 예방(강제 아님, 차단 사유 아님).

### 요약

target(`spec-draft-eh-detail-06-id-split.md`)은 완료된 `plan/complete/slug-routing-hardening.md`가 명시적으로 위임한 후속 과제(`task_fa5d4e34`, "EH-DETAIL-06 요구사항 ID 범위 드리프트 → project-planner")를 그대로 이행하며, 그 위임의 근거인 `review/consistency/2026/07/09/11_31_49/cross_spec.md` WARNING이 제시한 두 대안((a) 각주 / (b) 신규 ID 발급) 중 (b)를 선택해 명확한 Rationale로 정당화한다 — project-planner 권한 범위 내의 판단이며 사용자 합의가 필요한 제품 결정이 아니다. `plan/in-progress/**` 전체를 grep한 결과 `EH-DETAIL-06` ID를 참조하는 다른 진행 중 plan은 없으며(target 자신 제외), `conversation-thread.md`/`ai-agent.md`/`data-hydration-surfaces.md`의 인용 라인 번호도 현재 spec 파일 상태와 정확히 일치한다. `execution-history.md`의 특정 라인을 인용하는 다른 in-progress plan도 없어 신규 행 삽입으로 인한 후속 참조 파손도 없다. 결론적으로 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 중 어느 것도 발견되지 않았고, 위 INFO는 향후 착수자를 위한 선제 안내에 불과하다.

### 위험도
NONE
