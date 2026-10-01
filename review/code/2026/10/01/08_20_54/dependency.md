### 발견사항

- **[INFO]** `spec-mirror-integrity` 잡만 `actions/setup-python` 없이 러너 기본 `python3` 로 돈다
  - 위치: `.github/workflows/spec-link-checks.yml:144-153`
  - 상세: `python3` 를 부르는 다른 워크플로는 모두 `actions/setup-python@v7` 로 인터프리터를 고정한다. `backend-checks` · `frontend-checks` · `deps-security-checks` · `migration-check` · `e2e` · `review-gate` · `harness-checks` 가 그렇다. `migration-check.yml` 과 `harness-checks.yml` 의 주석도 "ubuntu-latest 에 python3 가 있지만 명시적 setup 으로 맞춘다"는 정책을 적어 둔다. 이 잡은 그 정책에서 빠진다. `pull.py` 는 표준 라이브러리만 쓰고 러너 기본 버전(3.12)에서 문제가 없으므로 지금은 동작에 영향이 없다. 러너 이미지의 python 이 바뀌면 이 잡만 그 영향을 직접 받는다.
  - 제안: `actions/checkout` 다음에 `actions/setup-python@v7`(`python-version: '3.x'`)을 넣거나, 의도적 생략이면 그 이유를 잡 주석에 한 줄 남긴다.

- **[INFO]** 새 `sparse-checkout` 경로와 `pull.py` 의 실제 읽기 범위가 테스트로 묶여 있지 않다
  - 위치: `.github/workflows/spec-link-checks.yml:146-149`, `.claude/tests/test_nerv_mirror_pull.py:775-791` (`CiWiringTest`)
  - 상세: 이 저장소에서 `sparse-checkout` 을 쓰는 워크플로는 이 잡뿐이다. 스크래치 디렉터리에 `spec/` 과 `.claude/tools/nerv-mirror/pull.py` 만 복사해 `pull.py --check` 를 돌렸다. 종료 코드 0, "미러 169편 · 문제 0" 이 나왔다. 현재 `pull.py` 는 표준 라이브러리만 import 하고(새 import 는 `urllib.parse` 하나), `--check` 는 `spec/` 만 읽는다. 그래서 지금 구성은 맞다. 나중에 `pull.py` 가 `.claude/tools/` 의 형제 모듈을 import 하거나 `spec/` 밖을 읽으면 CI 에서만 깨진다. 깨지면 바로 드러나므로 조용한 실패는 아니다. `CiWiringTest` 는 `--check` 호출과 `needs` 만 확인하고 sparse 경로는 보지 않는다.
  - 제안: `CiWiringTest` 에 sparse 경로 두 개가 `pull.py --check` 가 필요한 전부라는 단언을 더한다. 예를 들어 임시 디렉터리에 그 경로만 복사해 `--check` 를 돌린다. 지금 동작에는 영향이 없어 필수는 아니다.

- **[INFO]** PyYAML 사용이 `test_nerv_mirror_pull.py` 에 새로 생겼다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:781`, `.claude/tests/test_nerv_mirror_pull.py:830`
  - 상세: `CiWiringTest` 와 `MirrorPredicateParityTest.test_the_three_files_trigger_the_harness_workflow` 가 메서드 안에서 `import yaml` 을 한다. `.claude/tests/README.md` 가 "PyYAML 이 유일한 서드파티 예외"라고 허용한 범위 안이다. `harness-checks.yml` 이 `pip install "pyyaml>=6,<7"` 로 설치하므로 CI 는 충족된다. 새 외부 패키지나 버전 충돌은 없다. PyYAML 없이 돌리는 환경에서는 이 두 테스트만 ImportError 로 실패한다. 이는 기존 `test_review_gate_ci.py` 와 같은 방식이다.
  - 제안: 조치 불필요.

- **[INFO]** 미러 판정 세 곳의 동치 검증은 실제 `spec/` 트리 기준이다
  - 위치: `.claude/tools/nerv-mirror/pull.py:83`(`KEY_RE`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:202`(`_NERV_MIRROR_REL`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:257`(`NERV_MIRROR`), `.claude/tests/test_nerv_mirror_pull.py:808`
  - 상세: 같은 "미러 파일" 판정이 정규식 세 벌로 중복돼 있다. 이 변경은 `MirrorPredicateParityTest` 와 `harness-checks.yml` 경로 등재(`spec-links.ts` 추가)로 세 곳을 묶는다. 중복 정의의 내부 의존을 테스트로 고정한 좋은 조치다. 다만 대조 입력이 실제 트리의 파일이라, 트리에 없는 이름(예: 후행 하이픈 `CLE-A-.md`)에서 세 정규식이 갈라지는 것은 이 테스트로 보이지 않는다. 오케스트레이터와 `spec-links.ts` 의 `[A-Z0-9-]+` 는 `KEY_RE` 보다 넓다. 그런 이름은 `pull.py --check` 의 `stray_entries` 가 잡으므로 실제 위험은 낮다.
  - 제안: 필요하면 `MirrorPredicateParityTest` 에 경계 이름 몇 개(`CLE-A-.md`, `CLE--A.md`, 소문자)를 합성 입력으로 더한다.

- **[INFO]** NERV Task 키 `CLE-T-*` 가 여러 파일 주석에 하드코딩돼 있다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:16-21`, `.claude/tools/nerv-mirror/pull.py:9-11`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:199-201`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:254-256`
  - 상세: 전환 단계와 Task 키의 대응표는 훅 docstring 에 두고 `pull.py` 가 "목록 전체는 훅 docstring 에 있다"고 가리키는 구조다. 그런데 오케스트레이터와 `spec-links.ts` 는 4e · 5 단계의 Task 키를 따로 적는다. 외부 시스템(NERV)의 식별자를 주석에 복제한 것이라 Task 가 다시 발급되면 복제본이 낡는다. 동작에 영향은 없다.
  - 제안: 훅 docstring 을 단일 출처로 두고, 나머지 주석은 단계 번호만 적거나 그 출처를 가리키게 한다.

### 요약
이 변경은 새 외부 패키지를 들이지 않는다. `package.json` · 락파일 · `dependabot.yml` · Dockerfile 은 바뀌지 않았고, `pull.py` 의 새 import 는 표준 라이브러리 `urllib.parse` 뿐이다. 테스트가 쓰는 PyYAML 은 README 가 허용한 기존 예외이고 CI 에서 `>=6,<7` 로 고정 설치된다. 라이선스, 취약점, 번들 크기 문제는 없다. `actions/checkout@v7` 은 저장소 전체(24곳)와 같은 고정 방식이다. CI 잡의 `sparse-checkout` 은 스크래치 트리 재현으로 동작을 확인했다. 내부 의존 쪽에서는 훅이 `pull.py` 경로를 표지로 삼는 결합을 `test_the_real_repository_is_guarded` 가 고정하고, 세 곳에 중복된 미러 판정을 `MirrorPredicateParityTest` 가 묶는다. 이전보다 나아졌다. 남은 것은 `setup-python` 누락과 sparse 경로를 고정하는 테스트 부재이고, 둘 다 조용히 깨지는 종류가 아니라 CI 에서 바로 드러난다.

### 위험도
LOW

검토 중 저장소 트리는 건드리지 않았다. 재현용 복사본은 scratchpad 에서만 만들고 지웠으며, `git status --short` 에는 이전부터 있던 untracked `review/` 경로만 남아 있다. `test_nerv_mirror_pull.py` 67건과 `test_guard_nerv_owned_paths.py` 13건은 모두 통과했다.
