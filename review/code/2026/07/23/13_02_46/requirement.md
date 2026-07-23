# 요구사항(Requirement) 리뷰 — `guard_review_before_push.py main()` e2e 테스트 + plan 갱신

## 검증 방법

diff 대상 두 파일(신규 테스트 20건, plan 체크박스 갱신)을 정적으로 읽는 데 그치지 않고, 실제
`.claude/hooks/guard_review_before_push.py` 를 대상으로:

1. `python3 -m unittest discover -s .claude/tests -p 'test_guard_review_before_push_main.py'` 를
   실행 — **20/20 PASS** (원본 훅 기준).
2. plan 문서가 주장하는 "뮤테이션 검증: 게이트 순서 스왑·bypass 공유·예외 미포착 3종 모두 테스트
   실패로 포착"을 신뢰하지 않고 직접 재현: 훅 파일을 `cp` 로 백업 후 (a) REVIEW/PLAN 블록 순서
   스왑, (b) `BYPASS_REVIEW_GUARD` 가 PLAN 게이트도 스킵하도록 leak 주입, (c) `evaluate_review()`
   호출부의 `try/except` 제거(예외 미포착) — 3종 모두 테스트가 즉시 실패로 포착함을 확인. 이후
   `cp` 로 원본 복원, `git status --porcelain` 으로 diff 잔존 없음 및 재실행 20/20 PASS 재확인.

## 발견사항

- **[WARNING]** plan 문서 최하단 "체크리스트" 섹션이 본문 D 항목의 완료 표시와 불일치
  - 위치: `plan/in-progress/harness-guard-followups.md` — 본문 "## D. push 훅 `main()` 무테스트"
    섹션 내부 체크박스는 이번 diff 로 `- [x]` 로 갱신되고 "→ **완료** (D PR)" 상세 서술까지
    추가됐으나, 파일 최하단 "## 체크리스트" 요약 목록의 `- [ ] D — push 훅 \`main()\` 테스트`
    (현재 파일 기준 280행)는 이번 diff 가 건드리지 않아 여전히 미완료(`[ ]`)로 남아 있음. A·F
    항목은 본문·체크리스트 양쪽 다 `[x]` 로 동기화된 것과 대비된다.
  - 상세: CLAUDE.md/메모리 규약("plan 체크박스 = 실제 상태 — 수행 후에만 체크")상 plan 문서는
    실제 상태의 단일 진실이어야 하는데, 같은 파일 안에서 본문과 요약이 서로 다른 상태를 말하고
    있다. 향후 세션이 요약만 훑고 D 를 미착수로 오판하거나, 반대로 이 PR 이후 누군가 체크리스트만
    보고 "D 미완료"라 재작업을 트리거할 위험이 있다.
  - 제안: 같은 diff 에서 체크리스트의 D 항목도 `- [x]` 로 동기화.

- **[INFO]** import 실패 시 진단(traceback) 출력의 게이트 간 비대칭이 테스트로 고정되지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:39-48` (review_guard import 실패 시에만
    `traceback.print_exc(file=sys.stderr)` 호출, plan_guard import 실패는 무진단으로 `None` 처리) vs
    신규 테스트 `test_review_import_failure_disables_only_that_gate` /
    `test_plan_import_failure_disables_only_that_gate` / `test_both_gate_imports_fail_allows_the_push`.
  - 상세: 세 테스트 모두 exit code·`(review gate)`/`(plan gate)` 문구만 단언하고, stderr 에
    Traceback 이 있는지/없는지는 단언하지 않는다. 그 결과 "review import 실패 시엔 진단이 남고
    plan import 실패 시엔 조용히 사라진다"는 기존 비대칭 동작이 앞으로 뒤집혀도(둘 다 조용해지거나
    둘 다 traceback 을 내뿜어도) 이 테스트 스위트는 감지하지 못한다. 이 비대칭은 이번 diff 가
    만든 것이 아니라 대상 파일(`guard_review_before_push.py`)의 기존 코드 특성이며, 이번 diff 는
    그 파일을 건드리지 않으므로 CRITICAL/WARNING 이 아니라 커버리지 갭에 대한 INFO 로 남김.
  - 제안: (선택) 두 import-실패 테스트에 `assertIn("Traceback", ...)` / `assertNotIn(...)` 을 추가해
    비대칭을 명시적으로 pin. 필수는 아님 — exit code 계약(진짜 회귀 대상)은 이미 충분히 커버됨.

- **[INFO]** 대상이 `spec/` 로 정의되는 제품 스펙이 아니라 `.claude/` 하네스(harness) 자체 도구 —
  spec fidelity 점검을 `.claude/docs/plan-lifecycle.md` 로 대체 수행
  - 위치: `.claude/docs/plan-lifecycle.md:48-58` (PLAN gate 서술, "review/plan 두 게이트는 서로
    독립이라 한쪽 모듈 import 실패가 다른 쪽을 침묵시키지 않는다")
  - 상세: `spec/` 에는 이 훅을 정의하는 문서가 없다(product spec 이 아닌 CI/harness 메타 도구이므로
    타당). 대신 `.claude/docs/plan-lifecycle.md` 가 사실상의 행위 명세 역할을 하며, 신규 테스트가
    검증하는 "게이트 독립성(한쪽 import 실패가 다른 쪽을 침묵시키지 않음)"·"REVIEW→PLAN 순서"·
    "BYPASS_* 게이트별 격리"는 이 문서 서술과 line-level 로 일치함(직접 재현한 뮤테이션 테스트로도
    확인). 불일치 없음.

## 기타 점검 결과 (문제 없음)

- **기능 완전성**: `main()` 의 모든 주요 분기(non-push 패스스루, `tool_input`/`input` 별칭, REVIEW→PLAN
  순서·단락, `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 게이트별 독립 우회, `evaluate_*()` 예외
  fail-open, 게이트 모듈 import 실패 fail-open, stdin malformed/빈/command-부재)가 20개 테스트로
  커버되며, 실제 훅 대상 실행에서 20/20 PASS 를 직접 확인함.
- **엣지 케이스**: 빈 stdin, malformed JSON, `command` 키 부재, `tool_input` 이 빈 dict(falsy)일 때
  `input` 키로 폴백하는 경로(`payload_without_command_allows`) 등 실제 구현의 `or` 체인 취약점을
  정확히 짚어 테스트함.
- **TODO/FIXME/HACK/XXX**: 두 파일 모두 없음.
- **의도-구현 일치**: docstring("REVIEW-then-PLAN gate order", "triple fail-open", "stdin JSON
  handling")과 실제 테스트 메서드 이름·본문이 정확히 대응.
- **에러 시나리오**: `evaluate_review`/`evaluate_plan` 예외, import 실패 두 계열 모두 별도 테스트로
  분리 검증.
- **반환값**: 모든 코드 경로(0/2)가 최소 1개 테스트에서 실제 subprocess exit code 로 단언됨.
- **plan 문서 개수 서술 정확성**: "`test_guard_review_before_push_main.py` 20건" 서술이 실제 테스트
  메서드 수(20개)와 일치.
- **뮤테이션 비-vacuity**: plan 이 주장한 3가지 뮤테이션 시나리오(게이트 순서 스왑, bypass 누출,
  예외 미포착)를 리뷰어가 독립적으로 재현 — 3종 모두 테스트 실패로 포착됨을 확인(빈 주장이 아님).

## 요약

신규 e2e 테스트(`test_guard_review_before_push_main.py`, 20건)는 실제 훅을 서브프로세스로 구동하는
견고한 설계이며, 문서(주석·plan)가 주장하는 커버리지·뮤테이션 검증 결과를 리뷰어가 직접 재실행/재현해
모두 사실로 확인했다(테스트 전체 PASS, 3종 뮤테이션 전부 포착, 뮤테이션 실험 후 원상 복구 확인).
기능적 결함은 발견되지 않았다. 유일한 실질 이슈는 plan 문서 내부 정합성 결함(WARNING) — 본문 D 항목은
완료로 갱신됐으나 최하단 요약 체크리스트는 갱신되지 않아 같은 파일 안에서 상태가 모순된다. 이는 코드
결함이 아니라 plan 문서 갱신 누락이므로 developer 가 직접 고칠 수 있는 범위(코드 아님, `plan/**` 쓰기
권한 보유)이며 spec 반영 대상도 아니다. 나머지는 INFO 수준 관찰(기존 비대칭 동작의 테스트 미고정,
spec/ 부재는 정당함)이다.

## 위험도

LOW
