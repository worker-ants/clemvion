# 요구사항(Requirement) 리뷰 — CI 백스톱 (round 8)

## 방법론

`review_guard.py`·`test_block_integrity.py`·`.claude/tests/README.md`·
`test_review_gate_ci.py`(꼬리 793~823행)는 프롬프트 예산으로 생략돼 있어 전부
`Read` 로 직접 열어 확인했다. 리뷰 대상 11개 파일 전부를 라인 단위로 대조했고,
관련 하네스 테스트 5개 파일(139건)을 직접 실행해 GREEN 을 확인했으며, 핵심
주장(비-ASCII 경로 quoting)은 `mktemp -d` 스크래치 저장소에서 실제 `git`
동작으로 재현했다(작업 트리는 건드리지 않음). round 8 시점 `git status`/`git
diff` 로 실제 변경분(코드 변경 없음, `plan/in-progress/harness-review-gate-ci-backstop.md`
에 §12 항목 추가뿐)을 확인해, 이번 리뷰의 실질 대상은 "지금까지 누적된 CI
백스톱 전체(7R 종료 시점 상태)"임을 확인하고 그 기준으로 점검했다.

## 발견사항

- **[WARNING]** `_porcelain_path`/`_committed_code_changes` 가 git 의
  `core.quotePath`(기본값 true) C-quoting 을 처리하지 못한다 — round 7 이 고친
  결함과 **동일 클래스**이며, 이미 `plan/in-progress/harness-review-gate-ci-backstop.md`
  §12(2026-08-06 신규, "미측정"으로 명시 deferred)에 기록돼 있으나 아직 코드
  수정은 없다.
  - 위치: `.claude/hooks/_lib/review_guard.py:281`(`_porcelain_path`),
    `.claude/hooks/_lib/review_guard.py:265`(`_committed_code_changes`),
    `.claude/hooks/_lib/review_guard.py:319`(`_newest_commit_time`) /
    plan 상 위치는 `plan/in-progress/harness-review-gate-ci-backstop.md:164`.
  - 상세: 재현 확인(스크래치 repo, 작업 트리 무변경):
    ```
    $ git status --porcelain   # 비-ASCII untracked 디렉터리
    ?? "codebase/\355\225\234\352\270\200/"
    $ git diff --name-only main..HEAD -- codebase/   # 비-ASCII 커밋된 변경
    "codebase/\355\225\234\352\270\200/\355\214\214\354\235\274.ts"
    $ git -c core.quotePath=false status --porcelain
    ?? codebase/한글/
    ```
    두 경우 모두 `_porcelain_path`(고정폭 파싱, `ln[3:].strip()`)와
    `_committed_code_changes`(raw `splitlines()`)는 따옴표+8진 이스케이프
    문자열을 그대로(디코딩 없이) "경로"로 취급한다. plan §12 는 영향을
    `_dirty_set`/uncommitted 경로로만 서술하지만, `git diff --name-only` 도
    같은 quoting 을 적용하므로 **커밋된 비-ASCII 파일의 신선도 계산도 깨진다**:
    `_newest_commit_time` 이 그 garbled 문자열을 pathspec 으로
    `git log --format=%at HEAD -- <garbled>` 에 넘기면 아무 커밋도 매칭되지
    않아 `0.0`(1970-01-01)을 반환한다 — 방금 커밋된 파일이 "이미 오래전에
    커버된 것"처럼 보이는 fail-open 방향이다(round 7 결함과 동일 방향).
    실측: 현재 이 저장소의 `codebase/**` 에는 비-ASCII 파일명이 0개
    (`find codebase -type f | grep -P '[^\x00-\x7F]'` → 0건), `core.quotePath`
    저장소 오버라이드도 없음 — 즉 **현재는 도달 불가**(plan 의 "미측정"
    판단과 일치), 향후 한글 파일명이 `codebase/**` 에 들어오는 순간 재현된다.
  - 제안: plan §12 는 이미 존재하고 "측정 전 미수정" 방침이 명시돼 있으므로
    코드를 지금 고치라는 뜻은 아니다. 다만 그 항목의 "영향 방향" 서술이
    `_dirty_set`/uncommitted 경로로 좁게 적혀 있는데, 커밋된 파일 경로
    (`_committed_code_changes`/`_newest_commit_time`)도 같은 근본 원인으로
    영향받는다는 점을 §12 본문에 추가해 범위를 정확히 넓혀 둘 것을 권장한다.
    후보 처방은 plan 이 이미 (a) `core.quotePath=false`, (b) `-z` 포팟 두
    옵션과 트레이드오프까지 적어 뒀다.

- **[INFO]** `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "신규
  후속 (defer)" 헤더가 산문 개수를 인용하는데 이번 라운드의 §12 삽입으로
  실제 항목 수와 어긋난다 — 이 저장소가 다른 곳(`.claude/tests/README.md`:
  "a count in prose goes stale the next time one is added")에서 명시적으로
  경계하는 바로 그 패턴이 여기서 재현됐다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:60`
    (`> **신규 후속 (defer) — 아래 11건 + 기본 브랜치 해석 중복 1건**`).
  - 상세: 번호 매겨진 항목을 세면 1, 2(취소선 처리돼 회피됨), 3~13 —
    13개(§12 신설로 12→13 한 칸씩 밀림)이고 별도로 "origin 기본 브랜치 해석"
    중복 서술이 뒤따른다. "11건" 은 §12 삽입 이전 상태를 가리키는 stale
    카운트다. 기능에는 영향 없음(순수 산문).
  - 제안: "아래 N건" 을 세지 않는 서술로 바꾸거나(이 저장소가 README.md 에서
    이미 채택한 관행 — "Deliberately not 'two files' or 'three'"), 갱신 시
    번호를 다시 셀 것.

- **[INFO]** spec fidelity — 이 변경 영역(`review-gate.yml` /
  `check-review-gate.py` / `review_guard.py` 의 CI 백스톱)을 정의하는 `spec/`
  문서는 존재하지 않는다(`grep -rl "review-gate\|review_guard\|check-review-gate.py" spec/`
  → 0건). 예상된 결과다 — `.claude/` 하네스/CI 배선은 제품 spec 대상이 아니라
  `plan/in-progress/harness-review-gate-ci-backstop.md`(정책·결정)와
  `.claude/tests/README.md`(테스트 카탈로그)가 사실상의 단일 진실이다. 그
  두 문서를 구현과 대조한 결과 위 §12 count 외에는 line-level 불일치를
  찾지 못했다 — `.claude/tests/README.md`의 `test_review_gate_ci.py` 행이
  서술하는 4개 성질(단일 판정자/관측 기본/fail-open/advisory 판정 무관)이
  실제 `WorkflowWiringTest`·`OneJudgeTest`·`VerdictComesFromTheGateTest`·
  `ReviewGateCliTest`·`TheGateItselfDoesNotBranchOnCiEnvTest`·
  `TheRealGateIgnoresTheEnvironmentTest`·`ReviewArtifactsStayTrackedTest`·
  `PyYamlPinsAgreeTest` 와 정확히 대응한다. `.claude/tests/README.md` 의
  `test_review_gate_ci.py` 행이 `TheGateItselfDoesNotBranchOnCiEnvTest` /
  `TheRealGateIgnoresTheEnvironmentTest` 두 클래스(6R/7R 신설, 실물 게이트를
  두 환경에서 판정시켜 비교)를 이름으로 언급하지 않는 것은 확인했으나,
  `test_tests_readme_catalog.py`가 요구하는 단위는 파일당 1행이지 클래스당
  1행이 아니므로(README 자체가 "구조/행위"만 pin, 이 표는 파일 수준 카탈로그)
  이는 결함이 아니라 상세도 차이로 판단해 별도 항목화하지 않았다.

## 실행 확인 (증거)

```
$ python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py'         → 19 tests OK
$ python3 -m unittest discover -s .claude/tests -p 'test_review_guard_hardening.py' → 52 tests OK
$ python3 -m unittest discover -s .claude/tests -p 'test_stop_guard_failopen.py'    → 17 tests OK
$ python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py'→ 12 tests OK
$ python3 -m unittest discover -s .claude/tests -p 'test_block_integrity.py'        → 39 tests OK
```

`review-gate.yml` 전체를 `WorkflowWiringTest.EXPECTED` 와 필드 단위로 직접
대조(파일↔테스트 literal)해 완전 일치를 확인했다(name/trigger paths/
concurrency/permissions/job if/step 4개 순서·내용 전부). `check-review-gate.py`
의 모든 호출·import 를 `OneJudgeTest._ALLOWED_IMPORTS`/`_ALLOWED_CALLS` 와
줄 단위로 대조해 허용 목록을 벗어나는 호출이 없음을 확인했다. `review_guard.py`
와 `branch_guard.py`/`plan_guard.py` 의 `os.environ`/`getenv` 접근을 직접
grep 해 `CLAUDE_PROJECT_DIR`(등재됨, `evaluate_review()` 판정 경로 밖 —
`_resolution_marker_dir`는 `_resolution_in_flight`에서만 쓰이고 그 함수는
Stop 훅 전용이라 CI 백스톱 판정에 관여하지 않음) 외 미등재 접근이 없음을
확인했다.

## 우회 시도 (round 8 job 2)

"모든 테스트를 GREEN 으로 유지한 채 실제 PR 판정을 뒤집는 경로"를 찾으려
했으나 발견하지 못했다. 시도한 축과 막힌 이유:

- 정적 스캔 우회(새 import/getattr/속성 재바인딩/환경변수 비-Call 접근) —
  `OneJudgeTest`/`TheGateItselfDoesNotBranchOnCiEnvTest` 의 등재제가 막음.
- `_shared/**` 위임 대상에 숨긴 env 분기 — 정적 스캔이 아니라
  `TheRealGateIgnoresTheEnvironmentTest`(실물 게이트를 bare 환경과 14개
  변수짜리 CI 환경에서 두 번 판정시켜 동일해야 함)가 문법 무관하게 막음.
  실제로 `_shared/report_paths.py`·`block_integrity.py`·`retry_state.py`
  전체를 grep 했고 `os.environ`/`getenv` 접근이 전혀 없음을 재확인했다.
- 워크플로 문서 필드 열기(`continue-on-error`/`if`/트리거 키/식별자 참칭) —
  `WorkflowWiringTest`(문서 전체 정확 일치) + `test_workflow_yaml_structure.py`
  (모든 워크플로에 등재제)가 이중으로 막음.
- 위 §WARNING(비-ASCII quoting)은 판정을 "뒤집을 수 있는" 방향(review 없이
  통과)이 아니라 반대 방향(이미 커버된 것처럼 보여 재검토를 안 요구) — 이는
  round 7 결함과 같은 fail-open 방향이며, 공격자가 노려서 얻는 이득이
  아니라 정상 흐름에서 자연 발생하는 결함이다. 현재 도달 불가(코드베이스에
  비-ASCII 경로 0건)이므로 "실제 PR 판정을 지금 뒤집는 경로"로 실증하지는
  못했다.

## 요약

이번 라운드는 코드 변경이 없고(작업 트리는 `plan/in-progress/harness-review-gate-ci-backstop.md`
편집 1건뿐), 7R 종료 시점의 CI 백스톱 전체를 재검토했다. 4개 배선 가드
(워크플로 문서 정확 일치·호출/import 등재제·환경변수 등재제+행위 이중판정·
`review/**` 추적 전제)와 판정 로직(코드 리뷰 신선도·spec-impl 일관성 게이트·
in-flight 억제·하향 감지 advisory)이 서로 문서-테스트-구현 삼중으로 일치하고
139개 관련 하네스 테스트가 모두 GREEN 이며, 워크플로 파일이 기대 리터럴과
byte-level 로 일치함을 직접 대조로 확인했다. 새 CRITICAL 은 없다. WARNING 은
이미 plan 에 §12 로 추적 중인 비-ASCII 경로 quoting 결함 하나뿐이며(현재
도달 불가로 측정됨, 의도적으로 defer 됨 — 다만 영향 범위가 plan 서술보다
넓다는 점을 추가로 확인해 보고), INFO 는 plan 의 stale 산문 카운트 하나와
spec 부재(예상된 정상 상태) 뿐이다. TODO/FIXME 류 미완성 마커는 없다.

## 위험도

LOW
