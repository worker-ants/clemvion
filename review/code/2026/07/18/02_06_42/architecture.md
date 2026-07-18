# 아키텍처(Architecture) 리뷰

대상: `.claude/tools/bootstrap-session.sh`, `.claude/hooks/lint_mermaid_posttooluse.py`,
`.claude/hooks/_lib/mermaid_lint_ready.py`, `.githooks/pre-commit`,
`.github/workflows/harness-checks.yml`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.claude/tests/test_mermaid_lint_ready.py`

## 발견사항

- **[WARNING]** "main 체크아웃 루트(main_root)" 해석 로직이 3곳에 독립 재구현되어 있고, 실패 시 시맨틱이 서로 다름
  - 위치: `bootstrap-session.sh:48-49`, `.githooks/pre-commit:489-491`, `lint_mermaid_posttooluse.py:299-322`(`_resolve_tool_dir`)
  - 상세: 세 곳 모두 "`git rev-parse --path-format=absolute --git-common-dir` 의 부모 디렉터리 = main 체크아웃"이라는 동일 지식을 각자 재구현한다. 그런데 그 지식이 실패했을 때 동작이 셋 다 다르다 — bootstrap 은 `|| exit 0` 으로 스크립트 전체(4개 책임 전부)를 조용히 종료하고, pre-commit 은 `${common:-$repo_top/.git}` 로 현재 워크트리(`repo_top`)를 main 체크아웃으로 조용히 가정(fallback)하며, python `_resolve_tool_dir` 은 예외를 잡아 `None` 을 반환한다. `--path-format=absolute` 옵션은 git 2.31+ 에서만 지원되므로, 오래된 git 환경에서는 이 라인이 실제로 실패할 수 있는 현실적 시나리오다. 흥미로운 점은, 이 프로젝트가 정확히 이런 "N곳이 합의해야 하는 지식"의 drift 위험을 이미 심각하게 다루고 있다는 것이다 — `mermaid_lint_ready.py` 의 docstring 은 "Three places must agree on this, or they drift into the exact bug this guards" 라고 명시하며 공유 SoT 모듈 + `ConsumerBindingTest` 로 마커 이름의 합의를 강제한다. 그러나 논리적으로 더 선행하고 동등하게 3중 합의가 필요한 "main_root 해석" 자체에는 같은 수준의 방어(공유 구현 또는 합의를 pin 하는 테스트)가 적용돼 있지 않다. 부수적으로, bootstrap-session.sh 의 이 실패 경로(L48)는 이 스크립트의 다른 모든 실패 경로(예: "mermaid-lint: skipped (tooling deps not installed)")가 지키는 "스킵할 때는 반드시 stderr 로 신호를 남긴다"는 관례에서 유일하게 벗어나 완전히 침묵한다 — 오래된 git 환경에서는 hooksPath 활성화·mermaid 설치·상태 GC·reap 4가지 책임이 전부, 매 세션마다, 아무 신호 없이 비활성인 채로 남을 수 있다.
  - 제안: 최소한 bash 두 곳(bootstrap, pre-commit)은 소싱 가능한 공유 스니펫(예: `.claude/tools/lib/resolve-main-root.sh`)으로 추출해 중복을 제거하거나, 세 구현이 동일 입력에 대해 동일 `main_root` 를 반환함을 pin 하는 테스트를 추가할 것. bootstrap 의 L48 실패 경로에는 다른 실패 경로와 일관되게 짧은 stderr 진단(예: "bootstrap: skipped (unsupported git version or not a git repo)")을 추가하는 것을 고려.

- **[INFO]** `bootstrap-session.sh` 는 4개 책임을 한 파일에 담고 있으나(SRP), 섹션별 독립 게이팅으로 실질 리스크는 낮음
  - 위치: `bootstrap-session.sh` 전체 (주석 L35-43 "Four responsibilities")
  - 상세: git hooksPath 설정, mermaid-lint 설치(원자적 락 + PID liveness + 유예시간 + 실패 스로틀, 약 80줄), 상태 마커 GC, 워크트리 reap 이 한 파일에 공존한다. 다만 각 섹션이 독립된 `if` 게이트로 실패가 격리돼 있고(한 섹션의 버그가 다른 섹션에 전파되지 않음), 실제로 `test_bootstrap_mermaid_install.py` 는 reap 섹션이 fixture 에 없어 "inert" 하다고 명시하며 섹션 2만 독립적으로 구동해 검증한다 — 즉 파일은 하나지만 절차적으로는 이미 분리 가능한 구조다. 4개 중 가장 복잡한 섹션 2(설치 락/마커/스로틀)가 이후 더 커지거나, 두 번째 유사 도구가 추가된다면 별도 스크립트로 물리적으로 분리하는 편이 테스트·재사용 관점에서 유리하다.
  - 제안: 현 시점 액션 불요. 두 번째 "게이트가 걸린 1회성 설치" 요구가 생기면 섹션 2를 독립 스크립트로 추출.

- **[INFO]** `mermaid_lint_ready.py` 가 mermaid-lint 전용으로 하드코딩되어 있어 일반화 여지가 낮음
  - 위치: `mermaid_lint_ready.py` 전체 (`MARKER_NAME` 단일 상수, `marker_path` 가 항상 `node_modules` 하위를 가정)
  - 상세: "설치 완료 마커" 패턴(파티셜 설치 방지) 자체는 향후 다른 npm 기반 도구에도 재사용 가능한 일반 패턴이지만, 현재 모듈명·상수·경로 구조가 mermaid-lint 전용이다. 도구가 하나뿐인 현재는 YAGNI 상 적절한 선택이다.
  - 제안: 두 번째 게이트 대상 도구가 필요해지는 시점에 `tool_dir`/`marker_name` 을 매개변수화한 범용 모듈로 일반화를 검토. 지금은 액션 불요.

- **[INFO]** CI 워크플로 paths 리스트가 디렉터리 단위 glob 과 개별 파일 등재를 혼용
  - 위치: `harness-checks.yml:584-587` (`scripts/report_playwright_flaky.py`, `scripts/check-e2e-playwright-config.py` 개별 등재)
  - 상세: `.claude/**` 하위는 디렉터리 glob 이라 신규 파일도 자동 커버되지만, `scripts/` 는 harness-covered 스크립트만 개별 파일 단위로 등재하는 방식이다(주석: "harness unittest 가 커버하는 것은 명시 등재"). 향후 harness unittest 커버리지가 새 `scripts/*.py` 로 확장될 때 이 리스트 갱신을 누락하면, 이 PR 의 주석들이 반복 경고하는 것과 동일한 클래스의 "CI 미트리거 gap" 이 `scripts/` 에 대해서만 재발할 수 있다.
  - 제안: 새 harness-covered 스크립트를 `scripts/` 에 추가할 때 "harness-checks.yml paths 갱신"을 체크리스트 항목으로 남겨둘 것.

- **[INFO, 긍정적 관찰]** 레이어 분리·SoT·fail-open 일관성이 전반적으로 견고함
  - 상세: (1) 훅 래퍼(`lint_mermaid_posttooluse.py`, `.githooks/pre-commit`)는 의도적으로 얇고, 실제 파싱 로직은 공유 엔진(`lint-mermaid.mjs`)에 100% 위임 — 두 진입점 모두 동일 로직을 재구현하지 않는다. (2) PostToolUse 의 정규식 fast-path(`FENCE_RE`)는 "펜스 존재 여부"에 대한 성능 최적화 휴리스틱일 뿐이며, 설령 이 휴리스틱이 실제 파서보다 덜 관대해 일부 mermaid 블록을 놓치더라도(fail-open, 거짓음성만 가능) `.githooks/pre-commit` 이 정규식 없이 모든 staged markdown 을 노드 파서로 재검사하는 백스톱 역할을 하므로 defense-in-depth 가 성립한다. (3) `.githooks/pre-commit` 은 `repo_top`(git-tracked, 워크트리마다 존재 — `branch_guard.py`, `mermaid_lint_ready.py`) 과 `main_root`(gitignored, 공유 — `node_modules`) 를 파일의 존재 위치 특성에 맞게 정확히 구분해서 사용한다. (4) 순환 의존성 없음 — `mermaid_lint_ready.py` 는 다른 모든 파일이 참조하는 리프(leaf) 모듈이며 자신은 아무것도 참조하지 않는다. (5) mkdir 락 + PID liveness + 완료 마커는 macOS 에 flock 이 없는 제약 하에서 올바르게 선택된 패턴이며, 알려진 한계(ABA/PID 재사용)는 코드 내에서 이미 투명하게 문서화·추적되고 있다.

## 요약

이번 변경분은 하네스 자동화 계층(세션 부트스트랩, git 훅, PostToolUse 린트 훅)으로, 애플리케이션 레이어 아키텍처(프레젠테이션/비즈니스/데이터)보다는 인프라·툴링 아키텍처로 평가하는 것이 적절하다. 훅 어댑터가 얇고 실제 로직(브랜치 정책, mermaid 파싱, readiness 판정)을 공유 모듈에 위임하는 구조, `mermaid_lint_ready.py` 를 단일 진실 공급원으로 삼고 `ConsumerBindingTest`/실행 기반 테스트로 3개 소비자(bash 설치자, bash pre-commit, python PostToolUse)의 합의를 강제하는 설계, 원자적 mkdir 락과 완료 마커를 이용한 동시성 제어는 모두 이 문제 영역에 적합한 패턴이며 순환 의존성도 없다. 가장 눈에 띄는 개선 여지는, 정확히 이 프로젝트가 마커 이름에 대해서는 엄격하게 적용한 "공유 SoT + 합의 테스트" 원칙이, 그보다 선행하는 "main 체크아웃 루트 해석" 로직에는 적용되지 않아 3곳에서 서로 다른 실패 시맨틱으로 중복 구현되어 있다는 점이다. 나머지 관찰(부트스트랩 4책임 통합, mermaid_lint_ready 의 도구별 하드코딩, CI paths 리스트의 수동 유지보수)은 모두 현재 규모에서는 합리적인 트레이드오프이며 즉각적인 조치가 필요하지는 않다.

## 위험도

LOW
