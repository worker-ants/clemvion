# Security Review — review/code/2026/08/01/09_09_19

## 검증 방법 (round 9 지시사항에 따른 실측 우선 검증)

프롬프트에 실린 3개 파일(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`)과 truncate 표시가 있던 2개 파일
(`consistency_orchestrator.py`, `merge_coordinator_orchestrator.py` 잔여분)은
전부 `Read` 로 원본을 직접 열어 판단했다. `test_block_integrity.py` 도 전문을
`Read`로 확인했다.

이번 라운드가 명시한 "라운드 7이 정규식 quadratic 인스턴스 하나만 고치고 같은
패턴의 두 번째 인스턴스를 남겼고, 회귀 테스트도 그 두 번째 인스턴스에 닿지
못했다"는 실패 유형을 이번 diff 가 실제로 완전히 닫았는지 **검사(inspection)가
아니라 실측(measurement)**으로 확인했다:

1. `.claude/_shared/block_integrity.py`의 구버전 정규식(수정 전 leading class
   `[\s>#*_\`-]*`, 그리고 "leading class만 고치고 gap `\s*\**\s*`는 안 고친"
   중간 상태)을 별도 스크립트에서 격리 재구성해 동일 adversarial 입력으로 실행.
2. `.claude/hooks/guard_review_before_push.py`의 `_is_git_push`를 실제 모듈
   로드로 불러와 §J·§L·§M(a-e) 이력이 각각 겨냥한 9종 adversarial 입력으로
   재실행.
3. `.claude/tests/test_block_integrity.py`(38개), `test_stop_guard_failopen.py`,
   `test_retry_state_shared.py`, `test_consistency_orchestrator_state.py`,
   `test_review_changeset_warning.py`(합계 49개 + 8 subtests)를 `pytest`로 실제
   실행해 GREEN 확인.

## 발견사항

- **[INFO] (실측 검증 완료) `block_integrity.py`의 두 quadratic regex 결함 — 라운드 7→8이 발견한 "부분 수정" 패턴이 이번 라운드에서 완전히 닫혀 있음**
  - 위치: `.claude/_shared/block_integrity.py:97` (`_BLOCK_AT_LINE_START`), `:100` (`_BLOCK_AT_LINE_END`) — 회귀 테스트는 `.claude/tests/test_block_integrity.py:470`(`VerdictParserStaysLinearTest`), 개별 테스트 `:525`·`:529`·`:543`
  - 상세: 이 파일의 자체 주석(60~96번 줄)이 이미 "라운드 7이 leading class(`\s` under MULTILINE)만 고치고, `BLOCK:`과 verdict 사이 gap(`\s*\**\s*`, 인접 quantifier 모호성으로 인한 독립적인 두 번째 quadratic)은 그 회귀 테스트가 `BLOCK:`이 아예 없는 입력을 썼기 때문에 잡지 못했다"는 정확히 이 세션의 지시사항과 같은 서사를 기록하고 있다. 이를 그대로 믿지 않고 별도 스크립트로 구버전 패턴을 재구성해 측정:
    - Leading-class 결함: OLD 패턴(`[\s>#*_\`-]*BLOCK:\s*\**\s*(YES|NO)`)을 20,000줄 no-`BLOCK:` 문서에 실행 → **9.425초**. 현재 코드(`[ \t>#*_\`-]*BLOCK:[ \t*]*(YES|NO)`, 97-99번 줄)는 **0.002초**.
    - Gap 결함(라운드 7이 놓쳤던 두 번째 인스턴스): "leading class는 고쳤지만 gap은 `\s*\**\s*` 그대로"인 중간 상태를 재구성해 `"BLOCK:" + " "×45000`(줄바꿈 없음, 한 줄)에 실행 → **15.171초**. 현재 코드(`[ \t*]*`, 97·100번 줄 양쪽)는 **0.001초**.
    - `test_block_integrity.py`의 `VerdictParserStaysLinearTest` 3개 테스트를 `pytest -v`로 실제 실행 → 38/38 PASS, 0.59초. 세 테스트는 각각 START 패턴의 leading class(`test_no_verdict_in_a_large_document_returns_fast`), START 패턴의 gap(`test_a_bare_block_followed_by_a_long_run_returns_fast`), END 패턴의 tail(`test_a_trailing_run_after_a_real_verdict_returns_fast`)을 겨냥해 서로 다른 정규식 부위를 검사하므로, 위 재구성 측정과 대조하면 "고치기 전 상태였다면 5초 타임아웃에 실제로 걸렸을 것"임이 확인된다 — vacuous 테스트가 아니다.
  - 제안: 코드 수정 불요(확인 완료). 이 검증 절차(구버전 패턴을 스크립트로 격리 재구성해 동일 입력으로 대조 측정) 자체를 향후 "정규식 부분 수정" PR의 표준 검증 관행으로 문서화할 것을 권고.

- **[INFO] (실측 검증 완료) `guard_review_before_push.py`의 `_GIT_PUSH`/redaction 파이프라인 — 5차 수정 이력(§J·§L·§M·§O) 각각이 겨냥한 9종 adversarial 입력 재실측, 잔여 ReDoS 없음**
  - 위치: `.claude/hooks/guard_review_before_push.py:252`(`_GIT_PUSH`), `:363`(`_MESSAGE_ARG`), `:430`(`_commit_heredoc_spans`)
  - 상세: 이 파일은 자체적으로 다섯 차례(§J/§L/§M(a-e)/§O) ReDoS를 발견·수정한 이력이 있어 "같은 클래스의 미수정 잔여 인스턴스"가 나올 위험이 가장 높다고 판단해 모듈을 직접 로드하고 각 이력 항목이 실제로 hang을 유발했던 입력 모양(`;`/`&`/`\n` 구분자 1,600회 반복 + 실패 tail, 공백을 감싸는 인용값 `A="x y=z"` 2,000회, heredoc 마커 3,000개, escaped pipe 3,000개, `-F -` heredoc 본문에 "push" 단어가 400줄 반복 등 9종)를 재구성해 `_is_git_push()`를 직접 호출·측정 → **전부 10ms 이내** 완료.
  - 제안: 코드 수정 불요(확인 완료).

- **[INFO] 입력 검증 — `--diff-base`가 검증 없이 git refspec 문자열에 삽입됨 (기존 패턴, 이번 diff 범위 내 재확인)**
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:308`(`_collect_code_diff`의 `cmd = ["git", "diff", f"{diff_base}...HEAD", "--"]`), `:220-221`(`_branch_changed_rels`)
  - 상세: `diff_base = args.diff_base or "origin/main"`(406번 줄) 이후 `--` 구분자가 refspec **뒤**에만 위치해, refspec 자체는 여전히 git이 옵션으로 오인할 수 있는 자리다. `subprocess.run`이 리스트 인자(비-shell)라 셸 인젝션은 불가능하지만 `diff_base`가 `-`로 시작하는 값일 때 git 인자 파싱 결과는 검증되어 있지 않다. 다만 이 값은 이미 리포지토리 전체에 대한 CLI 접근 권한을 가진 호출자만 지정할 수 있는 위치이므로(공개 웹 엔드포인트가 아님) 실질적 권한 상승으로 이어지지 않는다 — 영향은 낮음. `review_guard.py:246-247`(`_committed_code_changes`), `code_review_orchestrator.py`의 `get_git_branch_diff_files` 등 리포지토리 전역에 동일 패턴이 있어 이번 PR만의 회귀는 아니다.
  - 제안: `diff_base`(및 동종 `branch`/`base` 인자들)가 `-`로 시작하지 않는지 검증하는 가드를 공용 헬퍼로 추가하는 방어적 강화를 고려. 저비용이며 일괄 적용 가능.

- **[INFO] 경로 안전 주석이 실제 방어 메커니즘을 부정확하게 서술 (`_MARKER_SAFE`) — 코드 자체는 안전함을 확인**
  - 위치: `.claude/hooks/guard_review_before_stop.py:42-45`
  - 상세: 주석은 "(`/`, `..`, whitespace, …) is collapsed to `_`"라고 서술하지만, 정규식 `[^A-Za-z0-9._-]`(45번 줄)은 `.`(마침표)를 허용 문자 집합에 포함하므로 `..` 문자열 자체는 치환되지 않는다(개별 `.`은 매치 대상이 아니라 그대로 남는다). 실제 경로 탈출 방지는 **경로 구분자 `/`가 제거**된다는 사실에서 나온다 — `_marker_path`(198-211번 줄)가 `os.path.join(_state_dir(), base)`로 결합할 때 `base`에 구분자가 없으므로 상위 디렉토리로 나갈 수 없다. `session_id`/`token`/`kind` 세 입력 모두 `_sanitize_component`(48-49번 줄)를 거친 뒤에만 경로에 들어가는 것을 확인했으므로 실제 취약점은 아니다.
  - 제안: 주석을 "구분자(`/`, 및 플랫폼별 대체 구분자)만 제거되며, 그것으로 경로 탈출 방지에 충분하다"로 정정. 코드 변경은 불필요.

- **[INFO] 하드코딩된 예측 가능 임시 로그 경로 (기존 패턴, 이번 diff 신규 아님)**
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:50`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:47`, `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:46`
  - 상세: `DEBUG_LOG_FILE = "/tmp/<name>-log.txt"` 형태의 고정 파일명이 공유 `/tmp`에 생성된다. 다중 사용자 환경이라면 예측 가능 파일명 기반 심링크 공격/정보 노출 여지가 있는 고전적 패턴(CWE-377)이지만, 이 리포지토리의 실제 위협 모델(로컬 단일 개발자/CI 워크트리)에서는 악용 가능성이 낮고, 이번 라운드 diff로 신규 도입된 것도 아니다.
  - 제안: 낮은 우선순위. 필요 시 `tempfile.gettempdir()` 기반 동적 경로로 교체 검토.

## 확인했지만 문제없음 (Negative findings — 명시적으로 점검함)

- **하드코딩된 시크릿**: 18개 대상 파일 전체에 대해 API 키/비밀번호/토큰/인증서 패턴을 grep — 매치 없음.
- **위험한 실행 프리미티브**: `shell=True`, `os.system(`, `eval(`, `exec(`, `pickle.`, `subprocess.call/Popen(`, `yaml.load(` 전체 grep — 매치 없음. 모든 `subprocess.run` 호출이 리스트 인자(비-shell)로, 커맨드 인젝션 표면이 없음.
- **인증/인가**: 이 harness는 로컬 git hook/CLI 도구로 다중 사용자 인가 경계가 없는 설계(리포지토리에 대한 완전한 쓰기 권한을 가진 단일 운용자 전제). `BYPASS_REVIEW_GUARD=1`/`BYPASS_PLAN_GUARD=1`는 의도된 인간 개입형 우회이며 공격 표면이 아님 — 게이트 문서 자체가 "정밀한 오라클이 아니라 강한 넛지"임을 명시.
- **암호화**: `guard_review_before_stop.py`가 `hashlib.sha1`을 사용하나(중복 advisory 억제용 12자 dedup 키), 충돌 저항성이 요구되지 않는 비-보안 목적(idempotency 키)이라 알고리즘 선택 자체는 문제 없음.
- **에러 처리**: 다수 지점에서 `traceback.print_exc(file=sys.stderr)`로 전체 스택트레이스를 출력하나, 이 stderr는 hook을 구동한 동일 운용자(개발자/에이전트)에게만 노출되고 신뢰 경계를 넘지 않으므로 정보 노출로 보지 않음. 오히려 이번 diff의 핵심 목적 중 하나(`failopen_state.py`, `block_integrity.py`)가 "조용한 fail-open/하향"을 관측 가능하게 만드는 것으로, 보안 관측성 측면에서 개선.
- **의존성 보안**: 이번 diff에 신규 서드파티 라이브러리 추가 없음(표준 라이브러리만 사용: `json`/`os`/`re`/`subprocess`/`sys`/`time`/`hashlib`/`traceback`/`datetime`/`dataclasses`/`argparse`).
- **경로 탐색**: `guard_review_before_stop.py`의 마커 파일명 조합(`_sanitize_component` 경유) 검증 완료(위 INFO 항목 참고 — 주석은 부정확하나 코드는 안전). `os.walk` 사용처(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)는 모두 `followlinks` 기본값(False)이라 심링크 순환에 안전.
- **정규식 서비스 거부(ReDoS)**: 위 실측 항목 참고. 추가로 `consistency_orchestrator.py:364`의 `RATIONALE_HEADER_RE = re.compile(r"^##\s+Rationale\b.*$", re.MULTILINE)`도 block_integrity와 같은 "MULTILINE + `\s`" 형태라 동일 클래스 잔여 여부를 별도로 실측했다 — "##" 리터럴이 먼저 실패하는 대다수 줄 시작 지점에서 즉시 컷되어 leading class가 전체 문서를 삼킬 수 있었던 block_integrity의 구버전과 메커니즘이 다르며, 4,000~8,000줄 adversarial 입력에서 선형(0.000s→0.003s) 확인 — 문제 없음.

## 이번 라운드의 보안 관련 긍정적 변경

- `evaluate_review(cwd=None, *, in_flight_ok=False)`(review_guard.py:934-935)로 opt-in화한 것을 확인: push 게이트(`guard_review_before_push.py`)는 `in_flight_ok`를 전혀 넘기지 않아 기본값 `False`가 유지되고(스코프드/언스코프드 호출 경로 양쪽 모두 확인), Stop 게이트만 `in_flight_ok=True`(`guard_review_before_stop.py:350`)를 넘긴다 — 이전에는 이 억제가 무조건 적용되어 push 게이트가 최대 30분(`_IN_FLIGHT_TTL_SECONDS`) 동안 열려 있던 결함이었다. `test_stop_guard_failopen.py`의 `test_stop_passes_in_flight_opt_in`이 seam(실제 kwarg 전달) 자체를 단언하는 것을 확인 — 결정 객체 shape만 보는 약한 단언이 아님.
- `block_integrity.py`의 `[CRITICAL]` vs `BLOCK:` 모순 백스톱은 기존에 프롬프트 지침으로만 존재하던 "하향 금지" 규칙에 기계적 감지를 추가한 것으로, silent policy violation을 관측 가능하게 만드는 보안 관측성 개선이다.

## 요약

이번 라운드는 기능적으로 (1) 세 orchestrator의 상태 관리 코드 중복 제거(`_shared/retry_state.py`), (2) `[CRITICAL]`/`BLOCK:` 모순 감지 백스톱(`_shared/block_integrity.py`), (3) Stop/Push 게이트 간 `in_flight_ok` 스코프 분리, (4) fail-open 리포팅 공유화(`_lib/failopen_state.py`)로 구성되며, 이 중 어느 것도 새로운 인젝션·인증 우회·시크릿 노출 벡터를 도입하지 않았다. 이번 세션의 핵심 지시사항이었던 "정규식 부분 수정이 같은 클래스의 모든 인스턴스를 닫았는지, 회귀 테스트가 실제로 실패할 수 있었는지"를 `block_integrity.py`와 `guard_review_before_push.py` 양쪽에 대해 구버전/중간 상태 패턴을 격리 재구성한 실측으로 검증했고, 두 파일 모두 완전히 닫혀 있으며 회귀 테스트는 vacuous가 아님을 확인했다(코드 검사만이 아니라 실제 타이밍 측정 결과 포함). 발견된 항목은 전부 INFO 수준으로, 저위협-모델(로컬 단일 운용자 CLI 도구)에서 실질적 악용 가능성이 낮은 방어적 강화 제안(입력 검증 하드닝, 주석 정정, 임시 파일 경로) 뿐이다. 하드코딩된 시크릿, 위험한 실행 프리미티브, 신규 서드파티 의존성은 전무했다.

## 위험도

LOW
