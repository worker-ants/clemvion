# Plan 정합성 검토 — `plan/in-progress/harness-probe-isolation.md`

## 발견사항

- **[WARNING]** 같은 테스트 클래스를 대상으로 한 미해결 후속 항목이 인용되지 않았다
  - target 위치: §A 표 1번 행(`test_consistency_bundle_priority.py`, 클래스
    `TheDocumentBeingEditedIsNeverOmittedTest`) · §C "**판별력이 약해지지 않는가**" 단락
    ("옛 단언 `rank < tier0_size` 는 그 자리에서 `rank == 0` 과 같아져 오히려 강해진다")
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §"승격은 됐는데 굶는다 —
    tier 안의 거대 파일 하나가 corpus 몫을 다 먹는다" 하위 `### 미해결` 항목 2번째
    ("회귀 테스트의 주어를 순위에서 생존으로 옮긴다. 지금 이름이 `…IsNeverOmittedTest` 인데
    단언은 순위뿐이다. 캐너리: tier 1 의 1번 파일이 corpus 몫보다 큰 번들에서 2번 파일의
    본문이 살아 있는가. 이 캐너리는 오늘 RED 여야 한다")
  - 상세: `harness-review-gate-followups.md` 의 이 미해결 항목은 정확히 같은 파일·같은
    클래스(`test_consistency_bundle_priority.py::TheDocumentBeingEditedIsNeverOmittedTest`)를
    대상으로, 지금의 순위-단언(`rank < tier0_size`)을 생존-단언으로 바꾸고 다중 tier-1 파일
    시나리오(1번이 몫을 초과)의 캐너리를 이 클래스(또는 인접 클래스)에 추가할 것을 요구한다.
    target 은 이 클래스의 fixture 를 `make_probe_repo`(단일 서브트리 `spec/5-system` 복사,
    `origin/main == HEAD` 고정, "변경 집합은 프로브 하나")로 전면 재설계하면서, 이 미해결
    항목을 인용하거나 새 fixture 가 그 캐너리(다중 tier-1 파일, corpus 초과) 시나리오와
    공존 가능한지 검토하지 않았다. target 자신은 "브랜치가 커밋한 다른 spec 이 tier 0 을
    부풀리는 일이 없다" 를 강점으로 서술하는데, 이는 정확히 그 미해결 항목이 다루려는
    "여러 tier-1 파일" 축을 이 fixture 에서 구조적으로 배제한다는 뜻이기도 하다 — 다른
    클래스(`PriorityThenTruncationTest` 등, 실 `ROOT` 기반·비-쓰기)가 그 축을 이미 커버하고
    있어 치명적 결손은 아니지만, target 이 이 교차점을 언급하지 않은 채 같은 파일의 fixture
    를 먼저 재설계하면 그 캐너리를 나중에 추가할 사람이 "왜 이 클래스는 다중 파일을 못
    받는가" 를 다시 조사해야 한다.
  - 제안: target §C 또는 §E 체크리스트에 `harness-review-gate-followups.md` 의 이 미해결
    항목을 상호 참조로 한 줄 추가하고, 새 캐너리가 들어갈 자리(같은 클래스인지 별도
    `ROOT` 기반 클래스인지)를 명시할 것. 코드 자체를 바꿀 필요는 없다 — 두 plan 문서 간
    교차 참조 누락 정정이면 충분하다.

- **[INFO]** 신설 헬퍼가 기존 안전장치(`git_in`/`make_temp_git_repo`)를 재사용하는지 미명시
  - target 위치: §C 처방 표 1번 (`_harness.make_probe_repo(path, *subtrees)`)
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §13 "테스트 픽스처가 공유
    `.git/config` 를 오염시킬 수 있다" — `git_in()`(`-C` + `GIT_CEILING_DIRECTORIES` +
    임시디렉터리 realpath 단언) 도입 배경(2026-08-06 실사고)과, 같은 절의 "잔여
    (12R 재집계): pre-existing 4곳" 목록(그중 하나가 바로 `test_consistency_bundle_priority.py`)
  - 상세: `_harness.py` 에는 이미 정확히 이 계급의 사고(임시 저장소 밖 실 워크트리 오염)를
    막기 위해 만들어진 `git_in`/`make_temp_git_repo` 가 있다. target 의 `make_probe_repo` 는
    개념적으로 그 위에 "실 서브트리 복사 + 커밋 + `origin/main` ref 설정" 을 얹는 것으로
    읽히지만, 문서에 그 재사용 관계가 명시돼 있지 않다. 같은 파일에 대해 §13 이 지목한
    "pre-existing 4곳" 중 하나가 바로 `test_consistency_bundle_priority.py` 라는 점에서,
    이번 재설계가 그 잔여 항목을 우연히 닫을 수도, 반대로 안전장치 없이 새 코드를 얹어
    같은 사고 패턴(cwd 밖 git 상향 탐색)을 재현할 수도 있다.
  - 제안: 구현 시(코드 리뷰 단계에서) `make_probe_repo` 가 `git_in` 을 통해서만 git 을
    구동하는지 확인하고, 확인되면 target §E 체크리스트에 "§13 잔여 4곳 중
    `test_consistency_bundle_priority.py` 동시 해소" 한 줄을 추가해 `harness-review-gate-followups.md`
    쪽 항목도 갱신할 것.

## 요약

target(`harness-probe-isolation.md`)이 닫으려는 트래커 항목(`spec-draft-nullable-notation-followups.md`
의 "하네스 테스트 둘이 실제 저장소 트리에 프로브를 쓴다")과 그 처방 후보 서술은 target 의 §A~§D 서술과
정확히 일치하고, 트래커가 "둘" 이라 적은 것을 "넷" 으로 넓힌 근거(§A)도 자체 완결적이다. 트래커가
"결정 필요" 로 명시해 둔 항목은 없고, target 이 고른 설계(임시 저장소 사본 + 루트 주입)는 두 후보 중
하나를 선택하는 정상적인 구현 판단이라 미해결 결정을 우회하는 것으로 보이지 않는다. `_shared/git_probe.py`
의 `worktree_changed_files`/`_edited_rels` 합집합(완료됨, "changeset 으로는 쓰지 말 것" 제약 포함)과
`--spec` 세션의 draft 스냅샷 설계(완료됨) 등 target 이 전제하는 선행 작업은 모두 이미 종결 상태로 확인된다.
다만 target 이 재설계하려는 정확히 그 테스트 클래스(`TheDocumentBeingEditedIsNeverOmittedTest`)에 대해
`harness-review-gate-followups.md` 가 아직 열어 둔 후속 항목(순위→생존 전환 캐너리)이 있는데 target 이
이를 인지·인용하지 않는다 — 기능적 충돌은 아니지만 plan 간 교차 참조 갱신이 필요한 WARNING 이다.

## 위험도
LOW
