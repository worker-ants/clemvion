### 발견사항

- **[WARNING]** `changes`/`_changed-paths.yml` 를 공유하는 워크플로 수를 여전히 "세 워크플로(three)"로 서술하는 주석·문서가 이 PR이 CONVERTED를 8개로 확장한 뒤에도 갱신되지 않았다.
  - 위치:
    - `.github/workflows/_changed-paths.yml:1` — `# skip-job 패턴의 \`changes\` 잡 — 세 워크플로가 공유하는 reusable workflow.`
    - `.github/workflows/_changed-paths.yml:23` — `# > 사라지고, 스크립트는 "그런 경로 변경 없음" 으로 답한다. 세 워크플로의 모든 검사가`
    - `.claude/tests/test_required_check_skip_jobs.py:64` — `# 세 워크플로가 공유하는 \`changes\` 잡의 reusable workflow.` (바로 위 61~62줄에서 `CONVERTED`에 `harness-checks.yml`~`web-chat-checks.yml` 5개를 추가해 총 8개로 만든 바로 다음 줄)
    - `.claude/tests/test_required_check_skip_jobs.py:187` — `# 확인하지 않으면 세 워크플로가 한꺼번에 게이팅을 잃어도 이 스위트는 초록이다.`
    - `.claude/tests/test_changed_paths_reusable.py:11` — 모듈 docstring `세 워크플로의 **모든 검사가 조용히 no-op** 된다. required check 는 초록이다.`
    - `.claude/tests/README.md:50` — `test_changed_paths_reusable.py` 행: `the changes job the three converted workflows share` / `every check in all three workflows silently no-ops`
  - 상세: 같은 PR·같은 파일들 안에서 `.claude/tests/README.md:51`(`test_required_check_skip_jobs.py` 행)은 정확하게 "As of 2026-08-09 the registry covers **eight** workflows"라고 갱신했고, `CONVERTED` 리스트도 실제로 8개(backend-checks·deps-security-checks·frontend-checks·harness-checks·migration-check·packages-checks·spec-link-checks·web-chat-checks)다. 그런데 위 6곳은 여전히 "세/three"를 그대로 두어, 이 저장소가 반복적으로 겪어 온 "코드는 바뀌었는데 그 옆 주석은 옛 사실을 말한다" 클래스를 이 PR 자신이 재현한다. 기능·테스트 통과에는 영향 없음(아래 실행 검증 참고)이나, 이 문서·주석들은 다음 확장 때 "누가 공유하는지" 판단의 근거로 계속 읽히므로 오도 가능성이 있다.
  - 제안: 코드 유지 + 문서/주석 정정. 숫자를 매번 갱신해야 하는 구체적 카운트("세/three/8개") 대신 "required-check skip-job 패턴으로 전환된 워크플로들이 공유하는" 같은 일반화된 표현으로 바꾸거나, 최소한 현재 값(8개)로 맞춘다. spec 문서가 아니라 harness 테스트/워크플로 주석이므로 `developer` 권한 범위 내 수정 대상이다(`project-planner` 위임 불필요).

- **[INFO]** spec fidelity — `.github/workflows/**`·`.claude/tests/**` CI 하네스 인프라를 규정하는 `spec/` 문서가 없다(레포 컨벤션상 이 영역은 `PROJECT.md` + `plan/`가 SoT). `spec/conventions/migrations.md §7 대안 4`가 유일하게 관련 문구(`migration-check / guard`를 required status check로 등록)를 담고 있으나 이는 향후 계획을 서술하는 Rationale 성격 섹션이고, 실제 job id(`guard`, `name:` 없음 → 체크명 `migration-check / guard`)와 정합하므로 이번 변경과 충돌 없음. 따라서 spec 본문 line-level 불일치는 발견되지 않음(해당 영역 자체가 spec 관할 밖).

### 검증한 사항 (결함 아님, 참고)
- `.claude/tests/test_harness_checks_paths_coverage.py`(25), `test_required_check_skip_jobs.py`(13), `test_workflow_yaml_structure.py`(12), `test_changed_paths_reusable.py`(15) 전부 로컬에서 실행해 통과 확인(총 65 tests, OK).
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`(51 tests, vitest)도 통과.
- `parse_pathspecs_block`(harness 가드)·`parse_pathspecs`(skip-job 가드)·`blockScalarAtPath`(frontend 가드)·`_changed-paths.yml`의 bash `case "$spec" in '#'*)` 네 구현이 "빈 줄/`#`-시작 줄 버림 + strip, 줄 시작 아닌 `#`은 보존" 규칙을 서로 동일하게 구현했음을 각 파일의 boundary test로 교차 확인.
- `plan/in-progress/ci-required-check-skip-jobs.md`의 수치 주장(전환 완료 8워크플로/실잡 14개, 셋업 형태 8+1+5=14, required check 이름 테이블)을 실제 YAML과 대조해 전부 정확함을 확인(`python3`로 각 워크플로의 `jobs.*.name` 직접 파싱해 대조).
- `packages-checks.yml`/`web-chat-checks.yml`/`spec-link-checks.yml`이 `push.paths`를 제거하고 `push: branches: [main]`만 남긴 것은 `scripts/ci-paths-changed.sh`(이번 diff 밖, 기존 구현)가 `PUSH_BEFORE_SHA`/`PUSH_AFTER_SHA` 기반으로 이미 push 이벤트를 처리하도록 되어 있어 회귀 없음.
- `_PULL_REQUEST_KEYS`/`_SKIP_JOB_WORKFLOWS`/`_JOB_CONDITIONS`/`CONVERTED`/`test_the_two_registries_agree` 4중 등록부가 서로 일치하고, TODO/FIXME/HACK/XXX 주석은 diff 대상 파일 전체에서 없음.

### 요약
이번 PR은 `#1106`/`#1111`에서 확립한 required-check skip-job 패턴을 나머지 5개 워크플로(harness-checks·migration-check·packages-checks·spec-link-checks·web-chat-checks)로 기계적으로 확장하면서, `paths:`→`pathspecs:` 이동에 따른 3중 파서(런타임 bash·harness Python 가드·frontend TS 가드) 동기화, 등록부 4곳 동시 갱신, `needs: changes`/스텝 게이팅/no-op 안내 스텝까지 빠짐없이 반영했고 모든 관련 유닛테스트(65 Python + 51 vitest)가 실제로 통과함을 직접 실행해 확인했다. 유일하게 발견된 결함은 기능적 결함이 아니라, PR이 `CONVERTED`를 3→8개로 확장했음에도 인접·연관 주석/문서 6곳이 "세 워크플로(three)"라는 옛 사실을 그대로 남겨 둔 문서 드리프트다. spec 문서가 이 CI 인프라 영역을 규정하지 않아 spec fidelity 관점에서는 문제 없음.

### 위험도
LOW
