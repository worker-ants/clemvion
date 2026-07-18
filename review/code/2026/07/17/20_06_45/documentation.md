# 문서화(Documentation) 리뷰 — bootstrap mermaid-lint install 락/마커

## 발견사항

- **[INFO]** `bootstrap-session.sh` 상단 요약 주석이 "Three responsibilities"라 서술하나 실제로는 4개 섹션(①githooks ②mermaid-lint ③상태 마커 GC ④merge worktree reap)이 존재
  - 위치: `.claude/tools/bootstrap-session.sh` 파일 헤더 (실제 라인 2-13, diff 밖 — 변경 안 됨) vs 본문의 `# 1.`~`# 4.` 네 섹션
  - 상세: 이번 diff는 `# 2.` 섹션(mermaid-lint install)에만 상세 주석을 30여 줄 추가했다. 이 미스매치(3 vs 4)는 이번 diff가 만든 것이 아니라 이전 PR(#970, 세션 앵커 reap = `# 4.` 섹션 추가)에서 이미 발생한 pre-existing drift이며, diff hunk 경계(`@@ -31,13 +31,43 @@`) 밖의 헤더 텍스트는 이번 변경에서 손대지 않았다. 다만 리뷰에 제공된 "전체 파일 컨텍스트"에 그대로 보이고, 섹션 2가 이번에 크게 정교화된 만큼 남은 카운트 오류가 상대적으로 더 눈에 띈다.
  - 제안: 이번 PR이 이미 이 파일의 주석을 많이 만지는 김에 "Three responsibilities" → "Four responsibilities"로 한 단어만 정정하면 저비용으로 해소된다. 이번 diff의 스코프 밖이라 차단 사유는 아님.

- **[INFO]** 신규 테스트 파일 `test_bootstrap_mermaid_install.py`가 `.claude/tests/README.md`의 "What's covered" 표에 행으로 등재되지 않음
  - 위치: `.claude/tests/README.md` §What's covered
  - 상세: 이 표는 `.claude/tests/`의 모든 테스트 파일을 다루는 것이 아니라 선별적 하이라이트 목록이다(실측: 현재 19개 test_*.py 중 13개만 표에 있고 `test_check_e2e_playwright_config.py`·`test_consistency_impl_done.py`·`test_plan_guard.py` 등 6개가 이미 표 밖). 더 결정적으로, 동일한 종류의 누락이 자매 파일 `test_reap_merged_worktrees.py`에 대해 이미 두 차례(`review/code/2026/07/17/17_09_10`, `18_04_20` INFO #1) 지적됐고 "전체 감사는 별도 후속"으로 명시적으로 보류된 **기존에 알려지고 deferred 된 패턴**이다 — 이번 diff가 새로 만든 gap이 아니다. 다만 이 신규 테스트가 지키는 결함(동시 세션 npm install 경쟁 + 부분 설치 영속으로 인한 무신호 lint 무력화)은 README의 다른 행들(`test_reap_merged_worktrees.py`의 "the incident this covers" 서술)과 정확히 같은 급의 "왜 이 테스트가 존재하는가"를 설명할 가치가 있는 사례다.
  - 제안: 선택 사항. `test_reap_merged_worktrees.py` 행과 같은 형식으로 1행 추가하면 이 파일이 지키는 비자명한 회귀(경쟁+영속)의 맥락이 보존된다. 차단 사유 아님(README 표 완전성 자체가 이 프로젝트에서 build-time 가드로 강제되지 않으며, 기존에 이미 여러 파일이 누락된 상태로 존재).

- **[INFO]** plan 문서의 테스트 건수 서술("9건")은 현재 정확하나, 이 저장소가 이미 겪은 "하드코딩 테스트 건수 rot" 패턴과 동일 계열
  - 위치: `plan/in-progress/harness-guard-followups.md` "## A." 절 — "테스트: `.claude/tests/test_bootstrap_mermaid_install.py` 9건"
  - 상세: 실측 결과 정확히 9개 test 메서드(`test_installs_once_and_writes_completion_marker` ~ `test_concurrent_sessions_install_at_most_once`)로 현재 서술과 일치한다. 다만 이 저장소는 최근 커밋(`16bdd1d3d docs(plan): ... README 커버리지 표·테스트 건수 비의존화`)에서 정확히 같은 종류의 하드코딩된 테스트 건수가 후속 커밋마다 8→9→10으로 벌어지며 stale 해진 사례를 겪고 "개수 비의존 표현"으로 전환한 전례가 있다. 다만 본 항목(A)은 체크리스트상 이미 완료(`[x]`)로 닫혀 후속 리뷰 라운드를 거치지 않을 가능성이 높아 그 저장소가 겪은 rot 위험은 낮다.
  - 제안: 조치 불요(참고). 향후 이 plan에 대한 재작업이 생기면 "9건" 대신 "관련 테스트 일체 추가"류의 개수 비의존 표현을 고려.

## 확인했으나 결함 없음 (참고용 — 긍정 사례)

- **`bootstrap-session.sh` §2 인라인 주석**: 신규 30여 줄 주석(마커가 node_modules 안에 있는 이유, `mkdir` 락이 원자적·이식성 있는 이유, loser가 대기 대신 skip하는 이유, 10분 stale-lock steal 근거)을 실제 코드 로직과 대조 검증했다. 모두 정확 — 예: `find "$lock" -maxdepth 0 -mmin -10`은 "10분 이상 경과한 락만 steal"이라는 주석 서술과 정확히 일치하고, 마커 경로(`$tool_dir/node_modules/.bootstrap-install-complete`)는 "node_modules 안에 있어 트리 삭제 시 마커도 함께 사라진다"는 서술과 일치하며, `mkdir` 실패 시 if-block을 건너뛰는 구조는 "loser는 대기 없이 skip"과 일치한다. 오래된/부정확한 주석 없음.
- **`test_bootstrap_mermaid_install.py` 모듈 docstring**: 테스트가 실제로 검증하는 두 결함(경쟁·영속)을 정확히 설명하고, npm이 네트워크를 타지 않고 스텁된다는 사실도 명시 — 코드와 일치.
- **`.gitignore` 신규 항목의 한국어 주석**: "크래시로 남으면 10분 뒤 다음 세션이 회수하므로 잔존물도 harmless"는 실제 stale-lock steal 메커니즘과 일치. 주변 항목(`dist/`)과 스타일 일관.
- **plan 문서의 리뷰 인용 정확성**: A~E 5개 항목이 인용하는 출처(`18_04_20 WARNING #7/#5/#4`, `19_15_56 WARNING #3/#6/#2`)를 실제 `review/code/2026/07/17/{18_04_20,19_15_56}/SUMMARY.md` 원문과 대조 확인 — 전항목 정확히 일치(내용·번호 모두). 근거 날조 없음.
- **CHANGELOG.md 미갱신은 결함 아님**: 저장소의 `CHANGELOG.md`(539줄, 60개 "Unreleased" 항목)를 전수 grep한 결과 `.claude/`·`bootstrap-session`·`worktree` 언급이 0건이며, 모든 항목이 `SoT: spec/...`로 제품(스펙 연동) 변경에만 국한된 컨벤션임을 확인했다. 본 diff는 순수 harness/tooling 변경이라 CHANGELOG 갱신 대상이 아니다.
- **테스트 docstring 선택적 커버리지**: 9개 테스트 중 3개만 docstring을 갖고 나머지는 서술적 메서드명 + assert 실패 메시지로 자기설명하는 패턴은, 자매 파일 `test_reap_merged_worktrees.py`(18 테스트 중 유사 비율)와 동일한 기존 컨벤션이므로 이번 파일만의 갭이 아니다.
- **신규 config/env var 없음**: 마커·락 경로는 하드코딩 상수이며 새 환경변수를 도입하지 않아 별도 설정 문서화 대상이 없다. 테스트가 쓰는 `REAP_MIN_INTERVAL`/`REAP_GH_BIN`은 `reap-merged-worktrees.sh` 자체 헤더 주석에 이미 문서화된 기존 test/CI seam이다.

## 요약

이번 변경은 harness 내부 도구(`bootstrap-session.sh`)의 동시성 결함 수정 + 회귀 테스트 9건 + 후속 백로그 plan 문서로 구성되며, 문서화 관점에서는 전반적으로 우수하다. 신규 코드에 붙은 인라인 주석(락·마커의 "왜"를 설명)과 테스트 모듈 docstring을 실제 코드 로직과 대조 검증한 결과 부정확한 서술이 없었고, plan 문서가 인용한 5건의 리뷰 출처도 원문과 정확히 일치해 근거 날조가 없음을 확인했다(이 저장소가 과거 겪은 "지어낸 이력" 문제의 반례). 발견된 것은 전부 INFO 수준으로, ①파일 헤더의 "Three responsibilities" 서술이 이전 PR에서 이미 4섹션으로 늘어난 상태를 반영 못 하는 pre-existing drift(이번 diff 스코프 밖), ②`.claude/tests/README.md`의 표에 신규 테스트 행이 없는 것(다른 파일에 대해 이미 두 차례 지적·deferred된 동일 패턴의 반복), ③plan의 하드코딩된 테스트 건수("9건", 현재는 정확)가 이 저장소가 이미 겪은 rot 패턴과 같은 계열이라는 점이다. CHANGELOG.md 미갱신은 실측으로 확인한 대로 이 프로젝트에서 harness 변경에는 애초에 적용되지 않는 컨벤션이라 결함이 아니다. API 문서·README 사용법 갱신은 이 변경의 성격(내부 tooling 버그 수정, 신규 공개 설정 없음)상 해당 사항이 없다.

## 위험도

LOW
