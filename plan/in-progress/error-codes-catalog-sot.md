---
title: 에러코드 카탈로그 SoT 정합 — 도메인 코드(WebAuthn/2FA·KB) §1 등재
worktree: error-codes-catalog-sot-e09193
started: 2026-07-10
owner: project-planner
spec_area: spec/5-system/3-error-handling.md
---

## 배경

`#880`(enricher DRY) impl-done 의 convention_compliance 가 지적한 **standing 이슈**
(내 PR diff 무관, pre-existing): `3-error-handling.md §1` 이 "제품 전체 에러코드
카탈로그 SoT" 인데, 도메인 spec 이 정의한 다음 코드들이 §1 에 미등재:

- `1-auth.md` §1.4(2FA/WebAuthn)·§2.3(재인증)의 WebAuthn/2FA/재인증 코드
  (`WEBAUTHN_DISABLED` 503 등)
- `10-graph-rag.md` 의 `KB_REEXTRACT_IN_PROGRESS`

`error-codes.md §1` 은 §1(3-error-handling)을 카탈로그 SoT 로 선언하므로, 이 코드들이
공용 카탈로그에서 안 보이는 것은 SoT 완결성 갭.

## 설계 (기존 §1.5~§1.7 "(도메인 spec 참조)" 패턴 확장)

§1.5(WS commands)·§1.6(EIA)·§1.7(webhook)는 이미 "정의·트리거 SoT 는 도메인 spec,
본 절은 공용 카탈로그 가시성 등재" 패턴을 확립. 동일 패턴으로:

- [ ] **auth 도메인 코드**: §1.2(인증/인가) 뒤에 도메인 참조 등재(표 또는 §1.2.x)
      — WebAuthn/2FA/재인증 코드를 `| 코드 | HTTP | 도메인 SoT |` 로. SoT = `1-auth.md §1.4/§2.3`.
- [ ] **KB 도메인 코드**: `KB_REEXTRACT_IN_PROGRESS`(+형제) 등재. SoT = `10-graph-rag.md`.
      단건이면 별도 §1.8 대신 §1.1 또는 경량 note 검토.

정확한 코드·HTTP·의미·SoT 위치는 enumeration 조사 결과로 확정(env var/이벤트값/
failure_reason 제외).

## 원칙 (변경 최소·SoT 보존)
- **등재만**(visibility) — 각 코드의 정의·트리거 SoT 는 도메인 spec 유지. §1 은 참조.
- 코드값·의미·HTTP 재정의 없음(도메인 spec 과 1:1). 명명 규율은 `conventions/error-codes.md` 유지.

## 확정 코드 (enumeration)
- **§1.2.1 (auth, 7)**: `WEBAUTHN_DISABLED`(503)·`WEBAUTHN_VERIFY_FAILED`(400)·
  `INVALID_OPTIONS_TOKEN`(400)·`CHALLENGE_INVALID`(401)·`WEBAUTHN_INVALID`(401)·
  `RECOVERY_CODE_INVALID`(401)·`REAUTH_NOT_AVAILABLE`(403). SoT=1-auth §1.4/§2.3/§5.
  제외: `WEBAUTHN_COUNTER_REGRESSION`(failure_reason 라벨), env var 4종, `totp_failed`(이벤트값).
- **§1.8 (KB, 1)**: `KB_REEXTRACT_IN_PROGRESS`(409). SoT=10-graph-rag §5.1.

## 워크플로 (project-planner)
- [x] enumeration 확정(subagent) → §1 편집 설계
- [x] §1 편집 적용 — intro 도메인 목록·등재 원칙 갱신 + §1.2.1(auth 도메인참조) + §1.8(KB 도메인참조). `error-codes.md §1` 은 이미 §1 을 SoT 로 지목 → cross-ref 갱신 불요.
- [x] consistency-check --spec — **BLOCK: NO** (최종). 최초 실행이 **CRITICAL(dead anchor `#23-강제-종료-세션-revoke`→`#23-세션-정책`, build-blocking link-integrity fail)** + MEDIUM(§1.8 `KB_REEMBED_IN_PROGRESS` 누락)을 발견(journal 확인 — summary 는 FS-flakiness 로 오탐 BLOCK:NO). 둘 다 fix: 앵커 정정 + KB_REEMBED 등재 + per-row SoT 앵커/헤더 통일. **link-integrity 11/11 PASS** + convention Agent 재실행 LOW/0 Critical.

## 후속 (비차단, 별도 완결성 pass)
- [x] **재인증(§2.3) 흐름 코드 spec 문서화 → 등재** — `auth-reauth-spec-accuracy` PR 로 완결(2026-07-10).
  `1-auth.md §2.3` 에 재인증 에러 코드 note + Rationale §2.3.D 문서화 → `§1.2.1` 등재.
  **status 정정**(당초 오기): `REAUTH_REQUIRED`=**400**(BadRequest)·`PASSWORD_INVALID`=**401**(Unauthorized)·
  `TOTP_INVALID`=**401**. 동시에 §2.3 "WebAuthn/이메일 OTP 대체" drift 도 password OR TOTP 로 정정.
- [x] `NOT_A_MEMBER`(403)·`INVALID_PASSWORD`(401)·`PASSWORD_REQUIRED`(401, §1.2.1 각주 원출처)도 §1 등재 —
  **해소**(PR catalog-residual-codes, 2026-07-10). `NOT_A_MEMBER`·`INVALID_PASSWORD`→§1.2, `PASSWORD_REQUIRED`→§1.2.1(형제 `PASSWORD_INVALID` 옆). 각 코드 본문 문서화(§5 note·§2.3 note) 선행으로 dangling SoT 방지 게이트 충족.
  (이 plan 자신의 complete 이동은 별개 — 설계 리스트 L27/L29 stale 미체크 + `spec_impact` frontmatter 부재는 #882 구조 정리 몫.)

## 비고
- 순수 spec 문서 정합(카탈로그 가시성). 코드·런타임·API 동작 무변경.
- #880 리뷰의 별도 백로그였고, 사용자 요청으로 착수.
