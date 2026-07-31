# 성능(Performance) 리뷰 보고서

## 메타 노트 — 프롬프트 조립 결함

`_prompts/performance.md` 에서 파일 1(`.claude/hooks/_lib/review_guard.py`)과 파일 3
(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`)은 "변경 유형: Review"
메타데이터만 있고 diff/전체 컨텍스트가 비어 있었다(harness 조립 갭 — 메모리
`feedback_workflow_disk_write_gap_false_counts` 류와 같은 클래스). 두 파일 모두 실제로는
`origin/main` 대비 각각 46/53 줄의 diff 를 갖고 있어, 누락 시 이 리뷰가 거짓 음성(false
negative)이 될 뻔했다. `git diff origin/main...HEAD` 로 직접 두 파일을 열어 검토했고, 아래
발견사항의 위치는 조립 프롬프트가 아니라 **원본 소스 파일의 실제 줄 번호**(Read/git diff 기준)다.

## 발견사항

- **[WARNING]** `--impl-prep`/`--impl-done` 모드에서 동일 git diff 범위를 두 번 서브프로세스로 조회
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`
    (`_branch_changed_rels` 정의), 호출부 `:493`, `:506`(scope 한정), `:555`(전체 repo, unscoped)
  - 상세: `collect_context()`가 `--impl-prep`/`--impl-done` 브랜치 안에서
    `_branch_changed_rels(_rank_diff_base, root, target_path_rel)`(대상 디렉터리로 pathspec 제한)를
    호출한 뒤, 같은 함수 안 후반부(공통 코드, 라인 555)에서 `_branch_changed_rels(_rank_diff_base, root)`
    (pathspec 없이 전체 repo)를 **한 번 더** 호출한다. 둘 다 `git diff --no-renames --name-only
    <base>...HEAD [-- <pathspec>]` 로 **완전히 같은 커밋 범위**를 조회하며, scoped 결과는 항상
    unscoped 결과의 부분집합이다(pathspec 은 필터링만 할 뿐 새 항목을 추가하지 않음). 매 호출마다
    git 프로세스 fork/exec + 최대 30s 타임아웃 대기 가능성이 두 배로 들고, 저장소 히스토리가 크거나
    브랜치 diff 가 넓을수록 이 중복 비용도 커진다.
  - 제안: unscoped 결과(라인 555)를 먼저 한 번만 계산해 재사용하고, scope 한정 부분집합은 Python 에서
    `rel.startswith(target_path_rel_normalized)` 같은 prefix 필터로 파생한다. git 서브프로세스 spawn 을
    호출 경로당 1회로 줄일 수 있다.

- **[INFO]** `plan/in-progress/` 디렉터리를 매 호출마다 이중 순회 + 이중 read
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:428-430`
    (`_rank_plan_text`), `:549`(`plan_files = collect_markdown_files(plan_dir, ...)`)
  - 상세: 428번 줄에서 `collect_markdown_files(plan_dir)`(`os.walk` 1회)로 파일 목록을 얻고
    각 파일을 `read_text_file()`로 전부 읽어 `_rank_plan_text` 하나의 문자열로 합친다. 이 값은
    `prioritize_bundle_files`의 랭킹 입력으로만 쓰인다. 그런데 549번 줄에서 **같은 `plan_dir`**을
    `exclude_paths=excluded`로 다시 `collect_markdown_files`(두 번째 `os.walk`)하고, 그 결과
    `plan_files`는 이후 `format_file_bundle(plan_files, root, "plan/in-progress 진행 중 문서")`
    안에서 각 파일을 `read_text_file()`로 **또 한 번** 읽는다. 즉 plan/in-progress 아래 모든 파일이
    호출당 디렉터리 순회 2회 + 전체 내용 read 2회를 거친다. 현재 규모(실측: 30개 파일, 약 1.0MB)에서는
    체감 비용이 작지만, 순회/read 결과를 캐싱하지 않는 구조라 `plan/in-progress`가 계속 누적되는
    코퍼스라는 점(프로젝트 전역 컨벤션상 상시 성장)을 고려하면 성장에 비례해 비용도 선형으로 늘어난다.
  - 제안: 첫 번째 walk 에서 얻은 파일 목록·본문을 재사용해 두 번째 walk/read 를 생략(단, `excluded`
    집합 반영 시점 차이만 주의).

- **[INFO]** 랭킹 `tier()`가 파일마다 코퍼스 전체를 substring 스캔하며, 이 스캔이 최대 3개 번들에서
  중복 수행됨
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:267-301`
    (`prioritize_bundle_files`, 특히 `tier()` 클로저 `:289-297`)
  - 상세: `tier(path)`는 카탈로그(`_is_catalog_bulk`)·변경-집합(`rel in changed`, O(1) 셋 조회) fast
    path 를 통과하지 못한 각 파일에 대해 `rel in plan_text or os.path.basename(rel) in plan_text`
    로 `plan_text`(현재 실측 ~1MB) 전체를 substring 스캔한다. `sorted(file_paths, key=lambda p:
    (tier(p), p))`는 파일당 `tier()`를 1회만 호출하므로(비교 함수가 아니라 키 함수) 호출 수 자체는
    O(n)이지만, 이 랭킹 로직은 `--impl-prep`/`--impl-done`의 `scope_files`(:491, :504)뿐 아니라
    공통 경로의 `other_spec_files`/`convention_files`(:557-558) — 즉 한 번의 `collect_context()`
    호출에서 최대 3개 번들 각각에 대해 — 독립적으로 재실행되며, 매번 **동일한 `plan_text`를 처음부터
    다시 스캔**한다(사전 인덱싱/캐싱 없음). 실측: `spec/` 전체 383개 파일(9.2MB) 중 conventions 하위
    카탈로그 249개는 `_is_catalog_bulk`로 즉시 걸러지므로 실제 substring 스캔 대상은 스펙 본문
    (`other_spec_files`, 대략 백여 개) + non-카탈로그 conventions(`convention_files`, 약 21개) 규모다.
    지금 규모에서는 체감상 수백 ms 이내로 추정되지만, `spec/`와 `plan/in-progress/` 모두 이 저장소에서
    상시 누적되는 코퍼스이므로(같은 PR 의 plan 문서 자체가 "8회 재발" 이력을 기록할 만큼 두 코퍼스가
    꾸준히 커져 왔음을 보여줌) 코퍼스 크기 × 번들 수에 비례해 계속 늘어나는 구조다.
  - 제안: 급하지 않음(현재 규모에서 병목 아님) — 필요해지면 `plan_text`에서 파일 경로/basename
    토큰을 한 번만 추출해 `set`으로 인덱싱한 뒤 O(1) 멤버십 체크로 대체하면, 번들 3개에 걸친 재스캔
    비용을 없앨 수 있다.

- **[INFO]** 기본 `--prepare` 경로에 git 호출 최대 4회 추가 (참고용, 문제 아님)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1092`
    (`_default_branch_ref`), `:1104`(`warn_if_committed_work_is_missing`), 호출부 `:1182`
  - 상세: 신규 경고 로직이 explicit mode(`--branch`/`--range`/`--commit`/`--files`) 없는 기본
    `--prepare` 경로에 `_default_branch_ref()`(`symbolic-ref` 1회 + 실패 시 `rev-parse --verify`
    최대 2회)와 `get_git_branch_diff_files(base)`(`git diff --name-only` 1회)를 추가로 호출한다.
    기존 경로도 `get_git_diff_files()`에서 이미 최대 3회의 git 호출을 하므로 비례적으로 크지 않고,
    파일 수·루프에 비례하지 않는 1회성 호출이며 advisory-only(git 실패 시 조용히 무시, 리뷰 자체를
    막지 않음)로 설계돼 안전하다. 문제로 분류하지 않으며 참고 목적으로만 기록한다.

## 요약

이번 diff 의 핵심(`prioritize_bundle_files` 도입에 의한 consistency 번들 4계층 재배열,
`warn_if_committed_work_is_missing` 경고, `evaluate_review(in_flight_ok=)` opt-in 화)은 모두
"CLI 오케스트레이터가 리뷰 세션 준비 단계에서 한 번 수행하는" 로직으로, 요청량이 커질수록 비용이
기하급수적으로 느는 구조적 결함(N+1 루프, O(n²) 누적, 블로킹 I/O 병목)은 발견되지 않았다. 다만
`_branch_changed_rels`가 동일 커밋 범위를 scoped/unscoped 로 나눠 두 번 subprocess 호출하는 것은
명백히 회피 가능한 중복이라 WARNING 으로 표시했다. 나머지 두 건(plan/in-progress 이중 순회·read,
`tier()`의 전체 코퍼스 반복 스캔)은 현재 코퍼스 규모(spec 9.2MB/383파일, plan/in-progress
1MB/30파일)에서는 체감 병목이 아니지만, 두 코퍼스 모두 이 저장소에서 상시 누적되는 성격이라 향후
스케일 관찰 항목으로 남긴다. 이 스크립트들은 이후 LLM 서브에이전트 호출(수십 초~수 분)이 뒤따르는
1회성 준비 단계이므로, 위 항목들이 실제 체감 지연에 미치는 영향은 현재로선 미미하다.

## 위험도

LOW
