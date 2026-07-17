# 테스트(Testing) 리뷰 — bootstrap mermaid-lint install 가드 (마커 + mkdir 락)

검증 방법: 정적 리뷰에 그치지 않고 실제로 실행해 확인했다 — (1) 신규 스위트를 현재(수정) 코드에
대해 실행(9/9 pass), (2) `git show`로 복원한 수정 전 `bootstrap-session.sh`(commit `cdad5a1ec`)에
대해 같은 스위트를 재실행(6/9 fail, 동시성 테스트 포함 — plan 문서의 "구 코드에서 6건 실패
확인"·"동시 5세션 테스트가 구 코드에서 실패" 주장과 정확히 일치), (3) CI 와 동일한
`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 하네스 전체 291건 재실행(회귀
없음, `test_reap_merged_worktrees.py` 18건 포함), (4) 의심되는 잔여 TOCTOU 를 30 라운드 × 20
프로세스 스트레스로 별도 재현 시도.

## 발견사항

- **[WARNING]** `test_concurrent_sessions_install_at_most_once` 가 `Popen` pipe 를 읽지도 닫지도 않는다 — 잠재적 데드락 anti-pattern
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:164-168` (`subprocess.Popen(..., stdout=subprocess.PIPE, stderr=subprocess.PIPE)` 5개 생성 후 `p.wait()`만 호출, `communicate()`/`close()` 없음)
  - 상세: 실제로 이 테스트 1개만 단독 실행해도, 그리고 하네스 스위트 291건 전체를 CI 와 동일하게 (`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) 돌려도 매번 `ResourceWarning: unclosed file <_io.BufferedReader ...>` 가 9~10건씩 발생함을 직접 확인했다. Python `subprocess` 공식 문서가 명시하는 전형적 함정 — 자식 프로세스의 stdout+stderr 합산 출력이 OS 파이프 버퍼(리눅스 기준 약 64KB)를 넘으면 자식이 쓰기 블로킹되고, 부모는 그 파이프를 읽지 않은 채 `wait()`만 하므로 **영구 hang** 이 가능하다. 현재는 부트스트랩·reaper 의 출력이 작아 재현되지 않지만(빈 임시 repo, echo 몇 줄), 향후 두 스크립트에 로그가 늘어나면 CI 가 이 테스트에서 조용히 멈출 수 있는 취약한 전제 위에 서 있다.
  - 제안: 이 테스트는 stdout/stderr 내용을 전혀 검증하지 않으므로 `stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL` 로 바꾸거나, 캡처가 필요하면 `p.communicate()` 를 쓴다.

- **[WARNING]** `.claude/tests/README.md` 커버리지 표에 신규 파일 미등록
  - 위치: `.claude/tests/README.md` "무엇이 커버되는가" 표 (19-35행) — 기존 12개 테스트 파일은 전부 한 줄 설명이 등록돼 있으나 `test_bootstrap_mermaid_install.py` 행이 없다.
  - 상세: 이 표는 CI 워크플로(`harness-checks.yml`)가 "Policy/intent" 로 직접 링크하는 문서이자, 이 저장소가 반복적으로 강조하는 "정보 저장 위치 단일 진실" 관례의 실제 구현체다. 자동 가드는 없음(README 완전성을 검사하는 테스트는 `.claude/tests/*.py` 어디에도 없음을 확인했다 — `test_doc_sync_matrix.py` 는 `PROJECT.md` 표만 대상), 그래서 CI 를 깨뜨리진 않지만, 향후 유지보수자가 README 만 보고 "이 저장소의 하네스 테스트가 뭘 커버하는지" 파악할 때 이 회귀 시나리오(bootstrap 동시성 + 부분 설치 영속)가 완전히 누락된 채로 보인다.
  - 제안: `test_reap_merged_worktrees.py` 행과 유사한 형식으로 한 줄 추가 (예: "bootstrap의 mermaid-lint 설치 가드 — 완료 마커 + mkdir 락, 병렬 세션 동시 설치·부분 node_modules 영속 방지").

- **[WARNING]** 마커 체크가 락 획득 **이전**에 한 번만 일어나고, 락 획득 후 재확인이 없다 — 이론상 잔여 TOCTOU
  - 위치: `.claude/tools/bootstrap-session.sh:58-71`. 바깥 `if [ ! -f "$marker" ]`(58행)가 참으로 평가된 뒤 `mkdir "$lock"`(63행)이 성공하면, 그 사이 다른 프로세스가 설치를 완료(마커 기록 + 락 해제)했더라도 이 프로세스는 그 사실을 다시 확인하지 않고 npm install 을 또 실행한다.
  - 상세: 코드 검토로 이 경로가 실제로 존재함을 확인했고, 30 라운드 × 20 동시 프로세스(도합 600회 부트스트랩 기동) 스트레스로 재현을 시도했으나 **한 번도 재현되지 않았다**(항상 npm 호출 ≤1). 이유는 "패자"의 재확인 없는 구간(바깥 check → steal-check → mkdir, 두 줄 남짓)이 "승자"의 전체 임계구역(mkdir → npm install → 마커 기록 → rmdir, fork/exec 다수)보다 훨씬 짧기 때문으로 보인다 — 실제 npm install 은 스텁보다 훨씬 느려 이 여유폭이 더 커진다. 즉 **실질 위험은 매우 낮음** (최악의 경우도 부팅이 막히거나 lint 가 무력화되는 것이 아니라 **중복 재설치 1회**뿐, 이 PR 이 고치려는 원래 결함과 무관). 다만 테스트 관점에서 짚을 것은: `test_concurrent_sessions_install_at_most_once`(9-16행 docstring: "The race itself")가 이 불변식을 **증명하지 못하고 타이밍에 의존해 확률적으로만 관측**한다는 점 — 스텁 npm 이 실 npm 보다 빨라 이 특정 테스트가 다른 어떤 실사용 시나리오보다 이 잔여 윈도를 노출시키기 가장 쉬운 조건인데도 재현되지 않았다는 것이지, 구조적으로 닫혀 있다는 뜻은 아니다. 이 테스트가 향후 CI 에서 아주 드물게 flake(`assertLessEqual(x, 1)` 실패, x=2)한다면 새 회귀가 아니라 이 잔여 윈도일 가능성을 우선 의심해야 한다.
  - 제안: `mkdir "$lock"` 성공 직후 `[ ! -f "$marker" ]` 를 재확인해 있으면 즉시 락만 반납하고 스킵하도록 하면 이 속성이 확률적 관측에서 구조적 불변식으로 바뀐다 (한 줄 변경). 코드를 안 고친다면 최소한 스크립트 주석에 이미 있는 "One-off" 케이스 옆에 이 잔여 윈도도 "허용된 트레이드오프"로 명시해 두는 편이 `test_concurrent_sessions_install_at_most_once` 의 docstring 이 "pin"이라 주장하는 것과의 간극을 줄인다.

- **[INFO]** "마커 존재 + 락 잔존" 상태는 테스트되지 않으며, 재현해보니 `.gitignore` 주석의 "harmless" 서술이 이 경우엔 정확하지 않다
  - 위치: `.claude/tools/bootstrap-session.sh:58` (바깥 게이트) vs `.gitignore:585-587` 의 "크래시로 남으면 10분 뒤 다음 세션이 회수하므로 잔존물도 harmless" 주석.
  - 상세: 직접 재현 스크립트로 확인 — 마커가 이미 존재하는 상태에서 `.install.lock/` 을 만들고(= npm install 성공 후 마커 기록 후 rmdir 전에 크래시한 상황을 흉내), 락을 1시간 전 mtime 으로 aging 한 뒤 bootstrap 을 재실행해도 **락이 전혀 회수되지 않았다**(여러 번 재실행해도 동일). 원인은 락 탈취 로직 전체가 `[ ! -f "$marker" ]` 라는 같은 바깥 게이트 안에 있어서, 마커가 존재하는 순간 이 분기 자체가 다시는 평가되지 않기 때문이다. 실질 영향은 미미하다 — `.gitignore` 로 무시되는 빈 디렉터리 하나가 영구히 남을 뿐, 설치를 막거나 세션에 어떤 신호도 주지 않는다("harmless"라는 결론 자체는 맞다). 다만 "10분 뒤 다음 세션이 회수" 라는 **메커니즘 서술은 이 특정 크래시 타이밍(마커 기록 후 ~ rmdir 전)에는 사실이 아니다** — 그리고 이 상태 전이는 스위트 9건 어디에도 없다(가장 가까운 `test_stale_lock_is_stolen_so_it_cannot_wedge_forever` 는 마커가 **아직 없는** 상태만 다룬다).
  - 제안: 낮은 우선순위. 여유가 있다면 이 상태 조합(마커 present + lock present)에 대한 테스트 1건 추가, 또는 최소한 `.gitignore` 주석의 "10분 뒤 회수" 를 "설치 완료 전 크래시 시" 로 한정하는 문구 수정.

- **[INFO]** npm 스텁이 호출 인자를 검증하지 않는다
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:31-36` (`_NPM_STUB`) — `$@` 를 무시하고 호출 횟수만 로깅.
  - 상세: 실제 스크립트가 호출하는 `npm install --no-fund --no-audit --silent`(`bootstrap-session.sh:65`) 중 일부 플래그가 실수로 빠지거나 바뀌어도 이 스위트는 감지하지 못한다. 다만 이 플래그들은 동작 자체(설치 성공/실패)를 좌우하지 않는 부가 옵션(fund/audit 안내·출력 억제)이라 실제 위험은 낮다 — 이 스위트가 검증 대상으로 삼은 "락·마커 오케스트레이션 로직"의 스코프 밖으로 보는 것도 합리적인 판단이다.
  - 제안: 필요시 `_NPM_CALL_LOG` 에 `"$*"` 를 함께 기록해 최소 1개 테스트에서 인자 존재를 assert.

- **[INFO]** 10분 락 탈취 임계값의 경계값(boundary) 테스트 없음
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:138-145` (`test_stale_lock_is_stolen_so_it_cannot_wedge_forever`, 1시간 전 — 임계값보다 훨씬 오래됨) vs `test_held_lock_makes_this_session_skip_rather_than_race`(130-136행, 방금 생성 = 0분).
  - 상세: 두 극단(매우 신선/매우 오래됨)만 다루고 임계값 부근(예: 9분59초 vs 10분01초)은 다루지 않는다. self-healing 휴리스틱 타임아웃이라 분 단위 정밀도가 크게 중요하지 않아 우선순위는 낮다.

## 요약

신규 테스트 스위트(`test_bootstrap_mermaid_install.py`, 9건)는 품질이 높다 — 실행해서 직접
확인한 결과 현재 코드에서 9/9 통과, `git show`로 복원한 수정 전 코드에서는 정확히 6/9 실패(동시성
테스트 포함)로 plan 문서의 비-vacuity 주장이 그대로 검증됐고, CI 동일 명령(`unittest discover`)으로
하네스 전체 291건을 재실행해도 회귀가 없었다(`test_reap_merged_worktrees.py` 18건 포함 —
bootstrap-session.sh 를 end-to-end 로 구동하는 기존 스위트도 안전). 각 테스트는 독립된
`tempfile.mkdtemp()` 위에 실제 git repo·실제 서브프로세스를 구성해 완전히 격리되어 있고, 이름·docstring·assert
메시지가 "왜 이 테스트가 존재하는가"(구체적 실패 시나리오)를 명확히 표현해 가독성이 매우 좋다. npm
스텁은 네트워크를 타지 않으면서 성공/실패를 제어 가능하게 만든, 스코프에 맞는 적절한 mock이다.
CI 연결도 확인됨 — `harness-checks.yml` 이 `.claude/tests/**`·`.claude/tools/**` 경로 변경 시
`test_*.py` 를 자동 discover 하므로 별도 등록 없이 이 파일이 실행된다. 개선 여지는 세 갈래다: (1)
동시성 테스트의 `Popen` pipe 미해제가 실제 `ResourceWarning` 으로 관측되는 잠재적 데드락
anti-pattern(고치기 쉬움), (2) README 커버리지 표에 신규 파일이 미등록(이 저장소가 강조하는 등록
관례의 예외), (3) 코드 자체에 남아있는 이론적 TOCTOU(마커 재확인 없이 락만 획득) — 직접
스트레스 재현(30×20)으로는 관측되지 않았고 최악의 영향도 "중복 재설치"에 그쳐 이 PR 이 표적으로
삼은 원래 결함(무신호 lint 무력화)과는 무관하지만, 이를 증명이 아닌 확률적으로만 관측하는 테스트임은
기록해 둘 가치가 있다. 세 항목 모두 이 PR 을 차단할 사안은 아니다.

## 위험도

LOW
