# 성능(Performance) Review

## 실행 요약 (측정 방법)

리뷰 대상 6개 파일을 모두 `Read` 로 전체 확인했고, 라운드 2 지침("가드/테스트마다 그 성질이
거짓인 채로 통과하려면 무엇이 필요한지 묻고 실제로 해 본다")에 따라 검사만 하지 않고 아래를
직접 실행했다:

- `python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v` (단독 파일, 반복 2회)
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (하네스 스위트 전체, 백그라운드)
- `git diff` / `git status --porcelain` (실제 작업 트리 상태 확인)
- `git count-objects -v` (저장소 크기 실측 — `fetch-depth: 0` 비용 판단 근거)

**중요 관찰 — 리뷰 시작 시점에 이미 작업 트리가 커밋되지 않은 상태로 변형돼 있었다** (내가 만든
변경이 아님 — `Read`/`Bash` 만 사용했고 `Edit`/`Write` 로 이 세 파일을 건드린 적 없다).
`git status --porcelain` 로 확인:

```
 M .claude/tests/test_review_gate_ci.py
 M .github/workflows/review-gate.yml
 M scripts/check-review-gate.py
```

`.github/workflows/review-gate.yml` 은 `run: python3 scripts/check-review-gate.py` 가
`env: {GATE_FLAG: --enforce}` / `run: true $GATE_FLAG` 로 바뀌어 있었고, `scripts/check-review-gate.py`
에는 `decision.blocked` 를 `os.path.isdir`+`os.path.getmtime` 기반의 "second judge" 로 덮어쓰는
코드가 주석("bypass attempt: ...")과 함께 삽입돼 있었다. 정확히 이 프롬프트의 두 테스트
(`WorkflowWiringTest`, `OneJudgeTest`)가 막아야 한다고 주장하는 그 우회 형태다. 이 변형은 이
리뷰가 리뷰하는 **커밋된 diff 의 일부가 아니다**(`git diff origin/main -- ...` 에는 나타나지 않음).
전체 스위트를 백그라운드로 돌리는 동안 값이 달라지는 것을 관측했다(첫 단독 실행에서는
`WorkflowWiringTest` 전원 `ok` 였는데, 이후 전체 스위트 실행에서는 같은 테스트가 실패로 나옴) —
즉 같은 워크트리를 동시에 만지는 다른 프로세스(다른 리뷰어 세션 등)가 있었을 가능성이 높다.
아래 발견사항 5는 이 라이브 상태에서 실제로 확인한 사실이며, 성능 리뷰의 엄밀한 스코프 밖이지만
같은 실행으로 얻은 실측이라 기록한다. **이 파일들을 원상복구하지 않았다** — 다른 세션의 진행
중인 작업일 수 있어 되돌리는 쪽이 더 위험하다고 판단했다. 정리는 별도로 필요하다.

## 발견사항

- **[INFO]** `ReviewGateCliTest` 의 `setUp` 이 테스트 메서드마다 무거운 픽스처를 새로 만든다
  - 위치: `.claude/tests/test_review_gate_ci.py:40` (`setUp`), `:46-49` (`shutil.copytree` 2회), `:78-86` (`_run` — 서브프로세스로 새 `python3` 인터프리터 기동)
  - 상세: 9개 테스트 메서드 각각의 `setUp()` 이 `.claude/hooks`(268K, 18파일)와 `.claude/_shared`(72K, 8파일) **전체**를 tempdir 로 복사하고, `git init` + `git commit --allow-empty` 서브프로세스를 띄운다. 대부분의 테스트는 `review_guard.py`(및 그 의존 모듈)만 있으면 충분한데 형제 디렉터리 전체를 복사한다. 실측: 이 파일 단독 15개 테스트 = 2.395s / 2.579s(반복 측정), 하네스 스위트 전체 827개 = 125.3s. 이 파일의 비중은 전체의 ~2%로 절대치는 작지만, `.claude/tests/README.md` 스스로가 기록하듯 스위트는 새 파일마다 계속 커지는 추세다.
  - 제안: `setUp` 대신 `setUpClass`(클래스 스코프)에서 tempdir+copytree+git init 을 1회만 만들고, 게이트 모듈을 덮어쓰는 두 테스트(`test_a_gate_that_raises_does_not_fail_ci`, `test_notes_are_printed_on_both_verdicts`)만 자기 안에서 별도 tempdir 를 쓰거나 클래스 픽스처를 매 테스트 시작 시 얕게 복원하도록 분리하면 나머지 7개 테스트의 복사·git init 비용을 없앨 수 있다.

- **[INFO]** `WorkflowWiringTest` 가 바뀌지 않는 정적 YAML 을 테스트 메서드마다 재파싱
  - 위치: `.claude/tests/test_review_gate_ci.py:317-323` (`setUp`)
  - 상세: `review-gate.yml` 은 이 클래스의 5개 테스트 메서드 동안 내용이 바뀌지 않는데 `setUp()` 이 매번 `path.read_text()` 를 2회(`safe_load` 인자용 + `self.text`) 호출하고 `yaml.safe_load()` 를 다시 수행한다. 파일이 작아(76줄) 개별 비용은 무시할 만하지만 5회→1회로 줄일 수 있는 순수 중복이다.
  - 제안: 파싱을 `setUpClass` 로 승격(다른 클래스의 `PyYAML` import 는 이미 `setUpClass` 에 있어 패턴이 절반만 적용된 상태).

- **[INFO]** `review-gate.yml` 의 명시적 `git fetch` 가 직전 `fetch-depth: 0` 체크아웃과 중복일 가능성
  - 위치: `.github/workflows/review-gate.yml:55-57` (`actions/checkout@v7` + `fetch-depth: 0`), `:67-70` (`Fetch base ref` 스텝)
  - 상세: `fetch-depth: 0` 은 통상 "모든 브랜치·태그의 전체 히스토리"를 가져오므로, 체크아웃 직후 `origin/<base>` 가 이미 원격추적 브랜치로 로컬에 존재할 가능성이 높다. 그렇다면 뒤이은 `git fetch --no-tags origin "$BASE_REF"` 는 같은 데이터를 다시 받는 중복 네트워크 I/O다. fork-PR 등 권한이 제한된 트리거에서는 방어적으로 필요할 수도 있어 완전히 불필요하다고 단정하지는 않는다(이 항목은 실제 GitHub Actions 실행 환경에서만 확정 가능하며 이 세션에서는 재현할 수 없었다). 저장소 자체 크기는 실측상 작다(`git count-objects -v`: pack 93MB, 커밋 2,363개) — 이 중복이 있더라도 절대 비용은 낮다.
  - 제안: 다음 CI 실행에서 체크아웃 직후 `git rev-parse origin/$BASE_REF` 가 이미 성공하는지 로그로 1회 확인 후, 중복이면 `Fetch base ref` 스텝 제거 검토.

- **[INFO]** 하네스 스위트 누적 실행시간과 고정 `timeout-minutes: 5` 의 여유폭 — CI 실측치 부재
  - 위치: `.github/workflows/harness-checks.yml:70`(`timeout-minutes: 5`), `:87-88`(`Run harness unit tests` 스텝)
  - 상세: 로컬 실측 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` = **827 tests / 125.256s**. 이 PR 이 추가한 `test_review_gate_ci.py` 는 그중 15개(2.4~2.6s, 전체의 ~2%)를 더한다. 개별 증분은 작지만, GitHub Actions 러너는 로컬 개발 머신보다 느린 경우가 흔하고(계수는 환경마다 달라 이 세션에서 실측 불가), 스위트가 파일 추가마다 계속 커지는 추세(README 자체가 기록)라 300초 예산 대비 실제 여유가 얼마인지는 로컬 수치만으로 단정할 수 없다.
  - 제안: 이번 및 다음 몇 차례 실제 CI 실행의 wall-clock 을 관찰해 여유폭을 확인. 여유가 줄어들면 무거운 서브프로세스 기반 테스트(이 파일 포함, `test_reap_merged_worktrees.py` 류)를 별도 job 으로 분리·병렬화하는 방안을 검토.

- **[WARNING]** (범위 외지만 같은 실행으로 확인된 실측 — `OneJudgeTest` 의 호출 검사가 deny-list 라 `os.path.*` 경유 재판정을 놓친다)
  - 위치: `.claude/tests/test_review_gate_ci.py:224`(`_ALLOWED_IMPORTS`), `:279-283`(금지 호출 목록)
  - 상세: 이 항목은 성능이 아니라 판정-무결성 문제지만, 스위트를 직접 실행하는 과정에서 위 "실행 요약"에 적은 라이브 변형을 통해 실측으로 확인됐으므로 기록한다. `scripts/check-review-gate.py` 에 삽입돼 있던 변형은 새 top-level import 를 추가하지 않고(`os` 는 이미 `_ALLOWED_IMPORTS` 에 있음) `os.walk`/`os.scandir`/`os.listdir`/`open` 도 호출하지 않는다 — 대신 `os.path.isdir` / `os.path.getmtime` 로 "두 번째 판정"을 만들어 `decision.blocked` 를 덮어쓴다. 이 상태에서 `OneJudgeTest` 를 직접 실행하면 **통과한다**(`test_the_script_performs_no_judgement_operations_of_its_own ... ok` 로 확인). 즉 import 는 allow-list 로 막혀 있지만 **호출은 여전히 (`os.walk` 등 4개짜리) deny-list** 라서, `os.path` 하위 임의 함수를 쓰는 재판정은 그대로 통과한다 — 스크립트/테스트 자신의 docstring 이 이미 세 번 반복됐다고 적은 것과 같은 실패 클래스의 네 번째 사례.
  - 제안: (기능/보안 담당 몫이지만) 호출 검사도 import 처럼 **허용 목록**으로 뒤집을 것(`review_guard.evaluate_review` 속성 접근 외 어떤 `os.*`/`sys.*` 속성 호출도 불필요하다면 그 자체를 화이트리스트로). 아울러 현재 작업 트리에 이 미커밋 변형이 남아 있어 다른 세션/리뷰어의 측정에도 영향을 줄 수 있으니 정리가 필요하다.

## 요약

`scripts/check-review-gate.py` 본체는 인자 파싱 → 게이트 1회 호출 → 출력이 전부인 얇은 CLI로, 루프·N+1·불필요한 메모리 할당이 없고 fail-open 경로도 즉시 반환해 성능상 결함이 없다. `review-gate.yml`/`harness-checks.yml` 의 변경분은 CI 워크플로 설정으로, `fetch-depth: 0` 전체 클론(저장소 크기 실측 93MB — 낮은 비용) 같은 의도된 트레이드오프 외에 새로운 비용 요소는 크지 않다. 실제 비용은 새로 추가된 `test_review_gate_ci.py` 테스트 스위트 쪽에 있으며, 매 테스트 메서드마다 디렉터리 전체 복사 + git 서브프로세스를 재생성하는 패턴(실측 15개/2.4s, 스위트 전체 827개/125s)은 개별 비용은 작지만 누적 성격의 비효율이라 `setUpClass` 승격으로 쉽게 줄일 수 있다. CRITICAL/HIGH 급 성능 결함은 없다. 부가적으로, 스위트를 직접 실행하는 과정에서 작업 트리에 이미 올라와 있던 미커밋 변형을 통해 `OneJudgeTest` 의 호출-검사가 여전히 deny-list 라 `os.path.*` 재판정을 놓친다는 사실을 실측했다 — 성능 스코프는 아니나 같은 실행에서 나온 재현 가능한 사실이라 함께 기록한다.

## 위험도

LOW
