# Code Review 통합 보고서 — C-3 (fresh, resolution 커버)

## 전체 위험도
**LOW** — 신규 취약점 0(Critical 0). 유일 WARNING 은 pre-existing brute-force(C-3 도입 아님, 후속 추적 중). 이전 ai-review(17_22_15) W1·W2 수정 확인됨.

## Critical
_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견 | 조치 |
|---|---------|------|------|
| 1 | 보안 (pre-existing) | `POST /auth/2fa/disable` brute-force 제한 없음(`@Throttle`/`incrementLoginAttempts` 부재) | **defer**(비차단) — 리뷰어 명시 "**C-3 신규 도입 아닌 기존 패턴, 본 PR 범위 밖**". 카운터/Throttle 추가는 behavior-change 라 behavior-preserving C-3 와 분리. plan/RESOLUTION 의 §범위 밖 에 등재됨 |

## 참고 (INFO) — 주요
- **SPEC-DRIFT(INFO)**: `verifyPasswordForUser` 흐름·에러코드가 `data-flow/2-auth.md §1.2`·`error-codes.md` 미반영 — 코드 정확, spec 갱신(planner) 후속.
- 보안: 타이밍 사이드채널(`!user||!hash` 분기 bcrypt 생략) — JWT 인증 전용·pre-existing, 저위험. comparePassword 파라미터 순서·민감정보 노출·BCRYPT_ROUNDS=12(OWASP)·인증 가드 보존 = 전부 정상.
- 테스트(NONE): 4분기 전 커버, **이전 W1·W2 수정 완료**, mock 격리 향상.
- 유지보수(NONE): controller 11줄→1줄, God Object 모니터링(재인증 2건+시 ReauthService 분리). @throws 태그(선택).

## 에이전트별 위험도
security LOW(pre-existing brute-force·timing) · requirement NONE(SPEC-DRIFT INFO) · scope NONE · side_effect NONE · maintainability NONE · testing NONE(W1·W2 수정 확인) · documentation NONE

## 권장 조치 (전부 후속/선택)
1. [후속·보안] 2FA disable brute-force 보호(@Throttle/카운터) — behavior-change, 별도.
2. [후속·planner] data-flow §1.2 verifyPasswordForUser 흐름 + error-codes 등재.
3. [선택] @throws JSDoc 태그. AuthService 책임 모니터링.

## 라우터
routing=all(강제 7 reviewer 전원 실행 — resolution 커버용).

## 결론
**Critical 0, WARNING 1(pre-existing·범위 밖·후속 등재).** C-3 자체는 clean. RESOLUTION.md 로 W1 deferral 문서화.
