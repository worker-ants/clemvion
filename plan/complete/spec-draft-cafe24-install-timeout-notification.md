---
worktree: cafe24-w2-spec-d9f2a3
started: 2026-05-16
owner: project-planner
---

# install_timeout 알림 미발사 명시 (PR #76 W-2 follow-up)

## 배경

PR #76 의 consistency-check 결과 W-2: `expirePendingInstalls()` 의 `install_timeout` 분기에서 `Notification` (type='integration_expired') 가 발사되지 않으나, spec/data-flow/notifications.md 의 갱신 표현이 "expired 두 경로 (token_expired, install_timeout) 만 발사" 로 install_timeout 도 발사한다고 시사. 코드와 spec 불일치.

코드 검토:
- `expirePendingInstalls()` — 단일 atomic bulk UPDATE 로 status 만 전이, `notificationsService.createMany` 호출 없음 (`backend/src/modules/integrations/integration-expiry-scanner.service.ts:251-287`).
- `run()` — token_expires_at 만료 처리 분기는 알림 발사 (line 356).

## 결정 — 옵션 B 채택

`install_timeout` 분기는 알림 발사 **하지 않는다** (의도된 설계로 명시).

**이유**:
- (a) 사용자 인지 — `pending_install` 상태는 사용자가 외부 흐름 (Cafe24 Developers 의 "테스트 실행") 을 직접 진행 중인 명시적 상태. 24h 안에 완료하지 못했다는 건 본인이 인지 가능성 큼.
- (b) 사용자 행동 단서 — 통합 상세 페이지의 status 배지 + 목록 페이지의 "Need attention" 배너로 통지 가능. 별도 알림 over-noise.
- (c) 한쪽으로 통일 — `pending_install` 의 다른 callback 실패 분기 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`) 도 알림 미발사. install_timeout 만 발사하면 일관성 결손.

옵션 A (install_timeout 도 알림 발사) 는 기각 — 사용자에게 over-alert 우려 + 구현 변경 비용.

## 변경 spec 파일 (3건)

### 1. `spec/data-flow/notifications.md` §1.1

`integration_expired` 발사 조건 — "두 경로" 표현을 정정:
- 옛 (PR #76): "expired 전이 두 경로 (token_expired, install_timeout) 만 발사"
- 새: "refresh_token 없는 provider 의 `token_expires_at` 만료 (`token_expired`) 에만 발사. `pending_install → expired (install_timeout)` 전이는 미발사 (UI 배지로만 통지)."

### 2. `spec/2-navigation/4-integration.md` §11.2

알림 메시지 표 + `error(*) 전이는 알림 미발사` 블록을 확장:
- "당일" 행 옆에 "(install_timeout 은 미발사)" 부연.
- `error(*) 전이는 알림 미발사` 블록에 install_timeout 도 포함하는 형태로 정정.

### 3. `spec/1-data-model.md` §2.19 Notification.type 컬럼

`integration_expired` 발사 정책 코멘트 정정:
- 옛: "expired 전이 (token_expires_at 만료 또는 ... install_timeout) 에만 발사"
- 새: "refresh_token 없는 provider 의 `token_expires_at` 만료 (`token_expired`) 에만 발사. install_timeout 및 error(*) 전이는 미발사"

### 4. `spec/2-navigation/4-integration.md` ## Rationale

신규 항목 — "install_timeout 알림 미발사 (2026-05-16)" 추가:
- 의사결정 (옵션 B) 과 이유 (a/b/c) 명시.
- callback 실패 분기와의 일관성.

## 진행 순서

- [ ] 1. 본 draft commit.
- [ ] 2. `/consistency-check --spec plan/in-progress/spec-draft-cafe24-install-timeout-notification.md`.
- [ ] 3. Critical 0 건 확인 후 spec 수정.
- [ ] 4. plan/complete/ 이동 + PR 생성.

## 후속 follow-up

- 없음. 본 plan 으로 완결.
