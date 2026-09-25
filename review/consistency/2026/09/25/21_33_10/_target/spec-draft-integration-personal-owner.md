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
- **Organization 통합의 변경은 Admin 이상이다** — 별칭 수정 · 삭제 · reauthorize · rotate · request-scopes. 거부는 `403 FORBIDDEN`.
  라우트 가드(`@Roles('editor')`)는 그 아래의 첫 번째 선일 뿐이다.
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
2. **남의 personal 은 404 다** — 없는 통합과 같은 응답. 목록에서 빠진 것과 일관되고, 경로 파라미터 워크스페이스 가드가 비멤버와
   부재를 같은 응답으로 묶은 원칙([`data-flow/12-workspace.md`](../data-flow/12-workspace.md) Rationale «경로 파라미터 워크스페이스도
   가드가 본다»)과 같다. 새 에러 코드도 필요 없다.
3. **Organization 통합의 별칭 수정 · 삭제는 Admin 이상이다.** 이 표 · RBAC §3.2 · 사용자 가이드(Danger zone «Admin»)가 모두 그렇게
   적는데 코드만 Editor 였다. 표를 코드에 맞추지 않고 코드를 표에 맞췄다.

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

## 동반 산출물 (같은 커밋)

- `plan/in-progress/integration-personal-owner-followup.md` — `pending_plans` 실존 가드(`spec-pending-plan-existence.test.ts`)용. 위
  «아직 강제되지 않는 것» 네 항목을 담는다.

## Rationale

- **왜 §8 표를 고치지 않고 아래에 규칙 블록을 두나** — 표의 약속(«본인 것만» · «Admin 이상»)은 그대로 맞다. 빠져 있던 것은 «본인» 의
  정의 · 거부 응답 · 표에 없는 경로의 귀속 · 아직 안 된 것의 경계다. 표를 쪼개면 RBAC §3.2 와의 대응이 흐려진다.
- **왜 `status: partial` 인가** — 이 PR 뒤에도 §8 의 «노드에서 사용» 행이 미구현이다. 문서가 구현보다 넓게 말하지 않게 하는 정식
  표기가 `partial` + `pending_plans` 다(`spec-impl-evidence.md`).
