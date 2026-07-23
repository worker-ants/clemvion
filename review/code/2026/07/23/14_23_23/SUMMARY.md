# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `_MESSAGE_ARG` 정규식(신규 추가) 하나에 서로 다른 세 가지 실측 CRITICAL 결함이 겹쳐 있다: (1) 홑따옴표 이스케이프 오판정으로 인한 push-guard **결정론적 우회**, (2) 동일 정규식의 파국적 백트래킹(ReDoS)으로 인한 훅 무기한 정지, (3) 차등 테스트가 스스로 정의한 `legacy(c) ⇒ new(c)` 불변식을 실제로 위반하는 케이스가 코퍼스 부재로 미검출. 세 건 모두 두 명 이상의 forced reviewer 가 독립적으로(교차) 확인했다. forced 화이트리스트(security/architecture/requirement/scope/side_effect/maintainability/testing/documentation) 전원 결과 확보됨 — 화이트리스트 미이행에 의한 은폐는 없음. 다만 router 가 `performance` 리뷰어를 skip 했음에도 ReDoS(성능 결함)를 requirement/side_effect 가 우연히 잡아낸 점은 forced 안전망이 실제로 작동했음을 보여준다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `_MESSAGE_ARG` 가 홑따옴표(`'…'`)에도 겹따옴표 이스케이프 규칙(백슬래시+다음문자=이스케이프 쌍)을 적용해, `-m` 값이 홀수 개 백슬래시로 끝나는 홑따옴표 문자열이면 닫는 따옴표를 못 찾고 명령 뒤쪽의 다음 홑따옴표까지 "메시지 본문"으로 오판정 → 그 구간에 포함된 **실제 실행되는 `&& git push`가 통째로 redact 되어 gate 완전 우회**. PoC 실측: `git commit -m 'a\' && git push -- 'end'` → `_is_git_push()` = `False`(오탐지), redact 결과 `"&& git push --"` 구간 소실. security.md·requirement.md 교차 재현 확인 | `.claude/hooks/guard_review_before_push.py` `_MESSAGE_ARG` 본문 서브패턴 `(?:\\.|(?!(?P=q)).)*` (L99-104 부근) | quote 종류별 분기 — `'` 는 이스케이프 불인정 `[^']*`(홑따옴표 안엔 애초에 `'` 리터럴 삽입 불가라 첫 `'`가 항상 진짜 종료), `"` 만 현재 로직 유지. 위 PoC 를 `ReleaseRefusedTest` 에 회귀 고정 |
| 2 | SIDE_EFFECT / PERFORMANCE | `_MESSAGE_ARG` 본문의 두 대안(`\\.` 대 `(?!(?P=q)).`)이 백슬래시 문자에서 겹쳐(ambiguous alternation), 닫는 인용부호를 못 찾는 입력에서 정규식 엔진이 지수적 백트래킹(ReDoS)을 일으킴. PreToolUse 훅이 모든 Bash 호출을 동기 게이팅하므로 hang = 세션 정지 또는 하네스 타임아웃에 의한 fail-open. 독립 실측 2건: requirement.md(백슬래시 20개→0.5s, 25개→3초+ timeout), side_effect.md(30개→0.84s, 35개→9.56s, 40개→105.7s). 닫는 따옴표가 정상 존재하면 즉시(<1ms) 매치 — "매치 실패" 케이스에서만 발현. legacy 패턴은 동일 입력에서 선형시간(신규 도입 결함, 선재 아님) | 동일 위치 (`_MESSAGE_ARG`) | 겹치는 alternation 제거: 겹따옴표 분기 본문을 `(?:\\.|(?!")[^\\])*` 처럼 폴백 대안에서 백슬래시를 명시적으로 배제. 수정 후 "닫는 따옴표 없는 긴 백슬래시 시퀀스"에 대한 시간 상한(예: 1초 이내) 회귀 테스트 추가 — 현재 테스트는 정확성만 검증하고 성능 상한 검증이 전혀 없음 |
| 3 | TESTING | 차등 테스트 스스로 선언한 `legacy(c) ⇒ new(c)` 불변식이 실제로 위반되는 케이스가 `CORPUS`에 없어 미검출. 커밋 메시지에 우연히 "push" 단어가 있고 같은 압축 명령 안 다른 곳에 `$(git push ...)` 형태의 진짜 실행 가능한 push 가 있으면, legacy 는 (메시지 속 "push" 단어에 우연히 매치해) `True`(차단)였는데 새 `-m` 값 블랭킹 규칙이 그 우연한 매치를 지워 `False`(조용히 통과)로 뒤집힘. 실측: `git commit -m "fix: retry push notification bug" && echo "log: $(git push origin main)"` → legacy=True, new=False. 저장소가 실제로 흔히 쓰는 커밋 메시지 패턴과 결합해 재현 가능 | `.claude/hooks/guard_review_before_push.py::_redact_inert_text` + `.claude/tests/test_push_guard_allowlist.py::CORPUS`/`RELEASED` | 이 조합 shape 를 `CORPUS`에 추가해 실패를 드러낸 뒤 (a) 선재 갭의 연장선으로 명시적으로 pin·plan 기록하거나 (b) `_redact_inert_text`가 블랭킹 후 전체 문자열에 라이브 토큰(`$(`/backtick/`${`)이 하나라도 남아있으면 release 자체를 보류하도록 보수화(현재는 매칭된 `body` 국소 범위만 검사) |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | ARCHITECTURE | 두 가드 훅(`guard_review_before_push.py` vs `guard_default_branch_bash.py`)의 git 서브커맨드 판정 로직 중복이 이번 변경으로 정교함 격차가 더 벌어짐(전자만 정교한 redaction 로직 추가). 이미 backlog 항목 C 로 추적 중이며 이번 diff 도 "② 확정 → C 착수 가능"으로 정확히 반영함 | `guard_review_before_push.py`(신규 ~140줄) vs `guard_default_branch_bash.py:60-81`(diff 밖, 단순 정규식) | 항목 C 를 이번 PR 범위 밖 defer 하는 것은 합리적이나, `_lib/git_command_detection.py` 류로 `_redact_inert_text`/`_is_inert`/`_ESCAPED_PIPE` 를 조기 추출해 두 훅이 공유하도록 우선순위를 올릴 것 |
| 2 | MAINTAINABILITY | 테스트 `CORPUS`와 `RELEASED` dict 간 명령 리터럴을 두 곳에 각각 타이핑해 유지(이중 SoT). drift 시 `test_no_new_false_negatives` 등이 시끄럽게 실패하므로 silent regression 은 아니나 수작업 동기화 부담 존재 | `.claude/tests/test_push_guard_allowlist.py` `CORPUS`/`RELEASED` | `RELEASED`를 `CORPUS` 항목의 3번째 필드(`released_reason`)로 흡수하거나 튜플 리스트로 재구성해 리터럴을 한 곳에만 존재시킴 |
| 3 | TESTING | `git tag ... -F -` heredoc 해제 경로가 완전히 무테스트(`_COMMIT_STDIN_CMD`가 `(?:commit|tag)`로 tag 명시 지원하지만 CORPUS/RELEASED 어디에도 "tag" 리터럴 0건). 수동 검증으로는 정상 동작 확인했으나 향후 리팩터링 시 조용히 깨져도 무검출 | `guard_review_before_push.py::_COMMIT_STDIN_CMD` / `test_push_guard_allowlist.py` | `git tag -F -` 케이스 1~2건과 "tag인데 소유 세그먼트 위장" 대칭 케이스를 `ReleaseRefusedTest`류에 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | ARCHITECTURE | `_redact_inert_text` 내부 3규칙(escaped-pipe→heredoc→메시지) 순서 의존성이 문서화되지 않은 숨은 불변식(escaped pipe 정규화가 heredoc 판정보다 먼저 실행돼야 함) | `guard_review_before_push.py:129-148` | docstring에 순서 이유 한 줄 추가 + escaped-pipe가 heredoc 여는 줄 앞에 있는 코퍼스 케이스 추가 |
| 2 | ARCHITECTURE | 테스트가 모듈 private 멤버(`_GIT_PUSH`, `_is_git_push`)에 직접 결속 — 의도된 pinning 이나 향후 `_lib/` 추출 시 함께 갱신 필요 | `test_push_guard_allowlist.py` `BlindPassFrozenTest` 등 | 추출 시 원래 이름 re-export 권장 |
| 3 | SCOPE / MAINTAINABILITY | 함수 사이 공백 줄 3개(파일 전체 컨벤션은 2개) | `guard_review_before_push.py:189-191`(`_blank_commit_heredocs` 종료~`_read_payload`) | 공백 줄 1개 제거 |
| 4 | MAINTAINABILITY | 신규 정규식(`_COMMIT_STDIN_CMD`, `_MESSAGE_ARG`) 밀도가 높아 재독해 비용 큼 | `guard_review_before_push.py` | 여유 시 `re.VERBOSE`+토큰 단위 주석 고려(선택) |
| 5 | MAINTAINABILITY | `_ESCAPED_PIPE.sub()` 치환의 "길이 보존" 불변식이 코드 근처에 명시되지 않음 | `guard_review_before_push.py::_redact_inert_text` 1단계 | `.sub()` 호출 옆에 "치환 길이=매치 길이여야 오프셋 유효" 주석 추가 |
| 6 | TESTING | 빈 heredoc 본문(zero-length body) 경계 케이스 무테스트(방어 주석은 있으나 회귀 테스트 없음) | `guard_review_before_push.py::_blank_commit_heredocs` | 빈 heredoc 1건을 코퍼스/유닛 테스트로 pin |
| 7 | TESTING | `-F "quoted value"`(파일 경로 인자)가 heredoc `-F -` 관용구와 동일 규칙으로 블랭킹되지만 의미 차이(파일 경로 vs 메시지 텍스트)가 문서화 안 됨(안전 방향이라 결함 아님) | `guard_review_before_push.py::_MESSAGE_ARG` | 주석에 "정적 텍스트라 블랭킹 안전" 한 줄 명확화 |
| 8 | DOCUMENTATION | `_is_git_push()`에 요약 독스트링 부재(2단계 판정으로 복잡도 증가했는데 인접 헬퍼들과 달리 독스트링 없음, 인라인 주석은 충분) | `guard_review_before_push.py:402-411` | 한 줄 요약 독스트링 추가 |
| 9 | DOCUMENTATION | 모듈 상단 독스트링이 신규 blind+allowlist 설계를 언급하지 않아 발견성 낮음(실질 피해는 낮음) | `guard_review_before_push.py:201-224` | 모듈 독스트링 끝에 설계 위치 안내 한 줄 추가(선택) |
| 10 | SECURITY | `main()`의 3중 fail-open(import 실패/`evaluate_*()` 예외/미처리 예외)은 이번 diff 도입 아닌 선재 정책 결정, `harness-guard-followups.md` §E 로 이미 별도 추적 중 | `guard_review_before_push.py::main` | 범위 밖(§E 트래킹 참고) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | 홑따옴표 이스케이프 오판정으로 push-guard 완전 우회 (PoC 확보) |
| requirement | CRITICAL | 우회 결함 독립 재현 교차확인 + ReDoS 신규 발견(벤치마크) |
| side_effect | CRITICAL | `_MESSAGE_ARG` 파국적 백트래킹(ReDoS) 독립 벤치마크(최대 105.7s) |
| testing | HIGH | 차등 테스트 `legacy⇒new` 불변식 실위반 케이스가 코퍼스 부재로 미검출 |
| architecture | LOW | OCP 잘 지켜진 확장점 설계, 훅 간 로직 중복(추적중 항목 C) 격차 확대 |
| maintainability | LOW | 전반 품질 양호, 테스트 코퍼스/RELEASED 이중 SoT 경미 |
| documentation | LOW | 문서화 수준 평균 이상, 사소한 독스트링 누락 |
| scope | LOW | 스코프 이탈 없음, 4파일 모두 단일 의도에 수렴, 사소한 스타일 |

## 발견 없는 에이전트

없음 — forced 8개 reviewer 전원이 최소 INFO 이상 발견사항을 보고함.

## 권장 조치사항

1. `_MESSAGE_ARG` 정규식을 quote 종류별로 분기(`'`=이스케이프 불인정 `[^']*`, `"`=현재 로직 유지)하고, 겹따옴표 분기의 alternation 겹침도 함께 제거(`(?:\\.|(?!")[^\\])*` 형태)해 CRITICAL #1과 #2를 동시에 해결한다.
2. 위 수정 후 회귀 테스트 3종을 `test_push_guard_allowlist.py`에 추가: (a) 홑따옴표 trailing-backslash PoC(`ReleaseRefusedTest`), (b) 닫는 따옴표 없는 긴 백슬래시 시퀀스에 대한 시간 상한(<1초) 검증, (c) "push 단어 포함 메시지 + 별도 `$(git push ...)`" 조합(CRITICAL #3) — 이 케이스는 pin 하거나 `_redact_inert_text`를 전체 문자열 라이브 토큰 검사로 보수화.
3. `git tag -F -` 해제 경로와 빈 heredoc 본문 경계 케이스를 코퍼스에 추가해 커버리지 갭(WARNING #3, INFO #6)을 해소한다.
4. 이상 CRITICAL 3건 수정·회귀 테스트 확보 전에는 `/ai-review → RESOLUTION → PR` 단계로 진행하지 말 것 — 이 컴포넌트는 "미검토 코드 push를 막는 유일한 hard gate"로 자체 문서화되어 있어 결함의 파급력이 전체 저장소에 미친다.
5. (낮은 우선순위) backlog 항목 C(`guard_default_branch_bash.py`와의 로직 공유)를 후속 PR로 조기 착수해 두 훅의 정교함 격차가 더 벌어지기 전에 `_lib/` 공유 모듈로 추출.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 단, ReDoS(성능 결함)는 forced인 requirement·side_effect 가 독립적으로 포착함(안전망 작동 확인) |
  | dependency | router 판단 — 이번 diff 는 신규 의존성 도입 없음(security.md 확인) |
  | database | router 판단 — DB 관련 변경 없음 |
  | concurrency | router 판단 — 공유 가변 상태/스레딩 변경 없음(side_effect.md 확인) |
  | api_contract | router 판단 — 공개 API/엔드포인트 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 문서 대상 변경 없음(하네스 내부 훅) |