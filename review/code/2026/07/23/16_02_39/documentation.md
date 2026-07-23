# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 신규 테스트 파일이 `.claude/tests/README.md` 의 "What's covered" 표에 등재되지 않음
  - 위치: `.claude/tests/README.md` (이번 diff 에 포함되지 않은 파일 — 21~38행의 `| File | Guards |` 표), 신규 파일은 `.claude/tests/test_dependabot_npm_coverage.py`
  - 상세: 이 README 는 "What's covered" 표에서 `.claude/tests/` 하위 모든 `test_*.py` 파일을 1:1 로 나열하고 각 파일이 지키는 불변식을 한 줄로 요약한다(현재 15개 파일 전부 등재). 이번 변경으로 새로 추가된 `test_dependabot_npm_coverage.py` (파일 1, 153줄, 4개 테스트 케이스, 매우 상세한 모듈 docstring 보유)는 이 표에 없다. 이 표를 강제하는 별도 가드 테스트는 없음을 확인했다(`test_agent_consistency.py` 는 다른 README — `code-review-agents/README.md` — 를 검사할 뿐, `.claude/tests/README.md` 표 완전성은 검사하지 않음). 즉 순수 컨벤션 위반이며 CI 로는 잡히지 않는다.
  - 제안: `.claude/tests/README.md` 의 표에 `test_dependabot_npm_coverage.py` 행을 추가한다. 다른 행들의 톤(가드 대상 불변식 + 왜 존재하는지 1~2문장)을 따라 예: "`git ls-files`의 package.json 을 pnpm-workspace `packages:` 글롭과 대조해 워크스페이스 밖 npm 트리를 뽑고, 각각이 `.github/dependabot.yml` 의 npm `directory:` 에 등재됐는지·역방향(stale 등록)까지 검증. 손수 짠 YAML 파서라 파서 sanity 테스트 3건으로 vacuous pass 를 차단." 이미 `plan/in-progress/harness-guard-followups.md` §F 잔여 항목(파일 4, 249~255행)에 거의 동일한 요약 문구가 있어 그대로 재사용 가능.

- **[INFO]** e2e.yml 신규 주석의 GitHub 기능 서술이 검증 없이 단정적
  - 위치: `.github/workflows/e2e.yml` 15행 (diff 게이트 15행: `# itself. (GitHub does not allow negating a single path out of paths-ignore.)`)
  - 상세: "GitHub 은 paths-ignore 에서 특정 경로만 예외 처리하는 문법을 제공하지 않는다"는 설계 근거가 주석에 박제됐다. GitHub Actions 의 `paths`/`paths-ignore` 는 실제로 `!` 부정 패턴을 지원하며(패턴 순서에 따라 뒤에 오는 `!pattern` 이 앞선 매치를 되돌릴 수 있음), 이론상 `.github/**` 다음에 `'!.github/workflows/e2e.yml'` 을 추가해 "e2e.yml 자기 자신만 예외" 를 표현할 여지가 있다. 이 주석의 결론(→ `workflow_dispatch` 도입)은 그 자체로 여전히 합리적인 안전장치이므로 실질적 문제는 아니지만, 근거로 든 사실 진술이 부정확할 경우 향후 이 주석을 읽고 재판단하는 사람에게 오도된 전제를 줄 수 있다.
  - 제안: 필수는 아니나, "특정 경로만 예외 처리하는 문법이 없다"는 단정 대신 "동일 파일에 대해 paths-ignore 부정 패턴을 조합하는 대안도 있으나 가독성·유지보수성상 `workflow_dispatch` 를 택했다" 정도로 완화하면 근거가 더 견고해진다. 리뷰 차단 사유는 아님.

## 요약

이번 변경 4개 파일은 전반적으로 문서화 수준이 높다. 신규 테스트 `test_dependabot_npm_coverage.py` 는 모듈·함수·클래스 전체에 "왜 존재하는가"까지 담은 docstring 을 갖췄고, `e2e.yml`·`harness-checks.yml` 의 CI 트리거 변경에는 PROJECT.md·과거 리뷰 산출물을 인용한 상세 인라인 주석이 딸려 있으며, `plan/in-progress/harness-guard-followups.md` 는 완료 항목의 결정 배경(부수 결정 포함)을 충실히 기록했다. 유일한 실질적 갭은 `.claude/tests/README.md` 의 "What's covered" 표가 신규 테스트 파일 등재라는 이 저장소 자체 컨벤션(15개 기존 파일 전부 준수)을 이번 파일만 놓쳤다는 점이며, 이는 가드 테스트로 강제되지 않아 조용히 누락될 수 있다. CHANGELOG.md·README(product)·API 문서·환경변수 문서는 이번 변경 범위(하네스 CI 설정 + 하네스 자체 테스트)와 무관해 갱신 불필요로 판단했다.

## 위험도
LOW
