<!-- main 이 journal(wf_69efdc97-165)에서 복원 — subagent write 격리. -->

### 발견사항

- **[INFO]** 신규 v2 로드맵 항목이 `spec/0-overview.md` §6.3 로드맵 표에 미등재
  - target 위치: `plan/in-progress/spec-draft-eh-detail-06-id-split.md` §변경 1항 (신규 `EH-DETAIL-12` 행, `❌ (v2)`)
  - 충돌 대상: `spec/0-overview.md` §6.3 "로드맵 / 미구현" 표 (예: "Graph RAG 후속 (P2+)" 행이 `spec/5-system/10-graph-rag.md` 의 동일 패턴 — `status: implemented` 문서 내부 행 단위 `❌` 미구현 항목 — 을 상위 로드맵 표에도 반영한 선례)
  - 상세: `spec/5-system/10-graph-rag.md` 는 frontmatter `status: implemented` 를 유지하면서 표 안에 "P2+ (후속)…❌" 행을 두고, 이를 `0-overview.md §6.3` 에도 "Graph RAG 후속 (P2+)" 로 미러링해 로드맵 가시성을 준다. `EH-DETAIL-12` 도 동일 패턴(문서 status 는 `implemented` 유지, 행만 `❌ (v2)`)이지만 target 편집 범위(4개 파일)에는 `0-overview.md` 갱신이 없어, 이 v2 로드맵 항목이 최상위 로드맵 표에서는 보이지 않는다. 이는 회귀나 모순이 아니라 완결성 격차(gate 강제 대상도 아님 — `spec-status-lifecycle` 의 `backlog` id-in-overview 가드는 frontmatter `status: backlog` 문서에만 적용되고 `14-execution-history.md` 는 `implemented` 로 유지되므로 미해당).
  - 제안: 후속(선택) — `0-overview.md §6.3` 에 "실행 상세 cross-node ConversationThread 뷰 (EH-DETAIL-12, v2)" 한 줄 추가를 고려. target 이 "순수 spec 문서 정합화" 로 스코프를 명시적으로 좁혔으므로 이번 PR 범위 확대를 강제하지는 않음 — 별도 후속으로 defer 가능.

target 문서가 나열한 4개 편집 지점(`spec/2-navigation/14-execution-history.md:57`, `spec/4-nodes/3-ai/1-ai-agent.md:1156`, `spec/conventions/data-hydration-surfaces.md:72`, `spec/conventions/conversation-thread.md:215,294,296,347,417`)을 실제 저장소와 line-by-line 대조한 결과 전부 정확히 일치했다. `EH-DETAIL` 네임스페이스 전체를 `spec/**` 재귀 grep 했을 때 위 4개 파일 외 참조는 없었고(`codebase/**` 에도 없음), 신규 발급되는 `EH-DETAIL-12` 는 현재 어디에도 사용되지 않아 ID 충돌이 없다. `spec/conventions/spec-impl-evidence.md` 의 frontmatter-evidence 가드 관점에서도, `14-execution-history.md` 는 frontmatter `status: implemented` 를 그대로 유지하며 신규 행만 `❌ (v2)` 로 표시하는데, 이는 `spec/5-system/10-graph-rag.md`("P2+ (후속) … ❌")·`spec/5-system/7-llm-client.md` 에 이미 존재하는 선례와 동형이라 `spec-status-lifecycle`/`spec-pending-plan-existence` 등 어떤 build 가드도 촉발하지 않는다(`pending_plans:` 의무는 frontmatter `status: partial` 문서에만 적용되며 본 문서는 `implemented` 유지). `conversation-thread.md:417` 의 링크(`../2-navigation/14-execution-history.md`, anchor 없음)는 표시 텍스트만 바뀌고 대상 파일 경로가 그대로라 `spec-link-integrity` 위반도 없다. 이 target 은 사실 직전 cross_spec 리뷰(`review/consistency/2026/07/09/11_31_49/cross_spec.md`)가 제시한 두 해소안 중 옵션 (b)(신규 ID 발급)를 그대로 정확히 구현한 후속 조치로, 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 영역과 모순이 없다.

### 위험도
NONE