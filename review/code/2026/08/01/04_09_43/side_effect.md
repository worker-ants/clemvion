# 부작용(Side Effect) 리뷰 — scripts/check-override-floors.py 외 리뷰 산출물 10건 (6차 라운드)

이번 라운드의 diff 는 11개 파일이다: 직전 라운드(`03_47_10`)가 만든 리뷰 산출물 10개(모두
`review/code/2026/08/01/03_47_10/` 하위, 신규 커밋) + `scripts/check-override-floors.py`
(신규 파일, origin/main 대비 전체 347줄). 후자는 5차 수정 커밋(`68e9064d3`)이 반영된 **이후**
상태다. 실제 5차 델타(`git diff 652f6cc78..68e9064d3 -- scripts/check-override-floors.py`)를
별도로 추출해 이전 side_effect 라운드가 아직 보지 못한 신규 코드(타임아웃 처리,
`overrides` 키 부재 가드)만 집중 검증했고, 가드 조건 하나는 `importlib` 로 실제 모듈을 로드해
**실행으로 재현**했다(추론이 아님).

## 발견사항

- **[WARNING]** `load_override_targets()`의 신규 fail-closed 가드가 "`overrides` 키는 있지만
  값이 비어있는(YAML null)" 형태를 놓친다 — 방금 고친 WARNING #2 와 같은 실패 클래스, 다른 트리거
  - 위치: `scripts/check-override-floors.py:119-134`(`load_override_targets()`), 가드 조건은
    122행, 폴백은 132행
  - 상세: 이번 라운드에 새로 추가된 가드는 `if not isinstance(data, dict) or "overrides" not in data:`
    (122행)다 — `overrides` 키가 **아예 없거나** 최상위가 dict 가 아닐 때만 `_undecidable()`을
    부른다. 그런데 `overrides:` 를 값 없이 남기거나(`overrides:\n`) `overrides: null`/`overrides: ~`
    로 쓰면 PyYAML 은 `{"overrides": None}` 을 돌려준다 — `"overrides" not in data` 는 **False**
    라 가드를 그대로 통과한다. 이어서 132행 `for key in data.get("overrides") or {}:` 가
    `None or {}` → `{}` 로 조용히 축소되어 `targets = {}` 를 반환하고, `main()` 은
    `"OK: override 대상 0개 패키지 중 취약 재유입 0건"` 을 출력한 뒤 exit 0 — 이 스크립트
    전체가 막으려는 "설정이 깨졌는데 취약점 0건과 구별 안 되는 성공" 실패 클래스를 **정확히
    재현**한다.
    **실측**: 실제 모듈을 `importlib.util.spec_from_file_location` 으로 로드하고
    `packages:\n  - codebase/*\noverrides:\n` 내용의 임시 `pnpm-workspace.yaml` 로
    `load_override_targets()` 를 직접 호출 → `SystemExit` 없이 `{}` 반환을 확인함(코드 실행,
    추론 아님).
    122행 주석은 "빈 `overrides: {}` 는 의도일 수 있으므로 키 자체의 부재만 가른다" 고 명시적
    빈 dict(`{}`)만 의도된 것으로 다루려 하지만, 실제 조건식은 `overrides: {}` 와
    `overrides: null` 을 구별하지 못해 둘 다 통과시킨다. 후자(값 없이 키만 남은 형태)는
    사람이 `{}` 를 일부러 타이핑하는 것보다 미완성 편집·머지 충돌·삭제 실수의 산물일 가능성이
    실무적으로 더 높다.
  - 제안: 122행 조건에 `overrides` 키가 있어도 값이 `None` 이면 함께 `_undecidable()` 로
    보내는 분기를 추가(예: `or data.get("overrides") is None`, 단 `{}` 는 계속 통과시켜야
    하므로 `is None` 으로 좁혀야 함). `EXPECTED_SITES`(현재 8, `.claude/tests/test_override_floors.py:446`)
    와 `FailClosedSiteCountTest`/`test_missing_overrides_key_is_undecidable` 계열에
    `overrides: null`(또는 `overrides:` 값 없음) 회귀 케이스를 추가해 재발을 막는다.

- **[INFO]** 신규 `_AUDIT_TIMEOUT_SEC`/`subprocess.TimeoutExpired` 처리 — 프로세스 정리는
  안전, 전용 회귀 테스트는 아직 없음
  - 위치: `scripts/check-override-floors.py:77`(`_AUDIT_TIMEOUT_SEC = 300`),
    `:158-173`(`run_audit()` 의 `try`/`except subprocess.TimeoutExpired`)
  - 상세: 직전 side_effect 라운드(`review/code/2026/08/01/03_47_10/side_effect.md`)가 INFO로
    지적한 "timeout 미설정"이 이번 델타로 해소됐음을 확인. `subprocess.run(..., timeout=300)`
    은 `capture_output=True`(파이프 사용)와 결합돼도 내부적으로 `Popen.communicate(timeout=...)`
    경로를 타므로 데드락 위험이 없고, 타임아웃 초과 시 표준 라이브러리가 자식 프로세스를
    kill 후 wait 하므로 좀비/유휴 프로세스가 남지 않는다. `except` 블록은 기존 `_undecidable()`
    fail-closed 패턴을 그대로 재사용해 새로운 종료 경로 유형을 만들지 않는다. 다만
    `.claude/tests/test_override_floors.py` 전체에 `timeout`/`TimeoutExpired` 문자열이
    0건(grep 확인)이라, 이 새 분기 자체의 동작(정말 `_AUDIT_TIMEOUT_SEC` 초과 시 판단 불가로
    떨어지는지)을 고정하는 회귀 테스트는 아직 없다 — 커버리지 판단 자체는 testing reviewer
    영역이라 이 리포트에서는 정보로만 남긴다.
  - 제안: 없음(안전성은 확인됨). 회귀 테스트 추가는 testing reviewer 권고사항 참고.

- **[INFO]** 리뷰 산출물 마크다운 8건(파일 1,3,4,6,7,8,9,10) — 정적 문서, 런타임 부작용
  표면 없음
  - 위치: `review/code/2026/08/01/03_47_10/{SUMMARY,documentation,maintainability,requirement,scope,security,side_effect,testing}.md`
  - 상세: 8개 마크다운은 직전 라운드 리뷰 에이전트들이 생성한 정적 보고서로, 실행되는 코드가
    아니라 이번 관점(상태 변경·전역 변수·FS·시그니처·인터페이스·환경 변수·네트워크·이벤트/콜백)의
    분석 표면 자체가 없다. 다만 `side_effect.md`(파일 9)는 5차 수정 **이전** 스크립트 버전
    (타임아웃·`overrides` 키 가드가 없던 상태)을 대상으로 작성됐음을 확인했다 — 그 리포트가
    인용하는 줄 번호(`125-135`,`146-151` 등)가 현재 파일의 대응 위치(`137-147`,`158-173`)와
    어긋난다. 이는 "리뷰 스냅샷을 다음 라운드 수정과 같은 커밋에 함께 넣는" 이 저장소의 기존
    워크플로 특성상 예상된 상태이며, 정적 텍스트이므로 side-effect 관점에서 실행 시 문제를
    일으키지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `_retry_state.json`(파일 2) 내 로컬 절대경로 — 확인 결과 미소비(dead field),
  기능적 위험 없음
  - 위치: `review/code/2026/08/01/03_47_10/_retry_state.json:2`(`session_dir`),
    `:4,6,7`(prompt/output 절대경로들), `:8,125-141`(`routing_status: "pending"`,
    `agents_pending` 전체 14개, `agents_success: []`)
  - 상세: 이 파일은 `/Volumes/project/private/clemvion/.claude/worktrees/deps-guard/...` 로
    시작하는 로컬 워크트리 절대경로를 다수 담고, 실제로는 라운드가 완료됐음에도 **세션 시작
    시점의 초기 스냅샷**(모든 에이전트 pending, 성공 0건)이 그대로 커밋돼 있다.
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 를 grep 한 결과
    `session_dir` 필드는 기록(write) 1곳뿐이고 어디서도 다시 읽지 않음을 확인했다 —
    `--resume` 은 CLI 인자로 받은 경로를 직접 사용하며 내부 JSON 의 `session_dir` 필드에
    의존하지 않고, resume 시에는 디스크에 실제로 존재하는 리포트 파일로 상태를
    재조정(reconcile)하는 코드 경로가 있다. 따라서 이 stale "pending" 스냅샷이 다른 머신/클론에서
    잘못된 재실행(spurious agent invocation)을 유발할 경로는 없음을 코드 추적으로 확인했다.
  - 제안: 조치 불요(확인 완료, 기록 목적).

## 요약

`scripts/check-override-floors.py`는 완전 신규 파일이라 기존 호출자·시그니처를 깨뜨릴 위험이
없고, 전역 변수는 런타임에 읽기 전용으로만 쓰이며(`global` 선언 없음), 파일시스템은
`pnpm-workspace.yaml` 읽기 1회 외에 건드리지 않고, 새 환경 변수 도입도 없다(직전 라운드가
이미 확인한 이 사실들은 이번 델타로 바뀌지 않았다). 유일한 의도된 부작용(`pnpm audit`
네트워크 호출)은 여전히 테스트 스텁으로 완전히 격리돼 있다. 이번 델타(5차 수정)가 새로 들여온
코드 두 곳 — `_AUDIT_TIMEOUT_SEC` 타임아웃 처리와 `overrides` 키 부재 가드 — 중 전자는 프로세스
정리 관점에서 안전함을 확인했으나, 후자는 **"키가 아예 없는 경우"만 막고 "키는 있지만 값이
비어있는(null) 경우"는 놓치는 gap 이 있음을 실제 모듈 실행으로 재현했다** — 방금 이 라운드가
막으려던 것과 정확히 같은 성격("설정 파싱 실패가 취약점 0건과 구별되지 않는 성공"의 실패 클래스)의
잔여 취약 지점이다. 나머지 10개 파일(리뷰 산출물)은 정적 문서/상태 파일로, 내용에 로컬 절대경로가
섞여 있으나 orchestrator 코드 추적으로 미소비(dead field)임을 확인해 기능적 위험은 없다.

## 위험도

MEDIUM
