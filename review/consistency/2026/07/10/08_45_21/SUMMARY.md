# Consistency Check 통합 보고서 (--spec, spec/5-system/3-error-handling.md)

**BLOCK: NO** (최종) — 최초 실행에서 발견된 **CRITICAL 1건(dead anchor)** 을 fix +
build-blocking 테스트로 재검증 완료. 5개 checker 실제 diff 기준 잔여 Critical 0.

> Workflow 자동 summary 는 BLOCK: NO 를 냈으나 이는 **오탐**이었다 — convention_compliance
> 가 CRITICAL 을 냈는데 FS-write flakiness 로 파일이 미기록돼 summary 가 그 결과 없이
> 판정했다. journal 확인으로 CRITICAL 을 발견 → fix → convention Agent 재실행으로
> 재검증(LOW, 0 Critical). **journal 이 authoritative 라는 것을 다시 보여준 사례.**

## 발견 → 조치

| Checker | 최초 | 조치 | 재검증 |
|---|---|---|---|
| convention_compliance | **CRITICAL**: `[§2.3](./1-auth.md#23-강제-종료-세션-revoke)` dead anchor(실제 slug `#23-세션-정책`) → `spec-link-integrity.test.ts`(build-blocking) fail. **MEDIUM**: §1.8 이 형제 코드 `KB_REEMBED_IN_PROGRESS` 누락 | 앵커 `#23-세션-정책` 정정; `KB_REEMBED_IN_PROGRESS`(409, 8-embedding §7.3) 등재; per-row SoT 앵커 추가 + 헤더 `HTTP`→`status`(WARNING/INFO) | **LOG 11/11 PASS** + convention Agent 재실행 **LOW, 0 Critical**. 9코드 전부 도메인 SoT verbatim 일치 확인 |
| rationale_continuity | NONE | — | §1.5~§1.7 패턴 완결, 코드값·HTTP 1:1, 새 원칙/기각재도입 없음 |
| naming_collision | NONE | (형제 코드 REAUTH_*/TOTP_INVALID 등 미등재는 INFO) | 신규 식별자 없음(기존 코드 등재), 충돌 0 |
| plan_coherence | LOW | — | 자매 plan(`spec-update-manual-trigger-...`) L155 라인포인터가 삽입으로 이동(문구 식별 가능, non-blocking) |
| cross_spec | (파일 미기록) | — | 카탈로그 가시성 변경(신규 엔티티·API·요구사항 ID 없음) → cross-spec 리스크 nil |

## 최종 위험도
**LOW** — 순수 spec 문서 카탈로그 완결성(§1.2.1 auth 7코드·§1.8 KB 2코드 등재). 코드·런타임·API 무변경. build-blocking 링크 무결성 통과.

## 후속 (plan 추적, 비차단)
- 재인증 세부 코드(`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`)·`NOT_A_MEMBER`·`INVALID_PASSWORD` 는 코드 실재하나 도메인 spec 본문 미문서 → "spec 문서화 → 등재" 순서 후속(dangling SoT 방지).
