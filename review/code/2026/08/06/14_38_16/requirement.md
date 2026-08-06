# 요구사항(Requirement) 리뷰 — round 11

## 방법

15개 대상 파일을 전부 Read(프롬프트에 안 실린 `review_guard.py`·`tests/README.md`·
`test_block_integrity.py`·`test_review_guard_hardening.py`·`test_review_gate_ci.py` 후반부
포함)했고, `plan/in-progress/harness-review-gate-ci-backstop.md`(review-gate.yml 자신이
"정책 본문"으로 지목하는 문서 — 이 영역엔 `spec/` 문서가 없으므로 이 plan 문서를 사실상의
spec 으로 취급해 line-level 대조했다)와 대조했다. 정적 대조만으로 끝내지 않고, 세 가지를 각자
스크래치 디렉터리(`mktemp -d`, 절대경로, 원본 워크트리 미변경)에서 실측했다:

1. `.claude/tests` 전체 스위트를 원본 워크트리에서 그대로 실행 — `python3 -m unittest discover
   -s .claude/tests -p 'test_*.py'` → **850 tests, OK** (pnpm 미설치로 인한 override-floors 쪽
   `pnpm audit` fail-closed 로그는 이 저장소 CI 환경 밖 정상 동작이고 실패가 아니다).
2. `GitProbesAreNotReDuplicatedTest`(도출식 중복 함수 가드)가 "목록에 없던 새 함수"를 두 훅에
   복제해도 실제로 잡는지 — 잡음(RED) 확인. 같은 이름을 한쪽에서만 새 로컬 정의로 shadow 해도
   object-identity 테스트가 잡는지 — 잡음(RED) 확인. (두 실험 모두 명령·출력 아래 첨부)
3. `git_probe._origin_default_branch()`의 실제 git 파싱 로직(symbolic-ref 우선, `git remote
   show origin` 폴백)이 스위트 전체에서 정말 한 번도 실행되지 않는지 — mutation(무조건 `None`
   반환)으로 실증하고, 별도로 origin 을 가진 실제 저장소 쌍(bare origin + clone)을 만들어 두
   메서드 모두 **현재는 기능적으로 정확함**을 확인했다(round 7 교훈 — mutation 을 GREEN 증거로
   읽기 전에 대상이 실행 경로 위에 있는지 먼저 증명하라는 규율을 반대 방향으로 적용: 이번엔 실행
   경로 "밖"에 있다는 것 자체가 결함이므로, 먼저 "밖에 있다"를 mutation 으로 증명하고 이어서
   "그런데 로직 자체는 맞다"를 실측으로 증명해 이중으로 확인했다).

## 발견사항

- **[WARNING]** `git_probe._origin_default_branch()`의 실제 git 파싱 로직이 하네스 스위트
  전체에서 단 한 번도 실행되지 않는다 — round 7~10 이 반복해서 찾아낸 것과 동일한 클래스
  ("mock 으로 우회돼 실구현이 한 번도 안 돈다")가 이번 라운드에도 남아 있다.
  - 위치: `.claude/_shared/git_probe.py:46` (`_origin_default_branch` 함수 정의). 소비:
    `.claude/hooks/_lib/branch_guard.py:58`(`_origin_default_branch = _git_probe._origin_default_branch`,
    `evaluate()`의 핵심 판정 입력), `.claude/_shared/git_probe.py:142`(`_default_branch()`가
    호출).
  - 상세: `.claude/tests/test_branch_guard.py`는 `_origin_default_branch`를
    `mock.patch.object(bg, "_origin_default_branch", return_value=default)`로 전부 우회한다.
    `test_plan_guard.py`·`test_review_guard_hardening.py`의 실제-git-repo 테스트들은
    `_default_branch`/`evaluate_review`를 실제 저장소로 구동하지만, 그 fixture 들은 `origin`
    리모트를 아예 설정하지 않는다 — `_origin_default_branch`는 "Step 0: origin 리모트가
    있는가"에서 바로 `None`을 반환하고 반환하므로, symbolic-ref 파싱(Method 1)도
    `git remote show origin` 파싱(Method 2)도 실행 경로에 오르지 못한다.
    스크래치 워크트리에서 실측: `_origin_default_branch`의 "Step 0" 직후에 무조건 `return None`을
    심어(양쪽 메서드를 통째로 죽여도) `test_branch_guard.py`(11) + `test_plan_guard.py`(33) +
    `test_review_guard.py`(37) + `test_review_guard_hardening.py`(57) = **138개 테스트가 전원
    GREEN**을 유지했다. 명령: `python3 -m unittest discover -s .claude/tests -p
    'test_branch_guard.py'`(외 3개 파일 각각) — 전부 `OK`.
    별도로 실제 git 저장소 쌍(`git init --bare -b trunk origin.git` + clone)으로 이 함수를 직접
    구동해 **현재 로직 자체는 정확함**을 확인했다(Method 1 symbolic-ref 및 Method 2
    `git remote show origin` 폴백 모두 비-`main` 이름 `trunk`를 올바로 반환). 즉 지금은 살아있는
    버그가 아니라, 회귀가 나도 아무 테스트도 못 잡는 잠복 구멍이다.
    이 함수는 (a) `branch_guard.evaluate()`의 "메인 워크트리 + 기본 브랜치 체크아웃 시 편집
    차단" — CLAUDE.md 최상단이 "항상 지킨다"고 못박은 그 enforcement — 의 유일한 판정
    입력이고, (b) `review_guard._default_branch()`/`plan_guard._default_branch()`를 거쳐
    이번 라운드의 실제 산출물인 `check-review-gate.py` CI 백스톱의 changeset 산정에도
    들어간다. `_default_branch()`의 폴백(`refs/heads/main`/`refs/heads/master` 로컬 브랜치
    프로브)은 CI 체크아웃 환경에서 대개 존재하지 않는 로컬 ref 를 찾으므로(`actions/checkout`은
    PR ref 만 로컬로 만들고, "Fetch base ref" step 이 채우는 것은 `refs/remotes/origin/<base>`
    다), `_origin_default_branch`가 회귀하면 `_default_branch()`가 `None`을 반환 →
    `_merge_base`가 안 돌고 `base=None` → `committed=[]`, 깨끗한 CI 체크아웃이라
    `uncommitted=[]` → `evaluate_review`가 "no codebase/ changes on this branch — allowed"로
    **모든 PR을 조용히 통과**시키는 연쇄가 가능하다 — 정확히 이 브랜치가 10라운드째 막으려는
    "fail-open 을 아무도 인지 못 함" 모양이다. `plan/in-progress/harness-review-gate-ci-backstop.md:117`의
    기존 백로그 항목 #8("`_default_branch_ref()`의 성공 경로 3갈래가 미검증")은 이것과 다른
    함수(`code_review_orchestrator._default_branch_ref()`, 별도 4번째 구현)를 가리키므로
    이 발견과 중복이 아니다 — 같은 plan 문서 §198이 `branch_guard._origin_default_branch()`를
    "정본(正本)"이라 부르면서도 정작 그 정본 자체의 실경로 커버리지 갭은 등재돼 있지 않다.
  - 제안: `PorcelainPathSurvivesOnARealRepoTest`/`RebaseAuthorDateTest`가 쓰는 것과 같은
    real-git-repo 패턴으로 `_origin_default_branch`용 테스트를 추가한다 — 최소 2케이스:
    (1) `origin` 리모트에 `refs/remotes/origin/HEAD` symref 가 설정된 경우(Method 1 적중),
    (2) symref 없이 `git remote show origin`만으로 해석되는 경우(Method 2 폴백). 두 경우 모두
    "main"이 아닌 브랜치 이름(예: `trunk`)으로 검증해 하드코딩 회귀를 같이 잡는다.

- **[WARNING]** `plan_guard.py`의 위임 블록 주석이 "다섯 개"라고 세지만 실제로는 여섯 개를
  위임한다 — 이 브랜치가 반복해서 잡아 온 "손으로 쓴 개수 vs 실제 코드" drift 클래스의 재발.
  - 위치: `.claude/hooks/_lib/plan_guard.py:102`(주석 "These five git probes now live in
    `.claude/_shared/git_probe.py`") ~ `.claude/hooks/_lib/plan_guard.py:115`
    (`_current_branch = _git_probe._current_branch`).
  - 상세: 주석 바로 아래(108~112행)에 5개 대입이 있고, 두 줄 띄운 뒤(115행) `_current_branch`
    대입이 하나 더 있다 — 총 6개. `git log -p`로 확인: 이 `_current_branch` 위임은 라운드
    10(`9a7b287`)에서 로컬 함수 정의를 대체하며 새로 추가됐는데, 그 커밋은 같은 라운드에 자기
    자신이 쓴 `git_probe.py` 자체 docstring 의 "consumers 2 vs 3, copies 10 vs 12" 축소 서술은
    고쳤다([W8], 커밋 메시지 참조)면서, 정작 `plan_guard.py`에 있는 이 형제 주석은 손대지 않았다.
    `review_guard.py:200`의 동일 문구("These five git probes...")는 정확하다 — review_guard 는
    `_current_branch`를 쓰지 않아 실제로 5개만 위임하기 때문이다. 즉 review_guard 와 plan_guard
    가 같은 문장을 복사해 갖고 있다가, 한쪽만 바뀌고 다른 쪽은 안 바뀌어 갈린 것 — 이 저장소가
    `report_paths`/`retry_state`/git 프로브 자체에서 이미 여러 번 겪은 "손-동기 쌍 drift"의
    코멘트 버전이다. 기능 영향은 없다(단순 주석이고, 실제 위임 대입문 자체는 올바르게 6개
    동작한다 — `test_the_shared_probes_are_the_same_objects_everywhere`가 이를 실제로 검증한다).
  - 제안: 102행 주석을 "여섯"으로 고치거나(115행의 `_current_branch` 위임까지 포함해 한 블록으로
    합치거나), 아니면 개수를 프로즈로 박지 않는 서술로 바꾼다(`.claude/tests/README.md`가
    "Deliberately not '두 파일' or '세 파일'"이라고 스스로 적어 둔 것과 같은 처방).

- **[INFO]** `git_probe._default_branch()`에 남은 `if True:` 는 라운드 10에서 깨진 wrapper
  간접 호출(`resolver = _origin_default_branch(cwd); ... d = resolver(cwd)`)을 직접 호출
  (`d = _origin_default_branch(cwd)`)로 고치면서 남은 잔재로 보인다 — 조건이 항상 참이라
  동작에는 영향이 없다(직접 읽고 확인: `try/except`를 감싸는 `if True:` 블록이 있을 뿐 분기
  로직 없음).
  - 위치: `.claude/_shared/git_probe.py:140`.
  - 상세: `git log -p`로 확인한 diff: `- if resolver is not None:` → `+ if True:`, 그리고
    `- d = resolver(cwd)` → `+ d = _origin_default_branch(cwd)`. 최소 diff 로 고치면서 `if`
    자체를 지우고 dedent 하는 대신 조건만 `True`로 바꿔 죽은 코드가 남았다. 이 파일 자신의
    docstring 이 정확히 이런 "정리 안 된 잔재가 다음 회귀를 부른다"는 취지로 여러 문단을 쓰고
    있어(예: round 7/8 `.strip()` 잔존 이야기) 지적해 둔다.
  - 제안: `if True:` 를 제거하고 `try/except` 를 함수 최상위로 dedent. 동작 변화 없음, 가독성만
    개선.

- **[INFO] spec fidelity** — 이 영역은 `spec/`에 대응 문서가 없다(grep 확인: `review-gate` /
  `review_guard` / `check-review-gate` 문자열이 `spec/` 어디에도 없음). 대신
  `review-gate.yml` 자신이 "정책 본문: `plan/in-progress/harness-review-gate-ci-backstop.md`"
  라고 명시하므로 그 문서를 사실상의 spec 으로 대조했다: 관측 모드(`--enforce` 미부여) ·
  dependabot 예외(`github.actor != 'dependabot[bot]'`) · `paths:` 글롭 목록(코드/훅/`_shared`/
  스크립트/워크플로 자신) · `fetch-depth: 0` + "Fetch base ref" step 순서 · 판정자 단일성
  (`evaluate_review` 위임, 재구현 없음) 전부 plan 문서 서술과 line-level 로 일치했다. 불일치
  없음.

## 요약

라운드 7~10이 이미 정적 우회(워크플로 문서 부분일치, 환경변수 판정 분기, 손-목록 기반 통합
가드)와 살아있는 판정 결함(`.strip()` 선행 공백, 무조건 `break`, 6번째 프로브 누락)을 모두
닫았고, 이번 라운드에 원본 워크트리에서 전체 850개 하네스 테스트가 그대로 통과하며 도출식
중복-함수 가드는 미리 적어두지 않은 새 중복도 실제로 잡는다(두 건의 독립 mutation 실측으로
확인). `check-review-gate.py`↔`review-gate.yml`↔`review_guard.evaluate_review()` 사이의
line-level 정합성도 대조상 이상 없다. 다만 판정을 좌우하는 헬퍼 하나(`_origin_default_branch`)
가 이 브랜치가 정확히 경계해 온 클래스대로 — mock/무-origin fixture 로 인해 — 실경로 커버리지
없이 남아 있고, 그 함수가 깨지면 `branch_guard`의 핵심 enforcement 뿐 아니라 이번 라운드의
CI 백스톱 자체가 CI 환경에서 조용히 항상-통과로 fail-open 할 수 있는 연쇄를 이룬다(현재 로직은
실측상 정확함 — 이것은 활성 버그가 아니라 커버리지 공백이다). 그 외에는 손-동기 주석 하나의
개수 drift(기능 영향 없음)와 죽은 `if True:` 잔재(기능 영향 없음) 정도이며, TODO/FIXME/HACK류
미완성 표식은 15개 파일 어디에도 없다.

## 위험도

LOW
