# 부작용(Side Effect) Review — round 12

## 방법론 메모

- 프롬프트에서 전체가 실리지 않은 `.claude/hooks/_lib/review_guard.py`, `.claude/tests/README.md`,
  `.claude/tests/test_block_integrity.py`, `.claude/tests/test_review_guard_hardening.py` 는
  `Read`로 직접 열어 확인했다.
- 라운드 12의 **실제 diff**를 `git log --oneline -15` + `git show --stat HEAD` +
  `git diff HEAD~1 HEAD --stat`로 먼저 확정했다: HEAD(`9c270100f`, "테스트 픽스처가 공유
  `.git/config`를 오염시킨 사고 복구 + 경화")가 이번 라운드의 유일한 신규 커밋이고, 판정 코드
  (`git_probe.py`/`plan_guard.py`/`branch_guard.py`/`review_guard.py`)는 **직전 라운드(11R,
  `4c221becaf`)에서 이미 고정되어 이번 라운드에는 변경이 없다.** 이번 diff는 4개 파일만 건드린다:
  `test_plan_guard.py`, `test_review_gate_ci.py`, `test_review_guard_hardening.py`,
  `plan/in-progress/harness-review-gate-ci-backstop.md`.
- CONTEXT가 명시한 실제 사고(11R 픽스처의 `git remote add origin`이 공유 `.git/config`를
  오염시켜 다른 워크트리의 `fetch`/`push`가 깨진 사건)와 이번 라운드의 "경화" 조치가 **실제로
  전수(全數)인지**를 검증하는 데 시간을 집중했다 — 작업 트리는 건드리지 않고 `grep -n`/`Read`로만
  확인했다.

---

## 발견사항

### [WARNING] 이번 라운드가 "경화"한 파일 안에 **경화되지 않은 자매 `_git` 헬퍼가 3개 더** 남아 있다 — 커밋의 "전수 조사" 주장이 그 파일 자신을 놓쳤다

- 위치: `.claude/tests/test_review_guard_hardening.py`
  - `RebaseAuthorDateTest._git` — 정의 257행(클래스)/275행(메서드), `subprocess.run` 287행
  - `NotesReachThePublicEntryPointTest._git` — 정의 567행(클래스)/588행(메서드), `subprocess.run` 594행
  - `UnstagedModificationKeepsItsPathTest._git` — 정의 652행(클래스)/677행(메서드), `subprocess.run` 683행
  - 대조: 같은 파일에서 **이번 라운드에 실제로 경화된** `ActionsCheckoutTopologyTest._git` —
    812행(클래스)/851행(메서드), `subprocess.run` 873행

- 상세:

  이번 커밋(`9c270100f`)은 세 개 픽스처의 `_git` 헬퍼에 `-C <root>` + `GIT_CEILING_DIRECTORIES`
  (+ `ActionsCheckoutTopologyTest`에는 `realpath` 경계 `assert`)를 추가했다고 밝힌다. 실제 diff로
  확인한 대상은 `test_plan_guard.py`의 헬퍼 1개, `test_review_gate_ci.py`의 헬퍼 2개
  (`ReviewGateCliTest`, `TheRealGateIgnoresTheEnvironmentTest`), `test_review_guard_hardening.py`의
  헬퍼 1개(`ActionsCheckoutTopologyTest`)다.

  그런데 `test_review_guard_hardening.py` **바로 그 파일 안에** 똑같은 모양(`env =
  dict(os.environ)`; `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM = os.devnull`; `subprocess.run(["git",
  *args], cwd=self.root, env=env, check=True, ...)`)의 독립적인 `_git` 헬퍼가 **셋 더** 있고
  (`RebaseAuthorDateTest`, `NotesReachThePublicEntryPointTest`,
  `UnstagedModificationKeepsItsPathTest`), 이번 diff는 이들을 전혀 건드리지 않았다:

  ```python
  # 287행 (RebaseAuthorDateTest._git) — cwd=self.root, -C 없음, GIT_CEILING_DIRECTORIES 없음
  subprocess.run(
      ["git", *args], cwd=self.root, env=env, check=True,
      capture_output=True, text=True,
  )

  # 594행 (NotesReachThePublicEntryPointTest._git) — 동일 결함 형태
  subprocess.run(["git", *args], cwd=self.root, env=env, check=True,
                 capture_output=True, text=True)

  # 683행 (UnstagedModificationKeepsItsPathTest._git) — 동일 결함 형태
  subprocess.run(["git", *args], cwd=self.root, env=env, check=True,
                 capture_output=True, text=True)
  ```

  세 곳 모두 `self.root = os.path.realpath(tempfile.mkdtemp())`로 만든 단일 임시 디렉터리만
  다루므로(다중 `cwd` 인자는 없음) `ActionsCheckoutTopologyTest`가 실제로 겪은 것과 동일한
  **`remote add`/`remote set-url` 오염 경로**는 지금 열려 있지 않다 — 세 클래스 다 `init` /
  `add` / `commit` / `checkout` 만 호출하고 `remote` 명령을 부르지 않는다(확인:
  `grep -n "remote add\|remote set-url" test_review_guard_hardening.py` → 매치는
  `ActionsCheckoutTopologyTest`의 docstring/코드뿐).

  하지만 이 커밋이 스스로 세운 방어선 — "임시 트리 밖이면 `assert`로 즉시 죽는다 / `git -C`로
  cwd를 명시한다 / `GIT_CEILING_DIRECTORIES`로 상위 탐색을 막는다" — 은 정확히 이 세 헬퍼에도
  적용돼야 하는 성질이다. `self.root`가 어떤 이유로든(향후 리팩터가 변수명을 잘못 바꾸거나,
  `TMPDIR`이 저장소 하위를 가리키게 설정되거나, 복사-붙여넣기로 다른 클래스의 `cwd`를 참조하는
  실수가 들어오는 경우) 임시 트리 밖으로 벗어나면, 이 세 헬퍼는 지금 `ActionsCheckoutTopologyTest`가
  경화 전에 그랬던 것과 **완전히 같은 무방비 상태**다 — `-C` 없이 `cwd=`만 쓰므로 git이 상위 탐색을
  하지 않아도 되는 것은 "지금 `self.root`가 맞기 때문"이지 코드가 보장해서가 아니다.

  같은 커밋의 plan 문서 항목(§후속 13)은 "같은 노출이 pre-existing 4곳에 더 있다"며
  `test_consistency_bundle_priority.py` / `test_consistency_impl_done.py` /
  `test_line_anchors.py` / `test_push_guard_worktree_scope.py`를 열거하는데, **이 조사가 자기가
  방금 편집한 파일 안의 형제 헬퍼 3개는 세지 않았다.** "전수 조사"라는 표현과 실제 조사 범위
  사이의 간극이다 — 이 저장소가 반복해서 기록해 온 "손-동기 쌍은 갈린다" 클래스가, 이번엔 파일
  경계를 넘는 대신 **같은 파일 안의 클래스 경계**에서 재발했다.

  참고로 넓혀서 훑어보면(이번 라운드 범위 밖이라 참고 정보로만 남긴다) `git -C` 없이
  `subprocess.run(["git", ...], cwd=d, ...)` 형태를 쓰는 파일이 `.claude/tests/` 안에 최소
  `test_consistency_context_budget.py:284`에도 있어, plan 문서의 "4곳" 카운트 자체도 완전한
  전수 조사였는지 의문이다(이 파일은 `remote` 명령을 쓰지 않아 즉시 위험하지는 않지만, 조사
  방법론이 같은 사각을 반복할 수 있음을 보여준다).

- 제안: `RebaseAuthorDateTest`/`NotesReachThePublicEntryPointTest`/
  `UnstagedModificationKeepsItsPathTest`의 `_git`도 `ActionsCheckoutTopologyTest`와 같은 패턴
  (`-C <root>` + `GIT_CEILING_DIRECTORIES=root`, 가능하면 realpath 경계 assert)으로 맞춘다. 다만
  plan 문서가 이미 제안한 근본 처방 — `_harness.py`에 공용 `make_temp_git_repo()`를 두고 이 가드를
  거기 한 번만 넣는 것 — 이 이 클래스의 재발(이번처럼 "그 파일 안의 형제조차 놓친다")을 구조적으로
  막는다. §후속 13/14 항목을 이 3곳까지 포함하도록 갱신할 것.

---

### [INFO] 이번 라운드의 실제 변경은 부작용 관점에서 건전하다 — 확인한 항목

- `env = dict(os.environ)` 뒤에 키를 추가하는 패턴은 세 파일 모두 **로컬 복사본**만 바꾼다 —
  실제 프로세스의 `os.environ`을 직접 mutate하지 않으므로 다른 테스트/세션과 환경변수를
  공유하는 부작용은 없다.
- `subprocess.run(["git", "-C", root, *args], env=env, ...)`로 바뀌면서 `cwd=` 인자를 제거하고
  `-C`로 대체했다 — git이 실제로 어느 디렉터리에서 동작하는지가 프로세스의 작업 디렉터리
  상속 경로가 아니라 인자로 명시되므로, 이 부분은 오히려 부작용 표면을 줄였다.
  (`.claude/tests/test_plan_guard.py:298-304`, `.claude/tests/test_review_gate_ci.py:64-70`,
  `698-709`, `.claude/tests/test_review_guard_hardening.py:861-874`에서 각각 확인.)
- `GIT_CEILING_DIRECTORIES`는 표준 git 환경변수로 상위 디렉터리 탐색을 차단하는 정확한 용도이고,
  콜론 구분 목록이 아니라 단일 경로만 들어가는 이번 사용은 문서화된 동작과 일치한다.
- 판정 코드(`git_probe.py`, `plan_guard.py`, `branch_guard.py`, `review_guard.py`,
  `scripts/check-review-gate.py`, `.github/workflows/review-gate.yml`)는 11R 이후 변경이 없다
  (`git diff HEAD~1 HEAD --stat`로 확인) — 시그니처·공개 인터페이스·환경변수 읽기/쓰기·네트워크
  호출 축에서 이번 라운드가 새로 추가한 위험은 없다. `review-gate.yml`을 현재 저장소 파일과
  `WorkflowWiringTest.EXPECTED`(프롬프트 file 8, 1145행대)와 3자 대조했고 정확히 일치한다.
- plan 문서 diff(§후속 13 신설)는 서술만 추가했고 코드 동작에 영향을 주지 않는다.

---

## 요약

이번 라운드의 실제 코드 변경은 11R에서 실제로 벌어진 사고(테스트 픽스처가 공유
`.git/config`를 오염시켜 이 저장소의 다른 4개 워크트리 세션의 `fetch`/`push`를 깨뜨린 사건)에
대한 복구 + 재발 방지 조치로, 판정 코드는 건드리지 않고 테스트 픽스처 3개(파일 기준)에 `-C` +
`GIT_CEILING_DIRECTORIES`(+ 경계 `assert`)를 추가했다. 그 변경 자체는 `os.environ`을 복사본에만
반영하고 `cwd` 상속 대신 `-C`로 명시하는 등 부작용 관점에서 건전하다. 다만 검증 과정에서, 이번에
"경화"한 `test_review_guard_hardening.py` **그 파일 안에** 형태가 완전히 동일한(`cwd=self.root`,
`-C` 없음, `GIT_CEILING_DIRECTORIES` 없음) `_git` 헬퍼가 세 개 더(`RebaseAuthorDateTest`,
`NotesReachThePublicEntryPointTest`, `UnstagedModificationKeepsItsPathTest`) 남아 있는 것을
확인했다 — 이번 diff와 plan 문서의 "전수 조사"가 다른 파일 4곳은 찾아 backlog에 등재했으면서
정작 자신이 편집한 파일 안의 형제 클래스는 세지 못했다. 이 세 곳은 `remote` 명령을 쓰지 않아
원 사고의 정확한 재현 경로(원격 URL 오염)는 열려 있지 않지만, 이번 커밋이 스스로 정의한 방어선을
그대로 벗어난 상태이며 향후 리팩터·환경 변화로 노출될 수 있는 잠복 위험이다.

## 위험도

WARNING
