# Consistency Check (--impl-done, fresh post-resolution) — C-3

**BLOCK: NO** — 5 checker 전원 **NONE**. 차단 사유 없음.

## 전체 위험도
**NONE** — `AuthController.disable2fa` 인라인 bcrypt 검증을 `AuthService.verifyPasswordForUser` 로 이관한 순수 레이어 정렬. 외부 API 계약·에러 코드·HTTP 401 shape 무변.

## Critical / WARNING
_없음_

## 참고 (INFO) — 전부 비차단·후속
- Cross-Spec: `verifyPasswordForUser` spec 진입점 미기재(`data-flow/2-auth.md §1` / `1-auth.md §1.4` 한 줄 추가 선택, planner).
- Cross-Spec/Convention: `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 에러 카탈로그 미등재 — **pre-existing gap, 이번 변경 신규 아님**(planner, 별도 plan).
- Rationale/Convention: data-flow §1.2 에 "bcrypt 비교는 AuthService 집중" 원칙 명문화(선택).
- Naming: `webauthn.controller`·`sessions.service` 도 동일 에러 코드 독자 생성 — 장기 `verifyPasswordForUser` 공유로 단일화(범위 밖, C-3 §3 후속).

## Checker별 위험도
Cross-Spec NONE · Rationale-Continuity NONE(plan §C-3 정확 이행) · Convention NONE · Plan-Coherence NONE · Naming NONE

## 결론
**BLOCK: NO.** resolution 후 fresh 검토에서도 spec-consistency clean. 후속(spec 문서·webauthn/sessions 통합·brute-force 보호)은 RESOLUTION/plan 에 등재.
