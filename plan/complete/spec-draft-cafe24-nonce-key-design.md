---
worktree: cleanup-followups
started: 2026-05-28
owner: project-planner
draft_for: cafe24-test-spec-guard-cleanup-followups.md
status: applied (2026-05-28, consistency review/consistency/2026/05/28/22_13_50 BLOCK:NO)
target_specs:
  - spec/4-nodes/4-integration/4-cafe24.md
---

# Spec draft — Cafe24 nonce cache Redis 키 구성 설계 명문화 (INFO-6)

## 배경

`cafe24-test-spec-guard-cleanup-followups.md` 의 INFO-6: `Cafe24InstallNonceCache`
의 Redis 키가 hmac 앞 8자만 prefix 로 사용하는 설계가 **코드 inline 주석에는
있으나 spec 에는 미명시**. spec §9.8 (Private 앱 App URL HMAC 검증) 의 Nonce
cache 보호 note 와 "관련 코드 상수" 표에 이 설계를 명문화한다.

코드 현황 (SoT): `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts`
- 키 형식: `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac[:8]}`
- `buildKey()` 에서 `params.hmac.slice(0, 8)` — hmac 앞 8자만.
- 근거 주석: base64 charset 한 글자 = 6bit, 8자 = 48bit = ~2.8e14 공간, 충돌 무시 가능.

## 변경안 (spec/4-nodes/4-integration/4-cafe24.md §9.8)

### A. Nonce cache 보호 note 보강 (line 547)

기존 note 끝에 키 구성 설계 한 문장 추가:

> 키 형식은 `cafe24:install:nonce:{mall_id}:{timestamp}:{hmac 앞 8자}` —
> base64 hmac(~44자) 전체 대신 앞 8자(=48bit, 약 2.8e14 공간)만 prefix 로
> 써서 Redis 키 길이를 제한한다. 같은 윈도우·같은 (mall_id, timestamp) 에서
> hmac 앞 8자까지 동일할 확률은 무시 가능하며, 설령 충돌해도 이미 HMAC 검증을
> 통과한 요청이므로 보안 영향 없이 (드물게) 정상 재시도가 replay 로 거절될 뿐이다.

### B. "관련 코드 상수" 표에 행 추가 (line 555-557)

| 상수 | 값 | 의미 |
|------|-----|------|
| nonce key hmac prefix 길이 | `8` (코드 상수) | Redis nonce 키의 hmac 세그먼트 길이. base64 8자 ≈ 48bit ≈ 2.8e14 공간으로 충돌 무시 가능. 키 길이 제한 목적이며, 변경 시 `Cafe24InstallNonceCache.buildKey` 와 동기화 필요. |

### C. 변경 이력 행 추가 (§ 변경 이력 표)

| 2026-05-28 (nonce-key-doc) | §9.8 — `Cafe24InstallNonceCache` Redis 키 구성(hmac 앞 8자 prefix + 충돌 확률 근거)을 Nonce cache 보호 note + 관련 코드 상수 표에 명문화 (INFO-6). 코드는 변경 없음, 기존 inline 주석을 spec 으로 승격. |

## 영향 범위

- 동일 §9.8 안의 추가만. 다른 spec 영역 영향 없음.
- 코드 변경 없음 (문서가 코드 현황을 따라감).
- 폐기/번복되는 기존 결정 없음 — 순수 additive 명문화.

## Rationale

- prefix-8 설계는 키 길이 제한이 목적이고 충돌 확률이 무시 가능하다는 trade-off 가
  이미 코드와 테스트(`...service.spec.ts` 의 prefix length invariant + collision
  테스트)에 박제돼 있다. spec 미명시 상태에서는 "왜 hmac 전체가 아닌 8자인가" 를
  spec 독자가 알 수 없어 SoT 단일성이 깨진다. 코드 주석을 spec 으로 승격해 해소.
- 충돌이 발생해도 보안 영향이 없는 이유(이미 HMAC 통과 요청)를 note 에 명시해,
  "prefix 단축이 보안 약화 아닌가" 라는 오해를 사전 차단.
