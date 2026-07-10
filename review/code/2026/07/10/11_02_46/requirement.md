# 요구사항(Requirement) 리뷰 — e2e flaky(retry-passed) CI surfacing

대상: `scripts/report_playwright_flaky.py`, `.claude/tests/test_report_playwright_flaky.py`,
`.github/workflows/e2e.yml`, `codebase/frontend/playwright.config.ts`,
`plan/complete/e2e-retry-visibility-followup.md` (+ 구 `plan/in-progress/` 삭제)

## 발견사항

- **[WARNING]** `harness-checks.yml` 의 `paths` 필터가 `scripts/report_playwright_flaky.py` 를 포함하지 않아, 향후 이 스크립트 단독 수정 시 회귀 게이트가 실제로 트리거되지 않는다.
  - 위치: `.github/workflows/harness-checks.yml:8-17` (paths 목록), `.claude/tests/test_report_playwright_flaky.py:1-4` (docstring 의 게이트 주장)
  - 상세: 신규 테스트 docstring 은 "파싱 로직이 조용히 회귀하면 flaky 관측 자체가 무력화된다... stdlib unittest 로 harness-checks 에서 게이트한다" 고 명시한다. 그러나 `harness-checks.yml` 의 `on.pull_request.paths` 목록은 `.claude/agents|hooks|skills|tests|tools/**`, `.claude.project.json`, `PROJECT.md`, 워크플로 자신만 나열하고 저장소 루트 `scripts/**` 는 전혀 포함하지 않는다. 이번 PR 은 `.claude/tests/test_report_playwright_flaky.py` 도 함께 추가하므로 이번 커밋에서는 트리거되지만, 이후 누군가 `scripts/report_playwright_flaky.py` 로직만 고치고 테스트 파일을 안 건드리면(또는 건드려도 다른 필터 조건에 안 걸리면) 해당 PR 에서 `harness-checks` 워크플로 자체가 실행되지 않아 회귀가 감지되지 않는다. 동일 저장소의 `migration-check.yml` 은 정확히 이 패턴을 위해 `scripts/check-migration-versions.py` 를 자신의 `paths` 목록에 명시적으로 포함하고 있어(`.github/workflows/migration-check.yml:20`) 확립된 선례가 있다.
  - 제안: `harness-checks.yml` 의 `paths` 목록에 `scripts/report_playwright_flaky.py` (또는 이 스크립트를 테스트하는 `.claude/tests/**` 와 논리적으로 함께 다뤄야 하는 대상이므로 `scripts/**` 혹은 해당 파일 하나)를 추가해 실제로 게이트를 성립시킨다.

- **[WARNING]** 같은 커밋에서 plan 을 `plan/in-progress/` → `plan/complete/` 로 이동시켰는데, 신규/변경 코드 주석의 plan 경로 레퍼런스가 옛 경로를 그대로 가리켜 존재하지 않는 파일을 참조한다.
  - 위치: `scripts/report_playwright_flaky.py:15` (`배경/SoT: plan/in-progress/e2e-retry-visibility-followup.md, ...`), `codebase/frontend/playwright.config.ts:23` (`// (plan/in-progress/e2e-retry-visibility-followup.md).`)
  - 상세: 파일 4/5 diff 에서 `plan/in-progress/e2e-retry-visibility-followup.md` 는 삭제되고 `plan/complete/e2e-retry-visibility-followup.md` 로 새로 생성됐다. 그런데 같은 diff 로 추가/수정된 `scripts/report_playwright_flaky.py` 와 `playwright.config.ts` 의 주석은 여전히 옛 `plan/in-progress/...` 경로를 인용한다 — 커밋 완료 시점에 이미 dangling 인 셀프 참조. `render_markdown()` 내부의 사용자 대면 메시지는 경로 없이 `plan: e2e-retry-visibility-followup` 만 써서 문제 없지만, 개발자 대상 docstring/주석 두 곳은 부정확하다.
  - 제안: 두 곳 모두 `plan/complete/e2e-retry-visibility-followup.md` 로 갱신.

- **[WARNING]** `main()` 이 "항상 exit 0, 리포트 부재/파싱 실패에도 CI 를 깨지 않는다" 는 명시적 설계 불변식을 완전히 보장하지 않는다 — 파일 부재(`os.path.isfile`)와 JSON 디코드 실패(`json.JSONDecodeError`/`OSError`)만 방어하고, `find_flaky`/`render_markdown`/`_write_step_summary` 호출 중 발생 가능한 그 외 예외(예: 유효한 JSON 이지만 `suites` 가 리스트가 아니거나, `spec["line"]` 이 int 로 캐스팅 불가한 값인 경우 등 스키마 이탈)는 어디서도 catch 되지 않는다.
  - 위치: `scripts/report_playwright_flaky.py:875-900` (`main`), 대비 docstring 의 "항상 exit 0" 주장(`scripts/report_playwright_flaky.py:1-15` 근처), 워크플로 쪽 `if: always()` step 에 `continue-on-error` 부재(`.github/workflows/e2e.yml:79-82`).
  - 상세: `find_flaky` 내부에서 `retries` 계산에는 `try/except (TypeError, ValueError)` 로 방어하면서(라인 819-822 상당) 바로 옆의 `int(spec.get("line") or 0)` 캐스팅에는 동일한 방어가 없어 방어 수준이 비일관적이다. 예외가 나면 `sys.exit(main(...))` 경로를 타지 않고 트레이스백과 함께 비정상 종료(exit code 1)돼, 이 스크립트 자체가 실패하면서 (workflow step 에 `continue-on-error: true` 가 없으므로) `e2e-frontend` job 전체가 실패로 뒤집힌다 — 이는 "flaky surfacing 은 비차단이어야 한다"는 변경의 핵심 취지와 정반대의 결과다. 현재 Playwright 표준 JSON 스키마 하에서는 발생 가능성이 낮은 edge case 이지만, 정확히 이 취지("파싱 실패에도 CI 를 깨지 않는다")를 지키기 위해 추가된 스크립트에서 그 취지가 100% 구조적으로 보장되지 않는 것은 설계 의도와 구현 사이의 실질적 괴리다. 테스트 스위트에도 이 경로(malformed-but-parseable JSON) 를 커버하는 케이스가 없다.
  - 제안: `main()` 에서 `find_flaky`/`render_markdown`/`_write_step_summary` 호출부를 감싸는 블랑켓 `try/except Exception` 을 추가해 "항상 exit 0" 을 구조적으로 보장하거나, 최소한 워크플로 step 에 `continue-on-error: true` 를 방어적으로 추가. 관련 malformed-schema 테스트 케이스 추가 권장.

- **[INFO]** `find_flaky` 의 `retries` 계산이 flaky 로 판정된 test 뿐 아니라 spec 내 **모든** test(project) 의 `results[].retry` 최댓값을 취한다 — 다중 project 로 한 spec 이 여러 test 를 가질 때, 실제로 flaky 인 test 보다 다른(가령 완전히 실패한 `unexpected`) test 의 retry 횟수가 더 크면 보고되는 재시도 횟수가 부정확하게 부풀 수 있다.
  - 위치: `scripts/report_playwright_flaky.py:816-822` (`find_flaky` 의 retries 루프, `for t in tests:` 가 전체 tests 순회)
  - 상세: 현재 `codebase/frontend/playwright.config.ts` 의 `projects` 는 `chromium` 단일 항목뿐이라(config 파일 컨텍스트 라인 543-548) spec 당 test 는 항상 1개 — 이 부정확성은 지금은 도달 불가능하다. 다만 같은 config 파일 상단 주석("운영 안정 후 webkit 추가는 별도 follow-up")이 명시하듯 향후 다중 브라우저 project 확장 시 실제로 드러날 수 있는 latent 갭이다. 테스트(`test_spec_flaky_if_any_test_flaky`) 도 "flaky 아닌 test 의 retry 가 더 큰" 케이스는 다루지 않는다.
  - 제안: retries 집계를 flaky 판정된 test 로 한정하도록 좁히거나(`if t.get("status") == "flaky"`), 최소한 다중-project 확장 시 재검토가 필요함을 주석으로 남긴다.

- **[INFO]** `[SPEC-DRIFT]` 아님 — 관련 spec 문서 부재는 정상. 본 변경 영역(CI 워크플로, Playwright reporter 설정, 순수 CI 유틸리티 스크립트)은 `spec/` 이 다루는 제품 요구사항 범위 밖(개발/CI 인프라)이다. `spec/` 전체를 grep 해도 "flaky" 관련 언급이 없고, `plan/complete/e2e-retry-visibility-followup.md` frontmatter 의 `spec_impact: none` 도 이와 합치한다. spec fidelity 관점에서 위반 없음.
  - 위치: N/A (spec/ 전역)
  - 상세: 요구사항 ID·필드 정의·상태 전이 등 spec 본문 대상이 존재하지 않아 CRITICAL 판정 대상이 아님.
  - 제안: 조치 불필요.

- **[INFO]** `render_markdown` 은 마크다운 테이블 셀에서 `|` 만 escape 하고 다른 마크다운 특수문자(백틱, `_`, `*` 등)는 그대로 둔다. 테스트 제목에 그런 문자가 섞이면 step summary 렌더링이 미세하게 깨질 수 있으나 현재 실 스펙 제목 관례상 발생 가능성은 낮다.
  - 위치: `scripts/report_playwright_flaky.py:851-853` (`render_markdown` 의 `title = f["title"].replace("|", "\\|")`)
  - 상세: 기능 완전성엔 지장 없음(비차단 관측용 산출물), 순수 렌더 품질 이슈.
  - 제안: 우선순위 낮음 — 필요 시 추가 escape(백틱 등) 검토.

## 요약

핵심 기능(Playwright JSON 리포트에서 `status=="flaky"` 추출 → GitHub step summary + `::warning::` 어노테이션, 항상 non-blocking exit 0)은 unit 테스트 8케이스로 잘 커버되고, `docker-compose.e2e.yml` 의 host-mount(`./codebase:/app/codebase`) 및 `pnpm --filter frontend e2e` 의 CWD 를 근거로 `playwright.config.ts` 의 `outputFile` 상대경로·`e2e.yml` 의 산출물 경로·스크립트 `DEFAULT_REPORT` 세 곳이 실제로 정합됨을 확인했다. 다만 (1) 신규 테스트가 주장하는 "harness-checks 게이트"가 워크플로 `paths` 필터 미갱신으로 향후 스크립트 단독 수정에는 실제로 성립하지 않고, (2) 같은 커밋에서 plan 을 `complete/` 로 이동시키면서 코드 주석 두 곳의 plan 경로 레퍼런스가 갱신되지 않아 즉시 dangling 상태이며, (3) "항상 exit 0" 이라는 핵심 설계 불변식이 malformed-but-parseable JSON 경로에서 구조적으로 완전히 보장되지 않는다는 점이 실제 개선 여지로 남는다. 이들은 모두 현재 정상 경로의 동작을 깨뜨리지 않는 WARNING 수준의 견고성/일관성 갭이며, spec fidelity 관점에서는 이 변경 영역이 애초에 `spec/` 범위 밖(CI 인프라)이라 위반이 없다.

## 위험도

LOW
