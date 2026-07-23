# 보안(Security) 코드 리뷰

## 리뷰 대상
- `.claude/tests/test_guard_review_before_push_main.py` (신규, 252줄) — `guard_review_before_push.py`의 `main()` e2e 테스트
- `plan/in-progress/harness-guard-followups.md` (plan 체크박스 갱신 + 완료 서술)

두 파일 모두 **프로덕션 실행 경로(운영 코드)를 변경하지 않는다** — 대상 훅(`guard_review_before_push.py`)은 이번 diff에 포함되어 있지 않고, 신규 테스트가 그것을 실 subprocess로 구동해 검증할 뿐이다. plan 파일은 문서 갱신뿐이다.

## 발견사항

- **[INFO]** 테스트가 `evaluate_review`/`evaluate_plan` 예외 시 stderr에 `Traceback`이 노출되는 기존 fail-open 동작을 명시적으로 pin(고정)한다
  - 위치: `test_guard_review_before_push_main.py:228-234`(`test_review_evaluate_exception_fails_open_and_runs_plan`), `241-244`(`test_plan_evaluate_exception_fails_open`)
  - 상세: 두 테스트는 게이트 평가 중 예외가 발생하면 (a) push를 허용(fail-open)하고 (b) 스택 트레이스 전문을 stderr에 그대로 출력하는 것을 "정상 동작"으로 단언한다. 이는 훅 본체(`guard_review_before_push.py:127-129`, `138-140`)의 기존 `traceback.print_exc(file=sys.stderr)` 를 그대로 검증하는 것이며 이번 diff가 새로 도입한 동작은 아니다. 다만 이 stderr는 Claude 에이전트에게 그대로 전달되는 하네스 훅 출력이므로, 예외 메시지에 내부 파일 경로·모듈 구조 등이 담길 수 있다는 정보 노출 표면이 테스트로 "고정"된다는 점은 인지해 둘 필요가 있다. 이 fail-open/verbose-traceback 정책 자체는 이미 같은 커밋의 `plan/in-progress/harness-guard-followups.md` §E("REVIEW/PLAN 게이트 fail-open 정책 — 사용자/팀 판단 필요")에 별도 항목으로 명시적으로 추적되고 있어, 이번 테스트가 그 정책을 은폐하거나 새로 만드는 것은 아니다.
  - 제안: 별도 조치 불필요. §E 결정이 fail-closed 또는 "관측 가능한 fail-open"으로 바뀌면 이 두 테스트(및 `test_review_import_failure_*`, `test_both_gate_imports_fail_allows_the_push` 등 import-실패 계열)도 함께 갱신해야 한다는 점만 후속 작업 시 유의.

- **[INFO]** `BYPASS_REVIEW_GUARD` / `BYPASS_PLAN_GUARD` 우회 메커니즘의 게이트별 격리를 검증하는 테스트는 긍정적인 보안 회귀 방지책이다
  - 위치: `test_bypass_review_skips_only_the_review_gate`, `test_bypass_review_still_enforces_plan_gate`, `test_bypass_plan_skips_only_the_plan_gate`, `test_bypass_plan_still_enforces_review_gate` (라인 207-225)
  - 상세: 두 우회 플래그가 서로 다른 게이트로 "누출"되지 않는지(예: `BYPASS_REVIEW_GUARD=1`이 plan 게이트까지 무력화하지 않는지) 명시적으로 단언한다. `_run()`은 부모 셸 환경에서 두 변수를 먼저 `pop()`한 뒤 필요한 것만 주입해(`143-153`행) 테스트 환경이 우연히 세팅된 우회 변수를 오염원으로 흡수하지 않도록 방어했다. 코드 결함이 아니라 리뷰 관점에서 긍정적으로 평가할 부분.

- **[INFO]** subprocess 실행은 인젝션 표면이 없다
  - 위치: `_run()` (라인 162-165), `subprocess.run([sys.executable, self.hook], input=stdin, ...)`
  - 상세: 커맨드는 리스트 인자로 전달되고 `shell=True`가 아니므로 커맨드 인젝션 여지가 없다. stdin으로 넘어가는 값(`command`, `payload`, `raw_stdin`)은 테스트 내부에서 하드코딩된 값이거나 고정 상수(`_PUSH = "git push origin HEAD"`)이며 외부/사용자 입력이 아니다. `malformed`/`empty` stdin 케이스(라인 269-276)도 훅이 그것을 안전하게 빈 payload로 처리해 push를 허용(fail-open)하는지 검증할 뿐 인젝션과 무관하다.

- **[INFO]** 임시 디렉토리/파일 생성은 표준적이며 안전하다
  - 위치: `setUp()` (라인 124-134)
  - 상세: `tempfile.mkdtemp()`는 예측 불가능한 이름과 소유자 전용 권한(0700)으로 생성되어 심볼릭 링크/경쟁 공격에 안전하다. 여기에 쓰이는 stub 모듈(`_REVIEW_STUB`, `_PLAN_STUB`)은 정적 문자열 상수이며 외부 입력을 반영하지 않아 코드 인젝션 벡터가 아니다. `addCleanup(shutil.rmtree, ..., ignore_errors=True)`로 정리되어 잔존 파일 누적도 없다.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 상세: `STUB_REVIEW`/`STUB_PLAN`/`BYPASS_*`는 테스트 제어용 불리언성 환경변수일 뿐 API 키·비밀번호·토큰류가 아니다. 두 파일 전체에서 시크릿 패턴 없음.

- **[INFO]** plan 문서 변경(`harness-guard-followups.md`)은 순수 서술/체크박스 갱신
  - 상세: 코드 실행 경로에 영향 없음. 보안 관점 이슈 없음.

## 요약
이번 변경분은 기존 push-guard 훅(`guard_review_before_push.py`)의 동작을 바꾸지 않고, 그 `main()` 진입점(게이트 순서·BYPASS 격리·fail-open 3중 경로·stdin 파싱)을 실제 subprocess로 구동해 검증하는 e2e 테스트 20건과 관련 plan 문서 갱신으로 구성된다. subprocess 호출은 리스트 인자·비-shell 방식이라 인젝션 표면이 없고, 임시 파일/디렉토리 생성은 표준 안전 API(`tempfile.mkdtemp`)를 사용하며, 하드코딩된 시크릿도 없다. 유일하게 주목할 점은 두 테스트가 예외 발생 시 stderr에 전체 트레이스백을 노출하는 기존 fail-open 동작을 그대로 "고정"한다는 것인데, 이는 이번 PR이 새로 만든 위험이 아니라 이미 같은 plan 문서 §E에서 "사용자/팀 판단이 필요한 정책"으로 별도 추적 중인 기존 설계이며, 오히려 회귀 없이 그 계약을 문서화·고정하는 역할을 한다. 전반적으로 신규 취약점 없이 기존 보안 게이트의 정확성을 검증하는 순수 테스트 추가로 판단된다.

## 위험도
NONE
