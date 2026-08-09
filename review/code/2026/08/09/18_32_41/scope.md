STATUS=success scope review complete — no findings

===REPORT_MARKDOWN_BELOW===
### 발견사항

없음.

이번 변경은 세 워크플로(`backend-checks.yml`, `deps-security-checks.yml`, `frontend-checks.yml`)에 세 번째로 복제된 `changes` 잡 wiring(checkout `fetch-depth: 0` + SHA env 4개 + `ci-paths-changed.sh` 호출)을 `.github/workflows/_changed-paths.yml` reusable workflow 로 추출하는 단일 목적 리팩토링이며, `_changed-paths.yml` 자체의 헤더 주석에 "3번째 전환 시점에 추출"이 사전에 결정된 트리거였음이 명시돼 있어(― `#1106`/`#1109` 참조) 의도된 범위를 벗어나지 않는다.

- `.github/workflows/_changed-paths.yml` (신규): 추출된 잡 정의만 포함. 로직은 세 워크플로에서 삭제된 블록과 바이트 단위로 동일하며 신규 기능 추가 없음.
- `.github/workflows/backend-checks.yml` / `deps-security-checks.yml` / `frontend-checks.yml`: 각 diff hunk 는 `changes:` 잡 정의 한 곳만 건드리며(`lint`/`unit`/`typecheck-ratchet`/`config-guard`/`audit`/`override-floors`/`test-and-build` 등 다른 잡은 무변경), `uses: ./.github/workflows/_changed-paths.yml` 호출로 치환. pathspecs 목록을 원본과 대조하면 기존 항목이 전부 보존되고 `.github/workflows/_changed-paths.yml` 자기참조 한 줄만 추가됐다 — 세 파일에 동일 패턴으로 일관되게 적용되어 임의 추가가 아님.
- `.claude/tests/test_changed_paths_reusable.py` (신규): 추출된 reusable workflow 의 `run:` 블록이 실제로 pathspec 다중행 문자열을 인자 배열로 올바르게 변환하는지(글로브 조기 확장 방지, 빈 줄 drop, 빈 입력 fail-closed 등)만 검증. wiring 검증(`WiringTest`)도 추출 대상인 SHA env·`fetch-depth`·`workflow_call.inputs` 로 한정.
- `.claude/tests/test_required_check_skip_jobs.py`: `changes` 잡이 이제 인라인 스텝이 아니라 reusable workflow 를 호출하는 구조로 바뀐 것에 맞춰 기존 3개 테스트(`test_changes_job_publishes_relevant`, `test_converted_workflows_pass_the_script_its_own_path`, `test_manifest_globs_cover_depth_zero`)의 단언 대상을 `uses:`/`with.pathspecs`/신규 `pathspecs_of()` 헬퍼로 갱신 — 리팩토링이 깬 커버리지를 그대로 복구하는 필수 변경이며 새 관점 추가가 아니다.
- `.claude/tests/README.md`: 신규 테스트 파일 설명 행 1개 추가. 기존 표 포맷·서술 스타일과 일치.

불필요한 리팩토링·무관 파일 수정·포맷팅만의 변경·임포트 정리·설정 드리프트·주석 잡음은 발견되지 않았다. 각 워크플로 diff 는 단일 hunk 로 국한되어 있고, pathspec 목록은 자기참조 한 줄을 제외하고 항목 단위로 완전히 보존되어 있다.

### 요약
`_changed-paths.yml` reusable workflow 추출 + 3개 소비 워크플로 전환 + 관련 테스트/문서 동기화로 구성된 단일 목적 변경이며, 각 diff hunk 가 추출 대상 `changes` 잡에만 국한되고 pathspec 목록도 자기참조 한 줄 외에는 항목 단위로 완전히 보존되어 범위 이탈이 없다.

### 위험도
NONE
