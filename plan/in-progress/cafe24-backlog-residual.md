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

- [x] **운영(A-2) — 결정 2026-06-02**: nginx access log 의 `:installToken` segment 마스킹. **인프라 레벨(ingress/nginx)에서 처리**하기로 결정 — 코드 변경 없이 운영 측에서 적용한다. 적용 가이드(masking 위치·`map` 예시·query 이동 trade-off)를 `k8s/README.md` §보안 ops 에 명시. (ai-review W6/W11)
- [ ] **운영(A-3)**: install endpoint IP 기반 rate limiting 추가 layer (현재 30 req/min throttle 만). token oracle enumeration 방어 강화. (ai-review W7) — rate limiter layer 위치/threshold 결정 필요.
- [ ] **C-6**: `buildIntegrationMeta` 레지스트리 패턴 — 현재 cafe24 하드코딩. 두 번째 provider 추가 직전 `Map<serviceType, (entity) => IntegrationMeta>` 전환. (deferred — 2nd provider 시점까지)
- [ ] **D-2** (defer — 결정 2026-06-02): `process()` 에러 격리 정책 spec 명시 (`.catch(logger.error)` BullMQ 재시도 회피). **현재는 프레임워크(NestJS Logger) 에러 로그 출력으로 충분**하다고 결정 — 별도 관측 도구(Sentry/Datadog 등) 선정 및 spec 명시는 관측 인프라를 **추후 일괄 도입**할 때 함께 진행한다. 그때까지 본 항목 유지. (ai-review W7)
- [ ] **F-3 follow-up**: 에러 코드 의미 기반 명명 원칙의 정식 규약화 — `spec/conventions/error-codes.md`(또는 `naming.md`) 신설 여부 결정. 현재 SoT 는 `4-integration.md` line 1349 의 self-contained 진술뿐. 신규 코드 증가 시 격상 검토. (consistency-check `2026/05/21/19_46_41` INFO #6)

### G-1-remaining — field-set 대량 확장 (별 PR — 본 PR 은 path/method 만 정렬)

> G-1 의 path/method audit 은 완료(complete 기록). 아래는 docs field ↔ metadata 갭 보강으로
> 수천 줄 규모라 별 PR 로 분리.

- [ ] **G-1-remaining**:
  - **store field-set 확장**: store 106 endpoint docs field 비교 audit 미수행.
  - **field-set 확장 (모든 resource)**: docs 에 있으나 metadata 에 누락된 field 추가 (예: product_list docs ~50 field vs 우리 8 field). 전 resource 적용 시 수천 줄.
  - **impliesValue metadata 적용**: 인프라 완료. 실제 ops 적용은 trigger field(refund_method, material_composite 등) 추가 후 — order cancellation/return/exchange + products create/update + bundleproducts create/update.
  - **constraint-only sweep — 미적용 date-pair**: order_count, boards_articles_list, coupon_list/count, scripttags_list/count, salesreport_volume — date 필드 부재로 field-set 확장 선행.

### G-2 — 잔존 docs 부재 ops 처리 결정 (운영 검증 후)

> **결정 2026-06-02**: 본 항목은 **현행 유지**한다 (production 검증 전이라 제거/문의 판단 보류). JSDoc ⚠ 마크 상태로 둔다.

production 검증 후 row 제거 또는 cafe24 본사 문의 후 docs 등재 요청. 모두 JSDoc ⚠ 마크 완료. 영향 ops:
- customer: customer_get, customer_update
- promotion: coupon_get, coupon_delete
- application: applications_list, webhooks_list
- category: mains_update, mains_delete
- store: socials_apple_settings_get
