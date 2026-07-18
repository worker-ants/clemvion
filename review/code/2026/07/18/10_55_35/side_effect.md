# 부작용(Side Effect) 리뷰

리뷰 대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.githooks/pre-commit`, `.claude/tests/README.md` (커밋 `a16d80290`, "mermaid 설치 락 제거 — 마커-only 로 전환").

방법: 제공된 전체 파일 컨텍스트 대조 + `git show a16d80290`로 실제 diff 확인 + 브랜치 이력
(`git merge-base --is-ancestor`)으로 제거된 인터페이스가 `origin/main`에 노출된 적 있는지 확인 +
`python3 -m unittest`로 관련 테스트 3개 파일(7+12+18=37건) 실행해 회귀·잔존 side effect 없음을 직접 검증.

## 발견사항

- **[INFO]** 공유 FS 자원(`node_modules`)에 대한 동시-쓰기 보호 제거 — 의도적으로 수용된 잔여 리스크
  - 위치: `.claude/tools/bootstrap-session.sh` "2. Ensure mermaid-lint deps" 설치 블록
  - 상세: 이 diff는 여러 워크트리 세션이 공유하는 MAIN checkout의 `node_modules`에 대한 상호배제
    `mkdir` 락(및 owner-PID·grace·stale-lock steal 로직 전체)을 삭제한다. 결과적으로 콜드스타트 시
    여러 세션이 동시에 같은 디렉터리에 `npm install`을 실행할 수 있는 창이 재도입된다 — 이는
    함수(스크립트)가 세션 간 **공유 상태(파일시스템)**에 대해 갖던 동시성 보호를 제거하는, 정의상
    side-effect 성격의 변경이다. 다만 세 가지로 완화됨을 직접 확인했다: (1) 이 변경은 위험을
    "새로 도입"한 게 아니다 — 직전 3라운드 리뷰(20_06_45/00_59_56/02_06_42)가 그 락 자체의
    stale-lock steal 경로에서 매번 새로운 TOCTOU급 동시성 결함을 실측 재현했고, 특히 02_06_42 C1은
    "두 세션이 같은 죽은 락을 보고 둘 다 rm+mkdir → 진 쪽이 이긴 쪽의 fresh 락을 지움"이라는, 락이
    없애려던 바로 그 증상을 만들어냄을 20/20 시행으로 재현했다. (2) 코드 상단 설계 노트·plan
    `harness-guard-followups.md`·커밋 메시지 세 곳 모두에 "사용자 결정(2026-07-18)"과 함께 잔여
    위험(최초 cold-install 창에 한정, `rm -rf node_modules`로 자가 복구)이 상세히 문서화돼 있다.
    (3) 마커 자체는 그대로 남아 있어 "부분/실패 설치가 완료로 오판되는" 원래 실패모드는 계속 막는다
    — 이번에 빠진 건 상호배제뿐이다.
  - 제안: 코드 변경 불요(이미 충분히 문서화·정당화된 트레이드오프). 후속으로 이미 명시된
    `fcntl.flock` 기반 대안(plan §G)은 corrupt node_modules 사고가 실제로 관측될 때 재검토 권고.

- **[INFO]** `MERMAID_INSTALL_LOCK_GRACE_SEC` 환경변수 인터페이스 제거 — blast radius 없음(직접 확인)
  - 위치: `.claude/tools/bootstrap-session.sh` (이전 `lock_grace="${MERMAID_INSTALL_LOCK_GRACE_SEC:-600}"`
    라인 삭제), `.claude/tests/test_bootstrap_mermaid_install.py`의 `_env()`/`_run()`
  - 상세: 일반적으로 환경변수 표면 축소는 그 변수를 설정해둔 외부 소비자(CI 설정, 쉘 프로파일)에
    대한 침묵 회귀 위험을 수반한다. 이번 건은 `git merge-base --is-ancestor <락-최초도입 커밋>
    origin/main`으로 직접 확인한 결과 **해당 없음** — 이 변수는 `origin/main`에 존재한 적이 없는
    (같은 미병합 브랜치 안에서 도입 00_59_56 → 제거 이번 커밋까지 완결된) 순수 브랜치-로컬 이력이다.
    라이브 코드·CI(`harness-checks.yml`)·`.claude/hooks/**`·`.claude/settings.json` 어디에도 이
    변수를 설정/소비하는 지점이 없음을 grep으로 전수 확인했다(남은 언급은 전부
    `review/code/2026/07/18/{00_59_56,02_06_42}/**`의 과거 리뷰 산출물 서술뿐이며 실행 경로가 아니다).
  - 제안: 없음(이미 안전).

- **[INFO]** 테스트 헬퍼 시그니처 변경(`_env`/`_run`의 `lock_grace` 파라미터 제거) — 호출자 전원
  diff 내 동반 갱신, 실행으로 재확인
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py`
  - 상세: 두 헬퍼는 클래스 프라이빗(`_` 접두)이라 같은 테스트 클래스 내부에서만 호출되며, 잔존
    호출부를 grep 전수 확인한 결과 `lock_grace=` 전달 호출이 파일 내 0건으로 완전히 정합.
    `python3 -m unittest discover -s .claude/tests -p 'test_bootstrap_mermaid_install.py'`를 직접
    실행해 7/7 통과를 재확인했고, 관련 파일 `test_mermaid_lint_ready.py`(12/12) ·
    `test_reap_merged_worktrees.py`(18/18, bootstrap-session.sh를 실제로 구동하는 케이스 포함)도
    함께 통과함을 확인했다. 테스트는 `tempfile.mkdtemp()` + `addCleanup(shutil.rmtree, ...)`로
    격리되어 있고, 실행 전후 `git status --short`로 저장소에 잔존 부작용이 없음을 확인했다.
  - 제안: 없음.

- **[INFO]** `.githooks/pre-commit` — 순수 주석 변경, 기능 무변경
  - 위치: `.githooks/pre-commit:10-13` (헤더 주석에 `mermaid_lint_ready.py` 한 줄 추가)
  - 상세: 이번 4개 대상 파일 중 pre-commit 훅에 가해진 변경은 주석 1줄 추가뿐이다. guard 1/guard 2의
    실행 흐름·exit code·`mermaid_lint_ready.py` 호출 로직은 이 diff의 hunk 범위 밖(이전 커밋에서 이미
    도입됨)이라 손대지 않는다. 인터페이스·부작용 변경 없음.
  - 제안: 없음.

- **[INFO]** 파일시스템 아티팩트 순감소
  - 위치: `.claude/tools/bootstrap-session.sh`
  - 상세: `.install.lock/`(+`owner` 파일) 생성·삭제 로직이 통째로 사라져, 이 스크립트가 만드는 FS
    아티팩트는 `node_modules/.bootstrap-install-complete` 완료 마커와
    `.claude/state/mermaid_install_last_fail` 실패 스탬프 두 가지로 줄었다. 대응하는 `.gitignore`의
    `.install.lock/` 항목도 (diff 범위 밖이지만) 동일 커밋에서 함께 제거되어 정합함을 `git show`로
    확인했다. 새 아티팩트·새 전역 상태 도입 없음 — 순수 축소 방향.
  - 제안: 없음.

- 그 외 점검 결과(발견 없음): 새 전역 변수 도입 없음(오히려 `lock`/`lock_grace` 스크립트 변수
  제거). 새 네트워크 호출 없음(`npm install` 자체는 기존부터 있던 호출이며 이번 diff로 조건·빈도가
  바뀌지 않음 — 여전히 마커 없을 때 1회). 새 이벤트/콜백 배선 없음. 환경변수 **쓰기(export)**는
  이전에도 지금도 없음(읽기만). 공개 함수/CLI 시그니처(`bash bootstrap-session.sh` 자체의 호출
  방식, `reap-merged-worktrees.sh`와의 서브프로세스 경계)는 무변경.

## 요약

이번 diff는 손수 짠 `mkdir` 기반 상호배제 락(직전 3라운드 리뷰가 매번 새로운 TOCTOU급 동시성
결함을 실측 재현한 바로 그 apparatus)을 통째로 제거하고 완료 마커 + 실패 throttle만 남기는 설계
반전이다. side-effect 렌즈에서 가장 두드러지는 변화는 "공유 `node_modules`에 대한 동시 쓰기
방지"가 사라져 최초 cold-install 창에서 여러 세션이 동시에 npm install을 실행할 수 있는 잔여
위험을 재도입한다는 점이지만, 이는 코드 설계 노트·plan·커밋 메시지 세 곳 모두에 상세히 문서화된
의식적 위험 수용(사용자 결정, 2026-07-18)이며 자가 치유 경로(`rm -rf node_modules`)가 있고, 애초에
락 쪽이 더 나쁜 동시-install을 만들고 있었다는 실측 근거가 뒷받침한다. 함께 제거된
`MERMAID_INSTALL_LOCK_GRACE_SEC` 환경변수·테스트 헬퍼 파라미터는 `origin/main`에 노출된 적 없는
브랜치-로컬 인터페이스임을 `git merge-base`로 직접 확인해 외부 소비자 영향이 전무함을 확인했다.
`.githooks/pre-commit`·README 변경은 주석/문서 성격으로 기능적 부작용이 없다. 새 전역 변수·새
네트워크 호출·새 환경변수 쓰기·깨지는 외부 호출자는 발견되지 않았고, 오히려 FS 아티팩트(락
디렉터리)가 순감소했다. 관련 테스트 3개 파일(37건)을 직접 실행해 회귀와 저장소 오염 없음을
재확인했다. 종합적으로 이 변경은 부작용 표면을 넓히기보다 좁히는 방향이며, 남은 잔여 리스크는
이미 잘 문서화·수용된 트레이드오프다.

## 위험도

LOW
