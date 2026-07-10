# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `playwright.config.ts` reporter 배열에 `json` 추가는 전역 설정이라 CI 뿐 아니라 로컬 개발 실행에도 적용됨
  - 위치: `codebase/frontend/playwright.config.ts` reporter 배열 (`["json", { outputFile: "playwright-report/results.json" }]`)
  - 상세: `retries`/`workers`처럼 `process.env.CI` 로 분기되지 않아, 로컬에서 `npm run e2e`/`playwright test` 를 돌려도 항상 `playwright-report/results.json` 이 새로 생성(매 실행 덮어쓰기)된다. 다만 `codebase/frontend/.gitignore:46`에 `playwright-report/` 가 이미 등록돼 있어 실수로 커밋될 위험은 없고, html/list reporter 도 이미 같은 디렉터리에 파일을 쓰고 있어 새 파일시스템 부작용의 성격 변화는 없음(추가 파일 1개일 뿐).
  - 제안: 조치 불필요(의도된 additive 부작용). 로컬 dev 에서 불필요하다고 판단되면 `process.env.CI ? [...] : [...]` 로 분기할 수 있으나 현재 리스크는 낮음.

- **[INFO]** 신규 CI step 이 `if: always()` 라 선행 `checkout` 실패 같은 극단 상황에서도 실행 시도됨
  - 위치: `.github/workflows/e2e.yml` — `Surface flaky (retry-passed) tests` step
  - 상세: `always()` 조건은 "e2e 테스트 실패 시에도 flaky 정보를 남긴다"는 의도(주석에 명시)대로 정확히 동작한다. 다만 `actions/checkout@v7` 자체가 실패하는 극단 케이스에서는 `scripts/report_playwright_flaky.py` 파일이 체크아웃되지 않아 `python3: can't open file` 로 이 step 도 실패한다 — 그러나 job 은 이미 checkout 실패로 실패 처리되는 경로이므로 실질적 side effect(부가적 혼란스러운 두 번째 실패 로그)는 미미하고 job 최종 결론(성공/실패)에는 영향 없음.
  - 제안: 조치 불필요. 원한다면 `if: always() && github.event_name != ''`처럼 방어할 수도 있으나 실익이 낮아 defer 가능.

- **[NONE]** 새 CI step / 스크립트가 CI 게이트(빌드 성공/실패)에 영향을 주지 않음을 확인
  - 위치: `scripts/report_playwright_flaky.py` `main()` 마지막 `return 0` / `.github/workflows/e2e.yml` 신규 step
  - 상세: 리포트 부재(`os.path.isfile` false)·JSON 파싱 실패(`json.JSONDecodeError`/`OSError`) 모두 `return 0` 으로 삼켜지고, flaky 유무와 무관하게 항상 exit 0 이다. GitHub Actions 의 job 결론은 "이후에 실행되는 non-failing step" 으로 되돌려지지 않으므로(이미 실패한 선행 step 이 있으면 job 은 여전히 failure), 이 step 이 실패를 은폐할 가능성도 없다. `$GITHUB_STEP_SUMMARY` append 와 `::warning::` 어노테이션은 GHA 표준 사이드채널로, 다른 step 의 동일 파일 append 와도 충돌하지 않는다(현재 워크플로에 이 파일에 쓰는 다른 step 없음). 환경변수는 읽기만(`GITHUB_STEP_SUMMARY`) 하고 쓰지 않는다. 네트워크 호출 없음. 전역 변수/공유 상태 변경 없음.

- **[INFO]** 테스트 파일이 `main()` 을 flaky-발견 경로(성공 경로)로는 호출하지 않아, harness-checks CI job 자체의 `$GITHUB_STEP_SUMMARY` 를 오염시키지 않음(설계상 안전)
  - 위치: `.claude/tests/test_report_playwright_flaky.py` `MainSmokeTest.test_missing_report_returns_zero`
  - 상세: `.claude/tests/` 는 harness-checks 워크플로에서 실행되며, 그 job 에도 GitHub Actions 가 항상 `$GITHUB_STEP_SUMMARY` 를 채워둔 상태다. 만약 테스트가 `main()` 을 유효한 리포트 경로로 호출해 `find_flaky`→`_write_step_summary` 경로까지 탔다면, 이 리뷰와 무관한 harness-checks job 의 실제 step summary 에 테스트용 마크다운이 append 되는 뜻밖의 부작용이 생겼을 것이다. 실제로는 존재하지 않는 파일 경로만 넘겨 `main()` 이 조기 `return 0` 하므로 이 경로를 타지 않는다 — 우연이 아니라 안전한 설계로 보이나, 향후 이 테스트를 확장할 때(예: 실제 report dict 를 파일로 써서 `main()` 풀 경로를 태우는 테스트 추가) `GITHUB_STEP_SUMMARY` 를 모킹/격리하지 않으면 이 안전성이 깨질 수 있음을 유의.
  - 제안: 현재는 조치 불필요. 후속 테스트 추가 시 `os.environ` 을 patch 하거나 `tempfile` 로 격리할 것을 주석/컨벤션으로 남겨두면 재발 방지에 도움.

- **[INFO]** `sys.modules["report_playwright_flaky"]` 전역 등록(harness 공용 로더 관례)
  - 위치: `.claude/tests/test_report_playwright_flaky.py:46-48` (`load_module_by_path`)
  - 상세: `_harness.load_module_by_path` 가 로드한 모듈을 프로세스 전역 `sys.modules` 에 등록하는 기존 harness 관례를 그대로 재사용한 것으로, 이 diff 가 새로 도입한 위험은 아니다. 모듈명이 `report_playwright_flaky` 로 고유해 다른 harness 테스트와 충돌할 가능성은 낮음.
  - 제안: 조치 불필요.

- **[INFO]** dangling 경로 참조: 이번 커밋에서 plan 이 `in-progress`→`complete` 로 이동했는데, 신규로 추가되는 두 코드 파일의 주석/docstring 은 여전히 옛 `plan/in-progress/...` 경로를 인용
  - 위치: `codebase/frontend/playwright.config.ts:23`(unchanged 컨텍스트, 옛 경로 유지) / `scripts/report_playwright_flaky.py:15` (`배경/SoT: plan/in-progress/e2e-retry-visibility-followup.md`)
  - 상세: 실행 동작에 영향을 주는 side effect 는 아니지만(문서 텍스트일 뿐), 같은 커밋에서 plan 을 이동시켰으므로 참조가 즉시 stale 해진다. side effect 관점보다는 documentation/consistency 관점 이슈에 더 가까워 여기서는 참고 수준으로만 기록.
  - 제안: 필요시 두 참조를 `plan/complete/e2e-retry-visibility-followup.md` 로 갱신(문서 리뷰어 영역과 중복 가능).

- **[NONE]** 시그니처/공개 인터페이스 변경 없음
  - 상세: 6개 변경 파일 모두 신규 파일 추가(`.claude/tests/...py`, `scripts/report_playwright_flaky.py`), 신규 CI step(`e2e.yml`), 신규 reporter 항목(`playwright.config.ts`), plan 이동(`in-progress`→`complete`)으로 기존 함수/클래스 시그니처를 변경하는 곳이 없다. 기존 호출자에 영향 없음.

## 요약

이번 changeset 은 CI 에서 flaky(retry로 통과) 테스트를 능동 노출하기 위한 순수 additive 변경(신규 스크립트 1개, 신규 CI step 1개 `if: always()`, playwright config 에 json reporter 1개 추가, plan 이동)이다. 신규 스크립트는 리포트 부재·파싱 실패를 모두 삼켜 항상 exit 0 이며 CI 게이트에 영향을 주지 않도록 명확히 설계되어 있고, 전역 상태·환경 변수 쓰기·네트워크 호출·기존 함수 시그니처 변경은 발견되지 않았다. `$GITHUB_STEP_SUMMARY` append 와 `playwright-report/results.json` 생성은 의도된 GitHub Actions 표준 부작용이며 실제 위험은 낮다. 발견된 항목은 모두 INFO 수준(로컬 dev 에도 json reporter 적용되는 전역 config 특성, `always()` step 의 극단 checkout-failure 케이스, 향후 테스트 확장 시 `GITHUB_STEP_SUMMARY` 격리 필요성, dangling plan 경로 참조)으로 병합을 막을 사유는 없다.

## 위험도

LOW
