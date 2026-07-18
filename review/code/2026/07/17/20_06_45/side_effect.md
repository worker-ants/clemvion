STATUS=success side_effect review complete (4 files: bootstrap-session.sh, test_bootstrap_mermaid_install.py, .gitignore, plan md)
===REPORT_MARKDOWN_BELOW===
# Side Effect Review — bootstrap `npm install` 락 + 완료 마커

## 발견사항

- **[WARNING]** 새 "설치 완료" 시그니처(마커 파일)가 같은 `node_modules` 를 읽는 다른 두 소비자에게 전파되지 않음 — 이 diff 가 고치려는 바로 그 실패 모드가 다른 진입점에 남는다
  - 위치:
    - `.claude/tools/bootstrap-session.sh:56-58` — 신규: `[ ! -f "$marker" ]` (완료 마커 기준)
    - `.githooks/pre-commit:50` — 미변경(본 diff 밖): `[ -d "$mermaid_tool_dir/node_modules" ]` (디렉토리 존재만 확인)
    - `.claude/hooks/lint_mermaid_posttooluse.py:101` — 미변경(본 diff 밖): `os.path.isdir(os.path.join(tool_dir, "node_modules"))` (동일하게 디렉토리 존재만 확인)
  - 상세: 이 PR 의 존재 이유는 스스로 이렇게 서술한다 — "부분 node_modules 를 디렉토리 존재 체크가 영원히 '설치됨'으로 오판 → mermaid lint 가 아무 신호 없이 무력화된 채 남는다" (bootstrap-session.sh:39-42). 그런데 이 diff 는 **bootstrap 자신의 재설치 여부 판단**만 마커 기준으로 바꿨고, 같은 `mermaid-lint/node_modules` 를 읽는 나머지 두 소비자(커밋 시점 `pre-commit` guard 2, 매 Write/Edit 마다 도는 `lint_mermaid_posttooluse.py`)는 여전히 예전의 "디렉토리 존재" 만으로 "설치됨"을 판단한다. 그 결과 세 소비자가 이제 서로 다른 진실을 본다:
    - 기존 정상 설치가 이 변경으로 "1회성 재설치"되는 동안(주석에 명시된 의도된 동작, bootstrap-session.sh:45-46) `npm install` 이 **기존에 이미 존재하던** `node_modules` 위에서 파일을 추가/치환한다. 이 재작성 도중에도 디렉토리 자체는 계속 존재하므로, 같은 시각 다른 worktree 세션에서 커밋을 시도하면 `pre-commit` guard 2 는 "설치됨"으로 보고 `node lint-mermaid.mjs` 를 실행하며, 의존성이 일시적으로 불완전한 상태에서 require 실패 등으로 비정상 종료하면 이는 실제 mermaid 문법 오류가 아님에도 `exit 1` 로 **커밋을 차단**한다(`pre-commit:61-66`). 같은 창구에서 `lint_mermaid_posttooluse.py` 도 동일 원인으로 exit 2 를 반환해 Claude 에게 "mermaid 블록을 고치라"는 오도된 메시지를 낼 수 있다(파일 자체는 문법상 정상인데도).
    - 크래시로 중단된 설치(진짜 "영속" 케이스)도 마찬가지다: bootstrap 은 마커 부재를 보고 다음 세션에 재설치해 결국 자가치유하지만, 그 자가치유가 일어나기 **전까지**는 (같은 세션이 오래 지속되는 동안) `pre-commit`/`lint_mermaid_posttooluse.py` 는 계속 "설치됨"으로 오판해 깨진 `node_modules` 로 린트를 시도한다. "영원히" 가 "다음 SessionStart 까지"로 줄었을 뿐, 이 두 소비자에 대해서는 동일 부류의 문제가 남는다.
  - 제안: `pre-commit` 과 `lint_mermaid_posttooluse.py` 도 `$marker`(`node_modules/.bootstrap-install-complete`) 존재 여부로 갈아타거나, 세 곳이 공유하는 하나의 판정 헬퍼(예: `mermaid-lint/is-ready.sh` 또는 마커 경로 상수)로 통합해 "설치됨" 의 정의가 한 곳에서만 바뀌도록 한다. 최소한 두 파일에 "이 체크는 bootstrap 의 마커와 별개이며 이 diff 이후로도 partial-install 오판 가능"이라는 주석이라도 남겨 후속 작업(plan 문서의 B~D 항목과 유사한 성격)으로 등록해 둘 것을 권장.

- **[INFO]** 기존 정상 설치에 대한 무통지 1회성 `npm install` 재실행 (네트워크 호출)
  - 위치: `.claude/tools/bootstrap-session.sh:45-46` (주석에 의도 명시), `:58,65`
  - 상세: 마커 파일이 없으면 무조건 재설치 분기에 들어가므로, 이미 정상 동작 중인 기존 클론/워크트리도 이 변경을 받은 다음 세션에서 한 번은 `npm install --no-fund --no-audit --silent` 이 실행된다. `--offline`/`--prefer-offline` 옵션이 없어 레지스트리 접근이 발생할 수 있다. 문서화되고 의도된 트레이드오프이며 1회성이라 심각하지 않지만, "예상치 못한 외부 서비스 호출"(점검 관점 7) 에 해당하는 사실 자체는 기록해 둔다.
  - 제안: 필요 시 `npm install --prefer-offline` 로 완전 오프라인 캐시 우선을 명시하거나, CHANGELOG/세션 시작 메시지에 "이번 세션에서 1회 재설치가 발생할 수 있음"을 남겨 사용자가 놀라지 않게 한다. (현재도 `echo "bootstrap: installing mermaid-lint deps (one-time)…"` 로 최소한의 신호는 있음.)

- **[INFO]** 마커 쓰기 실패 시 매 세션 재설치 재시도 가능성 (fs 권한 등)
  - 위치: `.claude/tools/bootstrap-session.sh:66` — `: > "$marker" 2>/dev/null && echo "bootstrap: mermaid-lint ready"`
  - 상세: `npm install` 은 성공했지만 마커 파일 쓰기 자체가 실패하는 극단적 경우(예: `node_modules` 소유권/권한이 이전 설치에서 root 등으로 남아 쓰기 불가), `&&` 단락평가로 "ready" 메시지도 찍히지 않고 아무 에러도 stderr 에 남지 않는다. 이 경우 마커가 계속 없으므로 **매 세션마다** 무통지 `npm install` 이 재시도된다(테스트의 `test_lock_is_released_after_a_failed_install` 류는 이 케이스를 커버하지 않음 — 그 테스트는 npm 자체 실패만 다룸). 심각도는 낮음(권한 문제가 있는 비정상 환경에서만 발현) 이나 반복 네트워크 호출로 이어질 수 있어 기록.
  - 제안: 마커 쓰기 실패 시에도 stderr 에 짧은 경고를 남기면 디버깅이 쉬워진다. 우선순위는 낮음.

- **[INFO]** 10분 초과 설치에서 락 탈취로 인한 동시 설치 재발 가능성 (설계상 인지된 트레이드오프, 신규 도입 리스크 아님)
  - 위치: `.claude/tools/bootstrap-session.sh:60-63`
  - 상세: `mkdir` 락은 heartbeat 갱신이 없어, 실제로 살아서 설치 중인 세션의 `npm install` 이 10분을 넘기면 다른 세션이 "stale" 로 오판해 락을 탈취하고 같은 트리에 두 번째 `npm install` 을 동시 실행할 수 있다 — 이 기능 전체가 막으려던 바로 그 경쟁이 매우 느린 네트워크에서 재발할 수 있는 경로다. 코드 주석(`bootstrap-session.sh:52-54`)이 이 트레이드오프를 이미 명시적으로 인지하고 수용하고 있으므로 새로운 리스크는 아니며, 심각도도 낮다(일반적인 npm install 은 10분보다 훨씬 짧음).
  - 제안: 현행 유지로 충분. 필요하면 plan 항목 B(reaper 개선)와 함께 "락 갱신(touch)" 옵션을 백로그에만 남겨도 됨.

- **[INFO]** 테스트 파일 자체의 부작용 범위는 격리적으로 잘 통제됨 (긍정적 확인)
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py` 전체
  - 상세: `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree, ...)` 로 모든 파일시스템 조작이 임시 디렉토리 안에 격리되고, `git config user.email/user.name` 도 `-C <tmp-repo>` 로 로컬 스코프에만 기록되어 사용자의 실제 `~/.gitconfig` 에는 영향이 없다. `os.environ` 은 `dict(os.environ)` 복사본만 `subprocess` 에 전달되고 프로세스의 실제 `os.environ` 은 변경되지 않는다. `npm` 스텁은 PATH 접두로만 주입되어 실제 네트워크 호출이 없다. 리뷰 대상 저장소의 실제 `.claude/tools/mermaid-lint/` 에는 어떤 쓰기도 발생하지 않는다(원본은 `shutil.copy` 의 읽기전용 소스로만 사용).

- **[INFO]** `.gitignore` 추가는 정확하고 필요한 항목만 커버
  - 위치: `.gitignore:7` — `.claude/tools/mermaid-lint/.install.lock/`
  - 상세: 신규 락 디렉토리를 정확히 배제. 마커 파일(`node_modules/.bootstrap-install-complete`)은 이미 상위 `node_modules/` 패턴에 포함되어 별도 항목이 불필요하며 실제로 추가되지 않았다 — 올바른 판단.

## 요약

핵심 변경(완료 마커 + `mkdir` 락)은 SessionStart 시점 `main_root` 라는 여러 worktree 가 공유하는 위치에 새 파일시스템 아티팩트(마커·락)를 도입하지만, 그 자체는 격리·자가치유·항상 `exit 0`·락 always-release 로 잘 설계·테스트되어 있고 `.gitignore` 도 정확히 갱신됐다. 다만 부작용 관점에서 가장 중요한 점은, 이 diff 가 "node_modules 설치완료" 라는 공유 상태의 판정 기준을 **bootstrap 자신에 대해서만** 디렉토리 존재 → 마커 존재로 바꿨을 뿐, 동일 자원을 읽는 두 개의 기존 소비자(`.githooks/pre-commit` guard 2, `.claude/hooks/lint_mermaid_posttooluse.py`, 둘 다 이번 diff 밖)는 여전히 옛 디렉토리-존재 체크에 머물러 있다는 것이다. 이 PR 자신이 명시한 "부분 설치를 디렉토리 체크가 영원히 오판" 이라는 실패 모드가, 특히 기존 정상 설치에 대한 문서화된 "1회성 재설치" 창구 동안 다른 worktree 의 커밋/편집이 겹치면 두 소비자 쪽에서 그대로 재현될 수 있다(최악의 경우 무관한 커밋이 환경 문제로 오차단됨). 테스트 파일 자체의 부작용 범위는 임시 디렉토리에 완전히 격리되어 있어 문제가 없다.

## 위험도

MEDIUM
