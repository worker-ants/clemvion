# Code Review 통합 보고서

## 전체 위험도
**LOW** — 대상은 default-branch 위 Bash 명령을 감지해 세션당 1회 안내만 하는 **non-blocking advisory 훅**(`guard_default_branch_bash.py`)의 세그먼트 분할 개선. Critical 없음. 이번 diff 가 고치려던 "체인 명령 false negative" 목적이 **따옴표+공백 포함 `VAR=value` 값** 앞에서는 여전히 재현되고, `_SEGMENT_SPLIT` 의 `\n` 처리로 heredoc/멀티라인 본문에서 문서가 단정한 것과 다른 두 번째 오탐 클래스가 생긴다는 점이 WARNING 급으로 남아 있다. forced 화이트리스트(security, requirement, scope, side_effect, maintainability, testing, documentation) 7명 전원 결과 확보 완료 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, testing | `_MUTATING` 의 `VAR=value` 접두 스킵 그룹이 `\S+`(공백 없는 토큰)만 허용해, 따옴표로 감싼 **공백 포함 값**(`GIT_AUTHOR_NAME="John Doe" git commit …`, `GIT_AUTHOR_DATE="2024-01-01 00:00:00" git commit …` 등 — 이 저장소 자신의 테스트 컨벤션에서 실제 쓰이는 패턴) 뒤의 실제 mutating 명령을 인식하지 못하고 조용히 `False` 로 떨어진다. 이번 diff 의 존재 이유인 "체인 명령 false negative 해소"와 정면으로 부딪히는 잔여 사각지대이며, `EnvPrefixTest`/문서 어디에도 pin 되어 있지 않다. | `.claude/hooks/guard_default_branch_bash.py:69` (`(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*`); 테스트 갭: `.claude/tests/test_guard_default_branch_bash_mutating.py:132-145` (`EnvPrefixTest`, 공백 포함 케이스 없음) | `\S+` 를 `(?:'[^']*'|"[^"]*"|\S+)` 로 확장해 따옴표 값을 허용하거나, 최소한 이 갭을 `EnvPrefixTest`/`AcknowledgedFalsePositiveTest` 방식으로 명시적으로 pin 하고 `worktree-policy.md` 서술에 한계를 기록 |
| 2 | maintainability | `_SEGMENT_SPLIT` 정규식과 `VAR=value` 접두 스킵 패턴이 `guard_review_before_push.py` 의 `_SEGMENT_SPLIT`/`_SEGMENT_IS_GIT` 과 변수명까지 동일하게 별도 재구현됨. plan §C 의 won't-do 결론은 "오탐 해제(redaction) 로직 공유 불가"에 대한 것이지 순수 구문 분할·env-prefix 정규식까지 독립 구현하라는 근거가 아니다. 교차 참조 주석이 없어 한쪽만 갱신되면(예: `|&` 추가) 같은 문제를 다시 따로 풀게 된다. | `.claude/hooks/guard_default_branch_bash.py:69`, `:111` (`_SEGMENT_SPLIT`) vs `.claude/hooks/guard_review_before_push.py:120`, `:127` | 두 정규식 옆에 서로를 가리키는 교차 참조 주석 추가, 또는 순수 구문 분할·env-prefix 부분만 작은 공유 헬퍼로 추출(판정 로직은 분리 유지) |
| 3 | testing | `_SEGMENT_SPLIT` 이 개행(`\n`)을 무조건 세그먼트 구분자로 취급해, heredoc/멀티라인 텍스트 본문(예: `cat <<'EOF'\nmkdir the new feature folder\nEOF`)에서 본문 한 줄이 mutating 동사로 시작하면 오탐이 발생한다. 이는 `AcknowledgedFalsePositiveTest`/`README.md:45` 가 "잔여 FP 는 인용된 구분자 하나뿐"이라고 단정한 것과 다른 **별도의 두 번째 오탐 클래스**이며 어디에도 pin 되어 있지 않다. | `.claude/hooks/guard_default_branch_bash.py:111`; 문서 단정: `.claude/tests/README.md:45`; pin 갭: `.claude/tests/test_guard_default_branch_bash_mutating.py:98-110` (`AcknowledgedFalsePositiveTest`) | `AcknowledgedFalsePositiveTest` 에 heredoc/멀티라인 케이스 추가로 pin, README/docstring 의 "the one residual FP" 문구를 "최소 두 클래스"로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | ReDoS 실측 검증 완료 — `VAR=value` 반복 그룹·`_SEGMENT_SPLIT` 모두 최대 20만 문자급 적대적 입력에서 선형 스케일링, 지수 백트래킹 없음(push 가드가 겪었던 과거 CRITICAL 재발 없음) | `guard_default_branch_bash.py:69,111` | 조치 불필요. 향후 `_MUTATING` 에 중첩 quantifier 추가 시 재검증 권고 |
| 2 | security | `_is_mutating` 은 차단 권한 없는 순수 advisory 신호라 인용 미인식·간접실행(xargs/bash -c) 미분류가 보안적으로 악용 불가능(실제 강제는 `guard_default_branch_edit.py`/`.githooks/pre-commit`) | `guard_default_branch_bash.py:114-119` | 조치 불필요. 단, 이 훅이 향후 차단 로직을 갖게 되는 회귀가 생기면 재검토 필요 |
| 3 | security | (diff 밖) `session_id` 를 검증 없이 `os.path.join` 에 사용 — 신뢰 경계 내부 값이라 실질 위험 없음, 이번 변경과 무관 | `guard_default_branch_bash.py:127-145` | 조치 불필요(스코프 밖) |
| 4 | requirement | `_SEGMENT_SPLIT` 이 단일 `&`(백그라운드 연산자)를 분리 대상에서 누락 — `sleep 5 & rm -rf x` 실측 시 `rm` 미검출. `xargs`/`bash -c` 와 달리 `OutOfScopeTest` 로 인지·pin 되지 않음 | `guard_default_branch_bash.py:111` | 필요 시 `_SEGMENT_SPLIT` 에 단일 `&` 추가하거나 `OutOfScopeTest` 에 명시적으로 pin |
| 5 | scope | 코드 주석이 plan 문서 절 번호(`§C`)를 직접 인용 — plan 재구성 시 참조 유실 가능(하우스 스타일과는 일치) | `guard_default_branch_bash.py:65` | 조치 불필요, 참고용 |
| 6 | side_effect | 세그먼트 분할로 넛지(마커 파일 쓰기) 트리거 범위가 넓어짐 — 의도된 확장, 세션당 1회 가드는 불변 | `guard_default_branch_bash.py:114-119` | 조치 불필요(plan §C·`SegmentTest` 로 근거 고정) |
| 7 | side_effect | 세그먼트 분할이 인용 내부/외부를 구분 못해 인용된 문자열 속 구분자도 분할 대상이 됨 — `AcknowledgedFalsePositiveTest` 로 의도적으로 수용된 트레이드오프 | `guard_default_branch_bash.py:111` | 조치 불필요 |
| 8 | documentation | `harness-guard-followups.md` Overview 의 "5건+1건" 서술이 실제 F~I 포함 9개 체크리스트 항목과 불일치(이번 diff 로 stale 심화) | `plan/in-progress/harness-guard-followups.md` (Overview, diff 밖) | Overview 카운트 동기화 또는 "F~I 는 이후 추가" 한 줄 보강 |
| 9 | documentation | won't-do 근거의 "프로브 8건" 표현이 최종 테스트 파일의 실제 커맨드 수(12건, 7+5)와 정확히 대응하지 않음 — 재현성 약한 숫자 서술 | `plan/in-progress/harness-guard-followups.md` (결론 문단) | 검증 가능한 앵커(테스트 파일/커밋)로 숫자 대체 |
| 10 | documentation | 모듈 최상단 docstring 이 이번에 추가된 세그먼트 분할·`VAR=value` 스킵 동작을 언급하지 않음(인라인 주석엔 상세히 설명됨) | `guard_default_branch_bash.py` 모듈 docstring 부분(diff 밖) | 여유 있으면 한 줄 보강 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | ReDoS 실측 무해, advisory-only 라 우회 무의미, injection/secrets/auth 해당 없음 |
| requirement | LOW | `VAR=value` 공백 값 false negative(WARNING), 단일 `&` 미분리(INFO), spec-doc line-level 일치 확인 |
| scope | NONE | 커밋 diff 와 payload 6파일 완전 일치, 무관 변경 없음 |
| side_effect | LOW | 넛지 트리거 범위 확대(의도됨), 인용 무시 오탐(인정됨), 실행 경로 부작용 없음 |
| maintainability | LOW | `guard_review_before_push.py` 와 정규식 중복 구현(WARNING), 그 외 가독성·구조 양호 |
| testing | LOW | 따옴표 공백 값 false negative(WARNING), heredoc 두 번째 FP 클래스 미pin(WARNING), 9건 테스트 + 510건 전체 스위트 통과, 뮤턴트 검증으로 비-vacuity 확인 |
| documentation | LOW | plan Overview stale·프로브 숫자 재현성 약함·docstring 미언급 (전부 INFO, diff 밖 잔여 서술) |

## 발견 없는 에이전트

없음 (전 reviewer 가 최소 1건 이상의 INFO/WARNING 을 보고).

## 권장 조치사항

1. `_MUTATING` 의 `VAR=value` 접두 그룹에 따옴표 값(공백 포함) 지원 추가 또는 최소 `EnvPrefixTest`/문서에 이 갭을 명시적으로 pin — 이번 diff 의 목적(체인 명령 false negative 해소)과 직접 상충하는 잔여 사각지대이므로 최우선.
2. `_SEGMENT_SPLIT` 의 개행 처리로 인한 heredoc/멀티라인 오탐 클래스를 `AcknowledgedFalsePositiveTest` 에 추가 pin 하고, README 의 "the one residual FP" 단정을 갱신.
3. `guard_review_before_push.py` 와 중복된 `_SEGMENT_SPLIT`/env-prefix 정규식에 교차 참조 주석을 추가하거나 순수 구문 규칙만 공유 헬퍼로 추출.
4. (낮은 우선순위) 단일 `&` 백그라운드 연산자 처리를 `_SEGMENT_SPLIT` 에 추가하거나 `OutOfScopeTest` 로 명시적으로 pin.
5. (낮은 우선순위, diff 밖) `harness-guard-followups.md` Overview 카운트 동기화, 프로브 숫자 재현성 보강, 모듈 docstring 한 줄 보강.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **forced 전원 결과 확보 완료** (미이행 없음, "clean" 오판 우려 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(정규식 분류 로직, 실측상 O(n))와 관련성 낮음 |
  | architecture | 아키텍처 구조 변경 없음(단일 함수 로직 확장) |
  | dependency | 신규/변경 의존성 없음 |
  | database | DB 접점 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약 변경 없음(로컬 하네스 훅) |
  | user_guide_sync | 최종 사용자 대상 가이드 변경 없음(내부 개발 하네스 문서만 갱신) |
