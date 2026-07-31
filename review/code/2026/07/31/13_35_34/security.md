# Security Review

## 발견사항

- **[INFO]** push 가드 in-flight 우회 수정이 배선까지 올바르게 확인됨 (이번 diff 자체가 수정, 재확인 목적)
  - 위치: `.claude/hooks/_lib/review_guard.py:862-863` (`evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처), `.claude/hooks/_lib/review_guard.py:901` (`if in_flight_ok and _code_review_in_flight(repo_root):`), `.claude/hooks/guard_review_before_stop.py:344` (`decision = evaluate_review(in_flight_ok=True)`), `.claude/hooks/guard_review_before_push.py:811` (`result = evaluate(target) if scoped else evaluate()`)
  - 상세: 수정 전에는 "리뷰 세션 디렉터리(`meta.json`)만 만들고 `SUMMARY.md` 를 아직 안 쓴" in-flight 상태가 `evaluate_review()` 내부에서 무조건 억제를 적용해, push 가드와 Stop 넛지가 같은 함수를 공유한다는 사실 때문에 `_IN_FLIGHT_TTL_SECONDS`(1800초) 동안 push 가드까지 통과되는 access-control 결함이었다(`plan/in-progress/harness-review-gate-ci-backstop.md` §(2) 실측: `blocked: False, reason: "... SUMMARY pending) — allowed"`). 이번 diff 는 `in_flight_ok` opt-in 파라미터로 스코프를 좁혔다. 호출부를 직접 grep 해 확인한 결과 `in_flight_ok=True` 를 넘기는 곳은 `guard_review_before_stop.py:344` 단 한 곳뿐이고, push 경로(`guard_review_before_push.py:811`)는 위치 인자(`target`) 하나만 전달하므로 `in_flight_ok` 는 항상 기본값 `False` 로 남아 push 가드가 실제로 hard-gate 상태를 유지한다. 회귀 방지도 이중 seam 테스트(`test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest`, `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in`, `test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession`)가 반환값이 아니라 실제로 넘어간 kwarg 자체를 파일에 기록해 검증하도록 고정돼 있다.
  - 제안: 조치 불요 — 이미 올바르게 수정·배선·테스트됨. 향후 `evaluate_review` 호출부가 추가될 때 이 seam 테스트들이 계속 유지되는지만 확인.

- **[WARNING]** 신규 추가된 `_probe_main.py` 가 어디서도 참조되지 않는 고아 파일이며, 이번 PR 이 고치는 "생략 사실 미고지" 결함을 그대로 재현한 옛(pre-fix) 코드를 저장소에 다시 커밋함
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (파일 전체, 1304줄 — 특정 결함 줄이 아니라 파일 자체가 문제)
  - 상세: `diff .claude/skills/code-review-agents/scripts/_probe_main.py .claude/skills/code-review-agents/scripts/code_review_orchestrator.py`(수정 전 `origin/main` 버전) 결과 두 파일이 **완전히 동일**하다(델타 0). 즉 이 신규 파일은 이번 PR 이 고치는 대상인, 예산 초과로 잘린 파일을 아무 안내 없이 통째로 누락시키는 옛 `build_files_section` 로직을 그대로 담고 있다(이번 PR 은 정확히 이 결함을 `code_review_orchestrator.py` 쪽에서 `_omitted_content_note`/`_aggregate_omission_note`/global-note 분기로 고쳤다 — `code_review_orchestrator.py:561`, `:1254`). 저장소 전체에서 `grep -rln "_probe_main"` 을 돌리면 자기 자신 외에는 어떤 코드·테스트·문서도 이 파일을 import/참조하지 않는다 — 현재는 실행되지 않는 죽은 코드다. 실질 익스플로잇 경로는 없지만: (1) 실제 오케스트레이터(`code_review_orchestrator.py`)와 파일명이 한 글자 차이(`_probe_main.py` vs 메인 파일명)라 향후 편집·grep-replace·복붙 실수로 옛(안전하지 않은) 로직이 다시 활성화될 잠재 위험이 있고, (2) 1300줄짜리 완전 중복 파일이 이후 리뷰·감사 때마다 읽어야 할 표면을 불필요하게 늘린다. 파일명(`_probe_*`)과 내용(정확히 pre-fix 스냅샷)으로 미루어 로컬 diff 비교용 스크래치 파일이 실수로 커밋된 것으로 보인다.
  - 제안: 저장소에서 제거할 것을 권장. 만약 회귀 테스트의 "이전 동작" 픽스처로 의도적으로 남긴 것이라면, 그 의도를 밝히는 주석과 함께 실제 테스트에서 명시적으로 로드하도록 배선하거나, `plan/`/`review/` 산출물처럼 코드 트리 밖(테스트 데이터 디렉터리)으로 옮길 것.

- **[INFO]** consistency-summary 의 "Critical 하향 금지 + 권한 밖 Critical 즉시 planner 인계" 정책 신설은 실제 게이트 우회 사고를 막는 보안적으로 유효한 개선
  - 위치: `.claude/agents/consistency-summary.md:44-58` (§요약 지침 3·4, 신설), `.claude/skills/consistency-checker/SKILL.md:106-124` (§4 BLOCK 처리, 미러)
  - 상세: `review_guard.py` 의 SPEC-CONSISTENCY 게이트는 SUMMARY.md 안의 `BLOCK:` 한 줄만 정규식으로 파싱한다(`_summary_block_is_no`). 과거(`review/code/2026/07/25/22_58_00`) summary 통합 에이전트가 checker 의 `[CRITICAL]` 판정을 "위임 완료·승격 조건 문서화" 라는 나름 타당한 근거로 WARNING 으로 하향해 `BLOCK: NO` 를 냈고, 그 결과 게이트를 실제로 통과시켰다 — LLM 에이전트의 자유재량이 access-control 결정을 좌우하던 사례다. 이번 신설 정책은 하향을 전면 금지하고(상향만 허용), 호출자 권한 밖 원인은 등급·BLOCK 을 그대로 유지한 채 별도 "§planner 인계" 표로만 다음 행동을 지정하도록 강제해 이 우회 경로를 프롬프트 규약 차원에서 닫는다. 다만 이 금지는 여전히 프롬프트 지시일 뿐 기계적 backstop 은 없다는 점은 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` §신규 후속 2 에 defer 항목으로 팀이 스스로 기록해 뒀다(orchestrator 가 checker 리포트의 `[CRITICAL]` 개수와 최종 `BLOCK:` 모순 여부를 대조하는 기계적 검증 없음) — 새로 발견한 사실이 아니라 이미 추적 중인 잔여 갭이라 별도 신규 항목으로 올리지 않는다.
  - 제안: 조치 불요(정책 개선). 위 잔여 갭은 이미 백로그에 있으므로 그 항목을 참조.

- **[INFO]** 신규/기존 git 서브프로세스 호출 — 인젝션 벡터 없음, 로컬 신뢰 경계
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1190-1252`(`_default_branch_ref`, `warn_if_committed_work_is_missing`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249-273`(`_branch_changed_rels`), 그리고 17개 대상 파일 전체의 기존 `_git()`/`subprocess.run` 호출부
  - 상세: 모든 호출이 `subprocess.run(["git", ...])` 리스트 인자 형태이고 `shell=True` 는 어디에도 없다(전수 grep 확인) — 셸 인젝션 경로 자체가 없다. `--commit`/`--range`/`--branch`/`--diff-base` 같은 CLI 인자가 `f"{branch}..."` 식으로 git 인자 문자열에 그대로 보간되는 기존 패턴은 이번 라운드에서 손대지 않은 부분을 포함해 여전히 남아 있으나, 이 값들은 원격/미신뢰 입력이 아니라 같은 로컬 오케스트레이터를 구동하는 개발자/에이전트가 직접 넘기는 값이고, 실패 시 조용히 빈 리스트/무경고로 폴백해 위험한 실패 모드도 없다. 이전 라운드 리뷰(`review/code/2026/07/31/11_07_48/security.md`)가 동일 패턴을 LOW 로 평가했고 이번 라운드도 같은 결론이다.
  - 제안: 우선순위 낮음, 조치 불요.

- **그 외 점검 — 특이사항 없음**
  - 하드코딩된 시크릿/API 키/토큰/인증서: 17개 대상 파일 전체에서 `api_key`/`secret`/`password`/`token=`/`private_key`/`BEGIN (RSA|PRIVATE|OPENSSH)` 패턴 grep — 매치 0건(주석 중 문서 파일명 `secret-store.md` 언급 1건 제외).
  - 안전하지 않은 코드 실행/역직렬화: `eval(`/`exec(`/`pickle`/`os.system(`/`shell=True` grep 전체 0건.
  - 경로 탐색: `guard_review_before_stop.py` 의 마커 파일명 sanitizer(`_sanitize_component`/`_MARKER_SAFE`, 정규식 `[^A-Za-z0-9._-]` 이외 전부 `_` 치환)는 이번 diff 로 변경되지 않았으나 재확인 결과 `session_id`/git 브랜치 토큰에 `../` 가 섞여도 상태 디렉터리를 벗어날 수 없다 — `test_marker_path_sanitizes_path_traversal` 로 고정.
  - 암호화: 신규/변경 코드에 해시·암호화 알고리즘 사용 없음(대상 아님).
  - 에러 처리: 신규 `warn_if_committed_work_is_missing`/`_branch_changed_rels`/`_default_branch_ref` 모두 git 실패 시 조용히 폴백(빈 값)하고 스택트레이스나 내부 절대경로를 stdout/사용자 대상 출력에 노출하지 않는다(디버그 로그 파일에만 기록).
  - 정규식 서비스거부(ReDoS): `_glob_to_regex`(review_guard.py, 미변경)·`_CATALOG_BULK_RE`(consistency_orchestrator.py, 신규) 모두 중첩 정량자 없는 선형 패턴 — 재앙적 백트래킹 여지 없음. 이 정규식들의 입력(spec frontmatter `code:` glob, 저장소 경로)은 신뢰된 로컬 저장소 콘텐츠이지 원격/미신뢰 입력이 아니다.

## 요약

이번 diff 는 harness 자체의 리뷰/일관성 게이트를 강화하는 다섯 축(in-flight 억제 스코프 축소, consistency-summary 하향 금지·planner 인계, 프롬프트 생략 안내, 번들 우선순위 재배열, 커밋 누락 changeset 경고)으로 구성되며, 이 중 실제 access-control 성격을 가진 항목(in-flight 억제, 하향 금지)은 모두 기존 우회를 **닫는** 방향의 개선이고 배선·회귀 테스트로 검증됐다. 하드코딩된 시크릿, 인젝션 가능 sink(`shell=True`/`eval`/`os.system`/`pickle`), 인증 우회, 안전하지 않은 암호화, 민감정보 노출은 발견되지 않았다. 유일한 신규 이슈는 순수 보안 취약점이 아니라 저장소 위생 문제로, 신규 추가된 `_probe_main.py` 가 이번 PR 이 고치는 옛(pre-fix) 로직을 완전히 동일하게 재현한 채 아무 데서도 참조되지 않는 고아 파일로 커밋된 것이다 — 실행 경로가 없어 당장 악용 가능하지는 않지만, 실제 오케스트레이터와 유사한 파일명으로 인해 향후 실수로 되살아날 잠재 위험과 불필요한 감사 표면 증가가 있어 제거를 권한다.

## 위험도

LOW
