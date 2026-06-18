# RESOLUTION — C-1 후속 ⑤ (ButtonInteractionService 분해) 최종

ButtonInteractionService refactor. 커밋: `4fb918d7`(refactor) + `2ad44a71`(첫 리뷰 fix).
리뷰 사이클:
- 1차 `review/code/2026/06/19/03_32_59` (MEDIUM · C0 · W6) — Warning 조치 → `2ad44a71`.
- 2차(full re-review) `review/code/2026/06/19/03_51_29` (LOW · C0 · W7) — 신규 Warning 전부 수용/이연(회귀 아님). **본 RESOLUTION 으로 수렴.**

## 1차 리뷰(03_32_59) Warning 조치 — `2ad44a71`

| # | 조치 |
|---|------|
| W1 (buildResumedStructuredOutput 단위 전무) | ✅ fix — 단위테스트 6 신설 |
| W2 (setStructuredOutput 단언 없음) | ✅ fix — port 케이스 spy 단언 |
| W3 (buttonId undefined 미검증) | ✅ fix — INVALID_BUTTON_ID 테스트 |
| W4 (link+selectedItem 미검증) | ✅ fix — 조합 테스트 |
| W5 (describe 중복) | FALSE POSITIVE — 실측 단일(L483) |
| W6 (buttonId! non-null) | ✅ fix — `clickedButton.id` 사용(byte-equiv find, 행위보존) |

## 2차 리뷰(03_51_29) Warning 처분 — 수렴 (코드 무변)

| # | 처분 / 근거 |
|---|------|
| W1 (StructuredInteraction 타입 위치) | **이연**: 본 refactor 이전부터 동 파일 거주(pre-existing). `shared/` 이동은 타 소비자 영향 대형 → 별도 후속. |
| W2 (CC~5 / let·if-else) | **수용**: 4 variant 분기 본질. helper 분리 선택적(함수 tested·명확). |
| W3 (`payload as` cast / null-risk) | **수용(회귀 아님)**: unknown→typed 경계 cast = sibling form-interaction 컨벤션. null-risk 는 원본 cast 도 동일(pre-existing) — 상위 wire-shape 보장. |
| W4 (describe 중첩) | **이연**: 테스트 구조 nicety. |
| W5 (NOW 중복) | **이연**: trivial. 수정 시 재무장 → 수렴 위해 보류. |
| W6 (setStructuredOutput link 미검증) | **이연**: port 통합 + 순수함수 단위 6 이 전 분기 커버. |
| W7 (Array 분기 주석) | **이연**: verbatim 보존 기존 방어 코드. |

**수렴 근거**: refactor 는 sound(LOW·C0·**행위보존**·27 테스트). 2차 7 Warning 은 전부 maintainability-nicety/pre-existing/convention — 회귀·버그 아님. fix→재리뷰 반복은 600줄 refactor 에서 비수렴(reviewer 가 매번 새 polish 발견). 따라서 dispositioning 으로 수렴(추가 codebase 변경 0 → push 가드 재무장 없음).

## TEST 결과

- **lint**: 통과 — backend `eslint --fix`, 변경 외 파일 무수정
- **unit**: 통과 — execution-engine **33 suites / 821 tests**; button-interaction **27** (기존 11 + 신규 8 + #6 fix; 기존 전부 green = 행위보존 증명)
- **build**: 통과 — `nest build`/tsc clean
- **e2e**: 통과 — dockerized **34 suites / 202 tests** (refactor `4fb918d7` 및 fix `2ad44a71` 양쪽 기준 각 1회 실행, 둘 다 34/202; "Jest did not exit" open-handle teardown 경고 양성)

## 보류·후속 항목

- **SPEC-DRIFT (planner)**: (a) 순수함수 추출(resolveButtonInteraction/buildResumedStructuredOutput) → `4-execution-engine.md §Rationale C-1` 한 줄, (b) `node-output.md §4.2` interaction.type 열거에 `button_continue` 추가(§4.5 와 일관) + `0-common.md §4` button_continue `url?` 조건부 정정. developer spec read-only → project-planner. `c1-engine-split.md` 등재.
- **W1 (StructuredInteraction → shared/)**: 별도 grooming/후속 ④ 영역.
- INFO(보안 hardening·매직상수·doc): 선택적 grooming.
