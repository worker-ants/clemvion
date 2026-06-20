# RESOLUTION — C-3 fresh ai-review (2026-06-20 17_34_51)

위험도 **LOW**, Critical 0, WARNING 1. 이전 ai-review(17_22_15) W1·W2 수정이 본 fresh review 에서 확인됨(testing INFO #15).

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W1 | 보안 (pre-existing) | `POST /auth/2fa/disable` brute-force 제한 부재(`@Throttle`/`incrementLoginAttempts`) | **defer (비차단, 근거 기록)** — 리뷰어 명시 "**C-3 신규 도입 아닌 기존 패턴, 본 PR 범위 밖**". 옛 controller 의 disable2fa 도 동일하게 카운터 미작동이었으므로 C-3(behavior-preserving 레이어 이관)이 도입한 회귀가 아니다. 보호 추가(카운터/Throttle)는 disable2fa **동작을 바꾸는 보안 기능**이라 refactor PR 에 섞으면 scope 위반 — 별도 보안 작업으로 분리. `plan/in-progress/refactor-c3-auth-bcrypt-service.md §범위 밖` + `02-architecture.md §C-3 후속` 에 등재됨 |
| INFO SPEC-DRIFT | 요구사항 | `verifyPasswordForUser` 흐름·에러코드 spec 미반영 | **defer (planner)** — 코드 정확, C-3 는 spec 무변(D 판정). `data-flow/2-auth.md §1.2`·`error-codes.md` 갱신은 planner 후속(plan 등재) |

INFO(타이밍 사이드채널·@throws 태그·God Object 모니터링)는 저위험/선택 — 미조치(후속 모니터링).

## TEST 결과

(resolution fix 는 직전 커밋 `ae3d46d2` 에서 완료 — 본 fresh review 는 그 fix 를 커버. 추가 코드 변경 없음.)

- **lint**: PASS (52s).
- **unit**: PASS — auth.service.spec 45 tests(verifyPasswordForUser 4분기) · auth.controller.spec.
- **build**: PASS (tsc 76s).
- **e2e**: 통과 (205 tests — 2FA disable 동작 보존).

## 보류·후속 항목

- **W1 보안**: 2FA disable brute-force 보호(@Throttle/카운터) — behavior-change, 별도 보안 작업.
- **C-3 §3 단일진실**: `webauthn.controller`·`sessions.service` raw bcrypt → `verifyPasswordForUser` 통합.
- **spec 문서(planner)**: `data-flow/2-auth.md §1.2` 흐름 + `error-codes.md` 등재.
