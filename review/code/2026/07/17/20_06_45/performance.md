# 성능(Performance) 리뷰 — harness-guard-followups (bootstrap mermaid-lint install guard)

## 리뷰 대상

- `.claude/tests/test_bootstrap_mermaid_install.py` (신규, 9 테스트)
- `.claude/tools/bootstrap-session.sh` (mermaid-lint 설치 가드: 완료 마커 + `mkdir` 락 추가)
- `.gitignore` (락 디렉터리 무시 패턴 추가)
- `plan/in-progress/harness-guard-followups.md` (후속 항목 추적 문서, 코드 변경 없음)

## 발견사항

- **[WARNING]** `npm install` 이 지속적으로 실패하는 환경에서 매 SessionStart 마다 무제한 블로킹 재시도 (backoff/throttle 없음)
  - 위치: `.claude/tools/bootstrap-session.sh:56-72`
  - 상세: 완료 마커(`node_modules/.bootstrap-install-complete`)는 install 성공 시에만 기록된다(의도된 self-healing 설계). 따라서 실패가 지속되는 한(네트워크 차단, 사설 레지스트리 인증 만료, 디스크 풀 등) **매 SessionStart 마다 동기적으로 `npm install --no-fund --no-audit --silent` 이 재실행**된다. `node_modules`/marker/lock 은 main checkout 에 있어 모든 워크트리 세션이 공유하므로, 문제가 지속되는 동안 **동시에 열린 모든 워크트리 세션이 SessionStart 마다 동일한 블로킹 비용을 반복 지불**한다.
    같은 파일의 4번 섹션(`reap-merged-worktrees.sh` 호출)은 "SessionStart 마다 반복되는 외부 호출 비용을 억제해야 한다"는 동일 클래스의 문제를 이미 `REAP_MIN_INTERVAL`(기본 6h, `.claude/tools/reap-merged-worktrees.sh:40-41,54,112-122`) 스로틀로 해결해 두었는데, 이번 diff 의 install 재시도 경로에는 그 패턴이 적용되지 않았다.
    참고로 구(舊) 코드(`[ ! -d node_modules ]`)는 이 재시도 스톰이 실무적으로 거의 나타나지 않았다 — `npm install` 은 실패하더라도 대개 `node_modules` 디렉터리 자체는 먼저 만들어버리므로, 디렉터리 존재 체크가 (틀리게) "설치 완료"로 오판해 재시도를 멈췄기 때문이다. 이것이 바로 이번 PR 이 고치는 "부분 설치를 영구히 신뢰해 조용히 무력화"되는 버그다. 신규 코드는 correctness 를 위해 그 은폐를 걷어냈지만, 반대급부로 "실패가 지속되는 한 매 세션 블로킹 재시도"라는 새 트레이드오프가 생겼다.
  - 제안: 실패 시각을 marker 와 별도 파일(예: `.install-failed-at`)에 남기고, reaper 와 동일한 쿨다운 패턴(예: 10~30분)으로 재시도를 스로틀. 또는 연속 실패 횟수를 카운트해 지수 backoff.

- **[WARNING]** 락 탈취 임계값(10분)이 mtime 만으로 "정상적으로 느린 설치"와 "크래시"를 구분 — 동시 중복 설치 재발 가능성
  - 위치: `.claude/tools/bootstrap-session.sh:60-62`
  - 상세: `find "$lock" -maxdepth 0 -mmin -10` 은 락 디렉터리의 mtime 만으로 홀더의 생존 여부를 추정한다. `mkdir` 이후 아무도 락 디렉터리를 다시 touch 하지 않으므로, 어떤 세션의 `npm install`(mermaid + jsdom — 둘 다 만만치 않은 하위 의존성 트리를 가진 패키지, `.claude/tools/mermaid-lint/package.json:10-13`)이 네트워크 저하 등으로 10분을 넘겨 여전히 정상 진행 중이어도, 다른 세션은 그 락을 "죽은 것"으로 오판해 탈취(`rmdir` 후 `mkdir`)하고 **같은 `node_modules` 트리에 대해 두 번째 `npm install` 을 동시에 시작**할 수 있다. 두 프로세스가 같은 디렉터리에 병행 쓰기를 하면 CPU/네트워크 낭비는 물론, 트리가 오손되어 위 WARNING의 실패-재시도 스톰까지 유발할 수 있다 — 정확히 이번 PR 이 없애려던 "동시 설치가 트리를 깨뜨리는" 결함이 좁은 창(10분 초과 설치)으로 재발하는 셈이다. 신규 테스트(`test_stale_lock_is_stolen_so_it_cannot_wedge_forever`, `.claude/tests/test_bootstrap_mermaid_install.py:170-177`)도 "완전히 죽은 락(1시간 경과)" 케이스만 다루고 "느리지만 살아있는 락" 케이스는 커버하지 않는다. 일상적인 네트워크 조건에서는 발생 확률이 낮은 edge case다.
  - 제안: 설치 진행 중 락 mtime 을 주기적으로 touch 하거나(예: `npm install` 을 백그라운드로 띄우고 부모가 주기적으로 touch), 락 디렉터리 안에 PID 를 기록해 생존 여부를 직접 확인. 최소한 "10분은 mermaid-lint 실측 설치 시간 대비 충분한 여유"라는 전제를 주석에 남겨 의존성이 커질 때 재검토 트리거로 삼을 것.

- **[INFO]** 신규 테스트의 subprocess 호출에 timeout 미지정 — 회귀 시 CI 행(hang) 위험
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py` `_run()`(약 113-122행), `test_concurrent_sessions_install_at_most_once`(약 188-204행)
  - 상세: `subprocess.run(["bash", self.bootstrap], ...)` 와 5개의 `Popen(...); p.wait()` 어디에도 `timeout=` 이 없다. bootstrap 스크립트나 그 안에서 호출되는 reaper 스크립트가 향후 회귀로 실제 블로킹(예: 네트워크 대기, 락 해제 누락)을 하게 되면, 이 테스트들은 실패하지 않고 무한 대기하여 CI 잡 전체를 붙잡을 수 있다.
  - 제안: `subprocess.run(..., timeout=30)` 류로 상한을 명시해 회귀 시 빠르게 fail 하도록.

- **[INFO]** 마커 도입 이전의 정상 설치가 1회성으로 재설치됨 — 이미 문서화된 의도된 비용, 조치 불필요
  - 위치: `.claude/tools/bootstrap-session.sh:44-46` 주석(`One-off: an existing good install... reinstalls once`)
  - 상세: 마커 파일이 없던 기존 main checkout 은 이번 배포 이후 첫 SessionStart 에서 이미 정상 동작하던 `node_modules` 를 불필요하게 한 번 더 설치(네트워크 I/O 1회)한다. 코드 주석에 명시적으로 문서화되어 있고 main checkout 당 1회로 self-limiting 이라 실질적 우려는 낮다.
  - 제안: 없음(현행 유지 가능).

- **[INFO]** stale-lock 판정의 `find` 서브프로세스 fork — 경합 경로에만 국한, hot path 무영향
  - 위치: `.claude/tools/bootstrap-session.sh:60`
  - 상세: `[ -d "$lock" ] && [ -z "$(find ...)" ]` 구조상 `find` 는 락이 실제로 걸려 있을 때(드문 경합 상황)만 실행된다. steady-state(마커 존재 후 매 세션) hot path 는 `[ ! -f "$marker" ]` 단계에서 단락(short-circuit)되어 이 블록 전체를 건너뛰므로 영향이 없다. 경합 시에만 프로세스 fork 1회가 추가되며, 뒤따르는 `npm install`(초~분 단위)에 비하면 무시할 수준.
  - 제안: 최적화 불필요.

- **[INFO]** 별도 파일의 `gh pr view` 순차 N+1 — 이번 diff 범위 밖, 이미 후속 항목으로 추적됨
  - 위치: `.claude/tools/reap-merged-worktrees.sh` 의 `gh_state()`(pass 1/2 에서 워크트리·브랜치 후보마다 순차 `gh pr view` 호출, 예: 125-130, 214, 245, 256행) — 이 파일은 이번 리뷰의 4개 대상 파일에 포함되지 않은 **비변경 기존 코드**다.
  - 상세: `plan/in-progress/harness-guard-followups.md` 의 항목 B(`- [ ] B — reaper gh N+1 배치화`)가 이 N+1 을 이미 명시적으로 기록·추적 중이며, `REAP_MIN_INTERVAL`(기본 6h) 스로틀 덕에 매 세션마다 발생하진 않지만 스로틀 만료 후 후보가 쌓이면 SessionStart 를 수 초 블로킹할 수 있다는 위험도 plan 문서 자체가 서술하고 있다.
  - 제안: 이번 diff 에서 손댈 필요 없음(파일 미변경, 범위 밖). 통합 리포트에서 중복 결함으로 재카운트하지 말 것.

## 긍정적 설계 포인트 (참고)

- **캐싱/무효화**: 완료 마커를 `node_modules` **내부**에 둔 설계는 "설치 상태" 캐시와 그 무효화 조건(디렉터리 삭제 = 캐시도 함께 삭제)을 자연스럽게 결합한 좋은 패턴이다.
- **hot path 무회귀**: steady-state(설치 완료 후 매 세션)의 파일시스템 stat 호출 수는 변경 전(`[ -f package.json ] && [ ! -d node_modules ]`, 2회)과 변경 후(`[ -f package.json ] && [ ! -f marker ] && command -v npm`, short-circuit 으로 실질 2회)가 동일하다. `command -v npm` 평가 시점도 마커 부재 시로만 한정되도록 단락 순서가 보존됐다.
- **폴링 없음**: 락 획득 실패(경합 패배) 세션은 재시도 루프 없이 즉시 블록을 스킵한다 — busy-wait/spin 에 의한 CPU 낭비가 없다. 이는 "병렬 세션 전원이 동시에 `npm install` 시도"하던 이전의 잠재적 최악의 경우 대비 개선이다(정확히 한 세션만 비용을 지불).

## 요약

핵심 변경(완료 마커 + `mkdir` 락)은 O(1) 파일 stat 체크와 1회성 `npm install` 로 구성되어 알고리즘적 문제는 없고, steady-state hot path 의 stat 호출 수는 변경 전과 동일하게 유지되어 회귀가 없다. "락을 못 잡은 쪽은 대기 없이 즉시 skip"하는 설계 덕분에 SessionStart 훅을 블로킹시키지 않는 동시성 처리도 적절하다(`test_concurrent_sessions_install_at_most_once` 로 5-프로세스 동시성까지 실증). 다만 "부분 설치를 영원히 신뢰하지 않고 completion marker 로 재검증한다"는 correctness 개선의 반대급부로 두 가지 새 트레이드오프가 생겼다: (1) `npm install` 이 지속적으로 실패하는 환경에서는 매 세션마다 블로킹 재시도가 무제한 반복될 수 있는데, 같은 파일 안에 reaper 용으로 이미 존재하는 스로틀 패턴(`REAP_MIN_INTERVAL`)이 install 재시도 경로에는 적용되지 않았다. (2) 락 탈취 임계값(10분)이 mtime 만으로 판단해, 정상적으로 느린 설치를 크래시로 오인하면 동시 중복 설치 — 이 PR 이 고치려던 바로 그 결함 — 를 좁은 창에서 재발시킬 수 있다. 둘 다 CRITICAL 은 아니다(사용자 트래픽이 아닌 개발자 harness 의 SessionStart 경로에만 영향, blast radius 제한적이고 발생 조건도 좁음)지만, 수정 비용이 낮고(기존 스로틀 패턴 재사용, mtime touch 또는 PID 체크) 재발 시 이번 PR 의 존재 이유 자체를 훼손하므로 반영을 권장한다. 신규 테스트는 npm 을 스텁 처리해 네트워크 I/O 를 배제했고 프로세스 수(5개)도 검증 목적에 합당하나, `subprocess`/`Popen` 호출에 timeout 이 없어 향후 회귀 시 CI 를 무한 대기시킬 위험이 있다. 별도 파일(`reap-merged-worktrees.sh`)의 `gh pr view` 순차 N+1 은 이번 diff 범위 밖이며 plan 문서가 후속 항목(B)으로 이미 추적 중이므로 새 결함으로 잡지 않는다.

## 위험도

MEDIUM
