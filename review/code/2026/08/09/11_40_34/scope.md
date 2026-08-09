# 변경 범위(Scope) 리뷰

## 발견사항

없음. 6개 파일 전부가 "`deps-security-checks.yml`/`frontend-checks.yml` 를 required status
check 로 등록 가능한 skip-job 패턴으로 전환" 이라는 단일 의도에 직접 종속된 변경이다.

- `scripts/ci-paths-changed.sh` (신규) — 패턴의 핵심 판정 로직. fail-safe 방향(불확실하면
  `true`)이 문서(헤더 주석)와 구현이 일치.
- `.github/workflows/deps-security-checks.yml`, `frontend-checks.yml` — `on.pull_request.paths`/
  `on.push.paths` 제거 + `changes` 잡 추가 + 각 잡에 `needs: changes` + 모든 실행 스텝에
  `if: needs.changes.outputs.relevant == 'true'` + no-op 안내 스텝. 두 파일 모두 자기 자신
  (`.github/workflows/<name>.yml`)과 판정 스크립트(`scripts/ci-paths-changed.sh`)를 detect
  글롭에 포함시켜, 이 저장소가 반복해 겪은 "paths 커버리지 갭" 클래스를 새 패턴에서도
  선제 차단 — 변경 의도와 정확히 일치.
- `.claude/tests/test_required_check_skip_jobs.py` (신규) — 위 계약(paths 미필터, `changes`
  잡·`relevant` output, 모든 스텝 `needs`/`if` 게이팅, no-op 안내, 자기참조 글롭)을 그대로
  회귀 가드로 옮긴 것. import 는 `pathlib`/`unittest`/`yaml` 셋 다 사용됨, 불필요한 임포트 없음.
- `.claude/tests/test_workflow_yaml_structure.py` — 기존 `_STEP_CONDITIONS`(개별 등재제)
  옆에 skip-job 두 조건 문자열을 **정확 일치**로만 예외 처리하는 `_SKIP_JOB_*` 상수·로직을
  추가하고, `_PULL_REQUEST_KEYS` 에서 두 워크플로를 `{"paths"}` → `set()` 으로 갱신. 새로
  도입한 "빈 pull_request 트리거" 형태를 이 파일의 기존 등재 체계에 정합시키는 필수 갱신이며,
  다른 워크플로 항목·다른 테스트는 손대지 않음.
- `.claude/tests/README.md` — 신규 테스트 파일 1행만 추가. `test_tests_readme_catalog.py` 가
  강제하는 카탈로그 동기화 요구를 충족시키는 최소 변경이고, 기존 행 순서·내용은 그대로.

이 저장소 컨벤션상 표준인 "왜" 설명형 인라인 주석이 다수 추가돼 있으나(YAML 헤더, 스크립트
헤더, 테스트 docstring), 모두 이번에 도입한 skip-job 메커니즘 자체를 설명하는 내용이고
기존 로직·무관 영역에 대한 주석 수정은 없음 — 불필요한 주석 변경 아님.

포맷팅 전용 변경, drive-by 리팩토링, 요청 밖 기능 확장, 무관 파일 수정, 설정 파일의 의도치
않은 변경은 관찰되지 않았다. `migration-check.yml`/`packages-checks.yml`/`e2e.yml`/
`harness-checks.yml`/`review-gate.yml`/`spec-link-checks.yml`/`web-chat-checks.yml` 등
CONVERTED 목록 밖의 워크플로는 건드리지 않았다(점진 전환 범위 준수).

## 요약

6개 파일 모두 "두 워크플로를 required-check 안전한 skip-job 패턴으로 전환"이라는 단일 목적에
정확히 대응하는 변경이며, 신규 테스트·README 카탈로그 갱신·기존 구조 가드 갱신도 그 목적이
요구하는 최소 범위에 머문다. 범위 이탈·불필요한 리팩토링·기능 확장·무관 수정·포맷팅 혼입·
주석/임포트 오염·의도치 않은 설정 변경 중 어느 것도 발견되지 않았다.

## 위험도

NONE
