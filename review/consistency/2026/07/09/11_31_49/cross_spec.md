<!-- main 이 journal(wf_5389c4d0-fd9)에서 복원 — subagent write 격리로 워크플로가 파일을 쓰지 못함 (feedback_subagent_write_isolation_worktree). 결과 자체는 journal 에 온전. -->

### 발견사항

- **[WARNING]** 요구사항 ID `EH-DETAIL-06` 이 영역 간 서로 다른 범위·완료 상태로 사용됨
  - target 위치: `spec/2-navigation/14-execution-history.md` §요구사항(EH-DETAIL 표) — `EH-DETAIL-06 | Preview 탭: Presentation 노드는 시각적 프리뷰, AI Agent 노드는 대화 내역 + 메시지별 상세, 일반 노드는 상태 요약 | 필수 | ✅`
  - 충돌 대상:
    - `spec/4-nodes/3-ai/1-ai-agent.md` §"v1 vs v2 경계" — "v2: ... 실행 이력 화면의 **cross-node thread view 재구성**(NodeExecution 분산 저장 derived view, N+1 회피 — **EH-DETAIL-06**)"
    - `spec/conventions/conversation-thread.md` §4 영속화 표 — "이 경로의 thread view 는 재구성 가능한 derived view(**EH-DETAIL-06**)"; §7 v2 로드맵 — "실행 이력 화면의 ConversationThread 크로스노드 뷰: **EH-DETAIL-06 과 함께 v2 UI spec 정의**"(= 아직 미정의); Rationale — "…실행 이력 view 용으로 **EH-DETAIL-06(v2 UI)에 위임한 미해결 과제**"
    - `spec/conventions/data-hydration-surfaces.md` — "ConversationThread 재구성 view | **EH-DETAIL-06** — 실행 이력의 thread 재구성"
  - 상세: `14-execution-history.md` 가 소유한 `EH-DETAIL-06`은 단일 실행 내 단일 노드(AI Agent) Preview 탭 표시를 가리키며 이미 **✅ 구현 완료**로 명시돼 있다. 반면 3개의 다른 spec 파일은 동일 ID를 **여러 노드에 걸친(cross-node) thread 재구성 뷰**라는 더 넓은/다른 범위로 지칭하며, 이를 "v2 UI spec 정의 필요", "미해결 과제"로 — 즉 **아직 설계도 되지 않은 미구현 항목**으로 다룬다. 코드 검색 결과 실제로 "cross-node thread 재구성" 구현은 존재하지 않아(그 이름의 grep 히트는 무관한 `cross-node-warning-rules.md`뿐) 이 넓은 스코프는 실제로 미구현 상태다. 하나의 ID가 (a) 이미 완료된 좁은 요구사항과 (b) 아직 미해결인 넓은 요구사항을 동시에 가리키는 셈이라, EH-ID를 근거로 상태를 판단하는 사람·도구(spec-coverage 등)가 "EH-DETAIL-06 = 완료"로 오판하거나 반대로 "미구현"으로 오판할 위험이 있다. `14-execution-history.md` 본문 어디에도 이 cross-node 확장이 같은 ID의 v2 하위 범위라는 교차 참조가 없다.
  - 제안: (a) `14-execution-history.md`의 EH-DETAIL-06 행에 "v1 = 단일 노드 Preview(완료). cross-node thread 재구성은 v2 별도 범위, 상세는 `conversation-thread.md §7`" 같은 명시적 각주를 추가하거나, (b) cross-node 재구성 항목에 새 요구사항 ID(예: `EH-DETAIL-06b` 또는 신규 `EH-DETAIL-12`)를 발급해 `conversation-thread.md`/`1-ai-agent.md`/`data-hydration-surfaces.md`의 참조를 그쪽으로 갱신 — 두 방법 중 하나로 ID-범위 불일치를 해소해야 한다. `project-planner`가 spec 갱신 시 처리 권장.

- **[INFO]** `14-execution-history.md` §1 "개요" 표가 slug 접두 표기를 생략
  - target 위치: `spec/2-navigation/14-execution-history.md` §1 개요 — "실행 내역 목록 | `/workflows/:id/executions`", "실행 상세 | `/workflows/:id/executions/:executionId`"
  - 충돌 대상: 같은 파일 상단 Overview(제품 정의) 문단 — "화면은 목록(`/w/<slug>/workflows/:id/executions`)과 상세(`.../:executionId`) 2단계로 구성한다" 및 `spec/2-navigation/_layout.md §2.2`의 "경로는 논리 경로이며 실제 URL 은 `/w/<slug>/…` 로 렌더된다" 컨벤션
  - 상세: `_layout.md`가 확립한 "표의 경로는 논리 경로, 실제 URL은 slug 접두"라는 컨벤션에 비춰보면 §1 표의 무-slug 표기는 관례적 허용 범위 내이지만, 같은 문서 Overview 문단이 이미 slug를 명시했던 것과 비교하면 바로 아래 §1 표에서 slug 캐벗을 다시 언급하지 않는 것은 문서 내 표기 일관성이 떨어진다. 실제 코드(`buildExecutionHref`)는 slug를 항상 붙이므로 기능적 충돌은 없다.
  - 제안: §1 표에 `1-workflow-list.md §2.6`처럼 "(활성 워크스페이스 slug 기준)" 각주를 붙이면 표기 일관성이 개선된다. 낮은 우선순위, 비차단.

### 요약
이번 `slug-routing-hardening-94580e` 브랜치의 실제 diff(`origin/main` 대비)는 `spec/` 변경 없이 프런트엔드 href 헬퍼 통합(`buildExecutionHref`)·safe-path 정규화 공용화·`workspace-store`↔`resolve-fallback` 순환참조 제거로 국한되며, 모두 `spec/2-navigation/_layout.md` §2.2·`9-user-profile.md` §3·`data-flow/12-workspace.md`가 이미 확립한 "URL slug = FE 라우팅 SoT ≠ backend 인가 SoT" 모델과 정확히 일치한다(오히려 대시보드 Recent Executions 행 클릭 등 기존에 slug를 누락하던 코드 버그를 이 하드닝이 수정함 — spec-compliance 개선). target으로 지정된 `spec/2-navigation/{0,1,10,11,13,14,15}.md`를 `0-overview.md`·`1-data-model.md`(Workspace.slug, Folder 제약, Execution re_run_of/chain_id/dry_run 등) 및 실제 저장소의 `_layout.md`·`9-user-profile.md`·`5-system/1-auth.md`·`5-system/13-replay-rerun.md`·`5-system/16-system-status-api.md`와 대조한 결과, 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 모두 정합했다. 유일하게 발견된 실질 이슈는 `EH-DETAIL-06` 요구사항 ID가 navigation 영역(완료로 표기)과 AI/conversation-thread 영역(v2 미해결 과제로 표기) 사이에서 범위·완료 상태가 어긋나는 pre-existing 드리프트이며, 금번 코드 변경과는 무관하지만 target 영역이 이 ID를 소유하는 만큼 명시적 조정이 필요하다.

### 위험도
LOW