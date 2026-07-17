# 아키텍처(Architecture) 리뷰 — 하네스 가드 후속 A (bootstrap npm install 경쟁 + 부분 설치 영속)

## 리뷰 대상

- `.claude/tests/test_bootstrap_mermaid_install.py` (신규, 177줄)
- `.claude/tools/bootstrap-session.sh` (SessionStart 부트스트랩, mermaid-lint 설치 섹션 수정 — 실제 파일 33-72행)
- `.gitignore` (락 디렉터리 ignore 패턴 추가)
- `plan/in-progress/harness-guard-followups.md` (계획 문서)

모두 `.claude/` 하네스 자체 도구 계층이며 `codebase/`(제품 코드)는 건드리지 않는다. 애플리케이션
프레젠테이션/비즈니스/데이터 레이어 분리, 도메인 순환 의존성 같은 축은 이 diff 의 관심사가
아니다(해당 없음) — 아래는 인프라·도구 스크립트에 적용 가능한 축(SRP, 재사용성, 모듈 경계,
확장성, 테스트-구현 결합도)에 집중했다. 코드는 `Read` 로 직접 확인한 실제 파일 기준 행 번호를
사용한다(리뷰 payload 문서 자체의 diff 블록 행 번호와는 다르다).

## 발견사항

- **[INFO]** 락/마커("install-once with lease") 로직이 재사용 불가능한 인라인 구현
  - 위치: `.claude/tools/bootstrap-session.sh:33-72` (섹션 2, mermaid-lint 설치)
  - 상세: `mkdir` 원자적 락 + staleness steal(10분) + completion marker 조합은 "SessionStart 시
    1회성 설치를 여러 동시 세션으로부터 안전하게 직렬화"하는, 다른 곳에도 재사용 가능한 패턴이지만
    `bootstrap-session.sh` 안에 `tool_dir` 하나에 특화된 인라인 블록으로만 존재한다. 같은 파일의
    섹션 4(reap)는 로직 전체를 `reap-merged-worktrees.sh` 라는 독립 스크립트로 위임하고 그
    스크립트가 자기 테스트(`test_reap_merged_worktrees.py`)로 격리 검증되는 것과 대비된다. 다만
    `.claude/tools/` 를 직접 확인한 결과(`ls`) `cleanup-worktree.sh`/`ensure-worktree.sh`/
    `plan-stale-audit.sh`/`run-test.sh`/`reap-merged-worktrees.sh` 모두 서로를 `source` 하지 않는
    self-contained 스크립트이고 공유 bash lib 디렉터리(`_lib/` 류)가 없다 — 이는
    `.claude/hooks/_lib`, `.claude/skills/_lib` 등 **Python 쪽에만** 확립된 관례다. 즉 지금
    추출하면 이 계층에 없던 새 컨벤션(공유 bash 헬퍼)을 이번 diff 하나가 만들어내야 하고, 소비처는
    여전히 하나뿐이다.
  - 제안: 조치 불요(Rule of Three 미충족 상태에서 조기 추출은 과설계). 이 락+마커 idiom 이 두
    번째 소비자를 얻는 시점에 `reap-merged-worktrees.sh` 가 보여준 패턴대로 별도 스크립트(+ 전용
    테스트)로 추출을 고려.

- **[INFO]** 신규 테스트의 `REAP_MIN_INTERVAL`/`REAP_GH_BIN` 설정은 실제로는 아무 효과가 없는 죽은
  설정이며, 주석이 그 이유를 잘못 서술한다
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:86-88`(`_run`), `162-163`(동시성 테스트),
    대비 `setUp():40-69`
  - 상세: `setUp()` 은 임시 저장소의 `.claude/tools/` 밑에 `bootstrap-session.sh` 만 복사하고
    `reap-merged-worktrees.sh` 는 두지 않는다. 실행되는 `bootstrap-session.sh` 의 섹션 4 는
    `reaper="$main_root/.claude/tools/reap-merged-worktrees.sh"; if [ -f "$reaper" ]; then …`
    형태라, 파일 자체가 없으므로 이 테스트 스위트에서는 `-f` 체크가 항상 거짓이 되어 reap 호출부가
    아예 실행되지 않는다. 즉 `REAP_MIN_INTERVAL=0`, `REAP_GH_BIN=<존재하지 않는 경로>` 두 줄은
    이 스위트 안에서 어떤 분기에도 영향을 주지 못하는 죽은 설정값이다. `_run()` 옆의 주석
    `# No gh stub → the reaper cannot prove a merge and reaps nothing.` 는 "gh 스텁이 없어서
    reap 이 무력화된다"는 인과를 서술하는데, 실제 인과는 "reaper 스크립트 파일 자체가 트리에
    없어서 그 분기 전체가 스킵된다"이다 — 서술된 메커니즘과 실제 메커니즘이 다르다. 기능적으로는
    무해(마커/락 검증에 영향 없음, 9/9 통과)하지만, 이후 유지보수자가 이 죽은 코드를 근거로 "이
    스위트가 reap 상호작용까지 커버한다"고 오인하거나, `setUp()` 이 언젠가 reaper 스크립트도
    복사하도록 바뀌는 순간 이 두 줄이 갑자기 "살아있는" 코드로 바뀌며 의미가 달라질 수 있다.
  - 제안: 불필요하면 두 env var 와 주석을 제거하거나(가장 단순), 유지한다면 주석을 "reaper
    스크립트가 이 fixture 에 없어 섹션 4 자체가 스킵된다"로 정정. 차단 사유 아님.

- **[INFO]** `_run()` 과 `test_concurrent_sessions_install_at_most_once` 사이의 환경변수 구성 코드
  중복
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:81-90`(`_run`) vs `156-166`(동시성 테스트)
  - 상세: 두 곳 모두 `PATH`/`NPM_CALL_LOG`/`NPM_STUB_FAIL`/`REAP_MIN_INTERVAL`/`REAP_GH_BIN` 5개를
    거의 동일하게 조립한다. 동시성 테스트는 `subprocess.Popen` 을 5개 띄워야 해서 `_run()`
    (`subprocess.run` 1회 고정)을 그대로 재사용하지 못하고 env 조립 코드를 복제했다. 지금은 두
    곳이 일치하지만, `_run()` 쪽에 새 환경변수 시드가 추가되면(예: 향후 섹션이 늘어 새 억제
    변수가 필요해질 때) 동시성 테스트 쪽 반영이 누락되기 쉬운 구조다.
  - 제안: `_env(fail=False)` 헬퍼로 env 딕셔너리 구성만 분리해 `_run()`과 동시성 테스트 양쪽이
    호출하도록 리팩터. 낮은 비용의 DRY 정리이며 차단 사유 아님.

- **[INFO]** stale-lock steal(10분)은 heartbeat 없는 lease 패턴 — 설계상 트레이드오프, 문서화·
  유계(bounded)됨
  - 위치: `.claude/tools/bootstrap-session.sh:59-62`(steal 로직), 주석 48-54
  - 상세: `mkdir` 자체의 원자성(동시 다중 프로세스 중 정확히 하나만 락 획득)은 실측(5-프로세스
    동시성 테스트, `test_concurrent_sessions_install_at_most_once`)으로 검증됐다. 다만 10분 lease
    에는 갱신(heartbeat)이 없다 — 홀더가 크래시하지 않고 실제로 10분을 넘겨 설치 중이면(느린
    네트워크 등, 매우 드묾) 다음 세션이 락을 훔쳐 같은 디렉터리에 동시 `npm install` 을 실행해
    원래 고치려던 경쟁을 이론적으로 재도입할 수 있는 창이 있다. 코드 주석이 "크래시한 홀더"
    가정을 명시하고 실패 결과도 fail-open(린트 비활성)으로 유계돼 있어 무결성 훼손으로 이어지지는
    않는다 — 즉 락의 "상호배제" 계약이 이 타임아웃 경로에서 조건부로 완화된다는 점을 인지한 채
    받아들인 트레이드오프다.
  - 제안: 현행 유지 가능. 필요 시 설치 루프 중 락 디렉터리를 주기적으로 touch 하는 heartbeat 로
    보강할 수 있으나 이 스코프에서는 과설계.

- **[INFO]** `bootstrap-session.sh` 는 이미 4개 책임(①githooks 활성화 ②의존성 설치 ③상태 마커 GC
  ④reaper 위임)을 한 파일에 담는 구조이며, 이번 변경은 그중 ②의 내부 복잡도를 code 6줄에서
  code 15줄 + 주석 20줄로 늘렸다
  - 위치: `.claude/tools/bootstrap-session.sh` 전체(107행), 특히 33-72행
  - 상세: 섹션이 번호로 구분되고 경계가 명확해 응집도 자체는 나쁘지 않으며, 섹션 4(reap)도 이미
    비슷한 길이의 근거 주석 블록을 갖고 있어 이번 변경은 기존 파일 스타일과 일관적이다. 다만
    SessionStart 훅이 `settings.json` 에 단일 파일로 wiring 되는 제약 때문에 책임이 계속 한
    파일에 누적되는 구조이고, 이번 diff 로 그 경향이 한 걸음 더 진행됐다. 새로 도입된 문제는
    아니고 지금 분리가 필요한 규모도 아니다.
  - 제안: 조치 불요. 5번째 책임이 추가되는 시점에 `.claude/tools/bootstrap/*.sh` 로 쪼개고
    `bootstrap-session.sh` 를 얇은 디스패처로 만드는 리팩터를 검토.

## 참고 (발견사항 아님 — 설계가 적절히 적용된 지점)

- 완료 마커를 `node_modules/` **내부**에 둔 것은 "트리를 지우면 마커도 같이 지워진다"는 자기치유
  커플링을 의도적으로 만든 설계다. 두 상태(설치 결과물·완료 여부)를 별도 위치에 두고 동기화를
  신경 쓰는 대신 물리적으로 묶어 동기화 문제 자체를 제거했다 — 적절한 응집도 판단.
- `flock` 대신 `mkdir` 기반 락을 택한 근거(macOS 에 `flock` 부재)는 이 저장소 다른 스크립트들의
  이식성 판단과 결이 같다.
- "stale-lock 탈취" 단계 자체는 비원자적이지만(두 프로세스가 동시에 stale 로 판단할 수 있음),
  실제 상호배제는 그 뒤의 `mkdir` 원자성에서만 보장되도록 책임이 분리돼 있어 이 비원자성이
  안전성 결함으로 이어지지 않는다.
- `guard_default_branch_bash.py`/`guard_review_before_push.py` 의 서브커맨드 판정 로직 중복(같은
  plan 문서 항목 C, 이전 리뷰 라운드 발견)은 이번 diff 범위 밖 파일이며, plan 문서가 "② 재설계
  확정 전 단독 추출은 비권장"이라는 근거로 명시적으로 defer 하고 있다 — 이번 코드 변경이 새로운
  아키텍처 회귀를 추가하지 않았음을 확인.
- 순환 의존성 없음: `bootstrap-session.sh → reap-merged-worktrees.sh` 단방향 호출만 존재하고
  이번 diff 로 신규 의존 방향이 추가되지 않았다.
- `.gitignore` 의 `.claude/tools/mermaid-lint/.install.lock/`(trailing slash, 디렉터리 전용 매치)
  은 `mkdir` 락의 실제 형태(항상 디렉터리)와 정확히 일치한다.
- CI 배선 갭 없음: `.github/workflows/harness-checks.yml` 이 `.claude/tools/**` + `.claude/tests/**`
  경로를 트리거로 갖고 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 신규
  테스트 파일을 별도 등록 없이 자동 편입한다(직접 확인).

## 요약

이번 변경은 `.claude/` 하네스 전용 SessionStart 스크립트에 국한된 인프라 패치로, 애플리케이션
레이어링·순환 의존성·인터페이스 분리 같은 축은 대체로 해당 사항이 없다. 핵심 구조(완료 마커를
`node_modules` 안에 두어 트리 삭제 시 자동 무효화, `mkdir` 원자적 락 + skip-not-wait, 크래시
홀더 락의 유계된 stale steal)는 명확한 문제 정의에서 도출된 적절한 동시성 패턴이며, 기존
`.claude/tools/` 의 self-contained 스크립트 관례 및 `bootstrap-session.sh` 자체의 번호-섹션
스타일과 결합도·응집도 면에서 일관적이다. 새 테스트는 `bash` 서브프로세스를 실제로 실행하는
통합 테스트로 임시 git repo 안에서 격리되어 부작용이 없고 CI 에도 자동 편입된다. 발견된 사항은
모두 INFO 수준이며 실질 위험은 없다: (1) 락+마커 로직이 재사용 불가능한 인라인 구현이지만 이
계층엔 공유 bash lib 관례 자체가 없어 지금 추출은 과설계, (2) 테스트의 `REAP_MIN_INTERVAL`/
`REAP_GH_BIN` 두 줄이 실제로는 죽은 설정이고 그 옆 주석이 실제와 다른 인과를 서술, (3)
`_run()`과 동시성 테스트 간 env 조립 코드 중복, (4) stale-lock steal 이 heartbeat 없는 lease 라
매우 느린(비크래시) 설치에 대해 상호배제 계약을 조건부로 완화하는 이론적 창, (5) 오케스트레이터
파일에 책임이 계속 누적되는 기존 경향(이번 diff 로 한 걸음 진행, 새로운 문제 아님). 동봉된 plan
문서가 이번 PR 범위를 "A" 항목 하나로 명확히 한정하고 연관 리팩터(항목 C)를 설계 결정 선행을
이유로 의도적으로 defer 한 점도 PR 단위 단일 책임을 잘 지킨 판단으로 평가한다.

## 위험도

LOW
