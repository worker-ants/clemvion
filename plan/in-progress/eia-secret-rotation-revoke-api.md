---
worktree: eia-secret-rotation-<slug>
started: 2026-05-21
owner: developer
---

# EIA — Notification secret rotation + Per-trigger token revoke API

> 작성일: 2026-05-21
> 상위: [`plan/complete/external-interaction-api.md`](../complete/external-interaction-api.md) §"완료 후 잔여"
> 관련 spec: [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §3.1 EIA-NX-12 / §3.3 EIA-AU-07

## 배경

PR2 (#230) 는 outbound notification 의 수신 측 grace 검증 (NotificationWebhookProcessor 의 v1/v2 secret 둘 다 시도) 까지만 구현. 사용자 API 인 secret rotate / itk_* revoke endpoint 는 follow-up 으로 분리됨.

## 결정 사항 (사용자 합의 필요)

- [ ] **rotation grace 기간**: 24h (spec default) 그대로 / 사용자가 trigger 별 조정 가능하게 / 짧게 줄임 (예: 1h)
- [ ] **rotate 응답 shape**: 새 secret 평문 반환 (한 번만, 이후 마스킹) / 새 secret 미반환 (사용자가 별도 mechanism 으로 확인)
- [ ] **itk revoke 후 grace**: 즉시 invalidate / N 초 grace

## 작업 단위

### 1. 결정 사항 합의

위 3가지.

### 2. 백엔드 API

- [ ] `TriggersController` 에 신규 endpoints:
  - `POST /api/triggers/:id/notification/rotate-secret` — 새 secret 발급 → `notification_secret_v2` 컬럼에 저장 + `notification_rotated_at = NOW()`. 응답에 새 secret 평문 1회 반환.
  - `POST /api/triggers/:id/interaction/revoke-token` — 새 itk_* 발급 → `config.interaction.triggerToken` 교체. 응답에 새 itk 평문 1회 반환.
- [ ] `TriggersService` 에 비즈니스 로직
- [ ] grace 종료 cron / scheduled job — `notification_secret_v2` 가 24h 초과면 `secret` 으로 승격 + `secret_v2`/`rotated_at` 비우기. BullMQ schedule 또는 hourly cron.
- [ ] DTO + class-validator
- [ ] 단위·통합 테스트

### 3. 프론트엔드

- [ ] Trigger 상세 드로어 (PR2 P7 의 read-only 카드) 에 rotate / revoke 버튼 추가 — 클릭 시 confirm dialog → 새 secret/token 표시 dialog → 복사 후 닫기.
- [ ] i18n KO/EN parity

### 4. 검증

- backend lint + unit + build + e2e
- frontend lint + unit
- `/ai-review`

## 수용 기준

- 사용자가 trigger 상세에서 rotate 버튼 클릭 → 새 secret 1회 표시 → 24h 안에 outbound notification 발송 시 v1=둘 다 동봉되어 검증 측이 어느 secret 으로도 통과
- 사용자가 revoke 버튼 클릭 → 기존 itk_* 즉시 무효화, 새 itk_* 표시
