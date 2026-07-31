# Testing Review — harness-bundle-correctness-0a4694

대상: `origin/main...HEAD` 3커밋(`1c8f16e6f` 번들 splitter sentinel 화, `ad9701b3e`
`_charge_notice` 예산 계상 통합, `0b99b3757` natural sort 적용) — 실제 diff 는
`code_review_orchestrator.py`/`consistency_orchestrator.py`/테스트 2건/plan 1건, 총
184줄 추가·33줄 삭제.

## 검증 방법 (요약)

- 프롬프트에는 5개 파일 모두 "전체 파일 컨텍스트"만 실리고 unified diff 블록이 없었다 —
  이 세션이 이미 커밋된 상태에서 `--branch` 없이 준비된 탓으로 보인다(모든 파일이 이미
  working tree 와 index 에서 clean). 실제 변경분은 `git diff origin/main...HEAD -- <path>`
  로 직접 대조해 확인했다.
- 관련 테스트 개별 실행: `test_consistency_bundle_priority.py`(18) ·
  `test_consistency_context_budget.py`(18, subtests 포함) ·
  `test_prompt_omission_notice.py`(7) · `test_line_anchors.py` — 전부 GREEN.
- `.claude/tests/` 전체 스위트: `python3 -m unittest discover -s .claude/tests -p "test_*.py"`
  → **704 tests, OK** (회귀 없음; 직전 라운드 702 대비 +2 는 이번에 추가된 신규 테스트 수와 일치).
- **뮤테이션 3종을 직접 수행**(커밋된 클린 상태에서 `cp`로 백업 후 수정 → 테스트 → `git checkout --`
  로 원복, 매번 `git status`/`git diff` 무변경 확인):
  1. `collect_markdown_files`/`prioritize_bundle_files`의 `_natural_key` 정렬을 원래의
     사전순(`p`)으로 되돌림 → `test_ties_use_natural_order_not_lexicographic` 가 정확히
     RED(`AssertionError: Lists differ`).
  2. `_BUNDLE_FILE_SENTINEL` 값을 콘텐츠가 위조 가능한 옛 마커 스타일로 되돌림 →
     `ContentCannotForgeAFileBoundaryTest`의 두 테스트 모두 RED(`non-file entries leaked
     into the notice: ['#### ']` 등).
  3. `code_review_orchestrator.py`의 `_charge_notice` 호출 한 곳(퍼-파일 생략 안내 예약)을
     `pass`로 무력화 → `test_prompt_omission_notice.py` 7건 중 7건이 RED(그중
     `test_notices_are_paid_for_out_of_the_same_budget`는 이번 리팩터가 재발을 막으려는
     바로 그 버그의 회귀 테스트).
  - 세 뮤테이션 모두 해당 테스트를 정확히 RED 로 전환시켜, 신규/수정 코드가 vacuous 하지 않은
    실질 테스트로 뒷받침됨을 실측으로 확인했다.

## 발견사항

- **[WARNING]** 신규 테스트 파일에 이스케이프 오류가 있는 docstring 이 있다 —
  `DeprecationWarning: invalid escape sequence '\`'` 가 테스트 실행 시마다 출력된다.
  - 위치: `.claude/tests/test_consistency_context_budget.py:103`, `:105` (클래스
    `ContentCannotForgeAFileBoundaryTest` docstring 내 `` ``\n#### \``` ``, `` ``#### \`$trigger\``` ``
    등)
  - 상세: 백틱(`` ` ``)은 파이썬 문자열에서 이스케이프가 필요 없는 문자인데 `\`` 로 적어
    "invalid escape sequence" 경고를 유발한다(Python 3.11 기준 `DeprecationWarning`,
    `pytest -q` 실행 결과의 "1 warning" 이 바로 이것). 오늘은 실패하지 않지만, 향후 파이썬
    버전에서 이런 이스케이프가 하드 `SyntaxError` 로 승격될 수 있고, 어떤 CI 가 경고를
    에러로 처리하도록(`-W error`) 강화되면 이 파일이 import/compile 단계에서부터 깨진다
    (직접 확인: `warnings.simplefilter('error')` 하에서 `compile()` 이 바로 이 줄에서
    `SyntaxError` 를 던짐).
  - 제안: 백틱 앞 불필요한 백슬래시 제거, 또는 docstring 을 raw string(`r"""..."""`)으로 전환.

- **[INFO]** 신규 테스트 docstring 이 실제로는 **두 개의 서로 다른 spec 파일**에 나뉘어
  있는 헤딩을 한 파일 소속인 것처럼 서술한다.
  - 위치: `.claude/tests/test_consistency_context_budget.py:104-105` (그리고 같은 서술이
    `plan/in-progress/harness-consistency-summary-downgrade-rule.md:121` 에도 반복됨)
  - 상세: docstring 은 "`spec/5-system/5-expression-language.md` 가 `` `$trigger` ``,
    `` `$env` ``, `` `_selectedPort` `` 세 헤딩을 전부 정의한다" 고 적었다. 직접 확인
    (`grep -n '^#### \`' spec/5-system/5-expression-language.md`) 결과
    `` `$trigger`(229행)``·`` `$env`(246행) `` 은 맞지만, `` `_selectedPort` `` 헤딩은 그 파일에
    없고 `spec/5-system/4-execution-engine.md:266` 에 있다. 테스트의 `_FORGED` fixture
    자체는 (헤딩 3개가 실존 spec 레벨-4 헤딩이라는) 유효한 대표성을 여전히 갖고 기능적
    결함은 아니지만, 실증 근거로 특정 파일 하나를 지목한 서술이 검증 가능한 사실과
    어긋나 테스트 의도를 확인하려는 다음 사람을 오도할 수 있다.
  - 제안: "두 spec 파일에 흩어진 레벨-4 헤딩들" 정도로 서술을 완화하거나
    `4-execution-engine.md` 를 함께 언급.

- **[INFO]** `.claude/tests/test_consistency_context_budget.py` 에서 신규 클래스
  `ContentCannotForgeAFileBoundaryTest` 종료 직후 다음 클래스 정의 사이에 빈 줄이 1개뿐이다
  (PEP8 은 top-level 클래스/함수 사이 2줄을 관례로 함).
  - 위치: `.claude/tests/test_consistency_context_budget.py:153-155`
    (`153: self.assertCountEqual(...)` → `154:` 빈 줄 1개 → `155: class FileBundleTruncationTest`)
  - 상세: 같은 파일의 다른 클래스 경계(예: 99-100행)는 2줄 관례를 지킨다. 이 저장소에
    `.claude/tests/` 에 대한 flake8/pylint/ruff 강제가 없어(레포 전체 grep 결과 없음)
    빌드에 영향은 없다.
  - 제안: 빈 줄 1개 추가해 파일 내 다른 경계와 일관되게.

- **[INFO]** 이번 리팩터의 핵심 함수 `_charge_notice`는 직접 호출하는 단위 테스트가 없다
  (기존 `test_prompt_omission_notice.py`를 통한 간접 커버리지만 존재).
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `_charge_notice` (정의부, `_truncated_note` 바로 다음)
  - 상세: 이 함수는 "동일한 산술을 4곳에서 손으로 반복하다 두 번 어긋난" 문제를 봉합하려는
    한 줄짜리(`budget - sum(len(n) for n in notes)`) 헬퍼다. 위 뮤테이션 검증에서 확인했듯
    간접 커버리지(`test_prompt_omission_notice.py`)가 이미 실질적으로 회귀를 막고 있어
    시급하지 않지만, `budget_left = _charge_notice(1000, "abc", "de")` 류의 직접 단위
    테스트를 하나 추가하면 "무엇을 보장하는 함수인지"가 호출부 없이도 즉시 읽힌다.
  - 제안: (선택) `_charge_notice`에 대한 2~3줄짜리 직접 단위 테스트 추가 — 필수는 아님.

## 회귀 테스트 확인 (긍정적 관찰)

- 전체 하네스 스위트 704건 GREEN, 직전 라운드(702) 대비 신규 테스트 수만큼 정확히 증가.
- `_natural_key`·sentinel 분리자·`_charge_notice` 세 변경 모두 뮤테이션으로 "이 테스트가
  실제로 그 결함을 잡는가"를 실측 확인했다 — 특히 sentinel 분리자 뮤테이션은
  `test_forged_headings_never_reach_the_omission_list`/
  `test_every_input_file_is_either_kept_whole_or_named` 양쪽 모두를 정확히 RED 로
  전환시켜, "본문이 파일 경계를 위조할 수 없다"는 이 PR 의 핵심 계약이 테스트로
  실질적으로 고정되어 있음을 확인했다.
- `test_ties_stay_alphabetical`(이전 라운드가 "사전순을 의도된 동작으로 잘못 고정한다"고
  지적했던 vacuous 테스트)이 이번 라운드에서 `test_ties_use_natural_order_not_lexicographic`
  로 교체되어 정확히 그 갭을 닫았다 — 직전 라운드 지적 사항이 이번 diff 로 해소됨을 확인.
- `.claude/tests/test_tests_readme_catalog.py`·`.claude/tests/README.md` 는 이번 두 테스트
  파일에 대한 신규 항목 추가가 필요 없다(파일 자체가 새로 생긴 것이 아니라 기존 파일에
  테스트를 추가/치환한 것이고, README 서술은 정성적이라 테스트 건수 불일치 문제가 없음).
- 새 테스트들은 mock 을 쓰지 않고 실제 subprocess(신선한 인터프리터)·실제 git 저장소로
  검증한다(`bundle 마커/센티널을 orch 모듈에서 직접 읽어옴`, `_branch_changed_rels`는 임시
  git repo로 rename/edit/unknown-base 케이스까지). "호출 횟수만 세는 스파이가
  pass-through 뮤턴트를 못 잡았다"는 이 코드베이스 자신의 과거 실패를 docstring 에 명시하고
  효과(렌더링 순서·생략 여부) 단언으로 교정한 설계가 이번 diff 에도 일관되게 이어진다.

## 요약

이번 3커밋 diff — natural sort 완성, 번들 splitter 의 sentinel 화, 예산 계상 통합
(`_charge_notice`) — 는 모두 회귀 테스트를 동반하며, 그 테스트들이 실제로 결함을
재현·차단하는지 직접 3종의 뮤테이션으로 실측 확인했다(전부 RED 전환 확인 후 원복).
전체 하네스 스위트 704건도 회귀 없이 GREEN 이다. 직전 라운드가 지적했던 "동일 tier
내 정렬이 사전순으로 고정된 vacuous 테스트" 갭은 이번 diff 로 정확히 해소됐다. 남은
항목은 전부 비차단(WARNING 1 · INFO 3) 수준이다: 신규 테스트 docstring 의 이스케이프
경고(사소하지만 향후 파이썬/엄격 경고 설정에서 깨질 수 있음), 같은 docstring 이 헤딩
소속 파일을 하나로 잘못 단순화한 사실 오류(plan 문서에도 동일하게 반복), 클래스 경계
빈 줄 관례 불일치, 그리고 `_charge_notice`의 직접 단위 테스트 부재(간접·뮤테이션
검증으로 충분히 상쇄됨). 프롬프트에 unified diff 블록이 빠져 있었던 점은 harness
세션 준비 방식(커밋 후 `--branch` 미사용)의 문제로 보이며 이 5개 파일의 코드 품질과는
무관하다 — `git diff` 직접 대조로 우회했다.

## 위험도

LOW
