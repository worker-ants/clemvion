# 동시성(Concurrency) 리뷰

## 개요

이번 diff 는 `.claude/tests/` 하네스 테스트 4개(`_harness.py`, `test_consistency_bundle_priority.py`,
`test_consistency_spec_draft_snapshot.py`, `test_consistency_target_validation.py`,
`test_router_decision_trust.py`)가 공유 워크트리(`REPO_ROOT`)의 실제 파일 — 추적된 spec, `plan/in-progress/`
고정 이름 파일, `review/consistency/` 세션, 저장소 루트 `mkdtemp` — 에 직접 프로브를 쓰고 `cp` 로 원복하던 패턴을,
프로세스마다 격리된 임시 git 저장소 사본(`_harness.make_temp_repo_copy`)이나 임시 출력 디렉터리
(`CONSISTENCY_OUTPUT_DIR`/`REVIEW_OUTPUT_DIR` 재지정)로 옮긴 **경쟁 조건 수정**이다. 나머지 파일
(`README.md`, `CHANGELOG.md`, `plan/**`, `review/**`)은 그 수정의 문서·산출물로 코드 동시성과 무관하다.

이전 라운드(`review/code/2026/09/25/10_27_27/concurrency.md`)가 같은 설계를 이미 LOW 로 평가했고, 이번 diff 는
그 라운드의 WARNING 2건(빈 `subtrees` 호출 시 `CalledProcessError`, 부트스트랩 중복)을 해소한 결과물을 포함한다.
두 수정 모두 동시성 설계 자체는 바꾸지 않았고(락 없는 "공유 제거"), 새로 도입된 경쟁·동기화 결함은 발견되지 않았다.

## 발견사항

- **[INFO]** `make_temp_repo_copy` 는 살아있는 워킹트리를 파일 단위로 순차 복사한다 — torn read 이론적 여지
  - 위치: `.claude/tests/_harness.py:163`~`171` (`make_temp_repo_copy`, `shutil.copytree(REPO_ROOT / rel, repo / rel)` 는 게이트 167)
  - 상세: `shutil.copytree` 는 git 객체가 아니라 그 순간의 워킹트리 파일을 하나씩 읽는다. 복사가 진행되는 동안
    같은 `subtrees` 아래를 다른 프로세스(사람의 `Edit`, 다른 세션의 커밋 전 저장)가 동시에 고치면 서로 다른
    파일이 서로 다른 시점의 내용으로 섞인 사본이 만들어질 수 있다. docstring 자체가 "closes the write side"
    라고 범위를 명시해 두어 오독 여지는 이전 라운드보다 줄었다. 이번 PR 이 실측·재현한 경쟁 클래스(테스트끼리의
    **쓰기** 경쟁, §B)와는 다른 축이고 재현되지 않았다 — 위험도는 낮다.
  - 제안: 조치 불요(정보 제공). 후속에서 굳이 닫으려면 복사 전 `git stash`/`git diff --quiet` 로 워킹트리가
    안정 상태인지 확인하는 정도가 있으나, 이 스코프의 문제(테스트 간 쓰기 경쟁)와는 별개다.

- **[INFO]** 격리 규약이 런타임 가드 없이 문서(README)에만 의존 — 새 위반은 자동으로 안 걸린다
  - 위치: `.claude/tests/README.md:109`~`118` (신설 bullet "Never write into this checkout")
  - 상세: 이번 PR 로 기존 4개는 고쳐졌지만, 다섯 번째 테스트가 다시 `REPO_ROOT` 에 직접 쓰는 프로브를 추가해도
    이를 막는 상시 CI 가드는 diff 에 없다. plan(`plan/in-progress/harness-probe-isolation.md` §A)의 감사
    훅(`sys.addaudithook`)은 이번 회귀를 **측정**하는 데만 쓰였고 상시화되지 않았다. 이 갭은 developer 가
    같은 plan 문서와 `harness-review-gate-followups.md`(트래커, 2026-09-25 등재)에 이미 INFO 로 등재해
    둔 상태이므로 이번 라운드에서 새로 지적할 사항은 아니다.
  - 제안: 조치 불요 — 이미 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md` 신설 항목)에
    등재됨.

## 검증 관점별 확인

- **경쟁 조건**: 핵심 수정 대상. 프로세스별 `tempfile.TemporaryDirectory()`/`mkdtemp()` + `_harness.make_temp_repo_copy`
  로 공유 가변 상태(추적 spec, 고정 이름 draft/plan 파일, `review/consistency/` 세션, 저장소 루트 임시
  디렉터리)에 대한 쓰기가 프로세스별 격리 경로로 옮겨졌다. `orch._edited_rels`/`_branch_changed_rels`
  (`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`)와 그 기반 `_shared/git_probe.py`
  의 git 호출은 모두 `root`/`cwd` 인자를 명시적으로 받아 그 값으로 `git -C`/`cwd=` 를 건다 — 확인 결과
  `run_in_orchestrator` 의 서브프로세스 자체 cwd 가 여전히 `REPO_ROOT`(실제 체크아웃)이어도, 프로브가 읽는
  git 상태는 인자로 넘긴 임시 사본(`root`)이라 실제 체크아웃으로 새지 않는다(`consistency_orchestrator.py:239-280`,
  `.claude/_shared/git_probe.py:171,200,299`). plan §E 의 재현 실험(고치기 전 잔여 5/6·실패 22/24 → 고친
  뒤 잔여 0/6·실패 0/24)과 뮤테이션 테스트(§D, P1~P7 전부 KILLED, `TheRepoCopyFixtureTest` 로 P5 계약 보강)가
  효과를 뒷받침한다.
- **데드락**: 락을 도입하지 않았으므로 해당 없음.
- **동기화**: mutex/semaphore 대신 "공유 자체를 없애는" 설계 — 테스트마다 유일한 임시 루트를 쓰므로 락이
  불필요하다. 적절하다.
- **스레드 안전성**: 스레드가 아니라 별도 **프로세스**(pytest, `run_in_orchestrator` 의 fresh interpreter
  subprocess) 간 공유 파일시스템 경쟁을 다룬다. `orch._edited_rels = lambda ...` 같은 몽키패치도 매 테스트가
  새 서브프로세스에서 orchestrator 를 재 import 하므로 `sys.modules` 오염이나 전역 상태 공유가 없다.
- **원자성**: `make_temp_repo_copy` 내부 `add -A` → `commit --allow-empty` → `update-ref` 세 단계는 그
  저장소가 해당 프로세스 전용이라 다른 프로세스의 개입 없이 순차 실행되고, `git_in` 이 `check=True` 로 각
  단계 완료를 보장한다. `subtrees` 가 비어도 `--allow-empty` 로 커밋이 실패하지 않아(이전 라운드 WARNING 1
  해소) 이 시퀀스가 전 입력에서 정의된다.
- **async/await, 이벤트 루프, 리소스 풀링**: 이 diff 범위에는 비동기 코드·이벤트 루프·스레드/커넥션 풀이
  없다 — 전부 동기 `subprocess.run` 기반 테스트 하네스 코드다.

## 요약

핵심 변경은 병렬 pytest 실행이 공유 워크트리 파일을 밟던 실측 경쟁 조건(4개 동시 실행 6라운드 중 5라운드
잔여, 24개 중 22개 실패)을 락 기반 직렬화가 아니라 프로세스별 격리(임시 git 저장소 사본 + 임시 출력 디렉터리)
로 근본 제거한 것이다. `orch` 의 git 프로브가 인자로 받은 `root` 를 그대로 `git -C`/`cwd=` 에 쓰는 것을 직접
추적 확인해, 서브프로세스 자체의 cwd(`REPO_ROOT`)가 격리를 새게 하지 않음을 검증했다. 새 코드
(`_harness.make_temp_repo_copy`, 다섯 테스트의 임시 디렉터리 사용)에서 새로운 경쟁 조건·동기화 결함은 없다.
남은 항목은 이전 라운드부터 이어진 두 개의 저위험 INFO(파일 단위 복사의 이론적 torn read, 런타임 가드 부재)
뿐이며 이미 백로그에 등재되어 있어 병합을 막을 사유가 아니다.

## 위험도

LOW
