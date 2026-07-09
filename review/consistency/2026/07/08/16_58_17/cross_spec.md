# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep)

## 발견사항

- **[WARNING]** `Workspace.slug` 유일성(UNIQUE) 미명시 — 임박한 slug 기반 URL 라우팅과 충돌 위험
  - target 위치: `spec/2-navigation/10-auth-flow.md` §6.2 (첫 워크스페이스 자동 생성 규칙) — `Workspace.slug = 사용자 이메일 로컬 파트 + 랜덤 4자리 (예: gehrig-a1b2)`
  - 충돌 대상: `spec/1-data-model.md` §2.2 Workspace 엔티티 — `slug | String | URL 슬러그` (제약 조건 섹션 없음, UNIQUE 표기 없음)
  - 상세: `1-data-model.md`는 자연키 성격의 필드에는 예외 없이 명시적으로 유일성을 표기한다 — `User.email`은 인라인으로 "고유"라고 적혀 있고(§2.1), `Folder`(`(workspace_id, parent_id, name)` UNIQUE, §2.5), `Integration.name`(`UNIQUE(workspace_id, name)`, §2.10), `WorkflowTestDataset.name`(`(workflow_id, owner_id, name)` UNIQUE, §2.13.3), `RefreshToken.token_hash`(UNIQUE, §2.18.1) 모두 별도 "제약 조건"/"제약" 절이나 인라인 표기로 유일성을 명시한다. 반면 `Workspace.slug`는 "URL 슬러그"라고만 적혀 있고 유일성 표기가 전혀 없다. `plan/in-progress/workspace-slug-routing.md`(잠긴 결정)는 URL slug 를 "FE 라우팅 SoT"로 채택하고 `/w/<slug>/...`가 정확히 한 워크스페이스로 해소됨을 전제로 layout 해소·멤버십 검증·`switchWorkspace`를 설계한다. 그런데 (a) 개인 워크스페이스 slug 생성 규칙("이메일 로컬 파트 + 랜덤 4자리")은 충돌 검사/재시도 로직이 문서화돼 있지 않고, (b) 팀 워크스페이스 slug 생성 규칙은 `spec/2-navigation/9-user-profile.md` §4 어디에도 명시돼 있지 않으며(`team-alpha` 목업만 "읽기 전용"으로 표시), (c) plan 문서가 언급하는 `team-<uuid8>` 포맷도 현재 spec 어디에도 등장하지 않는다. 이 상태로 구현에 들어가면 "slug→workspace" 조회가 DB 레벨에서 다중 행을 반환할 수 있는 잠재 결함이 spec 에 그대로 남는다 — 워크스페이스 격리 회귀(#859 계열)와 같은 민감한 영역이라 조기에 명시적으로 닫아야 한다.
  - 제안: `1-data-model.md` §2.2 Workspace 에 `slug UNIQUE` 제약을 명시(마이그레이션 필요)하고, `10-auth-flow.md` §6.2 및 `9-user-profile.md` §4(팀 워크스페이스 생성)의 slug 생성 규칙에 충돌 시 재시도/증가 로직을 명문화한다. `plan/in-progress/workspace-slug-routing.md`의 "spec 정합(planner)" 항목(§8)에 이 유일성 갭 반영을 추가하는 것을 권장 — 현재 plan 은 "slug 불변"만 다루고 "slug 유일성"은 별도로 짚지 않았다.

- **[INFO]** `/docs` 캐치올 동적 세그먼트명 `[...slug]` 이 신규 워크스페이스 `[slug]` 세그먼트와 이름 충돌 — 이미 plan 에서 인지된 리네임이 target 문서에는 아직 반영 안 됨
  - target 위치: `spec/2-navigation/13-user-guide.md` frontmatter `code:` (`codebase/frontend/src/app/(main)/docs/[...slug]/page.tsx`) 및 §3 라우트("단일 catch-all `/docs/[...slug]`")
  - 충돌 대상: `plan/in-progress/workspace-slug-routing.md` 상단 요약("`[...slug]`→`[...path]` 리네임(워크스페이스 `[slug]` 와 충돌 회피)") — `/docs`가 `(main)/w/[slug]/docs/...` 하위로 이동하면 같은 라우트 트리 안에 `slug`라는 동적 파라미터명이 두 레벨에서 중복돼 Next.js 파라미터 충돌이 발생하므로 plan 은 이미 `[...path]`로 리네임하기로 결정했다.
  - 상세: target(`13-user-guide.md`)은 여전히 옛 파일 경로·라우트 표기(`[...slug]`)를 SoT로 서술하고 있어, 구현 시 코드 리네임과 spec 문서가 즉시 어긋나게 된다. 두 "slug"(문서 콘텐츠 slug vs 워크스페이스 URL slug)가 같은 이름을 쓰는 것 자체는 현재는 문제 없으나(아직 `/w/[slug]`가 존재하지 않음), 이번 구현 착수 이후에는 즉시 stale 해질 항목이다.
  - 제안: `developer`가 `(main)/docs/[...slug]` → `[...path]` 리네임을 수행하는 PR 에서 `13-user-guide.md`의 frontmatter `code:` 경로와 §3/§6/§12 본문의 `[...slug]` 표기를 함께 갱신(또는 `project-planner`에게 후속 위임)하도록 plan 의 "spec 정합(planner)" 체크리스트(§8)에 `13-user-guide.md` 항목을 추가 권장.

- **[INFO]** Dashboard "Active" 카드 설명이 `Workflow.is_active`와 `Trigger.is_active`를 혼용하는 것처럼 읽힘
  - target 위치: `spec/2-navigation/0-dashboard.md` §3 요약 카드 — `Active | 활성 워크플로우 수 | isActive = true 인 워크플로우 개수 (트리거가 활성화된 워크플로우)`
  - 충돌 대상: `spec/1-data-model.md` §2.4 Workflow(`is_active: Boolean`, "활성 상태")와 §2.8 Trigger(`is_active: Boolean`, "활성 상태") — 두 엔티티가 각각 독립된 `is_active` 필드를 갖는다
  - 상세: 카드 정의 자체는 `Workflow.is_active` 필드를 정확히 참조하지만, 괄호 설명("트리거가 활성화된 워크플로우")이 마치 이 카운트가 Trigger 엔티티의 활성 상태를 집계하는 것처럼 읽혀 두 엔티티의 경계가 문서상 흐려진다. `1-workflow-list.md` §2.6("비활성 시 트리거/스케줄 중지")도 Workflow↔Trigger 캐스케이드를 암시하지만, `1-data-model.md`는 이 캐스케이드 관계를 어디에도 명시하지 않는다(§2.9.1은 Trigger↔Schedule 동기화만 문서화).
  - 제안: `0-dashboard.md` 괄호 설명을 "워크플로우 자체의 활성 상태(트리거 발화 여부를 게이팅)"처럼 `Workflow.is_active`를 1차 필드로 명확히 하거나, 캐스케이드 동작(Workflow 비활성화 → 하위 Trigger/Schedule 비활성화)을 `1-data-model.md`에도 명문화해 두 곳의 서술을 정합시킨다. 낮은 우선순위 — 기능 동작 자체에 영향은 없다.

## 방법론 참고 (제약)

`prompt_file`은 토큰 예산 때문에 `spec/2-navigation/` 전체가 아니라 일부 파일(`0-dashboard`, `1-workflow-list`, `10-auth-flow`, `11-error-empty-states`, `13-user-guide`, `14-execution-history`, `15-system-status`, `16-agent-memory` 일부)과 비교 대상(`0-overview.md`, `1-data-model.md`)만 포함했다. `_layout.md`·`9-user-profile.md`·`4-integration.md` 등은 payload 밖이라, 이를 직접 파일시스템에서 열람해 교차검증했다(§3 "워크스페이스 전환" = 사이드바 팝업 메뉴이지 별도 화면이 아님을 확인 — `0-overview.md` §6.1의 "프런트엔드 UI(워크스페이스 전환)" 서술과 `11-error-empty-states.md` Rationale의 "워크스페이스 선택/전환 화면 없음" 서술은 "팝업 컴포넌트" vs "전용 화면"으로 층위가 달라 실제로는 상충하지 않음 — 오탐 후보였으나 기각). `plan/in-progress/workspace-slug-routing.md`(결정 잠금 완료)도 함께 확인해 이미 해소된 gap(slug 불변, reconcile 방향, proxy.ts 미들웨어 존재)은 재보고하지 않았다.

## 요약

`spec/2-navigation/` 대상 파일들은 서로 매우 촘촘하게 상호 참조되어 있고(각 문서의 Rationale 절이 결정 근거를 명시적으로 추적), `spec/0-overview.md`·`spec/1-data-model.md`와의 직접적 모순은 거의 없다. 다만 임박한 워크스페이스 슬러그 URL 라우팅 구현(`plan/in-progress/workspace-slug-routing.md`, 결정 잠금 완료)과 맞물려, 데이터 모델이 `Workspace.slug`의 유일성을 명시하지 않는 기존 갭이 라우팅 정확성·격리 안전성에 실질적 리스크로 부상한다 — 이 문서 집합의 다른 모든 자연키 필드가 예외 없이 유일성을 명시하는 패턴과 대비되어 더욱 두드러진다. 그 외에는 `/docs` 동적 세그먼트명 충돌(이미 plan 에서 인지, target 문서 미반영)과 Dashboard Active 카드의 경미한 서술 모호성 정도로, 구현을 막을 직접적 모순은 발견되지 않았다.

## 위험도

MEDIUM
