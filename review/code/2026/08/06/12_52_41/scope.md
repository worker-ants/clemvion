# 변경 범위(Scope) 리뷰 — CI 백스톱 라운드 8

대상: `origin/main...HEAD` 누적분 중, 직전 스코프 리뷰(`review/code/2026/08/06/12_09_13/scope.md`,
6R까지 대조·LOW 판정) 이후 새로 추가된 커밋 `cd38361ac`("CI 백스톱 7R — 이미 enforce 중인 훅의
살아있는 fail-open + 정적 스캔 행위 반전") 및 워킹트리의 미커밋 변경(`plan/in-progress/harness-review-gate-ci-backstop.md`)
을 대상으로 한다. 티켓: `plan/in-progress/harness-review-gate-ci-backstop.md`.

## 방법

`git show cd38361ac --stat` 로 이번 라운드가 실제로 건드린 파일을 확정하고, 파일별로
`git show cd38361ac -- <path>` 로 diff 전체를 대조해 커밋 메시지가 밝힌 5개 항목(C1~C5)과
1:1로 대응하는지 확인했다. 프롬프트가 "전체 파일 컨텍스트"로만 제시한 11개 파일 중 실제로 이번
커밋에서 바뀐 것은 5개뿐이었다(나머지 6개 — `README.md`, `test_block_integrity.py`,
`test_stop_guard_failopen.py`, `harness-checks.yml`, `review-gate.yml`,
`check-review-gate.py` — 는 이번 라운드 diff에 없음을 `git diff cd38361ac~1 cd38361ac -- <path>`
빈 출력으로 확인). 또한 `git status`로 워킹트리의 미커밋 변경(plan 문서 1건, 이 리뷰 세션 자신의
산출물 디렉터리)도 함께 점검했다.

## 발견사항

- **[INFO]** `.claude/tests/README.md`의 `test_review_gate_ci.py` 서술 행이 라운드 5(커밋
  `8ce96e72b`) 이후 갱신되지 않아, 6R이 추가한 `TheGateItselfDoesNotBranchOnCiEnvTest`와 이번
  7R이 추가한 `TheRealGateIgnoresTheEnvironmentTest`(실물 게이트를 최소/적대적 환경 두 번
  판정시켜 결과를 비교하는 행위 테스트, C1·C2 대응) 둘 다 언급이 없다
  - 위치: `.claude/tests/README.md:48` (`test_review_gate_ci.py` 행)
  - 상세: 직전 라운드 스코프 리뷰(`review/code/2026/08/06/12_09_13/scope.md`)가 같은 파일의
    `test_workflow_yaml_structure.py` 행(README:44)에 대해 이미 같은 종류의 갭을 지적했는데,
    그 갭은 이번 라운드에도 그대로 남아 있고(해당 행은 여전히 "중복 매핑 키·`run`/`uses`
    단일성" 두 불변식만 서술 — 5R·6R·7R이 추가한 `continue-on-error` 등재제, `if:` 등재제,
    `pull_request` 키 등재제, `(name, job)` → `(name, job.name-or-id)` identity 유일성 등은
    미반영), 이번 라운드는 그와 별개로 `test_review_gate_ci.py` 행에도 같은 클래스의 갭이
    이미 존재했음을 확인했고 7R이 그 갭을 한 단 더 넓혔다. 코드 자체(`review_guard.py`,
    워크플로 배선, 판정 로직)에는 영향이 없는 문서 완결성 이슈다 — 이 저장소가
    `.claude/tests/README.md`를 정책/의도의 SoT로 명시하는 관행과 대비된다.
  - 제안: `test_review_gate_ci.py`/`test_workflow_yaml_structure.py` 두 행에 5R~7R에서
    누적된 불변식(등재제 3종·identity 유일성·실물-이중판정 테스트)을 요약 반영하거나, 최소한
    "5R~7R에서 등재제/identity/실물-이중판정이 추가됨"을 한 문장으로 덧붙인다. 매 라운드
    반복되는 패턴이므로, 다음 라운드부터는 코드 diff와 같은 커밋에서 README 행을 함께
    갱신하는 것을 라운드 완료 조건에 넣는 편이 이 갭의 재발을 막는다.

## 스코프 밖으로 확인된 항목 (문제 없음)

- **`review_guard.py`의 `_run_git` 수정** — `.strip()` → `.rstrip()` 1줄 + 근거 주석. 커밋
  메시지 [C4]와 정확히 대응하고, 다른 호출부(`rev-parse`/`merge-base`/`log`)에 영향이 없음을
  주석에서 직접 근거를 대며 설명한다. `codebase/**` 등 애플리케이션 코드는 건드리지 않음.
- **`test_review_gate_ci.py`에 추가된 `TheRealGateIgnoresTheEnvironmentTest`** — 커밋
  메시지 [C1·C2]가 밝힌 "정적 스캔이 `_shared/**`를 안 보고, `dict(os.environ.items())` 류
  문법을 인식 못 한다"는 결함에 대응하는 행위 테스트. 실물 게이트를 최소/적대적 환경 두 번
  구동해 비교하는 유한한 형태로, 기존 `VerdictComesFromTheGateTest`(스텁 기반이라 `_shared`를
  안 돈다)의 빈자리를 정확히 메운다. 범위 이탈 없음.
- **`test_review_guard_hardening.py`에 추가된 `UnstagedModificationKeepsItsPathTest`** — [C4]
  수정의 회귀 테스트. 실제 임시 git 저장소로 미스테이지/스테이지/미추적 3가지 형태를 고정하며,
  다른 클래스와 중복되는 헬퍼(`_git`/`_write`)는 이 파일의 기존 관행(클래스별 독립 헬퍼)과
  일치 — 이번에 새로 도입된 패턴이 아님.
- **`test_workflow_yaml_structure.py`의 두 수정** — (1) `_PULL_REQUEST_KEYS` 비교 전, 필터
  없는 bare `pull_request:` 를 dict가 아니라는 이유로 건너뛰던 로직을 빈 키 집합으로 취급하도록
  변경([C3] 중 "가장 위험한 형태가 검사 대상 밖"이었던 결함), (2) `(name, job_id)` 대신
  `(name, job.get("name", job_id))`로 유일성 검사([C3] 중 job `name:` override로 identity
  참칭 결함), (3) docstring의 "Two invariants" → 개수 비의존 문구([C5]). 세 항목 모두 커밋
  메시지가 밝힌 결함과 1:1 대응하며 검사를 완화가 아니라 엄격화하는 방향.
- **`plan/in-progress/harness-review-gate-ci-backstop.md`(커밋분)** — §배선 가드 표에 7R 행
  추가 + 표제 문구를 "네 라운드" → "라운드를 거듭한"으로 일반화(라운드 수가 늘어나는 것을
  반영). 진행 이력 문서 자체이므로 범위 내.
- **`review/code/2026/08/06/12_09_13/**`(커밋분, 23개 신규 파일)** — 직전 라운드(6R 픽스
  `2eca6270d`)를 리뷰한 산출물이며, `ReviewArtifactsStayTrackedTest`가 요구하는 "리뷰
  산출물은 추적된다"는 이 백스톱의 전제를 지키는 것과 동일한, 5R부터 반복돼 온 정상 패턴
  (라운드 N 리뷰 산출물을 라운드 N+1 픽스 커밋에 실어 추적시킴). 새 결함이 아님.
- **`codebase/**`(애플리케이션 코드)** — 이번 커밋 diff에 전혀 없음. `git show cd38361ac
  --stat` 로 직접 확인.
- **워킹트리 미커밋 변경 — `plan/in-progress/harness-review-gate-ci-backstop.md`** — §마찰
  실측 목록에 "미측정" 항목 12(`_porcelain_path`가 git의 C-quoting을 다루지 않을 수 있다는
  가설)를 추가. 코드 변경 없이 plan 문서에만 존재하며, 스스로 "미측정이므로 아직 고치지
  않는다"고 명시해 근거 없는 조치를 벌이지 않았음을 확인 — 정보 저장 위치 규약(진행 중 작업 →
  `plan/in-progress/`)과 일치, 스코프 이탈 아님.
- 포맷팅/주석/임포트: 이번 라운드 diff 전 hunk에서 실질 변경과 무관한 공백·개행 재배치나
  장식적 주석, 미사용 임포트를 찾지 못했다. 신규 주석은 전부 "왜 이렇게 됐는가"를 설명하는
  근거 주석이며 저장소의 기존 밀도 높은 인라인-근거 관행과 일치한다.

## 요약

이번 라운드(커밋 `cd38361ac`, 7R)는 직전 라운드 리뷰가 지적한 5개 결함(C1~C5)에 정확히
대응하는 최소 변경만 담았다 — `review_guard.py`의 1줄 버그 수정, 그 회귀를 고정하는 신규 테스트
2개, 정적 스캔의 사각을 메우는 행위 테스트 1개, 워크플로 identity/키 검사 강화 2건, plan 문서
갱신. 애플리케이션 코드(`codebase/**`) 변경은 없고 새로운 기능·리팩토링·무관한 파일 수정도 없다.
유일한 흠은 문서 완결성 문제로, `.claude/tests/README.md`의 `test_review_gate_ci.py` 행이
5R~7R에서 누적된 불변식(등재제 3종·실물-이중판정·identity 유일성)을 반영하지 못한 채 남아
있고, 직전 라운드가 이미 지적한 `test_workflow_yaml_structure.py` 행의 동일 갭도 이번 라운드까지
미해소다. 판정 로직 자체에는 영향이 없는 INFO 수준이며, 게이트 우회나 스코프 이탈에 해당하는
발견은 없다.

## 위험도

LOW
