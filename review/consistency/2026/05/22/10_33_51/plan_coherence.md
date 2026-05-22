# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/chat-channel-secret-store-infra.md` (target — 신규 작성본, frontmatter `worktree: chat-channel-secret-store-pgcrypto`)
비교 대상: `plan/in-progress/` 전체 진행 중 문서

---

## 발견사항

### [CRITICAL] 기존 plan 의 "사용자 결정 필요" 항목을 합의 없이 일방 채택

- **target 위치**: Target plan (신규) `## 결정 — 옵션 (C) pgcrypto 채택 (2026-05-22)` 절 전체
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` (기존 plan, `status: backlog`) `## 결정 항목 (사용자 escalate)` — "배포 환경 / 운영 부담 / 비용 trade-off 에 따라 사용자 결정 필요" 명시. 옵션 (A) AWS Secrets Manager / (B) HashiCorp Vault / (C) DB 암호화 컬럼 세 가지가 미결.
- **상세**: 기존 `chat-channel-secret-store-infra.md` 는 secret store 백엔드 선택을 "사용자 escalate" 미결 항목으로 명시하고 있었다. Target plan 은 사용자 합의 기록 없이 옵션 (C) pgcrypto 를 "결정"으로 처리하고, frontmatter `status: in_progress` + `priority: v1.x (사전 배포 — pgcrypto 채택, 백필 불요)` 로 변경했다. 기존 plan 이 명시적으로 "사용자 결정 필요"라고 에스컬레이션을 요구한 항목을 plan 재작성만으로 결정 완료로 전환한 것은 미해결 결정 우회에 해당한다.
- **제안**: (a) 사용자(워크플로 오너)가 명시적으로 pgcrypto 채택을 확인했다면, 기존 `chat-channel-secret-store-infra.md` 의 `## 결정 항목` 절에 합의 날짜 + 근거를 추가하고, target plan 이 그 결정을 인용하는 형태로 연결해야 한다. (b) 확인 없이 target plan 을 그대로 착수하면 안 된다.

---

### [CRITICAL] 동일 spec 파일을 두 worktree 가 동시 수정 — `spec/5-system/14-external-interaction-api.md`

- **target 위치**: Target plan `Phase 2 — notification.signing.secret 마이그레이션` (`notification-secret-rotator.service.ts` — `notification_secret_v2` 컬럼도 ref 로 전환), `Phase 5 — 정합 갱신` (`spec/5-system/14-external-interaction-api.md §7.1` 갱신)
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` (`worktree: eia-secret-rotation-<slug>`) — `notification_secret_v2` 컬럼에 새 secret 저장, grace 종료 cron `secret → secret_v2` 승격 로직. `plan/in-progress/eia-jti-tracking.md` (`worktree: eia-jti-tracking-<slug>`) — `spec/5-system/14-external-interaction-api.md §3.3` 수정. `plan/in-progress/eia-trigger-edit-ui.md` (`worktree: eia-trigger-edit-ui-<slug>`) — 동일 spec `§4 + §10.1` 수정.
- **상세**:
  1. **`notification_secret_v2` 컬럼 의미 충돌**: `eia-secret-rotation-revoke-api` 는 `notification_secret_v2` 에 평문 secret 을 저장하고 24h grace 후 `secret` 컬럼으로 승격하는 로직을 구현할 계획이다. Target plan 의 Phase 2 는 같은 컬럼(`notification_secret_v2`)을 secret store ref 로 전환하겠다고 한다 (`notification-secret-rotator.service.ts — notification_secret_v2 컬럼도 ref 로 전환`). 두 plan 이 동일 컬럼의 의미·저장 포맷을 서로 다르게 전제하는 충돌이다.
  2. **`spec/5-system/14-external-interaction-api.md` 동시 편집 위험**: target plan 의 Phase 5 가 `§7.1 notification.signing.secret 보안 노트를 secret store ref 로 정리` 를 예정하고 있고, EIA 3개 후속 plan (`eia-secret-rotation-revoke-api`, `eia-jti-tracking`, `eia-trigger-edit-ui`) 도 동일 파일의 각기 다른 절을 수정 예정이다. worktree 가 분리되어 있어 동시 편집 merge 충돌 위험이 있다.
- **제안**: target plan 의 Phase 2 착수 전 `eia-secret-rotation-revoke-api` 의 `notification_secret_v2` 처리 방향과 직렬화 또는 명시적 계약 합의가 필요하다. `notification_secret_v2` 의 최종 포맷(평문 vs secret ref)을 먼저 결정하고, 두 plan 중 하나가 선행·후행 순서를 명시해야 한다.

---

### [WARNING] `eia-secret-rotation-revoke-api` 후속 항목이 target plan 에 의해 무효화됨

- **target 위치**: Target plan Phase 2 — `notification.signing.secret` 를 secret store 로 마이그레이션하면 `config.notification.signing.secret` 평문 필드가 `config.notification.signing.secretRef` 로 교체된다.
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §2 — `POST /api/triggers/:id/notification/rotate-secret` endpoint 가 "새 secret 발급 → `notification_secret_v2` 컬럼에 저장"하는 로직을 평문 보관 기반으로 설계되어 있다. grace 종료 cron 도 `notification_secret_v2` 를 `secret` 으로 승격 (평문 → 평문) 한다.
- **상세**: target plan 이 `notification.signing.secret` 을 secret store ref 로 전환하면, `eia-secret-rotation-revoke-api` 의 rotation 로직 전체(저장·cron·응답 shape)가 secret store API 를 통해 재작성되어야 한다. 현재 `eia-secret-rotation-revoke-api` plan 에는 이 전제 변경이 반영되어 있지 않으므로, 해당 plan 의 작업 단위 §2 가 완전히 재설계 대상이 된다.
- **제안**: target plan 이 확정되면 `eia-secret-rotation-revoke-api` 의 §2 작업 단위를 secret store ref 기반으로 재작성하거나, 두 plan 의 선후관계(target plan 선행 → EIA rotation plan 후행 재설계)를 명시해야 한다.

---

### [WARNING] `eia-secret-rotation-revoke-api` 의 미결 결정 사항이 target plan 범위에 영향

- **target 위치**: Target plan Phase 2 `notification-secret-rotator.service.ts — notification_secret_v2 컬럼도 ref 로 전환`
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` `## 결정 사항 (사용자 합의 필요)` — rotation grace 기간 / rotate 응답 shape / itk revoke 후 grace 세 가지가 미결.
- **상세**: `notification_secret_v2` 의 grace 기간 결정이 target plan 의 rotation 처리 방식에 직접 영향을 준다. 예를 들어 grace 1h 로 결정되면 migration 이후 rotation 중 old ref / new ref 를 동시에 resolve 하는 시간 창이 짧아지고, 24h 이면 SecretResolver 가 두 ref 를 모두 살아있게 관리해야 한다. target plan 이 이 결정을 전제로 Phase 2 를 설계하고 있으나, 미결 상태에서 착수하면 설계가 깨질 수 있다.
- **제안**: `eia-secret-rotation-revoke-api` 의 결정 사항 합의가 target plan Phase 2 착수의 전제 조건임을 두 plan 에 명시한다.

---

### [WARNING] 기존 `chat-channel-secret-store-infra.md` 의 Phase 1 설계(어댑터 추상화)와 target plan 의 단일 구현 방향 불일치

- **target 위치**: Target plan `## Out of Scope` — "pgcrypto 외 다른 backend(AWS Secrets Manager 등) 어댑터 — 본 plan 은 pgcrypto 단일 구현만"
- **관련 plan**: `plan/in-progress/chat-channel-secret-store-infra.md` (기존 backlog) Phase 1 — "통합 인터페이스 (`SecretResolver { resolve(ref: string): Promise<string> }`) + `secret://` URI scheme 파서"
- **상세**: 기존 plan 은 Phase 1 을 adapter abstraction 으로 설계해 어댑터 교체 가능성을 열어뒀다. target plan 은 pgcrypto 단일 구현을 명시하고 다른 backend 어댑터를 Out of Scope 로 명시한다. 이는 기존 plan 의 Phase 1 설계 방향을 변경하는 것이므로, 기존 plan 을 supersede 하는 것인지 병존하는 것인지 명확하지 않다. 두 plan 이 같은 이름(`chat-channel-secret-store-infra.md`)의 파일로 존재한다면 혼란이 더욱 크다.
- **제안**: target plan 이 기존 backlog plan 을 대체(supersede)하는 것임을 명시하고, 기존 `chat-channel-secret-store-infra.md` 를 target plan 의 `# Superseded by: chat-channel-secret-store-pgcrypto worktree` 로 갱신하거나 `plan/complete/archive/` 로 이동해야 한다.

---

### [WARNING] `spec/5-system/15-chat-channel.md` 의 v1 stub 예외 조항 제거가 다른 in-progress plan 에 영향

- **target 위치**: Target plan Phase 5 — `spec/5-system/15-chat-channel.md CCH-SE-03 — v1 plaintext stub 예외 조항 제거`
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` (`status: backlog`) Phase 6 — 동일 파일 `spec/5-system/15-chat-channel.md` CCH-MP-04 절 수정 예정. `plan/in-progress/chat-channel-dispatcher-split.md` (`status: backlog`) — 동일 파일 §3.1, §3.2, §3.3, Rationale R4+R8 참조.
- **상세**: target plan Phase 5 가 `spec/5-system/15-chat-channel.md` 를 편집할 때 backlog 상태인 두 chat-channel plan 이 동일 파일의 다른 절을 예정하고 있다. 현재 이들은 backlog 이라 실제 충돌 위험은 낮지만, CCH-SE-03 예외 조항 제거가 CCH-MP-04 절 또는 Rationale R4+R8 절의 내용과 연관된 참조를 끊거나 변경할 가능성이 있다.
- **제안**: target plan Phase 5 spec 편집 시 `chat-channel-visual-ssr-png.md` 와 `chat-channel-dispatcher-split.md` 의 향후 편집 영역이 깨지지 않도록 변경 범위를 CCH-SE-03 한정으로 제한하고, 두 backlog plan 에 "target plan 의 CCH-SE-03 변경 이후 해당 절 확인 필요" 메모를 추가하는 것을 권장한다.

---

### [INFO] `auth-config-encryption-migration` plan 의 존재 여부 확인 필요

- **target 위치**: Target plan `## Out of Scope` — "cafe24 / OAuth 등 다른 모듈의 자격증명 통합 — 별 plan (`auth-config-encryption-migration`) 추적"
- **관련 plan**: `plan/in-progress/` 목록에 `auth-config-encryption-migration.md` 파일이 현재 존재하지 않는다.
- **상세**: target plan 이 Out of Scope 에서 `auth-config-encryption-migration` plan 을 참조하지만 해당 plan 파일이 `plan/in-progress/` 에 없다. 미래에 생성될 plan 을 미리 참조한 것일 수 있으나, 현재 시점에서 dangling reference 로 남아있다.
- **제안**: 해당 plan 이 아직 없다면 "(예정, 미생성)" 표기를 추가하거나, 생성 시점에 양방향 참조를 연결한다.

---

### [INFO] `spec/conventions/secret-store.md` 신규 생성이 다른 spec 참조에 영향

- **target 위치**: Target plan Phase 5 — `신규 spec/conventions/secret-store.md — secret store 추상화 convention 정식 도입`
- **관련 plan**: 현재 `plan/in-progress/` 의 다른 plan 중 `secret-store.md` convention 을 참조하는 plan 은 없다. 단, 향후 EIA 후속 plan(`eia-secret-rotation-revoke-api`)이 secret store 기반 rotation 으로 재설계될 경우 해당 convention 을 참조하게 된다.
- **상세**: Phase 5 에서 신규 convention 파일을 생성하면, 이후 EIA rotation plan 재설계 시 해당 convention 을 기반으로 작성되어야 한다. 현재는 후속 plan 에 이 의존이 명시되지 않음.
- **제안**: `eia-secret-rotation-revoke-api` plan 재설계 시 `spec/conventions/secret-store.md` 를 의존 관계에 명시하도록 해당 plan 을 갱신할 것을 권장한다 (target plan Phase 5 완료 이후).

---

## 요약

Target plan (`chat-channel-secret-store-pgcrypto` worktree) 은 기존 `chat-channel-secret-store-infra.md` 가 "사용자 결정 필요(escalate)"로 명시한 secret store 백엔드 옵션 선택을 별도 합의 기록 없이 pgcrypto 채택으로 일방 확정하여 미결 결정 우회 위험이 있다(CRITICAL). 또한 Phase 2 의 `notification_secret_v2` 컬럼 처리 방향이 `eia-secret-rotation-revoke-api` plan 의 평문 기반 설계와 직접 충돌하고, 동일 파일(`spec/5-system/14-external-interaction-api.md`)을 여러 EIA worktree 가 동시 편집 예정이어서 merge 경합 위험이 존재한다(CRITICAL). 기존 backlog plan 의 Phase 1 어댑터 추상화 설계와 target plan 의 단일 구현 방향이 불일치하므로 supersede 관계를 명확히 해야 한다(WARNING). 작업 착수 전 사용자 pgcrypto 채택 합의 기록을 기존 plan 에 명시하고, `eia-secret-rotation-revoke-api` 와의 직렬화 순서 및 `notification_secret_v2` 처리 방향을 합의한 뒤 진행해야 한다.

## 위험도

CRITICAL

STATUS: SUCCESS
