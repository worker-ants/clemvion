# 동시성(Concurrency) 코드 리뷰

리뷰 대상: `.claude/tools/bootstrap-session.sh` (mermaid-lint 설치 가드, 락 liveness 보강판) +
`.claude/hooks/_lib/mermaid_lint_ready.py` + `.claude/hooks/lint_mermaid_posttooluse.py` +
`.githooks/pre-commit` + 두 테스트 파일.

> 사전 확인: 이 세션은 `review/code/2026/07/17/20_06_45`(직전 라운드, MEDIUM)의 WARNING #1
> ("순수 경과 시간 탈취" — 실측 재현됨)을 owner-aware liveness 로 고친 커밋(`d31f99a11`)
> 직후의 재검토다. 아래 발견사항은 그 커밋을 반영한 **현재** 코드 기준이며, 직전 라운드가
> 이미 발견·수용한 항목은 새로 문제 삼지 않고 "잔존 확인"으로만 표기했다.

## 발견사항

### [WARNING] `npm install` 호출에 타임아웃이 없어 "멈춘"(크래시도 실패도 아닌) 설치가 세션을 무기한 블로킹할 수 있음 — 파일이 반복 선언하는 "must never block a session" 불변식과 충돌

- 위치: `.claude/tools/bootstrap-session.sh:115` (`if (cd "$tool_dir" && npm install --no-fund --no-audit --silent); then`)
- 상세: 이 라인은 npm 프로세스가 (성공이든 실패든) 종료할 때까지 완전히 동기적으로 블로킹된다.
  크래시·명시적 실패(네트워크 다운 → exit 1)는 else 분기(118-120행) + `fail_marker` 쓰로틀로
  잘 처리되지만, **종료하지 않고 멈추는** 경우(프록시가 응답 없이 커넥션만 유지, 일부
  postinstall 라이프사이클 스크립트가 무언가를 기다리며 블로킹, DNS 재시도 루프 등)는
  별도 처리가 없다. 파일 헤더 6-7행과 52-53행 주석 모두 "bootstrap must never block a
  session" 을 명시적 불변식으로 반복 선언하지만, 이 라인만은 그 불변식에 대한 방어가 없다.
  반면 같은 기능군의 자매 파일 `.claude/hooks/lint_mermaid_posttooluse.py:140,217-226` 은
  정확히 같은 계열의 위험("a hung linter must never wedge the PostToolUse hook")에 대해
  `timeout=_NODE_TIMEOUT`(20초)로 명시적으로 대비했다 — 두 서브프로세스 호출 간 비대칭이다.
  이 락을 획득한(mkdir 성공) 세션만 멈추므로 블라스트 반경은 그 세션 하나로 제한되지만
  (다른 세션은 112행 `mkdir` 실패로 즉시 skip, 대기하지 않음), 그 세션은 `exit 0`(163행)에
  도달하지 못하고 락도 해제되지 않는다 — 그리고 liveness 판정 관점에서는 그 프로세스가
  실제로 아직 살아있는 것이 **맞으므로**, 다른 세션의 탈취도 정상적으로 거부된다. 즉 이
  하나의 멈춘 프로세스가 스스로 죽거나 사용자가 개입할 때까지, 저장소 전체에서
  mermaid-lint 설치가 진행되지 않는다.
- 제안: `npm install` 호출을 유한 타임아웃으로 감쌀 것. 다만 이 파일이 `flock` 대신
  `mkdir` 을 택한 이유("macOS 에 없음", 50-51행)와 동일하게, macOS 기본 BSD userland에는
  GNU coreutils 의 `timeout` 커맨드도 기본 탑재되어 있지 않다는 점을 함께 고려해야 한다 —
  `command -v timeout`(또는 `gtimeout`)로 존재를 확인 후 사용하거나, 백그라운드 실행 +
  `sleep N && kill` 워처 패턴으로 이식성 있게 구현할 것. 최소한 이 잔여 위험을 주석과
  `plan/in-progress/harness-guard-followups.md` 에 알려진 한계로 남길 것.

### [WARNING] 새 liveness 판정이 PID 재사용(ABA)에 노출 — 진짜로 죽은 홀더가 "살아있음"으로 오판되어 락이 정체될 수 있음(방금 고친 결함의 반대 방향)

- 위치: `.claude/tools/bootstrap-session.sh:96-104`(`_lock_is_dead`, 특히 102행
  `! kill -0 "$owner"`)
- 상세: 직전 라운드가 고친 WARNING #1 은 "죽지 않았는데 죽었다고 오판"(살아있지만 느린
  홀더의 락이 탈취됨) 방향이었다. 이번 구현이 생존 판정을 `kill -0` 단독에 의존하면서,
  **정반대 방향의 오판**이 새로 생겼다: 진짜로 죽은 홀더(크래시)의 PID 번호가, 다음
  세션이 탈취를 시도하기 전에 OS 에 의해 **완전히 무관한 다른 프로세스**로 재할당되면,
  `kill -0 "$owner"` 는 그 무관한 프로세스를 찾아 성공을 반환하고 `_lock_is_dead` 는
  거짓(= 살아있음)을 반환한다 — 원래 홀더는 이미 죽었는데도 그 무관한 프로세스가 스스로
  종료할 때까지 락은 "살아있는 것"으로 취급되어 재획득되지 않는다. 94-95행 주석
  ("better to reclaim an unlabelled stale lock eventually than wedge forever")은 "영구
  정체 방지"를 명시적 설계 목표로 삼지만, 이 목표는 "라벨이 없는" 락에만 적용되고
  "라벨은 있으나 그 PID 가 재사용된" 락에는 적용되지 않는다. 55-57행 헤더 주석("a PID
  freshly reused by an unrelated process is not trusted on its own")도 유사한 문구를
  담고 있지만, 실제 코드에는 PID 외의 추가 식별자(시작 시각·세션 nonce 등) 대조 로직이
  없다 — grace age 는 "방금 만들어진 락"과 "탈취 직후 재획득된 락"을 구분하는 데는
  정확히 기여하지만(자체 문서화된 대로), "오래전에 죽은 홀더의 PID 가 나중에 재사용"되는
  경우는 grace age 통과 이후 `kill -0` 단독 판정이라 보호되지 않는다.
- 완화 요인: (a) 실패 방향이 안전하다 — 오판의 결과는 "install 을 하지 않음"(fail-open,
  기존 설계 철학과 일치)이지 이중 설치·손상이 아니다. (b) `test_dead_pid_lock_is_stolen`/
  `test_live_but_slow_lock_is_not_stolen_even_when_aged` 두 테스트 모두, 정의상 매우 짧은
  실행 창에서 특정 PID 가 재사용되지 않는다는 동일한 가정에 실질적으로 의존한다 — 이
  가정이 깨지면 코드뿐 아니라 이를 검증하는 테스트 자체도 (드물게) flake 할 잠재력이
  있다는 뜻이다. (c) macOS(이 저장소가 명시하는 환경)는 프로세스별 PID 네임스페이스가
  없는 단일 전역 PID 공간이라, 재사용 창은 "그 정확한 PID 번호가 grace 기간(기본
  10분) 경과 후의 짧은 확인 순간에 우연히 재사용"되어야 하므로 확률은 낮다.
- 제안: 소유자 식별을 PID 단독이 아니라 (PID, 프로세스 시작 시각) 쌍으로 기록해 `ps -o
  lstart=`/`etime=` 등으로 재사용을 구분하거나, 최소한 이 잔여 위험(반대 방향의 ABA
  락-정체)을 `_lock_is_dead` 근처 주석에 known limitation 으로 명시할 것. 심각도가 낮고
  자가치유(무관 프로세스 종료 시 해소)되므로 즉시 수정이 필수는 아니나, 문서화는 권장.

### [INFO] 락 탈취 경로의 이론적 TOCTOU — 직전 라운드에서 이미 발견·평가·수용됨, 이번 수정으로 형태 불변(잔존 확인만)

- 위치: 111-112행 (`_lock_is_dead && rm -rf "$lock" 2>/dev/null` 이후 별도 statement 로
  `mkdir "$lock"`)
- 상세: "죽었다" 판정과 삭제 사이, 삭제와 재생성 사이에 원자성이 없다 — 두 세션이 동시에
  같은 죽은 락을 관찰하면, 이론상 한쪽의 `rm -rf` 가 다른 쪽이 그 사이 재획득한 새 락을
  지우고 그 직후 자신의 `mkdir` 로 재생성해, 두 세션 모두 `npm install` 을 동시에 실행하는
  시나리오가 코드 형태상 완전히 배제되지는 않는다. 다만 이는 **이미 직전 라운드
  (`review/code/2026/07/17/20_06_45/concurrency.md` WARNING #7, `RESOLUTION.md` #7)에서
  발견되어 "600회 스트레스로도 재현 못 함, 최악 영향은 중복 재설치 1회뿐"이라는 근거로
  의도적으로 미조치 결정**됐고, 이번 커밋은 그 형태 자체를 바꾸지 않았다(다만 "죽었다"
  판정 자체는 liveness 로 더 정교해져 실질 창은 이미 좁아졌다). 새로운 위험 추가 없음.
- 제안: 추가 조치 불필요(기존 결정 유지 권장). 향후 이 경로를 다시 건드릴 기회가 있으면
  재검토.

### [INFO] `lock_grace / 60` 정수 나눗셈이 분 단위 미만 정밀도를 버림 — 기본값엔 무해, 60초 미만 커스텀 설정 시 나이 게이트가 사실상 무력화될 수 있음

- 위치: 98행 (`find "$lock" -maxdepth 0 -mmin "-$(( lock_grace / 60 ))"`)
- 상세: 기본값 600(10분)은 정확히 나눠떨어지지만, `MERMAID_INSTALL_LOCK_GRACE_SEC` 를 60
  미만(예: 30)으로 설정하면 `30/60=0`(bash 정수 나눗셈)이 되어 `-mmin -0` 이 되고, 이는
  "0분 미만 경과"라는 사실상 항상-거짓에 가까운 조건이 되어 방금 생성된 락도 나이
  게이트를 그냥 통과할 수 있다 — 그 경우 86-95행이 서술하는 "just-reacquired lock is
  always young and thus safe from a second stealer" 불변식이 나이 게이트가 아니라
  liveness 체크(방금 만든 락은 owner 가 자신이므로 `kill -0` 로는 여전히 보호됨) 단독에만
  의존하게 되어, 설계된 이중 방어 중 하나가 이 커스텀 설정 하에서 약해진다.
- 제안: 기본값만 쓰는 한 실무 영향 없음(우선순위 낮음). 분 단위 절삭이 싫다면
  `find -newermt "@$(( $(date +%s) - lock_grace ))"` 류로 초 단위 정밀도를 유지할 수 있다.

### [INFO] owner 파일 기록 실패가 조용히 "라벨 없음"으로 폴백 — liveness 보장이 그 한 줄의 성공에 암묵적으로 의존

- 위치: 113행 (`echo "$$" > "$lock/owner" 2>/dev/null || true`)
- 상세: 이 쓰기가 실패하면(디스크 포화 등 극히 드문 경우) 락 디렉터리는 "라벨 없음"
  상태로 남고, grace 경과 후에는 100-101행의 `''|*[!0-9]*) return 0` 분기에 따라 "생존
  여부와 무관하게 나이만으로" 탈취 가능해진다 — 즉 이번 라운드가 고치려던 "나이만으로
  판정"(WARNING #1 의 근본 원인) 상태로 이 좁은 경로에서만 되돌아간다. 94-95행 주석은
  "라벨 없는 락은 나이만으로 판정"을 의도된 설계로 명시하므로 버그는 아니지만, liveness
  보장의 전제(owner 파일 기록 성공)가 암묵적이라는 점은 기록해둘 가치가 있다.
- 제안: 우선순위 낮음(재현·영향 모두 극히 낮음). 필요하면 owner 쓰기 실패 시 즉시
  설치를 포기하고 락을 해제하는 방어를 추가할 수 있으나 Rule-of-Three 상 과설계 소지가
  있다.

## 요약

이번 라운드는 직전 리뷰(20_06_45)의 핵심 WARNING #1(순수 경과 시간만으로 탈취 →
살아있는 홀더의 락도 도둑맞아 동일 트리에 npm install 이 중복 실행되던, 실측 재현된
결함)을 owner PID 기록 + `kill -0` 생존 확인 + grace age 이중 게이트로 교체해 올바르게
고쳤다 — 코드 검토와 회귀 테스트(`test_live_but_slow_lock_is_not_stolen_even_when_aged`,
직전 RESOLUTION 이 기록한 뮤테이션 테스트로 non-vacuity 까지 확인됨) 모두 이를
뒷받침한다. 콜드스타트 상호배제(5개 동시 세션 스트레스 테스트)는 여전히 `mkdir`
원자성에 정확히 의존해 올바르다. 다만 이번 수정 자체가 두 개의 새로운, 그러나 이전
것보다 심각도가 낮은 잔여 위험을 남긴다: (1) `npm install` 호출 자체에는 여전히
타임아웃이 없어 "멈춘"(크래시도 실패도 아닌) 설치가 그 세션의 SessionStart 를 무기한
블로킹할 수 있다 — 같은 PR 의 node 린터 서브프로세스 호출은 정확히 이 위험에 대비해
20초 타임아웃을 뒀는데 이 비대칭이 눈에 띈다. (2) 새 liveness 체크는 PID 재사용(ABA)에
노출되어, 진짜로 죽은 홀더의 PID 가 나중에 무관한 프로세스에 재할당되면 락이 "살아있는
것"으로 오판되어 그 무관 프로세스가 종료할 때까지 정체될 수 있다 — 이는 방금 고친
결함의 정반대 방향이다. 두 위험 모두 실패 방향이 안전하고(설치를 안 함/스킵이지 손상·
중복 설치가 아님) 발생 확률이 낮지만, 파일이 반복 명시하는 "bootstrap must never block
a session" 불변식과 직접 충돌하므로 문서화하거나 고칠 가치가 있다. 그 밖에 직전
라운드가 이미 발견·수용한 이론적 TOCTOU(탈취 경로의 check-then-act 비원자성)는 형태가
그대로 남아있으나 이미 근거와 함께 미조치로 결정된 사안이라 새로운 조치를 요구하지
않는다.

## 위험도

MEDIUM
