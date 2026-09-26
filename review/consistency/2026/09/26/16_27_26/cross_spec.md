# Cross-Spec 일관성 검토 — spec-draft-ed-ai-19-status.md

## 검토 대상

`plan/in-progress/spec-draft-ed-ai-19-status.md` — `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행에
"미구현 — 계획" 표기 + `4-ai-assistant.md §12.2` 상대 링크를 붙이는 1행 사실 정정.

## 검증한 사실관계 (draft 의 근거)

- `spec/3-workflow-editor/_product-overview.md:190` ED-AI-19 원문·`:231` §10.9 인용·`:238` ED-AI-38 인용 — draft 서술과 일치.
- `spec/3-workflow-editor/4-ai-assistant.md:717` §12.2 — "**(계획)** … `ASSISTANT_WORKFLOW_RUNNING` … 아직 미구현" 원문 확인.
- `ASSISTANT_WORKFLOW_RUNNING` grep 0건 (`codebase/backend/src`, `codebase/frontend/src`) — 실측 재현.
- ED-DB-05 선례(`_product-overview.md:134`) 슬러그 규칙 대조 — "12.2 실행/디버깅" → `#122-실행디버깅` 앵커 생성 규칙(구두점 삭제 후 공백→하이픈)이 ED-DB-05 앵커(`#6-브레이크포인트-향후-로드맵--미구현`)와 동일 알고리즘으로 재현됨. 앵커 충돌 없음(`4-ai-assistant.md` 안에 "실행/디버깅" 제목 유일).
- `4-ai-assistant.md` frontmatter `status: implemented` (pending_plans 없음) — 본문 "(계획)" 항목은 §7(2개 에러코드)·§10(동시 세션 제한)·§12.2(본 건) 3곳으로 draft 의 "안 하는 것" 서술과 일치. `spec/conventions/spec-impl-evidence.md` §3 규약상 이 상태는 `status: partial` + `pending_plans` 대상이지만, draft 는 이를 명시적으로 스코프 밖으로 미루고 `--impl-prep` WARNING 3 트래커에 위임 — 규약과 어긋나지 않는 정당한 defer.

## 발견사항

- **[WARNING]** ED-AI-19 정정 후에도 "Workflow AI Assistant 전체 구현 완료" 라는 상위 요약 두 곳이 그대로 남아 3-way 로 어긋난다
  - target 위치: 없음(draft 는 `_product-overview.md` §10.4 행만 건드림, 아래 두 문서는 스코프 밖)
  - 충돌 대상:
    - `spec/0-overview.md` §6.1 "구현 완료(✅)" 표의 **Workflow AI Assistant** 행 — "에디터 내 채팅형 AI로 자연어 요청 → 노드·엣지 자동 구성. Clarify → Plan → Execute 3단계 대화 루프, SSE 스트리밍, 세션 영속" 을 무조건부로 ✅ 로 적고, `4-nodes/3-ai/_product-overview.md#36-workflow-ai-assistant` 로 링크
    - `spec/4-nodes/3-ai/_product-overview.md:5` "3.1~3.6의 AI 기능은 모두 **구현 완료(✅)** 다" · `:138` §3.6 헤더 바로 아래 "**구현 상태**: ✅ 구현 완료"
  - 상세: draft 가 적용되면 `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행은 "미구현 — 계획" 을 명시하게 되는데, 같은 기능(Workflow AI Assistant)을 가리키는 저장소 루트 진입 문서(`0-overview.md`, cross-cutting SoT)와 `4-nodes/3-ai/_product-overview.md` 는 여전히 무조건 "구현 완료" 로 남는다. 두 문서 모두 PRD §10(ED-AI-*)을 직접 인용·링크하므로, 독자가 어느 문서로 먼저 들어오느냐에 따라 같은 기능의 완성도에 대해 반대되는 답을 얻는다. 이는 이번 draft 가 고치려는 것과 **같은 범주의 결함**(구현 상태 표기 불일치)이며, 정정 폭이 좁아서 새로 만들어지는 게 아니라 기존에도 있었지만 draft 적용 후 대비가 더 뚜렷해진다(한쪽은 이제 명시적 "미구현", 다른 두 곳은 여전히 "전부 완료").
  - 제안: 이번 PR 의 스코프를 넓히기보다, `spec/0-overview.md §6.1` Workflow AI Assistant 행과 `spec/4-nodes/3-ai/_product-overview.md:5,138` 에도 ED-AI-19 미구현 각주(또는 최소한 "단, 실행 중 편집 거부 가드는 계획 단계" 각주)를 붙이는 후속 정정을 같은 `--impl-prep` WARNING 3 트래커(또는 신규 항목)에 등재할 것을 권고. 이 PR 자체를 막을 사유는 아님(원 `--impl-prep` 이 지적한 CRITICAL 은 §10.4 vs §12.2 한 쌍이었고 draft 는 정확히 그것만 닫는다).

- **[INFO]** 동일 요구사항 ID 계열을 건드리는 미착수 병렬 plan 존재
  - target 위치: 없음
  - 충돌 대상: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §2 체크리스트 — "AI Assistant 의 편집 도구 거부 정책(ED-AI-19 계열)에 영향 있는지 확인 — 현 위치는 `spec/3-workflow-editor/` 영역"
  - 상세: 이 plan 은 `worktree: (unstarted)` 로 아직 착수 전이며 ED-AI-19 자체를 수정하지 않고 "영향 확인"만 체크박스로 남겨 뒀다. 현재는 실제 충돌이 아니나, 두 plan 이 같은 요구사항 ID 를 서로 다른 시점에 건드릴 수 있으므로 향후 그 plan 착수 시 본 draft 의 정정(및 위 WARNING 의 후속 정정 여부)을 먼저 확인해야 한다.
  - 제안: 별도 조치 불필요. 해당 plan 착수자가 본 draft 병합 이후 상태를 다시 조회하도록 안내하는 정도로 충분.

## 요약

target 이 직접 수정하는 한 행(§10.4 ED-AI-19)의 사실관계·앵커·선례 형식은 모두 실측과 일치하며 새로운 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. 다만 같은 기능(Workflow AI Assistant)의 구현 완료 여부를 무조건부로 "전부 구현 완료"라고 서술하는 두 개의 다른 영역 문서(`spec/0-overview.md` §6.1, `spec/4-nodes/3-ai/_product-overview.md` 전역 요약과 §3.6)가 draft 정정 이후에도 그대로 남아, 이번 정정이 좁힌 모순을 저장소 전체 관점에서는 완전히 없애지 못한다 — 이 PR 을 막을 정도는 아니지만 후속 정정 대상으로 등재할 가치가 있다. 또한 미착수 병렬 plan 하나가 같은 요구사항 ID 계열을 건드릴 잠재 지점으로 존재함을 확인했다(현재는 비활성이라 충돌 아님).

## 위험도

LOW
