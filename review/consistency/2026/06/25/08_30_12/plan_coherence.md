## 발견사항

- **[WARNING]** Phase 4 spec 갱신을 developer 가 직접 수행하는 절차 미명시
  - target 위치: `plan/in-progress/web-chat-preview-improvements.md` § "Phase 4 — Spec 갱신 (정식 phase)"
  - 관련 plan: 없음 (CLAUDE.md 규약)
  - 상세: 타겟 plan 의 Phase 4 는 `spec/5-system/14-external-interaction-api.md` 와 `spec/7-channel-web-chat/5-admin-console.md` 를 직접 갱신하는 작업을 "정식 phase" 로 포함한다. CLAUDE.md 규약상 `spec/` 변경은 `project-planner` 권한이며, `developer` 는 `spec/` read-only 다. plan 에 "project-planner 위임" 언급이 없어 실행 단계에서 역할 위반이 발생할 수 있다. (spec_impact frontmatter 는 선언되어 있으나 위임 절차가 기술되어 있지 않음.)
  - 제안: Phase 4 에 "spec 갱신은 project-planner 위임 또는 developer 가 spec 변경 필요 시 멈추고 project-planner 에 위임" 문구를 추가. 또는 본 plan 이 developer+planner 혼합 역할임을 frontmatter `owner: planner/developer` 로 명시.

- **[INFO]** `fix-webchat-sse-field-map.md` 비차단 followup 과 EIA spec 동일 파일 수정 예정 중복
  - target 위치: `plan/in-progress/web-chat-preview-improvements.md` § "Phase 4" §1 — `spec/5-system/14-external-interaction-api.md` SSE 이벤트 목록에 `execution.message` 추가
  - 관련 plan: `plan/in-progress/fix-webchat-sse-field-map.md` § "비차단 followup" W-1/I-1 ("추상 블록 자체를 wire 로 교체하는 정식 EIA 이슈는 backlog.")
  - 상세: 두 plan 이 모두 `spec/5-system/14-external-interaction-api.md` 의 SSE 이벤트 표현 관련 부분에 각자의 변경을 예정하고 있다. `fix-webchat-sse-field-map` 의 W-1 은 §6.2 추상 jsonc 블록 교체를 backlog 으로 두었고, 타겟 plan 은 SSE 이벤트 mapping 표(§6.6)에 `execution.message` 행을 추가한다. 내용적 충돌은 없으나(각자 독립 변경 구간), 머지 순서에 따라 해당 spec 파일 rebase 충돌 가능성이 있다.
  - 제안: spec 갱신 시 §6.2 추상 블록 영향 구간을 피해 §6.6 mapping 표에만 변경 적용. 충돌 발생 시 두 변경 내용은 모두 보존(의미 독립). 추가 plan 갱신 불요.

- **[INFO]** `execution.message` 를 EIA-NX-02 outbound notification 화이트리스트에 추가하지 않는 결정의 plan 내 명시는 충분
  - target 위치: `plan/in-progress/web-chat-preview-improvements.md` § "결정/주의" — "outbound webhook notification 화이트리스트(notification-fanout)는 건드리지 않음"
  - 관련 plan: 없음 (EIA spec EIA-NX-02 기존 결정)
  - 상세: EIA spec EIA-NX-02 는 outbound notification webhook 의 구독 이벤트를 5종으로 고정한다. 타겟 plan 이 `execution.message` 를 SSE 표면에만 추가하고 notification webhook 화이트리스트는 불변으로 명시한 것은 기존 결정과 충돌하지 않는다. EIA spec 기존 mapping 표의 `execution.node.completed` 가 "Outbound notification: —" 패턴을 선례로 가지고 있어 구조적으로 일관된다.
  - 제안: 현황 유지. Phase 4 spec 갱신 시 mapping 표에 `execution.message | execution.message | —` 행을 추가하면 충분.

## 요약

`plan/in-progress/web-chat-preview-improvements.md` 는 미해결 결정과의 충돌이나 선행 plan 미해소 문제 없이 잘 정의된 구현 계획이다. 주요 설계 결정(execution.message SSE-only, notification 화이트리스트 불변, chat-channel 중복 렌더 없음)은 기존 plan 및 spec 과 정합한다. WARNING 1건은 Phase 4 의 spec 갱신 책임 소재가 plan 내에 명시되지 않아 실행 단계에서 역할 규약 위반이 발생할 수 있는 절차적 갭이며, plan 에 project-planner 위임 문구를 추가하거나 owner 를 혼합 역할로 명시해 해소할 수 있다.

## 위험도

LOW
