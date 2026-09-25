---
title: spec draft — Personal 통합 소유자 강제 (§8 판정 규칙 · 부분 구현 표기)
status: in-progress
owner: planner
worktree: integration-personal-owner
spec_impact:
  - spec/2-navigation/4-integration.md
started: 2026-09-25
---

# spec draft — Personal 통합 소유자 강제

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «personal-scope 통합의 «본인 것만» 소유자 검증이 코드에
없다» (planner 결정 + developer) 의 planner 몫. 구현은 같은 PR 의 developer plan `plan/in-progress/integration-personal-owner.md` 가
한다 — spec 이 현재형으로 적는 규칙을 같은 PR 이 구현해야 `--spec` 이 미구현 서술로 막지 않는다(`#1399` 선례).

## 배경 — 실측 (2026-09-25)

`spec/2-navigation/4-integration.md §8` 은 Personal 통합을 조회 · 수정 · Reauthorize · Rotate · Scope 추가 · 삭제 · 노드 사용 전부
«본인 것만» 으로 적는다. `spec/5-system/1-auth.md §3.2` RBAC 표도 `Integration (Personal) | 자기 것 ×4`. 코드(`modules/integrations/**`)는
어디서도 `created_by` 를 보지 않는다:

| 경로 | spec (Personal / Org) | 코드 |
| --- | --- | --- |
| 목록 · 상세 · 사용처 · 활동 · 연결 테스트 | 본인 것만 / 모든 멤버 | 워크스페이스 멤버 전원이 남의 personal 까지 |
| 별칭 수정 · 삭제 | 본인 것만 / Admin 이상 | `@Roles('editor')` 뿐 — scope 무관 |
| Rotate | 본인 것만 / Admin 이상 | Org → Admin 만 확인, personal 소유자 미검사 |
| Scope 추가 요청 | 본인 것만 / Admin 이상 | 라우트 역할 없음, Org → Admin 만 확인 |
| Reauthorize | 본인 것만 / Admin 이상 | **역할 검사 없음 — Viewer 도** |
| `oauth/begin` `reauthorize`·`request_scopes` 모드 | (위 두 행과 같아야 함) | `integrationId` 를 받기만 하고 검사 없음 — `:id` 경로 우회 입구 |
| scope 전환 | — / Admin 이상 | Admin 이면 남의 personal 도 organization 으로 공유 가능 |
| precheck(cafe24 · makeshop) | — | 충돌 행이 누구 것이든 `existingIntegrationId` · `existingName` 노출 |
| 워크플로우 어시스턴트 통합 목록 · 노드 후보 | — | 남의 personal 포함 |
| 노드에서 사용 | 본인 것만 / 모든 멤버 | 실행 엔진은 워크스페이스만 봄 · 노드 저장도 검증 없음 |

reauthorize 의 OAuth 콜백은 `credentials` 를 통째로 교체한다(`spec/data-flow/5-integration.md §1.2` 시퀀스 노트) — Viewer 가 Organization
통합을 자기 외부 계정으로 바꿔치기할 수 있다.

## 사용자 결정 (2026-09-25, 선택지 셋을 제시)

1. **범위**: 쓰기 + 읽기를 함께 닫고, 노드 실행 시점 검사는 후속. (기각: «쓰기 경로만 먼저», «§8 전부 한 PR»)
2. **남의 personal 접근 응답**: 404 존재 은닉 — 없는 통합과 같은 `RESOURCE_NOT_FOUND`. (기각: «403 + 새 에러 코드»)
3. **Organization 통합의 별칭 수정 · 삭제**: spec 대로 Admin 이상. (기각: «현행 Editor 유지 + spec 정정»)

## 변경안 — `spec/2-navigation/4-integration.md`

### (A) frontmatter

`status: implemented` → `status: partial`, `pending_plans:` 신설:

```yaml
status: partial
pending_plans:
  - plan/in-progress/integration-personal-owner-followup.md
```

근거: §8 의 «워크플로우 노드에서 사용» 행 등(아래 (B) «아직 강제되지 않는 것»)은 이 PR 뒤에도 미구현이다. `spec-impl-evidence.md §3`
의 `partial` 정의(«일부 구현됨» + 미구현 surface 를 책임지는 plan 의무)에 해당한다.

### (B) §8 표 아래에 판정 규칙 블록 추가 (표 자체는 그대로)

```markdown
**판정 규칙** (2026-09-25 부터 강제 — 그 전까지 Personal 열은 표로만 있었다, Rationale «Personal 통합 소유자 강제»):

- **«본인» 은 `created_by` 다.** Personal 통합에는 역할 우위가 없다 — Owner · Admin 도 남의 personal 을 보거나 바꾸지 못한다
  ([RBAC §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스) 의 «자기 것»).
- **남의 personal 은 없는 통합과 같다.** 목록(`GET /api/integrations`)에서 빠지고, `:id` 경로 전부 — 상세 · 사용처 · 활동 · 연결 테스트 ·
  별칭 수정 · 삭제 · rotate · reauthorize · request-scopes · scope 전환 — 가 없는 id 와 같은 `404 RESOURCE_NOT_FOUND` 를 낸다.
  `POST /api/integrations/oauth/begin` 의 `reauthorize` · `request_scopes` 모드(`integrationId` 지정)도 `:id/reauthorize` ·
  `:id/request-scopes` 와 같은 판정을 받는다.
- **표에 없는 조회성 경로는 «조회» 행을 따른다** — 연결 테스트 · 사용처 · 활동, 그리고 워크플로우 어시스턴트의 통합 목록 도구와
  노드 후보 제시.
- **Organization 통합의 변경은 Admin 이상이다** — 생성 · 별칭 수정 · 삭제 · reauthorize · rotate · request-scopes · scope 전환.
  거부는 `403 ADMIN_REQUIRED` — 라우트 가드의 역할 거부와 같은 코드에 동작별 문구를 싣는다(2026-09-25 이전 이 모듈의 Admin 판정 4곳 —
  생성 · rotate · request-scopes · scope 전환 — 은 `FORBIDDEN` 이었다). 라우트 가드(`@Roles('editor')`)는 그 아래의 첫 번째 선일 뿐이다.
- **scope 전환은 Admin 이 볼 수 있는 통합에만 된다** — 자기 personal → organization, organization → personal. 전환해도 `created_by`
  는 바뀌지 않으므로 organization → personal 은 **생성자의** personal 이 된다.
- **precheck 의 중복 감지는 scope 를 가리지 않는다** — 매장 식별자 유일성이 워크스페이스 단위라서다(§9.2). 다만 충돌 행이 남의
  personal 이면 `existingIntegrationId` · `existingName` 을 싣지 않는다(`conflict` · `status` 만).

**아직 강제되지 않는 것** — 후속 [`integration-personal-owner-followup.md`](../../plan/in-progress/integration-personal-owner-followup.md):

- «워크플로우 노드에서 사용» 행. 실행 엔진은 워크스페이스만 보고, 노드 설정 저장도 남의 personal 참조를 막지 않는다. 스케줄 ·
  웹훅 실행에는 요청 사용자가 없어 «본인» 을 누구로 볼지부터 정해야 한다.
- Viewer 의 자기 personal 생성 · 별칭 수정 · rotate · 삭제. 라우트 가드가 Editor 라 막혀 있다 — 표보다 좁다.
- cafe24 Private · MakeShop 의 `pending_install` 행 재사용(`oauth/begin`)이 그 행의 생성자를 보지 않는다.
- 통합 상세 화면은 역할 · 소유에 따라 버튼을 가리지 않는다 — 거부는 서버 응답으로 드러난다.
```

### (C) `## Rationale` 에 항목 추가 (맨 앞 — 최신 항목이 위)

```markdown
### Personal 통합 소유자 강제 — 404 존재 은닉 · 역할 우위 없음 · 노드 실행은 후속 (2026-09-25)

**배경.** §8 의 Personal 열(«본인 것만»)은 표로만 있었고, 코드는 어디서도 `created_by` 를 보지 않았다. 워크스페이스 멤버면 남의
personal 통합을 목록 · 상세로 봤고, Editor 면 별칭 수정 · 삭제까지 했다. Organization 열도 별칭 수정 · 삭제는 Admin 대신 Editor 로
열려 있었고, reauthorize 는 역할 검사가 아예 없었다. reauthorize 의 OAuth 콜백은 그 통합의 `credentials` 를 통째로 교체하므로
([data-flow §1.2](../data-flow/5-integration.md#12-oauth-연결-begin--authorize--callback)), Viewer 가 Organization 통합을 자기 외부
계정으로 바꿔치기할 수 있었다. `oauth/begin` 의 `reauthorize` 모드는 `integrationId` 를 받기만 하고 검사하지 않아 `:id/reauthorize`
를 우회하는 두 번째 입구였다. 처음 발견은 rotate 한 곳이었고(`/ai-review` `review/code/2026/09/20/18_09_24` requirement INFO 6),
2026-09-25 전수 조사에서 위 범위로 넓어졌다.

**결정** (2026-09-25 사용자 결정 — 선택지 셋을 제시했다):

1. **쓰기와 읽기를 함께 닫고, 노드 실행 시점 검사는 후속으로 둔다.** 런타임에는 «본인» 을 누구로 볼지(스케줄 실행엔 요청자가 없다)가
   먼저 정해져야 하고, 기존 워크플로우가 동료의 personal 통합을 쓰고 있으면 실행이 깨지므로 영향 조사가 필요하다.
2. **남의 personal 은 404 다** — 없는 통합과 같은 `RESOURCE_NOT_FOUND`. 목록에서 빠진 것과 일관되고, 이 도메인이 워크스페이스
   밖 · 부재 id 에 이미 쓰는 응답(§9.1)을 그대로 쓰므로 새 에러 코드가 필요 없다. «권한 없음과 부재를 같은 응답으로 묶는다» 는
   원칙은 경로 파라미터 워크스페이스 가드와 같다([`data-flow/12-workspace.md`](../data-flow/12-workspace.md) Rationale «경로 파라미터
   워크스페이스도 가드가 본다») — 다만 그쪽 응답은 `403 NOT_A_MEMBER` 다. 원칙은 같고 상태 코드는 도메인마다 다르다.
3. **Organization 통합의 별칭 수정 · 삭제는 Admin 이상이다.** 이 표 · RBAC §3.2 · 사용자 가이드(Danger zone «Admin»)가 모두 그렇게
   적는데 코드만 Editor 였다. 표를 코드에 맞추지 않고 코드를 표에 맞췄다.

거부 코드는 `ADMIN_REQUIRED` 로 올렸다(`--spec` `review/consistency/2026/09/25/21_33_10` WARNING 1). 라우트 가드가 역할 거부에 전용 코드를
싣고(같은 날 `#1399`), 서비스 계층의 두 번째 선(`WorkspacesService.assertAdmin`)도 같은 코드를 쓴다. 이 모듈의 기존 Admin 판정 4곳만
`FORBIDDEN` 으로 남아 있었다 — 클라이언트는 이 코드로 분기하지 않는다(프런트엔드 `FORBIDDEN` 참조 0곳, 2026-09-25 실측). 이 PR 이
그 자리를 전부 손보므로 함께 올렸다.

**기각한 대안** (모두 같은 날 선택지로 제시했고 사용자가 고르지 않았다):

- *쓰기 경로만 먼저* — 목록에 보이는 통합을 눌렀을 때 거부되는 어색한 중간 상태가 남는다.
- *§8 전부를 한 번에(노드 실행 포함)* — 기존 워크플로우 영향 조사와 런타임 «본인» 기준 결정이 선행돼야 해 범위가 커진다.
- *403 + 새 에러 코드(예: `INTEGRATION_OWNER_REQUIRED`)* — 목록에서는 빠지는데 `:id` 가 존재를 확인해 주는 비대칭이 생기고,
  카탈로그와 클라이언트 분기가 늘어난다.
- *Organization 별칭 수정 · 삭제를 Editor 로 두고 spec 을 정정* — spec 두 곳과 가이드가 이미 Admin 이다.

**받아들인 잔여.** 통합 이름(`integration_workspace_name_unique`)과 매장 식별자(`(workspace_id, service_type, mall_id)`)의 유일성은
워크스페이스 단위다. 그래서 생성 · 이름 변경의 `INTEGRATION_NAME_TAKEN` 과 begin · precheck 의 충돌 응답은 남의 personal 이
**있다는 사실**을 드러낸다. 유일성을 생성자 단위로 바꾸면 같은 매장을 두 통합이 붙잡는 상태를 허용하게 되는데, 매장 식별자
유일성은 토큰 · 설치 흐름의 전제다(§9.2). 그래서 존재 신호는 남기고, precheck 가 **식별자(id · 이름)** 를 싣지 않는 데서 멈춘다.
```

## 영향 — 다른 spec

- `spec/5-system/1-auth.md §3.2` RBAC 표 — 변경 없음. «자기 것» 이 이번 판정 규칙으로 강제된다(Viewer 의 생성 등은 (B) 가 후속으로 명시).
- `spec/0-overview.md` «워크스페이스 단위 Integration 공유·RBAC» 행 — 변경 없음. 이미 `@Roles('editor')` 를 floor 로, 세부 RBAC 를 §8 에
  위임한다.
- `spec/2-navigation/9-user-profile.md §4.2` — 변경 없음(`Integration 생성 (Org)` 행만 있다).
- `spec/data-flow/5-integration.md` — 변경 없음. `oauth/begin` 모드 표는 흐름 서술이고 인가는 §8 이 SoT.
- `spec/4-nodes/4-integration/_product-overview.md` INT-MG-07 — (H). «Admin만 가능» 은 필요조건이고 소유자 제약은 §8 이 세부화한다.
- `spec/5-system/3-error-handling.md §1.2` — (G). `ADMIN_REQUIRED` 발행처에 `IntegrationsService` 추가.

## `--spec` 처리 (`review/consistency/2026/09/25/21_33_10` — BLOCK: NO, WARNING 4 · INFO 4)

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 | Organization Admin 거부를 `FORBIDDEN` 으로 명문화 — `#1399` 의 전용 코드 원칙과의 관계 미설명 | `ADMIN_REQUIRED` 로 승격(기존 4곳 포함) — (B) · (G) · Rationale |
| W2 | precheck 생략 규칙이 §9.2 에 없고, 기존 Rationale «별도 RBAC 처리 불필요» 와 모순 | (D) · (E) |
| W3 | Rationale 이 인용한 `INTEGRATION_NAME_TAKEN` 이 §9.4 에 없음 | (F) |
| W4 | INT-MG-07 이 영향 감사에서 누락 | (H) + 영향 절 |
| INFO 1 | 404 선례로 든 워크스페이스 가드는 403 `NOT_A_MEMBER` | Rationale 결정 2 를 «도메인 자신의 404(§9.1) + 원칙만 같은 선례» 로 고쳐 씀 |
| INFO 2 | 트래커 항목 종결 계획 없음 | 동반 산출물에 추가 |
| INFO 3 · 4 | `pending_plans` 파일 동시 생성 · developer plan 미생성 | 같은 커밋으로 · 다음 단계에서 생성 |

### (D) §9.2 precheck 두 행에 생략 조건 한 문장 (W2)

`GET /api/integrations/cafe24/precheck` 행의 «…소속 cafe24 row 만 노출** — cross-workspace 접근 경로 아님.» 뒤, `makeshop/precheck` 행의
«…소속 makeshop row 만 노출**.» 뒤에 각각:

```markdown
충돌 행이 **남의 personal** 이면 `existingIntegrationId` · `existingName` 을 싣지 않는다(`conflict` · `status` 만 — [§8 판정 규칙](#8-권한-규칙)).
```

### (E) Rationale «precheck endpoint — mall_id 입력 단계 사전 감지 UX» 의 한 문장 정정 (W2 — 원문 보존)

«노출 범위 격리» 불릿의 `(별도 RBAC 처리 불필요)` 를 취소선으로 남기고 정정을 붙인다:

```markdown
~~(별도 RBAC 처리 불필요)~~ (2026-09-25 정정: 워크스페이스 경계는 그대로지만, 충돌 행이 남의 personal 이면 id · 이름을 뺀다 —
Rationale «Personal 통합 소유자 강제»)
```

### (F) §9.4 에 `INTEGRATION_NAME_TAKEN` 등재 (W3)

`INTEGRATION_IN_USE` 행 다음에:

```markdown
  - `INTEGRATION_NAME_TAKEN` (409) — 워크스페이스 안에 같은 이름의 통합이 이미 있다(`integration_workspace_name_unique` — scope
    무관). 생성 · 별칭 수정이 낸다. 겹친 쪽이 남의 personal 이어도 난다 — Rationale «Personal 통합 소유자 강제» 의 받아들인 잔여.
```

## 변경안 — 다른 spec

### (G) `spec/5-system/3-error-handling.md §1.2` `ADMIN_REQUIRED` 행 — 발행처 추가 (W1)

«(`RolesGuard` 의 `@Roles('admin')` 미달 · `WorkspacesService.assertAdmin()` 발행)» →
«(`RolesGuard` 의 `@Roles('admin')` 미달 · `WorkspacesService.assertAdmin()` · `IntegrationsService` 의 Organization 통합 변경 판정
([통합 관리 §8](../2-navigation/4-integration.md#8-권한-규칙)) 발행)»

### (H) `spec/4-nodes/4-integration/_product-overview.md` INT-MG-07 — 소유자 제약 한 구 (W4)

«Personal ↔ Organization 범위 전환 — Admin만 가능하며 확인 다이얼로그 필수. 기존 자격 증명 승계» →
«Personal ↔ Organization 범위 전환 — Admin만 가능하며(대상은 Admin 이 볼 수 있는 통합 — 자기 personal · organization,
[통합 관리 §8](../../2-navigation/4-integration.md#8-권한-규칙)) 확인 다이얼로그 필수. 기존 자격 증명 승계»

## 동반 산출물 (같은 커밋)

- `plan/in-progress/integration-personal-owner-followup.md` — `pending_plans` 실존 가드(`spec-pending-plan-existence.test.ts`)용. 위
  «아직 강제되지 않는 것» 네 항목을 담는다. frontmatter 갱신과 **같은 커밋**.
- 착지(PR 마무리) 때 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «personal-scope 통합의 «본인 것만» 소유자
  검증이 코드에 없다» 항목을 `[x]` + 이 draft · 구현 plan 포인터로 닫는다(`--spec` INFO 2).

## Rationale

- **왜 §8 표를 고치지 않고 아래에 규칙 블록을 두나** — 표의 약속(«본인 것만» · «Admin 이상»)은 그대로 맞다. 빠져 있던 것은 «본인» 의
  정의 · 거부 응답 · 표에 없는 경로의 귀속 · 아직 안 된 것의 경계다. 표를 쪼개면 RBAC §3.2 와의 대응이 흐려진다.
- **왜 `status: partial` 인가** — 이 PR 뒤에도 §8 의 «노드에서 사용» 행이 미구현이다. 문서가 구현보다 넓게 말하지 않게 하는 정식
  표기가 `partial` + `pending_plans` 다(`spec-impl-evidence.md`).
