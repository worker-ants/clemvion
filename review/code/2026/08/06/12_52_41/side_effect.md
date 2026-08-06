# 부작용(Side Effect) Review — round 8

## 조사 방법

`.claude/hooks/_lib/review_guard.py`(1064줄) 전체를 `Read`로 직접 열어 판정 체인을
따라갔고(`_run_git` → `_porcelain_path`/`_committed_code_changes` →
`_authoritative_code_time`/`_newest_commit_time` → `evaluate_review`), `scripts/check-
review-gate.py`, `.github/workflows/review-gate.yml`/`harness-checks.yml`, 신규
테스트 6개 파일, `plan/in-progress/harness-review-gate-ci-backstop.md`의 우회 배선/미해결
항목을 대조했다. round 7의 실제 수정(`_run_git`의 `.strip()` → `.rstrip()`)이 다른 호출부에
회귀를 일으키지 않는지, 그리고 이 커밋이 남긴 미해결 백로그 항목(#12, C-quoting)이 정말
"측정 불가"인지를 검증하기 위해 **내 소유 `mktemp` 디렉터리**에서 실제 git 명령을 재현했다
(저장소 워킹트리는 건드리지 않았다 — 실행 후 `git status --porcelain`으로 확인, 사전 상태와
동일: `plan/in-progress/harness-review-gate-ci-backstop.md`의 기존 미커밋 수정 + 이번 리뷰
세션 디렉터리만 존재).

## 발견사항

- **[WARNING]** `_committed_code_changes`가 반환하는 경로가 git의 C-quoting을 거치지 않아,
  이미 트래킹된 문서 항목(#12)보다 **더 심한 형태**로 신선도 시계(freshness clock)를
  붕괴시킨다 — commit 경로에서 `newest_code`가 완전히 0.0으로 떨어진다.
  - 위치: `.claude/hooks/_lib/review_guard.py:265`(`_committed_code_changes`),
    `.claude/hooks/_lib/review_guard.py:319`(`_newest_commit_time`, 특히 347행의
    `git log --format=%at HEAD -- *rel_paths` 호출), `.claude/hooks/_lib/review_guard.py:366`
    (`_authoritative_code_time`). 근본 원인의 단일 관문은
    `.claude/hooks/_lib/review_guard.py:206`(`_run_git`).
  - 상세: `plan/in-progress/harness-review-gate-ci-backstop.md:164`의 항목 12는 "미측정"으로
    남겨둔 채 `_porcelain_path`(uncommitted 경로, `git status --porcelain`)만 언급한다. 실제로
    `mktemp` 저장소를 만들어 재현하니, **같은 C-quoting(`core.quotePath` 기본값 true)이
    `_committed_code_changes`가 쓰는 `git diff --name-only`에도 그대로 적용**된다:

    ```
    $ git diff --name-only main..feature -- codebase/
    "codebase/backend/src/\355\225\234\352\270\200.ts"
    ```

    이 인용된 문자열이 그대로 `changed` 리스트에 들어가고, `_authoritative_code_time`이 이를
    "clean"(커밋된 파일)으로 분류해 `_newest_commit_time(repo_root, [그 문자열])`을 부른다.
    이 함수는 그 인용 문자열을 **문자 그대로 pathspec 인자**로 `git log -- <path>`에 넘기는데,
    실측 결과 아무 커밋도 매치하지 않고 **빈 출력·rc=0**을 낸다:

    ```
    $ git log --format=%at HEAD -- '"codebase/backend/src/\355\225\234\352\270\200.ts"'
    (빈 출력, rc=0)
    ```

    `_newest_commit_time`은 빈 출력을 "이 경로를 건드린 커밋이 없음"으로 해석해 `0.0`을
    반환한다(예외가 아니라 조용한 `0.0` — fail-open 계약과 정확히 같은 모양으로 판정을
    갈아탄다). 변경된 파일이 이 비-ASCII 파일 하나뿐인 브랜치라면
    `_authoritative_code_time`도 `0.0`을 돌려주고, `evaluate_review`의 Gate 1은

    ```python
    if newest_review < newest_code:   # newest_code == 0.0
    ```

    을 사실상 항상 통과시킨다 — `newest_review <= 0.0`(리뷰가 아예 없음)만 아니면, **저장소
    어딘가에 존재하는 아무 resolved 리뷰(이 변경과 무관한, 몇 달 전 것이라도)** 가 이 변경을
    "커버"하는 것으로 판정된다. 이 저장소는 이미 `review/code/**`에 수백 개의 resolved
    SUMMARY.md를 커밋해 두었으므로(`ReviewArtifactsStayTrackedTest`가 100개 초과를 고정),
    `newest_review <= 0.0`은 사실상 절대 참이 되지 않는다 — 즉 이 경로를 타면 게이트가
    **사실상 무조건 통과**로 붕괴한다.

    이는 7R이 고친 `_porcelain_path`의 선행-공백 결함과 정확히 같은 근본 원인(`_run_git`이
    git의 quoting/이스케이프 규약을 인지하지 못함)이지만, 결과가 다르다: 7R 결함은 "방금 편집한
    파일 하나가 dirty-set에서 누락"되는 국소적 skew였고, 이 결함은 committed-diff 경로에서
    **`newest_code` 자체를 0으로 붕괴시켜 Gate 1을 통째로 무력화**한다 — 같은 클래스 안에서 더
    강한 fail-open이다.
  - **실측된 도달 가능성**: 현재 `codebase/**`에 추적되는 비-ASCII 파일명은 0개다
    (`git ls-files codebase | grep -P '[^\x00-\x7F]'` → 0건, 직접 확인). 즉 지금 이 순간
    이 저장소의 어떤 실제 PR도 이 경로를 타지 않는다 — 항목 12가 "미측정"이라 부른 그
    도달가능성 질문에는 답이 나왔다(부재). 다만 메커니즘 자체는 크래프트되지 않은 입력(한글
    파일명 하나)만으로 직접 재현되며, 이 프로젝트는 한국어 저장소라 향후 i18n 픽스처·현지화
    자산 등에서 비-ASCII 파일명이 `codebase/**` 아래 등장할 개연성이 0이라고 보기 어렵다.
    또한 트레일링 스페이스가 있는 파일명(`"a .ts"`)도 같은 C-quoting을 유발함을 확인했다 —
    비-ASCII만의 문제가 아니라 "unusual" 문자 전반의 문제다.
  - 제안: 항목 12의 후보 처방 (a)를 근본 원인의 단일 관문인 `_run_git`(review_guard.py:206)
    자체에 적용 — `subprocess.run(["git", "-c", "core.quotepath=false"] + args, ...)`로
    바꾸면 `_porcelain_path`뿐 아니라 `_committed_code_changes`/`_newest_commit_time`의
    같은 결함도 한 번에 닫힌다(현재 항목 12는 `_porcelain_path` 국소 수정만 검토했는데, 근본
    원인이 `_run_git` 하나이므로 관문에서 고치는 편이 두 경로를 따로 고치는 것보다 적고
    안전하다). 회귀 테스트는 `test_review_guard_hardening.py`의
    `UnstagedModificationKeepsItsPathTest`와 같은 패턴으로, 비-ASCII(또는 트레일링 스페이스)
    파일명을 `codebase/**` 아래 커밋하는 실제 임시 저장소를 만들어
    `_committed_code_changes`/`_newest_commit_time`이 실제 경로·실제 타임스탬프를 돌려주는지
    고정해야 한다. plan 문서 항목 12도 이 확장된 영향 범위(“commit 경로에서 newest_code가
    0으로 붕괴”)로 갱신 필요.

- **[INFO]** round 7의 실제 수정(`_run_git`: `.strip()` → `.rstrip()`, review_guard.py:227)은
  다른 호출부에 회귀를 일으키지 않는다 — 검증됨.
  - 위치: `.claude/hooks/_lib/review_guard.py:206`-`229`
  - 상세: `_run_git`의 반환값을 쓰는 모든 호출부(`_repo_root`:233, `_merge_base`:259,
    `_committed_code_changes`:266, `_newest_commit_time`:347)를 추적했다. 유일하게
    `_committed_code_changes`가 `out.splitlines()`를 개별 strip 없이 그대로 반환하지만,
    `git diff --name-only`는 애초에 선행 공백을 내지 않으므로 이 변경으로 인한 새 회귀는 없다.
    트레일링 스페이스가 있는 파일명(`"a .ts"`)도 git이 quote를 씌워 그 공백을 따옴표 안에
    가두므로(`" M \"codebase/.../a .ts\""`), `.rstrip()`이 의미 있는 트레일링 공백을 깎아내는
    사례도 실측상 없었다 — 이 fix 자체는 안전하다. (위 WARNING은 이 fix가 놓친 별개의,
    더 넓은 결함이다.)
  - 제안: 없음 — 확인용 기록.

## 요약

이번 라운드의 diff(`_run_git`의 `.strip()`→`.rstrip()` 및 그에 딸린 회귀 테스트, 워크플로
등재 테스트 확장) 자체는 side-effect 관점에서 깨끗하다 — 새 전역 상태, 새 파일시스템 쓰기,
시그니처/인터페이스 변경, 의도치 않은 env 읽기·쓰기, 네트워크 호출은 없고, 신규 테스트는 전부
자기 소유 `tempfile.mkdtemp()` 안에서 격리되어 실제 저장소를 건드리지 않는다(직접 추적 확인).
다만 round 7이 고친 결함과 **같은 근본 원인**(`_run_git`이 git의 quoting 규약을 모른다)이
`_committed_code_changes`/`_newest_commit_time` 경로에도 남아 있고, 이번에 직접 재현해 그
영향이 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 12가 서술한 것보다
심각함을 확인했다 — commit된 비-ASCII(또는 unusual-문자) 파일명만 있는 변경셋에서
`newest_code`가 0.0으로 붕괴해 저장소에 존재하는 아무 resolved 리뷰로나 Gate 1이 통과된다.
현재 `codebase/**`에는 그런 파일이 0개라 즉시 트리거되지는 않지만(실측 확인), 메커니즘은
크래프트되지 않은 입력으로 직접 재현되었고 근본 원인 관문(`_run_git`)이 하나이므로 항목 12와
합쳐 `core.quotepath=false`로 한 번에 닫는 편이 싸다.

## 위험도

WARNING
