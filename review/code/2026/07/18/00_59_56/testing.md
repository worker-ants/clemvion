# 테스트(Testing) 리뷰 — mermaid-lint 설치 가드 자기리뷰 보강 (락 liveness·throttle·공유 판정 SoT)

검증 방법: 정적 리뷰에 그치지 않고 실제로 실행해 확인했다 — (1) `.claude/tests/test_bootstrap_mermaid_install.py`(14건)·`test_mermaid_lint_ready.py`(8건) 개별 실행, (2) CI 와 동일한 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 하네스 전체 304건 재실행(회귀 없음), (3) `.githooks/pre-commit` 을 임시 git repo 에서 실제로 구동해 "node_modules 자체 없음"·"node_modules 있으나 완료 마커 없음(partial install)" 두 상태 모두에서 malformed mermaid 블록이 스테이징돼 있어도 fail-open 으로 커밋이 허용됨을 재현, (4) `lint_mermaid_posttooluse.py` 를 `MERMAID_LINT_TOOL_DIR` 오버라이드로 서브프로세스 구동해 partial-install 상태에서 "skipped" 메시지 + exit 0 을 재현, (5) 두 소비처의 "텍스트 포함" 단언이 불리언 반전 뮤턴트에서도 통과함을 직접 재현, (6) `.github/workflows/*.yml` 8개 전수 확인.

## 발견사항

- **[WARNING]** 소비처(PostToolUse·pre-commit) 배선 변경이 실행 기반 회귀 테스트 없이 "소스 텍스트 포함" 검사로만 보호된다 — mutation-blind 를 직접 재현
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:103-104`(`if not is_ready(tool_dir):`), `.githooks/pre-commit:58`(`if [ -f "$mermaid_ready" ] && python3 "$mermaid_ready" "$mermaid_tool_dir" \`) — 대응 테스트는 `.claude/tests/test_mermaid_lint_ready.py:92-96`(`test_posttooluse_imports_is_ready`)와 `:86-90`(`test_precommit_reads_via_the_shared_helper`).
  - 상세: 이번 diff 의 핵심(바레 `[ -d node_modules ]` → 마커 기반 `is_ready()`)이 두 소비처에서 실제로 올바르게 동작하는지는 어디에서도 "실행"으로 검증되지 않는다. 두 테스트는 소스에 특정 부분 문자열이 있는지만 확인한다. 직접 재현: `if not is_ready(tool_dir):` 를 `if is_ready(tool_dir):`(불리언 반전 — fail-open/fail-closed 완전 전도)로 바꾼 뮤턴트에 대해 `test_posttooluse_imports_is_ready` 의 두 `assertIn` 을 그대로 재현했더니 **둘 다 통과**했다. `.githooks/pre-commit` 쪽도 동일 — 호출부 앞에 `!` 하나만 넣은 반전 뮤턴트에서도 `"mermaid_lint_ready.py" in src` 단언이 그대로 통과함을 확인했다. 역으로 **현재 실제 코드는 올바르다**는 것도 직접 실행으로 확인했다 — 임시 git repo 로 `.githooks/pre-commit` 을 구동해 (a) `node_modules` 자체가 없는 경우, (b) `node_modules` 는 있으나 완료 마커가 없는 partial-install(이 PR 이 고치는 정확한 버그 클래스) 모두에서, malformed mermaid 블록이 스테이징돼 있어도 커밋이 fail-open 으로 정상 허용됨을 재현했다. 즉 **지금은 맞지만, 그 정확성을 지키는 회귀 테스트가 없다** — 두 줄 중 하나가 향후 실수로 반전되어도 하네스 스위트는 침묵한다.
  - 제안: `lint_mermaid_posttooluse.main()` 을 `MERMAID_LINT_TOOL_DIR` 오버라이드(이미 해당 함수 docstring 에 "testing / unusual layouts" 용도로 문서화돼 있어 추가 리팩터 없이 바로 쓸 수 있다)로 구동하는 서브프로세스 테스트 1~2건(ready/미ready 각각 실제 stdout/stderr/exit code 확인), `.githooks/pre-commit` guard 2 를 임시 git repo + 스테이징된 mermaid 블록으로 실행하는 테스트 1~2건을 추가하면 텍스트 매칭을 실제 동작 검증으로 승격할 수 있다.

- **[WARNING]** `harness-checks.yml` CI 트리거 `paths:` 에 `.githooks/**` 가 없다 — 이 워크플로 자신의 주석이 경계하는 "단독 수정 시 CI 미실행" 클래스 그 자체
  - 위치: `.github/workflows/harness-checks.yml:9-30`. `.claude/agents/**`·`.claude/hooks/**`·`.claude/_shared/**`·`.claude/skills/**`·`.claude/tests/**`·`.claude/tools/**`·`.claude/workflows/**`·`scripts/report_playwright_flaky.py`·`scripts/check-e2e-playwright-config.py` 는 등재돼 있으나(각각 "단독 수정이 스위트를 안 태웠다"는 실제 사고를 겪고 등재된 것으로 주석에 기록돼 있음), `.githooks/**` 는 이 저장소의 `.github/workflows/*.yml` 8개 파일 어디에도 없다(전수 확인).
  - 상세: `harness-checks.yml:15-16`·`:21-22` 인라인 주석이 정확히 이 실패 모드를 명시한다("단독 수정이 CI 를 안 태우면 이 PR 이 없애려던 'drift 가 조용히 재발' 클래스 그 자체가 된다"). 이번 PR 은 `.claude/hooks/**` 도 함께 건드려서 이번 PR 자체의 CI 는 정상 실행됐다(직접 재확인: 304/304 통과). 하지만 **향후 `.githooks/pre-commit` 만 단독으로 수정하는 PR**(예: 브랜치 가드 우회 로직 조정, mermaid guard 인자 순서 수정)은 이 workflow 를 전혀 트리거하지 않아 `test_branch_guard.py`·`test_mermaid_lint_ready.py::ConsumerBindingTest` 가 조용히 스킵된 채 머지될 수 있다. `.githooks/pre-commit` 은 이번 리뷰 대상 6개 파일 중 하나이자 매 커밋마다 실행되는 방어선이라 이 갭의 파급력이 작지 않다.
  - 제안: `harness-checks.yml` 의 `paths:` 에 `.githooks/**` 한 줄 추가.

- **[WARNING]** `test_concurrent_sessions_install_at_most_once` 의 단언이 "5개 세션이 전원 설치를 스킵"(설치가 조용히 영구 비활성화되는, 이 PR 이 없애려는 바로 그 무신호 실패 클래스)을 놓칠 수 있다
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:177-193`, 특히 `:190` `self.assertLessEqual(self._npm_calls(), 1, "the mkdir lock must serialise the cold-start race")`.
  - 상세: 5개 동시 프로세스를 띄운 뒤 `assertLessEqual(npm_calls, 1)` 만 검사하고 완료 마커 파일 존재는 검사하지 않는다. `npm_calls()==0`(아무도 설치하지 않음)도 이 단언을 그대로 통과한다. 이 파일의 docstring 은 "The race itself"·"must serialise the cold-start race" 라며 이 테스트가 핵심 불변식을 pin 한다고 서술하지만, 실제로 pin 하는 것은 "최대 1회"뿐이고 "정확히 1회(=누군가는 반드시 설치를 완료함)"는 검증하지 않는다 — 5개 프로세스 모두가 잘못된 이유로 서로 양보하는 회귀가 생겨도 이 테스트는 조용히 통과한다.
  - 제안: `assertEqual(self._npm_calls(), 1, ...)` 로 강화하고, `assertTrue(os.path.isfile(self.marker))` 를 추가해 "정확히 한 번 설치가 완료됨"을 직접 pin.

- **[INFO]** 신규 liveness steal 로직(`_lock_is_dead` → `rm -rf` → `mkdir` 재획득)에 대해 "복수 세션이 동일한 죽은 락을 동시에 훔치려 경쟁"하는 스트레스 테스트가 없다
  - 위치: `.claude/tools/bootstrap-session.sh:96-111`(`_lock_is_dead()` 및 획득부). 기존 테스트는 `test_dead_pid_lock_is_stolen`(`test_bootstrap_mermaid_install.py:225`)·`test_stale_lock_is_stolen_so_it_cannot_wedge_forever`(`:159`) 모두 **단일 프로세스**가 죽은 락을 훔치는 경우만 다루고, 동시성 테스트 `test_concurrent_sessions_install_at_most_once`(`:177`)는 **락이 아예 없는 콜드스타트**만 다룬다 — "죽은 락 1개에 여러 세션이 동시 도달"하는 조합은 어느 테스트에도 없다.
  - 상세: `mkdir` 원자성상 `rm -rf` 이후 재획득 경쟁은 안전할 것으로 추론되고 코드 주석도 그렇게 설명하며, 이 판단 자체에 이의는 없다. 다만 이 리뷰 계보의 직전 라운드(`review/code/2026/07/17/20_06_45/testing.md`)가 바로 "추론상 안전"이라던 최초 stale-lock 탈취 로직(경과 시간만 보는 버전)을 리뷰어가 실측 재현으로 반증한 전례가 있다(당시 WARNING #1 — 살아있는 설치의 락이 탈취되던 실제 재현). 같은 코드베이스에서 반복된 패턴이므로, 기존 5-프로세스 콜드스타트 스트레스 테스트와 대칭적으로 "죽은 owner PID 락 1개 + 동시 접근 N 프로세스" 스트레스 테스트를 추가해 두면 추론이 아닌 실측으로 이 조합도 닫아둘 수 있다.
  - 제안: `test_concurrent_sessions_install_at_most_once` 패턴을 재사용해, 죽은 owner PID 를 미리 심어둔 락 위에서 5개 프로세스를 동시 실행하고 `npm_calls()==1` 을 확인하는 테스트 1건 추가.

- **[INFO]** `test_marker_without_node_modules_dir_is_not_ready` 가 이름이 주장하는 시나리오를 실제로 구성하지 않는다 — `test_no_tool_dir_is_not_ready` 와 물리적으로 동일한 상태를 재검증하는 사실상의 중복
  - 위치: `.claude/tests/test_mermaid_lint_ready.py:61-63` vs `:47-49`.
  - 상세: 주석("marker path implies node_modules/, but guard the isdir check anyway")은 "마커는 있는데 node_modules 디렉토리는 없는" 방어적 분기를 검증하려는 의도로 보이지만, 테스트 본문은 마커도 node_modules 도 전혀 만들지 않고 `is_ready(self.tool_dir)`(아무것도 생성되지 않은 임시 경로)만 호출한다 — `test_no_tool_dir_is_not_ready:49` 의 두 번째 단언과 물리적으로 완전히 동일한 상태·코드 경로다. `is_ready()` 구현이 `os.path.isdir(node_modules) and os.path.isfile(marker_path(...))` 라는 단락평가이고 marker 경로가 항상 `node_modules/` 하위로 정의돼 있어, "마커 isfile=True 이면서 node_modules isdir=False" 조합은 실제로 구성하기 어렵다(별도 mock 없이는 사실상 불가능) — 그래서 이 갭 자체의 실질 위험은 낮다. 다만 테스트 이름·주석과 본문의 불일치는 향후 유지보수자를 오도할 수 있다.
  - 제안: 중복 제거(삭제)하거나, 방어적 분기를 진짜로 pin 하고 싶다면 `os.path.isdir`/`os.path.isfile` 을 직접 mock 해 그 조합을 명시적으로 구성.

- **[INFO]** 사소한 미검증 경계값 (우선순위 낮음, 일괄 기재)
  - `is_ready("")`(빈 문자열)이 `is_ready(None)` 과 별도로 테스트되지 않는다(`mermaid_lint_ready.py:44` `if not tool_dir:` 는 두 값 모두 동일 분기라 실질 위험은 없다).
  - `_lock_is_dead()`(`bootstrap-session.sh:96`)의 owner 분기(`case ... ''|*[!0-9]*`) 중 "빈 owner"(`test_stale_lock_is_stolen_so_it_cannot_wedge_forever`)만 테스트되고, "owner 파일에 숫자가 아닌 쓰레기 텍스트"는 별도로 테스트되지 않는다 — 두 sub-case 는 동일하게 `return 0` 이라 행동 차이는 없다.
  - `MERMAID_INSTALL_LOCK_GRACE_SEC` 의 `0`·60 의 배수가 아닌 값 등 경계값이 테스트되지 않는다. 직접 `find -mmin -0` 동작을 재현해 `lock_grace=0` 이 "게이트 없음"으로 의도대로 동작함은 확인했으나, 이를 pin 하는 테스트는 없다.

## 요약

새·변경 테스트의 핵심 표면(설치 가드의 마커·mkdir 락·liveness 탈취·실패 throttle)은 품질이 높다 — 실제 git repo·실제 서브프로세스 동시성 위에서 검증하고, mocking 은 진짜 외부 경계(npm/네트워크)에만 국한하며, non-vacuity 를 이전 커밋 대조와 표적 뮤턴트 양쪽으로 능동 검증한 이력이 있다. `.claude/tests/README.md` 커버리지 표도 이번 라운드에 신규 2파일이 등재돼 직전 라운드 WARNING #4 가 해소됐음을 확인했다. 하네스 스위트 304건을 직접 재실행해 회귀가 없음도 확인했다. 다만 이번 diff 가 실제로 건드린 "소비처 배선" — `lint_mermaid_posttooluse.py` 의 게이팅 조건과 `.githooks/pre-commit` guard 2 의 게이팅 조건 — 은 공유 SoT(`is_ready()`) 자체의 훌륭한 유닛 테스트와 달리, 소스 텍스트 포함 여부만 보는 약한 단언으로만 보호된다. 불리언 반전 뮤턴트로 이를 직접 실증했고, 동시에 현재 코드가 두 fail-open 시나리오(미설치·partial-install) 모두에서 실제로 올바르게 동작함도 실행으로 확인했다 — 즉 "지금은 맞지만 지켜주는 안전망이 없는" 상태다. 여기에 `.githooks/**` 가 이 하네스 CI 워크플로의 트리거 경로 목록에서 통째로 빠져 있어(워크플로 자신의 주석이 경계하는 실패 클래스), `.githooks/pre-commit` 단독 수정 PR 이 향후 스위트를 아예 안 태울 수 있다는 구조적 갭도 확인했다. 동시성 테스트 1건의 단언 강도(있어야 할 하한 없이 상한만 검사)와 마이너한 테스트 명명/중복 이슈도 발견했다. 어느 것도 현재 배포되는 동작을 깨뜨리는 실결함은 아니며(모두 실행으로 정상 동작을 확인함), 이 PR 이 표적으로 삼은 "무신호 회귀" 클래스를 앞으로도 계속 막아줄 안전망의 빈틈들이다.

## 위험도

LOW
