# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 harness 테스트가 `subprocess` 로 `git ls-files` 를 호출(외부 프로세스 side effect)
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py` 41-46행 (`_tracked_package_jsons`)
  - 상세: `subprocess.run(["git", "ls-files", ...], cwd=REPO_ROOT, check=True)` 는 테스트 실행 시 서브프로세스를 fork 하고, git 바이너리·`.git` 메타데이터 존재를 전제한다. `check=True` 라 git 이 없거나 `cwd` 가 git 워크트리가 아니면 `CalledProcessError` 로 테스트가 실패한다. 다만 이 패턴은 같은 디렉토리의 다른 harness 테스트(`test_reap_merged_worktrees.py`, `test_bootstrap_mermaid_install.py`, `test_workflow_scripts.py` 등)에서 이미 광범위하게 쓰이는 기존 컨벤션과 동일하며, `git ls-files` 는 파일시스템/저장소 상태를 **읽기만** 하고 쓰지 않는다. 새로운 위험 패턴이 아니다.
  - 제안: 조치 불요(참고용 기록).

- **[INFO]** `import _harness` 가 모듈 로드 시 전역 `sys.path` 를 변경(기존 동작, 이 diff 가 도입한 것 아님)
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py` 27행 (`import _harness  # noqa: F401`)
  - 상세: `.claude/tests/_harness.py` 는 import 시점에 `sys.path.insert(0, str(HOOKS_DIR))` 를 실행해 프로세스 전역 `sys.path` 를 1회 변경한다. 이 신규 테스트 파일이 그 동작을 새로 만든 것은 아니고 기존 공유 harness 유틸을 그대로 소비할 뿐이며, diff 의 주석(`side effect: harness path setup`)도 이를 명시적으로 인지하고 있다. 다른 `.claude/tests/*.py` 전부가 같은 방식으로 import 하므로 일관성 있음.
  - 제안: 조치 불요.

- **[INFO]** `.github/workflows/e2e.yml` — CI 트리거 조건(공개 인터페이스) 변경, self-referential 사각지대 존재하나 문서화·완화됨
  - 위치: 8-15행(신규 주석), 21행(`- '.github/**'` push), 29행(`- '.github/**'` pull_request), 34행(`workflow_dispatch:`)
  - 상세: `.github/**` 를 `paths-ignore` 에 추가하면 이 파일 자신을 포함한 `.github/**` 하위 파일만 건드리는 PR/push 는 더 이상 자동으로 e2e 를 트리거하지 않는다 — 이는 "CI 정의 변경은 e2e 검증 대상 아님" 이라는 기존 화이트리스트 정책과 일치시키려는 **의도된** 동작 변경이지만, 결과적으로 e2e.yml 자체가 깨지는 회귀는 다음 코드 PR 이 올라올 때까지 발견되지 않을 수 있다(diff 주석이 이 트레이드오프를 명시적으로 인정). `workflow_dispatch` 추가로 수동 실행 escape hatch 를 마련해 완화했다. 혼합 PR(에: `.github/**` 파일 + `codebase/**` 파일을 함께 수정)은 `paths-ignore` 의미상(하나라도 미제외 경로면 트리거) 정상적으로 e2e 가 돈다 — 문서화된 트레이드오프가 실제 GitHub Actions 의미론과 일치함을 확인.
  - 제안: 조치 불요. 다만 `workflow_dispatch` 는 입력 스키마 없이 수동 트리거를 임의 브랜치에 허용하므로, 팀 내 누구든 Actions 탭에서 실행 가능하다는 점만 인지(위험도 낮음, 의도된 escape hatch).

- **[INFO]** `.github/workflows/harness-checks.yml` — CI 트리거 범위 확장(`pnpm-workspace.yaml`, `.github/dependabot.yml` 추가)으로 무관 PR 의 CI 비용 증가
  - 위치: 35-36행(`- '.github/dependabot.yml'`, `- 'pnpm-workspace.yaml'`)
  - 상세: `pnpm-workspace.yaml` 은 새 패키지를 워크스페이스에 추가할 때 자주 수정되는 파일이다. 이제 그런(harness 와 무관한) PR 도 `harness-checks` 잡을 추가로 태운다(timeout 5분). 이는 신규 테스트(`test_dependabot_npm_coverage.py`)가 두 파일을 대조하므로 drift 방지를 위해 필요한 의도된 트레이드오프이며, diff 자체의 주석과 `plan/in-progress/harness-guard-followups.md` 갱신 내용이 근거를 명시하고 있다. 부작용이라기보다 CI 실행 표면의 계획된 확장.
  - 제안: 조치 불요. 향후 `pnpm-workspace.yaml` 변경 빈도가 높다고 판단되면 job 자체를 경량화(예: 이 가드만 별도 fast job)하는 것을 고려할 수 있으나 이번 diff 범위 밖.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` — 문서 전용 변경, 실행 부작용 없음
  - 위치: 243-255행 (I3/W5 체크박스 완료 마킹 + 서술 추가)
  - 상세: 코드 실행에 영향 없는 plan 문서 갱신. 완료 표기가 실제 구현(파일 1-3)과 일치하는지만 확인하면 되고, 위 3개 파일의 diff 내용과 서술이 정합함을 확인했다(e2e.yml workflow_dispatch 언급, dependabot coverage 테스트 3종 파서 sanity 언급 등 실제 코드와 일치).
  - 제안: 조치 불요.

## 요약

이번 변경은 (1) 순수 read-only 정적 분석을 수행하는 신규 harness 테스트 1개, (2) 두 GitHub Actions 워크플로의 트리거 조건(`paths-ignore`/`paths`) 조정, (3) plan 문서 갱신으로 구성된다. 테스트 파일은 파일시스템·git 상태를 읽기만 하고 아무것도 쓰지 않으며, 기존 harness 테스트 컨벤션(subprocess 를 통한 git 조회, `_harness` 공유 path-setup)을 그대로 따른다. 새 전역 변수·시그니처 변경·네트워크 호출·환경 변수 읽기/쓰기는 없다. CI 워크플로 변경은 트리거 표면(공개 인터페이스)을 바꾸는 진짜 부작용이지만, 둘 다 diff 자체의 상세한 주석과 plan 문서에 트레이드오프·완화책(`workflow_dispatch` escape hatch, 신규 가드를 위한 의도된 CI 비용 증가)이 명시되어 있어 "의도치 않은" 부작용으로 분류하기 어렵다. CRITICAL/WARNING 급 발견사항은 없다.

## 위험도
LOW
