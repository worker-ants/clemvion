# 테스트(Testing) 리뷰

## 조사 방법

프롬프트가 이번 라운드(`14_46_37`)의 실제 코드 델타 다수를 크기 제한으로 생략했으므로(파일
5·6·7·8·9 등), `git show --stat 2b71fd9f7`(직전 라운드 `14_32_02` 의 WARNING/CRITICAL 5건을
반영한 HEAD 커밋)로 실제 diff를 직접 열람했다. 오케스트레이터로부터 별도 지시받은 두 항목을
집중 검증했다:

1. `_make_deletion_only_repo` + 3 테스트(`test_the_repo_really_is_deletion_only`,
   `test_a_deletion_only_commit_is_never_selected`,
   `test_the_selected_commit_still_has_resolvable_content`)의 비-vacuity 여부 — **직접
   뮤테이션을 주입해 실측**했다(아래 §1).
2. 직전 라운드 INFO였던 `_bulleted_path_sample` 20개 초과 절단 분기의 미검증 잔존 여부 — 소스와
   테스트 스위트를 대조해 **현재 상태**를 재판정했다(아래 §2).

`.claude/tests/test_line_anchors.py` 전체(40건)와 `test_review_prepare_single_session.py`
전체(19건)를 `python3 -m unittest`로 직접 실행해 통과를 확인했다. 뮤테이션은 이 워크트리가
다른 세션과 공유되므로 **소스가 아니라 테스트 파일만** 일시적으로 편집했고, 검증 직후
`/private/tmp/.../scratchpad/test_line_anchors.py.bak`(사전에 뜬 백업)으로 `cp` 복원한 뒤
`git status --short`/`git diff --stat` 로 워킹트리가 원상태(무변경)임을 확인했다(`git
checkout`/`stash`/`reset` 미사용).

## §1 — `_make_deletion_only_repo` + 3 테스트: 비-vacuity 실측 결과

**판정: 비-vacuous, 서술된 대로 동작한다.**

`test_the_repo_really_is_deletion_only`(`.claude/tests/test_line_anchors.py:682-709`)가 두
불변식을 각각 별도로 단언한다 — (a) HEAD가 `MIN_FIXTURE_CHANGED_LINES=80` 임계값을 넘는가
(:700-704), (b) 그러면서도 삭제된 두 파일이 HEAD 시점에 내용이 **비어 있는가**(:705-709). 이는
같은 클래스가 merge 케이스에 이미 세워 둔 `test_the_repo_really_has_the_asymmetry` 패턴과
대칭이며, 클래스 docstring이 요구하는 "purpose-built 저장소 + 전제 자체를 고정하는 non-vacuity
테스트" 관례를 그대로 따른다.

실측으로 두 가지를 확인했다:

- **가드 자체를 죽이는 뮤테이션** — `pick_commit_fixture`의 거부 조건(`if any(_git("show",
  f"{sha}:{f}", ...) ... ):`, :130)을 `if True:`로 치환해 삭제-전용 커밋을 무조건 선택하게
  만들었다. 결과: `test_a_deletion_only_commit_is_never_selected`와
  `test_the_selected_commit_still_has_resolvable_content` **정확히 2건이 RED**로 실패했고
  (커밋 메시지가 주장한 "뮤테이션 RED 2건"과 일치), `test_the_repo_really_is_deletion_only`는
  그대로 GREEN을 유지했다 — 이 non-vacuity 테스트가 가드 로직과 결합돼 있지 않고 순수하게
  **픽스처 자신의 전제**만 검증한다는 뜻으로, 관심사 분리가 올바르다.
- **픽스처 헬퍼가 "조용히 파일을 남기는" 결함**(docstring이 명시적으로 경계하는 바로 그
  실패 모드) — `_make_deletion_only_repo`의 `git rm` 대신 `a.txt`/`b.txt`에 한 줄만 남기고
  커밋하도록 바꿔 "삭제처럼 보이지만 실제로는 내용이 남는" 픽스처를 재현했다. 결과:
  `test_the_repo_really_is_deletion_only`가 정확히 그 지점(`:709`, `"a.txt still has content
  at HEAD — not a deletion-only commit"`)에서 RED로 실패했다 — non-vacuity 확인이 없었다면
  이 픽스처 결함은 아무 테스트도 잡지 못했을 것이라는 클래스 docstring의 주장이 실측으로
  뒷받침된다.

두 뮤테이션 모두 검증 후 `cp` 로 원본 복원, `python3 -m unittest
test_line_anchors.CommitFixtureSelectionTest` 6건 GREEN 재확인.

## §2 — `_bulleted_path_sample` 20개 초과 절단: 잔존 갭 재판정 및 처분 권고

**판정: 절반만 닫혔다 — 두 번째 호출부(`unseen`)는 여전히 열려 있다.**

`_bulleted_path_sample(paths, limit=20)`(`.claude/skills/code-review-agents/scripts/
code_review_orchestrator.py:1326-1339`)은 두 호출부에서 쓰인다:

- `src_paths`(소스 파일 구성 안내, :922) — 직전 라운드 이후 **닫혔다**.
  `test_long_source_list_is_truncated_with_an_accurate_remainder`
  (`.claude/tests/test_router_decision_trust.py:369-392`)가 23개 파일로 20개 절단 +
  `"… 외 3개"` + 정확히 20줄 나열을 실제 `--prepare` 실행으로 검증한다.
- `unseen`(fail-closed "changeset이 놓친 소스 파일" 교차검사, :937) — **여전히 미검증**이다.
  `DocsOnlyFramingIsCrossCheckedTest.test_the_router_prompt_refuses_the_docs_only_framing`
  (`.claude/tests/test_review_prepare_single_session.py:272-288`)는 `unseen` 배선(wiring)
  자체는 검증하지만 `branch_files`를 1개(`codebase/backend/src/svc.ts`)만 준다 — 20개
  임계값 근처를 전혀 건드리지 않는다. `grep`으로 재확인해도 `unseen`/
  `_source_files_missing_from_changeset`을 21개 이상 파일로 호출하는 테스트는 없다.

이 갭은 `_bulleted_path_sample`이 **순수 함수**이고 두 호출부가 완전히 동일한 인자 형태
(경로 문자열 리스트)를 넘기므로, "함수 자체의 절단 로직" 관점에서는 `src_paths` 테스트가 이미
간접적으로 20개 초과 분기를 실행·검증한다 — 로직 결함(오프바이원 등)이 `unseen` 경로에서만
따로 재발할 여지는 낮다. 그러나 이 저장소의 테스트 스위트가 **바로 이 파일 안에서** 이미
확립한 원칙("헬퍼가 맞는 것과 실제로 불려 쓰이는 것은 다르다" — `DocsOnlyFramingIsCrossCheckedTest`
클래스 docstring 자체가 이 배선 결함 클래스를 겨냥해 만들어졌다는 점을 고려하면, `unseen` 호출부가
20개 초과일 때의 **헤더 카운트**(`{len(unseen)}개`)나 **절단 문구**가 실제 라우터 프롬프트에
정확히 나타나는지는 지금 아무 테스트도 관측하지 않는다. 예컨대 누군가 이 호출부만 별도
상수(`limit=10`)로 바꾸거나 헤더 카운트 계산을 `len(unseen)` 대신 `len(paths)`로 잘못 고쳐도
현재 스위트는 GREEN이다.

**처분 권고**: 이 항목은 두 라운드째(`14_09_31` → 지금) INFO로 반복 보고되면서 실질 조치가 없었다
— review 산출물은 SoT가 아니므로 이대로 세 번째 라운드에도 같은 INFO가 재부상할 가능성이 높다.
둘 중 하나를 이번 기회에 확정할 것을 권한다.

- **(권장) 즉시 종결**: `test_long_source_list_is_truncated_with_an_accurate_remainder`와
  대칭으로, `DocsOnlyFramingIsCrossCheckedTest`에 `unseen` 21개 이상 케이스 1건을 추가한다
  (`orch.get_git_branch_diff_files`가 21개 이상의 소스 경로를 반환하도록 스텁하고
  `build_router_prompt_body` 결과에서 `"… 외 N개"` + 정확히 20줄 나열을 단언). 기존 패턴을
  그대로 복사하면 되는 낮은 비용의 변경이라 "급하지 않음"으로 미룰 이유가 약하다.
- **(대안) 명시적 보류**: 위험도가 낮다고 판단해 이번에도 미루려면, `review/` 는 SoT가 아니므로
  `plan/in-progress/harness-review-gate-followups.md` 에 이 항목을 backlog 로 등록해 다음
  라운드가 "직전 INFO"를 다시 처음부터 재발견하지 않도록 해야 한다. 현재는 plan 문서 어디에도
  `_bulleted_path_sample`/`unseen` 절단이 등재돼 있지 않음을 grep으로 확인했다 — 지금 이대로
  두면 세 번째 라운드에도 동일 INFO가 "새로 발견"된 것처럼 반복될 것이다.

## 회귀 테스트 확인

- `test_line_anchors.py` 40건, `test_review_prepare_single_session.py` 19건(plan 문서가 적은
  "19건"과 실측 일치) 모두 GREEN.
- session.py의 docstring 정정(배치 분할을 과거형으로 서술, 측정 기록은 보존)은 코드 변경이
  아니라 테스트 영향 없음 — 회귀 위험 없음.
- `.claude/commands/ai-review.md`/`README.md`/`SKILL.md`의 "세션은 분할하지 않는다" 문구는
  `PrepareEmitsExactlyOneSessionTest`(정확한 클래스명은 미확인이나 test_review_prepare_single_session.py
  내 배치-분할-제거 회귀군)로 뒷받침되는 실제 동작과 일치한다.

## 요약

직전 라운드가 지적한 "삭제-전용 커밋 가드에 결정적 재현이 없다"는 WARNING은 `_make_deletion_only_repo`
+ 3 테스트로 정확하게 조치됐다 — non-vacuity 확인(`test_the_repo_really_is_deletion_only`)이
실제로 전제(임계값 초과 + 내용 없음)를 고정한다는 것을 직접 뮤테이션 2종으로 실측했고, 커밋
메시지가 주장한 "뮤테이션 RED 2건"도 그대로 재현됐다. 반면 직전 INFO였던
`_bulleted_path_sample`의 20개 초과 절단 미검증은 **절반만** 닫혔다 — 소스 파일 구성 안내
(`src_paths`) 쪽은 새 테스트로 막혔지만, fail-closed 교차검사(`unseen`) 쪽은 여전히 열려
있다. 함수가 순수·공유돼 있어 로직 자체의 위험은 낮지만, 이 저장소 스스로 세운 "헬퍼가
맞는 것과 호출부가 그걸 실제로 쓰는 것은 다르다"는 원칙에 비추면 정당한 잔여 갭이며, 두
라운드째 방치되고 있어 이번 라운드에 처분(테스트 추가 또는 plan 등재)을 확정할 것을 권한다.

## 위험도

LOW
