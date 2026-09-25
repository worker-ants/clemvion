# 신규 식별자 충돌 검토 — `plan/in-progress/harness-probe-isolation.md`

## 발견사항

- **[WARNING]** `make_probe_repo` 가 기존 `make_temp_git_repo` 와 이름·역할이 겹친다
  - target 신규 식별자: `_harness.make_probe_repo(path, *subtrees)` (§C 처방 표 #1, 채택안)
  - 기존 사용처: `.claude/tests/_harness.py:119` `def make_temp_git_repo(path: Path | str, *, branch: str = "main", initial_commit: bool = True) -> Path` — 이미 "임시 디렉터리에 git 저장소를 만들고 초기 커밋까지 한다" 는 정확히 같은 1차 동작을 수행하며, `test_branch_diff_shared.py` 등 5개 파일에서 널리 재사용 중이다.
  - 상세: 두 함수 모두 같은 모듈(`_harness.py`)에 살고, 같은 `make_*` 접두사 컨벤션을 따르며, "path 를 받아 임시 git 저장소를 만들어 반환" 이라는 동일한 shape 이다. 차이는 `make_probe_repo` 가 추가로 실 저장소의 서브트리(`spec/5-system` 등)를 복사해 커밋하고 `refs/remotes/origin/main` 을 그 커밋에 맞춘다는 점뿐이다(§C 본문 "복사·커밋하고 refs/remotes/origin/main 을 그 커밋에 둔다"). 이대로 두 함수를 독립 구현하면 git init/identity 설정 로직이 두 곳에 중복되고, 다음 사람이 "임시 git 저장소가 필요할 때 어느 헬퍼를 쓸지" 헷갈릴 여지가 있다 — 특히 `make_temp_git_repo` 는 이미 `initial_commit` 옵션이 있어 "서브트리를 커밋해 넣는" 확장이 자연스러워 보이는 자리다.
  - 제안: `make_probe_repo` 의 docstring/구현에서 `make_temp_git_repo` 를 내부적으로 호출(위임)하도록 명시하거나, 최소한 두 함수의 관계(하나가 다른 하나의 상위 집합)를 docstring 한 줄로 밝혀 이름의 근접성이 실제 중복 유지보수로 번지지 않게 한다. 이름 자체를 바꿀 필요는 없다(§처방 테이블의 의도와 일치).

- **[INFO]** "probe" 라는 단어가 이미 이 하네스 안에서 다른 의미로도 쓰인다
  - target 신규 식별자: `make_probe_repo` (그리고 문서 전반의 "프로브" = 테스트가 남기는 마커/잔여물이라는 뜻)
  - 기존 사용처: `.claude/tests/_shared/git_probe.py` 및 이를 참조하는 `plan/in-progress/harness-review-gate-followups.md` — 여기서 "probe" 는 "git 명령을 감싸 상태를 조회하는 공유 모듈"(`git_probe.branch_diff_files`, `git_probe.worktree_changed_files`)이라는 별개 의미로 굳어 있다.
  - 상세: 식별자 자체(`make_probe_repo` vs `git_probe`)는 겹치지 않아 실제 충돌은 아니지만, 같은 하네스 코드베이스 안에서 "probe" 가 (a) git 조회 유틸리티, (b) 테스트가 실 트리에 남기는 잔여 마커 라는 두 가지 뜻으로 쓰이고 있어 리뷰어가 셋 중 어느 뜻인지 문맥 없이 헷갈릴 수 있다. target 문서 자체도 §D 에서 `git_probe.worktree_changed_files`(P2 뮤턴트 대상)를 그대로 재사용하므로 두 "probe" 가 한 문서 안에 공존한다.
  - 제안: 조치 불필요 — 다만 `make_probe_repo` 구현 시 docstring 첫 줄에 "이것은 `_shared/git_probe.py` 와 무관한, 실 트리 격리용 임시 저장소 헬퍼" 라고 한 줄 명시하면 향후 grep 혼동을 줄인다.

- **[정보 확인 — 충돌 아님]** `CONSISTENCY_OUTPUT_DIR` 은 이미 존재하는 env var 이며 target 의 §C 처방 후보 #3 은 그 기존 정의와 정확히 같은 의미로 쓰였다
  - 기존 사용처: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:81` `os.environ.get("CONSISTENCY_OUTPUT_DIR", "./review/consistency")`
  - 상세: target 문서는 이 env var 를 새로 도입하는 것이 아니라 (기각된) 대안으로 인용만 한다. 의미 차이 없음 — 충돌 없음. 참고용으로만 기록.

## 요약

target 문서(`plan/in-progress/harness-probe-isolation.md`)가 실제로 새로 도입하는 식별자는 `_harness.make_probe_repo(path, *subtrees)` 하나뿐이며, 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·설정키·spec 파일 경로 축에서는 충돌이 없다(spec_impact: none 이 맞고, `CONSISTENCY_OUTPUT_DIR` 인용도 기존 정의와 일치한다). 유일한 주의점은 `make_probe_repo` 가 같은 파일(`_harness.py`) 안의 기존 `make_temp_git_repo` 와 이름·역할이 근접해 두 헬퍼의 관계를 문서화하지 않으면 중복 유지보수·오사용 여지가 생긴다는 것과, "probe" 라는 단어가 `_shared/git_probe.py` 와 다른 의미로 이미 쓰이고 있어 문맥상 혼동 가능성이 있다는 것이다. 둘 다 구현 단계에서 docstring 한두 줄로 해소 가능한 수준이라 병합을 막을 사안은 아니다.

## 위험도
LOW
