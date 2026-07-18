# 문서화(Documentation) 리뷰

## 리뷰 대상
- `.claude/tools/bootstrap-session.sh` (mermaid-lint 설치 락 apparatus 전체 제거 → 마커-only 전환)
- `.claude/tests/test_bootstrap_mermaid_install.py` (락 테스트 9건 + `_plant_lock` 제거, 동시성 단언을 "정확히 1회"에서 "수렴"으로 재정의)
- `.githooks/pre-commit` (헤더 delegate 목록에 `mermaid_lint_ready.py` 추가)
- `.claude/tests/README.md` (`test_bootstrap_mermaid_install.py` 행 갱신)

diff 범위는 `a16d80290`("mermaid 설치 락 제거 — 마커-only 로 전환") 1개 커밋이며, `git show`/`git diff origin/main` 으로 실제 변경분을 대조하고 4개 파일의 상호 참조(`_lib/mermaid_lint_ready.py`, `plan/in-progress/harness-guard-followups.md` §A·§G)까지 실측 검증했다.

## 발견사항

- **[INFO]** `_file_mtime` 헬퍼에 인라인 주석 없음
  - 위치: `.claude/tools/bootstrap-session.sh:104` — `_file_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }`
  - 상세: BSD(`stat -f %m`)/GNU(`stat -c %Y`) 양쪽을 순서대로 시도하는 크로스플랫폼 mtime 헬퍼인데, 이 의도를 설명하는 주석이 없다. 함수명과 짧은 구현으로 유추는 가능하지만, 같은 파일의 다른 모든 로직(마커·throttle·reap)에는 "왜"를 설명하는 주석이 충실히 달려 있어 이 한 줄만 상대적으로 비어 보인다.
  - 제안: `# cross-platform (BSD stat vs GNU stat) mtime in epoch seconds; 0 if missing` 정도의 1줄 주석 추가. 차단 사유는 아님.

- **[INFO]** 섹션 4 헤더의 자기참조 표현이 1~3번과 스타일 불일치
  - 위치: `.claude/tools/bootstrap-session.sh:43` — `#   4. Reap worktrees / local branches whose PR has merged (see section 4).`
  - 상세: "Four responsibilities" 목록의 항목 1~3 은 "(see section N)" 같은 자기참조가 없는데 4번만 "(see section 4)" 를 붙여, 이미 "4." 로 번호가 매겨진 항목이 스스로를 "section 4" 로 재차 가리키는 형태다. 내용은 정확하지만(코드의 `# 4. Reap...` 섹션과 정합) 서술 스타일이 다른 3개 항목과 어긋난다.
  - 제안: 사소한 표현이라 필수는 아니나, 통일성을 원하면 "(see section 4)" 를 제거하거나 1~3번에도 동일 패턴을 적용.

- **[INFO]** (리뷰 대상 파일 밖, 참고용) `worktree-policy.md` 의 앵커 서술이 `bootstrap-session.sh` 자체 설계 노트와 미묘하게 다른 결
  - 위치: `.claude/docs/worktree-policy.md:117` (이번 diff 에 포함되지 않은 파일) vs `.claude/tools/bootstrap-session.sh:147-151`
  - 상세: `worktree-policy.md` 는 "`bootstrap-session.sh` 가 `--keep` 으로 전달하는 `$CLAUDE_PROJECT_DIR`" 라고 서술하는데, `bootstrap-session.sh` 자신의 주석은 "anchor 는 `$CLAUDE_PROJECT_DIR` 가 **아니라** `BASH_SOURCE` 에서 유도한다 — 변수가 훅 환경에 export 되어 있는지에 의존하지 않기 위해서" 라고 명시적으로 반대 방향을 강조한다. 실행 시점 값은 우연히 동일하지만(하네스가 그 경로로 스크립트를 호출하므로), "무엇으로부터 유도하는가" 라는 메커니즘 서술이 두 문서에서 어긋난다.
  - 제안: 이번 diff 의 회귀는 아니며(섹션 4 코드·주석 자체는 이번 커밋에서 변경되지 않음, `worktree-policy.md` 도 미변경) 리뷰 대상 4개 파일 밖의 문제이므로 차단 사유 아님. 후속 정리 시 `worktree-policy.md` 문구를 "BASH_SOURCE 유도(값은 $CLAUDE_PROJECT_DIR 와 동일)" 로 정정하면 두 문서가 완전히 합치.

## 교차검증 결과 (문제 없음 확인)

아래는 문서-코드 정합성을 실측 대조해 **이상 없음**을 확인한 항목들 — 이번 커밋의 문서화 품질이 상당히 높다는 근거로 요약에 반영한다.

- `bootstrap-session.sh` 의 "Two guards. NOT a mutual-exclusion lock" 설계 노트는 실제 코드(마커 `[ ! -f "$marker" ]` + `_install_throttled`)와 정확히 일치하며, 제거된 락 관련 함수(`_lock_is_dead`·owner PID·grace·steal)에 대한 잔여 참조가 코드에도 주석에도 없다.
- `test_bootstrap_mermaid_install.py` 모듈 docstring 은 실제 남아있는 7개 테스트 메서드(marker/partial/failed/throttle×2/concurrent)와 1:1 로 대응하며, 삭제된 락 관련 9개 테스트(`test_held_lock_*`, `test_stale_lock_*`, `test_live_but_slow_lock_*`, `test_sub_minute_grace_*` 등)와 `_plant_lock`/`self.lock` 에 대한 잔여 참조가 전혀 없다.
- `.claude/tests/README.md` 의 `test_bootstrap_mermaid_install.py` 행이 같은 커밋에서 함께 갱신되어("marker-only, not lock-serialised", `test_concurrent_cold_start_converges_and_then_stops_reinstalling` 언급) 코드·테스트·README 3자가 동일 커밋에서 동기화됐다 — 별도 후속 커밋으로 미루지 않은 점이 이 저장소의 "SoT 즉시 동기화" 관례에 부합한다.
- `.githooks/pre-commit` 헤더의 delegate 목록 갱신(`mermaid_lint_ready.py` 추가)은 실제로 `.claude/hooks/_lib/mermaid_lint_ready.py` 를 새로 참조하는 코드(`mermaid_ready=... && python3 "$mermaid_ready" ...`)와 정합하며, `mermaid_lint_ready.py::is_ready()` 를 직접 읽어 "node_modules 존재 **AND** 마커 존재" 로직이 주석 서술("NOT a bare `[ -d node_modules ]` test... also requires bootstrap's completion marker")과 정확히 일치함을 확인했다.
- `bootstrap-session.sh` 주석이 참조하는 `plan/in-progress/harness-guard-followups.md §A`(마커-only 재작성, `[x]` 완료 체크)와 `§G`(fcntl.flock 방향 후속)가 실제로 해당 섹션 헤더로 존재하며 내용도 코드 주석과 합치한다.
- `.gitignore` 의 `.install.lock/` 항목 제거(락 파일이 더는 존재하지 않으므로)도 확인 — 죽은 ignore 규칙이 남지 않았다.
- CHANGELOG.md 갱신 없음은 정상 — 이 repo 의 CHANGELOG 는 spec 연동 제품 변경 전용이며(기존 항목 전수가 `spec/` SoT 를 인용), 하네스 내부 개발 도구 변경(mermaid-lint 설치 가드)은 관례상 범위 밖. `MERMAID_INSTALL_RETRY_SEC` 도 신규 도입이 아니라 기존 값 유지이며 코드 인라인 주석 + plan §A 에 이미 문서화되어 있어 별도 설정 문서 갱신 불요.

## 요약

이번 diff(`a16d80290`)는 코드 삭제(락 apparatus)와 그 근거·잔여 리스크를 설명하는 주석, 테스트 docstring, `.claude/tests/README.md` 커버리지 표, `.githooks/pre-commit` delegate 헤더, plan 문서(§A/§G)를 **같은 커밋에서 일괄 동기화**한 사례로, 문서화 관점에서는 모범에 가깝다. 제거된 메커니즘(mkdir 락·owner PID·grace·steal)에 대한 잔여/오래된 언급이 4개 리뷰 대상 파일 어디에도 남아있지 않고, 새로 남긴 설계 노트("왜 락을 뺐는가", "수용한 잔여 리스크", "정말 필요해지면 fcntl.flock")가 코드와 정확히 대응한다. `_lib/mermaid_lint_ready.py` 를 실제로 열어 "node_modules AND 마커" 판정 로직을 대조한 결과 `pre-commit` 헤더·인라인 주석의 서술과 정확히 일치했다. 발견된 사항은 전부 INFO 수준의 스타일적 사소함(헬퍼 함수 1줄 주석 부재, 섹션 4 자기참조 표현)이며, 리뷰 대상 밖 파일(`worktree-policy.md`)의 미묘한 서술 결 차이는 이번 diff 의 회귀가 아니라 참고로만 덧붙였다. CHANGELOG·설정 문서·예제 코드는 이 변경의 성격(내부 harness 개발 도구, 사용자 대면 기능 아님)상 불요하며 실제로 갱신되지 않은 것이 관례에 맞다.

## 위험도
LOW
