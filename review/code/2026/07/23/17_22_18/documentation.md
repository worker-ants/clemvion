# 문서화(Documentation) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_guard_review_before_push_main.py`, `plan/in-progress/harness-guard-followups.md` (+ 이전 리뷰 라운드 산출물 `review/code/2026/07/23/16_55_04/**` 신규 커밋)

## 사전 확인 — 이전 라운드 CRITICAL/WARNING 은 이미 해소됨

이번 diff 는 `16_55_04` 리뷰의 RESOLUTION(같은 세션 `RESOLUTION.md`)이 반영된 **이후** 상태다. 실제 파일을 직접 열어 확인한 결과:

- CRITICAL(`__main__` 블록 중복) — 해소됨. 현재 `guard_review_before_push.py`는 559-560행에 블록이 **한 번만** 존재.
- WARNING(모듈 docstring 이 fail-open 관측 정책 미언급) — 해소됨. 10-33행에 "Fail-open is OBSERVED, not silent…" 문단 추가됨.
- WARNING(plan 최상위 체크리스트 E 미동기화) — 해소됨. `harness-guard-followups.md:336`이 `- [x] E — … 구현 완료`로 갱신됨.
- INFO(`_FAILOPEN_ESCALATE_AT` 근거 주석, `_state_path`/`_read_streak`/`_write_streak` docstring) — 모두 반영됨.

이 항목들은 재-flag 하지 않는다. 아래는 이번 라운드에서 **새로** 발견한 것들이다.

## 발견사항

- **[WARNING]** plan §E 구현 노트의 "테스트 7건" 서술이 RESOLUTION 이후 stale — 실제로는 12건
  - 위치: `plan/in-progress/harness-guard-followups.md:237` (및 :239 뮤턴트 서술)
  - 상세: git 이력으로 직접 확인 — 최초 구현 커밋 `635874d5f`는 정확히 7개 테스트(`test_import_failure_is_announced_and_counted` 외 6개)를 추가했고, 그 시점엔 §E 본문의 "테스트 7건" 서술이 정확했다. 그런데 바로 다음 커밋 `2a94de331`(이번 세션의 RESOLUTION 반영, W2/W3/W6/W7 대응)이 `test_both_gates_degraded_counts_once_and_names_both`, `test_bypassing_an_actually_broken_gate_is_still_not_counted`, `test_bypass_does_not_clear_an_existing_streak`, `test_non_push_does_not_clear_an_existing_streak`, `test_detection_failure_is_observed_not_just_swallowed` 5개를 추가로 넣어(총 12건, `grep -c "def test_" test_guard_review_before_push_main.py` = 32건 중 신규 12건) 이 PR 이 최종적으로 만든 테스트 수를 두 배 가까이 늘렸는데, plan §E 본문의 "테스트 7건(...): import 실패·evaluate 예외 각각 계수 / 연속 누적·에스컬레이션 / 정상 시 리셋 / BYPASS 미계수 / 차단 경로에서도 보고 / 쓰기 실패 무해" 목록은 이 5개 신규 카테고리(양쪽 게이트 동시 degraded / BYPASS-된-망가진-게이트 정밀 경계 / bypass 가 기존 streak 안 지움 / non-push 가 streak 안 지움 / DETECTION 예외 관측)를 전혀 언급하지 않은 채 남아 있다. 같은 맥락에서 :239 의 "비-vacuity: 보고 호출 제거 뮤턴트를 6개 중 5개가 포착" 도 RESOLUTION.md 자신의 "## 검증" 절이 명시한 두 번째 뮤턴트("DETECTION catch 제거 → 해당 테스트 포착")를 누락한 채다. 즉 RESOLUTION.md(이번 세션 산출물)는 정확한데, 그 근거가 돼야 할 plan 본문(§E, 향후 세션이 "무엇이 왜 됐는지" 참조하는 1차 출처)이 RESOLUTION 반영분을 따라가지 못한 채 구버전 스냅샷으로 멈춰 있다.
  - 제안: 237-239행을 "테스트 12건"으로 갱신하고, RESOLUTION 이 추가한 5개 카테고리(동시 이중-degraded / bypass+실제고장 경계 / bypass 비-리셋 회귀 / non-push 비-리셋 / DETECTION 예외 관측)와 두 번째 뮤턴트 결과를 목록에 반영한다.

- **[WARNING]** `.claude/tests/README.md` 테스트 카탈로그가 이번 PR 의 핵심 신규 커버리지(fail-open 관측)를 전혀 언급하지 않음
  - 위치: `.claude/tests/README.md:43` (`test_guard_review_before_push_main.py` 행)
  - 상세: 이 파일은 "## What's covered" 로 각 테스트 파일이 무엇을 검증하는지 한 줄 요약하는, repo 전역에서 참조되는 카탈로그다. 43행은 "exit 0/2, REVIEW→PLAN gate order, BYPASS_* isolation, fail-open when a gate module fails to import or its evaluate_*() raises, and malformed/empty stdin"만 서술하는데, 이는 이번 diff **이전**부터 있던 커버리지 서술 그대로다. 이번 PR 이 추가한 관측 기능(fail-open 발생 시 stderr 경고 배너, `.claude/state/push_guard_failopen.json` 연속 카운트, 3회 연속 에스컬레이션, 정상 판정 시 리셋, BYPASS 는 계수/리셋 모두에서 제외) — 총 32개 테스트 중 12개, 파일 크기 기준 절반 가까이 — 가 통째로 이 요약에서 빠져 있다. 같은 파일의 `test_router_safety_policy_doc.py` 행(38행)이 스스로 기록하듯, 이 저장소에는 "정책 변경 시 두 곳을 같이 갱신하라"는 의무가 문서로만 존재하고 강제되지 않아 카탈로그 표가 실제와 어긋난 채 green 으로 남았던 전례(24 vs 44 extensions drift)가 있다 — 같은 클래스의 drift 가 이번에도 반복될 조건을 갖췄다(README 내용 완전성을 검사하는 가드는 존재하지 않음, `grep -rl "tests/README" .claude/tests/*.py` 로 확인된 소비처들은 파일 목록 존재 여부만 다룸).
  - 제안: 43행에 "fail-open 발생 시 announce+streak 카운트+3회 연속 에스컬레이션(및 BYPASS 는 계수/리셋 대상 아님)" 한 구절을 추가.

- **[INFO]** 모듈 docstring 이 실제로는 한국어인 배너 문구를 영어 인용구로 paraphrase 해 리터럴처럼 보임
  - 위치: `.claude/hooks/guard_review_before_push.py:28` (docstring, `"this push was not checked"`) vs 실제 출력 `:445, 451-452` (`"⚠️ push guard: 게이트가 판정하지 못하고 통과시켰습니다"`, `"이 push 는 해당 검사를 받지 않았습니다"`)
  - 상세: 같은 docstring 이 20행에서는 실제 한국어 문구("PR 전 plan 갱신/이동")를 그대로 인용하는 관례를 쓰는데, 28행에서는 반대로 실제로 존재하지 않는 영어 문자열을 따옴표로 인용해 마치 리터럴 배너 텍스트인 것처럼 서술한다. 기능적 영향은 없지만, 영어 문자열로 grep 해 배너 출처를 찾으려는 유지보수자를 잠깐 헛돌게 할 수 있다.
  - 제안: 따옴표를 제거해 순수 paraphrase로 쓰거나("prints an explicit fail-open banner"), 실제 한국어 문구를 그대로 인용한다.

- **[INFO]** `_report_fail_open()` 이 `_Outcome` 클래스보다 먼저 정의돼, 그 필드 의미를 설명하는 docstring 을 읽기 전에 먼저 사용하는 순서로 배치됨
  - 위치: `.claude/hooks/guard_review_before_push.py:410-466` (`_report_fail_open`, `outcome.degraded`/`outcome.bypassed`/`outcome.answered` 참조) vs `:468-481` (`class _Outcome`, 세 필드의 의미를 설명하는 docstring)
  - 상세: `from __future__ import annotations` 덕에 타입 힌트가 지연 평가돼 런타임 오류는 없지만, 파일을 위에서 아래로 읽는 사람은 `degraded`/`answered`/`bypassed` 가 각각 무엇을 의미하는지 설명하는 `_Outcome` docstring 을 아직 보지 못한 채로 `_report_fail_open` 의 상세한 리셋 규칙 설명을 먼저 만나게 된다.
  - 제안: `class _Outcome`을 `_report_fail_open` (또는 최소 `_run_gates`) 위로 옮겨 어휘가 사용되기 전에 정의되도록 재배치. 기능 영향 없는 순수 가독성 개선이라 우선순위는 낮음.

## 요약

핵심 코드 변경(`guard_review_before_push.py`, 테스트, plan §E)은 직전 리뷰 라운드의 CRITICAL(entry-point 중복)·WARNING(모듈 docstring 미갱신, plan 체크리스트 미동기화) 3건을 실제로 모두 해소한 상태로 확인됐다 — 재-flag 하지 않는다. 다만 그 RESOLUTION 자체가 5개의 신규 테스트를 추가로 도입하면서, 그 근거를 서술하는 두 개의 다른 문서 표면(plan §E 본문의 "테스트 7건" 서술, `.claude/tests/README.md` 카탈로그 행)을 갱신하지 않아 새로운 stale-count/누락 갭이 생겼다. 둘 다 기능에 영향은 없지만, 이 저장소가 반복적으로 "체크리스트/카탈로그는 실제 상태를 반영해야 하며 안 그러면 다음 세션이 오판한다"는 교훈을 명시적으로 축적해 온 만큼(실제로 `test_router_safety_policy_doc.py` 자체가 이런 drift 의 실제 CRITICAL 사례를 기록하고 있다), 머지 전에 정리할 가치가 있는 WARNING 이다.

## 위험도
LOW
