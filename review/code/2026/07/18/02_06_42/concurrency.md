# 동시성(Concurrency) 리뷰

## 발견사항

- **[CRITICAL]** mkdir 락 "steal"(탈취) 로직이 check-then-act 라 여러 세션이 동시에 스테일 락을 훔칠 때 npm install 이 다중으로 동시 실행됨 — **실제 재현으로 확인**
  - 위치: `.claude/tools/bootstrap-session.sh` L108-121 (`_lock_is_dead`), L123-153 (설치 블록), 특히 L128 `_lock_is_dead && rm -rf "$lock" 2>/dev/null` → L129 `if mkdir "$lock" 2>/dev/null; then`
  - 상세: `mkdir` 자체는 원자적이라 콜드스타트(락이 아예 없는 상태) 경쟁은 안전하다(직접 검증: 15-way 동시 실행 10/10 회 모두 정확히 1회 설치). 문제는 그 **직전** 단계다 — `_lock_is_dead`(판정)와 `rm -rf "$lock"`(삭제)이 원자적으로 묶여 있지 않다. 두 개 이상의 세션이 동일한 죽은 락을 각자 "죽었다"고 판정한 뒤, 한 세션(A)이 `rm -rf`→`mkdir`→owner 기록까지 마쳐 정당하게 새 락을 쥔 **직후**, 더 먼저 판정을 끝냈지만 `rm -rf` 실행이 지연된 다른 세션(B)이 자신의 판정 결과만 믿고 무조건 `rm -rf`를 실행 — A 가 방금 만든 신선한 락을 삭제해 버린다. 그러면 B 의 `mkdir` 도 성공하고, A 는 이미 설치를 진행 중인 상태로 **A·B 가 동시에 같은 `node_modules` 트리에 `npm install`을 실행**하게 된다. 상단 주석은 "genuinely dead+aged lock cannot also be a fresh re-acquisition... so removing it here cannot clobber a live holder"라고 방어 논리를 펴지만, 이는 "원래 죽은 소유자"를 재도둑질로부터 보호하는 논증일 뿐 **"다른 stealer 가 방금 재획득한 신선한 락"을 이 무조건적 rm -rf 가 지울 수 있다는 케이스는 다루지 않는다**.
  - **재현 방법 및 결과** (스크래치패드에서 실제 스크립트를 복사해 격리 실행, 리뷰 대상 파일은 무수정):
    - 죽은 owner PID(`(true) &`; wait 로 좀비 회수) 로 스테일 락(`.install.lock/owner`)을 만든 뒤, 15개 프로세스로 `bootstrap-session.sh` 를 동시 기동.
    - `MERMAID_INSTALL_LOCK_GRACE_SEC=0` 조건: **20/20 시행 전부**에서 15개 중 **3~7개** 프로세스가 동시에 npm install 을 실행(정확히 1이어야 정상).
    - 기본값(600s grace) + 실제로 700초 backdate 한 현실적 스테일 락으로도 재확인: 15개 중 **7개** 동시 설치.
    - 대조군(콜드스타트, 사전 락 없음, 동일 15-way 동시성): 10/10 시행 모두 정확히 1회 설치 — mkdir 원자성 자체와 테스트 하네스는 정상, 문제는 steal 경로에 국한됨을 확인.
    - 모든 프로세스는 exit 0(세션을 블록하지 않음) — 실패가 전혀 보이지 않고 **조용히** node_modules 트리에 여러 npm install 이 동시에 쓰기 경합을 벌인다. 실제 npm install(스텁이 아닌)에서는 이런 동시 다중 실행이 파일 충돌·불완전 트리로 이어질 수 있는 잘 알려진 위험이며, 이는 정확히 이 3중 가드(마커+락+throttle) 전체가 막으려던 "손상된 node_modules 가 completion marker 로 인해 ready 로 오판되는" 실패 양상을 재도입한다.
    - 현재 테스트 스위트(`test_bootstrap_mermaid_install.py`, 16개 테스트) 는 이 조합을 커버하지 않아 **전부 green** 상태로 통과함을 직접 실행으로 확인했다 — `test_stale_lock_is_stolen_so_it_cannot_wedge_forever` 는 단일 세션만, `test_concurrent_sessions_install_at_most_once` 는 사전 락이 없는 콜드스타트만 검증해, "복수 stealer vs 하나의 스테일 락" 조합이 정확히 비어 있다.
  - 트리거 전제조건: (a) 세션이 락을 쥔 채 grace(기본 600초/10분) 이상 크래시 상태로 방치되고, (b) 그 이후 여러 세션이 거의 동시에 시작. 이 저장소 자신의 문서(`worktree-policy.md`, 이 파일 상단 주석)가 "여러 워크트리 세션 동시 기동이 표준 워크플로"라고 명시하고, 락 liveness 메커니즘 자체가 "크래시 이후 복구"를 위해 설계된 것이므로 — 정확히 이 메커니즘이 대응하려는 시나리오에서 실패한다.
  - 제안: 얕은 수정(예: 삭제 전에 원자적 `mv "$lock" "$lock.stale.$$"` 로 먼저 훔친 뒤에만 재생성)도 **직접 검증한 결과 근본적으로 막지 못했다** — 동일 완화를 적용한 스크래치 사본으로 20회 재시행 시 18/20(90%) 에서 여전히 2~3건 동시 설치가 발생했다(범위만 3~7→2~3 으로 좁아짐). 원인은 동일 구조(판정과 행동이 별개 단계)가 한 단계 좁아졌을 뿐 남아있기 때문이다. 진짜 닫으려면 판정 시점의 owner 값을 캡처해 원자적 조작 직후 그 캡처값과 실제로 옮겨진 락의 내용이 일치하는지 재대조하고 불일치 시 원복하는 compare-and-swap 성격의 처리가 필요하거나, 팀이 이미 W2/W12 처럼 명시적으로 문서화한 잔존 한계로 받아들이는 결정을 내려야 한다. 최소 조치로 이 조합("복수 stealer vs 하나의 스테일 락")에 대한 회귀 테스트를 스위트에 추가할 것을 권장한다(`test_concurrent_sessions_install_at_most_once` 를 사전에 죽은 owner 락을 심어둔 상태로 변형하면 즉시 실패를 재현할 수 있다).

- **[INFO]** W2(npm install 에 타임아웃 없음, 00_59_56 리뷰에서 이미 트래킹됨)의 blast-radius 가정이 위 CRITICAL 과 상호작용해 약화됨
  - 위치: `.claude/tools/bootstrap-session.sh` L132-140 주석, L141 `npm install`
  - 상세: 주석은 "Blast radius is scoped to the one session holding the lock"이라 말하지만, 이는 stealer 가 항상 1개라는 전제 하에서만 성립한다. 위 CRITICAL 이 트리거되면 여러 세션이 각자 무기한 걸릴 수 있는 `npm install` 을 독립적으로 시작하므로, "한 세션만 영향받는다"는 전제 자체가 깨진다. 새 버그는 아니고 기추적 항목이지만, 두 항목이 독립적이지 않다는 점은 우선순위 판단에 참고할 가치가 있다.
  - 제안: 이미 `plan/in-progress/harness-guard-followups.md §A` 에 트래킹됨 — 위 CRITICAL 수정 시 함께 재평가 권장.

- **[INFO]** W12(`kill -0` PID 재사용 ABA, 00_59_56 리뷰에서 이미 트래킹됨) — 기존 문서화된 한계, 새로 발견된 사항 아님. fail-safe 방향(설치가 중복되기보다 막힘)이라 위 CRITICAL 과는 반대 방향의 리스크.

- **[INFO]** `test_dead_pid_lock_is_stolen` (`test_bootstrap_mermaid_install.py`) 자체의 이론적 PID 재사용 취약성
  - 상세: `corpse = subprocess.Popen(["true"]); corpse.wait()` 로 죽은 PID 를 얻은 뒤 그 번호를 락 owner 로 심는데, `_run()` 실행 시점까지 사이에 그 PID 가 바쁜 CI 머신에서 다른 프로세스로 재사용되면(낮은 확률) 테스트가 flake 할 수 있다. 프로덕션 코드가 이미 문서화한 것과 동일한 클래스의 문제이며, 우선순위는 낮음(전형적인 PID 공간에서 이 짧은 창 안에 재사용될 확률은 희박).

- **[INFO]** `reap-merged-worktrees.sh` 는 이번 리뷰 페이로드에 포함되지 않아 내부 동시성을 검증할 수 없음
  - 위치: `.claude/tools/bootstrap-session.sh` L183-186 (`anchor=...`, `bash "$reaper" ${anchor:+--keep "$anchor"}`)
  - 상세: 앵커 계산 자체(`cd ... && pwd -P` 서브셸)는 부작용이 없고 동시성 문제를 일으키지 않는다. 다만 여러 세션이 거의 동시에 SessionStart 를 트리거하면 reaper 도 동시에 여러 번 호출될 수 있는데(주석은 "self-throttled to once per few hours"라고만 언급), 그 스로틀·정리 로직 자체의 원자성은 이번 파일 세트만으로는 확인 불가능하다. 별도로 해당 스크립트를 대상으로 한 번 더 점검할 것을 권장(범위 밖 메모).

- **[관찰/양호]** 다음은 검증 결과 문제 없음: (1) CI `concurrency: group/cancel-in-progress` 설정은 표준적이고 올바름(`.github/workflows/harness-checks.yml`). (2) `lint_mermaid_posttooluse.py`·`mermaid_lint_ready.py` 는 순수 읽기 소비자로 공유 가변 상태를 쓰지 않으며, `subprocess.run` 에 타임아웃(20s/5s)이 일관되게 적용돼 이벤트 루프/훅을 막지 않는다. (3) 단일 락 자원만 사용해 데드락(여러 락의 순환 대기) 가능성은 없음 — 락을 못 얻은 쪽은 대기하지 않고 즉시 스킵하는 설계.

## 요약

이번 변경의 핵심(bootstrap-session.sh 의 mermaid-lint 설치 mkdir 락 + liveness 기반 stale-lock steal + completion marker + failure throttle)은 여러 차례의 이전 리뷰(W1/W9/W10/W11 등)를 거치며 정교하게 다듬어져 왔고 콜드스타트 동시성(사전 락 없는 최초 설치 경쟁)은 실측으로도 견고하다. 그러나 이번 리뷰에서 **"스테일(죽은 owner) 락을 여러 세션이 동시에 훔치려 할 때"** 라는 아직 테스트되지 않은 조합에서 심각한 회귀를 실제로 재현했다: `_lock_is_dead && rm -rf "$lock"` 이 판정과 삭제를 원자적으로 묶지 않아, 한 stealer 가 방금 정당하게 재획득한 신선한 락을 다른(더 느린) stealer 가 지워버리고 자신도 mkdir 에 성공해 결과적으로 동일 `node_modules` 트리에 npm install 이 다중 동시 실행된다 — 스크래치 사본으로 격리 재현한 결과 해당 조건에서는 사실상 항상(20/20 시행) 발생했고, 기본 grace(600s) + 현실적인 700초 경과 조건에서도 재확인했다. 이는 이 메커니즘이 명시적으로 막으려던 실패 양상(손상된 설치가 completion marker 로 인해 "ready"로 조용히 오판됨)을 그대로 재도입할 수 있는 심각한 결함이며, 저장소 자신의 "여러 워크트리 세션 동시 기동이 표준 워크플로"라는 문서화된 전제와 정확히 맞물린다. 얕은 완화(원자적 rename 선행)도 직접 검증해봤지만 창을 좁힐 뿐 근본적으로 닫지 못했으므로, 별도의 집중 수정 라운드(및 회귀 테스트 추가)가 필요하다. 그 외 파일들(Python 훅, pre-commit, CI workflow)은 순수 소비자이거나 표준적인 설정으로 이번 리뷰에서 별도 동시성 결함은 발견되지 않았다.

## 위험도

CRITICAL
