# 유지보수성(Maintainability) 리뷰

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_detection.py`

## 발견사항

- **[WARNING]** `_read_payload()` 와 "fail-open evaluate" 블록이 형제 훅 파일과 바이트 단위로 중복
  - 위치: `guard_review_before_push.py` L220-227(`_read_payload`), L558-580(`main()` 의 REVIEW/PLAN 게이트 각각의 `try: X() except Exception: traceback.print_exc(...); X = None` 블록). 비교 대상: `.claude/hooks/guard_review_before_stop.py` L79-86, L245-267 (동일 구조, 동일 함수명).
  - 상세: `_read_payload()` 는 두 파일에 완전히 동일한 8줄짜리 구현으로 각각 존재한다. 또한 "환경변수 우회 확인 → try/except로 감싼 evaluate 호출(실패 시 traceback 출력 후 `None`으로 fail-open) → 조건 만족 시 메시지 출력" 골격이 `guard_review_before_push.py` 내부에서 REVIEW/PLAN 두 게이트로 2회, `guard_review_before_stop.py` 에서 다시 2회, 총 4회 반복된다. 두 훅은 이미 `_lib/`(`review_guard.py`, `plan_guard.py`)를 공유 임포트하고 있어 결합도를 늘리지 않고도 `_read_payload`·"fail-open 호출" 같은 순수 유틸을 `_lib/`로 옮길 구조적 여지가 이미 갖춰져 있다.
  - 제안: `_lib/`에 예: `hook_io.py`(`read_payload()`) 또는 기존 모듈에 `evaluate_fail_open(fn)` 같은 얇은 헬퍼를 추가해 두 훅에서 임포트. 한쪽만 고쳐지고 다른 쪽이 드리프트하는 것을 예방(예: JSON 파싱 엣지케이스 수정이 한 파일에만 반영되는 사고).

- **[INFO]** 세션별 "Critical #N / WARNING #N" 소급 주석이 인라인에 계속 누적되는 추세
  - 위치: 파일 전반에 약 20곳 분산 (예: L66, L70, L97, L136, L152, L235, L297, L307, L345, L370, L411, L419). 특히 `_is_git_push` 는 docstring 이 ~53줄인 반면 실제 코드 본문은 ~28줄.
  - 상세: 이 파일은 이미 3회의 리뷰 세션(`17_09_10`, `18_04_20`, 현재 `19_15_56`)을 거쳤고, 매 회 "Critical #N"/"WARNING #N" 발견과 근거 측정치를 코드 인라인 주석으로 영구 기록하는 패턴이 반복되고 있다. 회귀 방지 근거 기록으로서는 유효하고(예: L111 "f4489d314 ... had to walk back after being measured and found wrong — do not reintroduce that pattern"), 이 프로젝트의 guard/hook 모듈 전반이 원래 rationale-heavy 서술을 관례로 삼고 있음도 `plan_guard.py` 모듈 docstring 등으로 확인된다 — 즉 방향성 자체는 기존 컨벤션과 일치한다. 다만 같은 디렉토리의 다른 훅(`guard_review_before_stop.py` 12KB)과 비교해 이 파일만 27KB로 확연히 크며, 이는 세션마다 이력이 코드에 계속 쌓이는 구조 때문이다. 다음 리뷰 라운드에서도 같은 방식으로 "Critical #5", "WARNING #4" 가 추가되면 코드 본문 대비 주석 비율이 더 벌어질 수 있다.
  - 제안: 지금 당장 조치가 필요한 결함은 아니다. 다만 향후에는 "왜 이렇게 했는가"의 핵심 불변식만 인라인에 남기고, 세션별 상세 측정 이력(git 2.50.1 측정치, 특정 세션 디렉토리 참조 등)은 전용 문서(예: `.claude/docs/push-guard-parsing.md`)로 옮겨 인라인에서는 짧은 포인터만 남기는 편이 장기 가독성에 유리할 수 있다.

- **[INFO]** "plan 의 잔여 한계 섹션" 참조가 구체 경로를 명시하지 않음
  - 위치: L287("See the plan's "잔여 한계" section"), L474 부근(동일 문구)
  - 상세: 두 곳 모두 "the plan" 이라고만 지칭하고 파일 경로를 적지 않는다. 현재는 `plan/in-progress/harness-session-anchor-guards.md`(grep 으로 확인, "잔여 한계" 섹션 보유)를 가리키는 것으로 보이나, 코드만 읽는 독자는 이를 특정할 수 없고, 이 plan 이 프로젝트 관례대로 `plan/complete/` 로 이동한 뒤에는 더욱 추적이 어려워진다(파일명이 아예 안 적혀 있어 이동 후에도 "링크가 깨졌다"는 신호조차 없다).
  - 제안: 참조 시 최소한 plan 파일명을 명시(`plan/in-progress/harness-session-anchor-guards.md` 등 상대경로).

- **[INFO]** `main()` 의 REVIEW/PLAN 게이트 블록이 거의 동형 반복 (파일 내부)
  - 위치: `guard_review_before_push.py` L557-580
  - 상세: 두 게이트 블록이 "환경변수 우회 확인 → try/except fail-open → 조건 만족 시 메시지 포맷 후 `return 2`" 골격을 그대로 반복한다. `guard_review_before_stop.py` 의 동일 위치도 같은 골격이라 이 훅 계열의 기존 컨벤션과는 일관적이며, 스톱훅 쪽은 스로틀링·억제(`_suppress_for_resolution`)·문구 분기가 섞여 있어 완전히 매끈한 공통 헬퍼 추출은 아닐 수 있다.
  - 제안: 위 첫 번째 항목의 `_lib` 헬퍼 추출과 함께 검토할 여지는 있으나 시급하지 않음.

- **[INFO]** exit 코드 0/2 가 `main()` 전반에 리터럴로 산재
  - 위치: `main()` L555, L566, L580, L582
  - 상세: 모듈 docstring 상단에 "exit 0 → allow, exit 2 → block" 계약이 명문화돼 있어 당장 오독 위험은 낮다. 다만 형제 파일 `guard_review_before_stop.py` 는 동일 성격의 계약을 `_allow()` / `_block(reason)` 명명 헬퍼로 감싸 각 반환 지점을 자기설명적으로 만든 반면, 이 파일은 리터럴 `return 0` / `return 2` 를 그대로 사용한다.
  - 제안: 대칭성·자기설명성을 위해 동일한 `_allow()` / `_block(msg)` 헬퍼 도입을 고려할 수 있음(경미, 선택적).

## 판단 근거로 확인한 사항 (발견사항 아님)

- `_MAX_RECURSION_DEPTH = 4`, `0x20`(제어문자 임계값) 등은 리터럴이지만 이름이 붙어 있거나(전자) 관용적으로 자명한 상수(후자, ASCII 제어문자 경계)라 "매직 넘버" 로 지적하지 않음.
- `_find_command_substitutions`(균형 괄호 스캔, 중첩 while+if 최대 4단)와 `_git_subcommand`(옵션 분류 상태기계, 분기 ~8-9개)는 순환 복잡도가 파일 내에서 가장 높지만, 문제(balanced-paren 매칭, git 옵션 파싱)의 본질적 복잡도이고 각각 전용 테스트 클래스(`CommandSubstitutionExtractionTest`, `IsGitPushTest`/`GitOptsWithValueRegressionTest`/`GitOptsNoValueTest`)로 촘촘히 테스트되어 있어 별도 CRITICAL/WARNING으로 지적하지 않음.
- `main()`의 게이트 중복(위 INFO 항목)을 제외하면 함수 길이는 모두 30줄 이내, 네이밍은 `snake_case` + 모듈-비공개 `_` 접두 규약을 전 파일 걸쳐 일관되게 유지.
- `test_push_detection.py`(621줄)는 파일 자체는 크지만 `MUST_BLOCK`/`MUST_ALLOW`/`ORDINARY_SHELL_COMMANDS`/`INDIRECT_EXECUTION_CASES` 테이블 기반 데이터 + `subTest` 조합과 명확한 클래스 경계(9개 테스트 클래스, 클래스당 단일 관심사)로 잘 조직되어 있음. 테스트 메서드명이 매우 길지만(`test_every_legacy_block_is_still_blocked_or_an_acknowledged_exception` 등) 파일 자체의 기존 스타일과 일관되고, 실패 시 그 자체로 설명이 되는 방향이라 감점 요인으로 보지 않음. `_INTENTIONAL_FLIPS` 딕셔너리는 stale-entry 가드(`test_every_intentional_flip_is_actually_exercised`)까지 갖춰 회귀에 강함.
- 두 파일 모두 미사용 import·죽은 코드 없음.

## 요약

두 파일 모두 함수가 짧고 단일 책임을 가지며 네이밍·구조가 코드베이스의 기존 훅(`guard_review_before_stop.py`, `plan_guard.py`) 관례와 일관적이어서 전반적인 가독성과 유지보수성은 양호하다. 가장 구체적인 개선 여지는 `_read_payload()`와 "fail-open evaluate" 블록이 형제 훅 파일과 완전히 동일하게 중복돼 있다는 점으로, 이미 `_lib/`를 공유 임포트하는 구조가 있는 만큼 저비용으로 정리 가능하다. 그 밖에는 3회에 걸친 리뷰 세션 이력이 인라인 주석(특히 `_is_git_push`)에 계속 누적되는 추세, plan 참조 문구에 파일 경로 미기재, exit 코드 리터럴 산재 등 경미한 개선 여지가 있으나 모두 INFO 수준이며 당장 기능이나 팀의 코드 이해에 지장을 주지 않는다. 순환 복잡도가 다소 높은 두 함수(`_find_command_substitutions`, `_git_subcommand`)는 문제 자체의 본질적 복잡도이고 전용 테스트로 충분히 방어되어 있어 우려하지 않는다.

## 위험도

LOW
