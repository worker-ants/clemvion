# RESOLUTION — PR2 4th round (17_10_32)

review session: `review/code/2026/07/06/17_10_32/` · risk=LOW, Critical=0, Warning=2

## 조치 항목

| SUMMARY # | 유형 | 조치 | 결과 |
| --- | --- | --- | --- |
| WARNING 1 | security | 이메일 subject 헤더 CRLF 인젝션 방어 — `notification.title.replace(/[\r\n]+/g, ' ')` 로 개행 봉합(title 은 사용자 입력 유래 가능) + 회귀 테스트(`\r\nBcc:` → 공백 치환) | fixed |
| WARNING 2 | testing | `email: ''` 빈 문자열 경계 — `!email` 가드 skip 명시 테스트 | fixed |

INFO 전부 비차단(SPEC-DRIFT=spec-update plan 위임·CTA 확인·entity nullable=pre-existing·await/e2e defer=PR3·In() white-box 단언=저우선).

## TEST 결과
- lint: 통과
- unit: 통과 (388 suites; CRLF·email:'' 테스트 포함)
- build: 통과
- e2e: 통과 (236 passed — CRLF fix 후 재실행)

## 보류·후속 항목
- e2e/DI 통합(channel=email) → PR3.
- SPEC-DRIFT flip → spec-update-notifications-email.md(planner).
- await decouple → PR3.
