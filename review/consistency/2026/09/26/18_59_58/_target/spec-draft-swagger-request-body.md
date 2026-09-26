---
title: swagger.md §5-4 — 요청 본문을 받는 라우트는 본문 스키마를 광고한다 (가드 등재)
status: in-progress
owner: project-planner
worktree: request-body-guard
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# spec draft — 요청 본문 스키마의 광고

구현 plan `plan/in-progress/request-body-guard.md` 이 저장소 가드 `request-body-advertised` 를 세운다. `spec/conventions/swagger.md` 가 그
규칙의 자리다. 지금 규약은 요청 본문에 대해 **이름**(§1-7 `Update` 접두)만 적고, 본문 스키마를 광고해야 한다는 규칙은 없다.

**왜 지금**: `rotate-bot-token-body`(#1408)가 OpenAPI 에 요청 본문이 없던 라우트 3곳을 채워, `@Body()` 78개 중 스키마를 광고하지 않는
자리가 0이 됐다(DTO 클래스 74 · 인라인 타입 + `@ApiBody` 4). 규칙이 없으면 다음 라우트가 인라인 타입을 쓰는 순간 다시 빈다.

## 변경안

### 1. §5-4 체크리스트 — 한 줄 추가

«경로 UUID 파라미터» 줄 앞에:

> - [ ] 요청 본문을 받는 라우트(`@Body()`)는 본문 스키마를 광고한다 — 파라미터를 DTO 클래스로 받으면 플러그인이 스키마를 만든다. 클래스로
>       받을 수 없으면(전역 `CustomValidationPipe` 는 클래스 파라미터에만 진입해 `whitelist` · `forbidNonWhitelisted` 로 에러 코드와 여분 키
>       처리를 바꾼다) **문서 전용 DTO**(class-validator 데코레이터 없이 `@ApiProperty` 만)를 `@ApiBody({ type })` 로 광고하고 파라미터는
>       인라인 타입을 유지한다. 형태를 발신자가 정하는 본문(외부 웹훅)은 `@ApiBody({ schema: {} })`. 저장소 가드 `request-body-advertised`
>       가 **모든 라우트**에서 `@Body()` 자리의 설계 타입이 클래스가 아닌데 `@ApiBody` 가 없는 자리를 잡는다(`@ApiExcludeEndpoint()` 제외).

### 2. frontmatter `code:` — 가드 등재

`forbidden-response-codes*.ts` 줄 뒤에:

```yaml
  # §5-4 의 요청 본문 스키마 — `@Body()` 설계 타입이 클래스가 아니면 `@ApiBody` 필수(reflection, 대조군은 spec 안의 클래스).
  - codebase/backend/src/repo-guards/__tests__/request-body-advertised*.ts
```

### 3. Rationale — 한 절 추가

`### §5-4 403 설명의 거부 코드 — …` 절 뒤에:

> ### §5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가 (2026-09-26)
>
> 2026-09-26 실측(`src/modules` 컨트롤러의 `@Body()` 78개): OpenAPI 에 요청 본문이 없던 라우트 3곳(`rotate-bot-token` · 실행 `continue` ·
> 웹훅 수신)을 채운 뒤 DTO 클래스 74 · 인라인 타입 + `@ApiBody` 4 — 광고하지 않는 자리 0.
>
> - **클래스로 받게 강제하지 않는다.** 전역 `CustomValidationPipe` 는 파라미터 설계 타입이 클래스일 때만 진입하고, 진입하면
>   `whitelist` · `forbidNonWhitelisted` 가 켜진다. 인라인 타입으로 받던 라우트를 클래스로 바꾸면 문서를 다는 작업이 **계약 변경**이
>   된다 — `rotate-bot-token` 은 비-string `newBotToken` 에 spec 이 약속한 `INVALID_BOT_TOKEN`(`15-chat-channel.md` §5.4) 대신
>   `VALIDATION_ERROR` 를 내고, 여분 키를 보내던 요청이 400 이 된다. 그래서 트래커가 처음 적었던 처방(«요청 DTO 승격»)을 택하지 않고
>   문서 전용 DTO 를 `@ApiBody` 로만 쓴다. 선례는 `ExecuteWorkflowDto`(워크플로 실행 본문 — 캐너리 `workflows-execute-body.spec.ts`).
> - **reflection 으로 센다.** 판정 축은 파이프가 받는 바로 그 값이어야 한다 — 파이프는 `design:paramtypes` 가 `Object` · `String` ·
>   `Number` · `Boolean` · `Array` 면 건너뛰고, 그 자리는 플러그인도 스키마를 만들지 못한다. 소스(AST)로는 `interface` · 타입 별칭
>   참조가 런타임에 `Object` 가 되는 것을 클래스 참조와 구별할 수 없다.
> - **못 보는 것.** `@ApiBody` 가 **맞는** DTO 를 가리키는지는 라우트별 캐너리(`*-body.spec.ts`)가 본다 — 이 가드는 광고의 **존재**만 센다.
>   클래스 파라미터의 DTO 가 실제 본문과 맞는지도 이 가드 밖이다(요청 쪽 검증은 파이프가 한다).

## Rationale

- **왜 §5-4 체크리스트인가**: §5-4 는 새 엔드포인트를 쓸 때 보는 자리이고, 형제 규칙(403 설명의 거부 코드 · 광고한 성공 코드 짝 · 경로
  UUID 파라미터)이 모두 이 체크리스트에 한 줄씩 있다 — 그중 403 줄은 가드 이름(`forbidden-response-codes`)까지 적는다. 요청 본문도 같은 층이다.
- **왜 §1-7 명명 행은 이번에 넣지 않나**: 문서 전용 요청 DTO 의 이름(`<Domain><Action>RequestDto`)을 정하려면 이미 있는 이름(`ExecuteWorkflowDto`
  — 접미 없음 · `ContinueExecutionRequestDto` 의 어순)을 어떻게 다룰지 함께 정해야 한다. DTO 이름은 OpenAPI 컴포넌트 이름이라 바꾸면 생성
  클라이언트의 타입명이 바뀐다. 가드는 이름과 무관하므로 두 결정을 섞지 않는다 — 트래커에 남긴다.
- **소급**: 이 규칙도 §2-4 · 403 과 같이 **광고가 실제와 맞는가** 의 문제라 기존 라우트까지 가드가 본다. 베이스라인 0 이라 소급 비용이 없다.
