# 아키텍처(Architecture) Review

## 세션 관측 — 작업 트리가 리뷰 도중 변경됨 (선행 고지)

이 리뷰 세션(`13_33_32`)이 번들링한 프롬프트는 `plan_guard.py`/`review_guard.py`가
`_run_git`/`_repo_root`/`_default_branch`/`_merge_base`/`_porcelain_path` 다섯 함수를
각자 로컬로 정의한 **HEAD(`88ce9994d`, 8R 커밋) 상태**를 담고 있다. 그런데 이 리뷰를
작성하는 동안 작업 트리가 **커밋되지 않은 채** 바뀌었다 (`git status --porcelain`):

```
 M .claude/hooks/_lib/plan_guard.py
 M .claude/hooks/_lib/review_guard.py
 M .claude/tests/test_plan_guard.py
?? .claude/_shared/git_probe.py
```

새 `.claude/_shared/git_probe.py`가 그 다섯 함수를 단일 구현으로 옮기고,
`plan_guard.py`/`review_guard.py`는 `_run_git = _git_probe._run_git` 형태로 위임하도록
바뀌어 있었다(파일 mtime 13:36 — 프롬프트 조립 시각 13:33:32보다 뒤). 동반 테스트
`test_plan_guard.py::GitProbesAreNotReDuplicatedTest`(객체 동일성 + AST 로 로컬 재정의
부재까지 검증)도 함께 추가돼 있다. 즉 아래 **F1**이 겨냥하는 정확히 그 결함 클래스에 대한
수정이 **리뷰 도중 실시간으로** 진행 중이었다 — 리뷰 대상 스냅샷과 실제 작업 트리가 갈렸다.

방침: F1은 **프롬프트가 지시한 리뷰 대상(HEAD 상태)** 기준으로 판정한다(이것이 이번 라운드가
검토해야 할 커밋이므로). 관측된 진행 중인 수정 자체는 **F2**로 별도 보고한다 — 방향은 맞지만
미완성이고 미커밋이므로, 이 라운드를 닫기 전에 반드시 실제로 착지했는지 확인이 필요하다.
작업 트리는 건드리지 않았다(읽기만 함, `git diff HEAD`로 관측).

---

## 발견사항

- **[CRITICAL]** `_run_git`/`_repo_root`/`_default_branch`/`_merge_base`(+ review_guard 는
  `_porcelain_path`)가 `branch_guard.py`/`plan_guard.py`/`review_guard.py` 세 모듈에 손으로
  중복 구현돼 있다 — DRY 위반이자, 이 저장소가 이미 **같은 근본 원인으로 두 번 실제 결함을
  냈다**는 사실이 코드 주석 자체에 기록돼 있는 패턴.
  - 위치: `.claude/hooks/_lib/plan_guard.py` `_run_git`(98-127행) · `_repo_root`(130-134행) ·
    `_current_branch`(137-141행) · `_default_branch`(144-156행) · `_merge_base`(159-164행);
    `.claude/hooks/_lib/review_guard.py` `_run_git`(224-247행) · `_repo_root`(250-254행) ·
    `_default_branch`(257-270행) · `_merge_base`(273-280행); `.claude/hooks/_lib/branch_guard.py`
    `_run_git`(35-47행) · `_repo_root`(50-54행) · `_current_branch`(65-70행)
    (모두 `HEAD`=`88ce9994d` 기준 — 이번 라운드가 리뷰하는 상태).
  - 상세: `plan_guard.py`와 `review_guard.py`의 위 함수들은 AST 기준 완전히 동일한 복사본이다
    (`git_probe.py`의 새 docstring이 명시). 이 중복이 정확히 지난 두 라운드의 CRITICAL을 낳았다:
    7R은 `review_guard._run_git`의 `.strip()`(porcelain 선행 공백 소실 → fail-open)을 고쳤고,
    **plan_guard.py의 독립 사본은 고치지 않은 채로 남겨졌다**. 8R이 그 결함을 plan_guard.py에서
    재발견했는데, 이번엔 fail-open이 아니라 **거짓 차단**(정상적으로 갱신한 plan이 "미갱신"으로
    읽혀 push가 막힘) 방향이었다 — 옆집보다 나쁜 방향이다. 두 스위트 모두 `_run_git`/
    `_porcelain_path`를 통째로 mock으로 우회해 실제로는 스위트 전체에서 한 번도 실행되지
    않았기 때문에 아무도 못 잡았다(8R 커밋 메시지가 이를 직접 인정). `branch_guard.py`는 아직
    porcelain 고정폭 파싱을 하지 않아 오늘은 무해하지만, 그 사실은 우연이지 구조가 보장하는
    게 아니다 — `.strip()`(review_guard/plan_guard가 이미 버린 형태)과 `core.quotePath=false`
    부재를 그대로 지닌 **세 번째의, 서로 다른** 사본이다. 이 저장소는 같은 실패 클래스를
    `report_paths`(`_shared/report_paths.py`)와 `retry_state`(`_shared/retry_state.py`)에서
    이미 겪고 공유 모듈로 뽑아 닫았다 — 즉 처방을 이미 안다. 그런데 이 세 함수 트리오만
    구조적 해법 없이 "손으로 동기화"라는 실패해 온 전략에 남아 있었다.
  - 제안: 다섯 함수(`_run_git`/`_repo_root`/`_default_branch`/`_merge_base`/`_porcelain_path`)를
    단일 모듈로 추출하고 세 소비자(`branch_guard.py` 포함) 모두 위임하게 한다. 정적 검사만으로는
    부활을 못 잡으므로(4R~6R이 반증), `plan_guard`/`review_guard`가 실제로 같은 함수 객체를
    참조하는지(객체 동일성) + 로컬 `def`가 없는지(AST) 두 축으로 고정하는 회귀 테스트를 동반한다.
    (아래 F2가 이 정확한 형태의 부분적 수정이 이미 진행 중임을 보고한다.)

- **[INFO]** (관측, F1의 진행 중 수정) 리뷰 도중 작업 트리에 `.claude/_shared/git_probe.py`가
  새로 생기고 `plan_guard.py`/`review_guard.py`가 거기로 위임하도록 바뀌어 있었다 — 방향은
  F1의 처방과 정확히 일치하지만 **미완성 + 미커밋** 상태다.
  - 위치: `.claude/_shared/git_probe.py`(신규, untracked); `.claude/hooks/_lib/plan_guard.py`
    52-58행·106-116행(새 위임 블록); `.claude/hooks/_lib/review_guard.py`의 대응 블록;
    `.claude/tests/test_plan_guard.py::GitProbesAreNotReDuplicatedTest`(신규).
  - 상세: 세 가지 잔여 결함.
    1. **`branch_guard.py`가 빠져 있다** — F1이 지목한 세 번째 사본이 여전히 독립이다. 클래스가
       2/3만 닫힌다.
    2. **죽은 코드 잔존** — `plan_guard.py`(62-67행)와 `review_guard.py`의 대응 블록에
       `try: from branch_guard import _origin_default_branch except: ...`가 그대로 남아 있는데,
       이제 `_default_branch`는 `_git_probe._default_branch`(자체적으로 `branch_guard`를
       재-import)로 완전히 위임되므로 이 로컬 바인딩은 **아무 데서도 읽히지 않는다**. 해롭진
       않지만 "가짜 seam"이다 — 누군가 `mock.patch.object(pg, "_origin_default_branch", ...)`로
       `_default_branch`의 동작을 바꾸려 하면 조용히 아무 효과가 없다(현재 어떤 테스트도 그렇게
       하지 않아 활성 버그는 아니지만, 다음에 그렇게 짜는 사람에게 함정이 된다).
    3. **의존 방향 역전** — `_shared/git_probe.py`가 `sys.path.insert`로 `hooks/_lib`를 직접
       얹어 `branch_guard._origin_default_branch`를 가져온다(자체 주석이 "`_lib` 이름이
       hooks/skills 간 충돌해서"라고 정당화). `_shared`는 이 저장소에서 hooks 쪽이 소비하는
       공용 하위 계층이어야 하는데, 여기서는 반대로 `_shared`가 `hooks/_lib`의 특정 파일
       하나에 의존한다. `_origin_default_branch` 자체가 아직 `branch_guard.py`(hooks 전용
       모듈)에만 있고, `_shared`로 옮겨지지 않았기 때문에 생기는 결과다.
  - 제안: 이 라운드가 닫히기 전에 (a) `branch_guard.py`도 같은 다섯 함수를 위임하도록 포함시키고,
    (b) `plan_guard.py`/`review_guard.py`의 죽은 `_origin_default_branch` import 블록을 제거하며,
    (c) 가능하면 `_origin_default_branch`(또는 default-branch 해석 전체)를 `_shared`로 옮겨
    `branch_guard.py`가 거기서 위임받게 해 방향을 정상화한다. 그리고 이 변경 세트가 실제로
    커밋됐는지 — `git status`가 clean한지 — 이 라운드를 닫기 전에 확인한다.

- **[WARNING]** 푸시 게이트가 소비하는 "결정" 계약(`push_blocks: bool`, `reason: str`)이
  명시적 인터페이스(Protocol/ABC) 없이 관례로만 유지된다 — 이미 한 번 실제 사고를 낸 자리.
  - 위치: `.claude/hooks/_lib/review_guard.py` `ReviewDecision.push_blocks`(194-203행);
    `.claude/hooks/_lib/plan_guard.py` `PlanDecision.push_blocks`(86-95행);
    소비부는 `.claude/hooks/guard_review_before_push.py:874`
    (`if result.push_blocks and blocked is None:` — 게이트 목록을 동형으로 순회).
  - 상세: `ReviewDecision`, `PlanDecision`, 그리고 `branch_guard.GuardDecision`(다른 필드명
    `blocked`)까지 셋 다 구조적으로 "결정 객체"이지만 공통 베이스/Protocol이 없다. 게이트를
    새로 추가하려는 다음 사람이 `push_blocks` 프로퍼티를 빠뜨려도 파이썬은 아무 경고도 안 낸다
    — 그리고 이미 그 정확한 사고가 났다: `.claude/tests/test_stop_guard_failopen.py`
    (55-60행 부근 `_CLEAN_PLAN` 스텁 주석)가 "`test_block_integrity.py`가 `push_blocks` 없는
    스텁을 썼고, 의도된 ALLOW가 크래시 후 fail-open으로 바뀌었는데 exit 0이라 테스트가 **틀린
    이유로 통과**했다 — 리뷰어가 서브프로세스를 돌려 stderr를 읽기 전까지 아무도 몰랐다"고
    직접 서술한다.
  - 제안: `typing.Protocol`로 `class PushGateDecision(Protocol): push_blocks: bool; reason: str`
    같은 최소 계약을 명문화하고, 게이트 순회부의 타입 힌트를 그걸로 건다. 런타임 강제까지는
    아니어도 정적 분석(mypy/pyright)이 이 클래스의 결함을 다음번엔 커밋 전에 잡게 된다.

- **[INFO]** `scripts/check-review-gate.py`가 이름부터 "package-private"를 신호하는
  `.claude/hooks/_lib`을 `sys.path` 조작으로 직접 얹어 `review_guard.evaluate_review`를
  가져온다 — `_lib`이 사실상 두 번째 프로덕션 소비자(hooks + CI 스크립트)를 갖는 공개 API
  표면이 됐는데도 이름·위치가 그 승격을 반영하지 않는다.
  - 위치: `scripts/check-review-gate.py` `_load_gate`(63-74행), 특히 65행
    (`lib = os.path.join(root, ".claude", "hooks", "_lib")`).
  - 상세: 이 결합은 **의도적이고 근거가 탄탄하다** — 판정 로직을 두 번째로 구현하면 로컬/CI
    drift가 생기고, 이 저장소는 그 실패를 `report_paths`/`retry_state`로 이미 겪었다(스크립트
    자체 docstring 15-19행이 이를 설명). 그래서 결합 자체를 없애라는 제안이 아니다. 다만
    "`_lib`은 hooks 내부 전용"이라는 네이밍 신호와 실제 소비 범위(hooks 3개 + CI 스크립트 1개)가
    어긋나 있어, 다음에 `_lib` 내부를 "내부용이니 자유롭게 리팩터"하려는 사람이 이 두 번째
    소비자를 놓치기 쉽다. `review-gate.yml`의 `paths:` 트리거가 `.claude/hooks/_lib/**`를 이미
    등재해 CI가 이 결합을 놓치지는 않지만(배선은 안전), 코드 상의 이름은 여전히 오도한다.
  - 제안: 강제는 아니고 문서화 수준 제안 — `_lib/__init__.py`나 모듈 docstring 상단에 "이
    디렉터리는 `scripts/check-review-gate.py`의 두 번째 프로덕션 소비자를 갖는다"는 한 줄을
    남겨 두면, `_lib`을 순수 hooks-internal로 오인한 리팩터가 CI 배선을 깨뜨리는 사고를
    예방한다.

## 요약

이번 라운드가 리뷰하는 커밋(`88ce9994d`, 8R) 자체는 구조적으로 건전하다 — 레이어 분리
(hooks → `_lib` 가드 → `_shared` 공용 로직), `push_blocks` 덕타이핑을 통한 게이트 목록의 균일
순회, CI 백스톱이 로컬 훅과 **같은** 판정 함수를 재사용해 두 번째 구현을 두지 않은 설계(6~9라운드에
걸쳐 스스로 검증한 원칙)까지 전반적으로 잘 잡혀 있다. 가장 무거운 아키텍처 결함은 F1
— `branch_guard.py`/`plan_guard.py`/`review_guard.py`에 손으로 중복된 git 프로브 다섯 함수 —
인데, 이는 가설이 아니라 **이미 두 라운드 연속 실제 결함(7R fail-open, 8R 거짓 차단)을 낳은
증명된 실패 패턴**이고, 이 저장소가 `report_paths`/`retry_state`로 같은 클래스를 이미 공유
모듈로 뽑아 닫아 본 전례가 있다는 점에서 더 두드러진다. 흥미롭게도 이 정확한 수정(`_shared/
git_probe.py` 추출 + 위임)이 리뷰 도중 작업 트리에 **이미 진행 중**이었지만 (a) `branch_guard.py`
누락, (b) 죽은 import 잔존, (c) `_shared`→`hooks/_lib` 역방향 의존이라는 세 잔여 흠을 남긴 채
미커밋 상태였다(F2). `push_blocks` 계약의 비명시성(F3)도 이미 한 번 "테스트가 틀린 이유로
통과"하는 실제 사고를 냈던 자리라 함께 닫을 가치가 있다. `check-review-gate.py`의 `_lib` 직접
소비(F4)는 의도적 트레이드오프이므로 정보성으로만 남긴다.

## 위험도

HIGH — F1은 가상의 리스크가 아니라 같은 파일 쌍에서 이미 두 번 실제 결함(하나는 리뷰 게이트
fail-open, 하나는 push 거짓 차단)을 냈고, 구조적 수정 없이는 세 번째 재발을 막을 장치가 없다.
다만 이번 라운드가 리뷰하는 HEAD 커밋 자체에 지금 살아있는 새 우회는 확인되지 않았고, 정확히
그 결함 클래스에 대한 구조적 수정이 이미 진행 중(F2, 미완성)이라는 점에서 CRITICAL까지는 아니다.
