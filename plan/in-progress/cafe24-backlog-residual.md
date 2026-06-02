---
worktree: cafe24-backlog-residual-batch
started: 2026-05-16
owner: developer (다음 진입자)
---

# Cafe24 백로그 — 미해소 잔여

> **완료된 부분은 분리됨** (2026-06-01 split): A-1(알림 UI) · B-5-8(refresh 테스트 보강) ·
> Polish 완료분(C-3/D-1/E-1/E-3/F-2/F-3) · G-1 resource docs audit 전 batch 는
> [`plan/complete/cafe24-backlog-done.md`](../complete/cafe24-backlog-done.md) 에 기록.
> 본 문서는 **운영/결정 의존 또는 field-set 대량 확장**이 선행돼야 하는 잔여만 남긴다.
> 이력·맥락 원본: `plan/complete/cafe24-followup-backlog.md`, `plan/complete/cafe24-pending-polish-followup.md`.

## 잔여 항목 (착수 전 결정·선행 필요)

- [ ] **운영(A-2)**: nginx access log 의 `:installToken` segment 마스킹 또는 query parameter 이동 검토. (ai-review W6/W11) — 운영 ops, 코드 변경 없음. nginx 로그 마스킹 정책 결정 필요.
- [x] **운영(A-3) — Layer 2 완료**: install endpoint 실패 페널티 lockout (`Cafe24InstallRateLimitService`, `cafe24:install:fail:{ip}` INCR/EXPIRE, 임계치 10/10분 → `429 CAFE24_INSTALL_RATE_LIMITED`). token oracle enumeration 방어. spec §9.8 + Rationale 등재. 구현: `plan/complete/cafe24-install-ratelimit.md` (2026-06-02).
  - [ ] **A-3 follow-up — Layer 1 (분산 throttle store)**: 기존 30/min IP throttle 을 Redis 분산 store 로 이전 (멀티 인스턴스 quota 직렬화). `@nestjs/throttler` storage 가 전역 단일 설정이라 모든 throttled 엔드포인트에 영향 + 새 의존성/커스텀 storage 필요 → 별 infra PR 로 분리(deferred, 사용자 결정 2026-06-02). enumeration 방어 핵심은 Layer 2 가 cross-pod 로 완수.
- [ ] **C-6**: `buildIntegrationMeta` 레지스트리 패턴 — 현재 cafe24 하드코딩. 두 번째 provider 추가 직전 `Map<serviceType, (entity) => IntegrationMeta>` 전환. (deferred — 2nd provider 시점까지)
- [ ] **D-2**: `process()` 에러 격리 정책 spec 명시 (`.catch(logger.error)` BullMQ 재시도 회피) — Sentry/Datadog 등 관측 도구 선정 결정 필요. (ai-review W7)
- [x] **F-3 follow-up — 결정: 신설 (2026-06-02)**: 에러 코드 의미 기반 명명 원칙을 정식 규약 `spec/conventions/error-codes.md` 로 격상. draft `plan/in-progress/spec-draft-error-codes.md` 작성 → consistency-check --spec → spec 신설 진행 중 (worktree `cafe24-error-codes-convention-523e2d`). SoT 분리: 카탈로그·envelope 은 `5-system/3-error-handling.md`, 본 규약은 명명 규율만. (기존 SoT: `4-integration.md` Rationale "(c) 의미 기반 명명 선례 예외")

### G-1-remaining — field-set 대량 확장 (별 PR — 본 PR 은 path/method 만 정렬)

> G-1 의 path/method audit 은 완료(complete 기록). 아래는 docs field ↔ metadata 갭 보강으로
> 수천 줄 규모라 별 PR 로 분리.

- [ ] **G-1-remaining**:
  - **store field-set 확장**: store 106 endpoint docs field 비교 audit 미수행.
  - **field-set 확장 (모든 resource)**: docs 에 있으나 metadata 에 누락된 field 추가 (예: product_list docs ~50 field vs 우리 8 field). 전 resource 적용 시 수천 줄.
  - **impliesValue metadata 적용**: 인프라 완료. 실제 ops 적용은 trigger field(refund_method, material_composite 등) 추가 후 — order cancellation/return/exchange + products create/update + bundleproducts create/update.
  - **constraint-only sweep — 미적용 date-pair**: order_count, boards_articles_list, coupon_list/count, scripttags_list/count, salesreport_volume — date 필드 부재로 field-set 확장 선행.

### G-2 — 잔존 docs 부재 ops 처리 결정 (운영 검증 후)

production 검증 후 row 제거 또는 cafe24 본사 문의 후 docs 등재 요청. 모두 JSDoc ⚠ 마크 완료. 영향 ops:
- customer: customer_get, customer_update
- promotion: coupon_get, coupon_delete
- application: applications_list, webhooks_list
- category: mains_update, mains_delete
- store: socials_apple_settings_get
