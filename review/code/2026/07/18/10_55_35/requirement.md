# 요구사항(Requirement) 리뷰 — mermaid 설치 락 제거(마커-only 전환)

## 리뷰 범위 및 방법

대상 4파일(`bootstrap-session.sh`, `test_bootstrap_mermaid_install.py`, `.githooks/pre-commit`,
`.claude/tests/README.md`)은 커밋 `a16d80290`("mermaid 설치 락 제거 — 마커-only 로 전환")의 결과물이며,
직전 리뷰 라운드(`review/code/2026/07/18/02_06_42`)의 **C1(CRITICAL, stale-lock steal 의
check-then-act TOCTOU — 리뷰어 2명 + 사용자 자신이 3-way 실측 재현)**에 대한 해결책이다.

검증을 위해 다음을 직접 수행했다:
- `git show a16d80290`로 4파일 전체 diff 확인, 락 장치(`_lock_is_dead`/owner PID/grace/`mkdir`
  락/`MERMAID_INSTALL_LOCK_GRACE_SEC`) 완전 삭제를 line-level로 대조.
- 저장소 전체(`.claude`, `.githooks`, `.gitignore`, `.github`, `PROJECT.md`)를 대상으로 제거된
  락 메커니즘의 잔존 참조를 grep — 과거 리뷰 산출물(`review/code/2026/07/1{7,8}/...`, 시점 기록이라
  불변) 외에는 0건.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체 실행 — **301건 all green**,
  커밋 메시지의 "harness 301 통과(310→301, 락 테스트 9건 제거)" 주장과 일치.
- `test_bootstrap_mermaid_install.py` 단독 실행 — 7/7 pass.
- 독립 뮤테이션 테스트(스크래치패드에서 별도 스크립트로, 저장소 파일은 건드리지 않음): 성공한
  npm install 뒤 마커를 쓰지 않는 뮤턴트를 만들어 `test_installs_once_and_writes_completion_marker`가
  기대하는 `marker_exists` 단언이 REAL=True / MUTANT=False로 갈라짐을 재현 — 커밋 메시지의
  "마커-미기록 뮤턴트로 비-vacuity 확인" 주장을 제3자 관점에서 재검증(확인됨).
- `plan/in-progress/harness-guard-followups.md` §A(마커 경로, retry 기본값 1800초=30분, 공유 SoT,
  왜 락을 뺐는지의 라운드별 재현 이력, 후속 W1/W3/W4/W8 등)과 구현을 line-level 대조 — 전부 일치.
- `.claude/docs/worktree-policy.md` §7(reap 섹션, 이번 diff 밖)과 `bootstrap-session.sh` §4(reap
  호출부, `--keep`/`BASH_SOURCE` 앵커)를 대조 — 이번 diff가 손대지 않은 부분이며 여전히 일치(회귀 없음).

## 발견사항

- **[INFO]** C1 근본 해결 확인 — 락 코드 완전 제거로 동일 클래스 회귀가 구조적으로 불가능해짐
  - 위치: `.claude/tools/bootstrap-session.sh` (섹션 2 전체, 舊 L98-153 상당)
  - 상세: C1이 재현했던 정확한 코드 경로(`_lock_is_dead && rm -rf "$lock"` → `mkdir "$lock"`의
    비원자적 재검증)가 하드닝이 아니라 **삭제**됐다. 남은 `mkdir`/`rm -f` 호출은 `fail_marker`에
    대한 단순 멱등 연산(`rm -f`, `mkdir -p ... && : > file`)뿐으로, compare-then-act 방식의
    "탈취" 로직이 아니어서 같은 클래스의 TOCTOU를 재발시킬 수 없다(직접 grep으로 `mkdir`/`rm -rf`
    전체 사용처 확인).
  - 제안: 없음(긍정 기록). 설계 노트가 스스로 인정하는 잔여 리스크("첫 cold install 동시 진입 시
    npm 동시 실행 가능, corrupt-but-marked 는 수동 `rm -rf node_modules` 복구")는 사용자가 이미
    2026-07-18 명시적으로 검토·수용한 트레이드오프이며 `plan §G`에 `fcntl.flock` 전환 조건이 남아
    있어 새로 지적할 필요 없음.

- **[INFO]** plan/README/코드/테스트 4면이 서로 line-level로 정합
  - 위치: `plan/in-progress/harness-guard-followups.md` §A ↔ `bootstrap-session.sh` L100-124 ↔
    `.claude/tests/README.md` L34 ↔ `test_bootstrap_mermaid_install.py` 모듈 docstring
  - 상세: 마커 경로(`node_modules/.bootstrap-install-complete`, `_lib/mermaid_lint_ready.py`의
    `MARKER_NAME`과 정확히 일치), `retry_after` 기본값(1800초=30분), "marker-only, not
    lock-serialised" 서술, `test_concurrent_cold_start_converges_and_then_stops_reinstalling`가
    "수렴하되 직렬화는 보장 않음"을 핀한다는 설명까지 4곳 모두 동일한 사실을 서술 — 한 곳만 갱신되고
    나머지가 stale해지는 전형적인 문서 drift 패턴이 이번 라운드엔 없음. `.githooks/pre-commit`
    헤더도 세 번째 공유 SoT(`mermaid_lint_ready.py`)를 이번 diff에서 새로 나열해(직전 라운드 W6)
    guard 2 인라인 주석과 일치시켰다.
  - 제안: 없음(긍정 기록).

- **[INFO]** 연속 실패 시 cooldown 갱신 동작을 직접 단언하는 테스트는 없음(동작 자체는 코드상 정확)
  - 위치: `bootstrap-session.sh` L94-96(실패 분기, `mkdir -p ... && : > "$fail_marker"`),
    `test_bootstrap_mermaid_install.py::test_failed_install_is_throttled_within_cooldown`
  - 상세: 매 실패마다 `fail_marker`를 다시 truncate하므로 mtime이 "가장 최근 실패 시각"으로
    갱신되고 cooldown도 그 시각부터 다시 계산되는 것이 올바른 동작이나(bash `>` 파일 리다이렉트는
    기존 파일도 항상 mtime을 현재 시각으로 갱신), "연속 2회 실패 시 두 번째 실패 시각 기준으로
    cooldown이 연장된다"를 직접 단언하는 회귀 테스트는 없다(기존 단일-실패 시나리오만 커버).
  - 제안: 우선순위 낮음. 필요 시
    `test_failed_install_is_throttled_within_cooldown`류에 "실패 → 일부 대기 → 재실패(throttled
    상태에서도 throttle 창 안이면 재시도 자체가 스킵되므로, 이 케이스는 오히려 throttle 밖에서
    두 번째로 실패시키는 시나리오)로 확장" 케이스 추가 고려.

- **[INFO]** 관련 `spec/` 문서 부재는 이 변경 영역(하네스 자동화 인프라) 특성상 정상이며, 실질
  SoT(`plan/in-progress/harness-guard-followups.md` §A, `.claude/docs/worktree-policy.md` §7)로
  대체 대조를 완료함
  - 위치: 해당 없음(`spec/`는 CLAUDE.md 정의상 제품 전용, `.claude/` 하네스 툴링은 스코프 밖)
  - 상세: 위 "리뷰 범위 및 방법"에 기술한 대조 결과, drift 없음.
  - 제안: 없음.

## 그 외 점검한 항목 (이상 없음, 발견사항으로 등재하지 않음)

- TODO/FIXME/HACK/XXX: 4파일 전수 grep 결과 0건.
- 반환값: `bootstrap-session.sh`는 모든 경로에서 `exit 0`(선두 docstring의 "Always exits 0" 불변식과
  일치), `_install_throttled()`는 모든 분기에서 정의된 0/1을 반환(암묵적 미반환 경로 없음).
- 데이터 유효성: `MERMAID_INSTALL_RETRY_SEC`가 비수치/0/음수일 때 `_install_throttled()`가
  `[ "$retry_after" -gt 0 ] 2>/dev/null || return 1`로 안전하게 처리(산술 에러로 stderr 오염 없음).
  이는 직전 라운드 W2가 지적한 `_lock_is_dead()`만의 비대칭 가드 부재 문제를 함수 자체 삭제로 해소.
- 비즈니스 로직: "부분 설치가 영구 disable 상태로 오판되지 않는다"는 이 가드의 핵심 목적이 마커
  전용 판정으로 그대로 유지됨(`test_partial_node_modules_without_marker_is_retried` 통과 확인).
- 이미 추적 중인 후속 항목(W1 main_root 3중 재구현, W3 테스트 헬퍼 중복, W4 import fail-open 미검증,
  W8 CI 노드 버전 불일치)은 이번 diff의 변경 대상이 아니고(락 제거와 무관, 선재) plan §A 후속에
  체크박스로 이미 등재돼 있어 재기재하지 않음(중복 노이즈 방지).

## 요약

이번 diff는 `plan/in-progress/harness-guard-followups.md` §A가 기술하는 "마커-only, 락 없음" 설계를
정확히 구현한다. 직전 라운드(02_06_42)의 C1은 하드닝이 아니라 **원인이 된 코드 경로 자체를 제거**하는
방식으로 해결됐으며, 저장소 전체에서 잔존 참조가 0건임을 grep으로, 회귀 부재를 301건 전체 테스트
그린으로, 마커 비-vacuity 주장을 독립 뮤테이션으로 각각 확인했다. `bootstrap-session.sh`의 설계
노트·`plan §A`·`.claude/tests/README.md`·`test_bootstrap_mermaid_install.py` docstring 4곳이
서로 line-level로 정합하며 stale한 곳이 없다. 반환값·에러 시나리오(설치 실패/스로틀/비수치 env
입력)·엣지 케이스(부분 설치, 빈 fail_marker, 동시 콜드스타트) 모두 명시적으로 처리·테스트돼 있다.
CRITICAL/WARNING 발견사항 없음 — 유일한 잔여 리스크(첫 cold install 동시 진입 시 npm 동시 실행
가능성)는 숨겨진 결함이 아니라 사용자가 명시적으로 검토·수용하고 코드 주석·plan·테스트 3곳에 일관
문서화한 트레이드오프이므로 이 관점에서 새로 지적할 결함이 아니다.

## 위험도

NONE
