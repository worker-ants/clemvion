# 동시성(Concurrency) Review

## 발견사항

- **[WARNING]** CI 백스톱의 `evaluate_review()` 호출부가 "in-flight 유예"를 opt-in 하지 않는다는 불변식을 지키는 회귀 테스트가 없다 — 이 저장소가 이미 한 번 이 정확한 클래스로 실패했던 자리인데, 새 세 번째 호출부는 무방비다.
  - 위치: `scripts/check-review-gate.py:90` (`decision = evaluate(root)`) — 부재한 테스트는 `.claude/tests/test_review_gate_ci.py` 의 `ReviewGateCliTest` 클래스 전체(게이트 39~173행).
  - 상세:
    `.claude/hooks/_lib/review_guard.py` (본 diff 밖, 참조용으로 Read 확인) 의 `evaluate_review(cwd=None, *, in_flight_ok=False)` 는 `in_flight_ok=True` 일 때만 `_code_review_in_flight()` 를 상담해 "started, SUMMARY pending" 세션이 있으면 **차단하지 않는다** — 그 함수 자체의 docstring 이 "It exists for ONE caller — the Stop nudge" 라고 명시하고, `evaluate_review` 쪽 주석도 "Gated on `in_flight_ok` so this stays a Stop-nudge concession"이라고 적어 뒀다. 이는 우연한 설계가 아니라 **plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md` §관측(2))가 기록한, 이미 한 번 실제로 발생했던 결함의 재발 방지선**이다: 과거엔 이 억제가 무조건 적용돼 push 가드까지 30분간 열어 준 적이 있고, "opt-in 화" 로 고쳤다.
    `scripts/check-review-gate.py:90` 은 `evaluate(root)` 를 `in_flight_ok` 없이 호출해 현재는 **정확히 기본값(`False`, 즉 push 와 동일한 하드게이트 시맨틱)에 의존**한다 — 오늘 시점 코드는 맞다. 그런데 `.claude/tests/test_review_gate_ci.py` 의 `ReviewGateCliTest` 6개 테스트 중 4개가 실제(비-스텁) `review_guard.py` 를 그대로 복사해 쓰지만, "세션 디렉토리에 `meta.json` 은 있고 `SUMMARY.md` 는 아직 없는" **바로 그 중간 상태**— `in_flight_ok` 값이 실제로 결과를 가르는 유일한 상태 — 를 한 번도 구성하지 않는다(테스트는 "세션 없음" 아니면 "SUMMARY.md + RESOLUTION.md 둘 다 있는 완전 해소" 만 다룬다). 나머지 2개는 `review_guard.py` 를 통째로 스텁으로 교체하며, 그 스텁들(`_R`/`_D`) 은 `in_flight_ok` 인자의 **값**을 아예 참조하지 않는다(시그니처만 맞춰 받아서 버린다). 즉 13개 테스트 중 어느 것도 `evaluate(root)` 호출이 `evaluate(root, in_flight_ok=True)` 로 바뀌는 회귀를 잡아내지 못한다.
    **실측으로 확인**: 실제 저장소의 `.claude/hooks`/`_shared` 를 그대로 복사한 격리 임시 git repo 를 만들어 (a) 세션 디렉토리 없이 실행 → `review-gate: 미커버`, exit 1 (기존 테스트와 일치). (b) `review/code/<오늘 타임스탬프>/meta.json` 만 있고 `SUMMARY.md` 는 없는 디렉토리를 커밋한 뒤 **실제(수정 안 한) 스크립트**로 재실행 → 여전히 `review-gate: 미커버`, exit 1 (오늘 코드가 맞다는 것을 확인). (c) 저장소에 커밋된 파일은 전혀 건드리지 않고 스크래치 영역에만 존재하는 **사본**을 만들어 90행 한 줄만 `evaluate(root, in_flight_ok=True)` 로 바꾼 뒤 **동일한** repo 상태로 재실행 → `review-gate: 통과 — a code review session is in flight (started, SUMMARY pending) — allowed`, exit 0. 즉 실제 리뷰 내용이 전무한 상태에서 `meta.json` 하나만 있는(타임스탬프만 최근이면 됨) 디렉토리를 커밋하는 것만으로 이 백스톱을 무력화할 수 있는 코드 변경이 가능하고, 그 변경은 현재 테스트 스위트를 통과한다. (원본 `scripts/check-review-gate.py` 는 `git status`/`diff` 로 무변경임을 재확인했다 — 사본에서만 실험함.)
    plan 문서는 `--enforce` 전환을 "실데이터가 쌓이면 결정" 이라는 명시적 다음 단계로 남겨 뒀다 — 그 시점에 이 회귀가 조용히 들어와도 스위트는 계속 초록일 것이다.
  - 제안: `ReviewGateCliTest` 에 "meta.json 만 있고 SUMMARY.md 는 없는, 신선한 타임스탬프의 세션 디렉토리를 커밋 → `--enforce` 에서도 여전히 미커버/exit 1" 을 고정하는 테스트를 추가할 것 (기존 `test_a_resolved_review_lets_the_branch_through` 가 "완전 해소" 케이스를 구성하는 것과 대칭). 이 파일이 이미 채택한 "단어가 아니라 연산을 본다"(`OneJudgeTest`) 관례를 따라, `evaluate` 호출부에 `in_flight_ok=True` 키워드가 실려 있지 않음을 AST 로 고정하는 방법도 대안.

- **[INFO]** 신규 `review-gate.yml` 의 `concurrency:` 중복실행 방지 설정(리소스 풀링)에 대응하는 회귀 테스트가 없다.
  - 위치: `.github/workflows/review-gate.yml:33-35` (`group: review-gate-${{ github.ref }}` / `cancel-in-progress: true`).
  - 상세: 같은 파일의 다른 배선 성질들(스크립트 실행, dependabot 면제, `fetch-depth: 0`, 트리거 paths, 관측 모드 유지)은 각각 `WorkflowWiringTest` 의 개별 테스트가 텍스트 포함 여부로 고정하는데, `concurrency:` 블록만 어떤 테스트도 참조하지 않는다. 이 키가 나중에 실수로 삭제돼도 정확성에는 영향이 없다(각 실행은 자기 SHA 기준으로 여전히 올바른 판정을 낸다) — 다만 같은 PR 에 짧은 간격으로 여러 커밋이 밀리면 오래된 실행이 취소되지 않고 쌓여 러너 큐/시간을 낭비하게 된다. `harness-checks.yml` 은 기존에 이미 동일 패턴(`harness-checks-${{ github.ref }}`)을 갖고 있고 이번 diff 는 그 블록을 건드리지 않았다(diff 확인: `paths:` 목록에 한 줄만 추가) — 두 워크플로가 그룹 키를 워크플로 이름으로 분리해 서로 취소하지 않는 점도 올바르다.
  - 제안: 낮은 우선순위. 굳이 고정하려면 `WorkflowWiringTest` 에 `assertIn("cancel-in-progress: true", self.code)` 한 줄 추가로 충분.

## 검증한 것과 방법

- 6개 파일(README, 신규 테스트, 두 워크플로 yml, plan 문서, 신규 스크립트) 전체를 완독. 스레드/락/뮤텍스/세마포어/async/await/큐 관련 키워드를 6개 파일에 grep — "block(ed)" 부분 문자열 오탐 외에는 없음(스크립트는 동기·단일 프로세스, 부수효과 없이 읽기만 하고 print 후 exit).
- `git show f2896147b --stat` 로 이 diff 가 실제로 건드린 파일·라인 수를 원본과 대조(README +1, 신규 테스트 269줄, `harness-checks.yml` +3, 신규 `review-gate.yml` 62줄, plan +46/-8, 신규 스크립트 120줄) — 프롬프트 번들과 일치 확인.
- `git show f2896147b -- .github/workflows/*.yml` 로 `harness-checks.yml` 의 `concurrency:` 블록이 이 diff 이전부터 있던 미변경 컨텍스트임을, `review-gate.yml` 의 것은 신규 파일의 일부이되 기존 패턴을 그대로 따름을 확인.
- `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v` 실제 실행 — 13/13 통과, 1.9초. 행(hang)·데드락 징후 없음.
- `.claude/hooks/_lib/review_guard.py` 를 Read/grep 해 `evaluate_review`/`_code_review_in_flight`/`_IN_FLIGHT_TTL_SECONDS` 의 실제 시그니처·불변식을 확인하고, 저장소 전체에서 `evaluate_review(` 호출부를 grep 해 실제 호출자가 (push=기본값 의존, stop=명시 `True`, 이번 CI=기본값 의존) 셋뿐임을 확인.
- 격리된 스크래치 git repo(`/private/tmp/.../scratchpad/concurrency_probe_ci_backstop/root`, 프로젝트 밖) 를 만들어 실제 `.claude/hooks`+`_shared` 를 복사해 넣고, 미검토 브랜치 → 세션 없음 → in-flight 세션(메타만 있고 SUMMARY 없음, 오늘 타임스탬프) 순서로 커밋하며 (a) 원본 스크립트 그대로, (b) 90행만 `in_flight_ok=True` 로 바꾼 **스크래치 전용 사본**(추적 파일 무변경, `git status`/`diff` 로 재확인)을 각각 실행해 exit 1→1→0 전이를 실측. 이 저장소의 추적 파일은 건드리지 않았다(작업 트리 `git status --short` 로 재확인).

## 요약

이 diff 자체(GitHub Actions 워크플로 2개, 관측 전용 단일 프로세스 CLI 스크립트, subprocess 로 구동되는 hermetic 테스트, 문서)에는 스레드·락·async/await·커넥션 풀 같은 전형적 동시성 프리미티브가 없고, GH Actions `concurrency:` 그룹(워크플로별로 분리된 키 + `cancel-in-progress: true`)은 올바르게 구성돼 있다. 다만 이 백스톱이 위임하는 `evaluate_review()` 는 "리뷰 세션이 시작됐지만 아직 안 끝난" 비동기 윈도우를 다루는 `in_flight_ok` 스위치를 갖고 있고, 이 저장소는 그 스위치를 무조건 적용해 push 게이트까지 새는 사고를 이미 한 번 겪었다 — 그 교훈으로 opt-in 으로 고쳐졌다. 이번에 추가된 세 번째 호출부(`scripts/check-review-gate.py`)는 **오늘은 정확히 기본값(비-opt-in)에 의존해 올바르게 동작**하지만, 그 정확성을 지키는 회귀 테스트가 없다는 것을 스크래치 환경에서 실제로 재현해 확인했다: `meta.json` 하나만 있고 실제 리뷰 내용이 없는 디렉토리를 커밋하는 것만으로 미래의 `in_flight_ok=True` 회귀가 이 백스톱을 (그리고 향후 `--enforce` 전환 후에는 실제 머지 게이트까지) 조용히 무력화할 수 있고, 현재 13개 테스트 중 어느 것도 그 회귀를 구분하지 못한다. 현재 코드에 활성 결함은 없으므로 즉시 차단 사유는 아니지만, 이미 한 번 발생한 버그 클래스의 재발 방지 테두리가 새 호출부까지 확장되지 않았다는 점은 `--enforce` 전환 전에 닫아 둘 가치가 있다.

## 위험도

LOW
