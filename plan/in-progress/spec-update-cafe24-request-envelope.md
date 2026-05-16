---
worktree: cafe24-request-envelope-fix-a1b2c3
started: 2026-05-16
owner: developer
---

> 본 노트는 spec 본문 수정을 `project-planner` 에 위임하기 위한 인계서다 — 본 PR 의 코드 fix 와 결속되어 있다.

# spec-update: Cafe24 `request` envelope 규약 문서화

## 배경

운영에서 `mcp_b74e1adc__product_update` 호출이 Cafe24 의 `400 "Please enter the Request parameter."` 로 실패. 원인은 Cafe24 Admin API 의 POST/PUT 본문이 반드시 다음 형태의 envelope 을 요구하는데, 현재 spec 어디에도 이 규약이 명시되어 있지 않아 신규 endpoint metadata 를 추가할 때마다 동일 함정에 빠질 수 있다는 점.

```json
{
  "shop_no": 1,
  "request": { ... }
}
```

코드 fix 는 `claude/cafe24-request-envelope-fix-a1b2c3` 브랜치에서 `Cafe24ApiClient` 한 곳에 적용 완료 (handler/provider 는 flat body 그대로 전달 — wire format 변환은 client 의 책임). 본 문서는 spec 갱신 제안만 정리한다 (`spec/` 쓰기 권한은 project-planner).

## 갱신 제안

### 1. `spec/conventions/cafe24-api-metadata.md`

§2 "Operation 메타데이터 형식" 또는 §3 "예시" 뒤에 새 절을 추가:

> ## N. Wire-format 규약 — POST/PUT envelope
>
> Cafe24 Admin API 의 POST/PUT 본문은 반드시 다음 형태로 직렬화된다:
>
> ```json
> { "shop_no": <n>, "request": { ...payload } }
> ```
>
> - `shop_no` 만 top-level 에 두고, 나머지 모든 필드는 `request` 안으로 wrap.
> - envelope 변환은 `Cafe24ApiClient` 가 일괄 처리 — metadata 의 `location: 'body'` 필드는 caller 가 flat 한 객체로 넘기면 client 가 자동으로 wrap.
> - `shop_no` 가 body 에 없으면 `{ "request": { ... } }` 만 전송.
> - body 에 `shop_no` 만 있고 다른 필드가 없는 (degenerate) 케이스도 `{ "shop_no": <n>, "request": {} }` 로 보내 Cafe24 의 파서가 `request` 키 부재로 400 을 내지 않도록 한다.
>
> 본 규약을 누락하면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다. 신규 metadata row 를 추가할 때는 `location: 'body'` 필드 분류만 신경 쓰면 되고, envelope 은 자동.

### 2. `spec/4-nodes/4-integration/4-cafe24.md` §4.1 (Wrapper 책임)

기존 wrapper 책임 bullet 목록(`Authorization` 부여, leaky bucket, 토큰 refresh, mutex 등) 에 다음 한 줄 추가:

> - POST/PUT 본문을 Cafe24 `request` envelope 으로 자동 wrap (자세한 규약: `spec/conventions/cafe24-api-metadata.md`).

### 3. (선택) Rationale 보강

`spec/4-nodes/4-integration/4-cafe24.md` 끝의 `## Rationale` 절에 다음 결정 기록:

> ### envelope wrapping 의 위치
>
> envelope 적용 지점 후보는 (a) handler/provider 의 body 구성 단계, (b) `Cafe24ApiClient` 의 wire 직렬화 단계 두 가지. (b) 채택 이유:
>
> - envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다 — client 가 이미 URL prefix·leaky bucket·token refresh 같은 Cafe24 고유 책임을 갖고 있어 SRP 정합.
> - handler/provider 두 곳이 같은 splitting 로직을 중복 보유하므로 단일 지점 fix 가 drift 를 방지.
> - 외부 시그니처(`Cafe24CallOptions.body: Record<string, unknown>`) 는 변경 없음 — caller 는 flat 객체로 넘기면 됨.

## 변경 결과 확인

- 코드: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 새 helper `wrapInCafe24Envelope` 와 `executeWithRateLimit` 의 호출부.
- 테스트: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` 의 `'happy path'` describe 안 envelope 단언 4건.

## 후속 처리

- project-planner 가 본 노트를 검토 후 위 3 절에 해당하는 spec 본문 수정을 진행.
- 본 plan 문서는 spec 수정 완료 시점에 `plan/complete/` 로 이동.
