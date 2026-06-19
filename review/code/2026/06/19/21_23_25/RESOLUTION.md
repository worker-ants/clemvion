# RESOLUTION (follow-up) — 모델 select 방어적 경고 + multiselect

SUMMARY: `review/code/2026/06/19/21_23_25/SUMMARY.md` (3 reviewer, 전체 LOW, Critical 0, 코드 결함 0).
조치는 REVIEW WORKFLOW 단일 커밋에 포함.

## 조치 항목

| SUMMARY 발견 | 심각도 | 조치 |
| --- | --- | --- |
| testing: stale+expression 동시 발화 미검증 | Warning | "shows BOTH stale and expression warnings together" 케이스 추가 |
| testing: expression 미발화 분기(정상 모델명) 미검증 | Warning | chat·embedding 각 "no expression warning for normal value" 추가 |
| testing: locale store teardown 미비 | Info | 양 describe afterEach 에 `setLocale("ko")` 리셋 |
| impl-done: §12.12 "현 결정" 문구 stale | Info | "모델 ID expression 문자열" → "모델 식별자(모델명 문자열) ... select 전환" 정정 |

위젯 테스트 14 → 17 cases.

### NO-FIX / 범위 외 (근거)
- side-effect "Warning"(3-way 정합) — reviewer 자체 해소(실제 문제 없음).
- embedding stale 경고 부재 — FU1 명시 범위가 "chat" (요구사항 범위, 추후 후보).
- i18n 문자열 내용 미검증 — testid + dict parity guard 로 충분(프로젝트 관행).

## TEST 결과 (테스트 보강 후 재수행)
- **lint**: 통과 (45s)
- **unit**: 통과 (47s) — 위젯 17 cases 포함, flaky http-request abort 재현 없음
- **build**: 통과 (72s)
- **e2e**: 통과 — 직전 follow-up e2e(35 suites·205 tests 전원 PASS) 이후 변경은 frontend 테스트
  추가(.test.tsx)·spec/review 문서·§12.12 문구뿐 → **런타임·백엔드 e2e surface 무변경**으로 carried
  forward. (이전 e2e: jest open-handle teardown hang 이나 테스트 결과 전원 PASS — 러너 정리 완료.)

## 보류·후속 항목
- embedding 위젯 stale 경고(FU1 의 chat 범위 밖) — 후속 후보.
- (없음) FU1/FU3/FU4 구현 완료, FU2 는 기존 ModelSelectField noModelsFound 로 충족.
</content>
