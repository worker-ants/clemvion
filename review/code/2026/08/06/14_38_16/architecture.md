# 아키텍처 리뷰 — CI 백스톱 (round 11)

## 조사 범위와 방법

프롬프트에 포함된 15개 파일 전부를 확인했다. `review_guard.py`(52KB)·`.claude/tests/README.md`(45KB로 안내됐으나 실제 102줄)는 프롬프트에서 잘려 `Read` 로 직접 열어 확인했다. `test_block_integrity.py`·`test_review_guard_hardening.py`도 잘려 있었는데, 다른 리뷰어(behavior/testing)가 판정 로직 자체를 다루므로 아키텍처 관점에서는 클래스 구조·인터페이스 계약만 `grep` 으로 훑었다(전문 정독은 아님 — 아래 한계 참조).

작업 트리는 커밋된 상태 그대로이며 수정하지 않았다(`git status` — untracked 는 본 리뷰 세션 산출물 디렉터리뿐). 아래 인용 라인 번호는 각 파일을 `Read` 로 직접 연 실제 소스 줄 번호다.

## 발견사항

- **[INFO]** `_default_branch()` 에 죽은 조건문(`if True:`)이 남아 있다 — 리팩터 잔재
  - 위치: `.claude/_shared/git_probe.py:140`
  - 상세: 10R 리팩터 전에는 `_origin_default_branch` 가 `branch_guard.py` 를 동적 import 해 얻은 함수 참조였고, `if resolver is not None:` 이 "그 함수를 실제로 얻었는가"를 판별했다. 이번 라운드에서 `_origin_default_branch` 가 `_shared` 안의 실함수로 바뀌면서 그 참조는 늘 존재하게 됐는데, 조건문 자체는 `if True:` 로 형태만 남기고 지워지지 않았다. 동작에는 영향이 없다(늘 참이므로 `try` 블록이 항상 실행된다) — 순수하게 가독성·유지보수성 문제다. 다음 사람이 `if True:` 를 보고 "여기 뭔가 조건부로 게이트할 계획이었나" 하고 잘못 추측하거나, 그 자리에 새 분기를 끼워 넣을 때 무의미한 들여쓰기 한 겹을 그대로 물려받기 쉽다.
  - 제안: `if True:` 와 그 아래 블록을 평탄화한다(`try: ... except Exception: pass` 를 함수 최상위로).

- **[WARNING]** "origin 기본 브랜치 해석"이 여전히 4곳에 독립 구현돼 있고, 그중 2곳은 이번 통합 대상 밖이다
  - 위치: 정본 `.claude/_shared/git_probe.py:46`(`_origin_default_branch`, bare `main` 반환) · 재구현 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1128`(`_default_branch_ref`, `origin/main` 반환 — **반환 계약이 다르다**) · 리터럴 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:413`(`args.diff_base or "origin/main"`)
  - 상세: 이번 11라운드에 걸친 작업 전체가 "같은 판정 로직이 손으로 복제되면 drift 한다"는 것을 세 번(`report_paths`, `retry_state`, git probe 자신) 반증하며 `_shared/` 로 정본을 통합해 왔다. 그런데 그 통합은 `hooks/_lib` 세 모듈(`review_guard`/`plan_guard`/`branch_guard`)에만 미쳤고, `skills/` 아래 두 orchestrator(`code_review_orchestrator.py`·`consistency_orchestrator.py`)는 같은 개념("origin 의 기본 브랜치가 무엇인가")을 여전히 각자 재구현하거나 리터럴로 하드코딩하고 있다. 반환 계약도 서로 다르다 — `git_probe` 는 `"main"`, `code_review_orchestrator` 는 `"origin/main"` — 그래서 단순 위임으로 통합할 수도 없다. 기본 브랜치 정책이 바뀌면(예: `main` → `trunk`) 4곳을 전부 고쳐야 하고, 하나라도 놓치면 이 저장소가 이미 겪은 것과 정확히 같은 clase 의 침묵 drift 가 된다.
  - 근거(실측): `grep -n '"origin/main"' .claude/skills/consistency-checker/scripts/consistency_orchestrator.py` → 413행. `grep -n "def _default_branch_ref" .claude/skills/code-review-agents/scripts/code_review_orchestrator.py` → 1128행.
  - 상태: 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 하단 "신규 후속 (defer)" 항목에 정확히 이 4곳으로 기록돼 있고, 실제 코드 공유는 `hooks/_lib`·`skills/_lib` 네임스페이스 충돌 해소가 선행돼야 한다는 이유로 의식적으로 defer 돼 있다 — 그래서 CRITICAL 로 올리지 않는다. 다만 이번 라운드가 "판정자 하나"를 세 모듈에 대해서는 강하게(파생 AST 비교 테스트로) 고정해 놓고 정작 판정에 쓰이는 입력 중 하나(diff base)는 skills 쪽에서 여전히 흩어져 있다는 비대칭은, 이 PR 이 주장하는 아키텍처 목표(단일 판정자) 범위를 다시 확인시켜 줄 가치가 있어 남긴다.
  - 제안: 새 항목이 아니라 기존 plan 항목의 우선순위 재확인 — `_lib` 네임스페이스 충돌이 해소되기 전까지는, 최소한 두 orchestrator의 반환 계약을 나란히 문서화(예: 함수 docstring에 "이 4곳 중 하나, `origin/main` 계약" 명시)해 다음 사람이 실수로 다섯 번째 사본을 만들지 않게 한다.

## 긍정적으로 확인된 아키텍처 특성

- **레이어 경계가 깨끗하다.** `.claude/_shared/git_probe.py`·`report_paths.py`·`block_integrity.py` 모두 `os`/`re`/`subprocess` 외 의존이 없는 리프(leaf) 모듈이고, `hooks/`·`skills/` 어느 쪽도 임포트하지 않는다(`grep -rn "hooks" .claude/_shared/*.py` 로 확인 — 매치는 전부 주석/docstring). 순환 의존 없음.
- **역방향 의존 제거.** 10R 이전 `_shared/git_probe.py::_origin_default_branch` 는 `importlib.util.spec_from_file_location` 으로 `hooks/_lib/branch_guard.py` 를 런타임에 동적 로드하는 역참조를 갖고 있었다(공유 모듈이 소비자를 되돌아보는 안티패턴). 이번 라운드에서 그 함수 자체를 `_shared` 로 옮겨 역방향 의존을 완전히 없앴다 — `git diff e834d0f4e 9a7b28764` 로 확인.
- **"열거"에서 "도출"로.** `test_plan_guard.py::GitProbesAreNotReDuplicatedTest` 가 손으로 쓴 함수 이름 목록(9R 통합에서 여섯 번째 함수를 빠뜨린 원인) 대신 세 모듈의 AST 를 서로 비교해 본문이 동일한 함수가 남아 있으면 그 자체로 실패시키는 구조로 바뀌었다. 유지보수 부담을 사람의 기억에서 기계적 비교로 옮긴 정당한 설계 개선.
- **결정 객체의 인터페이스 분리가 일관적이다.** `ReviewDecision`/`PlanDecision` 은 각자 다른 필드(`blocked` vs `untouched`)를 갖지만 둘 다 `push_blocks` 프로퍼티로 정규화해 push 훅이 게이트별 필드명을 몰라도 되게 한다. 반대로 `branch_guard.GuardDecision` 은 push/stop 게이트에 소비되지 않으므로 `push_blocks` 를 갖지 않는다 — 필요한 곳에만 계약을 부여하는 정확한 인터페이스 분리다. `test_block_integrity.py::PlanStubsMirrorTheRealInterfaceTest` 가 이 계약을 구조적으로(리스코프 치환 위반 시 실패하도록) 고정한다.
- **관측 로직의 정당한 추출.** `failopen_state.py` 는 push/stop 두 훅이 공유하는 "게이트가 fail-open 했음을 세고 알린다" 책임을 스트림·상태파일명·라벨을 파라미터화해 추출했다(다른 두 곳은 하드코딩하지 않음) — `report_paths`/`retry_state`/`git_probe` 와 같은 계열의 올바른 DRY 적용.
- **CI 백스톱의 "판정자 하나" 설계.** `scripts/check-review-gate.py` 는 자체 판정 로직을 두지 않고 로컬 훅과 동일한 `review_guard.evaluate_review()` 를 그대로 호출한다. `.claude/` 밖 `scripts/` 에서 `.claude/hooks/_lib` (원래 훅 내부 전용 네임스페이스)을 임포트하는 것은 레이어 경계를 다소 흐리지만, 이는 "두 번째 구현을 만들면 로컬/CI 판정이 갈린다"는 이 PR 시리즈 전체의 핵심 교훈에서 나온 의도된 트레이드오프이고 문서화돼 있다 — 결함이 아니라 설계 선택.

## 이미 알려진 한계 (재보고하지 않음)

지시받은 대로 다음은 CRITICAL 로 다시 올리지 않는다: (1) `WorkflowWiringTest` 의 기대값과 그 대상을 같이 편집하면 항상 통과하는 성질, (2) `Fetch base ref` 스텝이 `fetch-depth: 0` 위에서 실제로 필요한지는 실제 Actions 러너 없이는 미확인, (3) 게이트가 "리뷰가 실제로 수행됐는가"가 아니라 "산출물이 존재하고 형태가 맞는가"만 검증한다는 신뢰 모델(=`--enforce` 전환의 선행조건).

## 요약

이 저장소가 CI 백스톱을 얹기 위해 10라운드에 걸쳐 반복한 패턴 — 손 복제된 판정 로직을 단일 공유 모듈로 옮기고, 그 통합을 지키는 가드를 "열거"에서 "도출"로 바꾸는 것 — 이 `hooks/_lib` 세 모듈(`review_guard`·`plan_guard`·`branch_guard`) 사이에서는 이번 라운드에 실제로 완결됐다. 순환 의존이 없고, 이전에 있던 역방향 의존(공유 모듈이 훅 모듈을 동적 import)도 제거됐으며, 결정 객체 간 인터페이스도 필요한 만큼만 공유하도록 일관되게 설계돼 있다. CI 백스톱(`scripts/check-review-gate.py` + `review-gate.yml`)은 자체 판정 로직 없이 같은 `evaluate_review()` 에 위임하는 올바른 형태다. 남은 아키텍처 부채는 두 가지뿐이다 — 리팩터가 남긴 무해한 죽은 조건문 하나(INFO), 그리고 "기본 브랜치 해석"이라는 같은 개념이 `skills/` 아래 두 orchestrator 에서는 아직 통합 범위 밖에 있어 반환 계약까지 서로 다른 채 남아 있다는 것(WARNING, 이미 plan 에 defer 로 기록돼 있고 `_lib` 네임스페이스 충돌 해소가 선행 조건). 둘 다 지금 당장 PR 판정을 바꿀 수 있는 살아있는 결함은 아니다.

## 위험도

LOW
