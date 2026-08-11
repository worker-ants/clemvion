# 요구사항(Requirement) 리뷰

## 조사 범위에 대한 메모

`git diff origin/main...HEAD --stat` 로 실측한 결과, 이 changeset(6커밋, 84파일)에서 "기능"으로
평가할 대상은 다음 8개 파일(총 486줄 삽입/27줄 삭제)뿐이다:

- `.claude/commands/ai-review.md`, `.claude/skills/code-review-agents/{README,SKILL}.md`
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/tests/README.md`, `.claude/tests/test_line_anchors.py`,
  `.claude/tests/test_review_prepare_single_session.py`
- `plan/in-progress/harness-review-gate-followups.md`

나머지 76개 파일(`review/code/2026/08/10/{08_32_48,10_54_59,11_08_01,11_15_05,11_44_32,14_09_31}/**`,
`review/consistency/2026/08/10/{10_35_05,10_36_44,12_06_35}/**`)은 이미 종료된 과거 리뷰/일관성
검토 라운드의 산출물을 `review/` 저장 관행(CLAUDE.md 표)에 따라 커밋한 것으로, 그 자체가 새로운
"기능"을 도입하지 않는 정적 markdown/JSON 기록이다. 요구사항 충족·엣지 케이스·반환값 같은 관점이
의미 있게 적용되는 대상이 아니라고 판단해, 이 리뷰는 실제 코드/plan 변경 8개 파일에 집중했다
(다만 plan 파일이 인용하는 실측 수치는 실제 코드와 대조했다 — 아래 발견사항 참고).

## 관련 spec 식별 (항목 9)

`spec/` 는 CLAUDE.md 상 제품(backend/frontend) 정의 전용이고, 이 changeset 은 `.claude/` 개발
하네스(코드 리뷰 orchestrator)만 다룬다. 이 영역의 "spec" 역할은 `SKILL.md`/`README.md` 자신이
한다 — 둘 다 이번 diff 로 함께 갱신됐으므로, 코드(`code_review_orchestrator.py`)와 그 문서를
line-level 로 대조했다(아래).

## 발견사항

- **[WARNING]** plan 이 체크(`[x]`)한 항목의 회귀 테스트 개수 인용이 실제 파일과 어긋난다
  (stale measured claim)
  - 위치: `plan/in-progress/harness-review-gate-followups.md:542` (`회귀
    \`test_review_prepare_single_session.py\` 17건, 뮤테이션 5/5 RED(...)`)
  - 상세: `git show 193d43fc5 -- .claude/tests/test_review_prepare_single_session.py`(첫 조치
    커밋)는 테스트 10건을, `git show 50d877bd9 --`(router fail-closed 조치 커밋)는 7건을
    추가해 그 시점 합계는 정확히 17건이었다. 그런데 이 changeset 에 포함된 세 번째 커밋
    `ffb2cfbe5`(리뷰 반영)가 같은 파일에 `test_main_actually_calls_the_large_changeset_notice`·
    `test_a_small_changeset_leaves_main_quiet_about_size` 2건을 추가로 얹었고, 이 셋을 전부
    포함하는 이번 diff 의 최종 파일에는 `def test_` 가 **19건** 존재한다(직접 카운트로 확인).
    plan 은 그 마지막 커밋을 반영한 뒤에도 "17건" 문구를 갱신하지 않았다 — 측정 시점이
    파일의 최신 상태보다 앞서 있다.
  - 제안: "17건" → "19건" 으로 정정(또는 "17건 + 반영 라운드에서 2건 추가"처럼 두 시점을
    구분해 기재).

- **[WARNING]** 같은 changeset 이 닫은 조사 항목의 상위 체크박스/상태 요약이 갱신되지 않았다
  - 위치: `plan/in-progress/harness-review-gate-followups.md:469` (`- [ ] **동일 커밋의 형제
    파일이 부분만 뽑히는 원인 확인**`), 및 `:23-30`(`## 현재 상태 (2026-08-07 갱신)` — "**미해결
    조사 1건** (문서 끝) — 형제 파일 부분 추출 원인")
  - 상세: 이 상위 항목 아래 중첩된 두 개의 실행 항목 — `create_session_dir()` 충돌 회피(`:513`,
    이미 `[x]`, 이전 라운드) · 배치 분할 제거(`:523`, 이번 diff 에서 `[ ]`→`[x]`) · router
    fail-closed 방어(`:583`, 이번 diff 에서 `[ ]`→`[x]`) — 가 전부 "처분 완료" 로 표시됐고,
    본문 어디에도 세 번째 원인이 남아 있다는 서술이 없다. 그런데 이 셋을 감싸는 상위 항목
    (`:469`)은 여전히 `[ ]` 이고, 문서 상단 "현재 상태" 절(`2026-08-07 갱신` — 이번 diff 로도
    안 바뀜)은 이 항목을 여전히 "미해결 조사 1건"으로 세어 `in-progress/` 에 남아야 하는
    사유 셋 중 하나로 든다. 두 시점(상세 서술의 완료 표시 vs 요약 절의 미해결 카운트)이
    서로 모순한다 — 이 저장소가 반복 지적해 온 "plan 체크박스 = 실제 상태" 규율과 어긋난다.
  - 제안: 상위 체크박스를 `[x]` 로 올리고 "현재 상태" 절의 사유 목록에서 이 항목을 제거하거나,
    여전히 열어 둘 구조적 근거(예: "changeset 산정이 틀릴 다른 경로가 남아 있어 완전히 닫힌
    것은 아니다")를 명시적으로 남긴다. 지금은 둘 다 아니라서 독자가 실제 상태를 체크박스만
    보고는 알 수 없다.

- **[INFO]** README/SKILL 의 "디버그 로그" 서술이 실제로 기록되지 않는 이벤트를 기록된다고
  적는다(이번 diff 가 문구만 교체, 부정확성 자체는 새로 만든 것이 아님)
  - 위치: `.claude/skills/code-review-agents/README.md:240` (`orchestrator 가
    \`/tmp/code-review-agents-log.txt\` 에 prepare 단계의 이벤트(파일 수집, prompt 사이즈,
    **대형 changeset 안내**) 를 기록한다`)
  - 상세: `_warn_large_changeset()`(`code_review_orchestrator.py:1142-1178`)와 `main()` 의
    파일 나열 루프(`:1690-1692`)는 전부 `print(..., file=sys.stderr)` 이며 `debug_log(...)`
    를 한 번도 호출하지 않는다. `debug_log = session.make_debug_logger(DEBUG_LOG_FILE)`
    (`:56`)는 `open(log_file_path, "a")` 로 파일에만 쓰고 stderr 와는 무관하다(`session.py:14-26`
    확인). 즉 "대형 changeset 안내"는 stderr 로만 나가고 `/tmp/code-review-agents-log.txt`
    에는 남지 않는다 — 이 changeset 이전 문구였던 "batch 분할" 역시 같은 이유로 이미
    부정확했었고(그때도 batch 루프는 `print(..., file=sys.stderr)` 만 썼다), 이번 diff 는
    그 부정확한 서술의 대상 이름만 교체했다. 기능 결함은 아니고(로그 부재로 인한 동작 이상
    없음), 실제로 이 파일을 열어 안내 메시지를 찾는 사람에게 잘못된 위치를 알려준다는
    점에서 문서 정확성 이슈다.
  - 제안: "대형 changeset 안내는 stderr 로만 표시되고 디버그 로그 파일에는 남지 않는다"로
    정정하거나, `_warn_large_changeset` 안에 `debug_log(...)` 호출을 추가해 문구가 참이
    되게 한다.

- **[INFO]** 새로 추가된 "삭제-전용 커밋 스킵" 분기에 대한 목적형(purpose-built) 회귀 테스트가
  없다 — 실제 저장소 히스토리 우연에 기대는 커버리지만 존재
  - 위치: `.claude/tests/test_line_anchors.py:108-119` (`pick_commit_fixture` 의 신규
    `any(_git("show", f"{sha}:{f}", ...) ...)` 분기)
  - 상세: 같은 함수의 자매 결함(머지 커밋으로 인한 오선택)은 `CommitFixtureSelectionTest`
    (`:539` 이하)가 합성 저장소(`tempfile.mkdtemp()` + 실제 `git init`)를 만들어 "그 형태가
    다시 생겨도 잡힌다"를 목적형으로 고정한다. 반면 이번에 추가된 삭제-전용 커밋 분기는
    코드 주석에 "Measured on `e4ce8adf8`" 라고만 적혀 있고, 그 방어를 직접 겨냥하는 합성
    fixture 테스트는 없다 — 현재 스위트가 이 분기를 실제로 통과하는지는 `main` 브랜치
    히스토리에 삭제-전용 커밋이 우연히 존재하는지에 달려 있다(`FIXTURE_SEARCH_DEPTH=40`
    범위 안에서). 테스트 인프라 코드라 사용자 영향은 없고, 머지 커밋 케이스와 동일한 패턴의
    회귀(예: 조건 역전)가 나면 CI 가 조용히 통과할 수 있다는 정도의 약한 위험이다.
  - 제안: `CommitFixtureSelectionTest` 와 동일한 패턴으로 "전 파일이 삭제된 커밋" 을 합성
    저장소에 만들어 `pick_commit_fixture` 가 그 커밋을 건너뛰는지 직접 단언하는 테스트를
    추가하면, 머지 커밋 케이스와 대칭을 이루고 실제 히스토리 우연에 대한 의존을 없앤다.

## 긍정적으로 확인한 부분 (요구사항 충족 관점)

- `--prepare` 의 "정확히 한 세션" 계약은 코드(`main()` 이 배치 루프를 제거하고 `prepare_session`
  을 changeset 전체로 한 번만 호출)·문서(`ai-review.md`/`SKILL.md`/`README.md` 세 곳 모두
  일관되게 갱신)·테스트(`test_review_prepare_single_session.py`, 19건, 헬퍼와 호출부를 분리
  검증)가 서로 line-level 로 일치한다.
- `_source_files_missing_from_changeset` → `build_router_prompt_body` 로의 배선은
  `routing_status == "pending"` 일 때만(즉 router 가 실제로 실행될 때만) 호출되어, `--route=all`
  ·`REVIEW_AGENTS` 명시 경로에서는 불필요한 git 호출을 하지 않는다. 실패 경로(`_default_branch_ref`
  가 `None` 반환, `get_git_branch_diff_files` 예외)는 모두 `[]` 로 흡수해 advisory 라는 설계
  의도("git 실패는 삼킨다")와 정확히 일치하며, 이 부분은 헬퍼 단위 테스트와 호출부(`build_router_prompt_body`
  결과 문자열) 테스트 양쪽으로 커버된다(`DocsOnlyFramingIsCrossCheckedTest`).
- `pick_commit_fixture` 의 삭제-전용 커밋 스킵 로직 자체는 정확하다: `any()` 단락 평가로 "적어도
  한 경로가 `sha` 시점에 내용을 가진다"만 확인하고, 조건이 거짓이어도 명시적 `continue` 없이
  자연스럽게 다음 커밋으로 넘어가는 루프 구조라 로직 결함은 없다.
- `REVIEW_BATCH_SIZE` 를 완전히 제거하지 않고 "분할 → 안내 임계값"으로 의미를 바꾼 처분은 세
  문서(README·SKILL 양쪽 표, `_warn_large_changeset` 코드 주석)에서 표현이 어긋나지 않는다.

## 요약

핵심 기능 변경(리뷰 세션 단일화, router "문서 전용" 오판에 대한 fail-closed 교차검사, 픽스처
선택기의 삭제-전용 커밋 회피)은 세 곳 모두 코드·문서·테스트가 정확히 대응하고, 설계 의도(advisory,
실패 시 조용히 흡수, changeset 자체는 넓히지 않음)가 실제 구현과 일치한다. 실질 결함은 발견되지
않았으며, 남은 문제는 전부 이 changeset 이 스스로 만든 실측 주장의 최신성(plan 의 테스트 개수·
체크박스 상태)과 문서 한 줄의 부정확성 수준이다. 나머지 76개 파일은 과거 리뷰/일관성 검토 라운드의
기록물 커밋으로, 기능 요구사항 평가 대상이 아니다.

## 위험도

LOW
