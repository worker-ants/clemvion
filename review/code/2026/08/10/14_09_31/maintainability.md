# 유지보수성(Maintainability) Review

## 조사 범위 메모

프롬프트에 파일 81개가 나열돼 있으나, 그중 실질 코드/문서 변경은 앞의 7개
(`.claude/commands/ai-review.md`, `.claude/skills/code-review-agents/README.md`,
`.claude/skills/code-review-agents/SKILL.md`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/tests/README.md`, `.claude/tests/test_review_prepare_single_session.py`,
`plan/in-progress/harness-review-gate-followups.md`)뿐이다. 나머지 74개
(`review/code/**`, `review/consistency/**`)는 과거 리뷰 세션들이 생성한 결과물
(markdown/json)을 커밋으로 회수한 것으로(`git diff origin/main...HEAD --stat` 확인
결과 전부 순수 신규 추가, 0줄 삭제/수정), 자동 생성 리포트 텍스트라 가독성·네이밍·
함수 길이 등 유지보수성 관점 판정 대상이 아니다. 이하 발견사항은 실질 코드 파일
(`code_review_orchestrator.py`, `test_review_prepare_single_session.py`)에 대한 것이다.
`ai-review.md`/`README.md`/`SKILL.md`/`tests/README.md` 의 1~수 줄짜리 문구 정정은
그 자체로 문제가 없다.

## 발견사항

- **[WARNING]** 신규 테스트가 오케스트레이터 소유의 `ALL_AGENTS` 목록을 손으로
  다시 나열해 드리프트 위험을 재도입한다.
  - 위치: `.claude/tests/test_review_prepare_single_session.py:155-160`
    (`class ForcedSetShrinksWithTheChangesetTest` 의 `ALL = [...]`) vs
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:102-107`
    (`ALL_AGENTS = [...]`)
  - 상세: 신규 `ForcedSetShrinksWithTheChangesetTest._forced()` 는 14개 reviewer
    이름을 손으로 나열한 클래스 상수 `ALL` 을 `ARG["all"]` 로 넘겨
    `compute_forced_agents` 를 호출한다. 이 목록은 오케스트레이터가 이미 export 하는
    `ALL_AGENTS`(순서·내용 동일)의 완전한 복제다. 테스트는 `run_in_orchestrator` 로
    신선한 인터프리터에 오케스트레이터 모듈(`orch`)을 이미 로드해 두므로,
    스니펫 안에서 `orch.ALL_AGENTS` 를 바로 참조할 수 있는데도 별도 리스트를
    새로 만들었다. 향후 15번째 reviewer 가 `ALL_AGENTS` 에 추가돼도 이 테스트의
    `ALL` 은 자동으로 안 따라가며, 그 결과 `compute_forced_agents(paths, ALL, root)`
    가 실제 운영 시 쓰이는 전체 후보 집합과 다른 부분집합으로 조용히 실행될 수
    있다 — 이 프로젝트가 여러 차례 겪은 "손으로 유지하는 목록이 SoT 와 조용히
    갈라지는" 실패 클래스와 정확히 같은 모양이다.
  - 제안: `ALL = [...]` 클래스 상수를 제거하고, `_forced()` 내부 스니펫에서
    `agents, _ = orch.compute_forced_agents(ARG["paths"], orch.ALL_AGENTS, ARG["root"])`
    처럼 오케스트레이터가 소유한 리스트를 직접 참조하도록 바꾼다(`ARG` 로 넘길 필요도
    없어져 시그니처가 단순해진다).

- **[WARNING]** "목록을 20개까지 보여주고 나머지는 개수로 요약" 하는 두 줄짜리
  블록이 이번 diff 로 한 번 더 복제됐다 (매직넘버 `20` 포함).
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:920-921`
    (`src_paths` 용, 기존 코드) 및 `:936-937` (`unseen` 용, 이번 diff 로 신규 추가) —
    함수 `build_router_prompt_body`
  - 상세: 두 블록 모두
    `shown = "\n".join(f"  - \`{p}\`" for p in X[:20])` /
    `more = f"\n  - … 외 {len(X) - 20}개" if len(X) > 20 else ""`
    형태로, 변수명(`src_paths` vs `unseen`)만 다를 뿐 로직·문자열 포맷·상한값(20)이
    글자 그대로 같다. 같은 파일에는 이미 세 번째 유사 구현(`_aggregate_omission_note`,
    :1400 부근, 바이트 예산 기반 절단)도 존재해 "목록 자르고 개수 안내" 패턴이
    이제 서로 다른 규칙(고정 20개 vs 바이트 예산)으로 최소 두 곳에서 손으로
    구현돼 있다. 상한을 20→30으로 바꾸는 등의 향후 수정 시 한 곳만 고치고
    다른 한 곳을 놓치기 쉽다.
  - 제안: `_format_truncated_list(paths, limit=20)` 같은 작은 헬퍼로 추출해
    920-921, 936-937 양쪽에서 재사용한다. `_aggregate_omission_note` 는 제약
    (바이트 예산)이 달라 통합 난이도가 높으므로 우선순위를 낮게 둬도 무방하다.

- **[INFO]** 같은 목적(호출 세션에게 changeset 판단 주의를 주는 stderr advisory)의
  두 함수가 언어·어조 컨벤션이 갈린다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1172-1180`
    (`_warn_large_changeset`, 이번 diff 로 신규) vs `:1383-1397`
    (`warn_if_committed_work_is_missing`, 기존)
  - 상세: 두 함수 모두 "changeset 계산에 놓친 부분이 있을 수 있으니 호출 측이
    넓게 판단하라"는 동일 성격의 안내를 stderr 에 낸다. 기존
    `warn_if_committed_work_is_missing` 은 한국어 문장 + `⚠️` 이모지로 구성돼
    이 파일의 다른 에이전트-대상 안내(router 프롬프트 본문 등)와 톤이 맞는 반면,
    신규 `_warn_large_changeset` 은 영어 + `!! LARGE CHANGESET` ASCII 배너를 쓴다.
    기능적 결함은 아니지만, 같은 파일 안에서 "호출 세션이 읽고 판단에 반영해야
    하는" 부류의 메시지가 서로 다른 스타일 규칙을 따르게 됐다.
  - 제안: 급하지 않음. 다음에 이 함수를 만질 때 `warn_if_committed_work_is_missing`
    과 같은 한국어 톤으로 맞추면 일관성이 개선된다.

## 요약

이번 diff 의 핵심 변경(`code_review_orchestrator.py` 의 배치 분할 루프 제거,
`main()` 단순화, `_warn_large_changeset`/`_source_files_missing_from_changeset`
신규 헬퍼)은 오히려 순환 복잡도를 낮추는 방향이다 — 이전에는 `main()` 안에 배치
슬라이싱·인덱싱 루프가 있었는데 이를 걷어내고 "changeset 전체를 한 세션에" 로
단순화했고, 두 신규 헬퍼는 각각 단일 책임·얕은 중첩·명확한 이름(`_warn_large_changeset`,
`_source_files_missing_from_changeset`)을 갖는다. 긴 docstring 은 이 파일 전체의
확립된 관례(결정의 배경을 함수 바로 위에 남기는 방식)와 일치해 문제로 보지 않았다.
신규 테스트 파일(`test_review_prepare_single_session.py`)도 클래스별 책임이 명확히
나뉘어 있고 헬퍼(`_infos`, `run_in_orchestrator`) 재사용이 잘 돼 있다. 다만 두 군데
에서 새 중복이 들어왔다 — 오케스트레이터가 이미 소유한 `ALL_AGENTS` 를 테스트가 손으로
다시 나열한 것과, "20개까지 보여주고 나머지는 개수로" 포맷 블록이 한 번 더 복제된 것 —
둘 다 기계적으로 쉽게 제거 가능한 DRY 위반이며, 특히 전자는 이 프로젝트가 반복적으로
겪어 온 "손 유지 목록 드리프트" 패턴이라 우선 정리할 가치가 있다. 실질 코드 이외의
74개 리뷰 산출물 파일은 자동 생성 리포트라 유지보수성 평가 대상에서 제외했다.

## 위험도

LOW
