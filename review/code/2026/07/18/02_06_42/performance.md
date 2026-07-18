# 성능(Performance) 리뷰 결과

대상: `.claude/tools/bootstrap-session.sh`, `.claude/hooks/lint_mermaid_posttooluse.py`,
`.claude/hooks/_lib/mermaid_lint_ready.py`, `.githooks/pre-commit`,
`.github/workflows/harness-checks.yml`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.claude/tests/test_mermaid_lint_ready.py`

이번 변경분(7개 파일)은 현재 HEAD(`7459ec16a`) 대비 diff 가 없다 — 직전 리뷰 라운드
(`review/code/2026/07/18/00_59_56`)에서 검토된 것과 동일한 코드다. 아래는 그 결과를
그대로 옮긴 것이 아니라 실제 파일 라인 기준으로 독립적으로 재검증한 것이다(직전
리뷰의 일부 위치 표기는 실제 파일 라인 수와 맞지 않았다 — 예: bootstrap-session.sh
는 총 189줄인데 "382-391행"을 인용 — 그래서 이 보고서는 `Read` 로 직접 확인한 라인
번호만 사용한다).

## 발견사항

- **[INFO]** SessionStart GC 섹션은 스로틀 없이 매 세션마다 무조건 전체 스캔
  - 위치: `.claude/tools/bootstrap-session.sh:159-165` (`for state_dir in ...; do find "$state_dir" -type f -mtime +30 -delete; done`)
  - 상세: 같은 파일의 다른 두 부수효과 — mermaid 설치(`_install_throttled` + `MERMAID_INSTALL_RETRY_SEC` 쿨다운)와 워크트리 reaper(주석상 "self-throttled to once per few hours")는 모두 반복실행을 명시적으로 스로틀한다. 반면 3번 섹션(상태 마커 GC)은 스로틀 마커 없이 매 SessionStart마다 두 상태 디렉터리에 대해 무조건 `find`를 실행한다. 이 저장소는 "여러 worktree 세션 동시 실행이 공식 워크플로"(파일 자체 주석, 36행)이므로 병렬 세션이 많을 때 방금 다른 세션이 이미 정리한 디렉터리를 중복 재스캔할 수 있다.
  - 제안: 대상 디렉터리가 "30일치 세션/브랜치당 1파일"로 자연히 크기가 제한되어 있어(주석 156-158행) 실측 비용은 낮을 것으로 판단된다. 즉시 조치는 불필요하나, 상태 디렉터리 파일 수가 크게 늘어나는 경우에만 같은 파일의 다른 두 메커니즘처럼 "마지막 실행 시각" 마커 기반 스로틀 추가를 재검토할 만하다.

- **[INFO]** PostToolUse 훅에서 `git rev-parse` 서브프로세스가 호출마다 캐싱 없이 재실행
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:73-96`(`_resolve_tool_dir`, 특히 86-89행의 `subprocess.run(["git", ...])`), 호출부는 115행
  - 상세: PostToolUse 훅은 매 호출이 독립 프로세스라 인메모리 캐시가 애초에 불가능하고, 이 값(git common-dir → main checkout 경로)은 세션 내내 불변이다. 다만 이 경로는 "확장자가 마크다운이고(102행) 파일에 mermaid fence가 존재할 때(112행)"만 도달하도록 이미 단계적으로 게이팅되어 있어(파일 헤더 16-21행에 설계 의도 명시) 실제 호출 빈도는 낮다.
  - 제안: 조치 불필요. mermaid 다이어그램을 반복 수정하는 세션에서 편집당 지연이 실제로 체감될 때만 `MERMAID_LINT_TOOL_DIR` 류 세션 범위 캐싱을 검토.

- **[INFO]** pre-commit 이 커밋마다 python3 인터프리터를 두 번 새로 구동
  - 위치: `.githooks/pre-commit:34`(`python3 "$guard"`, branch_guard), `:58`(`python3 "$mermaid_ready" ...`, is_ready)
  - 상세: 특히 `is_ready()`(`mermaid_lint_ready.py:41-45`)의 실제 작업은 `os.path.isdir`+`os.path.isfile` 두 stat 콜뿐이지만, bash/python 양쪽이 동일 판정을 공유해야 한다는 cross-language SoT 설계(파일 docstring)로 인해 매 커밋마다 python 인터프리터 기동 비용(수십 ms 대)을 지불한다.
  - 제안: 정확성(단일 진실 소스 유지)을 위한 의도된 트레이드오프이며, 커밋 1회당 git 자체가 수행하는 다른 작업에 비해 무시할 수준. 조치 불필요.

- **[INFO]** 마크다운 파일 전체를 메모리에 적재 후 정규식 스캔
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:108-112`(`content = fh.read()` → `FENCE_RE.search(content)`)
  - 상세: 마크다운 확장자로 판별된 모든 Write/Edit/MultiEdit/NotebookEdit 호출에서 파일 전체를 읽어 정규식 검사한다. `FENCE_RE`(54행, ``^[ \t]*(`{3,}|~{3,})[ \t]*mermaid\b``)는 중첩 quantifier·모호한 대체(alternation) 없이 단순 선형 스캔이라 catastrophic backtracking(ReDoS) 위험은 없다. 이 저장소의 실제 마크다운(spec/plan/review)은 대체로 KB 단위라 문제되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** mermaid 파서(node) 콜드 스타트가 fence 있는 파일 편집마다 반복
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:130-133`(`subprocess.run(["node", script, ...], timeout=_NODE_TIMEOUT)`)
  - 상세: 다이어그램 문법 오류를 반복 수정하는 상호작용 루프(편집→exit 2→편집→...)에서는 node 프로세스 기동 + mermaid 라이브러리 import 비용이 매번 반복 지불된다. 전체 경로에서 가장 비용이 큰 단일 단계로 추정되나, 확장자→fence 존재→node 호출의 단계적 게이팅(16-21행)이 이미 불필요한 호출을 최대한 걸러낸다.
  - 제안: 지금 조치가 필요한 결함은 아니다. 지연이 실제로 체감되는 경우에만 세션 내 상주 node 데몬 같은 구조적 최적화를 고려.

- **[INFO]** harness-checks.yml 이 두 런타임(python/node) 셋업과 테스트를 한 job 안에서 순차 실행
  - 위치: `.github/workflows/harness-checks.yml:41-64`(단일 `unittest` job 안에 `setup-python`→python 유닛테스트→`setup-node`→node 테스트가 순차 배치)
  - 상세: 두 언어 테스트를 별도 job(병렬 matrix)으로 분리하면 총 wall-clock 시간을 줄일 수 있지만, "harness unit tests, stdlib-only, no install step"(파일 헤더 1-3행) 특성상 각 단계가 원래도 짧고, `timeout-minutes: 5` 상한 안에서 실질 병목 근거는 없다. `concurrency.cancel-in-progress`(37-38행)로 동일 ref 의 중복 실행은 이미 회피되고 있다.
  - 제안: 조치 불필요. CI 총 실행 시간이 실측으로 체감될 만큼 늘어날 경우에만 job 분리 검토(단, 분리 시 `actions/checkout`+런타임 셋업 오버헤드가 job당 중복되므로 실익은 크지 않을 수 있음).

## 요약

이번 검토 대상은 백엔드/프런트엔드 서비스 코드가 아니라 세션 부트스트랩·git 훅·CI 워크플로 등 하네스 툴링이므로 전통적인 "DB N+1"·"불필요한 객체 할당" 류 문제는 해당 사항이 없다. 대신 서브프로세스 스폰(git/node/python) 빈도와 파일시스템 스캔 반복이 성능 관점의 핵심 축인데, 코드는 이미 이 축에서 신중하게 설계되어 있다 — PostToolUse 훅은 확장자 확인 → mermaid fence 정규식 확인 → 실제 node 파서 호출 순으로 단계적으로 게이팅해 무거운 경로를 지연 로딩하고, pre-commit 은 스테이징된 마크다운 파일 여러 개를 한 번의 node 호출로 배치 처리해 파일당 N회 호출을 피했으며, bootstrap-session.sh 는 완료 마커·owner-aware mkdir 락·실패 쿨다운으로 반복 세션에서 불필요한 npm install 을 건너뛰도록 멱등적으로 설계되어 있다(steady state 에서는 `[ ! -f "$marker" ]` 검사 실패로 락/스로틀 로직 자체가 실행되지 않는다). 발견된 항목은 모두 INFO 수준으로, 반복되는 소규모 서브프로세스 스폰과 GC 섹션의 스로틀 부재 등 사용량이 크게 늘었을 때만 재검토할 만한 여지이며, 현재 규모(문서 편집·개인/소규모 팀 세션 빈도, CI 5분 타임아웃 내 stdlib-only 테스트)에서 실질적 병목이 될 근거는 없다. 즉시 조치가 필요한 CRITICAL/WARNING 항목은 없다.

## 위험도
LOW
