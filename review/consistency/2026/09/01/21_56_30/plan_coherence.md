# Plan 정합성 검토 — `spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[INFO]** "판단 기준" 결정의 SoT 이원화 — target 이 자신이 지적한 문제를 스스로 반복
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` §"판단 기준은 이번에
    안 쓴다 — 결정으로 남긴다" (Rationale 하위, "결정: 이번에는 병기만 한다" 문단 전체)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 체크리스트
    `- [x] "판단 기준을 함께 적을지"에 대한 답 (2026-09-01)` 항목
  - 상세: 두 문서가 **거의 동일한 전문**(ARCH#5 ⑤ 가 "의식적 이탈"·"해석의 여지가 있다" 고
    유보를 남겼다는 근거, "유보 중인 결정을 기준으로 승격시키면 다음 사람은 유보를 못 보고
    규약만 본다" 는 논리, "세 번째 자매 const 가 생길 때" 재개 신호)를 나란히 담고 있다.
    target 자신이 바로 그 옆 문장에서 "같은 결정을 두 문서에 나란히 적으면 한쪽만 갱신되는
    자리가 생긴다(2차 `rationale_continuity` INFO #3)" 라고 이 위험을 명시하면서도, 정작 그
    문단 자체가 포인터가 아니라 전문 복제다. 두 문서 중 하나가 나중에 갱신되면(예: RETRY_*
    유보가 닫히거나 재개 신호가 발동) 다른 한쪽이 stale 로 남을 위험이 그대로 남는다.
  - 제안: target 의 해당 문단을 "결정: 이번에는 병기만 한다. 근거·재개 신호는
    `spec-conventions-engine-error-code-surface.md` 체크리스트 참조" 수준의 짧은 포인터로
    줄이거나, 반대로 source plan 쪽 체크리스트 항목을 포인터로 줄이는 쪽으로 한쪽만 SoT 를
    유지할 것. 두 문서 모두 developer/consistency-checker 가 아니라 project-planner 손을
    거치므로 이번 반영 시 바로 정리 가능.

- **[INFO]** 같은 spec 파일(`error-codes.md`)을 동시에 겨누는 별도 in-progress plan — 상호
  참조 없음
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` §변경 제안
    (§Overview "적용 범위" 문단만 편집 범위로 선언)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    "추가 위임 (2026-07-25 #4)" (1) 및 "#6 보강 (5)" — `error-codes.md §3` 예외 레지스트리에
    `AbortError` 를 historical-artifact 로 등재하자는 미해결 위임(체크박스 없이 서술만 있고
    아직 이행 안 됨)
  - 상세: 두 plan 모두 `spec/conventions/error-codes.md` 를 `spec_impact` 로 갖고 둘 다
    `in-progress` 다. target 은 §Overview 한 문단만, 다른 plan 은 §3 예외 레지스트리 행 추가를
    각각 겨눠 **텍스트 충돌 가능성은 낮지만**, 두 plan 이 서로를 인지하지 못한 채 별도
    project-planner 턴에서 같은 파일을 두 번 편집하게 된다 — 어느 한쪽이 먼저 머지되면 다른
    쪽의 diff 는 그 갱신 이후 파일을 기준으로 재확인해야 하는데 그 사실이 어느 plan 에도
    적혀 있지 않다.
  - 제안: 필수는 아니나, target(또는 source plan) 의 "관련" 절에
    `spec-update-node-cancellation-shutdown-classification.md` 의 §3 위임 항목을 포인터로
    남겨두면 두 plan 중 나중에 착수하는 쪽이 먼저 반영된 diff 를 놓치지 않는다.

- **[INFO]** "세 번째 자매 const" 재개 신호가 이미 조건부로 성립해 있을 수 있다
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` §"판단 기준은
    이번에 안 쓴다" 마지막 문장 — "**재개 신호는 '세 번째 자매 const 가 생길 때'** 다.
    (`WsErrorCode` 가 그 세 번째인지는 재개 시점에 함께 판정한다.)"
  - 관련 plan: 없음(어느 in-progress plan 도 이 판정을 등재하지 않음) — 실측:
    `codebase/backend/src/modules/websocket/ws-error-codes.ts` 에 `WsErrorCode` 가 **이미
    존재**하며, 그 JSDoc 이 스스로 "node-handler `output.error.code`(`nodes/core/error-codes.ts`)
    및 retry 도메인 코드(같은 `ErrorCode` enum)와는 **계층이 다르다**" 고 명시해, 지금 target 이
    논하는 "중앙 enum 확장 vs 자매 const" 축과 정확히 같은 질문을 이미 스스로 답한 상태다.
  - 상세: target 은 이 판정을 미래(재개 시점)로 미루면서도 판정 자체를 유보한다고 정직하게
    적어 두었다 — 이는 오류라기보다 판단을 열어둔 것이라 CRITICAL/WARNING 은 아니다. 다만
    "세 번째가 생기면" 이라는 조건이 사실은 **이미 존재할 수도 있는 사실**이고, 확인 비용이
    grep 한 번이라 지금 판정해 두면 다음 재개 세션이 같은 조사를 반복하지 않는다(이 저장소가
    반복적으로 겪은 "재개 신호를 다음 사람이 다시 조사하게 만드는" 패턴과 같은 클래스).
  - 제안: 필수 아님. 다음에 이 plan 을 재개할 때(또는 이번 반영 시) `WsErrorCode` 가 (a) 다른
    파일이라 "같은 파일의 자매 const" 논지 밖인지 (b) 그럼에도 "central enum vs sibling const"
    질문의 세 번째 사례로 셀지 한 줄만 판정해 두면 재개 신호의 모호성이 사라진다.

## 요약

target(`spec-draft-error-code-two-surfaces.md`)은 착수 근거 plan
(`spec-conventions-engine-error-code-surface.md`)이 미해결로 남긴 "판단 기준을 함께 적을지"
질문에 대해 **같은 결정(이번엔 병기만 한다)** 을 내리고 있어 충돌은 없다 — 오히려 두 문서가
같은 날짜(2026-09-01)에 같은 답을 나란히 기록한 것을 확인했다. 4 라운드에 걸친 자기 수정
이력(목적지 필드 매핑 → 공존 명시 → 층 이분법 → 존재·자매·key-disjoint 만)도 각 라운드의
반박 근거를 실측과 함께 정확히 인용하고 있어 내적 일관성이 높다. §3 예외 레지스트리 각주
언급·후속 drift 2건(`1-data-model.md:474`, `3-error-handling.md §1.4`)의 별도 planner 턴
위임도 실제 파일 내용과 대조해 정확했다. 다만 (1) target 자신이 지적한 "결정 중복" 위험이
실제로 해소되지 않은 채 남아 있고, (2) 같은 spec 파일을 동시에 겨누는 다른 in-progress plan
(`spec-update-node-cancellation-shutdown-classification.md`)과 상호 참조가 없으며, (3) 재개
조건("세 번째 자매 const")이 이미 조건부로 성립해 있을 수 있는데 판정을 미뤄 두었다 — 세
항목 모두 결정 자체를 뒤집을 근거는 아니라 INFO 로 등재한다.

## 위험도
LOW
