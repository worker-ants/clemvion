---
title: 웹훅 경로 영구 예약 — 지우거나 바꾼 경로를 다른 워크스페이스가 다시 등록하지 못하게
status: in-progress
owner: project-planner
worktree: webhook-tombstone-de5b5f
started: 2026-09-19
spec_impact:
  - spec/1-data-model.md
  - spec/5-system/12-webhook.md
  - spec/2-navigation/2-trigger-list.md
  - spec/5-system/3-error-handling.md
  - spec/data-flow/10-triggers.md
---

# 웹훅 경로 영구 예약

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다 — 묘비
(tombstone) 부재»(2026-09-19 등재, `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` «비대상»)를 닫는다.

## 왜

V132 의 `(endpoint_path)` 전역 UNIQUE 는 **동시에 존재하는** 중복만 막는다. 주인이 트리거를 지우거나 경로를 바꾸면 옛 경로는 비고, 그 경로를
아는 누구든 자기 워크스페이스에 다시 등록할 수 있다. 외부 서비스가 옛 URL 로 계속 보내면 새 주인이 받는다.

경로를 «아는 사람» 은 생각보다 넓다. 공개 웹훅은 그 URL 을 받은 외부 서비스 · 워크스페이스의 뷰어 · 전 멤버가 안다. **웹챗은 더 넓다** —
[5-admin-console](../../spec/7-channel-web-chat/5-admin-console.md) 이 적듯 `endpointPath` 는 외부 사이트 스니펫에 그대로 박히는 공개
UUID 라, 그 사이트를 연 **누구나** 안다. 웹챗 인스턴스를 지워도 사이트에 남은 위젯은 옛 경로로 계속 요청한다 — 방문자 누구든 그 경로를 자기
워크스페이스에 등록하면 그 사이트의 대화를 받는다.

## 사용자 결정 (2026-09-19)

**영구 묘비** — 지우거나 바꾼 경로는 다른 워크스페이스가 영원히 쓸 수 없다. **같은 워크스페이스는 다시 쓸 수 있다.** 저장 비용은 경로
하나당 한 행. (기각: 기간 묘비 — 외부 서비스가 그보다 오래 옛 URL 로 보내면 여전히 위험하다. 막지 않음 — 경로가 추측 불가능해도 위처럼
**아는** 사람이 넓다.)

## 설계

결정한 동작을 **삭제 시점에 묘비를 쓰는 대신, 경로를 처음 쓸 때 예약하고 예약을 지우지 않는 것**으로 구현한다.

- **`webhook_endpoint_reservation`** — 경로의 소유 기록. `endpoint_path` PK · `workspace_id` FK → Workspace **ON DELETE SET NULL** ·
  `reserved_at`. 트리거가 어떤 `endpoint_path` 를 **처음** 가지는 순간(생성 · 경로 변경) 그 경로를 트리거의 워크스페이스 소유로 예약한다.
  **예약은 지우지 않는다** — 트리거를 지우거나 경로를 바꿔도 옛 경로는 그 워크스페이스 소유로 남는다.
- 다른 워크스페이스가 예약한 경로(주인 없는 예약 포함)로 트리거를 만들거나 경로를 바꾸면 거부한다 — **지금 쓰는 트리거와 겹칠 때와 같은
  응답**(409 `RESOURCE_CONFLICT` · `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT` · `details.field='endpoint_path'`). 경로가 한때 쓰였는지를
  응답으로 알려 주지 않는다.
- **같은 워크스페이스는** 자기 예약 경로를 다시 쓸 수 있다(지운 트리거를 같은 URL 로 다시 만들거나, 바꿨던 경로로 되돌리기).
- **워크스페이스를 지우면** 예약은 주인 없는 상태(`workspace_id` NULL)로 남아 **누구도** 그 경로를 쓸 수 없다 — 워크스페이스가 사라진 뒤에도
  외부 서비스 · 사이트의 위젯은 옛 URL 로 보낸다. 남는 것은 경로(UUID)와 시각뿐이다.
- **강제는 DB 가 한다** — `trigger` 의 `BEFORE INSERT OR UPDATE OF endpoint_path` 트리거가 예약을 시도(`INSERT … ON CONFLICT DO NOTHING`)하고
  주인이 다르면 `unique_violation` 을 낸다(제약 이름 `webhook_endpoint_reservation_owner` — 서비스가 기존 `idx_trigger_endpoint_path` 위반과
  함께 위의 409 로 옮긴다). V132 와 같은 원칙이다 — 앱 레벨 검사는 동시 요청을 막지 못한다. 새 경로를 동시에 잡는 두 요청은 PK 가 한쪽만
  통과시키고, 다른 쪽은 주인이 다르다는 것을 본다. 서비스 · 앞으로 생길 쓰기 경로 · 수동 SQL 을 모두 덮고, 트리거 행을 지우는 네 경로
  (트리거 · 워크플로 · 워크스페이스 삭제 등)는 건드릴 필요가 없다 — 예약은 삭제와 무관하게 이미 있다.
- **기존 데이터** — 마이그레이션이 지금 살아 있는 트리거의 경로를 각자의 워크스페이스로 예약한다(V132 로 경로는 이미 전역 유일이라 충돌이
  없다). **이미 지워진 경로는 기록이 없어 예약할 수 없다** — 보호는 배포 시점부터다.
- **수신**(`/api/hooks/:endpointPath`)은 그대로 — 예약만 있고 트리거가 없는 경로는 지금처럼 404.
- 인덱스: PK `(endpoint_path)` · `(workspace_id) WHERE workspace_id IS NOT NULL` — 워크스페이스 삭제의 FK `SET NULL` 이 테이블을 훑지 않게
  (FK 인덱스 원칙 — [데이터 모델 Rationale «쓸 인덱스가 없는 FK 서른하나의 처분»](../../spec/1-data-model.md)).

## 변경

### A. `spec/1-data-model.md`

- §1 ER — `Workspace` 아래 `├── WebhookEndpointReservation (1:N, 웹훅 경로 예약 — 지우지 않음, §2.8.1)` 한 줄.
- §2.8 `endpoint_path` 행 설명 끝에 «한 번 쓴 경로는 그 워크스페이스 소유로 **영구 예약**된다(§2.8.1)».
- **§2.8.1 WebhookEndpointReservation** 신설 — 위 «설계» 의 표(필드 · 타입 · 설명)와 규칙(예약 시점 · 지우지 않음 · 같은 워크스페이스 재사용 ·
  주인 없는 예약 · DB 트리거 강제 · 인덱스).
- §3 인덱스 표 — `WebhookEndpointReservation | (endpoint_path) PK · (workspace_id) WHERE workspace_id IS NOT NULL | …` 행.
- `## Rationale` 맨 위 새 절 «지운 · 바꾼 웹훅 경로의 영구 예약 (2026-09-19)» — 왜(웹챗 공개 UUID 포함) · 결정 · 삭제 시점 묘비 대신 사용 시점
  예약을 택한 이유(삭제 경로 넷을 건드리지 않음 · 경합이 PK 하나로 끝남) · DB 트리거인 이유 · 기존 데이터의 한계.
- 기존 절 «Webhook `endpoint_path` 전역 유일» 의 **남는 틈** 단락 끝에 «(2026-09-19 해소 — 위 «지운 · 바꾼 웹훅 경로의 영구 예약»)».

### B. `spec/5-system/12-webhook.md` «endpointPath 가변성»

넷째 불릿 끝에: «**지우거나 바꾼 뒤의 옛 경로**도 그 워크스페이스 소유로 영구 예약돼 다른 워크스페이스가 쓸 수 없다 — 같은 워크스페이스는
다시 쓸 수 있다(`[데이터 모델 §2.8.1](../1-data-model.md#281-webhookendpointreservation)`).»

### C. `spec/2-navigation/2-trigger-list.md`

§2 편집 표 `endpointPath` 행 · §3 PATCH 본문 주석 두 곳의 «`(endpoint_path)` UNIQUE(전역 — 다른 워크스페이스의 트리거와도 겹칠 수 없다) 위반 시»
→ «`(endpoint_path)` UNIQUE(전역 — 다른 워크스페이스의 트리거와도 겹칠 수 없다) 위반, **또는 다른 워크스페이스가 예약한 경로**(지웠거나 바꾼
경로 — `[데이터 모델 §2.8.1](../1-data-model.md#281-webhookendpointreservation)`) 시».

### D. `spec/5-system/3-error-handling.md`

`TRIGGER_ENDPOINT_PATH_CONFLICT` 행 설명 → «같은 `endpointPath` 를 쓰는 트리거가 이미 존재하거나(다른 워크스페이스의 트리거 포함 — 전역
유일), 다른 워크스페이스가 예약한 경로다(지웠거나 바꾼 경로 — 데이터 모델 §2.8.1). 둘을 구분하지 않는다. `details.field='endpoint_path'`».

### E. `spec/data-flow/10-triggers.md`

«정정 (2026-09-18)» 인용 블록 아래에: «> **추가 (2026-09-19)**: 지우거나 바꾼 옛 경로도 그 워크스페이스 소유로 영구 예약된다 — 전역 UNIQUE 가
막지 못하던 «비운 뒤 복사» 를 막는다. `[데이터 모델 §2.8.1](../1-data-model.md#281-webhookendpointreservation)`.»

## 비대상

- **이미 지워진 경로** — 기록이 없다. 감사 로그(`trigger.deleted`)에 경로가 남는지 보지 않았다 — 남더라도 비밀 키를 감사 로그에서 되살리는
  마이그레이션은 하지 않는다.
- 예약을 **풀어 주는** 운영 기능(관리자가 특정 경로를 해제) — 필요가 생기면 따로.
- 트래커의 «실측 필요: 지운 트리거의 경로로 실제 트래픽이 계속 오는지(수신 404 로그)» — 결정이 영구 예약이라 트래픽 양과 무관하다.

## Rationale

- **삭제 시점 묘비가 아니라 사용 시점 예약인 이유**: 결과(다른 워크스페이스는 영원히 못 쓰고 같은 워크스페이스는 쓸 수 있다)는 같다. 삭제 시점에
  쓰면 트리거 행을 없애는 경로 넷(#1346)과 경로 변경에 모두 손대야 하고, «삭제와 다른 워크스페이스의 등록이 겹치는» 경합을 따로 막아야 한다.
  사용 시점에 쓰면 쓰기 지점이 둘(생성 · 경로 변경)뿐이고, 예약은 삭제 전부터 이미 있으므로 그 경합이 생기지 않는다.
- **DB 트리거인 이유**: V132 가 비유일 보조 인덱스 + 앱 레벨 검사를 기각한 이유(동시 요청 경합을 DB 가 막지 못한다)와 같다. 이 저장소는 이미
  `updated_at` 갱신에 DB 트리거를 쓴다(V001 `update_updated_at_column`).
- **응답을 구분하지 않는 이유**: «예약됨» 을 따로 알리면 그 경로가 한때 쓰였다는 사실이 새어 나간다.

## 체크리스트

- [ ] `--spec` 이 draft
- [ ] spec 반영 (planner 커밋)
- [ ] 구현 (developer, 같은 PR) — V133(테이블 · 인덱스 · 백필 · DB 트리거) · 엔티티 · 서비스의 409 매핑 · e2e
- [ ] 트래커 해소 · 이 draft `plan/complete/` 로
