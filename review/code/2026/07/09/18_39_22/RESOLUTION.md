# RESOLUTION — e2e 안정화 fix 커밋 fresh 리뷰 (session 18_39_22)

대상: `SUMMARY.md` (fix 커밋 `d4a188eb0` — 16_38_12 리뷰의 Warning 3 조치분).
위험도 HIGH · **Critical 1 · Warning 0 · INFO 3**.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 결과 |
|---|---|---|---|
| **CRITICAL 1** | 검증 무결성 | **정당한 지적 — 수용·해소.** `run-test.sh e2e`(=`make e2e-test`)는 로그·Makefile 확인 결과 **backend Jest e2e(`backend-e2e-runner`, 247 tests)만** 실행하고, 본 커밋이 바꾼 **frontend Playwright 스펙 6개는 미실행**이었다(Playwright 는 `make e2e-test-full` 의 `playwright-runner` 로만 구동). → `make e2e-test-full` 재실행으로 실검증: **Playwright frontend e2e `46 passed (50.2s)` — retry·flaky 0, clean** (backend Jest 247 passed 병행, EXIT=0, log `_test_logs/e2e-full-playwright-20260709-185331.log`). 16_38_12/RESOLUTION.md 및 본 파일의 e2e 줄을 정확한 스위트명·개수·로그로 정정 | 코드 무결(d4a188eb0 무변경) · Playwright 실통과 확인 |
| INFO 1 | testing | `web-chat-console.spec.ts` 가 이미 전역동일 `DIALOG_TIMEOUT=10_000` 이라 대상 제외됨을 명시 요청 | 16_38_12/RESOLUTION.md 및 커밋 본문에 이미 기술("web-chat 은 DIALOG_TIMEOUT=10_000=전역동일이라 손댈 것 없음"). 추가 조치 불요 |
| INFO 2 | testing | 전역 미만 sub-global timeout override 재발 방지 구조적 가드(ESLint/grep) 부재 | 후속 이관 — `plan/in-progress/e2e-retry-visibility-followup.md` 에 "sub-global timeout override 검출 가드" 항목 추가(관측/컨벤션 개선, 비차단) |
| INFO 3 | dependency | 6개 스펙이 전역 `expect.timeout` 에 결합(SoT 집중화 방향) | 의도된 방향 — 조치 불요 |

### 출력 파일 부재 4건 (scope·side_effect·maintainability·documentation)

SUMMARY 가 "확인 불가"로 표기하고 HIGH 근거로 든 4개 reviewer 출력 파일 부재는 **알려진
Workflow subagent write-isolation 위양성**이다. `wf_ca4ded3b-50a/journal.jsonl` 의 `type:result`
에서 원문을 복원해 디스크에 기록(4파일 전부 존재화). 복원 내용 확인 결과 **전부 INFO only,
Critical/Warning 0**:
- **scope**: "발견사항 없음 — diff 가 W1/W2/W3 와 1:1 대응, 스코프 크리프 없음".
- **side_effect**: INFO(6개 스펙 timeout 상속 변경의 부작용 범위, 문제 아님).
- **maintainability**: INFO(members.spec 내 timeout 지정 방식 잔존 불일치).
- **documentation**: INFO(docker-compose 주석 W3 수정 정확성 확인).

즉 4개 관점에 숨은 Critical/Warning 은 없으며, 유일 Critical 은 위 #1(해소 완료)뿐이다.

## TEST 결과

- **lint**: 통과 (16_38_12 에서 확인, 이후 코드 무변경).
- **unit / build**: 미재수행 — 본 fix 이후 codebase 변경 0(RESOLUTION·review 산출물만). unit/build 대상 파일 무변경.
- **e2e**: 통과 — **frontend Playwright `46 passed (50.2s)`, retry·flaky 0** + backend Jest `247 passed` (`make e2e-test-full`, EXIT=0, log `_test_logs/e2e-full-playwright-20260709-185331.log`). ← Critical 1 해소의 실증.

## 보류·후속 항목

- INFO 2(sub-global timeout override 재발 방지 가드) → `plan/in-progress/e2e-retry-visibility-followup.md` (기존 retry-가시성 후속과 함께 CI/lint 정비 시 처리).
