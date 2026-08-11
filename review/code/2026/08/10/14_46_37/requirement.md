# 요구사항(Requirement) 리뷰

## 조사 방법

`meta.json` 기준 리뷰 대상은 9개 실제 파일(`.claude/commands/ai-review.md`,
`.claude/skills/code-review-agents/{README,SKILL}.md`,
`.claude/skills/code-review-agents/lib/session.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/tests/{README.md,test_line_anchors.py,test_review_prepare_single_session.py}`,
`plan/in-progress/harness-review-gate-followups.md`) + 다수의 과거 리뷰/일관성 세션 산출물
(`review/code/**`, `review/consistency/**`, 총 90여 파일, 전부 이력 문서로 재검토 대상 아님).
실제 기능 변경은 세션 디렉터리 이름 충돌 회피(`session.py::create_session_dir`)와 리뷰
배치 분할 제거(`code_review_orchestrator.py::_warn_large_changeset`/`main`/
`_source_files_missing_from_changeset`) 두 축이다. 코드·테스트·문서 3자를 Read 로 직접
대조했고, 지시대로 `plan/in-progress/harness-review-gate-followups.md` 의 수치 서술을
실측으로 재판정했다.

## 발견사항

- **[WARNING]** plan 의 뮤테이션 목록이 서로 다른 두 작업의 항목을 한 문장에 섞어 놓아
  `test_review_prepare_single_session.py` 의 실제 커버리지를 과대 서술한다.
  - 위치: `plan/in-progress/harness-review-gate-followups.md:552`~`554`
    (`뮤테이션 7/7 RED(분할 복원·경계 \`>\`→\`>=\`·\`compute_forced_agents\` 무력화·교차검사
    호출부 절단·소스 필터 제거·안내 호출부 절단·삭제-전용 커밋 가드 제거)`)
  - 상세: 이 문단은 `회귀 test_review_prepare_single_session.py 19건` 바로 뒤에 "뮤테이션
    7/7 RED" 를 붙여, 나열된 7개 뮤턴트가 전부 그 19건 스위트(배치 분할 제거 + fail-closed
    교차검사)에 대한 것처럼 서술한다. 그런데 마지막 항목 "삭제-전용 커밋 가드 제거"는
    `test_review_prepare_single_session.py` 와 무관하다 — `git log -S _make_deletion_only_repo`
    로 확인한 결과 그 가드는 `.claude/tests/test_line_anchors.py::CommitFixtureSelectionTest`
    에 커밋 `2b71fd9f7`("fix(harness): 리뷰 5건 반영 — … + 가드의 결정적 재현")로 추가된
    것으로, 배치 분할 제거 커밋(`193d43fc5`, "fix(harness): 리뷰 세션 배치 분할이 거짓
    PASS 를 만들고 있었다")과는 **다른 날 다른 목적의 별개 작업**이다.
    `git show 193d43fc5 --stat` 로 확인해도 그 커밋은 `test_line_anchors.py` 를 전혀
    건드리지 않았고, `.claude/tests/README.md:65` 의 자체 서술도 이 가드를
    `test_line_anchors.py` 소유로 명시하고 있어 plan 문서의 이 한 줄만 서로 다른 두
    파일의 뮤테이션 실적을 뒤섞은 상태다. 실제로 `test_review_prepare_single_session.py`
    가 겨냥할 만한 뮤턴트는 나열된 것 중 앞 6개(분할 복원 / 경계 `>`→`>=` /
    `compute_forced_agents` 무력화 / 교차검사 호출부 절단 / 소스 필터 제거 / 안내 호출부
    절단)뿐이며, 이는 코드 구조(`PrepareEmitsExactlyOneSessionTest`,
    `LargeChangesetIsAnnouncedTest`, `ForcedSetShrinksWithTheChangesetTest`,
    `DocsOnlyFramingIsCrossCheckedTest`)와 정확히 대응해 6/6 로 보인다. "7/7" 라는 숫자와
    마지막 항목은 이 파일의 실적이 아니다.
  - 제안: 그 줄을 "뮤테이션 6/6 RED(분할 복원·경계 `>`→`>=`·`compute_forced_agents` 무력화·
    교차검사 호출부 절단·소스 필터 제거·안내 호출부 절단)" 로 정정하고, "삭제-전용 커밋 가드
    제거" 항목은 `test_line_anchors.py` 관련 서술(§13 인근 또는 별도 항목)로 옮기거나 이미
    `.claude/tests/README.md` 에 정확히 기술돼 있으므로 이 plan 문서에서는 제거한다.

## 검증해서 문제 없음을 확인한 항목 (지시받은 재판정 범위)

- **"17건→19건" 정정, 상위 체크박스 동기화**: 둘 다 실측으로 재확인됨. `grep -c "def test_"
  .claude/tests/test_review_prepare_single_session.py` = 19 (`PrepareEmitsExactlyOneSessionTest`
  6 + `LargeChangesetIsAnnouncedTest` 4 + `ForcedSetShrinksWithTheChangesetTest` 2 +
  `DocsOnlyFramingIsCrossCheckedTest` 7 = 19), plan 서술과 일치한다. 상위 요약(`## 현재
  상태`, `harness-review-gate-followups.md:30`)도 "미해결 조사 1건 … → 종결 (2026-08-10)"
  로 갱신돼 있고, 하위 중첩 체크박스(`:471`, `:522`, `:532`, `:594`) 전부 `[x]` 로 동기화돼
  있다 — 미해결 항목(`:40`, `:424`, `:429`)만 `[ ]` 로 남아 있는데 각각 실제로 아직 미착수
  상태(문구 명문화 안 됨, spec 편집 없음)와 일치한다.
- **`session.py::create_session_dir` / `code_review_orchestrator.py` 배치 제거**: 코드가
  plan·SKILL.md·README.md·ai-review.md 서술과 line-level 로 일치한다. `_MAX_SESSION_NAME_ATTEMPTS`
  소진 시 `exist_ok=True` 폴백은 의도적으로 문서화된 트레이드오프(docstring 명시)이고 신규
  테스트(`test_review_prepare_single_session.py`)가 `--prepare` 는 changeset 크기와
  무관하게 정확히 한 줄만 stdout 에 낸다는 것, 임계값 초과 시 stderr 안내(경계값 `==`/`0`
  포함), forced-agent 축소 증폭, fail-closed 교차검사(불완전 changeset 시 소스 파일 나열,
  git 실패 흡수, base 미해결 시 무음)까지 엣지 케이스를 빠짐없이 커버한다.
- **문서-코드 상호 참조**: `SKILL.md`/`README.md`/`ai-review.md` 의 "세션은 분할하지 않는다"
  서술, `.claude/tests/README.md` 의 두 신규 테스트 파일 항목 모두 실제 코드 동작과
  일치한다. `subagent-call-contract.md` 등 관련 문서에 배치 관련 잔존 서술 없음을 grep 으로
  확인.
- **spec fidelity**: 이 변경 영역(`.claude/` 개발 하네스)은 `spec/` 대상 product 문서가
  아니라 `.claude/skills/**/{README,SKILL}.md` 가 자체 SoT 다. 그 문서들과 코드가
  line-level 로 일치하므로 CRITICAL 없음. `spec/` 하위에 이 영역을 규정하는 별도 문서는
  없음(INFO 대상이나 이 도메인의 표준적 상태로, 별도 발견사항으로 등재하지 않음).

## 요약

핵심 기능 변경(세션 디렉터리 충돌 회피, 리뷰 배치 분할 제거 + fail-closed 교차검사)은 코드·
테스트·문서 3자가 정확히 맞물려 있고 엣지 케이스·에러 흡수·반환값 모두 빈틈이 없다. 지시받은
재판정 대상이었던 "17→19건"·"상위 체크박스" 두 항목은 실측 결과 이미 정확히 정정돼 있다.
다만 재판정 과정에서 새로운 plan 서술 오류를 하나 발견했다 — `test_review_prepare_single_session.py`
의 "뮤테이션 7/7 RED" 목록 마지막 항목("삭제-전용 커밋 가드 제거")이 실제로는 완전히 다른
날·다른 커밋·다른 파일(`test_line_anchors.py`)의 작업을 가리키고 있어, 이 회귀 스위트의
실제 뮤테이션 실적을 부풀려 서술한다. 코드 자체의 결함은 아니고 plan 문서의 사실 서술
오류(경미)다.

## 위험도

LOW
