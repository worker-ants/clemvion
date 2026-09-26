---
title: swagger.md §5-4 — 403 설명은 가드가 낼 수 있는 거부 코드를 전부 싣는다 (가드 등재)
status: in-progress
owner: project-planner
worktree: forbidden-desc-codes
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# spec draft — 403 설명의 가드 거부 코드

구현 plan `plan/in-progress/forbidden-desc-codes.md` 이 신설하는 저장소 가드 `forbidden-response-codes` 의 규칙을
`spec/conventions/swagger.md` §5-4 에 적고 가드를 `code:` 에 등재한다.

**왜 §5-4 를 고치는가**: 지금 403 항목은 «`@Roles()` 가 있으면 요구 역할과 코드를 명시하고, `@Roles()` 없이 워크스페이스만 받으면
`NOT_A_MEMBER`» 라 적는다. 그런데 `RolesGuard` 는 `@Roles()` 라우트에서도 **비멤버에게 `NOT_A_MEMBER`** 를 낸다 — 비멤버는 요구 역할과
무관하게 `NOT_A_MEMBER` 라는 것이 `spec/data-flow/12-workspace.md` §Rationale «가드 거부의 오류 코드» 의 채택안이다. 지금 문구대로면
`@Roles('editor')` 라우트는 `EDITOR_REQUIRED` 만 싣고 비멤버 코드를 빠뜨린다. 이미 코드를 싣는 28곳(`workspaces.controller.ts` 의 로컬
상수 등)은 두 코드를 함께 싣는다 — 문구를 그 실제에 맞춘다.

**왜 가드인가**: §5-4 는 «새 엔드포인트» 체크리스트라 기존 라우트가 따라가지 않았다 — 2026-09-26 실측으로 가드가 403 을 낼 수 있는
라우트 157곳 중 129곳의 설명에 코드가 빠져 있었다(구현 plan §실측). OpenAPI 로 클라이언트를 만드는 쪽은 어떤 코드가 오는지 알 수 없다.

**정하지 않는 것**: 서비스 계층이 내는 403(`FORBIDDEN` · `RERUN_PERMISSION_DENIED` 등)을 설명에 반드시 싣게 하는 것. 가드는 **가드
코드만** 본다 — 서비스 거부는 자리마다 코드와 조건이 달라 기계적으로 셀 수 없다. 문구는 «덧붙인다» 로만 안내한다.

## 변경 (1) — frontmatter `code:`

목록 끝(`http-status-advertised` 두 줄 아래)에 넣는다.

```yaml
  # §5-4 의 403 설명 ↔ 가드 거부 코드(`NOT_A_MEMBER` · 역할 코드) 짝을 세는 가드(reflection, 대조군은 spec 안의 클래스).
  - codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts
```

## 변경 (2) — §5-4 의 403 항목

`엔드포인트도 403 을 낼 수 있다.` 뒤의 두 문장(«`@Roles()` 가 있으면 … 통일한다 — 코드는 […](…).»)을 아래로 바꾼다. 앞 문장과
`(`@Public()` 라우트는 대상 아님.)` 은 그대로 둔다.

```markdown
설명에는 **가드가 낼 수 있는 거부 코드를 전부** 싣는다 — 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 이므로
      대상 라우트는 모두 "워크스페이스 멤버가 아님(`NOT_A_MEMBER`)" 을 싣고, `@Roles()` 가 있으면 요구 중 가장 낮은 역할의 코드를
      더한다(예: "워크스페이스 멤버가 아님(`NOT_A_MEMBER`) 또는 Editor 이상 권한 필요(`EDITOR_REQUIRED`)". `@Roles('viewer')` 는
      멤버십과 같아 앞 문장뿐이다). 문장은 공용 헬퍼 `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)`(`common/swagger`)로 만들고,
      서비스가 내는 403 은 그 뒤에 덧붙인다 — 코드는 [data-flow §Rationale 가드 거부의 오류 코드](../data-flow/12-workspace.md#가드-거부의-오류-코드-2026-09-25).
      저장소 가드 `forbidden-response-codes` 가 새 엔드포인트만이 아니라 **모든 라우트**에 이 짝을 강제한다(서비스 거부는 세지 않는다).
```

## 변경 (3) — `## Rationale` 끝

```markdown
### §5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)

가드 거부가 코드를 갖게 된 뒤([data-flow «가드 거부의 오류 코드»](../data-flow/12-workspace.md#가드-거부의-오류-코드-2026-09-25))에도
기존 라우트의 403 설명은 따라가지 않았다. §5-4 는 새 엔드포인트 체크리스트라 기존 라우트를 묶지 않았고, 그 결정을 적용한 PR 은
경로 라우트 15곳 · 재실행 · chain 의 설명만 고쳤다. 2026-09-26 실측(`src/modules`, reflection): 가드가 403 을 낼 수 있는 라우트 157곳 중
129곳의 설명에 코드가 빠져 있었다 — «워크스페이스 멤버가 아님» 54 · «editor 이상 권한 필요» 53 · «viewer 이상 권한 필요» 4 · 표기가
제각각인 역할 문장 14 · 비멤버 코드만 빠진 통합 4.

- **`@Roles()` 라우트도 `NOT_A_MEMBER` 를 싣는다.** 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER` 라는 것이 위 data-flow 결정의 채택안
  (나)다. 종전 문구(«`@Roles()` 가 있으면 요구 역할과 코드»)대로면 비멤버 코드가 광고에서 빠진다. 이미 코드를 싣던 28곳은 두 코드를
  함께 싣고 있었다 — 문구를 그 실제에 맞췄다.
- **`viewer` 는 코드가 하나다.** `@Roles('viewer')` 의 거부는 멤버십 거부와 같다(`ROLE_REQUIRED.viewer` 가 `NOT_A_MEMBER`). «viewer
  이상 권한 필요» 라고 쓰면 오지 않는 코드를 암시한다.
- **공용 헬퍼로 쓴다.** 문장 형식이 컨트롤러마다 갈렸다(«Admin 미만 권한» · «관리자 권한 필요» · «권한 부족 (Admin 미만) 또는 비멤버»).
  헬퍼가 코드를 `NOT_A_MEMBER` · `ROLE_REQUIRED` 상수에서 보간하므로 코드 이름이 바뀌어도 문장이 따라간다.
- **reflection 으로 센다.** 설명은 상수 보간(`${NOT_A_MEMBER.code}`)이라 소스 텍스트로는 최종 문장을 알 수 없다 — 데코레이터가 평가된
  메타데이터를 읽는다. 가드가 낼 코드는 `RolesGuard` 와 같은 규칙(`@Public` · `@Roles` · 워크스페이스 소비)으로 계산하고, 요구 중
  가장 낮은 역할을 고르는 식은 가드와 **같은 함수**(`lowestRequiredRole`)를 쓴다 — 따로 옮겨 적으면 둘이 갈리는 날 검사가 가드가 내지
  않는 코드를 요구한다.
- **서비스 거부는 세지 않는다.** 서비스가 내는 403 은 자리마다 조건과 코드가 달라 기계적 판정이 안 된다. 헬퍼 문장 뒤에 덧붙이도록
  안내만 한다.
```

## Rationale (이 draft 의)

- **§5-4 문구를 고치는 이유**: 가드만 등재하고 문구를 두면 «`@Roles()` 라우트는 역할 코드만» 이라는 본문과 «두 코드를 요구» 하는
  가드가 서로 다른 것을 말한다(`spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 본문 약속의 시행 파일).
- **헬퍼 이름을 본문에 적는 이유**: 새 엔드포인트 작성자가 문장을 손으로 쓰지 않게 — 형식이 갈린 원인이 손으로 쓴 문장이었다.
- **기각한 대안 — `@Roles()` 를 읽어 설명을 자동으로 만드는 데코레이터**(이 draft 를 쓰며 검토했다): 데코레이터는 아래에서 위로 적용돼 `@ApiForbiddenResponse`
  가 적용되는 시점에 `@Roles()` 메타데이터가 있는지가 데코레이터 순서에 달린다. 순서 규약을 하나 더 만드는 대신 명시적 헬퍼 + 가드를
  택했다.
