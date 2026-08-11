# 유지보수성(Maintainability) Review

## 조사 방법

프롬프트의 여러 섹션이 "프롬프트 크기 제한으로 diff 생략" 상태였고(파일 5·6·7·8·9), 96개 리뷰 대상 중
대다수(파일 10~96)는 `review/code/**`·`review/consistency/**` 아래 **이전 리뷰·일관성 검사 세션이
이미 커밋해 둔 산출물**(markdown 리포트 + `meta.json`/`_retry_state.json` 등 구조화 JSON)이었다.
이들은 함수·클래스·제어흐름이 없는 생성 문서/데이터이므로 가독성·네이밍·함수 길이·중첩·매직넘버·중복·
복잡도·일관성이라는 8개 관점이 적용될 대상이 아니다(다른 reviewer들의 database.md/api_contract.md
판정과 동일한 결론). 생략된 diff가 있는 실질 코드/문서 파일(`code_review_orchestrator.py`,
`test_line_anchors.py`, `test_review_prepare_single_session.py`, `.claude/tests/README.md`,
`plan/in-progress/harness-review-gate-followups.md`)은 `git diff origin/main..HEAD -- <path>` 로
직접 조회해 전체 diff를 확인했다.

## 발견사항

- **[WARNING]** 신규 `_make_deletion_only_repo` 가 형제 헬퍼 `_make_repo` 와 tempdir·cleanup·git
  env·git 클로저·`init` 5줄을 바이트 단위로 동일하게 반복한다
  - 위치: `.claude/tests/test_line_anchors.py:658-667`(`_make_deletion_only_repo` 내부) vs
    `:576-585`(형제 `_make_repo` 내부) — 두 메서드 모두 `class CommitFixtureSelectionTest` 안에 있다.
  - 상세: 두 헬퍼는 다음 블록이 **완전히 동일**하다.
    ```python
    import os
    import shutil
    import tempfile

    repo = tempfile.mkdtemp()
    self.addCleanup(shutil.rmtree, repo, ignore_errors=True)
    env = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"]

    def git(*args):
        return self._git(repo, *env, *args)
    ```
    그리고 바로 뒤에 `git("init", "-q", "-b", "main", ".")` 로 이어진다(`_make_repo:591`,
    `_make_deletion_only_repo:669`). **이 지점까지는 판별 대상이 아니다** — 순수 인프라
    셋업(임시 디렉터리 확보·정리 등록·커밋용 git identity·`_git` 바인딩 클로저)이고, 두 메서드가
    "무엇을 재현하려는가"와는 무관하다. 반대로 `init` 다음부터는 완전히 갈린다 — `_make_repo` 는
    `write()` 헬퍼로 두 브랜치를 만들어 비대칭 머지를 재현하고, `_make_deletion_only_repo` 는
    선형으로 커밋 2개(`keep.txt`+`a.txt`+`b.txt` 추가 → `a.txt`/`b.txt` 삭제)만 쌓는다. 즉 이
    중복은 "각자 고유한 재현 시나리오가 우연히 비슷해 보이는" 경우가 아니라, **정확히 같은
    인프라 보일러플레이트를 손으로 두 번 타이핑한** 경우다. 저장소 전체를 봐도(`.claude/tests/*.py`
    grep 결과) `commit.gpgsign=false` 조합은 이 파일의 이 두 곳에만 존재해, "이 파일 전체가
    관용적으로 반복하는 패턴이라 지금 손대면 나머지와 어긋난다" 는 반론도 성립하지 않는다 —
    같은 클래스 안, 같은 커밋(2026-08-10)에서 새로 하나가 추가되며 기존 것을 그대로 베낀 모양이다.
    다만 위험도는 낮다: 테스트 전용 픽스처 코드라 런타임 동작에 영향이 없고, `env` 리스트가
    바뀔 시나리오(예: 서명 정책 변경)도 당장 예정돼 있지 않다.
  - 제안: 공통부만 뽑아내 `init` 까지 마친 `(repo, git)` 을 반환하는 헬퍼를 두고 두 메서드가
    그 위에서 각자의 커밋 시퀀스만 쌓게 한다.
    ```python
    def _new_repo(self):
        """tempdir + cleanup + git identity + `init -b main`. Commit history is the caller's."""
        repo = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, repo, ignore_errors=True)
        env = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"]

        def git(*args):
            return self._git(repo, *env, *args)

        git("init", "-q", "-b", "main", ".")
        return repo, git
    ```
    `import os/shutil/tempfile` 는 파일 상단으로 올리거나(현재 지역 import 인 이유가 명시돼
    있지 않다면) 헬퍼 안에 한 번만 남긴다. 필수 조치는 아니다 — 지금 상태로도 각 메서드는
    독립적으로 읽히고 동작에 위험이 없다.

- **[INFO]** 새로 추출된 "N개 보여주고 나머지는 '… 외 M개'" 헬퍼가, 같은 파일에 이미 있던
  동일 모양의 손코딩 로직은 흡수하지 못했다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1326`
    (`_bulleted_path_sample`, 신규) vs `:1404-1407`(`warn_if_committed_work_is_missing` 내부,
    기존 함수·이번 diff에서 미변경)
  - 상세: 이번 diff는 `build_router_prompt_body` 안에 있던 "앞 20개만 backtick 목록으로,
    넘으면 `… 외 N개`" 로직을 `_bulleted_path_sample` 로 추출하며 docstring에 정확히 이렇게
    적었다 — "두 router-prompt 목록이 같은 모양을 요구하는데 첫 번째 것을 복사해 두 번째를
    썼고, magic `20` 도 그대로 베꼈다. 공유하면 두 목록이 벌어지는 걸 막는다." 그런데 같은
    파일의 `warn_if_committed_work_is_missing`(1375행, 이번 diff로 바뀌지 않은 기존 코드)도
    구조적으로 동일한 "앞 N개 보여주고 나머지는 안내" 패턴을 `missing[:10]` / `f"     - {f}"` /
    `… 외 {len(missing) - 10}개` 형태로 손코딩해 갖고 있다. 포맷(backtick 유무·들여쓰기 폭)과
    상한(20 vs 10)이 달라 기계적으로 하나로 합치긴 어렵지만, `_bulleted_path_sample` 이 내세운
    "공유해야 드리프트를 막는다"는 근거는 이 세 번째 자리에도 똑같이 적용된다 — 지금 이 PR이
    직접 겪은 "복사하다 magic 20을 그대로 베낀" 실수의 축소판이 다음에도 여기서 재발할 수 있다.
  - 제안: 당장 통합할 필요는 없다(이번 diff 스코프 밖의 기존 함수). 다음에 `warn_if_committed_work_is_missing`
    을 만질 일이 생기면 `_bulleted_path_sample(missing, limit=10)` 로 대체해 세 번째 손코딩을
    없애는 편이 낫다.

## 그 외 확인한 항목 (문제 없음)

- `code_review_orchestrator.py`: 배치 분할 루프를 제거하고 단일 세션 경로로 단순화한 `main()`
  꼬리부는 오히려 순환 복잡도를 낮췄다(중첩 루프 제거). 신규 함수 `_warn_large_changeset`/
  `_bulleted_path_sample`/`_source_files_missing_from_changeset` 는 모두 짧고 단일 책임이며,
  네이밍이 파일 내 기존 관례(`_default_branch_ref`, `_apply_status_update` 등 언더스코어
  prefix + 서술적 이름)와 일치한다. 새 모듈 상수 `_ROUTER_PATH_SAMPLE_MAX = 20` 은 그 값을
  쓰는 함수 바로 위에 두었는데, 이는 파일 안에 이미 있는 지역-상수 배치 관례(`_DIFF_ELIDED_NOTE`,
  `_FILES_DROPPED_NOTE_MAX` 가 소비 함수 근처에 있는 것)와 일관된다.
- `.claude/skills/code-review-agents/lib/session.py`: 이번 diff는 docstring/주석만 바뀌었고
  로직 변경이 없다(git diff로 확인). "그 문구가 지금도 방금 고친 버그를 설명하고 있는지"
  관점에서 봐도, 배치-분할 원인이 제거됐다는 사실과 "동시 세션 충돌은 남는다"는 현재 상태를
  정확히 구분해 서술하고 있어 문서-코드 drift가 없다.
- `.claude/tests/test_review_prepare_single_session.py`(신규, 308줄): 4개 테스트 클래스가
  각각 하나의 관측 가능한 속성(단일 세션 출력·안내 문구·forced 집합 증폭·cross-check)만
  겨냥하고, 헬퍼(`_stdout_lines`/`_warn`/`_forced`/`_missing`/`_infos`)가 중복 없이 잘
  분리돼 있다. `run_in_orchestrator` fresh-interpreter 패턴은 이 스위트의 기존 관례
  (`test_review_changeset_warning.py`)를 그대로 따른다.
- `.claude/commands/ai-review.md`/`README.md`/`SKILL.md`/`.claude/tests/README.md`/
  `plan/in-progress/harness-review-gate-followups.md`: 전부 사실 정정·이력 기록형 산문 편집으로,
  기존 문서 스타일(근거·측정치 인용)과 일관되며 구조적 문제는 없다. `README.md`/`SKILL.md`
  두 곳의 `REVIEW_BATCH_SIZE` 행이 동일 문구로 중복되는 것은 이 저장소가 정책 문서를
  의도적으로 미러링하는 기존 관례(`test_router_safety_policy_doc.py` 류가 이런 미러를
  가드하는 패턴)와 일치해 결함으로 보지 않았다.

## 요약

이번 changeset의 실질 코드 변경은 review-batch 분할 제거(`code_review_orchestrator.py`) +
그 회귀 테스트(`test_review_prepare_single_session.py`) + 삭제-전용 커밋 픽스처 추가
(`test_line_anchors.py`) + 관련 문서 5건 갱신으로 좁고, 전반적으로 함수는 짧고 단일 책임이며
네이밍·주석 스타일이 파일 내 기존 관례를 그대로 따른다. 특히 `_bulleted_path_sample` 추출은
"두 자리가 같은 모양이면 공유해 drift를 막는다"는 목적에 정확히 부합하는 좋은 리팩터다.
유일하게 지적할 만한 것은 같은 클래스 안에서 새로 추가된 `_make_deletion_only_repo` 가 형제
`_make_repo` 의 인프라 셋업(tempdir·cleanup·git identity·클로저·`init`) 5~6줄을 그대로 복제한
점이다 — `init` 이후의 커밋 시나리오는 완전히 다른 고유 로직이라 그 부분까지 통합할 필요는 없지만,
그 앞부분은 정확히 같은 텍스트라 공유 헬퍼로 뽑는 편이 다음 세 번째 변형(픽스처)이 추가될 때
드리프트를 막는다. 테스트 전용 코드이고 동작 위험이 없어 WARNING으로 표기했다. `review/**` 아래
94개 파일은 이전 리뷰·일관성 검사 세션의 산출물(생성 markdown/JSON)이라 이 8개 관점의 적용
대상이 아니다.

## 위험도

LOW
