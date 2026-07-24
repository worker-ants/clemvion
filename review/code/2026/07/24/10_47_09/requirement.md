# 요구사항(Requirement) 리뷰 — push-guard-worktree-scope

## 발견사항

- **[WARNING]** README 테스트 카탈로그 표가 병합 중 깨져(pipe 불일치), `test_push_guard_allowlist.py`
  행의 §J(`_LEGACY_PATTERN`/`_BLIND_PATTERN` 분리, `EnvValueSubpatternSharedTest`) 설명이 GitHub
  렌더링에서 **사일런트하게 소실**된다.
  - 위치: `.claude/tests/README.md:47`
  - 상세: 표 헤더는 2열(`| File | Guards |`, 47행 위 21~22행)인데, 47행은 `|` 가 정확히
    3개(선두 `|` + 셀 구분 `|` 2개)만 있고 **줄 끝에 닫는 `|` 가 없다** — 즉 실질적으로 3번째
    셀("§J (2026-07-24) split the frozen constant in two, …")이 붙어 있다. GFM 표 확장 규칙상
    "헤더보다 셀이 많으면 초과분은 무시된다"(https://github.github.com/gfm/#tables-extension-)이므로,
    실제 GitHub 렌더링에서는 이 3번째 셀 전체(`_LEGACY_PATTERN`/`_BLIND_PATTERN` 분리 근거,
    `EnvValueSubpatternSharedTest` 바인딩 설명)가 보이지 않는다. 원본 텍스트에는 남아 있으니
    "파일에서 사라진" 것은 아니지만, 이 표를 정상적으로(렌더링해서) 읽는 모든 독자에게는
    없는 내용과 동일하다.
    plan(`plan/in-progress/push-guard-worktree-scope.md` "2차 흡수 — §J push-탐지 버그픽스"
    절)은 "양쪽 행을 모두 보존" 했다고 기록했는데, 실제로는 두 PR 이 추가한 카탈로그 설명을
    한 행 안에 `|` 로만 이어붙여 표 구조를 깨뜨렸다 — 의도(두 내용 모두 문서화)와 구현(렌더링 시
    한쪽이 소실) 사이의 괴리.
    참고: `.claude/tests/test_tests_readme_catalog.py`의 `_ROW` 정규식은 행 선두
    (`^\|\s*\`test_...\.py\`\s*\|`)만 검사하므로 이 클래스의 결함(열 개수 불일치·닫는 `|` 누락)을
    잡지 못한다 — 이번 리뷰 대상 파일은 아니라 별도 CRITICAL 로 올리지 않음.
  - 제안: 47행의 두 번째와 세 번째 셀을 하나의 "Guards" 셀로 합치고(예: 둘 사이를 공백이나
    `—` 로 연결) 줄 끝에 닫는 `|` 를 추가한다. 재발 방지가 필요하면
    `test_tests_readme_catalog.py` 에 "매 데이터 행의 파이프 개수가 헤더와 같아야 한다" 는 열
    개수 검증을 추가하는 것도 고려할 만하다(본 리뷰 스코프 밖이므로 강제하지 않음).

## 점검 결과 요약 (발견 없음 항목)

- **기능 완전성**: `_push_targets`/`_mentions_branch`/`_accepts_cwd`/`_evaluate_over_targets`가
  plan(`plan/in-progress/push-guard-worktree-scope.md`)이 서술한 "cwd + 명령이 언급한 branch/경로"
  스코프 확장을 그대로 구현. `_run_gates`의 REVIEW→PLAN 순서·`BYPASS_*` 격리·
  gate-당 1회 `degraded` 기록도 모듈 docstring·plan 서술과 일치.
- **엣지 케이스**: 삭제된 worktree(`_push_targets`의 `os.path.isdir` 가드), 미체크아웃/디태치드
  HEAD(빈 branch명 skip), `_MAX_REDACTION_INPUT` 절단, 첫 target 크래시 후 나머지 target 계속 평가
  — 전부 대응 테스트(`test_push_guard_worktree_scope.py`)가 존재하고 로컬에서 green.
- **TODO/FIXME/HACK/XXX**: 3개 대상 파일 어디에도 없음(`grep` 확인).
- **의도-구현 일치**: `_report_fail_open`의 stream 선택(exit 2→stderr, exit 0→stdout), streak 리셋
  조건(`set(outcome.answered) != all_gates`이면 유지)이 파일 상단 docstring·`failopen_state.report`
  docstring 서술과 정확히 일치하는지 코드로 직접 추적 확인.
- **에러 시나리오**: `_worktree_branches`(비-repo cwd), `_push_targets`의 예외(→ `TARGET_SELECTION`
  degraded + cwd-only 폴백), `main()` 최상위 `except`(→ `DETECTION` degraded) 세 경로 모두
  fail-open 이되 카운트됨을 코드·테스트 양쪽에서 확인. 다만 `main()`의 최상위 `except`가
  `_run_gates`/`_evaluate_over_targets` 내부의 예상 밖 버그까지 전부 `"DETECTION"`(원래는 "push
  탐지 자체가 실패" 의미)이라는 레이블로 뭉뚱그리는 점은 사소한 부정확성(디버깅 편의 저하)이나
  안전 방향(계속 fail-open + 카운트)이라 별도 항목으로 올리지 않음.
- **데이터 유효성**: `_read_payload`의 JSON 파싱 실패 시 `{}` 폴백, `command`/`cwd` 부재 시
  안전한 기본값(`""`/`os.getcwd()`) 확인.
- **비즈니스 로직**: "cwd 는 항상 평가 + 언급된 worktree 추가"라는 plan 의 핵심 규칙이
  `_push_targets`에 정확히 반영(`targets = [cwd]`로 시작 후 조건부 append).
- **반환값**: `main()`의 모든 경로(정상 push 아님, block, allow, 예외)가 int(0 또는 2)를 반환.
  `_evaluate_over_targets`도 명시적으로 `None` 또는 render 결과 문자열을 반환.
- **spec 본문 일치 (spec fidelity)**: `spec/` 은 제품 코드(`codebase/**`)를 대상으로 하며, 이
  push 가드는 `.claude/hooks/`(harness 자체) 소속이라 관련 `spec/*.md` 문서가 존재하지 않는다
  (CLAUDE.md의 정보 저장 위치 표: harness 정책은 `.claude/docs/`, 작업 추적은 `plan/`). 이
  변경의 단일 진실은 `plan/in-progress/push-guard-worktree-scope.md`이며, 4라운드 리뷰·11건
  mutation 실측·24개 테스트 신설 내역이 코드와 정확히 일치함을 위에서 확인했다. spec 누락이
  아니라 이 영역이 애초에 spec 추적 대상이 아님 — INFO 성격, 결함 아님.

## 요약

리뷰 대상인 push 가드 worktree 스코핑 로직(`_push_targets`/`_mentions_branch`/`_accepts_cwd`/
`_evaluate_over_targets`/`main()`)과 그 회귀 테스트(`test_push_guard_worktree_scope.py`, 24건
green 로컬 재현)는 plan 문서가 서술한 요구사항(교차-worktree false-ALLOW 차단, per-target
fail-open, gate-당 1회 degraded 카운트, `BYPASS_*` 격리)을 코드·테스트 양쪽에서 정확히 구현하고
있다. 유일한 실결함은 `.claude/tests/README.md:47`의 표 구조 파손으로, 반복된 origin/main 병합
과정에서 두 PR 이 추가한 카탈로그 설명이 한 표 행에 `|`로만 이어붙여져 GFM 렌더링 시 §J 관련
설명이 사일런트하게 소실된다 — 코드 자체의 안전성 결함은 아니지만 "양쪽 내용 모두 보존"이라는
plan 의 명시적 의도와 실제 렌더 결과 사이의 괴리다.

## 위험도

LOW
