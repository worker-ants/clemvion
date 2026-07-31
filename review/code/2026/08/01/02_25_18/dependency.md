# Dependency Review — harness-block-backstop-b56163 (round 7 / 실질 첫 리뷰)

> 참고: 이전 라운드 changeset 이 오구성되어(리뷰 산출물 `review/**` 이 소스 대신 번들됨) 이번이 현재 소스에 대한 실질적인 첫 리뷰다. `origin/main...HEAD` 로 직접 diff 를 재확인해 실제 변경 파일 17개(+ 무관 리뷰 산출물 노이즈)를 확정하고, 프롬프트에서 크기 제한으로 생략 표시된 4개 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)과 `tests/README.md` 는 `Read` 로 직접 전문을 열어 판단했다.

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — harness 의 "zero third-party dependency" 규약 그대로 준수
  - 위치: 변경된 15개 `.py` 파일 전체 (예: `.claude/_shared/retry_state.py:31-38`, `.claude/_shared/block_integrity.py:29-32`, `.claude/hooks/guard_review_before_stop.py:29-37`, `.claude/hooks/_lib/review_guard.py:102-111`)
  - 상세: 이번 PR(`.claude/_shared/`, `.claude/hooks/`, `.claude/skills/**/scripts/`, `.claude/tests/`, 관련 `.md` 문서 17개)에서 신규·수정된 모든 Python import 를 전수 grep 했다. 전부 표준 라이브러리(`os`, `re`, `sys`, `json`, `subprocess`, `hashlib`, `traceback`, `time`, `dataclasses`, `datetime`, `argparse`, `inspect`, `unittest`, `tempfile`, `shutil`, `pathlib`, `importlib.util`, `ast`, `glob`, `io`, `contextlib`)이거나 프로젝트 내부 모듈(`_shared.*`, `_lib.*`, `lib.*`, `review_guard`, `plan_guard`, `failopen_state`, `branch_guard`, `_harness`)이다. `git diff --stat origin/main...HEAD -- '**/package.json' '**/requirements*.txt' '**/pyproject.toml' '**/Pipfile*' ...` 실측 결과 매칭 0건 — 의존성 매니페스트 변경이 전혀 없다. `.claude/tests/README.md:14-17`(이번 diff 로 문구는 살짝 바뀌었지만 규약 자체는 비변경)이 명시하는 "Python 은 표준 라이브러리만 사용, hooks 는 bare python3 위에서 동작, `pytest`/`requirements.txt` 도입 금지" 규약과 정확히 부합한다. 버전 고정·라이선스·취약점·번들 크기·빌드 시간 항목은 전부 해당 없음(N/A).
  - 제안: 없음 (확인 완료, 유지).

- **[WARNING]** `_shared/retry_state.py` 공유 계약을 `merge_coordinator_orchestrator.py` 가 부분적으로만 채택 — `reconcile_state_with_disk` self-healing 누락
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-123`(주석 + `_load_state`/`_save_state`/`_apply_status_update` 위임부), `:532-541`(`--resume` 핸들러 — 파일 존재만 검증하고 echo). 대조: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1386`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 동일 `--resume` 경로(둘 다 `_reconcile_state_with_disk` 호출).
  - 상세: `.claude/_shared/retry_state.py` 는 5개 함수(`load_state`/`save_state`/`reconcile_state_with_disk`/`apply_status_update`/`emit_summary_state`)를 노출한다. `code_review_orchestrator.py` 와 `consistency_orchestrator.py` 는 5개 전부를 위임해 `--resume`/`--summary-state` 시점에 디스크 기준 자가 치유를 얻는다. 그러나 `merge_coordinator_orchestrator.py` 는 3개(`load_state`/`save_state`/`apply_status_update`)만 위임하고 `reconcile_state_with_disk` 는 아예 부르지 않는다 — "하나의 공유 모듈"이라는 내부 의존성 그래프상 소비자는 3개이지만, 실제 계약 준수는 2/3 뿐이다. 코드 주석(merge_coordinator_orchestrator.py:107-112)과 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9 양쪽에서 "다른 skill 의 동작 변경이라 별도 PR 로 분리한다"고 투명하게 등재되어 있어 은폐된 결함은 아니지만, merge-coordinator 세션을 `Agent` tool 로 직접 fan-out 하면 다른 두 orchestrator 가 이미 고친 것과 동일한 모순("`_retry_state.json` 이 prepare 스냅샷에 멈춘 채 SUMMARY 는 실제 성공을 보고")을 그대로 안고 있다.
  - 제안: 이번 PR 범위에서 처리하지 않기로 한 결정 자체는 합리적(별도 skill 의 동작 변경)이나, 후속 작업으로 `merge_coordinator_orchestrator.py` 에 `_reconcile_state_with_disk` 위임 함수를 추가하고 `--resume`/`--summary-state` 양쪽에서 호출하도록 정합화할 것 — 이미 plan 문서에 등재되어 있으므로 우선순위 재확인 정도로 충분.

- **[WARNING]** (선행 구조적 이슈, 이번 PR 이 회피 패턴을 1회 더 반복) `.claude/hooks/_lib` 와 `.claude/skills/_lib` 패키지명 충돌
  - 위치: `.claude/tests/test_block_integrity.py:66-69`(`CheckerListIsCanonicalTest.test_orchestrator_derives_its_list_from_here` docstring — "Fresh interpreter: importing the orchestrator in-process collides on the name `_lib` (hooks vs skills)"). 참고(비변경): `.claude/_shared/__init__.py` — "세 번째 `_lib` 을 만들지 않기 위해 `_shared` 를 별도 top-level 패키지로 택했다"고 이미 명시. `plan/in-progress/harness-review-gate-ci-backstop.md` 하단 "신규 후속 (defer)" 항목도 "실제 코드 공유엔 hooks/skills 의 `_lib` 네임스페이스 충돌 해소가 선행" 을 조건으로 이미 등록.
  - 상세: `.claude/hooks/_lib/`(패키지, `branch_guard`/`plan_guard`/`review_guard`/`failopen_state` 등)와 `.claude/skills/_lib/`(패키지, `project_config`)는 서로 다른 트리에 같은 이름 `_lib` 으로 존재한다. 한 인터프리터가 두 트리를 모두 import 하면 `sys.modules['_lib']` 캐시가 먼저 로드된 쪽으로 고정되어, 나중에 다른 `_lib` 을 기대하는 import 가 깨질 수 있다. 이번 PR 이 추가한 `test_orchestrator_derives_its_list_from_here` 는 이를 정확히 문서화하며 in-process import 대신 `subprocess.run` 으로 fresh interpreter 를 띄워 우회한다("the same dodge the consistency suites document" — 기존에도 있던 회피 패턴의 반복 사용). 이슈 자체는 이번 PR 이전부터 있었고 새로 만든 것은 아니지만, `_shared` 류 통합이 늘어날 때마다 subprocess 우회 보일러플레이트도 함께 늘어나는 구조다(plan 문서 항목 12번은 이 보일러플레이트 자체가 이미 "4개 파일에 복제"되어 있다고 별도 지적).
  - 제안: 이번 PR 에서 고칠 필요는 없음(범위 밖, 이미 별도 defer 항목으로 등록됨). `.claude/hooks/_lib` 또는 `.claude/skills/_lib` 중 하나를 리네임하는 작업의 우선순위를 팀이 재확인할 것 — 해소되면 `test_block_integrity.py`/`test_orchestrator_state.py` 류의 subprocess 우회가 근본적으로 줄어든다.

- **[INFO]** `_shared/retry_state.py` 로의 fan-in — 3개 orchestrator 스크립트가 단일 모듈에 수렴, 테스트로 상쇄됨
  - 위치: `.claude/_shared/retry_state.py`(전체, 신규 204줄). 소비자: `code_review_orchestrator.py:48`, `consistency_orchestrator.py:45`, `merge_coordinator_orchestrator.py:44`. 검증: `.claude/tests/test_retry_state_shared.py`(신규 220줄).
  - 상세: 이전에는 `code_review_orchestrator.py`/`consistency_orchestrator.py` 가 5개 함수의 사본을 "Change both" 주석으로 수기 동기화했다(`retry_state.py:1-29` docstring 이 AST 비교로 4/5 가 완전히 동일함을 실측 후 이관했다고 기록). 이번 PR 로 3개 skill(code-review-agents / consistency-checker / merge-coordinator)이 전부 하나의 공유 모듈에 의존하게 되어, 그 모듈의 회귀가 3개 소비자에 동시 전파되는 fan-in 리스크가 생긴다. 다만 `test_retry_state_shared.py` 가 CLI 서브프로세스 경유로 3개 소비자 전부를 개별 구동해 검증하므로 리스크는 테스트로 상당히 상쇄된다. 부수로 `save_state`(`retry_state.py:50-91`)가 기존 truncate-on-write 방식에서 tmp 파일 + `os.replace` 원자적 쓰기로 강화되어, 3개 소비자 모두가 자동으로 더 안전한 쓰기 방식을 물려받는다(순수 이득, 회귀 가능성 없음 — atomic write 는 strictly safer superset).
  - 제안: 없음. 현 구조 유지.

- **[INFO]** `hashlib` — `.claude/hooks/**` 내 최초 사용, 표준 라이브러리·비암호적 용도
  - 위치: `.claude/hooks/guard_review_before_stop.py:31`(import), 사용처는 `_run()` 함수 내 note 중복 억제 마커 키 생성부(`hashlib.sha1(note.encode("utf-8")).hexdigest()[:12]`).
  - 상세: `.claude/hooks/**` 전체에서 `hashlib` 을 import 하는 곳은 이 파일이 유일(신규 도입, `grep -rl` 확인). SHA-1 은 콘텐츠 dedup 키 생성(마커 파일명 12자 digest)에만 쓰이며 서명·비밀번호 해시·무결성 검증 등 보안-critical 용도가 아니므로 SHA-1 의 알려진 암호학적 취약점은 이 사용에 영향이 없다. 표준 라이브러리이므로 신규 의존성·버전·라이선스 문제 없음.
  - 제안: 없음.

## 요약

이번 변경분(17개 파일 — `.claude/_shared/`·`.claude/hooks/`·`.claude/skills/**/scripts/`·`.claude/tests/` 및 관련 md 문서)은 순수 harness 내부 도구 코드이며, 전체 import 를 전수 검사한 결과 신규 외부 패키지·의존성 매니페스트 변경이 전혀 없다 — `.claude/tests/README.md` 가 명시한 "Python 은 표준 라이브러리만, 서드파티 의존성 0" 규약을 그대로 지킨다. 따라서 버전 고정·라이선스·취약점·번들 크기·빌드 시간 항목은 해당 사항이 없다. 이 PR 의 실질적인 의존성 관점 내용은 **내부 모듈 의존 관계 재편**이다: `code_review_orchestrator.py`/`consistency_orchestrator.py` 가 "Change both" 주석으로 수기 동기화하던 5개 상태 관리 함수를 `.claude/_shared/retry_state.py` 로, `review_guard.py` 의 (버그가 있던) `BLOCK:` 정규식을 `.claude/_shared/block_integrity.py` 로, push/stop 두 훅의 fail-open 리포팅을 `.claude/hooks/_lib/failopen_state.py` 로 각각 추출·통합했다 — 모두 AST 비교로 동등성을 실측한 뒤 이관했고, 대응하는 신규/확장 테스트(`test_retry_state_shared.py`, `test_block_integrity.py`, `test_stop_guard_failopen.py`)가 통합된 소비자 전부를 subprocess 경유로 재검증한다. 다만 `merge_coordinator_orchestrator.py` 는 공유 계약 중 `reconcile_state_with_disk` 를 채택하지 않아 3개 소비자 중 1개만 self-healing 이 빠진 비대칭이 남아 있고(투명하게 후속 등재됨), 선행 이슈인 `.claude/hooks/_lib`/`.claude/skills/_lib` 패키지명 충돌이 이번 PR 의 새 테스트에서도 subprocess 우회로 다시 나타난다. 둘 다 이번 PR 을 막을 사유는 아니며 팀이 이미 후속 항목으로 명시적으로 기록해 두었다.

## 위험도
LOW
