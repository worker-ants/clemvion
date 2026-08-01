# Architecture Review — harness-review-gate-ci-backstop (round 7, 재구성)

대상: `.claude/_shared/{block_integrity,retry_state}.py` 신설, `.claude/hooks/_lib/failopen_state.py` 추출,
`review_guard.py`/`guard_review_before_{push,stop}.py` 의 `evaluate_review(in_flight_ok=...)` 스코프 수정,
`consistency-summary.md`/`consistency-checker/SKILL.md` 정책 문서화, `merge_coordinator_orchestrator.py` 의
`_shared` 부분 채택, 신규 테스트 4종.

이전 라운드 changeset 이 오구성(리뷰 산출물 번들링)이었다는 컨텍스트에 따라, 프롬프트에 전문이 없는
5개 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`, `tests/README.md`)과 `test_block_integrity.py` 잘린 부분을 `Read` 로 직접
열어 전체를 검토했다.

## 발견사항

- **[WARNING]** `evaluate_review()` 가 boolean 플래그 하나로 서로 다른 두 보증 수준(push 의 hard block vs
  stop 의 soft nudge 억제)을 전환한다 — 바로 이 설계가 이번 라운드에 고친 실제 버그(억제가 무조건 적용되어
  push 게이트가 30분간 열림)의 근본 원인이다.
  - 위치: `.claude/hooks/_lib/review_guard.py:906-921` (`evaluate_review(cwd=None, *, in_flight_ok=False)`),
    호출부 `.claude/hooks/guard_review_before_stop.py:350` (`in_flight_ok=True`)
  - 상세: 지금은 안전한 기본값(`False`)과 양방향 seam 테스트로 봉쇄돼 있지만, 이는 "현재 호출부가
    2개뿐이라 사고가 안 나는" 상태이지 인터페이스 자체가 안전해진 것은 아니다. 세 번째 호출부가 생기면
    다시 "기본값이 맞는 방향인가"에 의존하게 된다 — 정확히 `plan/in-progress/harness-review-gate-ci-backstop.md`
    항목 5 가 지적한 지점이며, 이번 수정은 그 근본 설계는 그대로 두고 증상만 봉합했다.
  - 제안: plan 문서가 이미 제안한 대로 `evaluate_review_for_push()` / `evaluate_review_for_stop()` 얇은
    wrapper 로 분리해, 호출부가 "옵션을 깜빡 잊는" 실수가 아니라 "어떤 함수를 부르는가"로 강제되게 한다.

- **[WARNING]** gate 판정 객체의 `push_blocks` 계약이 순수 duck-typing 이고 formal `Protocol`/ABC 가 없다 —
  동일한 결함(테스트 더블에 이 프로퍼티 누락)이 이미 최소 2개 파일에서 반복 발생했다.
  - 위치: `.claude/hooks/_lib/review_guard.py:174-195` (`ReviewDecision`, `push_blocks` property),
    범용 소비부 `.claude/hooks/guard_review_before_push.py:809-873` (`_evaluate_over_targets`),
    사후 방어 테스트 `.claude/tests/test_block_integrity.py:416-459` (`PlanStubsMirrorTheRealInterfaceTest`)
  - 상세: `_evaluate_over_targets` 는 `ReviewDecision`/`PlanDecision` 을 `result.push_blocks` 로만 다형적으로
    다룬다(좋은 설계 방향). 그런데 이 계약을 코드로 명시한 곳이 없어, 손으로 짠 `evaluate_plan` 스텁이
    `push_blocks` 를 빠뜨리면 `AttributeError`→최상위 `except`→fail-open(exit 0) 으로 조용히 새고, 테스트는
    "잘못된 이유로" 통과했다(`test_block_integrity.py` 자체 docstring 이 이 사고를 2회로 기록). 그 대응책이
    다른 테스트 파일의 소스 문자열 리터럴을 `ast` 로 파싱해 `push_blocks` 포함 여부를 확인하는 메타테스트인데,
    이는 타입 시스템이 정적으로 풀 문제를 텍스트 검사로 우회한 것이다.
  - 제안: `typing.Protocol` 로 `class PushGateDecision(Protocol): push_blocks: bool` 을 선언하고 두 Decision
    클래스가 이를 만족함을 타입 체크(또는 최소 `isinstance`/`hasattr` 어서션 헬퍼 하나)로 강제한다. 그러면
    `test_every_plan_stub_defines_push_blocks` 류의 ast 기반 메타테스트가 불필요해진다.

- **[WARNING]** `guard_review_before_stop.py` 가 `review_guard.py` 의 언더스코어(모듈-내부 컨벤션) 심볼
  3개를 직접 import — 두 파일 간 공개 표면 경계가 실질적으로 흐려져 있다.
  - 위치: `.claude/hooks/guard_review_before_stop.py:76-85`
    (`from review_guard import (_resolution_in_flight, _repo_root, _iter_summaries)`)
  - 상세: `review_guard.py` 모듈 docstring 은 "Consumed by: guard_review_before_push.py /
    guard_review_before_stop.py" 라고만 적고 공개 API 로 `evaluate_review` 만 언급한다. 그러나 실제로는
    언더스코어가 붙은 헬퍼 3개가 또 다른 파일의 정식 의존 대상이다. Python 관례상 언더스코어 prefix 는
    "이 모듈 밖에서 가져다 쓰지 말 것"을 뜻하는데, 여기서는 그 관례가 깨진 채 굳어 있어 향후 `review_guard.py`
    리팩터링 시 이 교차 의존을 놓치기 쉽다(예: 이름 변경, 시그니처 변경).
  - 제안: 이름에서 언더스코어를 빼 의도적 공개임을 표시하거나, 이번 라운드에 `failopen_state.py` 를 뽑아낸
    것과 같은 방식으로 "resolution-in-flight 판정" 을 별도 공유 모듈로 승격해 두 파일이 공식 API 를 통해서만
    만나게 한다.

- **[WARNING]** `merge_coordinator_orchestrator.py` 가 `_shared/retry_state.py` 추상화를 불완전하게
  채택했다 — 세 소비자(code-review, consistency, merge) 중 이 파일만 자가치유(reconcile)가 빠져 있다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85-97`
    (`_emit_summary_state` 를 공유 콜백 없이 손으로 재구현), `:100-123` (코드 자신의 주석이 누락을 인정)
  - 상세: `code_review_orchestrator.py`/`consistency_orchestrator.py` 는 `--resume`/`--summary-state` 에서
    `_reconcile_state_with_disk` 를 호출해, `_retry_state.json` 이 prepare 시점 스냅샷에 멈춘 채 SUMMARY 가
    실제 성공을 보고하는 모순(이 저장소가 이미 실측/수정한 버그 클래스)을 스스로 치유한다. merge 쪽은 이
    호출이 아예 없다. 게다가 `_emit_summary_state` 는 공유 함수의 `extra_fields` 콜백 패턴(정확히 이런
    `branches=N base=X` 류 추가 필드를 위해 설계됨)을 쓰지 않고 `last_reset` null 처리 로직까지 손으로
    재구현했다 — 필드 순서를 맞춰보면 `extra_fields=lambda state: {"branches": ..., "base": ...}` 로 그대로
    대체 가능해 보인다.
  - 제안: `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9 가 이미 별도 PR 로 등재했으므로 그
    범위 분리 판단 자체는 타당하다. 다만 착수 시 `reconcile_state_with_disk` 위임 추가와
    `_emit_summary_state` 의 콜백 전환을 한 번에 처리할 것.

- **[WARNING]** advisory `notes` 재출력 정책이 push 훅과 stop 훅 사이에서 비대칭이고, 그 비대칭에 대한
  근거 주석이 없다 — 이 코드베이스의 다른 모든 유사 비대칭은 예외 없이 근거가 주석으로 박혀 있다.
  - 위치: stop 훅의 digest 기반 throttle `.claude/hooks/guard_review_before_stop.py:380-386`, push 훅의
    무제한 재출력 `.claude/hooks/guard_review_before_push.py:733-750` (`_report_notes`)
  - 상세: stop 훅은 "동일 세션·동일 branch 에서 같은 note 는 한 번만" 이라는 규칙을 일부러 넣었다
    (`_lib/failopen_state.py` 와 이 파일 곳곳의 "언제나 울리는 경고는 아무도 읽지 않는다" 서술과 일치).
    반면 push 훅의 `_report_notes` 는 어떤 throttle 도 없어, 해소되지 않은 채 "채택된" 세션이 남아있는 한
    매 `git push` 마다 동일 note 를 다시 찍는다 — 이 PR 자신의 이력(같은 브랜치가 7라운드 넘게 push 됨)이
    바로 그 반복 조건을 만족하는 사례다. 의도적 차이일 수도 있으나(“push 는 stop 보다 드물어 매번 상기시켜도
    된다”), 그런 근거를 명시한 주석이 이 파일에 없다 — 다른 모든 비대칭 결정에는 예외 없이 있다는 점에서
    이례적이다.
  - 제안: 의도적이면 그 근거를 `_report_notes` 옆에 한 줄로 남기고, 아니라면 stop 훅과 동일한 digest 기반
    marker 파일로 push 쪽도 throttle 한다.

- **[WARNING]** `build_files_section()` 하나의 함수(~200줄)가 예산 렌더링 전략 3가지(무예산 / 헤더+diff
  초과로 콘텐츠 전면 생략 / 파일별 콘텐츠 배분+환불)를 모두 담당 — 이 구조 자체가 라운드마다 다른 분기에서
  재발하는 CRITICAL 결함 계열의 근본 원인으로 이미 자체 진단돼 있다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:509-709`
  - 상세: 세 분기 모두 "안내문 길이도 예산에 포함시켜야 한다"는 같은 불변식을 각자 손으로 구현한다.
    `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 3 은 정확히 이 구조를 "3R CRITICAL 이 정확히
    이 구조에서 재발했다(한 경로를 고쳤는데 다른 경로에서 같은 클래스가 다시 나옴)"고 기록했고, 항목 1 은
    두 번째 분기(헤더+diff 초과 분기)에 계상 누락이 아직 남아있음을 실측(1,681자 vs cap 1,500)으로 확인했다
    — 이번 라운드가 만들거나 악화시킨 결함은 아니지만, 근본 구조는 그대로다.
  - 제안: plan 문서가 이미 제안한 `_render_unbounded` / `_render_diff_only_overflow` /
    `_allocate_content_budget` 분리 + `_charge_notice` 단일 경유를 후속 라운드에서 실제로 착수할 것을 권장.

- **[INFO]** `review_guard.py` 가 매 라운드 새 관심사를 흡수하며 1,017줄까지 성장했다 — git plumbing,
  checkout/rebase-면역 시계, forced-coverage, spec glob 컴파일, resolution-in-flight, Gate1/Gate2 판정이
  전부 한 모듈에 있다.
  - 위치: `.claude/hooks/_lib/review_guard.py` (전체)
  - 상세: 모든 함수가 "이 브랜치의 코드가 충분히 검토됐는가"라는 하나의 질문에 기여하므로 응집도 자체는
    아직 나쁘지 않다. 다만 이번 라운드도 `_shared/block_integrity` 연동(notes 수집)을 이 모듈에 추가로
    얹었고, plan 문서 항목 5(제3의 evaluate_review 호출부 대비)까지 감안하면 다음 확장이 또 이 파일에
    쌓일 가능성이 높다.
  - 제안: 지금 당장 급하지는 않으나, 다음 실질적 확장(제3 게이트 또는 제3 호출부) 시점에는
    `review_guard/` 패키지로 쪼개 `evaluate_review()` 를 얇은 파사드로 남기는 방안을 검토할 것.

- **[INFO]** `_retry_state.json` 을 읽는 경로가 두 갈래로 남아 있다 — CLI 용 hard-fail 리더와 게이트용
  fail-open 리더.
  - 위치: `.claude/_shared/retry_state.py:41-47` (`load_state`, 파일 없으면 `sys.exit(1)`) vs
    `.claude/hooks/_lib/review_guard.py:417-452` (`_forced_coverage_missing`, 자체 `open()`/`json.load()` +
    `except (OSError, ValueError): return []`)
  - 상세: 두 실패 시맨틱(하드 실패 vs fail-open)이 실제로 다르기 때문에 하나로 합치기 어렵다는 점은
    타당하다. 다만 이는 이번 라운드가 다른 곳에서 없애려던 "Change both" 중복 클래스의 축소판이 스키마
    읽기 지점에 그대로 남아있다는 뜻이기도 하다 — `_retry_state.json` 스키마가 바뀌면 두 곳을 손으로 함께
    고쳐야 한다.
  - 제안: 지금 고칠 필요는 없음. 스키마 필드가 늘어날 때 이 이중 리더를 함께 기억하라는 주석을 `retry_state.py`
    쪽에 남겨두는 정도로 충분.

- **[INFO]** `_lib` 패키지 이름이 `.claude/hooks/`, `.claude/skills/`, `.claude/workflows/` 세 곳에 중복
  존재 — 이번 라운드는 이를 피해 `_shared` 라는 새 최상위 이름을 도입한 좋은 판단을 보여준다.
  - 위치: `.claude/hooks/_lib/`, `.claude/skills/_lib/`, `.claude/_shared/__init__.py` (설계 근거를 스스로 서술)
  - 상세: `.claude/_shared/__init__.py` 는 "hooks/_lib 와 skills/_lib 가 이미 같은 인터프리터에서 서로를
    가린다(테스트 프로세스만 그렇고, 운영 hook/orchestrator 는 별도 프로세스라 실질 충돌은 없다) — 그래서
    세 번째 `_lib` 대신 세 번째 최상위 패키지로 만든다"고 명시적으로 밝히고 있다. 실제로 두 `_lib` 는
    독립적인 `__init__.py` 를 가진 서로 다른 패키지이며, 이 충돌 자체는 `plan/in-progress/
    harness-review-gate-ci-backstop.md` 의 "신규 후속 (defer)" 항목으로 이미 추적 중이다(실코드 공유는
    이 네임스페이스 충돌 해소가 선행돼야 한다고 명시).
  - 제안: 지금 조치 불필요 — 현재 영향은 테스트 프로세스 내 in-process import 시도로 국한되고, 이미
    subprocess 기반 우회(`_harness.load_module_by_path`, 각 테스트의 fresh-interpreter 패턴)로 봉쇄돼 있다.
    다만 다음에 hooks↔skills 간 실질적 코드 공유가 필요해지면 이 충돌부터 해소해야 한다는 점을 상기.

## 요약

이번 라운드의 신규 산출물(`_shared/block_integrity.py`, `_shared/retry_state.py`, `hooks/_lib/failopen_state.py`
추출, `evaluate_review(in_flight_ok=...)` 옵트인 전환)은 아키텍처 관점에서 대체로 견고하다: AST 비교로
진짜 중복만 추출했고, 콜백 기반 확장점(`emit_summary_state`)으로 OCP 를 지켰으며, `_shared` 가 `_lib`
네임스페이스 충돌을 스스로 인지하고 피해가는 판단도 좋다. `_shared/block_integrity.py` 가 checker 목록을
`skills/` 쪽으로 역참조하지 않고 테스트로 동등성만 확인하는 것도 의존성 방향(하위 계층이 상위를 참조하지
않음) 원칙을 지킨 사례다. 다만 이 라운드가 고친 실제 버그(`in_flight_ok` 무조건 적용)의 근본 원인인
"boolean 플래그로 두 보증 수준을 스위칭"하는 인터페이스 설계는 증상만 봉합된 채 남아 있고, gate 판정
객체의 `push_blocks` 계약은 여전히 순수 관례(duck typing)이며 실제로 반복 인시던트를 낸 전력이 있다.
`guard_review_before_stop.py` 가 `review_guard.py` 의 비공개 심볼을 직접 가져다 쓰는 것, `merge_coordinator_
orchestrator.py` 가 공유 상태 추상화를 부분 채택에 그친 것, push/stop 훅 사이 advisory 재출력 정책의 비대칭은
모두 실질적인 구조적 결함이지만 각각 영향 범위가 제한적이고(전자 둘은 이미 plan 문서에 후속 항목으로
추적 중), 이번 changeset 을 막을 사유는 되지 않는다. `code_review_orchestrator.build_files_section()` 의
3-전략 monolith 는 팀 스스로 여러 라운드에 걸쳐 재발한 CRITICAL 결함의 구조적 원인으로 진단해 둔 상태이며,
이번 라운드가 만들거나 악화시키지 않았다.

## 위험도
LOW
