# 성능(Performance) 리뷰 결과

대상: `.claude/hooks/_lib/mermaid_lint_ready.py`, `.claude/hooks/lint_mermaid_posttooluse.py`,
`.claude/tools/bootstrap-session.sh`, `.githooks/pre-commit`,
`.claude/tests/test_bootstrap_mermaid_install.py`, `.claude/tests/test_mermaid_lint_ready.py`

## 발견사항

- **[INFO]** SessionStart GC 섹션에 스로틀이 없어 매 세션마다 전체 디렉터리 스캔이 반복된다
  - 위치: `.claude/tools/bootstrap-session.sh` 382-391행 (`find "$state_dir" -type f -mtime +30 -delete`)
  - 상세: 같은 파일의 다른 두 부수효과 — mermaid 설치(`_install_throttled`, 실패 쿨다운 `MERMAID_INSTALL_RETRY_SEC`)와 워커트리 reaper(`REAP_MIN_INTERVAL`, "self-throttled to once per few hours"라고 주석에 명시) — 는 모두 명시적으로 반복실행을 스로틀한다. 그런데 3번 섹션(state marker GC)은 스로틀 없이 **매 SessionStart마다 무조건** `find`로 두 상태 디렉터리 전체를 스캔한다. 이 저장소는 "여러 worktree 세션을 동시에 띄우는 것이 공식 워크플로"(파일 자체 주석)이므로, 병렬 세션이 많을 때 방금 전 다른 세션이 이미 정리한 동일 디렉터리를 반복해서 재스캔하는 중복 작업이 발생할 수 있다.
  - 제안: 현재는 디렉터리가 "30일치 세션/브랜치당 1파일"로 자연히 크기가 제한되므로 `find`의 실측 비용은 낮을 것으로 판단된다(실질적 지연 유발 근거는 없음). 다만 파일 스타일 일관성 차원에서, 같은 파일의 다른 두 메커니즘처럼 마지막 실행 시각 마커를 두고 스로틀을 추가하면 병렬 세션 다수 상황에서의 중복 스캔을 줄일 수 있다. 오늘 시점에는 조치 불필요 — 상태 디렉터리 파일 수가 크게 늘어날 경우에만 재검토 권장.

- **[INFO]** 마크다운 편집마다 `git rev-parse --git-common-dir` 서브프로세스가 캐싱 없이 매번 재실행된다
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py` 155-178행 (`_resolve_tool_dir`, 특히 168-171행의 `subprocess.run(["git", ...])`)
  - 상세: PostToolUse 훅은 매 호출이 독립 프로세스이므로 인메모리 캐시가 애초에 불가능하고, 이 값(git common-dir → main checkout 경로)은 세션 내내 불변이다. 현재는 "확장자가 마크다운이고 파일에 mermaid fence가 존재"할 때만 이 경로에 도달하도록 이미 단계적으로 게이팅되어 있어(112-116행 주석에 설계 의도 명시) 실제 호출 빈도는 낮다.
  - 제안: 이 저장소는 spec/plan/review 워크플로 특성상 마크다운 편집 자체는 잦지만, mermaid fence가 있는 파일 편집만 이 서브프로세스를 트리거하므로 대부분의 세션에서는 드물게만 실행될 것으로 보인다. 세션 범위의 상태 파일이나 환경변수(`MERMAID_LINT_TOOL_DIR`처럼)로 해석된 `tool_dir`을 캐싱하는 최적화가 가능하나, 현재 게이팅 설계를 고려하면 우선순위는 낮다 — mermaid 다이어그램을 반복 수정하는 세션에서 편집당 지연이 체감될 때만 검토 권장.

- **[INFO]** pre-commit 이 2회의 파일 존재 확인만을 위해 매 커밋마다 python 인터프리터를 새로 구동한다
  - 위치: `.githooks/pre-commit` 481-485행 (`python3 "$mermaid_ready" "$mermaid_tool_dir"`), 대응 로직은 `.claude/hooks/_lib/mermaid_lint_ready.py` 67-72행의 `is_ready()`
  - 상세: `is_ready()`의 실제 작업은 `os.path.isdir` + `os.path.isfile` 두 스탯 콜뿐이지만, bash와 python 양쪽이 동일한 규칙을 공유해야 한다는 설계 의도(cross-language SoT, 파일 상단 docstring에 명시) 때문에 pre-commit에서는 매 커밋마다 python 인터프리터 기동 비용(대략 수십 ms)을 지불한다.
  - 제안: 이는 정확성/일관성(단일 진실 소스 유지)을 위한 의도된 트레이드오프로 보이며, 커밋 1회당 발생하는 git의 다른 작업들(오브젝트 쓰기 등)에 비해 무시할 수 있는 수준이다. 조치 불필요, 참고용 기록.

- **[INFO]** 마크다운 파일 전체를 메모리에 적재한 뒤 정규식으로 스캔
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py` 189-195행 (`content = fh.read()` → `FENCE_RE.search(content)`)
  - 상세: 대상 파일이 마크다운 확장자로 판별된 모든 Write/Edit/MultiEdit/NotebookEdit 호출에서 파일 전체를 읽어 정규식 검사한다. `FENCE_RE` 자체는 중첩 quantifier가 없는 단순 패턴(``^[ \t]*(`{3,}|~{3,})[ \t]*mermaid\b``)이라 catastrophic backtracking(ReDoS) 위험은 없고 O(n) 스캔이다. 이 저장소의 실제 마크다운 파일(spec/plan/review 문서)은 대체로 KB 단위라 문제되지 않는다.
  - 제안: 조치 불필요. 다만 향후 매우 큰(수 MB) 생성 마크다운 파일(예: 대용량 changelog, vendored 문서)을 Claude Code로 자주 편집하게 될 경우에만 스트리밍/청크 검사로 전환 검토.

- **[INFO]** mermaid 파서(node) 콜드 스타트가 편집마다 반복된다
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py` 210-215행 (`subprocess.run(["node", script, ...], timeout=_NODE_TIMEOUT)`)
  - 상세: mermaid fence가 있는 마크다운을 편집할 때마다 node 프로세스를 새로 구동하고 무거운 mermaid 라이브러리를 매번 새로 import한다. 다이어그램 문법 오류를 반복 수정하는 상호작용 루프(편집→exit 2→편집→...)에서는 이 콜드 스타트 비용이 반복 지불된다. 전체 hot path에서 가장 비용이 큰 단일 단계로 추정된다.
  - 제안: 이는 실제 파서로 정확성을 보장하기 위한 본질적 비용이며 현재 설계(확장자→fence 존재→node 호출의 단계적 게이팅, 112-116행 주석)는 이미 불필요한 호출을 최대한 걸러내고 있다. 지금 조치가 필요한 결함은 아니며, 향후 지연이 실제로 체감되는 경우에만 세션 내 상주 데몬(node 프로세스를 warm 상태로 유지하고 파일 경로만 IPC로 전달) 같은 구조적 최적화를 고려할 수 있다는 점만 기록.

## 요약

이번 변경은 백엔드 서비스가 아니라 세션 부트스트랩/git 훅 툴링이므로, 전통적인 "DB N+1" 류 문제는 해당하지 않는다. 대신 서브프로세스 스폰(git/node/python) 과 파일시스템 스캔의 반복 빈도가 성능 관점의 핵심이다. 코드는 이미 이 축에서 신중하게 설계되어 있다 — PostToolUse 훅은 확장자 확인(비-마크다운은 즉시 반환) → mermaid fence 존재 확인(정규식) → 실제 node 파서 호출 순으로 단계적 게이팅을 적용해 무거운 경로를 최대한 늦게 타도록 하고(지연 로딩 원칙 준수), pre-commit은 여러 스테이지된 마크다운 파일을 한 번의 node 호출로 배치 처리해 파일당 N회 호출(N+1 패턴)을 피했으며, bootstrap-session.sh는 마커·락 기반으로 반복 세션에서 불필요한 npm install을 건너뛰도록 멱등적으로 설계되었다. 발견된 항목은 모두 INFO 수준으로, 반복되는 소규모 서브프로세스 스폰과 GC 섹션의 스로틀 부재 등 향후 사용량이 크게 늘었을 때만 재검토할 만한 최적화 여지에 해당하며, 현재 규모(문서 편집·개인/소규모 팀 세션 빈도)에서 실질적 병목이 될 근거는 없다. 즉시 조치가 필요한 CRITICAL/WARNING 항목은 없다.

## 위험도
LOW
