# 부작용(Side Effect) 리뷰

대상: `926bb1ecf` — flaky surfacing 리뷰(11_02_46) Warning 6 조치 (harness-checks paths·main() blanket try/except·e2e.yml continue-on-error·cross-file 경로 가드·테스트 보강·plan dangling 주석 정리).

## 발견사항

- **[INFO]** `main()` 예외 흡수가 GitHub UI(step summary/`::warning::` 어노테이션)엔 아무 신호를 남기지 않음
  - 위치: `scripts/report_playwright_flaky.py` `main()` 의 `except Exception as exc: print(...)` 블록 (라인 ~2306)
  - 상세: W4 조치로 `find_flaky`/`render_markdown`/`_write_step_summary`/`_emit_annotations` 전체를 blanket `except Exception` 으로 감싸 "항상 exit 0" 을 구조적으로 보장한 것은 적절하다. 다만 예외 발생 시 메시지는 `print()` 로 **stdout(raw 로그)** 에만 남고, `_write_step_summary`(step summary 패널) 나 `::warning::` 어노테이션(Checks 탭)에는 아무 것도 남지 않는다. 즉 이 스크립트 자체가 예상 밖 스키마로 죽는 회귀가 생겨도 CI 는 계속 green 이고, 사람이 raw 로그를 열어보지 않는 한 완전히 눈에 띄지 않는다 — "묻히는 flaky 를 드러내자"는 이 변경의 목적과는 다소 역설적인 잔여 리스크다. 다만 이 경로는 `test_unexpected_schema_does_not_crash` 로 회귀(크래시 여부)는 이미 고정돼 있으므로 "조용히 죽는다"는 사실 자체는 테스트가 잡아준다. 새 부작용이라기보단 W4 fix 가 의도적으로 선택한 트레이드오프의 잔여 표면이다.
  - 제안: 필수 아님. 원한다면 except 블록에서도 `print("::warning::flaky-report 처리 중 예외(무시)...")` 한 줄을 추가해 Checks 탭에서도 최소 가시성을 확보할 수 있다.

- **[INFO]** `continue-on-error: true` 추가로 이 step 의 실패가 job 결론에서 완전히 숨겨지는 범위가 스크립트 내부 예외를 넘어 넓어짐
  - 위치: `.github/workflows/e2e.yml` `Surface flaky (retry-passed) tests` step
  - 상세: 스크립트는 이미 항상 exit 0 이므로 정상 경로에서는 `continue-on-error` 가 아무 효과가 없다. 이 설정이 실제로 작동하는 경우는 스크립트 **바깥**의 실패(예: `python3` 인터프리터 부재, `run:` 셀 자체의 문제)뿐이며, 그 경우도 이제 job 을 실패시키지 않는다. 다음 step `Upload playwright report on failure` 의 `if: failure()` 는 job 전체(주로 `make e2e-test-full`)의 실패 여부를 보므로 이 step 자체의 (continue-on-error 로 흡수된) 실패에 영향받지 않는다 — 의도한 상호작용대로 동작한다. 커밋 docstring/주석에 "이중 방어" 로 명시돼 있어 의도된 부작용이며, 이 step 은 애초에 observability 전용(`if: always()`)이라 실패해도 실질 피해가 없다.
  - 제안: 조치 불필요(의도된 additive 방어). 참고로만 남김.

- **[INFO]** `harness-checks.yml` trigger paths 확장 — `scripts/report_playwright_flaky.py` 단독 수정 시 harness 전체 unittest(182 케이스) 트리거 범위가 넓어짐
  - 위치: `.github/workflows/harness-checks.yml` `on.pull_request.paths`
  - 상세: W1 fix 의도대로 정확한 부작용(스크립트 단독 PR 도 회귀 테스트를 반드시 태우게 함)이며, CI 비용 증가는 미미(harness-checks 는 5분 timeout, 설치 스텝 없는 stdlib-only unittest). 부정적 부작용 없음.
  - 제안: 조치 불필요.

- **[INFO]** `find_flaky` 의 `retries` 계산 semantics 변경 (전체 test → flaky test 로 한정)
  - 위치: `scripts/report_playwright_flaky.py` `find_flaky`/`_max_flaky_retry`
  - 상세: 함수 시그니처는 그대로지만 반환값의 `retries` 필드 계산 범위가 좁아졌다(비-flaky test 의 retry 는 이제 무시). 의도된 버그 수정(INFO 3 조치)이고, 이 함수는 같은 스크립트 내부와 harness 테스트에서만 소비되는 비-공개 유틸이라 외부 호출자 영향은 없다.
  - 제안: 조치 불필요. 공개 API 가 아님을 재확인.

- **[INFO]** 신규 테스트의 환경/파일시스템 격리는 적절함(부작용 없음 확인)
  - 위치: `.claude/tests/test_report_playwright_flaky.py` `WriteStepSummaryTest`, `MainIntegrationTest`
  - 상세: `mock.patch.dict(os.environ, ..., clear=True)` 와 `tempfile.TemporaryDirectory()` 로 실제 `$GITHUB_STEP_SUMMARY`/작업 디렉토리를 건드리지 않도록 격리돼 있다. `with` 블록 종료 시 환경변수는 자동 복원되고, 임시 파일도 정리된다. `CrossFilePathGuardTest` 는 `e2e.yml`/`playwright.config.ts` 를 **읽기만** 하므로 파일시스템 부작용 없음.
  - 제안: 조치 불필요(긍정 확인).

## 요약

이번 diff 는 이전 리뷰(11_02_46) 의 Warning 6건을 조치한 견고성/게이팅/정합 패치로, 전역 상태·공개 함수 시그니처·환경변수 쓰기 경로·네트워크 호출 등에 새로운 부작용을 도입하지 않는다. 유일하게 주목할 부작용은 (1) `main()` 의 blanket try/except 가 스크립트 자체의 예상 밖 예외를 Checks UI 상에서는 완전히 무음 처리한다는 점과 (2) `continue-on-error: true` 가 이 step 의 실패 흡수 범위를 스크립트 바깥(인터프리터 부재 등)까지 넓힌다는 점인데, 둘 다 커밋이 명시적으로 의도한 "항상 exit 0 / job 비차단" 설계의 자연스러운 확장이며 회귀 테스트(`test_unexpected_schema_does_not_crash`)로 크래시 여부는 고정돼 있다. 테스트 코드의 환경변수/파일시스템 사용은 `mock.patch.dict`+`tempfile` 로 잘 격리돼 실제 환경 오염이 없다. `find_flaky` 의 retries 계산 범위 축소는 비공개 유틸의 의도된 semantics 수정으로 외부 영향이 없다.

## 위험도

LOW
