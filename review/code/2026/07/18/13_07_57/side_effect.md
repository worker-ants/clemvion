# 부작용(Side Effect) 리뷰 — bootstrap-session.sh 마커-해시 결속

## 검토 범위 및 방법

`git diff origin/main -- .claude/tools/bootstrap-session.sh .claude/tests/test_bootstrap_mermaid_install.py .claude/tests/README.md` 로 실제 변경분을 확정한 뒤(3파일 모두 origin/main 대비 diff 확인됨), 다음을 실측했다.

- 마커 파일(`.bootstrap-install-complete`)의 3개 소비처(`_lib/mermaid_lint_ready.py::is_ready()`, `.githooks/pre-commit`, `lint_mermaid_posttooluse.py`)를 직접 읽어 콘텐츠 의존 여부 확인.
- `bootstrap-session.sh`가 소싱(source)되는 곳이 있는지 전 레포 grep(없음 — 항상 `bash script.sh` 서브프로세스 호출).
- `bash -n`으로 문법 검증, `test_bootstrap_mermaid_install.py`(11/11), `test_mermaid_lint_ready.py`(12/12), `test_reap_merged_worktrees.py`(18/18, bootstrap→reaper 통합 경로 포함) 전부 실행하여 그린 확인.
- `.github/dependabot.yml`을 확인해 "lockfile 변경이 반복적으로 발생한다"는 스크립트 주석의 전제가 실제로 존재하는 스케줄인지 대조.

## 발견사항

- **[INFO]** 마커 파일 시맨틱 변경(빈 sentinel → lockfile 해시 콘텐츠) — 하위 호환성은 실측으로 확인됨
  - 위치: `.claude/tools/bootstrap-session.sh:98, 135-138, 150-158, 168` (`marker` 경로, 신규 `_lock_hash()`, 신규 `need_install` 판정, `printf '%s\n' "$(_lock_hash)" > "$marker"`)
  - 상세: 기존에는 `: > "$marker"`로 생성되는 "존재 여부만 의미 있는" 빈 파일이었으나, 이번 변경으로 콘텐츠가 `package-lock.json`의 sha256 해시 문자열로 바뀐다. 이 마커를 읽는 3곳을 실제로 열어 확인한 결과 전부 `os.path.isfile(marker_path(...))`(`_lib/mermaid_lint_ready.py::is_ready()`) 존재-여부만 검사하고 콘텐츠는 읽지 않는다(`.githooks/pre-commit`·`lint_mermaid_posttooluse.py`는 둘 다 `is_ready()`를 통해서만 판정). 관련 테스트 `test_mermaid_lint_ready.py` 12/12 통과로 재확인. 실제 파손은 없음.
  - 제안: 조치 불요(안전 확인됨). 향후 마커 콘텐츠에 의존하는 새 소비자를 추가할 경우 "예전엔 존재-여부만 유효했다"는 암묵 가정이 더는 성립하지 않는다는 점만 유의.

- **[INFO]** `npm install` 네트워크 호출 트리거가 "최초 1회"에서 "lockfile 해시 불일치마다"로 의도적으로 확장됨
  - 위치: `.claude/tools/bootstrap-session.sh:147-174`
  - 상세: 이전 버전은 체크아웃 생애주기 동안 `npm install`(npm 레지스트리로의 외부 네트워크 호출)을 정확히 한 번만 트리거했다. 이번 변경은 `package-lock.json` 해시가 마커 콘텐츠와 달라질 때마다(전형적으로 `.github/dependabot.yml`에 새로 등록된 `/.claude/tools/mermaid-lint` npm 트리의 주간/보안 업데이트가 머지된 직후) SessionStart마다 재트리거한다. `.github/dependabot.yml`을 직접 확인해 이 스케줄이 실재함을 확인했다. 이는 본 PR의 명시적 목적(보안 픽스가 기존 설치에 전파되지 않던 결함 해소)이며, 실패 시에도 fail-open(세션 비차단, cooldown 재시도)이 그대로 유지된다. "네트워크 호출 트리거 조건 확장"이라는 체크리스트 항목에 해당하므로 명시적으로 기록.
  - 제안: 조치 불요 — 의도된 변경이며 스크립트 자체 주석과 커밋 메시지(`c5fdd1bb8`)에 이미 충분히 설명됨.

- **[INFO]** 락-없음 동시성 잔여 위험의 성격이 "최초 설치 1회성"에서 "lockfile 변경마다 반복"으로 바뀜 — 스크립트 스스로 정직하게 공시
  - 위치: `.claude/tools/bootstrap-session.sh:74-122` (design note, 특히 신규 문구 "that condition is no longer first-install-only... recurring, not one-off")
  - 상세: 마커-only 동시성 모델(손으로 짠 `mkdir` 락의 stale-lock steal 레이스가 재현되어 의도적으로 제거된 이력, review 02_06_42 C1)의 잔여 위험 — "동시 세션이 같은 순간 npm install 을 겹쳐 실행해 tree 가 오염될 수 있음" — 이 이번 변경 이전에는 최초 설치 시점 한정의 드문 창구였으나, 마커가 lockfile 해시에 결속되며 Dependabot 머지마다 반복 재개방되는 창구로 바뀐다. 주석이 이를 정확히 인지·명시하고 향후 재검토 트리거(plan §G, fcntl.flock)까지 남겨 은폐된 부작용이 아니다. 손으로 짠 락 primitive 가 이 코드베이스에서 반복적으로 철회되어 온 이력(관련 review 2026/07/17~18)과도 일관된 판단.
  - 제안: 조치 불요 — 이미 plan §G 로 추적 중. 실제로 재현될 때 fcntl.flock 도입을 재검토.

- **[INFO]** 실패 스로틀 구간 동안 stale(구버전) tree 가 계속 "ready" 로 취급됨 — 새 로직과 기존 쿨다운의 상호작용
  - 위치: `.claude/tools/bootstrap-session.sh:141-145`(`_install_throttled`)와 신규 `need_install` 판정의 상호작용
  - 상세: lockfile 이 바뀌어 재설치가 필요한 시점에 설치가 실패하면(네트워크 등) 마커는 갱신되지 않고 구(舊) 해시를 유지한 채 남는다. `fail_marker` 쿨다운이 걸린 구간 동안은 재시도 자체가 스킵되므로, 그 사이 `is_ready()`는 (존재-여부만 보므로) 계속 true 를 반환해 mermaid lint 가 알려진 취약점이 있는 구버전 tree 로 계속 동작한다. dev-tooling 전용 린터라는 낮은 심각도, 그리고 "세션을 절대 막지 않는다"는 명시적 계약과 정합적인 fail-open 설계의 자연스러운 귀결이라 별도 결함으로 보지 않는다.
  - 제안: 조치 불요(차단 아님). 선택적으로 이 상호작용을 스크립트 주석에 한 줄 덧붙이면 다음 리뷰 라운드의 재질문을 줄일 수 있음.

- **[NONE — 확인 완료]** 시그니처·인터페이스·전역 변수·환경 변수 영향 없음
  - `test_bootstrap_mermaid_install.py`의 `_env()`/`_run()`에 추가된 `rewrites_lock=False` 키워드 인자는 기본값이 있어 기존 호출부(동일 파일 내부, 외부 소비자 없음)와 완전히 호환. 신규 env var `NPM_REWRITES_LOCK`은 `dict(os.environ)`로 복사한 서브프로세스 전용 env 에만 주입되어 `os.environ` 오염 없음(테스트 간 격리 확인).
  - `bootstrap-session.sh`는 전 레포 grep 결과 항상 `bash ".../bootstrap-session.sh"` 서브프로세스로 호출되고 어디서도 `source`/`.` 되지 않아, 신규 `_lock_hash()` 함수·`want_hash`/`need_install` 변수는 프로세스-로컬로 소멸하며 호출자 셸 네임스페이스를 오염시키지 않음.
  - 스크립트 종단부 `exit 0`은 변경 없이 유지되어 "bootstrap must never block a session" 핵심 계약이 보존됨(npm install 실패 시에도 로그만 남기고 정상 종료).
  - `.claude/tests/README.md` 변경은 표 설명 한 줄 갱신뿐으로 부작용 없음.

## 실행 검증

```
python3 -m unittest discover -s .claude/tests -p 'test_bootstrap_mermaid_install.py'  → 11 passed
python3 -m unittest discover -s .claude/tests -p 'test_mermaid_lint_ready.py'         → 12 passed
python3 -m unittest discover -s .claude/tests -p 'test_reap_merged_worktrees.py'      → 18 passed (bootstrap→reaper 통합 경로 포함, section 4 비영향 확인)
bash -n .claude/tools/bootstrap-session.sh                                            → 문법 OK
```

## 요약

이번 변경(`bootstrap-session.sh`의 마커-lockfile 해시 결속 + post-install 재계산 + 정직한 창 서술, 그리고 이를 커버하는 신규 테스트 4종)은 이전 §F 리뷰 라운드(12_06_58 W1, 12_31_29 W2/W3)에서 지적된 "보안 픽스가 기존 설치에 전파되지 않음"과 "post-install lockfile rewrite 시 영구 재설치 루프" 두 자기유발 결함을 스스로 수정하는 후속 라운드다. 순수 부작용 관점에서 실제 상태 변경은 마커 파일 콘텐츠 시맨틱 변경과 `npm install` 네트워크 호출 트리거 확장 두 가지이며, 둘 다 (1) 의도된 변경이고 (2) 스크립트 자체 주석에 충분히 설명되어 있으며 (3) 마커의 3개 실제 소비처가 모두 존재-여부만 검사함을 코드 레벨에서 직접 확인해 하위 호환성 파손이 없음을 실측했다. 시그니처 변경은 테스트 헬퍼의 기본값 있는 키워드 인자 추가뿐으로 호출자 영향이 없고, 스크립트가 어디서도 소싱되지 않아 신규 함수/변수의 네임스페이스 오염도 없다. `exit 0` 종단 계약과 fail-open 성질도 보존된다. 락-없음 동시성 잔여 위험의 성격이 "1회성"에서 "반복성"으로 바뀐 점은 스크립트가 스스로 정직하게 공시하고 있어 은폐된 부작용이 아니며, 이 저장소가 손으로 짠 락 primitive 를 반복적으로 철회해 온 기존 판단과도 합치한다. CRITICAL/WARNING 급 발견은 없었다.

## 위험도

LOW
