# 성능(Performance) 리뷰 결과

대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.githooks/pre-commit`, `.claude/tests/README.md`

이번 diff(커밋 `a16d80290`)의 실질 변경은 `bootstrap-session.sh` 2번 섹션(mermaid-lint 설치
가드)에서 손수 짠 owner-aware `mkdir` 락(+stale-lock steal) apparatus 전체를 제거하고 완료
마커 + 실패 throttle 만 남긴 것이다. `.githooks/pre-commit`과 `.claude/tests/README.md`는
주석/설명 문구 정정뿐으로 기능 변화가 없다. `bootstrap-session.sh`의 1·3·4번 섹션(githooks 활성화,
상태 마커 GC, reaper 호출)은 이번 diff 에서 손대지 않았다.

## 발견사항

- **[WARNING]** 락 제거로 "사전 락 없는 콜드스타트 = mkdir 원자성 덕에 정확히 1회 설치"라는,
  직전 라운드가 실측 검증까지 했던 정상 동작이 함께 사라져, 여러 세션이 동시에 시작하면
  세션 수만큼 `npm install`이 중복 실행될 수 있음 (correctness 우선의 의도된 트레이드오프이며,
  아래 제안은 코드 변경을 요구하지 않음)
  - 위치: `.claude/tools/bootstrap-session.sh:56-72`(design note, 특히 66-68행
    "several sessions hitting the *first* cold install... can still npm-install
    concurrently"), `:87-97`(설치 블록 — 마커·throttle 외 어떤 상호배제도 없음);
    `.claude/tests/test_bootstrap_mermaid_install.py:156-182`
    (`test_concurrent_cold_start_converges_and_then_stops_reinstalling`, 특히
    175-176행 `assertGreaterEqual(self._npm_calls(), 1, ...)`로 약화된 단언 —
    구 테스트 `test_concurrent_sessions_install_at_most_once`는 `assertEqual(..., 1)`이었다)
  - 상세: 직전 라운드(`review/code/2026/07/18/02_06_42/concurrency.md` C1)의 실측에 따르면
    이 저장소의 옛 mkdir 락은 "죽은 락을 훔치는" steal 경로에서만 TOCTOU 로 깨졌을 뿐, 사전
    락이 없는 순수 콜드스타트 경쟁 자체는 mkdir 원자성 덕분에 15-way 동시 실행 10/10 회 모두
    정확히 1회 설치로 올바르게 직렬화됐다(해당 리뷰 6행 "콜드스타트... 안전하다(직접 검증)").
    이번 커밋은 steal 경로의 CRITICAL 버그를 없애기 위해 락 apparatus 전체 — steal 로직뿐
    아니라 정상 작동하던 콜드스타트 상호배제까지 — 를 함께 들어냈다. 그 결과 지금 남은 것은
    `[ ! -f "$marker" ]`라는 비원자적 test-then-act 뿐이라, 마커가 아직 없는 상태에서 시작된
    모든 세션이 각자 `npm install`(의존성 jsdom+mermaid — `.claude/tools/mermaid-lint/package.json:10-13`,
    가벼운 설치가 아니다)을 병행 실행한다. 새 테스트도 이를 `assertGreaterEqual(...,1)`로
    명시적으로 인정한다. 이는 정확히 `review/code/2026/07/17/20_06_45/performance.md`가 원래
    락 도입을 "긍정적 설계 포인트"로 평가했던 이유("병렬 세션 전원이 동시에 npm install
    시도하던 이전의 잠재적 최악의 경우 대비 개선 — 정확히 한 세션만 비용을 지불")를 되돌리는
    변화다. 부가 효과: 여러 npm install 이 동일 디스크/네트워크 자원을 동시에 두고 경합하면
    각 설치의 개별 소요 시간도 순차 실행 대비 늘어날 수 있어, SessionStart 훅을 블로킹하는
    시간이 세션당 오히려 더 길어질 위험도 있다. 코드 주석(66-68행)은 이를 "narrow window"·
    "rare first-install-only window"로 서술하지만, 이 저장소 자신의 워크플로 문서
    (`.claude/docs/worktree-policy.md:25` "여러 worktree 동시 실행", `:118` "동시에 열린 다른
    세션")와 이번 테스트 파일의 docstring(1-6행 "Running several worktree sessions at once is
    the documented workflow")이 명시하듯 "여러 worktree 세션을 한꺼번에 띄우는 것"은 예외가
    아니라 이 저장소가 장려하는 정상 워크플로다 — 신규 클론 직후 온보딩처럼 콜드 상태에서
    여러 worktree/세션을 동시에 여는 상황은 "narrow"라는 표현이 암시하는 것보다 실제로는 덜
    드물 수 있다(다만 main checkout 당 1회성 창이라 반복되지는 않고, 마커가 쓰인 뒤로는 완전히
    수렴한다).
  - 제안: 커밋 메시지에 "사용자 결정(2026-07-18)"로 명시돼 있고 3라운드 리뷰가 steal 경로의
    CRITICAL 버그를 반복 재현한 끝에 correctness 를 우선해 의도적으로 선택한 트레이드오프이며,
    근본 해법(fcntl.flock)도 `plan/in-progress/harness-guard-followups.md §G`에 이미 트래킹
    중이다 — 이 발견사항은 **코드 변경(락 재도입)을 요구하지 않는다**. 다만 정확한 특성 기록
    차원에서 design note 의 "narrow window" 문구를 위 worktree-policy.md 근거와 함께
    한 문장으로 보강해 두면(발생 빈도가 실제로는 "크래시 후 stale steal"보다 넓은 "그냥 여러
    세션을 동시에 켬" 케이스라는 점), 향후 재논의 시 안전 논증이 또 틀리는 일을 줄일 수 있다.
    만약 실제로 온보딩·다중 worktree 착수 시 체감되는 지연/자원 낭비가 보고되면, steal 로직
    없이 "획득만 원자적, 절대 탈취하지 않는" 단순 `mkdir` 게이트(자기 소유가 아니면 절대 rm
    하지 않음)가 저비용 중간 대안이 될 수 있다 — 진짜 콜드스타트 경쟁은 mkdir 원자성으로 그대로
    직렬화하면서 이번 C1 의 원인이었던 "판정 후 삭제" TOCTOU 자체가 구조적으로 없다(탈취가
    없으므로). 대가는 "설치 도중 크래시한 세션의 락이 수동 `rmdir` 전까지 후속 설치를 막는다"는
    별도의(그러나 "오염된 node_modules 인지 판별" 보다 진단이 쉬운) 실패 모드이며, 이는 이미
    검토된 옵션 스펙트럼의 한 지점이므로 지금 당장의 재작성보다는 참고 메모로 남긴다.

- **[INFO]** GC(3번 섹션)는 여전히 스로틀 없이 매 세션 무조건 `find` 실행 — 이번 diff 범위 밖
  (비변경), 3라운드 연속 보고된 기존 사항, 실측 비용 낮음 유지되어 조치 불요
  - 위치: `.claude/tools/bootstrap-session.sh:99-108`
  - 상세: mermaid 설치(실패 throttle, `MERMAID_INSTALL_RETRY_SEC`)와 reaper(`REAP_MIN_INTERVAL`,
    기본 21600초=6시간, `.claude/tools/reap-merged-worktrees.sh:46,54`)는 명시적 반복실행
    스로틀이 있으나, 상태 마커 GC(102-104행 대상 디렉터리, 106행 `-mtime +30 -delete`)는 없다.
    "세션당·브랜치당 1파일, 30일 초과분만"이라는 자연스러운 크기 제한 덕에 실측 비용은 여전히
    낮을 것으로 판단되며, 이 결론은 `review/code/2026/07/17/20_06_45`, `2026/07/18/00_59_56`,
    `2026/07/18/02_06_42` 세 라운드에서 동일하게 INFO·조치 불필요로 수렴했다. 이번 diff 는 이
    섹션을 변경하지 않았다.
  - 제안: 조치 불필요. 통합 리포트에서 새 결함으로 중복 카운트하지 말 것.

## 요약

이번 diff 는 3라운드 연속 리뷰가 steal 경로에서 매번 새 TOCTOU 를 재현한 데 따른 의도적
correctness 우선 결정으로, `bootstrap-session.sh` 의 mermaid-lint 설치 가드에서 손수 짠
owner-aware mkdir 락 apparatus 를 통째로 걷어내고 완료 마커 + 실패 throttle 만 남겼다. 코드가
대폭 단순해져 install-필요 경로의 서브프로세스 스폰 수(`kill -0`/`cat owner`/`mkdir`/`rm -rf`
등)가 줄었고 steady-state(마커 존재) hot path 의 stat 호출 수는 그대로이며, 테스트 스위트도
락 관련 9건이 제거돼 약간 가벼워졌다(harness 310→301) — 이 자체는 성능 관점에서 중립~긍정이다.
다만 공짜는 아니다: 직전 라운드가 실측 검증한 "사전 락 없는 순수 콜드스타트는 mkdir 원자성으로
정확히 1회 설치로 직렬화된다"는, 애초에 정상 작동하던 성질까지 함께 제거되어, 이 저장소가
스스로 정상 워크플로로 문서화한 "여러 worktree 세션을 한꺼번에 시작"하는 상황에서 세션 수만큼
`npm install`(jsdom+mermaid, 가볍지 않음)이 중복 실행될 수 있다 — 새 테스트도 이를
`assertGreaterEqual(...,1)`이라는 약화된 단언으로 명시적으로 인정한다. 데이터 손상이나 무한
대기로 이어지지는 않고(각 세션은 자기 몫의 install 을 마치면 독립적으로 exit 0, 최악의 경우도
"오염된 트리 → 수동 rm -rf" 로 self-heal) 최초 1회성 창에 국한되며, 코드·커밋 메시지·
plan §G 에 이미 사용자 결정으로 문서화·수용된 트레이드오프이므로 이 리뷰가 코드 변경을 요구하는
항목은 아니다. 다만 "narrow window"라는 서술과 달리 이 저장소의 실제 워크플로 상 그 창이 드물지
않게 열릴 수 있다는 점, 그리고 동시 설치끼리의 자원 경합이 개별 설치 소요 시간(=세션 블로킹
시간)을 오히려 늘릴 수 있다는 점은 성능 관점에서 명시적으로 기록해 둘 가치가 있어 WARNING 으로
남긴다. `.githooks/pre-commit`·`.claude/tests/README.md`는 주석/설명 문구 정정뿐이라 성능 영향이
없고, `bootstrap-session.sh`의 GC 섹션(3번)은 이번 diff 밖의 기존 INFO 사항이 그대로 유지된다.

## 위험도
MEDIUM
