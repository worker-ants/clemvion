# 의존성(Dependency) 리뷰 — review/code/2026/07/18/10_55_35

대상 커밋: `a16d80290` "fix(harness): mermaid 설치 락 제거 — 마커-only 로 전환 (02_06_42 C1)"
(`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.githooks/pre-commit`, `.claude/tests/README.md`)

실제 코드 diff(`git show a16d80290`)를 확인해 페이로드의 "전체 파일 컨텍스트" 중 이번
커밋이 진짜로 바꾼 부분만 특정해 검토했다. 요지: **손수 짠 `mkdir` 기반 advisory
lock(owner PID + grace age + stale-lock steal, ~90줄)을 전량 삭제**하고 완료
마커 + 실패 throttle 만 남겼다. `.githooks/pre-commit`·`README.md` 는 주석/문서
1~2줄 보강뿐이다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 오히려 내부 의존 표면이 줄었다
  - 위치: `.claude/tools/bootstrap-session.sh` (설치 가드 섹션 전체)
  - 상세: 이번 diff 는 npm/node 패키지를 하나도 추가하지 않는다. 변경의 실체는
    손수 구현한 동시성 primitive(mkdir 락 + owner PID 파일 + grace age 판정 +
    `kill -0` liveness 체크 + steal 로직, `_lock_is_dead()` 전체)를 삭제하고
    "완료 마커 + 실패 throttle" 두 가지만 남긴 것이다. `npm install --no-fund
    --no-audit --silent` 호출 자체(대상 디렉터리·플래그)는 이번 커밋에서
    바뀌지 않았다(`git show a16d80290 -- .claude/tools/bootstrap-session.sh`
    로 확인). 즉 "의존성" 관점에서는 신규 패키지 도입이 아니라 **자체 구현
    동시성 코드라는 내부 의존을 제거**한 리팩터에 가깝다 — 유지보수 대상
    코드량 감소는 의존성 표면 축소로 봐도 무방.
  - 제안: 없음(정보 제공용).

- **[INFO]** 정리 위생 확인 — 제거된 락 관련 심볼의 dangling 참조 없음
  - 위치: 저장소 전체 (`.gitignore`, 소스, 문서)
  - 상세: `_lock_is_dead`, `.install.lock`, `MERMAID_INSTALL_LOCK_GRACE_SEC`,
    `_plant_lock` 을 저장소 전체에서 grep 했을 때, 리뷰 산출물(`review/code/**`,
    이번 라운드 자신을 포함한 과거 리뷰 기록)에만 남아 있고 실제 소스·설정·문서
    어디에도 살아있는 참조가 없다. `.gitignore` 의 `.install.lock/` 항목도 같은
    커밋에서 함께 제거되어 락 삭제와 정합적이다. `test_bootstrap_mermaid_install.py`
    는 락 관련 테스트 9건 + `_plant_lock` 헬퍼를 함께 삭제했고, `README.md` 의
    해당 파일 설명도 "marker-only, not lock-serialised" 로 갱신되어 3곳
    (코드·테스트·문서)이 서로 어긋나지 않는다.
  - 제안: 없음(정보 제공용).

- **[INFO]** 버전 고정 — 이번 diff 범위 밖이지만 인접 컨텍스트로 확인
  - 위치: `.claude/tools/mermaid-lint/package.json` (이번 diff 에서 미변경)
  - 상세: `bootstrap-session.sh` 가 `npm install` 하는 대상 매니페스트는
    `"jsdom": "*"`, `"mermaid": "*"` 로 버전이 고정돼 있지 않다. 다만 같은
    디렉터리에 `package-lock.json`(61KB, 커밋됨)이 존재해 `npm install` 은
    이를 존중하므로 실질적으로는 고정 버전이 설치된다 — 단 `npm ci` 가 아닌
    `npm install` 이라 락파일이 out-of-sync 상태라면 재해석될 여지가 `npm
    ci` 보다 넓다. `package.json`/`package-lock.json` 자체는 이번 커밋에서
    건드리지 않았고(최종 수정 이력은 2020년대 초 PR #410), 대상 파일 4개
    (`bootstrap-session.sh`/테스트/pre-commit/README) 중 어디도 이 매니페스트를
    바꾸지 않으므로 이번 변경이 새로 만든 리스크는 아니다. 참고로 프로덕션
    코드(`codebase/**`)의 설치는 별도로 `.claude/test-stages.sh` 가 `pnpm
    install --frozen-lockfile` (npm `ci` 상당의 엄격 모드)을 쓰고 있어, 이
    항목은 harness 전용 dev-tool(mermaid 정적 문법 검사)에 국한된다.
  - 제안: 다음에 이 package.json 을 손댈 일이 있으면 `"*"` 를 실제 사용 중인
    메이저 버전 range(`^x.y.z`)로 교체하는 편이 의도를 명시적으로 남긴다.
    이번 diff 의 필수 수정 사항은 아니다.

- **[INFO]** 수용된 잔여 동시성 리스크 — 이미 코드 주석·커밋 메시지·테스트로
  투명하게 문서화되어 있어 별도 조치 불요
  - 위치: `.claude/tools/bootstrap-session.sh` 설계 노트, `test_bootstrap_mermaid_install.py`
    의 `test_concurrent_cold_start_converges_and_then_stops_reinstalling`
  - 상세: 락을 없앴으므로, 여러 워크트리 세션이 **첫 콜드 설치**를 동시에
    맞으면 같은 `node_modules` 디렉터리로 `npm install` 이 동시 실행될 수
    있다(npm 은 단일 디렉터리 동시 설치에 대해 안전을 보장하지 않는다). 최악의
    경우 "완료 마커는 찍혔지만 내용은 오염된" 트리가 남을 수 있고, 복구는 수동
    `rm -rf node_modules` 다. 이는 이번 커밋이 새로 만든 결함이 아니라
    **의도적으로 선택한 트레이드오프**다 — 이전의 손수 짠 mkdir 락이 3라운드
    연속으로 서로 다른 동시성 결함(순수-age steal → `find -mmin` 분단위
    truncation → 이번 TOCTOU)을 재현당했기 때문에, "계속 틀리는 락을 하드닝"
    하는 대신 "락 없음 + 정직하게 문서화된 잔여 리스크"를 사용자가 직접
    선택했다(커밋 메시지: "사용자 결정 2026-07-18"). 영향 범위도 dev-tooling
    린터(mermaid 정적 검사)의 최초 1회 설치로 좁고, 실패해도 lint 는
    fail-open(커밋을 막지 않음)이라 blast radius 가 작다. 올바른 primitive
    (`fcntl.flock`, 커널이 홀더 사망 시 자동 해제)는 plan §G 로 명시 이연되어
    있다.
  - 제안: 없음(설계 결정으로 이미 소진). 만약 향후 npm install 대상이 늘거나
    설치 실패 빈도가 체감되면 plan §G(`fcntl.flock`) 착수를 고려.

- **[INFO]** 내부 의존성 응집도 — 3개 소비처가 하나의 판정 SoT 를 공유
  - 위치: `.githooks/pre-commit` (주석 갱신), `.claude/hooks/_lib/mermaid_lint_ready.py`
    (이번 4개 대상 파일 밖, 참조만)
  - 상세: `pre-commit` 의 diff 는 사실상 주석 한 줄 추가뿐이다 — "mermaid-lint
    readiness (is the tooling installed?) 는 `.claude/hooks/_lib/mermaid_lint_ready.py`
    에 있다"는 서술을 헤더에 보강. 실제 판정 코드(`mermaid_ready=...` 이하)는
    이번 diff 이전부터 존재했다. bootstrap(작성자)·pre-commit(bash 리더)·
    PostToolUse(python 리더) 세 소비처가 "설치됐는가"를 각자 재구현하지 않고
    하나의 모듈(+ `test_mermaid_lint_ready.py` 의 cross-language MARKER_NAME
    바인딩 테스트)로 수렴시킨 설계는 내부 의존 관계상 바람직하다(드리프트를
    테스트가 즉시 잡음).
  - 제안: 없음(정보 제공용, 기존 설계 확인).

- **[INFO]** 테스트 파일 — 서드파티 의존성 미도입, 프로젝트 관례 준수
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py`, `.claude/tests/README.md`
  - 상세: 테스트는 `subprocess`/`tempfile`/`os`/`shutil`/`time`/`unittest` 등
    표준 라이브러리만 사용한다. `README.md` 가 명시하는 "harness Python 은
    서드파티 의존성 0, `pytest`/`requirements.txt` 도입 금지" 관례와 일치하며,
    이번 diff 도 그 규칙을 위반하지 않는다. 이번 커밋은 락 관련 테스트 9건과
    `_plant_lock` 헬퍼만 삭제했을 뿐 새 임포트를 추가하지 않았다.
  - 제안: 없음(정보 제공용).

## 요약

이번 변경은 **의존성 관점에서 사실상 중립~긍정적**이다. 신규 외부 패키지·
라이브러리를 하나도 추가하지 않으며(4개 대상 파일 모두 npm/pip 매니페스트가
아니다), 오히려 손수 구현했던 mkdir 기반 advisory-lock(owner PID·grace
age·steal 판정)이라는 자체 개발 동시성 컴포넌트를 제거해 유지보수해야 할
내부 코드 의존 표면을 줄였다. `npm install` 호출부(`--no-fund --no-audit
--silent`)는 이번 diff 에서 바뀌지 않은 기존 코드이고, 설치 대상
`mermaid-lint/package.json` 의 와일드카드 버전 선언(`"*"`)도 이번 diff 의
변경 범위 밖이며 커밋된 `package-lock.json` 이 실질적 고정을 제공한다. 락
제거로 재도입되는 "첫 콜드 설치 시 동시 npm install 가능"이라는 잔여
리스크는 신규로 발견한 결함이 아니라 3라운드의 실측 재현을 거쳐 사용자가
직접 내린 의도적 트레이드오프이며, 코드 주석·커밋 메시지·테스트
(`test_concurrent_cold_start_converges_and_then_stops_reinstalling`) 모두에
정직하게 문서화되어 있고 영향 범위(dev-tooling 린터 1회성 설치, fail-open)도
좁다. 제거된 락 관련 심볼(`_lock_is_dead`, `.install.lock`,
`MERMAID_INSTALL_LOCK_GRACE_SEC`, `_plant_lock`)은 `.gitignore`·테스트·문서
전역에서 dangling 참조 없이 깨끗이 정리됐고, 테스트 코드는 프로젝트가 명시한
"harness Python 은 서드파티 의존성 0" 관례를 계속 준수한다. 조치가 필요한
CRITICAL/WARNING 은 없다.

## 위험도

LOW
