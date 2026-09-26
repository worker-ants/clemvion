---
title: swagger.md §2-4 — 광고한 성공 코드는 실제 성공 코드를 담는다 (가드 등재)
status: complete
owner: project-planner
worktree: post-status-openapi
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# spec draft — 광고 ↔ 실제 성공 코드 규칙과 가드 등재

구현 plan `plan/complete/post-status-openapi.md` 이 신설하는 저장소 가드 `http-status-advertised` 의 규칙을
`spec/conventions/swagger.md` 에 적고 가드를 `code:` 에 등재한다. `--impl-prep` `review/consistency/2026/09/26/09_10_09`
WARNING 1(cross_spec · rationale_continuity · convention_compliance 세 checker 가 독립적으로 지적)의 처분이다.

**왜 이 문서인가**: `swagger.md` 는 자기 조항을 세는 가드를 `code:` 에 등재해 왔다 — `swagger-dto-contract` ·
`dto-class-name-collision` · `user-entity-exposure` · `param-uuid-pipe`(§5-4 의 `@ApiParam` 축)와 각 대조군. 새 가드가 세는
것은 §2-4 의 광고 데코레이터와 실제 성공 코드의 짝이라 같은 자리다. `spec/5-system/2-api-convention.md` 에는 등재하지
않는다 — 그 문서의 `code:` 도 `swagger-dto-contract` · `response-contract` 같은 OpenAPI 대조 검증자를 담지만, 그것은 §5.4
«검증 층» 이 적듯 **그 문서가 명문화한 규칙**(§5.4 의 required/nullable 축)을 한 코드가 겸해 시행하기 때문이다. 이 가드가
시행하는 «광고 = 실제 성공 코드» 는 api-convention 어디에도 명문화돼 있지 않다(§6 은 코드의 **의미**만 정의한다).

**정하지 않는 것**: 자원을 만들지 않는 POST 액션이 200 이어야 하는지(§2-4 · api-convention §6 표에 «액션» 칸이 없다 —
`--impl-prep` WARNING 4, 트래커 등재)와, `workspaces.controller.ts` 의 삭제 응답을 204 로 옮길지(트래커의 planner 항목).
이 draft 가 적는 규칙은 **어느 코드를 고르든 광고와 실제가 짝을 이룬다**는 것뿐이다.

## 변경 (1) — frontmatter `code:`

목록 **끝**(`fixtures/dto-class-collision/*.ts` 아래)에 넣는다 — `param-uuid-pipe` 바로 아래에 두면 그 뒤 주석 «위 두 가드가
강제하는 위반 형태의 실례» 의 지시 대상이 흐려진다(반영 시 발견).

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
- [ ] 광고한 성공 코드(`ApiOk*` · `ApiCreated*` · `ApiAccepted*` · `ApiNoContent*` · `ApiResponse({ status })` 등 성공 응답 데코레이터 전부 — 저장소 래퍼 포함)와 실제 성공 코드(`@HttpCode` 또는 Nest 기본값)가 짝을 이루는지 ([§2-4](#2-4-상태-코드-응답-규칙))
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
- **이름 → 코드 표를 손으로 쓰지 않는다.** `@nestjs/swagger` 는 2xx 데코레이터만 해도 일곱을 내보낸다(203 · 205 · 206 포함). 손으로
  쓴 표는 지금 쓰는 이름만 담고, 새 이름을 쓰는 날 그 핸들러의 광고가 빈 집합이 되어 대조에서 조용히 빠진다. 그래서 팩토리를
  적용해 메타데이터에서 읽고, 저장소 래퍼는 이름 접두사가 아니라 내부 호출로 옮긴다. 표에 없는 `Api*Response` 는 실패다.
- **«광고가 있어야 한다» 는 이 규칙이 아니다.** 성공 응답을 광고하지 않는 핸들러(같은 날 15곳)는 대조할 것이 없어 건너뛴다.
  그쪽을 조이는 것은 광고를 채운 뒤의 별 결정이다(트래커 등재).
- **어느 코드가 맞는지는 이 규칙이 정하지 않는다.** 이번에 고친 14곳은 광고(200)에 실제를 맞췄다 — 액션이고, `@HttpCode(200)` 을
  단 POST 42곳 중 광고가 있는 40곳이 전부 200 을 광고한다. 두 자리는 행이 생긴다: OAuth begin 은 cafe24 Private · MakeShop 분기에서
  설치 대기 통합 행을 만들고(§2-5 래퍼 표가 그 분기 응답을 200 으로 적는다), 초대 수락은 멤버십 행을 만든다(1차 자원은 소비되는
  초대이고 응답은 기존 워크스페이스다). 둘 다 설치 · 합류 흐름의 부수효과로 보고 200 을 유지했다. 그러나 §2-4 ·
  api-convention §6 표에는 «자원을 만들지 않는 POST» 칸이 없다 — 그 명문화는 별 결정이다(트래커 등재).
```

## Rationale (이 draft 의)

- **§2-4 에 규칙을 적는 이유**: `code:` 에 가드만 등재하면 그 가드가 무엇을 강제하는지 본문에 근거가 없다
  (`spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 본문 약속의 시행 파일). param-uuid-pipe 도 §5-4 의 `@ApiParam`
  축이라는 본문 근거를 갖는다.
- **체크리스트에 한 줄을 더하는 이유**: §5-4 는 새 엔드포인트 작성자의 판단 기준이다. 가드가 막더라도 작성 시점에 알면 한 바퀴를
  줄인다 — §5-4 확장 배경(2026-08-08)이 적은 «규약 문구가 실제와 어긋나면 다음 작성자에게서 재발한다» 와 같은 이유다.
- **기각한 대안 — api-convention 에도 적고 등재한다** (`--impl-prep` WARNING 1 이 두 문서의 `code:` 를 함께 제안했다): 그 문서의
  이중 등재 선례(`response-contract` 등)는 §5.4 «검증 층» 의 규칙 — **한 검증자가 두 문서 각각의 명문화된 규칙을 겸해 시행하면
  양쪽에 등재한다** — 을 따른 것이다. 이 가드는 api-convention 의 규칙을 시행하지 않는다: §6 은 상태 코드의 **의미**(어느 상황에
  어느 코드) 표이고, 이 규칙은 의미가 아니라 **문서와 동작의 짝**이라 OpenAPI 작성 규약인 swagger.md 가 자리다. §6 에 적으면 «액션 POST=200» 명문화와 섞여, 정하지 않기로
  한 결정을 이 draft 가 선점한 것처럼 읽힌다.
- **`--spec` 경고 처리** (`review/consistency/2026/09/26/09_22_45` BLOCK: NO · Warning 3): W1 — «api-convention 에는 OpenAPI 광고
  가드 선례가 없다» 는 **틀렸다**(그 문서 `code:` 에 `swagger-dto-contract` · `response-contract` 가 있다). 결론은 유지하고 근거를
  §5.4 «검증 층» 의 이중 등재 규칙으로 바꿨다. W2 — 변경 (4) 의 «자원을 만들지 않는 액션» 전칭이 `--impl-prep` W2 에서 정정한
  오류를 되살렸다 — OAuth begin · 초대 수락의 행 생성을 적었다. W3 — 체크리스트 예시가 `ApiAccepted*` · `ApiResponse` 를 빠뜨렸다 —
  «전부» 로 넓혔다. INFO 1(api-convention §6 에서 §2-4 역참조)은 트래커의 «상태 코드 표에 액션 칸이 없다» 항목에 함께 적었다
  (같은 표를 고치는 planner 턴).
