# 보안(Security) 리뷰 — bootstrap mermaid-lint install 락 제거 (review/code/2026/07/18/10_55_35)

## 리뷰 대상 및 방법

1. `.claude/tools/bootstrap-session.sh`
2. `.claude/tests/test_bootstrap_mermaid_install.py`
3. `.githooks/pre-commit`
4. `.claude/tests/README.md`

4개 파일 모두 로컬 개발 하네스(SessionStart 부트스트랩, git pre-commit hook, 그 테스트/문서)로,
외부 네트워크 요청을 받는 서비스가 아니고 사용자 데이터를 다루지 않는다. 이번 커밋
(`a16d80290`, "mermaid 설치 락 제거 — 마커-only 로 전환")은 review/code/2026/07/18/02_06_42 C1
(3-way 로 실측 재현된 stale-lock 탈취 TOCTOU)을 고치기 위해 손수 짠 `mkdir` 락 apparatus 전체
(owner PID·grace·steal·해제)를 삭제하고 완료 마커 + 실패 throttle 만 남기는 축소 diff다. `git show
a16d80290`로 실제 hunk 를 확인하고, 이전 두 라운드(00_59_56, 02_06_42)의 `security.md` 를 대조해
(a) 이 축소가 새 취약점을 만드는지, (b) 기존에 이미 추적 중인 항목의 상태가 이 diff 로 바뀌는지를
기준으로 평가했다.

## 발견사항

- **[INFO]** 락 제거로 "npm install 이 멈추면(hang) 세션 블로킹 영향 범위가 1→N으로 확대"되나 새
  설계 주석의 "Residual, accepted" 목록에는 그 시나리오가 빠져 있음
  - 위치: `.claude/tools/bootstrap-session.sh:56-72`(신설 "NO LOCK, deliberately" 설계 주석),
    `:87-97`(`npm install` 실행 블록)
  - 상세: 삭제된 구 주석은 "no timeout wraps this npm install ... Blast radius is scoped to the
    one session holding the lock: every other concurrent session's mkdir fails immediately and
    skips"라고 명시했었다 — 즉 npm install 이 멈춰도(막힌 레지스트리 연결 등) 영향은 락을 쥔 세션
    1개로 국한됐다. 이번 diff 로 락이 사라지면서 콜드 체크아웃에서 동시에 SessionStart 하는 세션은
    **전부** `if [ -f "$tool_dir/package.json" ] && [ ! -f "$marker" ] && ! _install_throttled ...`
    블록에 동시 진입해 각자 `npm install` 서브셸을 연다. npm install 을 감싸는 timeout 은 여전히
    없으므로(이전부터 알려졌던 한계, 이번에도 미해결), 레지스트리가 멈추면 경쟁하던 세션 전부가 각자
    블록될 수 있다 — 파일 헤더의 명시적 불변식("Always exits 0 — bootstrap must never block a
    session.")이 걸리는 세션 수가 이전보다 넓어진 것이다. 다만 (1) 이 불변식은 락이 있던 이전
    버전에서도 이미 "락 보유 세션 1개"에 대해서는 깨질 수 있었다 — 이번 diff 가 만드는 건 새 유형의
    위반이 아니라 기존에 가능했던 위반의 대상 세션 수 확대다. (2) npm 자신도 요청/재시도에 내부
    timeout 을 두므로 실제로는 "무기한"보다는 "각 세션이 npm 의 재시도 예산만큼 오래" 블록되는
    쪽에 가깝다. (3) 새로 쓰인 "Residual, accepted" 단락은 "corrupt-but-marked node_modules"(트리
    오염) 잔여 리스크는 상세히 다루지만 이 hang 확산 시나리오는 다루지 않는다 — side_effect.md 가
    이미 짚은 "동시 쓰기 보호 제거는 잘 문서화된 트레이드오프"라는 평가는 트리 오염 축에는 맞지만,
    hang 축은 아직 그 문서화 범위 밖이다.
  - 제안: 설계 주석의 "Residual, accepted" 목록에 "여러 세션이 첫 cold install 순간에 각자
    hang 될 수 있다(각 세션은 npm 자신의 timeout/재시도 예산만큼 블록)"를 한 줄 추가해 트레이드오프
    서술을 완전하게 하거나, plan §A 후속에 "N-세션 hang 확대" 항목을 명시적으로 등록. 코드 변경(예:
    가벼운 watchdog)은 필수는 아니며, 이미 §G 에 `fcntl.flock` 대안이 언급되어 있으므로 우선순위는
    낮음.

- **[INFO]** `npm install --no-fund --no-audit --silent` 로 설치 시점 취약점 감사 생략 — 기존 추적
  항목, 이번 diff 로 상태 불변
  - 위치: `.claude/tools/bootstrap-session.sh:90`
  - 상세: 이 줄은 이번 diff 에서 문자 그대로 유지됐다(락 apparatus 제거로 인한 들여쓰기만 변경).
    review/code/2026/07/18/00_59_56 및 02_06_42 의 `security.md` 가 이미 INFO 로 기록한 항목:
    `--no-audit` 가 설치 시점 npm 취약점 경고를 억제해 mermaid-lint 의존성 트리에 알려진 취약점이
    생겨도 신호가 없다. 로컬 개발 전용 린트 도구(프로덕션 런타임 아님)라 blast radius 는 제한적.
  - 제안: 새 조치 불요(이미 추적 중). 재확인 차 기록.

- **[INFO]** 버전관리된 git hook 자동 활성화 = 공급망 신뢰 경계 — 기존 WARNING, 이번 diff 로 표면
  불변
  - 위치: `.claude/tools/bootstrap-session.sh:25-32`(`git config core.hooksPath .githooks` 자동 설정),
    `.githooks/pre-commit` 전체
  - 상세: review/code/2026/07/18/00_59_56 의 `security.md` 가 이미 WARNING 으로 기록한 항목(사용자
    확인 없이 SessionStart 시점에 `.githooks` 를 자동 활성화하고, 그 안에서 `npm install` 을 무인
    실행하는 구조 — 이 파일들 또는 그 전이 의존성이 오염되면 다음 세션 시작/커밋 시점에 로컬에서
    임의 코드가 실행될 수 있는 경로). 이번 diff 는 그 안의 동시성 제어(락)만 재작업했을 뿐 이
    표면 자체를 넓히거나 좁히지 않는다.
  - 제안: 새 조치 불요. 이 라운드가 만든 문제가 아님을 재확인 차 기록.

- **[해소, 조치 불요]** 이전 INFO(PID 재사용/ABA 로 인한 lock-steal 오탐)는 대상 코드가 삭제되며
  moot
  - 위치: (삭제됨) 구 `.claude/tools/bootstrap-session.sh` 의 `_lock_is_dead()` — review/code/
    2026/07/18/02_06_42 `security.md` 가 INFO 로 기록했던 항목.
  - 상세: 이번 diff 가 `_lock_is_dead()` 함수와 그 호출부(락 전체 apparatus)를 완전히 삭제했으므로
    그 안에 있던 PID 재사용 취약 판정 로직도 코드베이스에서 함께 사라졌다. `grep -rn
    "_lock_is_dead\|\.install\.lock\|MERMAID_INSTALL_LOCK_GRACE_SEC"` 로 코드/테스트/CI 전체에
    dangling 참조가 없음을 확인했다(과거 리뷰 산출물 텍스트에만 남아 있고 실행 경로에는 없음).
  - 제안: 없음.

## 확인된 견고한 지점 (긍정 관찰)

- 하드코딩된 API 키/비밀번호/토큰/인증서: 4개 파일 전체에서 발견되지 않음.
- 테스트 파일의 모든 `subprocess.run`/`Popen` 호출이 list-argv 이고 `shell=True`/`eval` 미사용 —
  파일 경로·PID·env 값에 셸 메타문자가 섞여도 인젝션이 발생하지 않는다. 락 관련 테스트 9건이
  삭제됐지만 남은/신설 테스트도 동일 패턴을 유지한다.
- `.githooks/pre-commit` 의 스테이지 파일 목록은 `git diff --cached --name-only -z` + NUL 구분
  읽기로 처리되어 공백·개행이 포함된 파일명에도 word-splitting 인젝션이 없음 — 이번 diff 는 이
  로직을 건드리지 않는다(헤더 주석 1줄 추가뿐).
- `bash "$reaper" ${anchor:+--keep "$anchor"}` 의 `"$anchor"` 는 `${var:+word}` 확장 안에서
  따옴표로 보호돼 word-splitting 에 안전한 표준 bash "옵션 인자" 관용구다.
- `set -u` 로 미정의 변수 참조 시 에러가 나는 조건에서, 락 관련 변수(`$lock`, `$lock_grace`) 참조가
  삭제 후 코드 어디에도 남아있지 않음을 직접 grep 으로 확인(dangling reference 없음).
- 에러 메시지(`bootstrap: mermaid-lint install failed …`, pre-commit 의 abort 메시지)는 일반화된
  문구만 stderr 로 출력하며 크리덴셜·내부 경로·스택트레이스 등 민감정보를 노출하지 않는다.
- `BYPASS_DEFAULT_BRANCH_GUARD` 등 env 오버라이드는 이미 로컬 셸 실행 권한을 가진 행위자만 설정
  가능해 별도 권한 상승 경로를 열지 않으며, git hook 자체가 `--no-verify` 로 우회 가능한 클라이언트
  사이드 계층임을 주석이 이미 인지하고 있어 이번 diff 가 새로운 인가 우회를 만들지 않는다.
- SQL/LDAP 인젝션, XSS, 경로 탐색, 안전하지 않은 해시/암호화, 평문 자격증명 전송: 4개 파일 모두
  DB·웹 렌더링·인증·암호화 로직이 없어 해당 사항 없음.
- `.claude/tests/README.md` 변경은 표 한 행의 서술 갱신뿐으로 보안 표면과 무관하다.

## 요약

이번 diff(`a16d80290`)는 직전 라운드(02_06_42 C1)에서 3-way 로 실측 재현된 stale-lock 탈취
TOCTOU 를 고치기 위해 손수 짠 `mkdir` 락 apparatus 전체를 삭제하고 완료 마커 + 실패 throttle 만
남기는 축소 diff로, 새로운 인젝션·하드코딩 시크릿·인증/인가·암호화 결함을 도입하지 않았고 이전
두 라운드가 이미 INFO/WARNING 으로 추적해 온 항목(`--no-audit`, 자동 hook 활성화의 공급망 신뢰
경계)의 상태도 바꾸지 않는다. 오히려 그 TOCTOU 자체는 로컬 단일 신뢰 경계 내 자기-경합이라 애초에
고전적 보안 취약점보다 신뢰성 결함에 가까웠고, 안전 논증이 라운드마다 반증되던 손수 짠 락을
계속 하드닝하는 대신 제거한 이번 결정은 공격/버그 표면을 순수하게 줄이는 방향이다. 유일하게
새로 짚을 점은, 락 제거로 "npm install 이 멈추면 세션이 블록"되는 기존에 알려졌던(그러나 고쳐지지
않았던) 한계의 영향 범위가 세션 1개에서 동시 콜드스타트 세션 전체로 넓어졌는데, 새로 작성된
"Residual, accepted" 서술에는 트리 오염 리스크만 있고 이 hang 확대 시나리오는 빠져 있다는
것이다 — 코드 변경을 요구할 정도는 아니라 INFO 로 기록했다. CRITICAL/HIGH/WARNING 급 결함은
없다.

## 위험도

LOW
