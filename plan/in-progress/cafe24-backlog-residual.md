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

- [x] **운영(A-2) — 결정 2026-06-02**: install endpoint access log 의 `:installToken` segment 마스킹. **인프라 레벨(ingress/HAProxy)에서 처리**하기로 결정 — 코드 변경 없이 운영 측에서 적용한다. 적용 가이드(masking 위치·log-format 예시·query 이동 trade-off)를 `k8s/README.md` §Access log 에 명시. (ai-review W6/W11)
- [x] **운영(A-3) — Layer 2 완료**: install endpoint 실패 페널티 lockout (`Cafe24InstallRateLimitService`, `cafe24:install:fail:{ip}` INCR/EXPIRE, 임계치 10/10분 → `429 CAFE24_INSTALL_RATE_LIMITED`). token oracle enumeration 방어. spec §9.8 + Rationale 등재. 구현: `plan/complete/cafe24-install-ratelimit.md` (2026-06-02).
  - [ ] **A-3 follow-up — Layer 1 (분산 throttle store)**: 기존 30/min IP throttle 을 Redis 분산 store 로 이전 (멀티 인스턴스 quota 직렬화). `@nestjs/throttler` storage 가 전역 단일 설정이라 모든 throttled 엔드포인트에 영향 + 새 의존성/커스텀 storage 필요 → 별 infra PR 로 분리(deferred, 사용자 결정 2026-06-02). enumeration 방어 핵심은 Layer 2 가 cross-pod 로 완수.
- [ ] **C-6**: `buildIntegrationMeta` 레지스트리 패턴 — 현재 cafe24 하드코딩. 두 번째 provider 추가 직전 `Map<serviceType, (entity) => IntegrationMeta>` 전환. (deferred — 2nd provider 시점까지)
- [ ] **D-2** (defer — 결정 2026-06-02): `process()` 에러 격리 정책 spec 명시 (`.catch(logger.error)` BullMQ 재시도 회피). **현재는 프레임워크(NestJS Logger) 에러 로그 출력으로 충분**하다고 결정 — 별도 관측 도구(Sentry/Datadog 등) 선정 및 spec 명시는 관측 인프라를 **추후 일괄 도입**할 때 함께 진행한다. 그때까지 본 항목 유지. (ai-review W7)
- [x] **F-3 follow-up — 결정: 신설 (2026-06-02)**: 에러 코드 의미 기반 명명 원칙을 정식 규약 `spec/conventions/error-codes.md` 로 격상 완료 (명명 규율 SoT 분리 — 카탈로그·envelope 은 `5-system/3-error-handling.md`). 구현: `plan/complete/spec-draft-error-codes.md`. (기존 SoT: `4-integration.md` Rationale "(c) 의미 기반 명명 선례 예외")

### G-1-remaining — field-set 대량 확장 (별 PR — 본 PR 은 path/method 만 정렬)

> G-1 의 path/method audit 은 완료(complete 기록). 아래는 docs field ↔ metadata 갭 보강으로
> 수천 줄 규모라 별 PR 로 분리.

> **⛔ BLOCKED / 보류 (결정 2026-06-02): 정확한 field 데이터 소스 확보 전까지 착수 불가.**
> 조사 결과 — **field 전체 목록이 repo 어디에도 없다.** `spec/conventions/cafe24-api-catalog/*.md`
> 는 endpoint(id/path/method/scope)만 enumerate 하고 field 목록은 미포함이며, backend metadata
> `.ts` 는 *현재 구현된* field 만 선언한다. 확장 대상인 "docs 의 전체 field 목록" 은 **오직 Cafe24
> 외부 공식 docs**(`developers.cafe24.com`, JS 렌더링 SPA + fragment 앵커)에만 존재하고 **WebFetch
> 로 추출되지 않음**(검증 완료 — 빈 HTML). 따라서 workflow agent 가 field 를 채우려면 **추측·날조**
> 하게 되어, 500 operation 에 부정확한 field 선언(잘못된 name/type/location → 런타임 API 에러)을
> 양산한다 → 현재의 정직한 subset 보다 나쁨. impliesValue·constraint-only sweep 도 모두 "field 부재로
> 확장 선행 필요" 라 같은 데이터에 묶여 동일 차단.
>
> **해소 조건 (착수 전 필요)**: ① Cafe24 **OpenAPI/JSON 스키마** 또는 field 목록 데이터 제공(파일·URL)
> → workflow 가 파싱해 정확 확장, 또는 ② JS 렌더링 지원 브라우저/스크래핑 도구로 docs 추출 경로 확보,
> 또는 ③ 특정 high-value resource(product/order 등) field 를 사람이 docs 기준으로 제공 → 그 범위만 반영.
> 위 중 하나가 확보되면 resource 별 Workflow fan-out 으로 진행 (사용자 결정: workflow 병렬 후 검토).

- [ ] **G-1-remaining** (BLOCKED — 위 보류 사유):
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
