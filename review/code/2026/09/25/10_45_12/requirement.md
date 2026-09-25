# 요구사항(Requirement) 리뷰 — harness-probe-isolation (2라운드, `10_45_12`)

## 검증 절차

이번 라운드는 `origin/main...HEAD` 누적 diff(17개+ 파일: `.claude/tests/**` 하네스 코드 4종 +
`_harness.py` + `README.md` + `CHANGELOG.md` + `plan/**` + `review/code/2026/09/25/10_27_27/**`
(1라운드 리뷰 산출물) + `review/consistency/2026/09/25/09_56_00/**`)를 대상으로 한다. 1라운드
(`10_27_27`)가 이미 Warning 2건(빈 `subtrees` 호출 시 `CalledProcessError`, 부트스트랩 3줄 중복)을
찾았고 `89ae9fa24`가 그 직후 고쳤다는 `RESOLUTION.md`의 주장을 **재현하지 않고 받아쓰지 않기 위해**
저장소 파일을 직접 `Read`/실행으로 대조했다(뮤테이션 없음, 저장소는 읽기만 함):

- `.claude/tests/_harness.py`의 `make_temp_repo_copy` 실물을 열어 `git commit -q --allow-empty
  -m "copy of this checkout"`가 실제로 들어가 있음을 확인(W1 수정 실재).
- `test_consistency_bundle_priority.py`에서 다섯 호출부가 전부 `five_system_copy(tmp)` 한 헬퍼로
  수렴했음을 `grep`으로 확인(W2 수정 실재) — `orchestrator_preamble(extra=...)`로 주입된 공용 스니펫.
- `test_no_subtrees_is_an_empty_copy_not_an_error`(경계 테스트)가 실제로 존재하고 `tracked ==
  [".gitkeep"]` / `ref == head`를 단언함을 확인.
- `python3 -m pytest .claude/tests/test_consistency_bundle_priority.py
  test_consistency_spec_draft_snapshot.py test_consistency_target_validation.py
  test_router_decision_trust.py -q` → **74 passed, 4 subtests passed**(1라운드 실측 73 대비 +1 —
  W1 수정과 함께 추가된 경계 테스트 하나만큼 증가, 정합).
- `python3 -m pytest .claude/tests -q` 전체 → **1175 passed**(plan §F 체크리스트 수치와 일치).
- `git status --short` — 실행 전후 이 리뷰 세션 디렉터리 외 변경 없음(트리 무오염 확인).
- `grep -rn "make_temp_repo_copy\|make_probe_repo" spec/` → 0건 — 이 변경 영역을 규율하는 product
  spec 문서가 실재하지 않음을 직접 확인(아래 spec fidelity 참고).
- `.claude/tests/{_harness.py,test_consistency_*.py,test_router_decision_trust.py,README.md}`에
  TODO/FIXME/HACK/XXX 없음(grep 확인).

## 발견사항

- **[INFO]** spec fidelity — 이 변경 영역을 정의하는 product spec 문서가 존재하지 않는다
  - 위치: `plan/in-progress/harness-probe-isolation.md:6`(`spec_impact: none`), 실제 코드
    `.claude/tests/_harness.py`(`make_temp_repo_copy` 함수 전체), 4개 테스트 파일
  - 상세: 변경 전부가 `.claude/tests/**` pytest 하네스의 fixture 격리이며, `codebase/**`나
    `spec/**`가 정의하는 어떤 API·엔티티·요구사항 ID·상태 전이도 건드리지 않는다.
    `grep -rn "make_temp_repo_copy" spec/`가 0건임을 직접 확인했다 — spec 누락이 아니라 이
    계층(harness)에 대응하는 spec 자체가 없는 영역이다(CLAUDE.md 상 harness 는 governance 문서로만
    규율됨, 코드 리뷰 게이트도 `codebase/**` 스코프 밖). 1라운드(`10_27_27/requirement.md`)도 동일
    결론(NONE)을 냈고 이번 라운드에서 독립적으로 재확인했다.
  - 제안: 조치 불요. spec 문서 신설이 필요한 영역이 아니다.

- **[INFO]** 1라운드 Warning 2건이 코드 레벨에서 실제로 해소됐음을 직접 확인(재발 없음)
  - 위치: `.claude/tests/_harness.py`의 `make_temp_repo_copy`(`git commit -q --allow-empty` 행),
    `.claude/tests/test_consistency_bundle_priority.py`의 `five_system_copy` 헬퍼(오케스트레이터
    preamble에 주입, 5개 호출부가 공유)
  - 상세: `RESOLUTION.md`의 주장을 그대로 받아쓰지 않고 소스와 테스트 실행으로 독립 재현했다.
    빈 `subtrees` 호출은 이제 `CalledProcessError` 대신 "ref 만 있는 임시 저장소"를 반환하고
    (`test_no_subtrees_is_an_empty_copy_not_an_error`가 경계를 고정), 부트스트랩 3줄 중복은
    `five_system_copy(tmp)` 한 곳으로 수렴했다(다섯 호출부 모두 이 헬퍼를 부른다 — `grep` 6곳 매치,
    정의 1 + 사용 5).
  - 제안: 조치 불요 — 재-flag 대상 아님. 참고용으로만 기록(다음 라운드가 "이미 고쳤는데 또
    지적한다"는 오탐을 내지 않도록).

## 기능 완전성 · 엣지 케이스 · 에러 시나리오 · 반환값 (독립 확인)

- `make_temp_repo_copy(path, *subtrees)`는 0개/1개/중첩 subtree 세 경우 모두 정의된 동작을 갖는다
  — 0개는 빈 커밋(테스트로 고정), 1개는 정상 경로(4개 실 호출부 전부 이 경로, 74 passed로 확인),
  중첩(`("spec", "spec/5-system")`)은 `shutil.copytree`가 `FileExistsError`로 즉시 크래시한다(조용한
  실패 아님). 현재 호출부에 중첩 케이스가 없어 실사용 경로에는 영향 없다 — 1라운드가 이미 INFO로
  적절히 낮춰 잡았고 재확인 결과도 같다.
  변경 없으면 별도 조치 불요.
- 모든 경로에서 `Path` 반환(`make_temp_repo_copy`) — 예외 경로(git 실패)는 `git_in`의
  `check=True`가 `CalledProcessError`를 던져 "조용한 None 반환" 같은 반환값 결함은 없다.
  실측 확인: 이제 유일했던 예외 경로(0-subtree)가 `--allow-empty`로 제거됐다.

## 요약

1라운드(`10_27_27`, 10개 reviewer)가 이미 Critical 0·Warning 2·INFO 10으로 정밀하게 훑었고, 그
Warning 2건은 `89ae9fa24`가 곧바로 고쳤다. 이번 2라운드는 그 수정 사실을 리뷰 산출물 텍스트로
받아쓰지 않고 실제 `.claude/tests/_harness.py`·테스트 파일을 열어 코드 레벨로 재확인했으며, 전체
하네스(1175 passed)와 대상 4개 파일(74 passed)을 직접 재실행해 정합성을 검증했다. 새로운
Critical/Warning 급 요구사항 결함은 발견하지 않았다. spec fidelity 관점에서는 이 변경이 어떤 product
spec 표면도 정의·변경하지 않아(직접 grep으로 0건 확인) 해당 항목은 적용 대상 밖(INFO)이다.
TODO/FIXME/HACK/XXX 류 미완성 표시는 없고, 비즈니스 로직(격리 설계: 락 대신 공유 제거)이 plan
§C~§E의 재현·뮤턴트 실측과 정확히 일치하며, 함수명(`make_temp_repo_copy`)과 실제 구현(`make_temp_git_repo`
위임 + subtree 복사·커밋 + `origin/main` ref 고정) 사이의 괴리도 없다. 저장소 트리는 리뷰 전 과정
동안 무오염 상태로 유지됐다(`git status --short` 확인).

## 위험도

NONE
