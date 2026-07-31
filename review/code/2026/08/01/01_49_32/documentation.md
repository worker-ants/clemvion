# 문서화(Documentation) Review — harness-block-backstop (2026-08-01 01:49:32)

## 조사 방법 및 스코프 메모

이번 라운드(`review/code/2026/08/01/01_49_32`)에 프롬프트로 주어진 44개 파일은 전부
`review/code/2026/08/01/{00_03_38,00_33_34,01_17_35,01_17_47}/**` 아래의 **과거 AI 코드 리뷰
세션 산출물**(리뷰어별 Markdown 리포트, `meta.json`/`_retry_state.json` 상태 스냅샷,
`RESOLUTION.md`/`SUMMARY.md`)이며, 실제 하네스 소스 코드(`.py`)는 diff 본문에 단 한 줄도
포함돼 있지 않다(같은 라운드의 `maintainability.md`/`security.md`도 독립적으로 동일하게
확인함 — `git diff --stat origin/main...HEAD` 기준 실제 소스 변경은 이 브랜치의 이전 커밋들
(`30cc0f738`→`7dd4ad8c7`, 1R~5R 리뷰 반영 포함)에서 이미 커밋됐고 이번 라운드의 diff 베이스에는
없음). 따라서 순수 문서화 체크리스트를 새 코드에 적용할 대상 자체가 없다.

다만 이번 44개 파일 중에는 이전 라운드의 **본 리뷰어 자신의 산출물**(`00_33_34/documentation.md`,
`01_17_35/documentation.md`)과, 그 라운드들이 낸 CRITICAL/WARNING의 처분을 기록한
`01_17_35/RESOLUTION.md`가 포함돼 있다. 이는 "이전 documentation 리뷰가 지적한 사항이 실제로
고쳐졌는가"를 실제 소스에 대조해 검증하는 것이 이런 메타 리뷰 라운드에서 documentation
리뷰어가 할 수 있는 의미 있는 유일한 점검이라는 뜻이다(같은 라운드의 maintainability.md가
`00_03_38`/`00_33_34`/`01_17_35`의 자기 자신 WARNING들을 재대조한 것과 동일한 방법론). 아래
발견사항은 그 대조 작업에서 나온 것이다 — 이번 라운드의 44개 파일 자체에 대한 지적이 아니라,
`01_17_35/documentation.md`·`01_17_35/RESOLUTION.md`가 다루는 실제 소스 상태에 대한 지적이다.

## 발견사항

- **[WARNING]** `RESOLUTION.md`의 W9 수정이 `test_consistency_orchestrator_state.py` 모듈
  docstring 을 문단 단위로 재배치하면서, 원래 있던 문장의 지시 대상을 끊어 놓았다
  — 새로 생긴 문서 결함이며 어떤 라운드도 아직 지적하지 않았다
  - 위치: `.claude/tests/test_consistency_orchestrator_state.py:1-18` (모듈 docstring), 특히
    11-15행("Still worth keeping after the extraction: … Four reviewers reproduced it
    independently; these tests make the duplicate carry its own weight.")
  - 상세: `01_17_35/RESOLUTION.md`의 W9 항목("`test_consistency_orchestrator_state.py` + README
    가 이 PR 이 없앤 '중복'을 현재형으로 서술 → 양쪽 갱신")과 `01_17_35/documentation.md`의 해당
    WARNING(같은 파일이 "The two orchestrators keep their state machines in lockstep by
    duplication"이라고 현재형으로 서술하던 문제)은 실제로 정확히 수정됐다 — 과거형("once kept
    … by hand duplication")으로 바뀌었고 "그 복제는 이제 사라졌다"는 문장도 추가됐다. 이 자체는
    올바른 수정이다. 그런데 그 과정에서 원문(`git show origin/main:<path>`로 확인)의 한 문단을
    둘로 쪼개면서 문제가 생겼다. 원문은 "…documented behaviour with no mechanism behind it,
    which is the very failure mode the surrounding work exists to remove. **Four reviewers
    reproduced it independently**; these tests make the duplicate carry its own weight."로
    이어져 있어 `it`(그리고 "그것을 네 명의 리뷰어가 독립적으로 재현했다"는 진술)이 바로 앞
    문장의 "문서화됐지만 구현되지 않은 self-healing 갭"을 가리키는 것이 명확했다. 수정본은 이
    문장을 새 두 번째 문단("Still worth keeping after the extraction: … 이 오케스트레이터의
    *CLI 출력 계약*을 지킨다 … Sharing the implementation did not merge the contracts, so the
    consumer-side test is still the only thing holding this one.")의 끝에 그대로 옮겨 붙였다.
    그 결과 지금 `Four reviewers reproduced it independently`의 `it`은 문단 경계를 넘어야만
    원래 대상(과거의 self-healing 갭)에 닿을 수 있고, 바로 앞 문장("the consumer-side test is
    still the only thing holding this one")만 읽으면 마치 "CLI 출력 계약 분기"를 네 명이
    재현했다는 것처럼 오독된다 — 이 두 주장은 서로 무관하다. 이 docstring 은 이 파일이 왜
    존재하는지를 설명하는, 이 브랜치 스스로가 반복해서 "이례적으로 우수"하다고 평가해 온 바로 그
    문서이므로, 지시 대상이 끊긴 채로 남으면 다음 유지보수자가 "그 갭은 이미 없어졌는데 왜 아직도
    이 테스트가 필요한가"를 판단할 때 근거 문장을 잘못 짚을 수 있다.
  - 제안: `Four reviewers reproduced it independently; these tests make the duplicate carry
    its own weight.` 문장을 원래 문단(첫 번째 문단 끝, "…the surrounding work exists to
    remove." 바로 뒤)으로 되돌리거나, 새 위치에 맞게 다시 쓸 경우 `it`을 명시적 명사구("that
    gap")로 바꿔 문단이 바뀌어도 지시 대상이 분명하도록 한다.

- **[WARNING]** `consistency_orchestrator.py`와 `merge_coordinator_orchestrator.py` 두 파일
  모두, 옛 "Mirror" 섹션 헤더가 이번 PR 이 새로 추가한 정확한 위임 설명 주석과 모순된 채 나란히
  남아 있다 — `01_17_35/documentation.md`가 이 중 1개 파일만 INFO 로 지적했고 아직 처리되지 않음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:79-89`
    (79-82행 "State helpers (--summary-state / --update). Mirror code_review_orchestrator so
    main never has to Read _retry_state.json into its context." vs 바로 아래 85-89행의 정확한
    설명), `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:79-82`
    (동일 텍스트) 및 같은 파일 100-112행(정확한 설명, 다만 함수 정의 순서상 더 아래 위치)
  - 상세: 세 orchestrator 는 원래 이 섹션 헤더를 "state helpers, `--summary-state`용" 정도로
    서술했고, `consistency_orchestrator.py`/`merge_coordinator_orchestrator.py` 두 파일은 자신을
    "Mirror code_review_orchestrator"(그 파일을 손으로 복제한 것)라고 못박았다. 이번 PR 은 다섯
    함수 중 넷을 `_shared/retry_state.py` 위임으로 바꾸면서, 그 사실을 정확히 설명하는 새 주석을
    세 파일 모두에 추가했다("State bookkeeping lives in `.claude/_shared/retry_state.py` — …").
    그런데 이 새 주석을 넣으면서 `code_review_orchestrator.py`(원본/"Mirror 대상")에서는 옛
    "State helpers…" 섹션 구분 블록 전체(`# ---`+제목+`# ---`)를 **완전히 제거**하고 새 주석
    하나로 교체했다(`git diff origin/main...HEAD -- .claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
    로 확인). 반면 `consistency_orchestrator.py`와 `merge_coordinator_orchestrator.py`는 옛
    "Mirror code_review_orchestrator" 헤더를 **그대로 둔 채** 새 정확한 주석을 그 아래(또는,
    merge-coordinator 의 경우 함수 재배치로 더 아래)에 추가만 했다. 그 결과 두 파일 모두 "이건
    다른 파일의 복제본이다"(옛 주석)와 "이건 손 복제가 아니라 공유 모듈에 대한 위임이다"(새
    주석)라는 서로 반대되는 서술이 몇 줄 간격으로 공존한다. `01_17_35/documentation.md`(INFO)는
    이 중 `merge_coordinator_orchestrator.py` 한 곳만 지적했는데, 실제로는 `consistency_
    orchestrator.py`에도 바이트 단위로 동일한 결함이 있어 — 그 INFO 는 2R 이상 지나도록
    해소되지 않았고 범위도 실제보다 좁게 보고됐던 셈이다.
  - 제안: 두 파일의 `# --- State helpers (--summary-state / --update). Mirror code_review_
    orchestrator so main never has to Read _retry_state.json into its context. ---` 3줄
    블록을 `code_review_orchestrator.py`가 취한 것과 동일하게 제거(또는 "이제 위임" 으로
    재작성)한다.

- **[INFO]** `retry_state.load_state()`에 여전히 docstring 이 없음 — 같은 모듈의 형제 함수 4개는
  모두 있고, 이 파일 자체가 이미 3라운드에 걸쳐 docstring 을 강화받은 뒤에도 남아있는 유일한 공백
  - 위치: `.claude/_shared/retry_state.py:41-47`(`load_state`) — 대조: `save_state`(50행부터),
    `reconcile_state_with_disk`(94행부터), `emit_summary_state`(135행부터),
    `apply_status_update`(174행부터) 전부 docstring 보유
  - 상세: 이 항목은 `00_33_34/documentation.md`가 이미 INFO 로 지적한 것과 동일하다. 그 사이
    같은 파일의 `save_state` docstring 이 W5(보장 범위 과대주장 정정)로 다시 손질됐고,
    `reconcile_state_with_disk`/`apply_status_update`/`emit_summary_state`는 계속 상세한
    docstring 을 유지하고 있어 이 모듈은 "docstring 을 꼼꼼히 쓰는" 관행이 뚜렷한데도, 유독
    `load_state`만 여전히 비어 있다. 이 함수는 `_retry_state.json`이 없으면 stderr 메시지를 찍고
    `sys.exit(1)`로 하드 실패하는 계약을 갖고 있어(43-45행), 이름만으로는 그 계약이 드러나지
    않는다.
  - 제안: 한 줄 docstring 추가, 예:
    `"""Load _retry_state.json, or exit(1) with a stderr message if the session dir has none."""`

- **[INFO]** push/stop 훅의 모듈 최상단 docstring 이 여전히 신규 non-blocking advisory(`notes`)
  메커니즘을 언급하지 않음 — `01_17_35/documentation.md`가 우선순위 낮음으로 지적한 뒤 미해결
  - 위치: `.claude/hooks/guard_review_before_push.py:1-41`, `.claude/hooks/guard_review_before_stop.py:1-27`
  - 상세: 두 모듈 docstring 모두 hard gate/soft nudge 정책과 fail-open 관측성은 상세히 설명하지만,
    "차단하지 않지만 모델에 반드시 도달해야 하는 advisory"(`notes`) 개념은 여전히 등장하지 않는다.
    개별 함수(`ReviewDecision.notes` 필드, `_evaluate_over_targets`, `review_guard.py` 모듈
    docstring)의 설명은 이번에 W6~W8 로 정확히 보강됐으므로 실질 위험은 낮지만, 두 훅의 최상단만
    읽는 독자는 여전히 이 기능의 존재를 놓친다.
  - 제안: 우선순위 낮음, 여유 될 때 한두 문장 추가.

## 확인 완료 — 이전 라운드 지적사항이 실제로 정확히 반영됨

`01_17_35/RESOLUTION.md`와 `01_17_35/documentation.md`가 기록한 documentation 관련 처분을 실제
소스와 대조한 결과, 위 두 건을 제외한 나머지는 전부 정확히 반영돼 있었다:

- **CRITICAL(주석-코드 반대 진술) 수정 확인**: `.claude/hooks/guard_review_before_stop.py:366-386`
  — 마커 키가 `hashlib.sha1(note.encode("utf-8")).hexdigest()[:12]`로 바뀌었고, 바로 위 주석도
  "The marker keys on a digest of the note TEXT"로 정정됐으며, 왜 이전(`enumerate` 인덱스 기반)
  구현이 틀렸는지를 설명하는 이력까지 남겼다(370-379행). 코드-주석 일치.
- **W5** (`save_state` docstring 의 "버킷들은 디스크에서 재도출된다" 과대주장 정정): `.claude/_shared/retry_state.py:59-74`
  — `agents_success`만 디스크 기준으로 재도출되고 `agents_fatal`은 메모리 필터링뿐이라는 비대칭을
  정확히 설명. `01_17_35/concurrency.md`가 지적한 것과 동일 내용까지 포함.
- **W6** (`Outcome` docstring 에 `notes` 필드 누락): `.claude/hooks/_lib/failopen_state.py:36-58`
  — 클래스 docstring 열거에 `notes` 설명 추가 확인.
- **W7** (`_evaluate_over_targets` docstring 에 3번째 책임 누락): `.claude/hooks/guard_review_before_push.py:809-834`
  — "Third responsibility, added later: **advisory collection**" 단락 추가 확인.
- **W8** (`review_guard.py` 모듈 docstring 이 backstop 미언급): `.claude/hooks/_lib/review_guard.py:38-47`
  — "Advisory, orthogonal to the above: …" 단락으로 Gate 2 의 notes 발화 조건까지 명시.
- **W9 본문 자체(과거형 전환)**: 위 WARNING 에서 지적한 지시 대상 문제를 제외하면, "한때 손 복제,
  지금은 위임" 이라는 핵심 정정 자체는 `.claude/tests/README.md:33` 행에서도 정확히 반영돼 있음
  (`test_consistency_orchestrator_state.py` 행 — "Written because … then mirrored … The
  duplication is gone (`_shared/retry_state.py`), but the per-orchestrator CLI output
  contracts stayed distinct…").
- **`00_33_34/documentation.md`의 WARNING**(하향-모순 백스톱 적용 범위가 정책 문서 서술보다
  좁다): `.claude/agents/consistency-summary.md:47-55`, `.claude/skills/consistency-checker/SKILL.md:111-118`
  — 두 곳 모두 "그 경고는 `--impl-done` 세션이 게이트에 채택될 때만 발화하므로, 다른 모드나
  spec-linked 변경이 없는 경우는 이 금지 조항이 유일한 방어"라는 범위 한정 문장이 정확히
  제안된 형태로 추가돼 있음.
- **`00_33_34/scope.md`가 지적한 `merge_coordinator_orchestrator.py`의 "Git / gh helpers" 구분
  주석 유실**: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:125-127`
  — 복원 확인.
- **`summary_block_verdict()` 자기 정정**: `.claude/_shared/block_integrity.py:104-115` — "last
  wins" tiebreak 이 실제로는 END-anchor 가 못 가리는 동률에만 적용되고, 코퍼스 1,504건 중
  뒤집힌 사례가 0건이라는 실측 근거까지 docstring 에 남아 있어(스스로 정정한 이력 그대로 코드에
  반영), 근거와 서술이 일치.
- **CHANGELOG.md**: `git log -- CHANGELOG.md`로 재확인한 결과 이 저장소 관례상
  `codebase/`+`spec/` 변경 전용이며 `.claude/` 하네스 변경은 기록 대상이 아니다(과거 이력 전체에
  하네스 커밋 0건). 갱신 누락 아님.
- **신규 환경변수/설정**: `git diff origin/main...HEAD -- '.claude/**/*.py'`의 `os.environ` 사용
  전수 확인 결과 테스트 전용 격리 변수(`CLAUDE_PROJECT_DIR`, 테스트 픽스처의 `FAKE_NOTE`)뿐,
  실제 신규 제품/하네스 설정 표면 없음 — 문서화할 신규 config 없음.
- **테스트 스위트**: `python3 -m unittest discover -s .claude/tests -p "test_*.py"` 직접 실행 —
  749 tests OK, `RESOLUTION.md`가 주장하는 수치와 일치.

## 요약

이번 라운드(01_49_32)의 실제 diff(44개 파일)는 전부 과거 리뷰 세션의 산출물(Markdown 리포트 +
JSON 상태 스냅샷)이며 하네스 소스 코드는 포함하지 않는다. 그러나 그 44개 파일 중에는 이전
documentation 리뷰 자신의 산출물(`00_33_34/documentation.md`, `01_17_35/documentation.md`,
`01_17_35/RESOLUTION.md`)이 포함돼 있어, 그 산출물들이 다뤘던 실제 소스를 다시 열어 "지적한
것이 실제로 고쳐졌는가"를 대조했다. 결과: CRITICAL 1건(Stop 훅 note 마커의 주석-코드 반대
진술)과 WARNING 4건(W5~W9, 문서 서술 범위 과대·누락)은 전부 정확히 수정돼 있었다. 다만 그
수정 과정 자체가 새 결함 하나를 만들었다 — `test_consistency_orchestrator_state.py`의 모듈
docstring 을 과거형으로 고치며 문단을 재배치하는 과정에서, "네 명의 리뷰어가 독립적으로
재현했다"는 문장이 원래 지시 대상(문서화만 되고 구현되지 않았던 self-healing 갭)에서 떨어져 나가
지금은 무관한 문장 뒤에 붙어 지시 대상이 불분명해졌다. 또한 `01_17_35/documentation.md`가
`merge_coordinator_orchestrator.py` 한 곳에서만 지적했던 "Mirror" 옛 섹션 헤더와 신규 위임 설명
주석의 모순이, 실제로는 `consistency_orchestrator.py`에도 동일하게 존재하며 아직 해소되지
않았음을 확인했다 — 원본(`code_review_orchestrator.py`)은 이 옛 헤더를 완전히 제거했는데 그
패턴이 두 파생 파일에는 전파되지 않았다. 그 외 `retry_state.load_state()`의 docstring 공백,
push/stop 훅 최상단 docstring 의 notes 메커니즘 미언급은 이전 라운드가 이미 낮은 우선순위로
남겨둔 항목이 그대로 열려 있음을 재확인한 것으로, 새로운 위험은 아니다. CHANGELOG·신규 설정·
API 문서 관점에서는 여전히 조치가 필요한 갭이 없다.

## 위험도

LOW
