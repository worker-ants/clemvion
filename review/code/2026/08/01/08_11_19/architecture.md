# Architecture Review — 8R (harness-block-backstop)

## 사전 확인 (측정, 추론 아님)

판단 전에 다음을 직접 실행/추적했다 (7R 이 "형태만 보고 판단" vs "실측"으로 갈렸던 교훈 반영):

- 잘린 5개 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
  `consistency_orchestrator.py`, `test_block_integrity.py`) 전문을 `Read` 로 직접 열어 확인.
- `git log`/`git show`로 7R 커밋(`5526fc8f8`)의 실제 diff 를 추적해, 프롬프트 서두에서 언급된
  두 결함(O(n²) 정규식, 조기 return 으로 인한 advisory 유실)이 **이미 수정되고 회귀 테스트가
  붙어 있음**을 코드 레벨에서 확인.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 실행 → **753 tests OK**
  (RESOLUTION.md 의 "753 tests OK" 주장과 실측 일치).
- `plan/in-progress/harness-review-gate-ci-backstop.md` 의 미해결 후속 항목(특히 #9, #11)이
  현재 코드에 실제로 그 형태로 남아 있는지 소스를 열어 재대조.

## 발견사항

- **[WARNING]** `code_review_orchestrator.collect_change_infos` 가 `--branch` 를 `--files` 보다
  먼저 검사하는 `if/elif` 체인이라, 둘을 함께 주면 `--files` 가 조용히 무시된다 (경고 없음).
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1229`
    (`def collect_change_infos`), 분기는 `:1248`(`elif args.branch:`)·`:1254`(`elif args.files:`).
  - 상세: 이 저장소의 표준 리뷰 절차는 "명시 파일 목록 + `--route=all`" 이고, 커밋 후에는
    `--branch <base>` 를 함께 줘야 diff base 가 맞다고 문서화되어 있다
    (`.claude/skills/consistency-checker/SKILL.md` 등 여러 곳). 그런데 정확히 그 조합
    (`--branch` + `--files`)에서 명시 목록이 통째로 폐기되고 `--branch` 쪽 diff(이 저장소는
    `review/**` 산출물도 추적하므로 대개 리뷰 산출물 파일들)로 대체된다 — 인터페이스 설계
    관점에서 "두 입력 소스가 동시에 주어졌을 때의 우선순위 계약"이 코드에 암묵적으로만
    존재하고 소비자(main Claude/사용자)에게 드러나지 않는다. `plan/in-progress/harness-review-
    gate-ci-backstop.md` 항목 #11 에 "게이트 자체를 무력화할 수 있는 결함" 으로 이미 등재돼
    있고(우선순위 "높음"), 실제로 이 PR 자신의 6R 라운드가 이 계열의 changeset 오구성으로 소스를
    한 줄도 못 본 채 "Critical 0" 을 낸 전례가 있다(같은 세션의 `docs: 6R 원인 분석 정정` 커밋).
    **아직 코드에 남아 있고 미수정**임을 직접 확인했다(같은 `if/elif` 구조가 현재도 그대로).
  - 제안: 계획서에 적힌 최소 조치(두 옵션이 함께 오면 `--files` 우선 + 무시되는 옵션을 stderr 로
    경고)를 이번 라운드 범위에 포함하거나, 최소한 plan 항목 #11 이 아직 open 임을 재확인해
    후속 라운드에서 놓치지 않게 할 것.

- **[WARNING]** `.claude/hooks/_lib/review_guard.py` 한 모듈이 서로 독립적으로 진화하는 3개 관심사
  (Gate 1 코드리뷰 커버리지, Gate 2 spec-consistency/`--impl-done` 하향 백스톱, resolution-in-
  flight 억제)를 담당하고, 두 호출부 모두 `from review_guard import evaluate_review` 를 **모듈
  전체 단위**로 한 번에 try/except 한다.
  - 위치: `.claude/hooks/_lib/review_guard.py` 전체(1,017줄) — 관심사 경계 주석은 `:568`
    (`# SPEC-CONSISTENCY gate`) 및 `:814`(`# RESOLUTION-IN-FLIGHT suppression`)에 이미 존재.
    import 지점: `.claude/hooks/guard_review_before_push.py:61-66`,
    `.claude/hooks/guard_review_before_stop.py:66-71`.
  - 상세: 이번 라운드에서 신설된 `_shared/block_integrity.py` 위임(Gate 2 안의 하향 감지)이
    바로 이 review_guard.py 안에 얹혔다. 이 모듈에서 발생하는 어떤 예외(예: 최근에 추가된
    spec glob 파싱, 하향 감지 로직의 버그)도 `evaluate_review = None` 을 만들어 Gate 1 코드리뷰
    커버리지 검사까지 **함께** fail-open 시킨다. `failopen_state` 덕분에 이 상태는 침묵하지 않고
    관측/카운트되므로 완전히 숨겨지진 않지만("이 push 는 검사받지 않았다" 배너 + 연속 횟수),
    더 신규·더 복잡한 코드(Gate 2)의 결함이 더 성숙한 코드(Gate 1)의 가용성까지 끌어내리는
    결합도는 여전하다. 이미 `review/code/2026/08/01/02_25_18/RESOLUTION.md` 의 후속 목록에
    "`review_guard.py` 1,017줄"로 크기만 지적돼 있는데, 그 크기가 문제인 실질적 이유(개별
    import 실패의 파급 범위)를 구체화한 것이다.
  - 제안: 최소한 Gate 1/Gate 2/in-flight 판정을 함수 단위로 독립 try/except 하거나(현재도
    `_evaluate_over_targets` 자체는 target 단위 fail-open 을 하므로 유사 패턴 적용 가능),
    장기적으로는 파일을 분리해 한쪽의 import 실패가 다른 쪽 게이트의 판정 능력을 자동으로
    앗아가지 않게 할 것. (이미 plan 후속 목록에 크기 문제로 등재 — 신규 조치 요구가 아니라 근거
    보강.)

- **[INFO]** `merge_coordinator_orchestrator.py` 가 `_shared/retry_state.py` 를 5개 함수 중 3개
  (`load_state`/`save_state`/`apply_status_update`)만 위임하고 `reconcile_state_with_disk` 자기
  치유는 없다 — 같은 추상화를 공유하는 3개 소비자 중 하나만 성숙도가 다르다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:91-125`
    (주석 + `_load_state`/`_save_state`/`_apply_status_update`/`_emit_summary_state` 정의부).
  - 상세: `code_review_orchestrator.py`/`consistency_orchestrator.py` 는 `emit_summary_state`
    를 통해 읽을 때마다 디스크의 리포트 파일과 자가 정합(self-heal)하지만, `merge_coordinator`
    는 `_load_state` 로 원시 상태만 읽어 `agents_pending`/`agents_success`/`agents_fatal` 을
    그대로 출력한다 — Agent tool 로 직접 fan-out 한 세션은 여기서도 여전히 prepare 시점 스냅샷에
    멈춘 채 커밋될 수 있다(다른 두 orchestrator 가 이미 고친 것과 같은 모순 클래스). 코드
    자체의 주석(`:96-100`)과 plan 문서 항목 #9 에 "별도 PR 로 분리" 라고 명시적으로 이미 추적돼
    있어 새로운 사실은 아니지만, "공유 라이브러리 도입"이 3개 소비자 전원의 동작을 자동으로
    통일하지는 않는다는 점 — 즉 추상화 경계는 올바르게 그어졌으나 채택 깊이가 소비자마다
    달라 향후 4번째 소비자가 이 얕은 패턴을 답습할 위험 — 을 보강 확인한다.
  - 제안: 계획대로 별도 PR에서 `reconcile_state_with_disk` 를 `_emit_summary_state`/`--resume`
    에도 배선. 지금 당장의 조치는 불필요(의도된 분리).

- **[INFO]** `.claude/hooks/_lib` 와 `.claude/skills/_lib` 가 같은 패키지명을 써 한 인터프리터에서
  동시 import 시 충돌하고, 이를 피하려는 `importlib.util` 우회 코드가 테스트 전반에 반복된다.
  - 위치: `.claude/tests/_harness.py:8-15`(문제 서술 + 해법), `.claude/_shared/__init__.py:7-11`
    (신설 `_shared` 가 세 번째 `_lib` 을 만들지 않기로 한 설계 근거), 실제 우회 사례는
    `.claude/tests/test_block_integrity.py` 안에서만도 `load_module_by_path`/subprocess 조합이
    5회 이상 반복(`:31-33`, `:258-260`, `:306-308`, `:430-433`, `:652-655`).
  - 상세: `_shared/` 신설 시 세 번째 `_lib` 을 만들지 않은 것은 이 충돌을 정확히 인지하고
    회피한 좋은 설계 판단이다. 다만 근본 충돌(`hooks/_lib` ↔ `skills/_lib`) 자체는 남아 있어,
    두 패키지에 걸친 코드를 같은 프로세스에서 테스트하려 할 때마다 매번 `spec_from_file_location`
    이나 subprocess 로 우회해야 한다 — plan 문서도 "git 브랜치-diff 헬퍼 중복"·"기본 브랜치
    해석 4곳 통합"의 선행 조건으로 "`_lib` 네임스페이스 충돌 해소" 를 명시하고 있어(이미 추적
    중), 실제 코드 공유를 계속 가로막는 구조적 비용임을 재확인했다.
  - 제안: 즉시 조치 불필요(설계상 우선순위 낮음으로 이미 defer). 다만 `hooks/_lib` 또는
    `skills/_lib` 중 하나를 리네임하는 근본 해소가 선행되지 않는 한, 이 클래스의 중복(브랜치 diff
    헬퍼 등)은 `_shared/` 로 계속 옮기기 어렵다는 점을 후속 판단 시 참고할 것.

- **[INFO]** `.claude/tests/test_block_integrity.py` 가 파일명이 가리키는 범위(`block_integrity.py`)
  를 넘어 최소 3개의 다른 모듈에 대한 회귀 테스트를 흡수하고 있다 — 테스트 계층의 응집도 드리프트.
  - 위치: `.claude/tests/test_block_integrity.py:416`(`NotesFromLaterTargetsSurviveAnEarlierBlockTest`
    — `guard_review_before_push.py._evaluate_over_targets` 를 직접 구동), `:470`
    (`VerdictParserStaysLinearTest` — 이건 `block_integrity.py` 소관이라 파일명과 맞음), `:520`
    (`PlanStubsMirrorTheRealInterfaceTest` — `.claude/tests/test_*.py` 전체를 스캔하는 교차-파일
    hygiene 가드, `block_integrity`·`review_guard`·`guard_review_before_push`·
    `guard_review_before_stop` 어디에도 속하지 않음).
  - 상세: 7R 리뷰가 발견한 "조기 return 이 뒤 target 의 advisory 를 유실" 결함(W19)의 회귀
    테스트 2건이 `guard_review_before_push.py` 전용 테스트 파일(`test_guard_review_before_
    push_main.py`/`test_push_guard_worktree_scope.py`)이 아니라 `test_block_integrity.py`
    에 추가됐다 — 아마 "하향 백스톱 작업 중 발견한 인접 결함이라 같은 세션/같은 커밋에서
    처리"하는 편의성 때문으로 보이나, 결과적으로 새 엔지니어가 "push 훅의 멀티 타겟 notes
    전파를 테스트하는 파일이 어디냐"를 찾을 때 `test_block_integrity.py` 를 떠올리기 어렵다.
    `PlanStubsMirrorTheRealInterfaceTest` 역시 리뷰 게이트 전반의 스텁 인터페이스 정합성을
    검사하는 교차-절단(cross-cutting) 가드라 어느 한 파일에 속한다고 보기 어렵다. plan 문서의
    기존 후속 목록에는 이 테스트-파일 조직 이슈가 명시적으로 등재돼 있지 않아 이번 라운드의
    신규 관찰이다. 기능적으로는 문제 없음(테스트는 통과하고 올바른 대상을 구동한다) — 순수
    조직/발견가능성(discoverability) 문제.
  - 제안: 급하지 않음. 다음에 이 파일을 만질 때 `NotesFromLaterTargetsSurviveAnEarlierBlockTest`
    는 `test_push_guard_worktree_scope.py` 로, `PlanStubsMirrorTheRealInterfaceTest` 는
    harness 전반의 hygiene 가드를 모으는 별도 파일(예: `test_harness_stub_hygiene.py`)로
    이동을 검토. `.claude/tests/README.md` 카탈로그 표는 이동에 맞춰 함께 갱신.

## 확인된 사항 (round 7 수정의 건전성 — 재검증)

- **O(n²) 정규식 수정**: `.claude/_shared/block_integrity.py:119-121` 의 `_BLOCK_AT_LINE_START`
  선두 문자 클래스가 `[ \t>#*_\`-]*` 로 좁혀져 있음을 직접 확인. 회귀 테스트
  `.claude/tests/test_block_integrity.py:470-517`(`VerdictParserStaysLinearTest`, 서브프로세스
  + 하드 타임아웃)가 존재하고 실행 시 통과.
- **조기 return 으로 인한 advisory 유실 수정**: `.claude/hooks/guard_review_before_push.py:841-883`
  (`_evaluate_over_targets`)이 `blocked = render(...)` 로 기억만 하고 루프를 완주하도록 바뀌어
  있고, 그 직전 docstring(`:828-839`)이 "return 은 그 자신의 notes 만 다루는 배치를 방어했을 뿐
  반대 배치(자신은 차단 안 하지만 뒤에 있는 target 의 notes)를 놓쳤었다"고 정확히 자기 결함을
  기록하고 있음을 확인. 회귀 테스트 `.claude/tests/test_block_integrity.py:416-467`
  (두 케이스: "뒤 target 의 note 가 앞 target 의 차단에도 살아남는다" / "첫 차단 target 이
  메시지를 결정한다")가 실제로 `_evaluate_over_targets` 를 구동하며 통과.
- 두 수정 모두 프롬프트가 지시한 "코멘트가 모든 배치를 커버하는가" 체크를 통과한다 — 새 코드가
  자기 이전 결함의 원인(부분 커버 코멘트)을 docstring 에 명시하고, 정확히 그 반대 배치를
  테스트로 고정했다.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **753 tests OK** 실측
  (RESOLUTION.md 주장과 일치).

## 긍정적으로 평가할 설계

- `_shared/` 신설이 계층 경계를 정확히 지킨다: `_shared/*.py` 는 `hooks`/`skills` 어느 쪽도
  import 하지 않고(단방향 의존), 두 orchestrator 와 두 hook 이 대칭적으로 그것에 의존한다.
  `test_block_integrity.py:88-107`(`CheckerListIsCanonicalTest.
  test_role_instructions_registers_the_same_checkers`)가 "`_shared` 는 skill 을 import 해선
  안 된다"는 의존 방향을 코드가 아니라 테스트 단언으로 지키는 것도 적절하다(순환 회피).
- `_evaluate_over_targets` 의 `render` 콜백 주입은 게이트별 메시지 포맷팅과 target 순회/notes
  수집 로직을 깔끔히 분리한 Strategy 패턴 적용이다.
- `ReviewDecision.push_blocks` / `PlanDecision.push_blocks` 속성 다형성 — 호출부가 게이트별
  결정 객체의 필드명(`blocked` vs `untouched`) 차이를 몰라도 되게 하는 얇은 어댑터. 정적 강제는
  없지만(`Protocol` 미도입 — plan 후속 §5 에 이미 등재) `PlanStubsMirrorTheRealInterfaceTest`
  가 테스트 더블의 LSP 위반(속성 누락)을 AST 파싱으로 잡아, 최소한 테스트 스위트 내에서는
  계약을 강제한다.
- `block_integrity.ALL_CHECKERS` 를 checker 목록의 단일 SoT 로 두고 `consistency_orchestrator`
  가 파생시킨 설계는 "이 백스톱이 놓치면 안 되는 것"과 "체커 목록"을 같은 곳에 두어 드리프트를
  구조적으로 막는다 — 얼핏 책임 두 개(하향 검증 + 레지스트리)를 겹친 것처럼 보이지만, 모듈
  docstring(`block_integrity.py:86-90`)이 이유를 명시하고 `CheckerListIsCanonicalTest` 로
  검증돼 있어 근거 있는 설계다.

## 요약

이번 라운드(8R)에서 review_guard.py·guard_review_before_push.py·code_review_orchestrator.py 등
대용량 파일을 직접 Read 하고 실제 테스트 스위트(753건)를 실행해 확인한 결과, 프롬프트가 지목한
round 7 의 두 결함(판정 파서 O(n²), 멀티 타겟 조기 return 으로 인한 advisory 유실)은 코드·회귀
테스트·git 이력 3중으로 수정이 확인됐고 새로 도입된 구조적 결함은 없다. `_shared/` 로의 상태
bookkeeping·하향 검증 로직 추출은 계층 경계(단방향 의존, 순환 없음)를 정확히 지키는 좋은
리팩터다. 남은 아키텍처 관심사는 대부분 이미 plan 문서에 후속으로 등재된 기존 부채(review_guard.py
크기·모듈 결합, merge_coordinator 의 부분 채택, `_lib` 네임스페이스 충돌)를 재확인하는 수준이며,
`code_review_orchestrator.collect_change_infos` 의 `--branch`/`--files` 우선순위 침묵 문제는
이미 높은 우선순위로 추적 중이지만 아직 코드에 남아 있어 재차 강조할 가치가 있다. 유일한 신규
관찰은 `test_block_integrity.py` 가 이름이 가리키는 범위를 넘어 다른 3개 모듈의 회귀 테스트를
흡수해 테스트 계층의 발견가능성이 떨어진 점이다. 이 중 어느 것도 즉시 차단을 요할 만큼 심각하지
않다.

## 위험도

LOW
