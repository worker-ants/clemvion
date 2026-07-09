# Cross-Spec 일관성 검토 결과

대상: `spec/2-navigation/` (--impl-done, diff-base=origin/main) — "워크스페이스 슬러그 라우팅 phase 2: 에디터 slug화" (`(editor)/workflows/[id]` → `(editor)/w/[slug]/workflows/[id]`)

## 검토 방법

실제 diff(`git diff origin/main -- spec/`)를 직접 조회해 이번 변경이 건드린 7개 파일 전부(`spec/2-navigation/0-dashboard.md`·`1-workflow-list.md`·`14-execution-history.md`·`9-user-profile.md`·`_layout.md`, `spec/3-workflow-editor/2-edge.md`, `spec/data-flow/12-workspace.md`)를 확인하고, 관련 코드(`(editor)/w/[slug]/layout.tsx`, `(main)/w/[slug]/layout.tsx`, `workspace-slug-gate.tsx`)와 plan(`plan/in-progress/editor-slug-phase2.md`)을 worktree 절대경로로 대조했다. 이번 변경은 라우팅 표기(prose)만 갱신하는 좁은 diff라 cross-spec 충돌 표면이 작다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 참고용 INFO 1건뿐이다.

- **[INFO]** "Phase 2" 용어가 여러 무관 영역에서 재사용됨
  - target 위치: `spec/2-navigation/0-dashboard.md`("슬러그 라우팅 phase 2"), `spec/2-navigation/9-user-profile.md §3`, `spec/2-navigation/_layout.md`, `spec/2-navigation/1-workflow-list.md §2.6`, `spec/2-navigation/14-execution-history.md`, `spec/data-flow/12-workspace.md`
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md`(AI Assistant self-verify "Phase 2"), `spec/5-system/4-execution-engine.md`("Phase 2 cont" — errorPolicy continue 확장), `spec/5-system/13-replay-rerun.md §15`("향후 확장 Phase 2 후속"), `spec/5-system/6-websocket-protocol.md`(continuation-queue "Phase 2" 라우팅 원칙)
  - 상세: "Phase 2"라는 동일 문자열이 최소 4개의 서로 무관한 로드맵(AI 어시스턴트 self-verify 단계, 실행 엔진 errorPolicy continue 확장, replay-rerun 향후 확장, 슬러그 라우팅)에서 각각 다른 의미로 쓰인다. 실제 충돌은 아니다 — 모든 인스턴스가 도메인 한정어("슬러그 라우팅 phase 2", "AI assistant Phase 2" 등)를 동반해 문맥상 모호하지 않고, 개발자 plan(`plan/in-progress/editor-slug-phase2.md` "주의" 절)도 "spec 의 Phase 2(ai-assistant verify·실행엔진 단계)는 slug phase 2 와 무관 — 혼동 금지"라고 이미 명시적으로 인지·기록했다. 다만 향후 `grep -rn "Phase 2"` 같은 전역 검색 시 실무자가 잘못된 파일을 열어볼 여지는 여전히 있다.
  - 제안: 조치 불요(이미 완화됨). 굳이 강화하려면 이번 기능처럼 짧고 반복 참조되는 로드맵 라벨에는 "슬러그 라우팅 phase 2"처럼 매번 도메인 접두어를 붙이는 관례를 `spec/conventions/`에 명문화할 수 있으나, 현재도 실질적으로 그렇게 쓰이고 있어 우선순위는 낮다.

## 교차 검증 상세 (참고용, 발견사항 아님)

다음 항목들은 실제로 점검했고 충돌이 없음을 확인했다:

1. **데이터 모델**: `Workspace.slug` 필드 정의(`spec/1-data-model.md §2.2`, "URL 슬러그")는 이번 변경으로 손대지 않았고, `data-flow/12-workspace.md`의 "slug 불변" 규칙과도 그대로 일치한다.
2. **API 계약**: 이번 변경은 FE 라우팅(prose)만 바꾸며 어떤 REST endpoint·request/response shape 도 건드리지 않는다. `plan/in-progress/editor-slug-phase2.md`도 "backend 무변경(X-Workspace-Id 헤더·header-first 인가 불변)"으로 명시.
3. **요구사항 ID**: 새 요구사항 ID 부여 없음(경로 표기 정정뿐).
4. **상태 전이**: 워크플로우/실행 등 도메인 엔티티 상태 머신에 영향 없음.
5. **권한(RBAC)**: `9-user-profile.md §3`·`data-flow/12-workspace.md`가 "URL slug = FE 라우팅 SoT ≠ backend 인가 SoT(header-first→토큰 클레임 불변)"를 명시적으로 재확인했고, 코드(`workspace-slug-gate.tsx`)의 "무효/비멤버 slug → default 워크스페이스 redirect는 UX 편의이며 인가 경계가 아니다(유일 강제 지점은 backend RolesGuard 403)" 주석도 동일 표현으로 정합한다. 에디터 라우트가 `(main)/w/[slug]`와 동일한 `<WorkspaceSlugGate>`를 공유하도록 구현돼 있어 두 route group 간 gate 로직 이원화로 인한 RBAC 드리프트 위험도 없다.
6. **계층 책임**: `(editor)/w/[slug]/layout.tsx`는 gate 로직을 공용 컴포넌트에 위임하고 `EditorContent` chrome만 자신이 유지하며, `(main)/w/[slug]/layout.tsx`는 사이드바+`MainContent` chrome만 유지 — chrome 분리와 gate 공유라는 기존 계층 분할 결정(phase 1)을 그대로 계승한다.
7. **spec 간 동시 갱신 완결성**: 이번 diff가 건드린 6개 spec 파일(`0-dashboard.md`·`1-workflow-list.md`·`14-execution-history.md`·`9-user-profile.md`·`_layout.md`·`data-flow/12-workspace.md`) + `3-workflow-editor/2-edge.md`(code frontmatter) 전부가 "에디터 = slug 밖(phase 1)" → "에디터도 slug 편입(phase 2)"으로 원자적으로 갱신됐음을 확인했다. `grep -rn "phase 1" spec/ | grep 에디터`, `grep -rn "app/(editor)/workflows/\[id\]" spec/` 등으로 stale 잔존 참조(구 경로·구 phase 서술)가 없음을 재확인했다. `spec/3-workflow-editor/0-canvas.md`·`_product-overview.md`는 애초에 라우트 경로를 서술하지 않는 문서라 갱신 대상이 아니다(누락 아님).

## 요약

이번 target 변경("슬러그 라우팅 phase 2 — 에디터 slug화")은 `spec/2-navigation/` 6개 파일 + 인접 2개 파일(`3-workflow-editor/2-edge.md` code 참조, `data-flow/12-workspace.md` reconcile rationale)에 걸쳐 "에디터도 URL slug 라우팅에 편입됐다"는 사실을 원자적으로 반영했고, 실제 diff를 전수 대조한 결과 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과의 모순을 발견하지 못했다. backend 인가 모델(header-first)과 "URL slug ≠ 인가 SoT" 원칙이 모든 관련 문서에서 일관되게 재확인되고, phase 1에서 확립된 chrome/gate 계층 분리도 그대로 유지된다. 유일한 참고사항은 "Phase 2"라는 로드맵 라벨이 AI 어시스턴트·실행 엔진·replay-rerun 등 무관한 영역에서도 재사용된다는 INFO 수준의 용어 중복이며, 이미 plan 문서에 혼동 방지 주의사항으로 기록돼 있어 추가 조치는 불필요하다.

## 위험도

NONE
