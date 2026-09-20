---
title: rotate 동시 실행의 계약 — 나중 저장이 먼저 통과한 교체를 덮지 않는다 (409)
status: draft
owner: project-planner
worktree: rotate-lost-update-4a1c73
started: 2026-09-20
spec_impact:
  - spec/2-navigation/4-integration.md
---

# rotate 의 동시성 계약을 정한다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«동시 rotate 두 건은 나중 저장이 먼저 통과한 교체를 조용히 덮는다» 를 구현하려면 **응답 계약이 먼저** 있어야 한다 —
지금 spec 에는 이 상황의 결과가 없고, 기존 코드에 쓸 만한 범용 conflict 코드도 없다(실측: 409 는 전부
`INTEGRATION_IN_USE` · `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 처럼 도메인 전용 코드다). 그래서 이 PR 은 **계약만** 정하고,
구현은 후속 developer PR 이 한다.

## 무엇이 어긋나 있나

`POST /api/integrations/:id/rotate` 는 읽기 → merge → **연결 테스트** → 부분 `update` 다. 연결 테스트는 2026-09-19 부터
Database · HTTP 에서 실제 접속이라 **수 초** 걸린다. 그 창 안에 같은 통합을 두 번 회전시키면 **둘 다 200 을 받고 나중
것만 남는다** — 사용자는 두 자격증명이 모두 저장됐다고 믿는다. spec 은 이 경우를 아예 말하지 않는다.

## 실측 (이 draft 를 쓰며 확인한 것)

- `rotate()` 는 `id` 만으로 `update` 한다 — 읽은 시점의 값을 조건에 넣지 않는다
  (`integrations.service.ts` `rotate()` 의 `update({ id: entity.id }, changes)`).
- **범용 conflict 코드가 없다**: 백엔드의 `code: '...'` 리터럴을 전수 집계해도 409 계열은 도메인 전용 둘뿐이다.
  그래서 구현은 새 코드를 필요로 하고, 새 코드는 planner 의 자리다. `INTEGRATION_ROTATE_CONFLICT` 는 저장소 전체
  grep 0건이다.
- **`last_rotated_at` 을 쓰는 경로는 넷**이다 — `rotate()` · `create()`(INSERT) · OAuth 재인증(`integration-oauth.service.ts`)
  · 토큰 갱신(`cafe24-api.client.ts` · `makeshop-api.client.ts`). 뒤의 셋은 **전부 OAuth 통합**이고 rotate 는 `oauth2` 를
  `INTEGRATION_ROTATE_UNSUPPORTED` 로 이미 거부하므로, **rotate 대상 행에서 그 컬럼을 움직이는 것은 rotate 뿐**이다.
- **`logUsage` 는 자격증명을 건드리지 않는다** — `last_used_at`(+ 실패 시 `last_error` · `status`)만 원자적 `update` 로 쓴다.
  즉 «통합을 쓰는 중» 이라는 사실은 교체 충돌이 아니다. 이 구분이 계약의 핵심이다(아래 ②).

## 변경안 — `spec/2-navigation/4-integration.md` 세 자리 + Rationale

### ① §9.4 공통 응답 포맷에 코드 한 줄

> `INTEGRATION_ROTATE_CONFLICT` (409) — rotate 가 읽은 자격증명 이후 **다른 교체가 먼저 커밋**됐다. 연결 테스트(실제
> 접속이라 수 초)가 도는 동안 같은 통합을 다른 요청·다른 사용자가 회전시킨 경우다. **먼저 커밋된 교체가 이긴다** —
> 나중 요청은 저장하지 않고 본 코드로 거부하며, 사용자는 현재 값을 다시 읽어 재시도한다. 이 코드를 받은 요청은
> **아무것도 바꾸지 않았다**(자격증명 · 상태 · `last_rotated_at` 전부 그대로).

### ② 같은 절에 «충돌이 아닌 것» 을 함께 못박는다 (①의 바로 아래 하위 항목)

> 통합을 **사용**하는 것은 충돌이 아니다 — 노드 실행이 남기는 `last_used_at` · `last_error` · 실패 시의 상태 전이는
> rotate 를 막지 않는다. 막으면 자주 쓰이는 통합일수록 자격증명을 못 바꾸게 된다. 충돌로 보는 사건은 **자격증명 자체의
> 교체**(rotate · 재인증 · 토큰 갱신)뿐이다.

### ③ §9.2 endpoint 표의 rotate 행 끝에 한 구

> … 내부적으로 테스트 → 성공 시만 커밋. **동시 교체**: 테스트가 도는 동안 다른 교체가 먼저 커밋되면 `409
> INTEGRATION_ROTATE_CONFLICT` 로 거부하고 아무것도 바꾸지 않는다 (§9.4).

### ④ §3 상세 화면 표의 «Rotate credentials (비OAuth)» 행 끝에 한 구

> … 실패 시 기존 자격 증명 유지. `INTEGRATION_ROTATE_CONFLICT` 면 «다른 곳에서 이미 자격 증명이 교체됐어요. 최신 상태를
> 불러온 뒤 다시 시도해 주세요» 안내와 함께 폼을 최신 값으로 다시 읽는다.

### ⑤ `## Rationale` 에 새 항목 — «rotate 동시 실행을 first-writer-wins 로»

- **왜 지금인가**: 창이 길어졌다. 연결 테스트가 구조 검증만이던 때는 읽기~저장이 밀리초였지만, Database · HTTP 가
  실제로 접속하게 되면서 **수 초**가 됐다(2026-09-19). 결함 자체는 그 전에도 있었다 — 길어진 창이 그것을 실용적 위험으로
  바꿨다.
- **왜 나중 요청이 지나**: 자격증명 교체는 «마지막에 누른 사람» 이 아니라 **먼저 검증을 통과해 저장된 값**이 진실이어야
  한다. 나중 요청을 조용히 이기게 두면, 먼저 성공한 사용자는 자기 값이 저장됐다고 믿은 채 그 값이 사라진다. 둘 다 200 을
  받는 지금이 정확히 그 상태다.
- **왜 «사용 중» 을 충돌로 보지 않나**: 위 ②. 사용 기록까지 충돌로 세면 «바쁜 통합은 교체할 수 없다» 가 되어, 고치려던
  것(자격증명 유실)보다 나쁜 결과를 만든다.
- **기각한 대안 — `@VersionColumn` 낙관적 잠금**: 정석이지만 **컬럼 신설 = 마이그레이션**이고, 한 엔티티에만 버전 컬럼을
  두면 다음 사람이 «왜 여기만» 을 묻는다(전 엔티티 정책은 이 항목의 크기를 넘는다). 지금 필요한 것은 rotate 한 경로의
  분실 방지이며, 그것은 **이미 있는 컬럼을 조건에 넣는 것**으로 마이그레이션 없이 닫힌다. 버전 컬럼은 낙관적 잠금이
  여러 엔티티에 필요해질 때 한 번에 도입한다.
- **구현 술어는 spec 이 정하지 않는다**: 어느 컬럼을 조건에 넣을지는 구현 세부다. 실측한 것은 하나다 — **rotate 대상
  행에서 `last_rotated_at` 을 움직이는 것은 rotate 뿐**이다(위 §실측). 트래커가 먼저 제안한 `updated_at` 조건에는
  **아직 검증하지 않은 의심**이 있다: `logUsage` 도 `repository.update()` 를 쓰므로 TypeORM 이 `@UpdateDateColumn` 을 함께
  올린다면 **정상 사용만으로 거짓 409** 가 난다. 이 draft 는 그것을 사실로 적지 않는다 — 후속 PR 이 실제 UPDATE 문으로
  확인한 뒤 술어를 고른다. 어느 쪽을 고르든 위 ②(사용은 충돌이 아니다)가 그 선택을 판정한다.

## 비대상

- **구현** — 조건부 `update` + 409 + 회귀 테스트는 후속 developer PR. 이 PR 은 `spec/` 과 트래커만 바꾼다.
- **`@VersionColumn` 도입** — 위 기각. 다른 엔티티에서도 필요해지면 그때 한 번에.
- **에러 코드의 지역화** — 트래커의 열린 항목(«연결 테스트 결과 코드가 지역화 사전에 없다»)과 같은 성격이다. 새 코드도
  그 목록에 함께 실린다 — 구현 PR 이 그 항목에 이름을 추가한다.

## 체크리스트

- [ ] `/consistency-check --spec …` → BLOCK: NO
- [ ] spec 네 자리 반영 (§9.4 두 항 · §9.2 · §3 · Rationale)
- [ ] 트래커: 이 항목을 «계약 확정 · 구현 후속» 으로 갱신 + developer 항목 재서술
- [ ] 이 draft `plan/complete/` 로
