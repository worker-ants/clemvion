---
title: swagger.md §2-4 — 광고한 성공 코드는 실제 성공 코드를 담는다 (가드 등재)
status: in-progress
owner: project-planner
worktree: post-status-openapi
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# spec draft — 광고 ↔ 실제 성공 코드 규칙과 가드 등재

구현 plan `plan/in-progress/post-status-openapi.md` 이 신설하는 저장소 가드 `http-status-advertised` 의 규칙을
`spec/conventions/swagger.md` 에 적고 가드를 `code:` 에 등재한다. `--impl-prep` `review/consistency/2026/09/26/09_10_09`
WARNING 1(cross_spec · rationale_continuity · convention_compliance 세 checker 가 독립적으로 지적)의 처분이다.

**왜 이 문서인가**: `swagger.md` 는 자기 조항을 세는 가드를 `code:` 에 등재해 왔다 — `swagger-dto-contract` ·
`dto-class-name-collision` · `user-entity-exposure` · `param-uuid-pipe`(§5-4 의 `@ApiParam` 축)와 각 대조군. 새 가드가 세는
것은 §2-4 의 광고 데코레이터와 실제 성공 코드의 짝이라 같은 자리다. `spec/5-system/2-api-convention.md` 의 `code:` 는 전역
필터 · 파이프 등 런타임 구현을 담고 OpenAPI 광고 가드를 담은 선례가 없어 등재하지 않는다.

**정하지 않는 것**: 자원을 만들지 않는 POST 액션이 200 이어야 하는지(§2-4 · api-convention §6 표에 «액션» 칸이 없다 —
`--impl-prep` WARNING 4, 트래커 등재)와, `workspaces.controller.ts` 의 삭제 응답을 204 로 옮길지(트래커의 planner 항목).
이 draft 가 적는 규칙은 **어느 코드를 고르든 광고와 실제가 짝을 이룬다**는 것뿐이다.

## 변경 (1) — frontmatter `code:`

`param-uuid-pipe` 두 줄 바로 아래에 넣는다.

```yaml
  # §2-4 의 광고한 성공 코드 ↔ 실제 성공 코드(`@HttpCode` · Nest 기본값) 짝을 세는 가드와 그 대조군.
  - codebase/backend/src/repo-guards/__tests__/http-status-advertised*.ts
  - codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/**
```

## 변경 (2) — §2-4 표 아래

`보호된 엔드포인트는 기본적으로 …` 문단 **앞에** 넣는다.

```markdown
**광고한 성공 코드는 실제 성공 코드를 담는다.** 실제 성공 코드는 `@HttpCode(n)` 이 있으면 n, 없으면 Nest 기본값(POST 201 ·
그 외 200)이다. 그래서 200 을 광고하는 POST 에는 `@HttpCode(HttpStatus.OK)` 가, 204 를 광고하는 DELETE 에는
`@HttpCode(HttpStatus.NO_CONTENT)` 가 함께 있어야 한다. `@Res()` 로 응답을 직접 쓰는 핸들러(SSE 등)도 같다 — Nest 는 핸들러를
부르기 전에 이 코드를 응답에 싣는다. 저장소 가드 `http-status-advertised` 가 강제한다. 성공 응답을 하나도 광고하지 않는
핸들러와 `@ApiExcludeEndpoint()` 핸들러는 대조하지 않는다.
```

## 변경 (3) — §5-4 체크리스트

`경로 UUID 파라미터는 …` 줄 **앞에** 넣는다.

```markdown
- [ ] 광고한 성공 코드(`ApiOk*` 200 · `ApiCreated*` 201 · `ApiNoContent*` 204 …)와 실제 성공 코드(`@HttpCode` 또는 Nest 기본값)가 짝을 이루는지 ([§2-4](#2-4-상태-코드-응답-규칙))
```

## 변경 (4) — `## Rationale` 끝

```markdown
### §2-4 광고한 성공 코드 ↔ 실제 성공 코드 — 왜 가드로 세는가 (2026-09-26)

광고는 응답 데코레이터에, 실제 코드는 `@HttpCode` 또는 Nest 기본값에 있어 둘을 한 번에 보는 곳이 없었다. 컴파일도 단위
테스트도 이 짝을 보지 않고, e2e 는 `[200, 201]` 로 둘 다 받아 불일치를 가렸다. 전수(2026-09-26, `src/modules` 핸들러 223개)에서
불일치가 15곳이었다 — 200 을 광고하는 POST 액션 14곳이 201 을 냈고, 204 를 광고하는 초대 취소 DELETE 가 200 을 냈다. 그중 둘
(MCP `preview-test` · 통합 `:id/test`)은 spec 본문이 이미 200 으로 적은 자리였다.

- **`@Res()` 를 면제하지 않는다.** SSE 핸들러는 «응답을 직접 쓰니 상태도 스스로 정한다» 고 보기 쉽지만, Nest 는 핸들러 호출
  전에 기본 상태를 싣는다(`@nestjs/core` `router-execution-context`). 가드 spec 의 캐너리가 이 동작을 실제 요청으로 고정한다 —
  Nest 가 동작을 바꾸면 그 캐너리가 먼저 RED 가 되고, 그때 면제를 다시 판단한다.
- **이름 → 코드 표를 손으로 쓰지 않는다.** `@nestjs/swagger` 는 2xx 데코레이터만 일곱을 내보낸다(203 · 205 · 206 포함). 손으로
  쓴 표는 지금 쓰는 이름만 담고, 새 이름을 쓰는 날 그 핸들러의 광고가 빈 집합이 되어 대조에서 조용히 빠진다. 그래서 팩토리를
  적용해 메타데이터에서 읽고, 저장소 래퍼는 이름 접두사가 아니라 내부 호출로 옮긴다. 표에 없는 `Api*Response` 는 실패다.
- **«광고가 있어야 한다» 는 이 규칙이 아니다.** 성공 응답을 광고하지 않는 핸들러(같은 날 15곳)는 대조할 것이 없어 건너뛴다.
  그쪽을 조이는 것은 광고를 채운 뒤의 별 결정이다(트래커 등재).
- **어느 코드가 맞는지는 이 규칙이 정하지 않는다.** 이번에 고친 14곳은 광고(200)에 실제를 맞췄다 — 자원을 만들지 않는 액션이고
  `@HttpCode(200)` 을 단 POST 42곳 중 광고가 있는 40곳이 전부 200 을 광고하며, §2-5 래퍼 표도 OAuth begin 분기 응답을 200 으로 적는다. 그러나 §2-4 ·
  api-convention §6 표에는 «자원을 만들지 않는 POST» 칸이 없다 — 그 명문화는 별 결정이다(트래커 등재).
```

## Rationale (이 draft 의)

- **§2-4 에 규칙을 적는 이유**: `code:` 에 가드만 등재하면 그 가드가 무엇을 강제하는지 본문에 근거가 없다
  (`spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 본문 약속의 시행 파일). param-uuid-pipe 도 §5-4 의 `@ApiParam`
  축이라는 본문 근거를 갖는다.
- **체크리스트에 한 줄을 더하는 이유**: §5-4 는 새 엔드포인트 작성자의 판단 기준이다. 가드가 막더라도 작성 시점에 알면 한 바퀴를
  줄인다 — §5-4 확장 배경(2026-08-08)이 적은 «규약 문구가 실제와 어긋나면 다음 작성자에게서 재발한다» 와 같은 이유다.
- **기각한 대안 — api-convention 에도 적고 등재한다** (`--impl-prep` WARNING 1 이 두 문서의 `code:` 를 함께 제안했다): §6 은 상태 코드의 **의미**(어느 상황에 어느 코드) 표다. 이 규칙은 의미가 아니라
  **문서와 동작의 짝**이라 OpenAPI 작성 규약인 swagger.md 가 자리다. §6 에 적으면 «액션 POST=200» 명문화와 섞여, 정하지 않기로
  한 결정을 이 draft 가 선점한 것처럼 읽힌다.
