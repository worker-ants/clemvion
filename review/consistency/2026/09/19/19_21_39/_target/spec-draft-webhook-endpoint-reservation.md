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
- **강제는 DB 가 한다** — `trigger` 의 `BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id` 트리거
  `trg_trigger_reserve_endpoint_path`(V001 의 `trg_trigger_updated_at` 과 별개)가 예약을 시도(`INSERT … ON CONFLICT DO NOTHING`)하고
  주인이 다르면 `unique_violation` 을 낸다. 붙이는 이름 `webhook_endpoint_reservation_owner` 는 **DB 에 실재하는 제약이 아니라** 트리거가
  `RAISE … USING CONSTRAINT` 로 붙이는 라벨이다(예약 테이블의 실제 제약은 PK 하나). 서비스의 판정 함수(`triggers.service.ts`
  `isEndpointPathUniqueViolation` — 지금은 `idx_trigger_endpoint_path` 하나만 안다)가 **두 이름을 모두** 위의 409 로 옮겨야 한다 —
  하나만 알면 예약 위반이 500 으로 나간다. `workspace_id` 를 함께 감시하는 이유: 정상 경로엔 트리거를 다른 워크스페이스로 옮기는 쓰기가
  없지만, 옮기면 예약 주인과 달라진다. V132 와 같은 원칙이다 — 앱 레벨 검사는 동시 요청을 막지 못한다. 새 경로를 동시에 잡는 두 요청은 PK 가 한쪽만
  통과시키고, 다른 쪽은 주인이 다르다는 것을 본다. 서비스 · 앞으로 생길 쓰기 경로 · 수동 SQL 을 모두 덮고, 트리거 행을 지우는 네 경로
  (트리거 · 워크플로 · 워크스페이스 삭제 등)는 건드릴 필요가 없다 — 예약은 삭제와 무관하게 이미 있다.
- **기존 데이터** — 마이그레이션이 지금 살아 있는 트리거의 경로를 각자의 워크스페이스로 예약한다(V132 로 경로는 이미 전역 유일이라 충돌이
  없다). **이미 지워진 경로는 기록이 없어 예약할 수 없다** — 보호는 배포 시점부터다.
- **수신**(`/api/hooks/:endpointPath`)은 그대로 — 예약만 있고 트리거가 없는 경로는 지금처럼 404.
- 인덱스: PK `(endpoint_path)` · `(workspace_id) WHERE workspace_id IS NOT NULL` — 워크스페이스 삭제의 FK `SET NULL` 이 테이블을 훑지 않게
  (FK 인덱스 원칙 — [데이터 모델 Rationale «쓸 인덱스가 없는 FK 서른하나의 처분»](../../spec/1-data-model.md)).

## 실측 — 프로토타입 (2026-09-19, 일회용 `pgvector/pgvector:pg18` 에 V001~V132 + 테이블 · 부분 인덱스 · plpgsql 트리거)

pg 드라이버로 시나리오를 돌렸다(드라이버가 받는 `code` · `constraint` 까지):

| # | 동작 | 결과 |
|---|---|---|
| 1 | A 가 경로 사용 | OK |
| 2 | A 가 쓰는 중에 B 가 같은 경로 | `23505` · `webhook_endpoint_reservation_owner` — 전역 UNIQUE 보다 **예약 트리거가 먼저** 막는다 |
| 3 · 4 | A 가 트리거 삭제 → B 가 그 경로 | 삭제 OK → B 는 `23505` · 같은 제약 |
| 5 | A 가 자기 옛 경로로 다시 만듦 | OK |
| 6 · 7 | A 가 경로 변경 → B 가 A 의 옛 경로 | 변경 OK → B 는 `23505` |
| 8 | A 가 이름만 변경(`endpoint_path` 안 건드림) | OK — 트리거가 발화하지 않는다 |
| 9 · 10 · 11 | A 워크스페이스 삭제 → 예약 확인 → B 가 그 경로 | 삭제 OK → 예약 두 행 `workspace_id` NULL → B 는 `23505` |

2번이 서비스 매핑의 요점이다 — 살아 있는 트리거와 겹쳐도 먼저 걸리는 것은 예약 쪽이라, 서비스는 `idx_trigger_endpoint_path` 와
`webhook_endpoint_reservation_owner` **둘 다** 같은 409 로 옮겨야 한다.

## 변경

### A. `spec/1-data-model.md`

- §1 ER — `Workspace` 아래 `├── WebhookEndpointReservation (1:N, 웹훅 경로 예약 — 지우지 않음, §2.8.1)` 한 줄.
- §2.8 `endpoint_path` 행 설명 끝에 «한 번 쓴 경로는 그 워크스페이스 소유로 **영구 예약**된다(§2.8.1)».
- **§2.8.1 WebhookEndpointReservation** 신설 — 위 «설계» 의 표(필드 · 타입 · 설명)와 규칙(예약 시점 · 지우지 않음 · 같은 워크스페이스 재사용 ·
  주인 없는 예약 · DB 트리거 강제 · 인덱스). FK 는 §2 표기(Rationale «§2 FK 삭제 동작 · 빠진 컬럼») 짧은 형 `(SET NULL)`. PK 가 UUID
  대리키가 아니라 `endpoint_path` 인 이유(예약 대상이 곧 경로라 별도 id 가 할 일이 없다)를 표 아래 한 줄로 적는다.
- §3 인덱스 표 — `WebhookEndpointReservation | (endpoint_path) PK · (workspace_id) WHERE workspace_id IS NOT NULL | …` 행.
- `## Rationale` 맨 위 새 절 «지운 · 바꾼 웹훅 경로의 영구 예약 (2026-09-19)» — 왜(웹챗 공개 UUID 포함) · 결정 · 삭제 시점 묘비 대신 사용 시점
  예약을 택한 이유(삭제 경로 넷을 건드리지 않음 · 경합이 PK 하나로 끝남) · DB 트리거인 이유 · 기존 데이터의 한계. 첫머리에서 이 절이 아래
  «Webhook `endpoint_path` 전역 유일» 의 **남는 틈**이 예고한 묘비에 대한 답임을 밝힌다.
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
§1.10 첫 문단의 «`(endpoint_path)` UNIQUE 제약(전역)을 위반할 때» 에 «또는 다른 워크스페이스가 예약한 경로를 쓸 때» 를 더하고, 둘을 한 코드로
묶은 이유(따로 알리면 그 경로가 한때 쓰였다는 사실이 새어 나간다)를 한 문장 싣는다 — 이름이 부정확한 코드가 아니라 의도한 통합이라
[error-codes §3](../../spec/conventions/error-codes.md) 레지스트리 행은 필요 없다.

### E. `spec/data-flow/10-triggers.md`

«정정 (2026-09-18)» 인용 블록 아래에: «> **추가 (2026-09-19)**: 지우거나 바꾼 옛 경로도 그 워크스페이스 소유로 영구 예약된다 — 전역 UNIQUE 가
막지 못하던 «비운 뒤 복사» 를 막는다. `[데이터 모델 §2.8.1](../1-data-model.md#281-webhookendpointreservation)`.»

§2.1 Postgres 표 — `trigger` 생성 행 뒤에 `webhook_endpoint_reservation | 트리거 생성 · 경로 변경(DB 트리거) | INSERT endpoint_path,
workspace_id … ON CONFLICT DO NOTHING — 지우지 않는다 | PK (endpoint_path) · 주인이 다르면 unique_violation(webhook_endpoint_reservation_owner) ·
(workspace_id) partial — FK SET NULL 용 (V133)` 행.

### F. 구현 착수 뒤 추가 (2026-09-19, `--impl-prep` `review/consistency/2026/09/19/19_11_16` 반영)

- `spec/1-data-model.md` frontmatter `code:` — 전용 e2e `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` 한 줄. V133 을
  **파일 그대로** 임시 스키마에서 돌려 백필 · DB 트리거를 확인한다(V131 가드 `trigger-endpoint-path-dedupe` 와 같은 방식). Flyway 는 CI · e2e 의
  빈 `trigger` 에 V133 을 적용해 백필이 한 행도 옮기지 않는데, 운영 DB 에는 한 번만 적용되고 백필이 빠뜨린 경로는 그 뒤로 누구든 가져갈 수
  있다. 이 문서의 Rationale «`code:` 에 전용 e2e 가드 셋» 이 «새 전용 가드는 그 가드를 만드는 PR 이 여기에 더한다» 고 정해 둔 자리다.
- 같은 Rationale 새 절 «하지 않은 것» 에 한 줄: **UI 고지를 더하지 않았다**(삭제 확인 · 경로 변경 경고 — `2-trigger-list` §4.2 · §2.3.1).
  소유자의 워크스페이스 안에서는 달라지는 것이 없고(옛 URL 이 404 인 것도, 다시 쓸 수 있는 것도 그대로), 같은 URL 을 다른 워크스페이스로
  옮기려는 경우는 그 자리의 409 가 알린다. (`--impl-prep` INFO #1 — «추가하지 않기로 한다면 근거를 남기라».)

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

### `--spec` 결과 반영 (`review/consistency/2026/09/19/18_56_41`, BLOCK: NO)

Critical 0 · WARNING 1 · INFO 8.

- **W1**(서비스 판정 함수가 제약 이름 하나만 안다 → 예약 위반이 500) — 설계에 `isEndpointPathUniqueViolation` 을 구현 대상으로 지목했다.
- **INFO** — data-flow §2.1 표 행(변경 E) · 자연키 PK 이유 · FK 짧은 표기(변경 A) · «남는 틈» 역참조(변경 A) · `webhook_endpoint_reservation_owner`
  가 실재 제약이 아닌 라벨임 · §1.10 통합 근거(변경 D) · 트리거 이름 `trg_trigger_reserve_endpoint_path`(설계) — 모두 반영. 트래커 체크박스는
  이 draft 를 `plan/complete/` 로 옮기는 커밋에서 함께 갱신한다(체크리스트 마지막 줄).
- 반영하며 하나 더: DB 트리거가 `workspace_id` 도 감시한다(설계 다섯째 불릿).

## 체크리스트

- [x] `--spec` 이 draft
- [x] spec 반영 (planner 커밋)
- [x] `--impl-prep` (`review/consistency/2026/09/19/19_11_16`, scope `spec/2-navigation/` + 보정 블록) — BLOCK: NO, Critical · Warning 0.
  INFO: UI 고지(→ 변경 F) · 영역 15개 파일 예산 생략(이 diff 무관) · `2-trigger-list` Rationale 번호 순서(규약 없음, 조치 불요) ·
  트래커 체크 · `plan/complete/` 이동 전 경로 인용(마무리에서 해소)
- [ ] 변경 F — `--spec` 후 반영 (planner 커밋)
- [ ] 구현 (developer, 같은 PR) — V133(테이블 · 인덱스 · 백필 · DB 트리거) · 엔티티 · 서비스의 409 매핑 · e2e
- [ ] 트래커 해소 · 이 draft `plan/complete/` 로
