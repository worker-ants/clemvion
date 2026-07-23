# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 이전 두 라운드(CRITICAL 3건 + O(n²) WARNING 4건)는 실측 재현·독립 뮤테이션으로 전부 해소가 확인됐으나, performance 리뷰가 이번 라운드 "새 축"의 O(n²) 열화(`_commit_heredoc_spans`/`_owns_heredoc_as_message` — heredoc 오프너 개수 반복에 따른 누적 prefix 재스캔)를 신규 실측(121KB 입력에서 16.5초, 이 스위트 자신의 10초 기준선 초과)으로 새로 발견해 WARNING 으로 판정했다. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `_commit_heredoc_spans`/`_owns_heredoc_as_message` — 한 줄에 heredoc 오프너가 여럿(`<<TOK0 <<TOK1 …`)이면 소유권 판정 window 시작점(`line_start`)이 매번 그 줄 맨 앞으로 고정돼 누적 prefix 를 매 마커마다 재스캔 → O(h²). 실측: 오프너 12,000개(121KB)에서 16.5초, 이 스위트 자신의 hang 기준(10초 하드 타임아웃)을 초과. 2라운드 리뷰가 언급만 하고 RESOLUTION 에서 실제로는 고치지 않은 잔여 항목 | `.claude/hooks/guard_review_before_push.py::_commit_heredoc_spans` (L212-241), `::_owns_heredoc_as_message` (L116-129) | window 시작점을 `max(line_start, prev_marker_end)` 로 바꿔 직전 처리한 heredoc 마커 끝 이후만 스캔(설계 원칙 "좁게 빗나가면 차단 유지=안전"과 부합, 잘못된 release 생성 안 함). heredoc 오프너 다수(8,000~16,000개)를 `BacktrackingTest` 류에 회귀 테스트로 추가 |
| 2 | architecture | `guard_review_before_push.py`(`_redact_inert_text` 계열)와 `guard_default_branch_bash.py`(`_MUTATING` 단순 정규식)가 "이 Bash 명령이 어떤 git 동작을 실행하는가"를 각자 재구현 — 이번 라운드로 전자만 세 번째 정교화(3-probe 분해)되며 격차가 계속 벌어짐 (기존 이월 항목, 신규 아님) | `guard_review_before_push.py` vs `guard_default_branch_bash.py:59-81` | `_redact_inert_text`/`_is_inert`/`_ESCAPED_PIPE`/3-probe 세트를 `_lib/`(예: `_lib/inert_text_redaction.py`)로 추출해 두 훅이 공유 — backlog 항목 C, plan 이 "착수 가능"으로 갱신됨. 다음 PR 우선순위 상향 권고 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 불균형(구문 오류) 따옴표 입력에서 `_is_git_push` 가 `False` 를 반환하나, `bash -n` 검증 결과 그 입력 자체가 셸에서 실행 불가(EOF 구문 오류) — 우회 아님, 정적 텍스트 가드의 정의역 밖 한계 | `guard_review_before_push.py::_MESSAGE_ARG` | 조치 불요. 선택: `KnownRemainingFalsePositiveTest` 에 "구문 오류 입력은 정의역 밖" 주석과 함께 pin |
| 2 | security | `BacktrackingTest` 하드 타임아웃(10s)이 CI 부하 시 드물게 flake 가능(단독 0.05s, discover 374건 순차 실행 중 1회 관찰). 훅 자체는 in-process 라 프로덕션과 무관 | `test_push_guard_allowlist.py::BacktrackingTest` | 조치 불요/선택: 타임아웃 여유 확대 또는 CI 재시도 1회 허용 |
| 3 | performance | heredoc 종료 구분자 정규식을 매 heredoc 마다 동적 `re.compile()` — 프로세스당-1회 실행 모델상 영향 미미 | `guard_review_before_push.py::_commit_heredoc_spans` | 우선순위 낮음. `delim` 문자열 비교로 대체 가능 |
| 4 | performance | 비용 큰 redaction 경로 진입 전 조기 반환(부분문자열 체크 → 블라인드 매치 → `_is_inert`) 설계 양호 | `guard_review_before_push.py::_is_git_push` (L254-276) | 유지 권장 |
| 5 | architecture | 같은 병인(겹치는 정규식 구간)의 두 fix 가 서로 다른 기법(disjoint alternation vs probe 분해)을 써서 "안전한 스캔 primitive" 작성 원칙이 아직 성문화 안 됨 | `_MESSAGE_ARG`(:145-150) vs `_owns_heredoc_as_message`(:116-129) | 낮은 우선순위. `_redact_inert_text` 모듈 상단 설계 주석에 원칙 한 줄 추가 |
| 6 | architecture | (해소 확인) `_redact_inert_text` 규칙 순서 의존성이 docstring 에 명시됨 — 직전 두 라운드 지적 반영 | `_redact_inert_text`:179-194 | 조치 불요 |
| 7 | requirement | 관련 `spec/` 문서 없음 — 하네스 내부 도구라 규약상 정상, SoR 은 plan 문서이며 코드와 라인 단위 일치 | 전역 | 조치 불요 |
| 8 | requirement | 안전 방향(차단 유지)의 보수적 미해제 케이스 추가 확인: 비-`-m`/`-F` 위치의 순수 리터럴 파이프, `$'...'` ANSI-C 인용 `-m` 값 — 둘 다 우회 아님 | `_MESSAGE_ARG`, `_redact_inert_text` | 기능 결함 아님. 선택: `KnownRemainingFalsePositiveTest` 에 pin |
| 9 | requirement | heredoc 종료 구분자 매칭이 POSIX 보다 관대(공백 허용) — 항상 과소-해제(차단 유지) 방향, 2라운드 기존 결론과 일치 | `_commit_heredoc_spans::end_re` | 조치 불요 |
| 10 | side_effect | `main()`에서 `_is_git_push()` 호출이 여전히 두 게이트(`evaluate_review`/`evaluate_plan`)와 달리 try/except 밖 — 이번 diff 로 판정 로직이 ~150줄로 커져 노출 표면 확대(정책 자체는 §E 로 기존 추적 중, 범위 밖) | `guard_review_before_push.py::main` L319-336 | 선택: `_is_git_push` 호출도 동일 try/except 패턴으로 감싸 구조화된 메시지 일관성 향상 |
| 11 | side_effect | heredoc span과 메시지 span이 같은 문자열 위에서 겹치는 적대적 PoC 4종 직접 검증 — 전부 안전 방향(차단 유지 또는 실행 불가 명령)으로 수렴, 신규 결함 아님 | `_blank_spans`(158-176), `_commit_heredoc_spans`(212-241) | 선택: `-m` 값 내부 리터럴 `<<DELIM` 케이스 1건을 회귀 테스트로 추가 |
| 12 | maintainability | `_owns_heredoc_as_message` 종료~`_MESSAGE_ARG` 주석 사이 공백 1줄만 존재(파일 내 나머지는 2줄 관례) — 전회 라운드 이월, 미수정 | `guard_review_before_push.py:129-131` | 여유 있을 때 공백 줄 추가해 통일 |
| 13 | maintainability | `BacktrackingTest._QUADRATIC_REPEATS` 상수가 클래스 상단이 아닌 테스트 메서드 사이에 위치 — `_TIMEOUT` 과 배치 규칙 불일치 | `test_push_guard_allowlist.py:356` | `_TIMEOUT` 바로 아래로 이동 |
| 14 | testing | `_SEGMENT_SPLIT` 의 `\|\|` 분기가 현재 유일한 호출부(`[-1]` 사용) 기준 동작에 영향 없음(뮤테이션으로 확인, 32건 전부 무변화 통과) — 안전 결함은 아니나 존재 이유가 코드·테스트 어디에도 설명 안 됨 | `guard_review_before_push.py:113`, 호출부 `:123` | 낮은 우선순위. 단순화(`r"&&|[|;\n]"`) 또는 "현재 무영향, 미래 재사용 대비" 주석 추가 |
| 15 | testing | `main()` ↔ `_is_git_push` 통합 이음매(release 판정 명령이 실제 하네스 프로세스에서 exit 0) 검증하는 e2e 스모크 부재 — 2라운드부터 이월, 위험 낮음 | `guard_review_before_push.py:280` 부근, `test_guard_review_before_push_main.py` | 우선순위 낮음. release 케이스 1건 추가 |
| 16 | documentation | plan Overview 절의 라인 번호 인용(`:55`)이 파일 성장으로 stale(`_GIT_PUSH` 실제 위치는 :68-70) — 이번 diff 이전부터 존재, 이번 diff 가 만든 결함 아님 | `plan/in-progress/harness-push-guard-subcommand-detection.md:16` | `:55` → `:68` 또는 심볼명으로 갱신. 우선순위 낮음, defer 가능 |
| 17 | 없음(clean) | scope 리뷰: 30개 변경 파일 전부 "backlog 항목 ② push 가드 재설계" 단일 목적에 수렴 — drive-by 리팩토링·무관 파일·불필요 포맷팅/주석/임포트/설정 변경 없음 | 전역 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CRITICAL 3건 재현·수정 확인, 신규 우회 없음(추가 적대적 PoC 포함). 불균형 따옴표 오탐지는 셸 구문 오류로 실질 무관 |
| performance | MEDIUM | 신규 O(n²) 열화 발견(heredoc 오프너 반복 스캔, 121KB 에서 16.5초로 자체 10초 기준 초과) — 2라운드가 언급만 하고 미수정 |
| architecture | LOW | W1/W2 fix 가 SRP/응집도 개선으로 이어짐. `guard_default_branch_bash.py` 와의 판정 로직 중복은 기존 이월 항목(WARNING) |
| requirement | NONE | spec 대상 아님(정상), plan(SoR)과 코드 라인 단위 일치, 잔여 갭 전부 안전 방향 |
| scope | NONE | 30개 파일 전부 단일 목적 수렴, 무관 변경 없음 |
| side_effect | LOW | 순수 함수 확장, 신규 가변 전역/env/FS/네트워크 부작용 없음. fail-open 노출 표면 확대는 기존 정책 범위 |
| maintainability | LOW | 4건 이전 WARNING 전부 수정 확인, whitespace/배치 스타일 2건만 잔존 |
| testing | LOW | 374/374 + 32/32 실행 확인, 3종 독립 뮤테이션(바이트 정확 재현 포함)으로 회귀 테스트 비-vacuity 검증. 갭 2건은 낮은 우선순위 |
| documentation | LOW | W3/W4 문서 drift 해소 확인(실측), 잔여 1건은 이번 diff 밖 사전 존재 stale 라인 인용 |

## 발견 없는 에이전트

없음 — 9개 forced reviewer 모두 최소 1건 이상의 INFO/WARNING 을 보고했으며, scope·requirement 는 "문제 없음"을 명시적 결론으로 보고(별도 분류 유지).

## 권장 조치사항

1. **(WARNING #1, performance)** `_commit_heredoc_spans` heredoc 소유권 판정 window 를 `max(line_start, prev_marker_end)` 로 바꿔 O(h²) 누적 재스캔 제거 — heredoc 오프너 다수 케이스가 이미 이 스위트 자신의 10초 hang 기준을 실측 초과했으므로 우선 처리 권장. 회귀 테스트(8,000~16,000 오프너) 동반 추가.
2. **(WARNING #2, architecture)** `guard_default_branch_bash.py` 와의 git 서브커맨드 판정 로직 중복 — backlog 항목 C 로 이미 추적 중이며 이번 diff 로 "착수 가능"해짐. `_lib/` 공유 추출을 다음 PR 로 스케줄.
3. INFO 항목들(공백 스타일, `_SEGMENT_SPLIT` 무영향 분기, e2e 통합 스모크 부재, plan 라인 번호 stale 등)은 낮은 우선순위 — 여유 있을 때 일괄 정리 권장, 이번 PR 필수 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보 확인, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 대상 diff 에 의존성/패키지 변경 없음(하네스 내부 훅·테스트·plan 문서만) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음(단일 프로세스 정규식 판정 로직) |
  | api_contract | 공개 API/엔드포인트 변경 없음(내부 하네스 훅) |
  | user_guide_sync | 사용자 문서/가이드 동기화 대상 아님(내부 개발 도구) |