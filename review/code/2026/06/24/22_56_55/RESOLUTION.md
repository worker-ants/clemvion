# Review Resolution — web-chat-page.test multiple-match 수정 (#692 후속)

리뷰 SUMMARY: `review/code/2026/06/24/22_56_55/SUMMARY.md`
**위험도 LOW · Critical 0 · Warning 3.** 6 reviewer 중 5 success, 1 fatal(side_effect).

## 반영 (Addressed)

| # | 카테고리 | 조치 | 커밋 |
| --- | --- | --- | --- |
| W-3 | Maintainability | nested `describe("저장 버튼 흐름")` 블록 3곳의 `findAllByText` 로드 게이트 들여쓰기 불일치(replace_all substring 매칭 부작용으로 첫 주석 6-space·나머지 4-space) → `prettier --write` 로 6-space 통일. 포맷-only. | fcbd0b66 |

## 보류 (Deferred — 근거 명시)

| # | 카테고리 | 사유 |
| --- | --- | --- |
| W-1 | 테스트 신뢰성 | 저장 성공/실패 테스트의 `if (!saveBtn.hasAttribute("disabled"))` 조건부 단언(dirty 미유발 시 silent skip) — **#679/#692 선재 코드**로 본 커밋(`findByText`→`findAllByText` multiple-match 수정) 범위 밖이다(리뷰 INFO #4 도 "이번 커밋 범위 밖 기존 코드" 명시). 조건부 가드는 dirty-trigger selector(`getAllByRole("textbox")[0]`)의 불확실성을 흡수하는 의도적 장치라, `expect(saveBtn).not.toBeDisabled()` 선행 단언으로 바꾸려면 신뢰성 있는 dirty-trigger selector 도입이 선행돼야 한다(별도 작업). main unblock(multiple-match) 목적과 분리. |
| W-2 | 테스트 신뢰성 | `findAllByText` 로드 게이트 직후 동기 `getByRole` 의 **이론적** race — 실제로는 테스트가 격리·full·재실행 전부 안정 통과(11 pass). save 테스트를 `findByRole(/Save/)` 게이트로 바꾸는 robustness 개선은 가능하나, 현 게이트가 안정적이라 multiple-match 수정 범위 밖 polish 로 defer. |
| INFO #2/#3 | 테스트 표현성 | line 146 의 `.length > 0`(`findAllByText` 가 미매칭 시 자체 throw 라 중복) — interaction 필터 테스트의 **명시적 존재 단언** 의도를 살려 유지. `toHaveLength(2)` 는 #692 구조에 brittle 트레이드오프라 미채택. |
| INFO #1 | 유지보수성 | 6곳 반복 `findAllByText` 패턴의 `waitForInstanceLoaded` 헬퍼 추출 — 선택적 개선, 본 최소 unblock 범위 밖. |
| — | side_effect fatal | side_effect reviewer 가 transient fatal(output 미생성). **test-only 변경(production 코드 0)**이라 side-effect 평가 자체가 N/A 이며, scope·security·requirement reviewer 가 "프로덕션 무변경·side-effect 없음" 으로 corroborate. 결론(LOW/Critical 0)은 5 success reviewer + test-only 성격으로 견고. 재실행 불요로 판단. |

## 무관 관찰 (별건)

- `schedules-page.test.tsx` 의 "표현 불가 cron(*/5)" 테스트가 full-parallel unit 에서 `findByRole` 타임아웃으로 간헐 실패(flaky) — 격리 재실행 10 pass·full unit 재실행 green. 본 PR 무관, main 의 별도 flaky 이슈로 기록(후속 안정화 백로그).

## 재검증

W-3 fix 후: `prettier --check` clean, lint PASS, web-chat 11 pass. 포맷-only 변경이라 직전 build·unit(full green)·e2e(214) 유효.
