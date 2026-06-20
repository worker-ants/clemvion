# Consistency Check (--impl-done) 통합 보고서 — C-3 auth bcrypt→service

**BLOCK: NO** — Critical 0, 차단 사유 없음.

## 전체 위험도
**LOW** — 순수 레이어 정렬 리팩터(C-3). spec 충돌·규약 위반·명명 충돌 없음. plan 체크박스 미갱신(행정적)만 LOW.

## Critical / WARNING
_없음_

## 참고 (INFO)

| # | Checker | 항목 | 조치 |
|---|---------|------|------|
| 1 | Cross-Spec | `verifyPasswordForUser` 공개 계약(시그니처·에러코드·반환)이 spec 미기술 | `data-flow/2-auth.md §1.2` 또는 `1-auth.md §1.4` 에 한 줄 정책 추가 권장 (선택·후속) |
| 2 | Cross-Spec | `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 가 `error-codes.md` 레지스트리 등재 여부 불명확 | 미등재면 auth 도메인 등재 (선택·후속; 옛 controller 가 쓰던 동일 코드 재사용이라 신규 아님) |
| 3 | Plan Coherence | `02-architecture.md §C-3` 체크박스 `[ ] 미착수` 잔존 | 구현 완료·PR 반영으로 갱신 (본 PR) |
| 4 | Naming Collision | `webauthn.controller.ts:369-386`·`sessions.service.ts:244-252` 도 raw bcrypt 비교 — `verifyPasswordForUser` 미통합 | **후속**: 같은 메서드로 통일 시 단일 진실 완성 (C-3 §3). 현 PR 차단 아님 — webauthn 은 controller 라 같은 침범, sessions 는 이미 service-layer(중복만) |

## Checker별 위험도
Cross-Spec NONE(계약·에러코드 문서화 INFO) · Rationale-Continuity NONE(plan 옵션 A 정확 채택) · Convention NONE · Plan-Coherence LOW(체크박스) · Naming NONE

## 권장 조치사항
1. **[본 PR]** `02-architecture.md §C-3` 체크박스 구현완료·PR 반영.
2. **[후속]** `webauthn.controller`·`sessions.service` 의 raw bcrypt 를 `authService.verifyPasswordForUser` 로 통합(C-3 §3 단일진실 완성) — 별도 작업, 비차단.
3. **[선택]** `verifyPasswordForUser` 계약·에러코드 spec 등재(planner) — spec 무변 원칙상 후속.
