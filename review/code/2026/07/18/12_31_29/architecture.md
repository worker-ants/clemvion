# Architecture Review — review/code/2026/07/18/12_31_29

대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.github/dependabot.yml`, `.claude/tools/mermaid-lint/package-lock.json`, `PROJECT.md`
(base: `origin/main`, HEAD: `c5fdd1bb8`)

## 발견사항

- **[WARNING]** "NO LOCK" 설계 근거 주석이 서술하는 동시-설치 경합의 범위가 이번 diff로 실제보다 좁게 남음 (주석-코드 계약 drift)
  - 위치: `.claude/tools/bootstrap-session.sh:73-75, 84-85` (race 를 "first cold install" · "rare first-install-only window" 로 한정하는 기존 서술) vs 같은 파일 `:96-123` (`_lock_hash`/`need_install`, 이번 diff가 추가한 lockfile-해시 불일치 재설치 트리거) + `.github/dependabot.yml:10-22` (이번 diff가 신설한 주간 npm ecosystem 등록)
  - 상세: 62-87행의 "NO LOCK, deliberately" 단락은 락을 빼는 근거로 "잔존 경합은 *첫* cold install 순간에 여러 세션이 동시에 도달할 때뿐"이라는 스코프 제한을 명시적으로 전제한다 ("several sessions hitting the *first* cold install", "acceptable rare first-install-only window, not worth a hand-rolled lock"). 그러나 이번 diff가 추가한 `_lock_hash`/`need_install` 메커니즘(96-123행)은 **lockfile 해시가 바뀔 때마다** 동일한 무락(no-lock) 경합 창을 재개방한다 — 이미 install 을 마친 checkout 도 더는 예외가 아니다. 그리고 같은 diff가 신설한 `.github/dependabot.yml` 의 주간(weekly) npm ecosystem 등록은 바로 그 "lockfile 이 바뀌는" 사건을 **의도적으로, 정기적으로(주 단위)** 반복 발생시키는 것이 목적이다(스케줄 version-update). 즉 이 PR 자체가 "경합이 재발하는 트리거"를 상시화하면서, 그 경합의 안전성을 정당화하는 바로 인접한 주석은 여전히 "일회성·희귀"로 서술한다. 여러 워크트리 세션을 동시에 띄우는 것이 이 저장소의 공식 워크플로임은 `test_bootstrap_mermaid_install.py` 자체 docstring 이 명시하므로("Running several worktree sessions at once is the documented workflow"), Dependabot PR 이 main 에 머지된 직후 여러 세션이 거의 동시에 SessionStart 를 도는 상황은 가상이 아니라 상시 재현 가능한 경로다. 기능적으로는 기존에 이미 "convergence, not exactly-once"로 받아들여진 리스크의 재사용이라 즉시 차단 사유는 아니지만, 문서(주석)가 현재 메커니즘의 실제 위험 표면을 더는 정확히 경계 짓지 못하는 상태이며, 이는 이 저장소가 리뷰에서 반복적으로 잡아온 "반증된 서술 정정" 패턴(예: `f4489d314` `_is_segment_boundary`)과 같은 계열이다. 향후 유지보수자가 "1회성"이라는 문구만 보고 plan §G(fcntl.flock) 우선순위를 과소평가할 위험이 있다.
  - 제안: 62-87행 주석을 "첫 설치뿐 아니라 lockfile 을 바꾸는 모든 후속 이벤트(특히 이번 diff 가 상시화한 주간 Dependabot 머지)마다 재발하는 경합"으로 갱신. 아울러 기존 `test_concurrent_cold_start_converges_and_then_stops_reinstalling` 은 "완전 콜드 스타트(마커 자체가 없음)" 케이스만 덮는다 — "마커가 이미 존재하는 상태에서 lockfile 만 바뀌어 N개 세션이 동시에 재설치를 트리거"하는 케이스를 명시적으로 pin 하는 테스트를 별도로 추가하면(같은 convergence 속성을 기대), 새 트리거 경로가 기존 트리거와 동일한 보장을 실제로 상속하는지 증명할 수 있다. 여력이 되면 plan §G(fcntl.flock) 우선순위 재검토도 고려.

- **[WARNING]** pnpm 워크스페이스 밖 npm 트리를 Dependabot 대상으로 등록하는 절차가 전적으로 수동이며, 이를 강제하는 구조적 가드가 없음 — 이번 PR이 고치는 결함과 동일한 재발 경로
  - 위치: `.github/dependabot.yml:19-22` (`.claude/tools/mermaid-lint` 개별 수동 등록) / `PROJECT.md` (의존성 취약점 audit·핀 거버넌스 절 마지막 문장, 이번 diff로 추가) / `.claude/tests/` (대응 가드 부재)
  - 상세: 이번 PR이 고치는 근본 문제는 "`.claude/tools/mermaid-lint` 가 pnpm 워크스페이스 밖 독립 npm 트리라서 `deps-security-checks.yml`(pnpm audit) 도 `check-pnpm-security-config.py` 도 커버하지 못해 CVE 가 영구 무신호였다"는 것이다(`dependabot.yml` 신규 주석과 `PROJECT.md` 신설 문장이 동일하게 서술). 해법은 이 **한 개** 트리를 손으로 `dependabot.yml` 에 등록하는 것으로, 등록 자체는 정확하지만 "pnpm 워크스페이스 밖에 새 `package.json` 트리가 생기면 반드시 `dependabot.yml` 에 등록한다"는 불변식을 강제하는 코드 가드는 함께 도입되지 않았다. 이 저장소는 성격이 유사한 다른 커버리지 매트릭스(`MONITORED_QUEUES`, doc-sync-matrix, interaction-type-registry 등) 각각에 "매트릭스 참조 무결성 가드" 형태의 빌드타임 테스트를 두는 것을 스스로 원칙으로 명시한다 — 그 원칙에 비춰보면 이번에 다뤄진 커버리지 표면만 예외적으로 순수 컨벤션(사람이 기억해서 등록)에 의존한다. 오늘은 대상 트리가 1개뿐이라 실제 drift 는 없지만, 미래에 두 번째 out-of-workspace npm 트리가 생기고 등록을 잊는 순간 이번에 발견된 것과 정확히 같은 "영구 무신호" CVE 노출 패턴이 재현된다.
  - 제안: `.claude/tests/` 에 `pnpm-workspace.yaml` 이 커버하지 않는 `package.json` 트리를 (예: `find . -name package.json -not -path '*/node_modules/*'` 로) 열거하고 각각이 `.github/dependabot.yml` 의 `directory:` 항목에 대응하는지 assert 하는 소규모 가드 테스트 추가를 검토. 이 프로젝트가 이미 채택한 `test_doc_sync_matrix.py` 류 패턴과 형태가 동일해 구현 비용이 낮다.

- **[INFO]** writer(bash)/reader(python) 모듈 경계가 마커 콘텐츠 의미 변경에도 그대로 유지됨 — 긍정적 설계 관찰
  - 위치: `.claude/tools/bootstrap-session.sh:100-103, 120, 128` (write 측) ↔ `.claude/hooks/_lib/mermaid_lint_ready.py:41-46` (`is_ready` — `os.path.isfile` 존재만 검사)
  - 상세: 이번 diff는 완료 마커의 **내용 의미**를 "빈 touch 파일" → "package-lock.json sha256 해시 문자열"로 바꿨다. 그런데 이 마커를 읽는 소비자들(`.githooks/pre-commit`, `lint_mermaid_posttooluse.py`, 이 둘이 공유하는 `_lib/mermaid_lint_ready.py`)은 애초에 "존재 여부"만을 계약으로 삼았기 때문에(`os.path.isdir(node_modules) and os.path.isfile(marker_path(...))`, 내용은 파싱하지 않음) 이번 변경이 reader 쪽 코드·테스트(`test_mermaid_lint_ready.py`, 3개 클래스 전부 실측 확인) 어디도 건드리지 않고 안전하게 이루어졌다. "존재"라는 좁은 계약과 "내용"이라는 writer 전용 내부 상태를 처음부터 분리해 둔 기존 설계 덕에, 여러 언어·여러 파일에 걸친 공유 아티팩트를 확장했음에도 통합 리스크가 낮게 끝난 사례다.
  - 제안: 없음 — 향후 마커에 또 다른 의미를 얹을 때도 "존재=ready" 계약을 오버로드하지 않는 현재 관례를 유지할 것.

## 요약

이번 변경은 `bootstrap-session.sh`의 기존 "완료 마커" 방식 mermaid-lint 설치 가드에 lockfile-해시 기반 재설치 트리거를 얹고, 이를 지원하기 위해 pnpm 워크스페이스 밖 독립 npm 트리를 `.github/dependabot.yml`에 등록하며 `PROJECT.md`에 그 이원화된 거버넌스 경로를 문서화한, 범위가 작고 잘 절제된 하네스 인프라 변경이다. 새로 추가된 `_lock_hash()`는 기존 `_file_mtime()`과 동일한 크로스플랫폼 폴백 스타일을 따르고, `need_install` 결정 변수를 실행 게이팅(`_install_throttled`, `command -v npm`)과 분리해 "무엇을 할지"와 "언제 실행할지"를 깔끔히 나눴다. 가장 눈에 띄는 긍정적 설계 특성은 마커 파일의 내용 의미를 바꾸면서도 그 파일을 소비하는 3개 크로스-언어 리더(pre-commit, PostToolUse 훅, 공유 `mermaid_lint_ready.py`)의 계약("존재 여부"만 확인)을 전혀 건드리지 않은 점 — 처음부터 좁게 설계된 모듈 경계가 이번 확장의 통합 리스크를 실질적으로 낮췄다. 순환 의존성, 레이어 책임 침범, 안티패턴 재도입(이전 라운드에서 걷어낸 hand-rolled lock을 되살리지 않은 점 포함)은 발견되지 않았다. `bootstrap-session.sh`가 4개 책임(githooks 활성화·mermaid 설치·상태마커 GC·워크트리 reap)을 한 파일에 담는 기존 SRP 긴장은 이번 diff로 인해 "설치" 섹션 내부가 한 단계 더 복잡해지며 소폭 심화됐지만, 이는 파일 자체 주석에 이미 인지·추적되고 있어(plan §G) 새로운 문제는 아니다. 두 WARNING은 모두 기능 결함이 아니라 (1) 이번 diff가 상시화한 "정기적 lockfile 변경" 이벤트로 인해 넓어진 동시성 위험 창을 인접 설계-근거 주석이 여전히 좁게 서술하는 문서-코드 drift, (2) 이 PR이 고치는 바로 그 실패 유형(등록 누락으로 인한 CVE 영구 무신호)이 미래의 두 번째 out-of-workspace npm 트리에 대해서는 구조적 가드 없이 재발할 수 있다는 확장성 갭이다. 둘 다 사람이 기억에 의존하는 절차적 취약점이며, 병합을 막을 정도는 아니되 후속 조치로 다룰 가치가 있다.

## 위험도
LOW
