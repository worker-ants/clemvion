# 문서화(Documentation) 리뷰 — guard_review_before_push.py / test_push_detection.py

## 조사 방법

리뷰 대상 두 파일뿐 아니라 이들과 상호참조하는 문서 생태계 전체를 대조했다:
`.claude/tests/README.md`, `plan/in-progress/harness-session-anchor-guards.md`,
`.claude/docs/plan-lifecycle.md`, `.claude/docs/orchestrator-workflow-migration.md`,
`CHANGELOG.md`, `.claude/settings.json`, `guard_default_branch_edit.py`,
`test_review_guard.py`. 또한 코드 주석이 주장하는 "measured" 사실 2건(`--exec-path`,
`--super-prefix` 의 git 2.50.1 동작)을 로컬 `git --version`(2.50.1, 주석과 정확히 일치)으로
직접 재현했고, `test_push_detection.py` 전체(44 테스트)를 실행해 전부 통과함을 확인했다.

## 발견사항

- **[INFO]** 테스트 독스트링의 "only `-C` was exercised" 서술이 근소하게 부정확
  - 위치: `.claude/tests/test_push_detection.py` `test_all_value_taking_global_options_skip_their_value`
    (WARNING #3 테이블-드리븐 테스트)의 독스트링, "only `-C` was exercised" 부분
  - 상세: 이 독스트링은 "WARNING #3 이전엔 `_GIT_OPTS_WITH_VALUE` 9개 항목 중 `-C` 하나만
    개별 검증됐다"고 서술한다. 그러나 `MUST_BLOCK` 에는 `git -c user.name="a b" push` 케이스도
    있고, 실제 토큰화를 재현해보면(`_tokenize` 실행 결과 `['git', '-c', 'user.name=a b', 'push']`)
    `-c` 토큰이 `_git_subcommand` 의 `token in _GIT_OPTS_WITH_VALUE` 분기를 **직접** 통과한다 —
    즉 `-c` 도 이미 개별적으로 검증되고 있었다. (참고로 `--git-dir=` 케이스는 인라인 `=` 분기를
    타므로 이 주장과 무관 — `_GIT_OPTS_WITH_VALUE` 멤버십 분기 자체를 실제로 탄 것은 `-C`·`-c`
    2건이다.)
  - 이 프로젝트는 바로 이 종류의 "실측 없는 확신에 찬 서술"에 대해 이례적으로 엄격하다 —
    같은 파일 안에서 `f4489d314`("인용이 보호한다" 서술 반증)와 WARNING #3 자체(`_GIT_OPTS_WITH_VALUE`
    독스트링의 `--exec-path`/`--super-prefix` 확언을 실측으로 정정)가 정확히 이 패턴을 두 번
    다뤘다. 그 기준을 이 신규 독스트링 자체에 소급 적용하면 근소한 반례가 남는다.
  - 기능·안전성에는 전혀 영향 없음(테이블-드리븐 테스트 자체는 9개 항목 전부를 정확히 커버하며
    올바르게 동작·통과함). 결론("화이트리스트 커버리지가 ad-hoc 해서 rot 할 수 있었다")도 여전히
    유효 — 다만 "0건→9건"이 아니라 "2건(-C·-c)→9건" 이 더 정확하다.
  - 제안: "only `-C` was exercised" → "only `-C`/`-c` were exercised(and only via unrelated
    MUST_BLOCK cases, not a dedicated whitelist-coverage test)" 정도로 근소 수정. 우선순위 매우
    낮음 — 원하면 이번 라운드는 건너뛰고 다음 편집 시 함께 정리해도 무방.

## 확인됨 (문제 없음 — 반증/교차검증 근거 기록)

다음은 통상 문서화 리뷰가 지적할 법한 항목들이지만, 실측·교차대조 결과 전부 이미 충족돼 있어
발견사항으로 올리지 않는다:

- **모듈/함수 독스트링**: `guard_review_before_push.py` 의 공개 표면(`_is_git_push`,
  `_tokenize`, `_find_command_substitutions`, `_git_subcommand`, `_shell_dash_c_argument`,
  `_eval_argument`, `_segment_runs_push`, `_is_segment_boundary`,
  `_has_hostile_control_characters`)이 예외 없이 상세 독스트링을 갖췄고, 각각 "왜"(과거 회귀
  Critical #1-#4, WARNING #1-#3, 어느 리뷰 세션에서 발견됐는지)와 "왜 아닌가"(대안 접근을
  기각한 이유)까지 서술한다 — 평균적 기대치를 크게 상회.
- **주석 정확성(실측 검증)**: `_GIT_OPTS_WITH_VALUE` 주석의 "`--exec-path` 는 조회 후 즉시
  종료, `--super-prefix` 는 이 git 빌드가 미인식(exit 129)" 주장을 로컬 git 2.50.1(주석이 명시한
  버전과 정확히 일치)으로 직접 재현 — `git --exec-path push` → exit 0(push 도달 안 함),
  `git --super-prefix foo push` → `unknown option: --super-prefix`, exit 129. 두 주장 모두 정확.
- **README 동기화**: `.claude/tests/README.md` 에 `test_push_detection.py` 행이 이미 추가돼
  있고, 서술(양방향 must-block/must-allow, fail-safe 폴백, differential test)이 실제 테스트
  스위트 구성과 정확히 일치. 같은 커밋에서 삭제된 `test_report_paths_shared.py`/
  `test_forced_coverage_selection.py` 행도 실제 파일 삭제와 대응(고아 문서 없음).
- **Plan 문서 정합성**: `plan/in-progress/harness-session-anchor-guards.md` 의 "잔여 한계"
  절이 코드 독스트링(`_is_git_push` 의 "Deliberately NOT recursed into…", `_find_command_substitutions`
  의 단따옴표 과차단 서술 등)과 문구 수준까지 정합. 두 리뷰 라운드(17_09_10, 18_04_20)의 Critical/
  WARNING 표가 코드의 인라인 참조("Critical #1", "WARNING #2" 등)와 1:1 대응.
  `review/code/2026/07/17/{17_09_10,18_04_20}/` 세션 디렉터리도 실존(이 워크트리 브랜치 기준).
- **설정 문서**: 이번 diff 는 `main()`/`_REVIEW_MSG`/`_PLAN_MSG`/`BYPASS_REVIEW_GUARD`/
  `BYPASS_PLAN_GUARD` 를 건드리지 않음(신규 env·설정 없음) — 기존 오버라이드는 이미
  `plan-lifecycle.md:57`, `orchestrator-workflow-migration.md:231` 에 문서화돼 있음.
- **CHANGELOG**: 루트 `CHANGELOG.md` 는 전수 조사 결과 `codebase/` 제품 변경(각 항목이 `spec/`
  SoT 를 인용)만 기록하는 컨벤션이며, 하네스(`.claude/`) 가드·훅 변경은 과거에도 단 한 건도
  기록된 적이 없음(harness 관련 키워드 grep 0건, worktree/reaper 언급 0건) — 이번 변경을
  CHANGELOG 에서 누락한 것은 정합적 스코프 판단이며 갭 아님.
- **API 문서**: 엔드포인트·API 표면 변경 없음(harness 훅 내부 로직 리팩터).
- **예제 코드**: `test_push_detection.py` 의 44개 케이스(전부 통과 확인)가 사실상 사용법·엣지
  케이스 카탈로그 역할을 겸함 — 별도 사용 예제 문서 불필요.
- **교차 참조 일관성**: 모듈 독스트링의 "Contract (same as guard_default_branch_edit.py)" 주장을
  해당 파일과 대조 — exit 0/2/그 외 규약이 정확히 동일하게 서술됨. `test_push_detection.py` 모듈
  독스트링의 "that is test_review_guard.py's job"(무엇을 할지 결정하는 책임 분리) 주장도
  `test_review_guard.py` 실제 내용과 일치.

## 요약

이번 두 파일은 이 저장소 기준으로도 이례적으로 높은 문서화 수준을 보인다 — 모든 공개 함수에
"무엇을/왜/과거 어떤 회귀였는지"를 밝히는 독스트링이 있고, 핵심 주장 다수가 실제 git 서브프로세스
실행이나 `timeit` 측정으로 검증된 뒤 기록됐으며(이번 리뷰에서 그중 2건을 독립 재현해 정확함을
확인), README·plan 문서·상호 참조 파일들과의 정합성도 전수 대조 결과 어긋남이 없다. 신규
환경변수·API·CHANGELOG 대상 변경도 없어 그쪽 갱신 필요성도 없다. 유일하게 찾은 것은 테스트
독스트링 한 줄의 "only `-C` was exercised" 라는 근소하게 부정확한 역사적 서술(`-c` 도 이미
개별 커버되고 있었음)로, 기능·안전성에는 무영향인 INFO 수준 정정 사항이다.

## 위험도

NONE
