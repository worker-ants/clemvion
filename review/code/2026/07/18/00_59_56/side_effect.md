# Side Effect Review — mermaid-lint 락 liveness·throttle·공유 readiness SoT (자기리뷰 보강 3건)

리뷰 대상은 6개 파일(전체 컨텍스트) 이지만, `git diff bbf72268e..d31f99a11`(직전 라운드
`review/code/2026/07/17/20_06_45` 리뷰 이후의 "자기리뷰 보강 3건" 커밋)로 실제 변경분을 확인하고,
`.claude/hooks/_lib/mermaid_lint_ready.py`(신설)를 실행/임포트해 주장을 코드 대조 + 실측으로
검증했다.

## 발견사항

- **[WARNING]** `lint_mermaid_posttooluse.py` 가 출력하는 "미설치" 안내 메시지가 새로 도입된
  마커 기반 판정 기준과 어긋난다 — 안내를 그대로 따라도 문제가 해결되지 않는다 (실측 확인)
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:198,204-205` (`is_ready(tool_dir)` 판정 →
    `"mermaid-lint: skipped ... Run: (cd .claude/tools/mermaid-lint && npm install)"`),
    `.claude/hooks/_lib/mermaid_lint_ready.py:60-72` (`MARKER_NAME`/`marker_path`/`is_ready`),
    `.claude/tools/bootstrap-session.sh:106-116` (마커는 **bootstrap 자신의 설치 분기만** 기록)
  - 상세: `is_ready()` 는 이제 "`node_modules` 존재 AND `node_modules/.bootstrap-install-complete`
    존재"를 요구한다. 그런데 이 마커는 `bootstrap-session.sh` 의 설치 분기(`: > "$marker"`,
    116행)에서만 기록되고, 사용자가 훅이 안내하는 그대로 `cd .claude/tools/mermaid-lint && npm
    install` 을 수동 실행해도 마커는 생기지 않는다. 실제로 재현: `node_modules/` 를 실제 npm
    install 처럼 채운 뒤 `is_ready(tool_dir)` 를 호출하면 `False` 를 반환한다(아래 검증 커맨드).
    즉 사용자가 stderr 메시지를 보고 그대로 따라 해도 다음 Write/Edit 에서 동일한 "tooling deps
    not installed" 메시지를 다시 보게 되어, 문제가 실제로는 "이미 설치됨, 마커만 없음" 인데
    사용자에게는 "설치가 안 됐다"는 잘못된 원인으로 반복 안내된다. `.githooks/pre-commit` 쪽은
    같은 조건에서 아무 메시지도 출력하지 않아(단순 skip) 사용자가 원인을 추적할 단서 자체가
    없다는 점에서 증상은 더 조용하지만 동일하다. 실제로는 다음 SessionStart 에서
    `bootstrap-session.sh` 가 (이미 존재하는 `node_modules` 위에 한 번 더) `npm install` 을 돌리고
    마커를 남겨야 해소되며, 이는 "설치 안 됨" 메시지가 가리키는 명령과 다른 경로다. 이 불일치는
    직전 라운드에서 새로 도입한 마커 판정 자체가 만든 트레이드오프이며, 해당 메시지 문자열은
    어느 테스트로도 pin 되어 있지 않아(grep 결과 `test_mermaid_lint_ready.py`/
    `test_bootstrap_mermaid_install.py` 어디에도 이 문자열 검증 없음) 회귀 감지망이 없다.
    영향 범위: 이 기능을 새로 받아들이는 모든 기존 워크트리/클론이 첫 `bootstrap` 실행 전까지
    거치는, 결코 드물지 않은 전환 구간에서 발현 가능. Fail-open 이라 커밋 차단·오탐 린트로는
    이어지지 않고 다음 세션에서 자가치유되지만, 그 사이 사용자가 안내를 신뢰해 반복 재설치를
    시도하며 시간을 낭비할 수 있다.
  - 검증 커맨드(재현):
    `python3 -c "import sys,os,tempfile; sys.path.insert(0,'.claude/hooks/_lib'); from
    mermaid_lint_ready import is_ready; d=tempfile.mkdtemp(); td=os.path.join(d,'x');
    os.makedirs(os.path.join(td,'node_modules','mermaid')); print(is_ready(td))"` → `False`.
  - 제안: 메시지를 "이 저장소의 npm install 만으로는 해소되지 않음" 을 반영해 정정 —
    ① `.claude/tools/bootstrap-session.sh` 실행(또는 새 세션 시작)을 안내하거나,
    ② 두 소비처가 공유하는 안내 문자열을 `mermaid_lint_ready.py` 쪽에 상수로 옮겨 마커 경로가
    바뀌어도 메시지가 따로 drift 하지 않게 하거나,
    ③ 최소한 "수동 npm install 만으로는 마커가 찍히지 않으니 다음 세션까지 기다리거나
    `bootstrap-session.sh` 를 직접 실행하라"는 문구를 덧붙인다. 메시지 문자열을 테스트로 pin 해
    이번 같은 drift 를 회귀 감지 가능하게 만드는 것도 권장.

- **[INFO]** 신규 "소유권 검증 후 락 해제" 로직이 `owner` 파일 쓰기 실패 시 자기 세션조차 자기
  락을 못 지우는 좁은 경로를 새로 들여왔다 (저확률·저영향, 구코드에는 없던 경로)
  - 위치: `.claude/tools/bootstrap-session.sh:112-126`
  - 상세: `mkdir "$lock"` 직후 `echo "$$" > "$lock/owner" 2>/dev/null || true` 로 소유자를
    기록하는데, 이 쓰기 자체가 실패(디스크 풀 등 극단적 fs 오류)하면 이후 해제부
    `[ "$(cat "$lock/owner" ...)" = "$$" ] && rm -rf "$lock"` 비교가 항상 거짓이 되어, 방금 설치를
    마친(그리고 마커까지 정상 기록한) 세션조차 자기 락을 지우지 못한다. `npm install`/마커 기록은
    `owner` 파일과 별개 커맨드라 이 경우에도 정상 성공·마커 생성이 가능하므로, 이후 세션들은
    `[ ! -f "$marker" ]` 가드를 통과하지 못해 이 잔존 락을 다시 들여다볼 기회가 없다 — 마커가
    지워질 때(예: `node_modules` 재설치)까지 `.install.lock/` 이 무기한 남는다. 다만 이미
    `.gitignore` 로 제외돼 있어 추적 오염은 없고, 마커가 지워지는 시점엔 나이+사망PID 조건으로
    결국 회수되므로 실 피해는 "빈 디렉터리 잔존" 수준이다. 구버전(`rmdir "$lock" 2>/dev/null ||
    true`, 소유권 무관 무조건 해제)에는 없던 경로로, 이번 라운드의 "소유권 검증" 강화(RESOLUTION
    #1)가 트레이드오프로 들여온 것.
  - 제안: 우선순위 낮음. 필요 시 `echo "$$" > "$lock/owner"` 실패 시 stderr 경고 한 줄만 추가.

- **[INFO]** `pre-commit` guard 2 가 커밋마다 `python3` 서브프로세스 1회를 추가로 생성 — 로컬
  전용·무해, 신규 외부 의존성 아님
  - 위치: `.githooks/pre-commit:52` (`python3 "$mermaid_ready" "$mermaid_tool_dir"`)
  - 상세: 이전엔 `[ -d "$mermaid_tool_dir/node_modules" ]` bash 내장 테스트만으로 게이트를
    판단했으나, 공유 SoT 도입으로 프로세스를 기동해 호출한다. 파일시스템 stat 만 수행하는
    읽기전용 로컬 호출이며 네트워크 없음. `python3` 부재 시에도 fail-open(guard 2 skip, exit 0)
    이며, 같은 파일 guard 1(`branch_guard.py`) 이 이미 무조건 `python3` 를 호출하므로 이 변경이
    새 외부 의존성을 추가하는 것도 아니다.
  - 제안: 조치 불요.

- **[INFO]** 직전 라운드(`review/code/2026/07/17/20_06_45/side_effect.md`) WARNING — "완료 마커
  판정이 bootstrap 자신에만 적용되고 실제 소비처 2곳(`pre-commit`, `PostToolUse`)에는 전파되지
  않음" — 은 이번 라운드에서 해소 확인
  - 위치: `.claude/hooks/_lib/mermaid_lint_ready.py`(신설, 3처 공유 SoT), `.githooks/pre-commit:48-52`,
    `.claude/hooks/lint_mermaid_posttooluse.py:35-36,198`
  - 상세: `git diff bbf72268e..d31f99a11` 로 대조한 결과 세 소비처(작성자 bootstrap, 판독자
    pre-commit·PostToolUse) 가 이제 "node_modules 존재 AND 마커 존재"라는 동일 규약을 공유한다.
    `test_mermaid_lint_ready.py::ConsumerBindingTest` 3건이 이 결속을 문자열 검사로 고정(bootstrap
    이 마커명을 하드코딩하는지, pre-commit 이 공유 헬퍼를 거치는지, PostToolUse 가 `is_ready`를
    임포트하는지). 직접 실행 검증: `pytest test_mermaid_lint_ready.py
    test_bootstrap_mermaid_install.py -W error::ResourceWarning` → 22/22 통과, ResourceWarning
    없음(직전 라운드 WARNING #5 의 Popen pipe 미해제도 함께 해소됐음을 재확인).
  - 제안: 해당없음(확인 완료, 재열 불요).

- **[INFO]** 신규 파일시스템 아티팩트(`$lock/owner`, `$fail_marker`)·환경변수·전역상태 범위는
  모두 안전하게 통제됨
  - 위치: `.gitignore:9`(`.claude/tools/mermaid-lint/.install.lock/`), `:23`(`.claude/state/`),
    `.claude/tools/bootstrap-session.sh:73`(`fail_marker` 경로)
  - 상세: `fail_marker="$main_root/.claude/state/mermaid_install_last_fail"` 는 `.claude/state/`
    하위라 기존 gitignore 규칙에 이미 포함되고, `$lock/owner` 도 `.install.lock/` 하위라 마찬가지다
    (`git status` 로 미추적 확인). `grep os.environ\[` 결과 전체 6개 파일에서 환경변수 쓰기 0건 —
    `MERMAID_INSTALL_LOCK_GRACE_SEC`/`MERMAID_INSTALL_RETRY_SEC`/`MERMAID_LINT_TOOL_DIR` 모두
    `${VAR:-default}` 읽기 전용, 안전한 기본값 보유. `sys.path.insert(0, ...)`
    (`lint_mermaid_posttooluse.py:35`) 는 매 호출이 독립 프로세스(harness 가 매번 fresh
    `python3` 로 기동)라 프로세스 간 잔류 없음. bash 함수 내부 `owner` 지역변수도 `local` 선언으로
    스크립트 전역을 오염하지 않음. `git config core.hooksPath` 쓰기는 `-C "$main_root"`(로컬 repo
    스코프)로 한정되며 이번 라운드에서 변경되지 않음(기존 그대로).
  - 제안: 해당없음.

## 요약

이번 "자기리뷰 보강 3건" 커밋(d31f99a11)은 직전 라운드가 지적한 부작용 관점 핵심 WARNING —
완료 마커 판정이 `pre-commit`/`PostToolUse` 두 실제 소비처에 전파되지 않던 문제 — 를 신설
공유 SoT(`_lib/mermaid_lint_ready.py`)와 결속 테스트로 실제로 해소했음을 diff 대조와 테스트 실행
(22/22, ResourceWarning 없음)으로 확인했다. 다만 그 해소 과정에서 마커 판정을 더 엄격하게 만든
대가로, `PostToolUse` 훅이 stderr 에 출력하는 자가 복구 안내("Run: (cd .claude/tools/mermaid-lint
&& npm install)")가 새 판정 기준과 어긋나 실제로 그대로 따라도 문제가 해소되지 않음을 실측으로
확인했다(WARNING 1건, fail-open 이라 커밋 차단·오탐 린트로는 이어지지 않고 다음 SessionStart 에
자가치유되지만 그 사이 사용자에게 잘못된 원인을 반복 안내). 그 밖에 락 소유권 검증 강화가 들여온
좁은 잔여 경로(owner 파일 쓰기 실패 시 락 잔존, 저확률·gitignore 범위 내·자가치유)와 pre-commit
의 신규 로컬 서브프로세스 호출 등은 INFO 수준으로, 신규 파일시스템/환경변수/전역상태 발자국은
모두 이미 gitignore 된 경로 안에 정확히 스코프되어 VCS 오염이나 프로세스 간 상태 누출은 없다.
기존 함수 시그니처를 깨는 변경이나 의도치 않은 네트워크 호출(신규)도 발견되지 않았다.

## 위험도

MEDIUM
