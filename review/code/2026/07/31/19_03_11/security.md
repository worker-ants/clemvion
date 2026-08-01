# Security Review

## 대상

`.claude/_shared/block_integrity.py`(신규), `.claude/_shared/retry_state.py`(신규),
`.claude/hooks/_lib/review_guard.py`, `.claude/hooks/guard_review_before_push.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`,
`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`,
테스트 2건(`test_block_integrity.py`, `test_retry_state_shared.py`), `.claude/tests/README.md`,
`plan/in-progress/harness-review-gate-ci-backstop.md`.

전부 `codebase/**` 밖의 **harness 자체 자동화 코드**(로컬 git 훅 + orchestrator CLI + 테스트)이며,
웹 서비스·DB·인증 세션이 없다. 실제 diff(`git diff origin/main...HEAD`)는 다음 세 종류뿐이다:

1. 5개 orchestrator가 각자 들고 있던 `_load_state`/`_save_state`/`_reconcile_state_with_disk`/
   `_apply_status_update`/`_emit_summary_state` 를 `_shared/retry_state.py` 로 이관(기계적 위임, 로직 불변).
2. `consistency-summary.md` §요약 지침 3(하향 금지) 위반을 사후 탐지하는 신규 backstop
   (`_shared/block_integrity.py`) — SUMMARY의 `BLOCK:` 판정과 각 checker 리포트의 `[CRITICAL]`
   태그 수를 대조해 모순이면 **경고**(차단 아님)를 만든다.
3. 그 경고를 `ReviewDecision.notes` / `outcome.notes` 로 실어 push 훅의 올바른 스트림
   (exit 0→stdout, exit 2→stderr)까지 배선.

## 발견사항

이 diff 범위에서 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다. 점검한 8개 관점 결과:

- **인젝션(SQL/XSS/커맨드/경로탐색)**: 해당 없음. `subprocess.run` 호출은 diff 범위에 신규로
  추가된 것이 없고(모두 기존 `_git`/`_run_git` 래퍼 재사용), 전부 `shell=True` 없이 리스트 인자로
  호출된다. `shell=True`/`os.system`/`eval`/`exec`/`pickle` 은 대상 7개 파일 전체에서 0건(grep 확인).
  경로는 `session_dir`/`repo_root` 기준 `os.path.join` 으로만 구성되고 `os.walk` 결과에 한정되어
  탈출 여지가 없다.
- **하드코딩된 시크릿**: 0건. API 키/비밀번호/토큰/인증서 패턴 grep 결과 실제 매치 없음
  (`_IMPL_DONE_MODE_TOKEN = "--impl-done"` 과 "secret-store" 문서명 언급은 오탐).
- **인증/인가**: 해당 없음(로컬 CLI, 세션·사용자 개념 없음). 다만 이 harness 자체가 "push 전
  리뷰 완료" 를 강제하는 보안 게이트(`guard_review_before_push.py`)이므로 §5 참고.
- **입력 검증**: CLI 인자는 신뢰된 오케스트레이팅 세션(main Claude)만 채우는 경로이고, 이번
  diff 는 그 검증 로직을 변경하지 않았다(상태 파일 I/O 만 이관).
- **암호화**: 해당 코드 없음(해시/암호화 알고리즘 미사용).
- **에러 처리**: `OSError`/`ValueError` 를 좁게 잡아 값(`""`, `{}`, `None`) 으로 폴백하며,
  민감정보 노출 경로 없음. `traceback.print_exc(file=sys.stderr)` 는 로컬 stderr 로만 가며,
  이 harness 는 외부 사용자에게 노출되는 서비스가 아니므로 스택트레이스 노출이 정보 유출로
  이어지는 통상적 시나리오(예: SSRF 에러가 외부에 노출되는 경우)와 다르다.
- **의존성 보안**: 신규 표준 라이브러리 외 의존성 없음(`json`/`os`/`re`/`subprocess`/`sys`/
  `time`/`dataclasses`/`datetime`) — harness Python "zero third-party dependency" 컨벤션 유지.
- **OWASP Top 10 잔여 항목**: 네트워크 호출 0건(`urllib`/`requests`/`socket` 등 grep 0건) —
  SSRF/원격 인젝션류는 이 코드 경로에 적용되지 않는다.

### 참고용 관찰(비차단, INFO)

- **[INFO]** `review_guard.py` 가 신규 모듈 `_shared/block_integrity` 를 로컬
  `try/except` 없이 import 한다.
  - 위치: `.claude/hooks/_lib/review_guard.py:131` (`from _shared import block_integrity as _block_integrity`)
  - 상세: 같은 파일 118~127행 주석이 이미 명시하듯, 이 import 가 실패하면(예: `block_integrity.py`
    에 구문 오류) `review_guard` 모듈 전체 로드가 실패하고 두 호출자(`guard_review_before_push.py`,
    `guard_review_before_stop.py`)가 `evaluate_review = None` 으로 폴백해 push REVIEW 게이트
    (하드 블로커) 전체가 fail-open 된다. 즉 신규 모듈 하나가 보안 게이트의 단일 실패점(SPOF)
    표면을 넓힌다.
  - 완화 근거: 이 fail-open 은 조용하지 않다 — `guard_review_before_push.py` 의
    `_report_fail_open`/§E 관측 정책이 REVIEW 게이트가 답하지 못했음을 카운트하고 배너로
    알린다(`.claude/state/push_guard_failopen.json`, 3회 연속 시 경고 강화). 설계상 의도된
    fail-open 이며 이번 diff 가 그 정책을 약화시키지 않는다. 제안 수준: `block_integrity.py`
    는 순수 함수(정규식/파일읽기)만 담아 실패 표면이 작고, 이미 `test_block_integrity.py` 로
    회귀 보호되어 있어 추가 조치 불필요 — 기록 목적의 관찰.

- **[INFO]** 신규 경고 문자열(`contradiction_note`, `_shared/block_integrity.py:121-131`)이
  push 훅의 stdout(allow 경로)으로 흘러 모델 컨텍스트에 주입된다(`guard_review_before_push.py`
  의 `_report_notes` 신규 함수, `_evaluate_over_targets` 의 notes 병합 로직).
  - 확인 사항: 주입되는 문자열은 고정 한국어 문구 + `ALL_CHECKERS` 고정 목록에서 나온 체커명
    + `count_critical_tags` 가 반환하는 정수뿐이다(`.claude/_shared/block_integrity.py`
    함수 `contradiction_note`). 체커 리포트(`*.md`)의 자유 텍스트 본문은 카운트만 추출되고
    그대로 삽입되지 않으므로, 리포트 내용이 오염되어도(예: 손상된 sub-agent 출력) 프롬프트
    인젝션으로 이어지는 경로가 없다. 문제 없음 — 설계가 올바르게 격리하고 있음을 확인한
    기록.

## 요약

이번 변경은 제품 코드(`codebase/**`)를 전혀 건드리지 않는 harness 내부 자동화(리뷰 게이트
훅 + orchestrator CLI)이며, 실질 diff 는 (1) 5개 오케스트레이터에 중복되던 상태 관리 함수를
`_shared/retry_state.py` 로 이관하는 기계적 리팩터, (2) "Critical 하향 금지" 정책 위반을
사후 탐지해 **경고만 하는**(차단 아님) 신규 backstop 추가, (3) 그 경고를 올바른 stdout/stderr
경로로 배선하는 작업이다. 신규 subprocess 호출·네트워크 호출·시크릿·암호화 변경이 없고, 모든
git 호출은 기존과 동일하게 리스트 인자 기반(셸 인젝션 불가)이며, 새로 추가된 경고 문자열은
체커 리포트의 자유 텍스트를 그대로 삽입하지 않고 고정 문구+정수만 사용해 프롬프트 인젝션
경로를 만들지 않는다. 유일하게 기록할 가치가 있는 점은 `review_guard.py` 가 신규 모듈을
비보호 import 로 추가해 push 게이트의 fail-open 표면이 미세하게 넓어졌다는 것인데, 이는 이미
관측/카운트되는 기존 §E fail-open 정책으로 완화되어 있어 조치가 필요한 결함은 아니다.
CRITICAL/WARNING 급 발견사항 없음.

## 위험도

LOW
