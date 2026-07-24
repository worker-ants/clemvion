# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — §J(따옴표 있는 env 접두가 `git push` 탐지를 우회하던 결함) 수정이 "공백 포함 단순 따옴표" 케이스는 실제로 막았지만, **이스케이프된 이중따옴표(`\"`)가 값 안에 있는 경우는 여전히 탐지를 완전히 우회한다**는 사실이 security·requirement 두 리뷰어의 독립적인 실제 코드 실행(재현)으로 확인됨. `_is_git_push()` 가 `False` 를 반환하면 `main()` 이 즉시 `return 0` 하므로 REVIEW/PLAN 게이트 모두 미실행 + fail-open 배너조차 뜨지 않는, 이 훅이 막으려던 바로 그 실패 모드가 좁은 트리거로 재발한다. plan 체크리스트는 §J 를 "✅ 완전 해소"로 표기하고 있어 과장이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | `_GIT_PUSH` 의 새 이중따옴표 대안 `"[^"]*"` 이 POSIX 이스케이프(`\"`)를 인식하지 못해, env 값 안에 이스케이프된 `"` 가 있는 유효한 bash 명령(예: `GIT_AUTHOR_NAME="A \"B\" C" git push`, `GIT_SSH_COMMAND="ssh -i \"file with space\"" git push origin main`)에서 push 탐지가 완전히 우회됨 — 실제 모듈 실행으로 재현 확인(`_is_git_push` → `False`). 같은 파일의 `_MESSAGE_ARG` 는 이미 이스케이프-인지 패턴(`(?:\\.\|[^"\\])*`)을 올바르게 구현하고 있는데 새 env-prefix 대안은 이를 재사용하지 않음. `_BLIND_PATTERN`(테스트 픽스처)에도 byte-identical 로 복제돼 동일 결함 상속. `guard_default_branch_bash.py::_MUTATING`(soft-fail 라 심각도는 낮음)도 동일 3-대안을 복제해 같은 결함 공유 | `.claude/hooks/guard_review_before_push.py:108` (`_GIT_PUSH`); `.claude/tests/test_push_guard_allowlist.py:70` (`_BLIND_PATTERN`); plan 표기 `plan/in-progress/harness-guard-followups.md:449,483` ("✅ 해소"); (참고, diff 밖) `.claude/hooks/guard_default_branch_bash.py:101` (`_MUTATING`) | 이중따옴표 대안을 `_MESSAGE_ARG` 와 동일한 이스케이프-인지 바디 `"(?:\\.\|[^"\\])*"` 로 교체. `_GIT_PUSH`·`_BLIND_PATTERN`·(별건으로) `_MUTATING` 세 곳 동시 갱신. `CORPUS` 에 이스케이프된 이중따옴표 env 접두 케이스를 `release_reason=None`(반드시 차단)으로 추가해 회귀 고정. pin 테스트(`test_the_pin_targets_the_post_fix_pattern`)도 갱신. plan §J 표기를 "부분 해소 + 잔여 갭"으로 정정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Maintainability / Documentation | `_GIT_PUSH` 바로 위 "KNOWN DEFECT (harness-guard-followups §J, fix pending in its own PR) ... hence the separate PR" 주석이 이번 diff 로 완전히 stale 해짐 — 주석은 "아직 안 고쳐졌고 별도 PR 몫"이라 말하지만 바로 다음 줄에서 그 정확한 수정이 이미 적용됨. 이 파일은 스스로 "주석을 신뢰해 판단하라"는 문화를 표방하는 파일이라 다음 유지보수자가 오판(중복 조사/중복 PR)할 위험 실질적. 같은 PR 의 테스트 파일(`KnownFalseNegativeTest` → `QuotedEnvPrefixTest` 리네임 + docstring 과거형 재작성)은 이 처리를 모범적으로 했는데 이 파일만 누락 | `.claude/hooks/guard_review_before_push.py:97-106` (블록 주석), 관련 2차 언급 `:156` | 97~106행을 "FIXED (§J, 2026-07-24)" 류 과거형 서술로 교체하거나 결함 설명 제거, 패턴이 `_MUTATING` 과 byte-identical 이유만 남김. `:156` 의 "lives" 현재형도 함께 정리 |
| 2 | Side Effect / Maintainability | 자매 파일 `guard_default_branch_bash.py` 의 상호 참조 주석("`guard_review_before_push.py` 가 `_GIT_PUSH`/`_SEGMENT_IS_GIT` 양쪽에 `\S+` 형태를 아직 갖고 있다")이 이번 수정으로 사실과 어긋남 — `_GIT_PUSH` 는 이미 3-대안으로 교체됐고 `_SEGMENT_IS_GIT` 만 (의도적으로) `\S+` 로 남음. 두 파일이 서로를 참조하며 "동기화해서 봐야 한다"고 명시한 만큼 손으로 동기화해야 하는 문서 drift 재발 | `.claude/hooks/guard_default_branch_bash.py:95-101` (diff 범위 밖이라 갱신 안 됨) | 같은 PR 또는 즉시 후속 커밋에서 "`_GIT_PUSH` 는 §J 로 수정 완료, `_SEGMENT_IS_GIT` 만 의도적으로 `\S+` 유지"로 갱신 |
| 3 | Testing | 새로 넓힌 `_GIT_PUSH` env-prefix alternation 에 대한 ReDoS/backtracking 회귀 핀 테스트가 없음 — 이 파일은 정확히 같은 실패 클래스(손으로 짠 정규식의 미측정 변경 → catastrophic backtracking)를 3라운드에 걸쳐 실제로 겪어 `BacktrackingTest`/`InputSizeCapTest` 관행을 확립했는데, 이번 PR 의 핵심 변경 자체는 그 관행 적용에서 빠짐. 직접 측정(80,000자 입력 ~0.02s)으로 현재는 선형임을 확인했으나 향후 회귀를 잡을 핀 부재 | `.claude/hooks/guard_review_before_push.py:107` (`_GIT_PUSH`); 누락 지점 `.claude/tests/test_push_guard_allowlist.py:372` (`class BacktrackingTest`) | `BacktrackingTest`에 `_GIT_PUSH`/`_is_git_push` 전용 adversarial 케이스(미종결 따옴표, 다수 `VAR="v" &&` 체인, 혼합 따옴표) 추가해 subprocess+timeout 으로 상수 임계값 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | plan `harness-guard-followups.md` §J 항목이 "✅ 해소" 로 표시돼 있으나 위 Critical #1 근거로 완전 해소는 아님 | `plan/in-progress/harness-guard-followups.md:449,483` | Critical 수정 후 갱신 또는 "이스케이프된 이중따옴표는 미해결" 각주 추가 |
| 2 | Documentation | `.claude/tests/README.md` 의 카탈로그 엔트리가 이번 PR 이 도입한 `_LEGACY_PATTERN`(불변 FN 바닥) vs `_BLIND_PATTERN`(현행 blind 핀) 2단 구조를 반영하지 않음 | `.claude/tests/README.md:47` | 한 문장 추가로 두 상수 구분 서술 |
| 3 | Maintainability | env-value 서브패턴 `(?:'[^']*'\|"[^"]*"\|[^\s'"]\S*)` 이 두 훅 파일 + 테스트 픽스처 3곳에 리터럴 중복, 이를 강제하는 크로스파일 동일성 테스트 없음("byte-identical 유지" 주석상 약속뿐) | `guard_review_before_push.py:108`, `guard_default_branch_bash.py:99-101`, `test_push_guard_allowlist.py:69-72` | 두 훅의 서브패턴 문자열 동일성을 asserting 하는 소규모 pin 테스트 추가 |
| 4 | Maintainability | `assertGreater(..., 10, ...)` vacuity-가드 임계값 `10` 이 `test_no_new_false_negatives`/`test_no_new_blocks` 두 곳에 매직 넘버로 중복 | `.claude/tests/test_push_guard_allowlist.py` (`DifferentialTest`) | 모듈 레벨 상수(`_MIN_CORPUS_COVERAGE = 10`)로 추출 |
| 5 | Maintainability | `legacy_is_push(command)` 가 `test_no_new_false_negatives` 루프 안에서 매 반복 2회 호출(순수함수라 정확성 문제는 없음) | `.claude/tests/test_push_guard_allowlist.py` (`DifferentialTest.test_no_new_false_negatives`) | 지역 변수로 1회 계산 후 재사용 |
| 6 | Testing | CORPUS 의 신규 §J 엔트리(6건)와 `QuotedEnvPrefixTest` 리터럴이 대부분 중복 — drift 위험(낮음) | `test_push_guard_allowlist.py:98-109` vs `:636-641` | 필요시 상수 공유 추출(우선순위 낮음) |
| 7 | Testing | 따옴표 값 경계 케이스(빈 값 `VAR=""`, 혼합 따옴표 `A='say "hi"'`, 값 내부에 `git push` 단어 포함)가 CORPUS 에 없음 | `test_push_guard_allowlist.py` CORPUS §J 섹션(94-109행) | 저확률이지만 안전판으로 몇 줄 추가 권장 |
| 8 | Requirement | `guard_review_before_push.py:91` 의 `SoR: plan/in-progress/harness-push-guard-subcommand-detection.md` 참조가 dangling(해당 plan 은 이미 `plan/complete/` 로 이동, 이번 diff 밖 pre-existing) | `.claude/hooks/guard_review_before_push.py:91` | 별건으로 경로 갱신 |
| 9 | Scope | `test_no_new_false_negatives`/`test_no_new_blocks` 의 `assertGreater` 비-vacuity 가드는 §J 수정 자체와 직접 연관은 없으나, 이번 diff 가 `_LEGACY_PATTERN`/`_BLIND_PATTERN` 이원화로 만든 "차등 테스트 무력화 위험"에 대한 정당한 동반 하드닝 | `test_push_guard_allowlist.py:251,269` | 조치 불요, 기록용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | 이중따옴표 env 값 이스케이프(`\"`) 미처리로 push 탐지 완전 우회 재발(실제 실행 재현) |
| requirement | HIGH | 동일 CRITICAL 을 독립 재현 + plan "완전 해소" 표기 과장 확인 + stale 주석 |
| scope | NONE | 변경이 §J 단일 항목에 정확히 국한, 무관한 리팩토링/설정 변경 없음 |
| side_effect | LOW | 기능적 부작용 없음, 자매 파일 상호참조 주석 drift 만 |
| maintainability | LOW | stale "KNOWN DEFECT" 주석(코드-문서 모순) 2건 + 매직넘버/중복 등 경미 |
| testing | LOW | 테스트 자체는 견고(뮤테이션 검증 완료)하나 새 alternation 에 ReDoS 회귀 핀 부재 |
| documentation | MEDIUM | 핵심 소스 파일의 "KNOWN DEFECT ... fix pending" 주석이 이미 적용된 수정과 모순 |

## 발견 없는 에이전트

없음 (모든 실행 에이전트가 실질 발견사항을 최소 1건 이상 보고함)

## 권장 조치사항
1. **(최우선, Critical)** `_GIT_PUSH` 의 이중따옴표 대안을 `_MESSAGE_ARG` 와 동일한 이스케이프-인지 패턴(`"(?:\\.|[^"\\])*"`)으로 교체하고, `_BLIND_PATTERN`·(별건으로) `guard_default_branch_bash.py::_MUTATING` 도 동시 갱신. 이스케이프된 이중따옴표 env 접두 케이스를 CORPUS 에 `release_reason=None` 으로 추가해 회귀 고정.
2. plan `harness-guard-followups.md` §J 표기를 "완전 해소"에서 "부분 해소 + 잔여 갭(이스케이프 케이스)"으로 정정.
3. `guard_review_before_push.py:97-106` 의 "KNOWN DEFECT ... fix pending in its own PR" stale 주석을 "FIXED (§J, 2026-07-24)" 로 갱신하고, `guard_default_branch_bash.py` 의 상호참조 주석도 동기화.
4. `BacktrackingTest` 에 새 `_GIT_PUSH` alternation 전용 ReDoS 회귀 케이스 추가.
5. (낮은 우선순위) README.md 카탈로그 nuance 갱신, 매직넘버 상수화, 경계 케이스 CORPUS 보강.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 즉 실행된 7명 전원이 router_safety 화이트리스트로 강제 포함되었고, 이번 라운드에는 router 가 자율적으로 추가 선택한 reviewer 는 없음. forced 전원 결과 확보 확인됨(누락 없음).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(정규식/문서 텍스트 수정)와 저관련 |
  | architecture | 아키텍처 변경 없음(단일 정규식 그룹 수정) |
  | dependency | 의존성 변경 없음 |
  | database | DB 관련 코드 없음 |
  | concurrency | 동시성 코드 없음 |
  | api_contract | API 계약 변경 없음(harness 내부 훅) |
  | user_guide_sync | 사용자 가이드 문서 대상 아님(harness/plan 문서만 변경) |