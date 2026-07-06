# RESOLUTION — PR2 convergence review (17_00_31)

review session: `review/code/2026/07/06/17_00_31/` · risk=LOW, Critical=0, Warning=2

## 조치 항목

| SUMMARY # | 유형 | 조치 | 결과 |
| --- | --- | --- | --- |
| WARNING 1 | testing | e2e/DI 통합 테스트(실 DB email_sent_at + 모듈 배선) | **skipped(defer→PR3)** — DI 그래프는 전체 app-boot e2e(236 통과)가 이미 검증. channel=email end-to-end 는 사용자向 발사 소스(PR3: execution_failed 등)가 있어야 자연스럽게 구동 가능 → PR3 에서 추가 |
| WARNING 2 | testing | 동일 userId 다중 email/both 알림 → In() dedup 후에도 각 알림 발송 검증 | fixed — 동일 userId 2건(email+both) → sendNotificationEmail 2회(같은 이메일) + repo.update 2회 테스트 |

INFO 전부 비차단(SPEC-DRIFT=spec-update plan 위임·entity nullable=pre-existing·await defer=PR3·휴면 부작용=배포 전 grep 권고·대량 UPDATE 배치화=후속 최적화).

## TEST 결과
- lint: 통과
- unit: 통과 (388 suites; 신규 테스트 포함)
- build: 통과 (production 코드 무변경 — 직전 라운드 PASS)
- e2e: 통과 (236 passed 인용 — 본 delta test-only, production 코드 무변경이라 회귀 불가)

## 보류·후속 항목
- WARNING 1 (channel=email e2e) → PR3(발사 소스 wiring 시).
- SPEC-DRIFT flip → spec-update-notifications-email.md(planner).
- await decouple → PR3.
