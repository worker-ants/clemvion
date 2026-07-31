# 성능(Performance) Review

리뷰 대상: `origin/main...HEAD` (harness review-gate 수정 브랜치). `.claude/agents`, `.claude/hooks`,
`.claude/skills/{code-review-agents,consistency-checker}`, `.claude/tests`, `plan/in-progress/**` —
전부 harness/tooling 코드(개발 워크플로 CLI·git hook)이며 `codebase/` 애플리케이션 코드 변경은 없음.
프롬프트에서 크기 제한으로 생략된 `review_guard.py` / `code_review_orchestrator.py` /
`consistency_orchestrator.py` 는 `Read` + `git diff origin/main...HEAD -- <path>` 로 직접 확인.

## 발견사항

- **[INFO]** `plan/in-progress/**.md` 디렉터리를 같은 호출 안에서 두 번 walk+read
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:445-447` (1차) 및
    `:567`→`:578` (2차, `format_file_bundle` 내부의 `read_text_file` 호출)
  - 상세: 신설된 랭킹 입력 `_rank_plan_text` 가
    `read_text_file(p) for p in collect_markdown_files(plan_dir)` (445-447줄) 로 `plan/in-progress`
    전체를 walk 하고 각 파일을 즉시 전문 read 한다. 그런데 같은 함수 안에서 이후
    `plan_files = collect_markdown_files(plan_dir, exclude_paths=excluded)` (567줄) 가 **같은
    디렉터리를 다시 walk** 하고, 그 결과가 `format_file_bundle(plan_files, ...)` (578줄) 에서
    각 파일을 `read_text_file` 로 **다시 read** 한다. `excluded` 는 spec_dir 계열 경로만 채워지므로
    (`--plan` 모드에서만 draft 파일 1개가 예외) 두 `collect_markdown_files(plan_dir, ...)` 호출은
    사실상 동일 파일 집합을 반환 — 즉 이번 diff 가 plan/in-progress 의 모든 마크다운 파일을 매
    호출마다 "walk 2회 + 전문 read 2회" 로 만들었다.
  - 실측(이 저장소, 실제 데이터): `plan/in-progress/*.md` 58개 파일, 결합 텍스트 673,694자.
    1차 read ~3.5ms, 2차 read ~2.4ms — 오늘 기준 영향은 미미하지만 plan 백로그가 커질수록
    선형으로 늘어나는 회피 가능한 중복 I/O 다.
  - 제안: `plan_files = collect_markdown_files(plan_dir, exclude_paths=excluded)` 를 (mode 분기
    이전으로 끌어올려) 한 번만 계산하고, `_rank_plan_text` 를 그 결과의 이미 읽은 내용에서
    구성한 뒤 `format_file_bundle` 호출에도 그 리스트를 재사용한다 (읽은 내용 자체를 캐싱해도 됨).

- **[INFO]** 파일별 tiering 이 전체 plan 코퍼스에 대해 선형 부분문자열 검색을 반복
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:292-303`
    (`prioritize_bundle_files` 내부 `tier()` 클로저), 호출부 `:309`
    (`sorted(file_paths, key=lambda p: (tier(p), p))`)
  - 상세: 번들의 파일마다(현재 저장소 `spec/` 전체 기준 383개) `tier()` 가
    `rel in plan_text` 와 `os.path.basename(rel) in plan_text` 로 최대 2회, **결합된 plan 텍스트
    전체**를 대상으로 부분문자열 검색을 수행한다 — O(파일 수 × plan 텍스트 길이). 이 계산은
    `--spec`/`--plan`/`--impl-prep`/`--impl-done` **모든 모드에서 무조건** 수행된다
    (`other_spec_files`/`convention_files` 랭킹, 573-574줄).
  - 실측: 이 저장소의 실제 `spec/` 트리(383 파일) × 실제 plan 코퍼스(~674KB) 로
    `prioritize_bundle_files` 전체 호출 ~20ms — 이후 이어지는 checker 당 수 초 단위 LLM 호출에 비하면
    무시할 수준이나, "파일 수"와 "plan 코퍼스 크기" 두 축이 각각 독립적으로 커질 수 있어 스케일링
    특성으로 기록해 둔다.
  - 제안: 체감 지연이 생기면 파일마다 전체 코퍼스를 재스캔하는 대신, `plan_text` 에서 한 번만
    토큰화/정규식 추출한 "언급된 basename 집합" 을 사전 계산해 멤버십 검사로 대체.

- **[INFO]** 기본(`--prepare`, 인자 없음) 리뷰 준비 경로의 git 프로세스 spawn 수가 3→7 로 증가
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1126`
    (`_default_branch_ref` — 최대 3회 순차 `_git()` 호출: symbolic-ref → rev-parse origin/main →
    rev-parse origin/master) 및 `:1150-1169` (`warn_if_committed_work_is_missing` —
    `_default_branch_ref()` 후 `get_git_branch_diff_files(base)` 로 1회 더)
  - 상세: `collect_change_infos` 의 기본 분기(인자 없는 `--prepare`)는 이미
    `get_git_diff_files()` 에서 3회(`diff --cached` / `diff` / `ls-files --others`) git 을 spawn 하는데,
    이번 diff 로 그 뒤에 `warn_if_committed_work_is_missing(files)` 호출이 추가돼 최대 4회
    (fallback 3 + branch diff 1) 가 더 spawn 될 수 있다.
  - 평가: 반복문 안이 아니라 스크립트당 1회, 각 호출에 timeout 이 있어(N+1 이 아니라 고정 상수
    증가) 문제로 보지 않는다 — 이 경고가 막는 결함(`plan/in-progress/harness-review-gate-ci-backstop.md`
    §관측(1), 기본 changeset 이 커밋된 브랜치 작업을 조용히 누락하는 거짓 수렴)의 가치가 더 크다.
    참고용으로만 기록.

## 요약

이번 변경은 전부 `.claude/hooks`·`.claude/skills` 하위 harness/CLI 도구이며 사용자 대면
`codebase/` 애플리케이션 경로는 건드리지 않는다. `review_guard.py` 의 `in_flight_ok` opt-in 화,
`code_review_orchestrator.py`/`consistency_orchestrator.py` 의 누락 파일 명시(`_omitted_content_note`,
`OMITTED_FILES_HEADING`)와 changeset 경고(`warn_if_committed_work_is_missing`)는 모두 O(1)~O(n)
수준의 가벼운 로직이고 새로운 O(n²) 문자열 누적이나 N+1 원격 호출은 없다(신설 `build_files_section`
분기·`_omitted_content_note` 는 상수 시간, `truncate_file_bundle` 류 기존 로직은 diff 밖). 유일하게
실질적인 회피 가능한 비효율은 `consistency_orchestrator.collect_context` 가 `prioritize_bundle_files`
랭킹을 위해 `plan/in-progress/**` 를 한 번 더 walk+read 하는 것인데, 실측 결과 현재 데이터 규모
(58 파일/674KB)에서는 수 ms 수준으로 무해하다. tiering 함수의 코퍼스 전체 재스캔도 383개 파일
기준 ~20ms 로, 뒤따르는 checker 당 수 초의 LLM 호출 앞에서는 잡음 수준이다. 세 항목 모두 급하지
않은 정리 대상으로 INFO 처리한다.

## 위험도
LOW
