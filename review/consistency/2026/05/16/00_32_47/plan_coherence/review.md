### 발견사항

- **[CRITICAL]** 미해결 결정 우회 위험 — 옵션 A/B 미결 상태에서 구현 착수
  - target 위치: `backend/src/modules/knowledge-base/graph` (구현 착수 대상 전체)
  - 관련 plan: `plan/in-progress/kb-graph-stats-dead-path.md` §의사결정 필요 + §작업 단위 첫 항목 `[ ] 옵션 결정 (사용자 또는 dev 판단)`
  - 상세: plan 은 "옵션 A (emit 경로 수정 + spec reverse)" 와 "옵션 B (dead path 코드 제거)" 중 하나를 먼저 결정하도록 명시하고 있으며, 해당 체크박스가 미체크 상태다. 두 옵션은 구현 방향이 정반대이므로(A는 신규 메서드 도입·spec 갱신, B는 코드 삭제·spec 유지), 결정 없이 `backend/src/modules/knowledge-base/graph` 에 손을 대면 plan 이 "결정 필요" 로 남긴 항목을 일방적으로 해소하게 된다.
  - 제안: plan §의사결정 필요 의 세 가지 확인 사항(graph 통계 카드 갱신 경로 확인, `kb:reembed_started/finished` grep, 옵션 A·B 판단)을 먼저 수행하고 plan 의 첫 체크박스를 체크한 뒤 구현을 착수한다. 결정 후 plan 의 `worktree` 필드도 `dead-path-removal-2f1c8a` 로 갱신 필요.

- **[WARNING]** plan frontmatter `worktree` 미설정 — worktree 추적 불가
  - target 위치: 해당 없음 (plan 문서의 frontmatter)
  - 관련 plan: `plan/in-progress/kb-graph-stats-dead-path.md` frontmatter `worktree: (unassigned — dev 가 새 worktree 에서 처리)`
  - 상세: 현재 작업이 `dead-path-removal-2f1c8a` worktree 에서 이뤄지고 있음에도 plan 의 `worktree` 필드가 미설정 상태다. consistency-checker 의 worktree 충돌 검출이 이 plan 을 제대로 추적하지 못한다. 다른 worktree 가 동일 영역을 건드릴 때 경보가 누락될 수 있다.
  - 제안: plan 착수 시점에 `worktree: dead-path-removal-2f1c8a` 로 갱신.

- **[INFO]** 선행 의존 PR 은 이미 머지됨 — 선행 조건 충족
  - target 위치: `plan/in-progress/kb-graph-stats-dead-path.md` §의존성
  - 관련 plan: `plan/in-progress/kb-graph-stats-dead-path.md` "본 PR (`spec-pipeline-consistency-4c9e1f` → main) 머지 후에 처리 시작"
  - 상세: `spec-pipeline-consistency-4c9e1f` 가 commit `ffcdf3b0` 으로 main 에 머지되어 선행 조건이 충족된 상태다. 단 옵션 A 선택 시 본 PR 의 spec 변경 중 `kb:graph_stats_updated` 관련 부분을 reverse 해야 한다는 plan 주의 사항은 여전히 유효하다.
  - 제안: 현재 spec 상태(`spec-pipeline-consistency-4c9e1f` 의 변경 내용)를 재확인 후 옵션 결정에 반영.

- **[INFO]** `team-workspace-followups.md` 등 무관 plan 과의 교차 없음
  - 현재 `plan/in-progress` 의 나머지 plan 들(2fa-webauthn, ai-agent-tool-connection-rewrite, brand-refresh-impl, cafe24-*, marketplace-and-plugin-sdk 등)은 `backend/src/modules/knowledge-base/graph` 영역과 교차하지 않는다. cafe24-integration-a3f5e2 디렉토리가 존재하나 git worktree 로 등록되지 않아 활성 worktree 충돌은 없다.
  - 제안: 추적 메모 수준. 현재 활성 worktree 는 `dead-path-removal-2f1c8a` 단독이므로 병렬 경합 위험 없음.

### 요약

`backend/src/modules/knowledge-base/graph` 에 대한 구현 착수를 차단하는 핵심 문제는 `plan/in-progress/kb-graph-stats-dead-path.md` 가 "옵션 A(emit 경로 수정 + spec reverse) 대 옵션 B(dead path 제거)" 의 결정을 아직 내리지 않았다는 점이다. 두 경로는 구현 방향이 상반되어 결정 없이 코드를 건드리면 plan 의 미해결 결정을 일방적으로 우회하게 된다. 선행 PR(`spec-pipeline-consistency-4c9e1f`)은 이미 머지되어 기술적 선행 조건은 충족됐으므로, 옵션 결정 → plan 체크박스 체크 → worktree 필드 갱신 → 구현 착수 순서로 진행하면 된다.

### 위험도

HIGH
