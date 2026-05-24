# RESOLUTION — 17_12_34

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 (security.md) | 코드/scope-out | — | 본 PR scope 외. `chat-channel-e2e-hardening` 후속 plan 으로 기록 (아래 §보류·후속 항목) |
| W2 (security.md) | 코드 | `61f28ed2` | `FORM_SUBMITTED_GUIDANCE_MESSAGE` JSDoc 에 보안 경계 주석 추가 (message 는 하드코딩 상수만, 사용자 입력은 data 필드로만) |
| W3 (scope.md / plan) | 코드 | `61f28ed2` | `plan/in-progress/form-resubmit-fix.md` 체크리스트 항목 4·5 → `[x]` 로 갱신 |
| W4 (testing.md) | 코드 | `61f28ed2` | `FORM_SUBMITTED_GUIDANCE_MESSAGE` → `export const` 노출; spec 파일 import 후 `toMatch` regex 3곳 → `toEqual(FORM_SUBMITTED_GUIDANCE_MESSAGE)` 강화 |
| W5 (testing.md) | 코드 | `61f28ed2` | systemPrompt 테스트 `mock.calls[0]` → `mock.calls.at(-1)!` 통일 |
| W6 (testing.md) | 코드 | `61f28ed2` | `processMultiTurnMessage('plain text', state, {source:'form_submitted'})` 호출 후 `__raw__` 분기 `ok:true` / `data.__raw__` / `message` 가드 필드 단언 테스트 1건 추가 |
| W7 (plan) | 코드 | `61f28ed2` | W3 과 동일 commit — 체크리스트 항목 4·5 갱신 반영 |

## TEST 결과

- lint  : 통과 (`_test_logs/lint-20260524-172120.log`)
- unit  : 통과 (4687 passed, `_test_logs/unit-20260524-172218.log`)
- e2e   : 통과 (108/108, `_test_logs/e2e-20260524-172301.log`)

## 보류·후속 항목

- W1 (security.md — `password_hash = 'x'` e2e fixture 평문): 본 PR scope 외. `chat-channel-e2e-hardening` 후속 plan 신설 여부는 main 흐름으로 escalate (ESCALATE=no 이나 W1 follow-up plan 신설은 사용자 결정).
- INFO 항목들 (maintainability.md — `PRESENTATION_TOOLS_GUIDANCE` 장문화 리팩토링, 상수 선언 순서, e2e fixture 헬퍼 추출, regex 상수 추출): 소규모 개선 후속 plan 또는 다음 grooming session.
- INFO (security.md — formData 크기 제한 부재): 후속 별도 plan.
- INFO (security.md — email_verified: false 사용자 거부 흐름 테스트 누락): 후속 별도 plan.
- plan/in-progress/form-resubmit-fix.md 체크리스트 항목 6–9 는 현재 PR 진행 중. plan complete 이동(`git mv`)은 본 RESOLUTION + 재테스트 PASS 확인 후 main 흐름이 처리.
