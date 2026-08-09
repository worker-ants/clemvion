---
title: spec 동기화 — #1103·#1108·#1109 이 남긴 auth 불변식 5곳
worktree: pnpm-migration-followups-7fc7c2
started: 2026-08-09
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/5-system/3-error-handling.md
  - spec/5-system/15-chat-channel.md
  - spec/5-system/1-auth.md
  - spec/data-flow/12-workspace.md
  - spec/conventions/secret-store.md
---

## Overview

오늘 머지된 세 PR 이 **결정하고 구현까지 했으나 spec 에 적지 않은** 항목 5건을 기록한다.
전부 사후 기록(documentation of settled decisions)이며 **새 결정은 없다**.

출처는 두 plan 의 `## 후속` 절이다:

- [`auth-guard-reflection-hardening.md`](../in-progress/auth-guard-reflection-hardening.md) §후속 — 4건
  (`--impl-done` consistency WARNING 2회분, BLOCK:NO 지만 반영 대상)
- [`backend-lint-gate-broken-on-main.md`](../in-progress/backend-lint-gate-broken-on-main.md) §후속 — 1건
  (ai-review INFO 11)

두 plan 모두 "코드가 spec 을 어긴 것이 아니라 **spec 이 새 케이스를 아직 안 적은 것**
(incompleteness)" 이라 BLOCK 이 아니라고 판정했고, `developer` 권한 밖(`spec/` read-only)이라
planner 턴으로 넘겼다.

---

## ⚠️ 착수 중 발견 — 항목 3 의 인계 근거가 틀렸다 (실측)

두 plan 과 코드 주석이 항목 3(헤더 vs 경로 파라미터 비대칭)의 회귀 캐너리로
`codebase/backend/test/system-status.e2e-spec.ts:147` 의 nil-UUID 프로브를 지목한다
("`isValidUuid` 를 썼다면 그 e2e 가 깨졌을 것"). **그 e2e 는 이 술어에 닿지 않는다.**

실측 (2026-08-09):

| 사실 | 근거 |
|---|---|
| `system-status.controller.ts` 에는 `@Roles()` 도 `@WorkspaceId()` 도 없다 | 데코레이터 전수 grep — `@Controller('system-status')` · `@Get('overview')` 둘뿐 |
| `RolesGuard.canActivate` 는 그 조합에서 **`resolveRequestWorkspaceContext` 호출 이전에** `return true` 한다 | `roles.guard.ts` — `if (!needsRoleCheck && !handlerConsumesWorkspaceId(...)) return true;` 가 헬퍼 호출보다 위 |
| 따라서 술어를 `isValidUuid` 로 조여도 그 e2e 는 **그대로 200** 이다 | 헬퍼가 실행되지 않으므로 400 이 날 자리가 없다 |

그 e2e 가 실제로 고정하는 불변식은 다른 것이다 — **"워크스페이스와 무관한 전역 라우트는
`X-Workspace-Id` 헤더를 무시한다"**(`handlerConsumesWorkspaceId` 단축 통과의 e2e 회귀 가드).

**진짜 캐너리는 두 단위 테스트다** (실측으로 확인):

- `codebase/backend/src/common/utils/uuid.spec.ts` —
  `accepts UUID-shaped values that isValidUuid rejects (nil / v6+ / 비-RFC variant)`
  가 두 술어의 경계 자체를 고정한다.
- `codebase/backend/src/common/utils/workspace-context.util.spec.ts:135` —
  `Postgres 가 파싱할 수 있는 값은 통과시킨다 (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)`
  가 헬퍼 레벨에서 고정한다.

**결정 자체는 바뀌지 않는다** — 비대칭은 의도이고 근거(Postgres 가 파싱하는 값을 400 으로
거부하면 403 이어야 할 응답이 400 으로 뒤바뀐다)도 그대로다. 바뀌는 것은 **spec 에 적을
캐너리 지목**뿐이다. 틀린 앵커를 그대로 전재하면 나중에 "그 e2e 가 지켜 주니 괜찮다" 는
잘못된 안전감을 준다 — 이 저장소가 반복해 데인 "유예 근거는 실측해야 한다" 의 같은 클래스.

> 코드 주석 두 곳(`common/utils/uuid.ts` docstring · `plan/.../auth-guard-reflection-hardening.md`)
> 에도 같은 부정확이 있으나 `codebase/**` 는 planner 권한 밖이다 → §후속 에 developer 항목으로 등재.

---

## 1. `3-error-handling.md §1.3` — 비-UUID `X-Workspace-Id` 400 케이스 등재

**현재 상태**: §1.3 카탈로그에 `WORKSPACE_ID_REQUIRED`(헤더·클레임 **둘 다 부재**) 행만 있다.
`#1108` 이 신설한 **제3의 케이스**(헤더가 **있으나** UUID 형태가 아님 → `VALIDATION_ERROR` 400)가
카탈로그에 없다.

**발행 지점**: `common/utils/workspace-context.util.ts` 의 `resolveRequestWorkspaceContext`
(가드·데코레이터 공용 헬퍼) — `throw new BadRequestException({ code: 'VALIDATION_ERROR', … })`.

### 변경 1-a — `VALIDATION_ERROR` 기본 행에 포인터 추가

```diff
-| `VALIDATION_ERROR` | 요청 데이터 유효성 실패 | 400 |
+| `VALIDATION_ERROR` | 요청 데이터 유효성 실패 (400 기본값 — [API 규약 §5.3](./2-api-convention.md#53-에러-응답)). 발행 지점이 특정된 케이스는 아래 별도 행(`X-Workspace-Id` 형식)에 분리 등재 | 400 |
```

### 변경 1-b — `WORKSPACE_ID_REQUIRED` 행에 대비 명시 + 새 행 추가

```diff
-| `WORKSPACE_ID_REQUIRED` | 워크스페이스 컨텍스트 부재 — `X-Workspace-Id` 헤더와 JWT `workspaceId` 둘 다 없음 (`common/decorators/workspace.decorator.ts` 발행) | 400 |
+| `WORKSPACE_ID_REQUIRED` | 워크스페이스 컨텍스트 **부재** — `X-Workspace-Id` 헤더와 JWT `workspaceId` 둘 다 없음 (`common/decorators/workspace.decorator.ts` 발행). 헤더가 **있으나 형식이 깨진** 경우는 아래 행(`VALIDATION_ERROR`)이며 **다른 케이스**다 | 400 |
+| `VALIDATION_ERROR` (`X-Workspace-Id` 형식) | `X-Workspace-Id` 헤더가 **있으나** canonical UUID 형태(8-4-4-4-12 hex)가 아님 → 조기 거부. 가드·`@WorkspaceId()` 데코레이터 공용 헬퍼(`common/utils/workspace-context.util.ts` `resolveRequestWorkspaceContext`)가 발행하며, 소비처가 둘이라 **헬퍼 1곳에서 throw** 한다(반환 플래그로 두면 두 경로의 응답이 갈라진다). 조기 거부가 없으면 그 값이 `getMemberRole` 까지 흘러가 TypeORM `QueryFailedError`(SQLSTATE 22P02)가 되고, `GlobalExceptionFilter` 의 어떤 분기에도 안 걸려 **500 `INTERNAL_ERROR` 로 마스킹**된다 — 클라이언트 입력 오류가 서버 오류로 보인다. **JWT 클레임은 검증하지 않는다**(서버가 서명한 값이라 거기서 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다). 검증 강도는 느슨한 `isUuidShaped` 다 — 근거: [data-flow §Rationale "UUID 검증 강도 비대칭"](../data-flow/12-workspace.md#x-workspace-id-헤더-vs-id-경로-파라미터--uuid-검증-강도-비대칭-2026-08-09) | 400 |
```

### 변경 1-c — 표 아래에 3분기 노트

```markdown
> **`X-Workspace-Id` 3분기**: 같은 헤더 하나가 세 갈래로 갈린다 — (1) 헤더·클레임 **둘 다 부재**
> → `WORKSPACE_ID_REQUIRED`(400), (2) 헤더 **있으나 형식 파손** → `VALIDATION_ERROR`(400),
> (3) 헤더 **형식 유효하나 비멤버** → `RolesGuard` 의 **코드 없는 403**(전용 error code 를 붙이지
> 않는 이유는 [data-flow §Rationale "멤버십 검증은 가드 1곳에서"](../data-flow/12-workspace.md#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08)).
> (2)와 (3)의 경계가 곧 아래 [UUID 검증 강도 비대칭](../data-flow/12-workspace.md#x-workspace-id-헤더-vs-id-경로-파라미터--uuid-검증-강도-비대칭-2026-08-09) 이다.
> **적용 범위**: (1)·(2)는 `@Roles()` 또는 `@WorkspaceId()` 를 쓰는 인증 라우트에서만 발생한다 —
> 둘 다 없는 워크스페이스-무관 전역 라우트는 `RolesGuard` 가 헤더를 읽기 전에 통과시키므로
> 형식이 깨진 헤더가 실려도 **무시**된다(`handlerConsumesWorkspaceId`).
```

> **왜 코드가 두 행에 나뉘는가**: `VALIDATION_ERROR` 는 신규 코드가 아니라 기존 400 기본값의
> 특정 트리거다. 신규 코드 신설은 `#1108` 이 이미 기각했다(그쪽 plan §3 — `spec_impact: none`
> 을 유지하려는 이유가 아니라, `2-api-convention.md §5.3` 이 정한 400 기본값이 이 케이스에
> 정확히 맞기 때문).
>
> **코드 셀에는 한정자를 넣지 않는다 (consistency WARNING #1 반영).** 초안은 코드 컬럼을
> `` `VALIDATION_ERROR` (`X-Workspace-Id` 형식) `` 로 적었으나 두 가지로 어긋난다 —
> (1) [`error-codes.md`](../../spec/conventions/error-codes.md) 가 "클라이언트는 **코드의
> 의미로 분기**하며 이름 토큰 부분 문자열을 파싱하지 않는다" 고 못 박아 코드 셀은 wire 값
> 그대로여야 하고, (2) 같은 PR 의 `15-chat-channel.md §5.4` 는 코드 셀을 순수값으로 두어
> 두 표의 표기가 갈린다. 한정자는 설명 셀 prose 로 옮겼다. 선례도 그쪽이다 — 같은 표의
> `RESERVED_VARIABLE_NAME` 행은 surface 한정자를 **코드 셀이 아니라 HTTP 셀**
> (`400 (저장) / — (런타임)`)에 둔다(반영 시 재확인 완료).

---

## 2. `15-chat-channel.md §5.4` — §1.3 파급 (canonical 인용처)

§5.4 의 rotate-bot-token 실패 응답 표가 `WORKSPACE_ID_REQUIRED` 행에서 §1.3 을 **canonical 로
인용**한다. 그 라우트(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)는
`@Roles('editor')` + `@WorkspaceId()` 둘 다 있어(실측) 새 400 케이스의 **적용 대상**이다.

```diff
 | 400 | `WORKSPACE_ID_REQUIRED` | 워크스페이스 컨텍스트 부재 — `X-Workspace-Id` 헤더·JWT `workspaceId` 둘 다 없음 (공용 `@WorkspaceId()` 데코레이터, [`common/decorators/workspace.decorator.ts`](../../codebase/backend/src/common/decorators/workspace.decorator.ts) — `3-error-handling.md §1.3` canonical) |
+| 400 | `VALIDATION_ERROR` | `X-Workspace-Id` 헤더가 **있으나** UUID 형태가 아님 — 가드·데코레이터 공용 헬퍼([`common/utils/workspace-context.util.ts`](../../codebase/backend/src/common/utils/workspace-context.util.ts)) 조기 거부. 위 `WORKSPACE_ID_REQUIRED`(둘 다 **부재**)와 **다른 케이스** (`3-error-handling.md §1.3` canonical) |
```

> §5.4.1·§5.4.1.1 이 쓰는 `VALIDATION_ERROR`(`details.field='botTokenRef'` 등)와 **같은 코드
> 다른 트리거**다. 그쪽은 body 필드, 이쪽은 헤더 형식이다 — `details` 로 갈린다.

---

## 3. `1-auth.md` frontmatter `code:` 글로브 확장 — evidence 사슬 복구

**현재 상태**: `common/guards/*.ts` 만 있어 `#1108` 이 경화한 표면이 evidence 사슬 밖이다.

**CI 가 못 잡는 이유 (실측)**: `spec-code-paths.test.ts` 의 단언은
`codes.some((c) => globMatchesAny(c, root))` — **글로브 중 하나라도** 실파일에 매치하면 통과한다.
`common/guards/*.ts` 가 이미 매치하므로 나머지 표면이 통째로 빠져도 GREEN 이다.
SoT: [`spec/conventions/spec-impl-evidence.md §3`](../../spec/conventions/spec-impl-evidence.md)
("`partial`/`implemented` 는 ≥1 매치 의무" — **전수 매치 의무가 아니다**).

```diff
 code:
   - codebase/backend/src/modules/auth/**/*.ts
   - codebase/backend/src/modules/auth-configs/auth-configs.service.ts
   - codebase/backend/src/modules/audit-logs/**/*.ts
   - codebase/backend/src/modules/mail/**/*.ts
   - codebase/backend/src/common/guards/*.ts
+  - codebase/backend/src/common/decorators/*.ts
+  - codebase/backend/src/common/utils/workspace-context.util.ts
+  - codebase/backend/src/common/utils/uuid.ts
   - codebase/backend/src/common/config/webauthn.config.ts
```

**부수 효과 (의도한 것)**: `code:` 글로브는 `review_guard` 의 **spec-linked** 판정에도 쓰인다
(`_spec_linked_changes`). 즉 이 세 경로의 변경은 앞으로 push 전 fresh `--impl-done` consistency
리포트를 요구받는다 — evidence 사슬을 잇는 목적이 바로 그것이므로 의도한 강화다.

`common/decorators/*.ts` 는 `workspace.decorator.ts`·`workspace-reflection-canary.ts` 외에
`current-user.decorator.ts`·`public.decorator.ts`·`index.ts` 도 포함한다. **셋 다 auth 표면이
맞다** — `@Public()` 은 인증 면제 마커, `@CurrentUser()` 는 인증 컨텍스트 추출이다.
파일 단위 열거 대신 글로브를 쓰는 이유는 이 디렉터리에 새 auth 데코레이터가 생겼을 때 자동으로
사슬에 들어오게 하기 위함이다(누락은 이 항목이 고치려는 결함 그 자체다).

---

## 4. UUID 검증 강도 비대칭 명문화 — `data-flow/12-workspace.md ## Rationale`

**가장 값 있는 항목.** 의도된 비대칭인데 어느 spec 에도 없다.

| 입력 | 술어 | 강도 | 파손 시 |
|---|---|---|---|
| `X-Workspace-Id` **헤더** | `isUuidShaped` (canonical 8-4-4-4-12 hex, 버전·variant 무시) | **느슨** | 400 `VALIDATION_ERROR` |
| 워크스페이스 **`:id` 경로 파라미터** | `ParseUUIDPipe` (RFC v1–v5 + variant) | **엄격** | 400 (Nest 기본) |

경로 파라미터 쪽 실측 (consistency WARNING #2 로 정정): `workspaces.controller.ts` 의
`new ParseUUIDPipe()` 는 **18곳**이고, 그중 워크스페이스 `:id` 는 **14곳**(나머지는
`memberId` 2 · `invitationId` 2). 처음 적은 "19곳" 은 `import` 문 1줄을 함께 센 값이었다 —
`grep -c 'ParseUUIDPipe'` 로 세고 심볼 사용처로 말한 프록시 오류다.

### 신설 subsection (12-workspace.md `## Rationale` 의 `### URL slug = FE 라우팅 SoT` 바로 다음 — 그 뒤로 4개 subsection 이 더 있으므로 파일 말미가 아니다)

```markdown
### `X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)

같은 "워크스페이스 UUID" 인데 두 입구의 검증 강도가 다르다. **의도된 비대칭이다.**

| 입구 | 술어 | 통과 범위 |
|---|---|---|
| `X-Workspace-Id` 헤더 | `isUuidShaped` (`common/utils/uuid.ts`) | canonical 8-4-4-4-12 hex — **버전·variant nibble 을 보지 않는다** |
| 워크스페이스 `:id` 경로 파라미터 | `ParseUUIDPipe` (`workspaces.controller.ts`, 19곳) | RFC v1–v5 + RFC variant |

**왜 헤더는 느슨한가 — 조이면 403 이 400 으로 뒤바뀐다.** 헤더의 술어가 하는 일은
"Postgres 가 `uuid` 컬럼 값으로 파싱할 수 있는가" 하나다. 파싱 가능한 값을 미리 거르면
`getMemberRole` 이 정상 조회해 **"그 워크스페이스의 멤버가 아니다"(403)** 로 답해야 할 요청이
**"요청이 잘못됐다"(400)** 가 된다. nil UUID(`00000000-…`)·v7·비-RFC variant 가 정확히 그
구간이다 — Postgres 는 전부 받아들이는데 `isValidUuid`(RFC v1–v5 + variant)는 거부한다.
헤더는 **인가 판정의 입력**이므로 인가 결과(403)를 형식 오류(400)로 바꾸는 술어를 쓸 수 없다.

**왜 경로 파라미터는 엄격해도 되는가.** `:id` 는 인가 판정의 입력이 아니라 **리소스 지목**이다.
거기서 400 을 내도 뒤바뀔 인가 응답이 없다 — 없는 리소스는 어차피 404 이고, 400 과 404 는
"그 리소스에 접근할 수 있는가" 를 누설하지 않는다.

**"일관성" 명목으로 헤더를 `ParseUUIDPipe` 급으로 조이는 것은 회귀다.** 두 술어의 경계는
단위 테스트가 고정한다:

- `common/utils/uuid.spec.ts` — `accepts UUID-shaped values that isValidUuid rejects
  (nil / v6+ / 비-RFC variant)` (술어 경계 자체)
- `common/utils/workspace-context.util.spec.ts` — `Postgres 가 파싱할 수 있는 값은 통과시킨다
  (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)` (헬퍼 레벨)

> **캐너리 지목 정정 (2026-08-09)**: 구현 PR(`#1108`)의 plan 과 `uuid.ts` docstring 은 이
> 회귀의 캐너리로 `test/system-status.e2e-spec.ts` 의 nil-UUID 프로브를 지목했다. **그 e2e 는
> 이 술어에 닿지 않는다** — `system-status` 컨트롤러에는 `@Roles()` 도 `@WorkspaceId()` 도
> 없어 `RolesGuard` 가 헬퍼 호출 **이전에** 통과시킨다(`handlerConsumesWorkspaceId` 단축).
> 그 e2e 가 고정하는 것은 **"워크스페이스-무관 전역 라우트는 헤더를 무시한다"** 는 별개
> 불변식이다. 진짜 캐너리는 위 두 단위 테스트다.

**적용 범위**: 헤더 술어는 `@Roles()` 또는 `@WorkspaceId()` 를 쓰는 인증 라우트에서만 돈다.
둘 다 없는 전역 라우트는 헤더가 형식 파손이어도 400 이 아니라 **무시**다(위 단축 통과).
에러 코드 카탈로그: [`5-system/3-error-handling.md §1.3`](../5-system/3-error-handling.md#13-유효성-검증-에러).
```

### `1-auth.md §3.3` 에 한 줄 포인터

```diff
 3. 요청 리소스가 해당 워크스페이스에 속하는지 확인
```
바로 아래 코드블록 밖 인용문에 추가:
```markdown
> **`X-Workspace-Id` 형식 검증은 느슨하다 (의도)**: 2단계의 헤더는 canonical UUID **형태**만
> 본다(`isUuidShaped`) — 워크스페이스 `:id` 경로 파라미터의 `ParseUUIDPipe`(RFC v1–v5) 보다
> 느슨하며, 이 비대칭은 의도다. 조이면 비멤버 403 이어야 할 응답이 400 으로 뒤바뀐다.
> 근거·캐너리: [data-flow §Rationale "UUID 검증 강도 비대칭"](../data-flow/12-workspace.md#x-workspace-id-헤더-vs-id-경로-파라미터--uuid-검증-강도-비대칭-2026-08-09).
> 형식 파손 시 코드는 `VALIDATION_ERROR`(400, [§1.3](./3-error-handling.md#13-유효성-검증-에러)).
```

---

## 5. 부트 캐너리 설계 근거 — `1-auth.md ## Rationale`

**위치 근거**: `1-auth.md ## Rationale` 은 **auth 크로스커팅** 부트 가드의 기록 지점이다 —
기존 `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP` 가 그 선례다.
항목 3 이 캐너리 파일을 `1-auth.md` 의 `code:` 글로브에 넣으므로 evidence 사슬과도 정합한다.

> **일반화를 좁혔다 (consistency INFO #2 반영)**: 초안은 "이 저장소는 **유사 부트 가드마다**
> `1-auth.md` 에 동반 기록을 지켜 왔다" 고 적었는데 단일 선례에만 근거한 과잉 일반화였고
> 반례가 있다 — EIA terminal-revoke 스케줄러 등록 fail-fast 는
> `14-external-interaction-api.md`(자기 도메인)에 있다(실측 확인). 실제 규칙은
> "**auth 크로스커팅** 부트 가드는 `1-auth.md`, **도메인 고유** 가드는 각 도메인 spec" 이며,
> 이 캐너리는 `RolesGuard` 의 판별을 지키므로 전자다. 배치 결론은 그대로다.

### 신설 subsection (`### Production fail-closed 가드 …` 바로 다음)

```markdown
### 부트 캐너리 — `@WorkspaceId()` reflection 자가검증 (fail-closed, 2026-08-09)

`main.ts` bootstrap 은 `assertProductionConfig` 와 **별도 단계**로
`assertWorkspaceIdReflectionWorks(app)`(`common/decorators/workspace-reflection-canary.ts`)를
호출한다. `DiscoveryService` 로 등록된 전 컨트롤러를 훑어 `@WorkspaceId()` 를 소비하는 라우트
수를 세고, **0 이면 throw 해 기동을 멈춘다.**

**(a) 왜 reflection 을 자가검증하는가 — 실패 방향이 fail-open 이다.**
`RolesGuard` 는 "이 라우트가 워크스페이스 컨텍스트를 쓰는가" 를 `handlerConsumesWorkspaceId`
로 판별해 멤버십 검증 대상을 좁힌다(위 §"멤버십 검증은 가드 1곳에서" 의 단축 통과).
그 판별은 `@nestjs/common` 의 **비공개 export `ROUTE_ARGS_METADATA`** 와 **함수 identity 비교**
에 기댄다. 이 가정은 (1) Nest 내부 메타데이터 포맷 변경(`@nestjs/*` 는 caret `^11.0.1` 이라
minor/patch 로도 온다) (2) 핸들러를 감싸는 데코레이터 도입으로 `Function.name` 소실
(3) 빌드 minify/mangle 로 깨질 수 있고, 깨지면 판별이 **모든 라우트에 대해 false** 가 되어
멤버십 검증이 **조용히** 건너뛰어진다 — `#1103` 이 통째로 닫은 cross-tenant 결함 클래스가
그대로 되살아난다. **런타임에 조용히 새는 것보다 배포가 멈추는 편이 낫다.**

단언 대상은 **라우트 목록이 아니라 "0건이 아님"** 이다. 특정 라우트를 하드코딩하면 그것이
정당하게 사라질 때 오탐으로 깨지고, 결국 목록을 지우는 압력이 된다. 판별에는
`handlerConsumesWorkspaceId` 를 **그대로 호출**한다 — 캐너리가 reflection 을 다시 구현하면
자기 복제본을 검사하게 되어 정작 막으려던 파손을 통과시킨다.
**알려진 한계**: 부분 파손(일부 라우트만 인식 실패)은 잡지 못한다 → 인식 개수를 부팅 로그에
남겨 급락이 눈에 띄게 했다.

**(b) 왜 `SetMetadata` + `Reflector` opt-in 마커로 가지 않았는가 — 재기각이다.**
그쪽이 Nest 공식 확장점이지만 `@WorkspaceId()` 사용처마다 마커를 달아야 한다. 그것은
[data-flow §Rationale "멤버십 검증은 가드 1곳에서"](../data-flow/12-workspace.md#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08)
가 **이미 기각한 "라우트별 opt-in 마커"** 패턴이고(기각 사유: 74번째 라우트에서 같은 누락이
재발한다 — 이 저장소가 이미 최소 2회 겪었다), 그 기각을 되돌리지 않는다. 캐너리는 호출부에
아무것도 요구하지 않으면서 같은 위험을 닫는다.

**(c) 왜 `assertProductionConfig` 와 합치지 않았는가.**
축이 다르다. 저쪽은 **환경변수**(production 에서만 발화, dev/test 는 no-op)이고, 이쪽은
**환경과 무관한 구조 불변식**이다 — 모든 환경에서 발화해야 의미가 있다. 합치면 이름이
약속하는 범위("production config")를 넘고, production 게이팅이 이 단언까지 끌고 갈 위험이
생긴다.
```

### `12-workspace.md §"멤버십 검증은 가드 1곳에서"` 에 역참조 한 줄

```markdown
> **reflection 파손은 부트에서 막는다**: 위 단축 통과가 기대는 `handlerConsumesWorkspaceId`
> 는 Nest 비공개 API 에 의존해 파손 방향이 fail-open 이다 → 부팅 시 소비 라우트 수가 0 이면
> throw 하는 캐너리로 닫았다(`assertWorkspaceIdReflectionWorks`). 설계 근거는
> [`5-system/1-auth.md §Rationale "부트 캐너리"`](../5-system/1-auth.md#부트-캐너리--workspaceid-reflection-자가검증-fail-closed-2026-08-09).
```

---

## 6. `conventions/secret-store.md §2.1` — `deleteByPrefix` LIKE 메타문자 거부 각주

**현재 상태**: §2.1 호출 규약 표의 "Trigger 삭제" 행이 `deleteByPrefix('secret://triggers/{id}/')`
를 규정하지만, `#1109` 가 추가한 **입력 거부 불변식**이 없다.

**구현 (실측)**: `secret-resolver.service.ts` `deleteByPrefix` 는 기존 `secret://` 접두사 검사에
더해 `/[%_\\]/.test(prefix)` 면 throw 한다.

```diff
-| Trigger 삭제 | 해당 trigger 의 모든 ref 를 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제 (cascade 차원 — DB FK 가 없으므로 application 책임). 개별 `delete()` 보다 prefix 패턴 권장 |
+| Trigger 삭제 | 해당 trigger 의 모든 ref 를 `deleteByPrefix('secret://triggers/{id}/')` 로 일괄 삭제 (cascade 차원 — DB FK 가 없으므로 application 책임). 개별 `delete()` 보다 prefix 패턴 권장. **prefix 불변식 2건**: `secret://` 로 시작해야 하고, LIKE 메타문자(`%`·`_`·`\`)를 포함하면 **throw** 한다 (아래 각주 †) |
```

표 아래 각주:

```markdown
> **† `deleteByPrefix` 의 LIKE 메타문자 거부 (2026-08-09)**: 구현이 prefix 를 `ref LIKE :prefix`
> (`` `${prefix}%` ``) 로 쓴다. TypeORM 파라미터 바인딩이라 **SQL 인젝션은 아니지만**, prefix 에
> `%`(임의 문자열)·`_`(임의 1글자)가 섞이면 **의도보다 넓게 지워진다** — 삭제는 되돌릴 수 없어
> 방향이 나쁘다. `\`(LIKE 이스케이프 문자)도 같은 이유로 막는다.
>
> **이스케이프(`\%` + `ESCAPE` 절)가 아니라 거부인 이유**: 이 API 의 prefix 는 내부에서 조립하는
> **식별자 경로**라 메타문자가 정당하게 필요한 경우가 없다. 이스케이프는 없는 유스케이스를
> 위해 표면을 넓히는 쪽이다. §1 URI Scheme 이 정한 `secret://<scope>/<id>/<name>` 구조 자체가
> 메타문자를 배제한다.
>
> **"지금은 안전하다" 를 주석으로만 두지 않은 이유**: 착수 시점 프로덕션 호출부는
> `triggers.service.ts` 한 곳(`secret://triggers/${trigger.id}/`, `trigger.id` 는
> `@PrimaryGeneratedColumn('uuid')` 라 메타문자 불가)뿐이었다(전수 확인). 그러나 그 안전은
> **호출부 목록이 그대로일 때만** 참이라, 사용자 입력이 섞인 prefix 를 넘기는 호출부가 하나
> 생기면 주석은 아무것도 막지 못한다. 기존 `secret://` 접두사 검사와 같은 형태로 **입력 자체를
> 거부**해 그 조건을 없앴다.
>
> **알려진 검증 공백**: in-memory 테스트 mock 이 `startsWith` 라 LIKE 와일드카드 의미론을
> 재현하지 않는다 — "가드가 없으면 실제 Postgres 가 과다삭제한다" 는 아직 실행 가능한 테스트로
> 고정돼 있지 않다 ([`plan/in-progress/backend-lint-gate-broken-on-main.md`](../../plan/in-progress/backend-lint-gate-broken-on-main.md) §후속).
```

---

## 체크리스트

- [x] `/consistency-check --spec plan/in-progress/spec-draft-auth-invariants-sync.md` —
      **BLOCK: NO** (`review/consistency/2026/08/09/20_07_08`, 5/5 checker 전원 LOW,
      Critical 0 · WARNING 3 · INFO 4). WARNING 3건 **전부 반영**(각 항목에 반영 노트).
      세 건 다 checker 말을 그대로 받지 않고 **직접 실측해 확인**했고, 셋 다 checker 가 맞고
      내 초안이 틀렸다.
      > **첫 세션은 폐기했다** — 기본 예산(262144)에서 `spec/conventions/secret-store.md`·
      > `error-codes.md`·`spec-impl-evidence.md` 가 **전부 생략 목록에 들어가** 항목 1·6 이
      > 대상 규약 없이 검토될 상태였다(생략 265개 실측). `CONSISTENCY_MAX_CONTEXT_SIZE=1400000`
      > 으로 재생성해 세 파일이 `convention_compliance` 번들에 실린 것을 청크 헤더로 확인 후
      > 실행. 빈/부분 세션이 게이트를 거짓 통과시키는 것은 알려진 함정이라 폐기 세션은 지웠다.
      > **`5-system/`·`data-flow/` 본문은 어떤 실용 예산으로도 `related_specs` 에 못 싣는다** —
      > 자연 순서 누적 위치 실측으로 `12-workspace.md` 가 3.33MB 지점이라 필요 예산이 8.3MB 다.
      > 하네스의 생략 고지가 checker 에게 `Read` 를 지시하는 경로에 의존했고, 실제로
      > cross_spec 이 소스·spec 8건을 직접 열어 대조했다(그 결과가 WARNING #2 다).
- [x] 항목 1 — `3-error-handling.md §1.3` (변경 1-a/1-b/1-c). 코드 셀은 순수값으로 반영.
- [x] 항목 2 — `15-chat-channel.md §5.4` 파급
- [x] 항목 3 — `1-auth.md` frontmatter `code:` 3개 추가
- [x] 항목 4 — `12-workspace.md ## Rationale` 신설 + `1-auth.md §3.3` 포인터
- [x] 항목 5 — `1-auth.md ## Rationale` 신설 + `12-workspace.md` 역참조
- [x] 항목 6 — `conventions/secret-store.md §2.1` 행 + 각주
- [x] 원 plan 2건 체크박스 갱신 (`auth-guard-reflection-hardening.md` §후속 4건 ·
      `backend-lint-gate-broken-on-main.md` §후속 1건) + **자매 plan 의 틀린 단정문 정정**
      (consistency WARNING #3 — `plan/**` 은 planner 쓰기 범위인데 `codebase/**` 로 오분류해
      developer 백로그로 미룰 뻔했다)
- [x] 링크 무결성 회귀 (`spec-link-integrity` · `spec-plan-completion`) — 그 PR 이 실행했다:
      "spec 문서 가드 18파일 / 2815 tests PASS (link-integrity · code-paths · plan-frontmatter ·
      status-lifecycle 포함)" (커밋 `602f677cd` 메시지, 실측 인용)
- [x] commit + PR — [#1112](https://github.com/worker-ants/clemvion/pull/1112) (`602f677cd`)
      머지 완료 (2026-08-09 20:30)

## 후속 (이 PR 밖)

**developer 범위** (`codebase/**` 는 planner 권한 밖):

- [x] `common/utils/uuid.ts` docstring 의 캐너리 지목 정정 — "실제로 이 저장소의 e2e 하나가
      nil UUID 를 타 워크스페이스 프로브로 쓴다(`system-status.e2e-spec.ts`)" 는 **그 e2e 가
      이 술어에 닿지 않으므로** 오해를 부른다(위 §⚠️ 실측). 같은 파일의 단위 테스트
      (`uuid.spec.ts` 경계 테스트 · `workspace-context.util.spec.ts`)를 지목하도록 고칠 것.
      **spec 쪽은 이미 정정돼 있다** — `12-workspace.md` 신설 subsection 의 "캐너리 지목 정정"
      각주가 SoT 라, 이 항목이 미해소여도 잘못된 근거가 spec 을 통해 퍼지지는 않는다.
      > **완료 (2026-08-09, `backend-hygiene-followups`).** 소스 사본이 지목한 것보다 하나 더
      > 많았다 — `uuid.ts` docstring 외에 `uuid.spec.ts` 주석에도 같은 문장이 있었고, 그 PR 이
      > 신설한 `common/__test-utils__/workspace-id-fixtures.ts` 가 **세 번째 사본을 새로
      > 만들 뻔했다**(작성 시점엔 이 반증을 몰랐다). 셋 다 정정했다.
      > 그쪽 실측을 그대로 받지 않고 재확인했고(컨트롤러에 두 데코레이터 부재 → `RolesGuard`
      > 단축) 결론은 같았다. 추가로 **"이 둘이 유일한 방어선" 을 쓰기 전에 실측**했다:
      > `isUuidShaped` 프로덕션 호출부는 `workspace-context.util.ts:74` 한 곳뿐이고,
      > `roles.guard.spec.ts` 의 nil UUID 사용은 전역 라우트 케이스라 같은 단축에 걸려
      > 이 경계를 지키지 않는다 — 방어선으로 세면 안 된다고 `uuid.spec.ts` 에 명시했다.
- [x] 캐너리 주석의 "73건" 수치 정정 (원 plan 에 이미 등재 — 중복 등재 아님, 여기서는 포인터).
      > **완료 (2026-08-09, 동 PR)** — 추정치 대신 캐너리 자신의 부팅 로그 실측값 **142건**.
      > 두 수의 포함관계(HTTP 라우트 222 ⊇ `@WorkspaceId()` 소비 142 ⊇ `@Roles()` 미부착 73)를
      > 주석에 못박았다. 상세는 원 plan(`auth-guard-reflection-hardening.md §후속`).

> **`plan/**` 은 여기 없다.** 자매 plan(`auth-guard-reflection-hardening.md`)의 틀린 단정문은
> planner 쓰기 범위라 **이 PR 에서 직접 정정했다** — 초안은 그것까지 developer 로 넘겼는데
> `plan_coherence` 가 오분류를 잡았다(WARNING #3). 넘겼다면 그 plan 은 "이미 체크된 잘못된
> 근거" 를 단 채 `in-progress/` 에 남았을 것이다.

## Rationale

**왜 planner 턴인가.** 5건 전부 `spec/**` 쓰기다. `developer` 는 `spec/` read-only 이므로
두 구현 PR 이 정당하게 넘겼다. 코드가 spec 을 어긴 것이 아니라 **spec 이 새 케이스를 아직 안
적은 incompleteness** 라 두 `--impl-done` 모두 BLOCK:NO 였다.

**왜 한 PR 인가.** 5건이 같은 결함 클래스(`#1103`→`#1108` auth 경화가 남긴 문서 갭)이고,
항목 1·2·4 는 서로를 링크한다. 쪼개면 dangling 링크가 생기는 구간을 통과한다.

**새 결정은 없다.** 전부 이미 결정·구현·머지된 것의 기록이다. 단 하나 **정정**이 있는데
(항목 4 의 캐너리 지목), 그것도 결정이 아니라 **틀린 사실의 교정**이다 — 결정(비대칭은 의도)과
근거(403→400 뒤바뀜)는 그대로다.
