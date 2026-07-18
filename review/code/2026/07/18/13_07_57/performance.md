### 발견사항

- **[INFO]** `_lock_hash()`(`want_hash`)가 `package.json` 존재 여부 확인보다 먼저, 조건 없이 매 SessionStart 마다 호출됨
  - 위치: `.claude/tools/bootstrap-session.sh:150` (`want_hash=$(_lock_hash)`), 이어지는 `if [ -f "$tool_dir/package.json" ]; then ...` 블록(152行)
  - 상세: 기존(마커 존재 여부만 보던 시절) 로직은 `[ -f "$marker" ]` O(1) stat 한 번이면 충분했지만, 이번 lockfile-hash 바인딩(undici 등 Dependabot 보안 범프를 감지하기 위한 W1 수정) 도입으로 매 세션마다 `package-lock.json` 전체를 읽어 SHA-256 해시를 계산(`shasum`/`sha256sum` + `cut` 서브프로세스 2회 spawn)한다. 이 계산은 `package.json` 자체가 없는 경우(=설치 로직 전체가 스킵되는 경로)에도 그대로 실행되어 결과(`want_hash`)가 버려진다. "여러 worktree 세션이 동시에 SessionStart 를 도는 것이 정상 워크플로" 라는 스크립트 자체 주석을 감안하면, 이 낭비分은 세션 수만큼 반복된다.
  - 제안: `want_hash` 계산을 `if [ -f "$tool_dir/package.json" ]` 블록 안으로 옮겨 `package.json` 부재 시 해시 계산 자체를 건너뛴다. (단, 절대적 비용은 낮음 — `package-lock.json` 은 mermaid-lint 서브 도구용으로 크기가 작아 해시 1회당 수 ms 수준. 시급성 낮은 정리 항목.)

- **[INFO]** "마커 없음(최초 설치)" 분기에서 `_lock_hash` 가 사실상 2회 계산됨
  - 위치: `.claude/tools/bootstrap-session.sh:150-158` (사전 `want_hash`) vs `168行` (`printf '%s\n' "$(_lock_hash)" > "$marker"`, 설치 후 재계산)
  - 상세: `need_install=1` 이 `[ ! -f "$marker" ]` 분기(마커가 아예 없는 최초 설치/부분 설치 복구 케이스)로 결정될 때는 `want_hash` 값이 이후 어떤 분기 조건에도 쓰이지 않는다(오직 marker 가 존재하는 `elif` 비교 분기에서만 `want_hash` 를 사용). 그럼에도 150行에서 이미 1회 계산되고, 설치 성공 후 168行에서 "POST-install 해시를 재계산해야 한다"는 (정당한, W2 관련) 이유로 다시 1회 계산되어 최초 설치 경로에서 총 2회의 파일 해시 계산이 발생한다.
  - 제안: 사전 계산을 `elif` 비교가 실제로 필요한 지점(= 마커가 존재할 때)까지 지연시키면 최초/부분 설치 경로에서 중복 해시 계산을 제거할 수 있다. 다만 파일 크기가 작아 실질 영향은 미미 — 코드 명확성과 트레이드오프.

- **[INFO]** `npm install` 대신 `npm ci` 채택 시 부수적 성능/구조 이득 가능성 (참고용 제안, 강한 요구 아님)
  - 위치: `.claude/tools/bootstrap-session.sh:162` (`npm install --no-fund --no-audit --silent`), 관련 주석 163-167行 (POST-install 재해시가 필요한 이유 = "npm install may rewrite the lockfile in place")
  - 상세: `npm install` 은 의존성 해석(resolution) 과정에서 `package-lock.json` 을 재작성할 수 있어(주석에 이미 W2 로 문서화됨) "설치 후 해시 재계산" 이라는 추가 단계가 필요해졌다. `npm ci` 는 lockfile 을 신뢰하고 해석 단계를 건너뛰므로 일반적으로 더 빠르고, lockfile 을 재작성하지 않으므로 W2 우회 로직(POST-install 재해시) 자체가 불필요해질 수 있다.
  - 제안: 단, `npm ci` 는 설치 전 `node_modules` 를 삭제 후 클린 설치하며 `package.json`/`package-lock.json` 불일치 시 더 엄격하게 실패한다 — "부분 설치 복구"(`test_partial_node_modules_without_marker_is_retried`)나 관용적 동작을 의도적으로 유지하려는 설계였다면 `npm install` 이 맞는 선택일 수 있다. 순수 성능 관점의 참고 제안이며, 채택 여부는 기존 설계 의도 확인 후 판단 권장.

- **[INFO]** (기존에 이미 문서화·수용된 트레이드오프 — 신규 이슈 아님, 확인 차원) 동시 cold-start 세션들의 `npm install` 병렬 실행
  - 위치: `.claude/tools/bootstrap-session.sh:91-122` (설계 노트), `test_concurrent_cold_start_converges_and_then_stops_reinstalling` (test_bootstrap_mermaid_install.py:454-480)
  - 상세: 여러 worktree 세션이 동시에 cold-start 하면 각자 `npm install` 을 동시에 같은 `node_modules` 트리에 대해 실행할 수 있음(락 제거는 review 02_06_42 C1 에 따른 의도적 설계 반전). 이는 네트워크/디스크 I/O 중복 소모를 의미하지만, 이미 스크립트 주석과 테스트로 명시적으로 분석·수용된 잔여 리스크이므로 신규 성능 결함으로 보지 않는다.
  - 제안: 없음(참고 확인). 재발생 빈도가 실측상 문제가 될 경우에만 plan §G(fcntl.flock) 재검토 대상.

- **[INFO]** (이 diff 와 무관한 기존 코드, 참고용) 상태 마커 GC(`find -mtime +30 -delete`)가 매 SessionStart 마다 무조건·비throttle 실행
  - 위치: `.claude/tools/bootstrap-session.sh:179-185`
  - 상세: §4 reaper 는 "self-throttled to once per few hours" 인 반면, §3 의 GC 루프는 두 상태 디렉터리에 대해 매 세션마다 `find -type f -mtime +30` 순회를 수행한다. 현재 규모(세션·브랜치당 파일 1개, 30일 초과분만 정리)에서는 비용이 무시할 만하지만, 활성 worktree 세션 수가 크게 늘어나면 반복 순회 비용이 누적될 수 있다.
  - 제안: 현시점 조치 불요. 파일 수가 유의미하게 커지면 reaper 와 동일한 주기적 throttle 패턴 적용을 고려.

### 요약

이번 변경(`bootstrap-session.sh` 의 lockfile-hash 바인딩 + 관련 테스트/문서)은 신규 핫 경로나 사용자 요청 처리 로직이 아니라 SessionStart 시 1회 실행되는 저빈도 부트스트랩 스크립트이며, 알고리즘 복잡도·N+1·메모리·블로킹 I/O 관점에서 심각한 문제는 없다. 핵심 변경(마커에 lockfile SHA-256 해시를 바인딩해 Dependabot 보안 범프 같은 lockfile-only 변경을 감지)은 기존 "마커 존재 여부만 확인"하던 O(1) 검사를 "매 세션마다 작은 파일 하나를 해시"하는 수준으로 격상시키지만, 대상 파일(mermaid-lint 서브 도구의 package-lock.json)이 작아 절대 비용은 무시할 만한 수준(수 ms)이며 이는 보안 정확성을 위해 정당한 트레이드오프다. 발견된 항목은 모두 INFO 등급의 미세 최적화(불필요 조건에서의 중복 해시 계산, `npm ci` 검토 여지)이거나 이미 스크립트 주석·테스트로 의도적으로 수용된 기존 트레이드오프의 재확인에 그친다. 동시성·재시도·throttle 설계는 이전 리뷰 라운드들을 거쳐 이미 성능/정확성 균형이 잘 잡혀 있다.

### 위험도
LOW
