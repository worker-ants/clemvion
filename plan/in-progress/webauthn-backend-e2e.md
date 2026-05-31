---
worktree: webauthn-backend-e2e-1588c1
started: 2026-05-26
owner: developer
---

# Plan: 백엔드 WebAuthn e2e (`webauthn-2fa.e2e-spec.ts`)

> 출처: `plan/complete/2fa-webauthn-followups.md §2` 에서 분리.
> 분리 사유: 본 plan 의 §수용 기준상 followups 본 plan 은 모든 항목 [x] 시 complete 로 이동하는데, e2e 작성은 별 PR 로 분리되어 있고 우선순위 낮아 followups 전체의 mv 를 막지 않도록 본 항목만 추출한다.

## 배경

`2fa-webauthn.md` (TOTP + WebAuthn 도입 본 PR) 의 `webauthn.service.spec.ts` 가 라이브러리 mock 으로 24 케이스 회귀 잠금 중이지만, 실 e2e 경로 (HTTP → service → DB) 의 회귀 안전망은 아직 부족하다. 본 plan 은 별 PR 로 그 e2e suite 를 추가한다.

## 작업 항목

- [x] `SoftWebAuthnDevice` helper — Ed25519 키 쌍 생성 + attestation/assertion 합성, base64url 직렬화 (`test/helpers/webauthn.ts`)
- [x] 시나리오: 등록 → 인증 → counter 갱신 → counter 역행 시 401 + credential 삭제 + 세션 revoke → 복구 코드 fallback → 마지막 credential 삭제 시 recovery NULL (`test/webauthn-2fa.e2e-spec.ts` A~E)
- [x] `requireUserVerification: true` 정책에 맞춘 flag 합성 (helper UV flag + case E)

## 우선순위

LOW. service spec 의 mock 회귀 안전망이 충분하다는 판단으로 followups 본 plan 의 mv 시점에 분리됐다.

## 수용 기준

- 본 PR 의 webauthn.service.spec.ts 회귀 안전망과 중복되지 않는 부분(HTTP 라우팅·DB persist·트랜잭션 경계)을 e2e 가 cover
- `make e2e-test` 가 본 suite 포함 그린
- 본 plan 의 모든 체크박스 [x] → `plan/complete/` 로 git mv
