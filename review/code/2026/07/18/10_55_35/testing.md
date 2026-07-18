### 발견사항

- **[INFO]** 동시(concurrent) 축과 실패(failure) 축의 조합이 테스트되지 않음
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:156` (`test_concurrent_cold_start_converges_and_then_stops_reinstalling`) 및 `:185`,`:193` (throttle 테스트 2건)
  - 상세: 동시성 테스트는 `_NPM_STUB`이 항상 성공(exit 0)하는 경로만 5-way 로 검증하고, 실패/throttle 테스트는 항상 단일 프로세스(`_run(fail=True)`)로만 검증한다. "여러 세션이 같은 순간 cold-start install 을 시도했는데 그중 일부/전부가 실패"하는 조합은 어느 테스트에도 없다. 코드상으로는 각 레이서가 독립적으로 `mkdir -p "$(dirname "$fail_marker")" 2>/dev/null && : > "$fail_marker"`를 실행하므로 멱등적으로 수렴할 가능성이 높지만(빈 파일을 여러 번 touch), `mkdir -p`의 동시 생성이 모든 구현에서 100% 안전하다는 보장은 실측되지 않았다. 락을 제거하며 "동시 콜드스타트는 이제 직렬화되지 않는다"는 것이 이번 커밋의 핵심 계약 변경이므로, 실패 방향에서도 같은 계약이 깨지지 않는지 최소 1건의 조합 테스트로 고정할 가치가 있다.
  - 제안: `test_concurrent_cold_start_converges_and_then_stops_reinstalling`과 대칭으로, `NPM_STUB_FAIL=1`을 준 5-way 동시 실행이 (a) 크래시 없이 전부 returncode 0, (b) `fail_marker`가 정확히 생성됨, (c) 이후 throttle 이 정상 작동함을 단언하는 테스트 1건 추가. 우선순위는 낮음(현재 코드가 멱등적 연산만 사용해 실제 손상 가능성은 낮음).

- **[INFO]** mermaid-install 로직이 여전히 `bootstrap-session.sh`에 인라인 — 이미 plan 에 추적됨(신규 지적 아님)
  - 위치: `.claude/tools/bootstrap-session.sh:34-97`
  - 상세: 락 제거로 코드는 크게 줄었지만(131→69줄 net diff), install 로직 자체는 여전히 `bootstrap-session.sh` 최상위에 인라인돼 있어 테스트가 항상 스크립트 전체(§1 githooks·§3 GC·§4 reaper 포함)를 서브프로세스로 구동해야 한다. `reap-merged-worktrees.sh`처럼 별도 스크립트로 뽑으면 순수 유닛 테스트(함수 단위, subprocess 없이)가 가능해진다. 다만 이는 `plan/in-progress/harness-guard-followups.md` §G 에 "필요 시 `ensure-mermaid-lint-deps.py` 추출 + `fcntl.flock`"로 이미 등록·의도적으로 defer 된 항목이라, 이번 diff 의 새로운 갭이 아니다.
  - 제안: 없음(이미 §G 로 추적 중, 현 상태 유지가 합리적 트레이드오프).

### 검증 수행 내역

- `python3 -m unittest discover -s .claude/tests -p 'test_bootstrap_mermaid_install.py'` → 7건 전체 PASS.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → 하네스 스위트 **301건 전체 PASS**, 커밋 메시지의 "harness 301 통과" 주장과 정확히 일치.
- 의존 스위트 회귀 확인: `test_mermaid_lint_ready.py`(공유 판정 SoT + cross-language marker 바인딩) 12건, `test_reap_merged_worktrees.py`(bootstrap 이 reaper 를 구동하는 e2e 포함) 18건 — 모두 PASS. 마커 경로 상수(`node_modules/.bootstrap-install-complete`)가 락 제거 리팩터로 변경되지 않았음을 실행으로 재확인.
- **비-vacuity 자체 재현**: `bootstrap-session.sh` 사본에서 성공 후 마커 기록 라인(`: > "$marker" ... && echo "bootstrap: mermaid-lint ready"`)만 무력화한 뮤턴트를 만들어 별도 스크래치 저장소에서 2회 연속 구동한 결과, 마커가 끝내 생성되지 않고 두 번째 실행에서도 npm 이 다시 호출됨(호출 수 1→2)을 직접 확인. 이는 커밋 메시지의 "마커-미기록 뮤턴트로 비-vacuity 확인" 주장, 그리고 `test_installs_once_and_writes_completion_marker`/`test_second_session_skips_when_marker_present` 두 테스트가 이 뮤턴트에 대해 정확히 FAIL 할 것임을 독립적으로 뒷받침한다.
- 저장소 전체에서 제거된 락 표면(`_lock_is_dead`, `.install.lock`, `MERMAID_INSTALL_LOCK_GRACE_SEC`, `_plant_lock`) 잔존 참조를 grep 했고, `.claude/tools/`·`.claude/tests/`·`.claude/hooks/` 등 살아있는 코드/테스트에는 dangling 참조가 전혀 없음을 확인(참조는 전부 `plan/`의 이력 표와 과거 `review/code/2026/07/17~18/*` 산출물 안에만 남아 있으며, 이는 의도된 시점 기록).

### 요약

이번 diff 는 3라운드 연속 실측 회귀(살아있는 홀더 탈취 → grace 절삭 → check-then-act TOCTOU)를 낸 손수 짠 `mkdir` 락을 통째로 제거하고 "완료 마커 + 실패 throttle"만 남기는 아키텍처 단순화다. 테스트 변경이 코드 변경과 정확히 1:1로 대응한다 — 제거된 락 관련 테스트 9건(`_plant_lock` 헬퍼 포함) 전부가 이제 존재하지 않는 동작(락 보유 중 skip·stale-lock steal·liveness 판정·sub-minute grace truncation)을 검증하던 것이었고, 남은/개명된 동시성 테스트(`test_concurrent_cold_start_converges_and_then_stops_reinstalling`)는 새 계약("직렬화는 없다, 그러나 마커로 수렴한다")을 정직하게 반영하도록 단언을 완화했다. 죽은 코드를 검증하는 테스트도, 새 동작을 놓치는 갭도 없다. 실제로 테스트를 구동해 7건(대상 파일)·301건(전체 하네스) PASS 를 확인했고, 커밋이 주장하는 비-vacuity(마커 미기록 뮤턴트가 실패해야 함)를 별도 뮤턴트로 독립 재현해 검증했다. 마커 경로 상수를 공유하는 `test_mermaid_lint_ready.py`·bootstrap 을 e2e 로 구동하는 `test_reap_merged_worktrees.py` 등 인접 스위트에도 회귀가 없다. 남은 것은 두 건의 저위험 INFO 뿐이다 — 동시성×실패 조합 미검증(설계상 멱등 연산이라 실질 위험은 낮음)과, install 로직이 여전히 인라인이라는 테스트 용이성 관찰(이미 plan §G 로 추적되는 의도된 defer). 전반적으로 테스트가 "구현을 따라간 것"이 아니라 "행동 계약을 정확히 고정한 것"이라 평가할 수 있다.

### 위험도
LOW
