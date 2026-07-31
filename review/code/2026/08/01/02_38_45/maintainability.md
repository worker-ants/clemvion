# 유지보수성(Maintainability) 리뷰 — deps-guard-hardening (3차 라운드)

## 발견사항

- **[WARNING]** 테스트 헬퍼 `run_with_stub_audit` 가 가짜 `pnpm` 실행파일의 소스를 중첩 f-string +
  `json.dumps()` 임베딩으로 동적 생성한다 — 이 저장소가 이미 갖고 있는 더 단순한 관례(정적 스텁 +
  외부 파라미터화)를 따르지 않는다.
  - 위치: `.claude/tests/test_override_floors.py:48`(함수 시작) ~ `:74-99`(`body = (...)` 부터
    `fake.write_text(...)` 까지).
  - 상세: `body` 는 `raw_stdout` 유무에 따라 두 경로로 갈리는데, 정상 경로는 `{{`/`}}` 이스케이프가
    필요한 f-string 안에 `json.dumps(actions)`·`json.dumps(advisories)` 결과를 다시 문자열로
    끼워 넣고, `textwrap.dedent` 로 다듬은 뒤 별도 헤더 문자열과 `+` 로 이어붙인다(97행 주석이
    "dedent 후 이어붙인다 — body 도 이미 0-indent 다" 라고 굳이 설명해야 할 만큼 눈으로 따라가기
    번거롭다). 반면 같은 스위트의 다른 "PATH 에 가짜 실행파일을 올리는" 테스트
    (`test_mermaid_lint_ready.py:42` 의 `_NODE_STUB`)는 **고정** 모듈 상수를 쓰고, 실행 시 필요한
    값(`NODE_CALL_LOG`, `NODE_EXIT_CODE`)은 환경변수로 주입한다 — 스텁 소스 자체는 절대 동적으로
    조립되지 않는다. `run_with_stub_audit` 만 이 패턴에서 벗어나, advisories/actions 처럼 구조화된
    값을 넣어야 할 때 유일하게 "생성되는 파이썬 소스 안에 데이터를 문자열로 박아 넣는" 방식을
    택했다. 지금은 테스트가 전부 통과하지만, 다음에 payload 형태를 확장(예: 새 필드 추가)할 사람이
    이스케이프 규칙을 다시 이해해야 하고, 중괄호 개수를 하나 놓치면 생성된 `pnpm` 스텁이
    SyntaxError 로 죽어 실패 원인이 "가짜 실행파일 자체가 깨졌다"는 한 단계 더 간접적인 형태로
    나타난다.
  - 제안: `advisories`/`actions`(또는 `raw_stdout`)를 테스트 프로세스에서 직접 `json.dump()` 로
    tmp 파일에 쓰고, `pnpm` 스텁은 `_NODE_STUB` 처럼 고정 문자열로 둔 뒤 그 파일 경로만
    환경변수(예: `AUDIT_RESPONSE_FILE`)로 넘겨 읽어 그대로 stdout 에 출력하게 바꾸면 문자열
    조립·이스케이프가 전부 사라진다.

- **[INFO]** `OVERRIDES` 리터럴이 두 클래스에 완전히 동일한 문자열로 중복된다 — 2차 리뷰
  (`review/code/2026/08/01/01_56_46/maintainability.md`)의 동일 지적이 이번 라운드에도 그대로
  남아 있다(당시 "우선순위 낮음"으로 명시돼 지금 막을 이유는 아니다).
  - 위치: `.claude/tests/test_override_floors.py:196`(`ClassificationTest.OVERRIDES`), `:337`
    (`MultipleMatchTest.OVERRIDES`) — 둘 다
    `"overrides:\n  liquidjs: ^10.27.1\n  next>postcss: ^8.5.18\n"` 로 문자 그대로 동일.
  - 상세: 2차 리뷰가 지적한 WARNING 3건(`main()` 조기 return 제거·헬퍼 모듈화·"세 축→네 축" 서술
    정정)은 이번 라운드에서 전부 반영된 것으로 확인했다. 이 INFO 항목만 미반영 상태다. 우연히
    지금은 두 값이 일치하지만, 둘 중 하나만 고치는 편집(예: `liquidjs` 버전 갱신)이 나머지 하나를
    조용히 낡게 만들 수 있다.
  - 제안: 모듈 레벨 상수(예: `_TWO_PACKAGE_OVERRIDES_YAML`)로 추출해 두 클래스가 공유.

- **[INFO]** `run_audit()` 의 fail-closed 분기 3곳이 "사유 출력 + 진단 출력 + `sys.exit(2)`" 구조를
  그대로 반복한다.
  - 위치: `scripts/check-override-floors.py:124`(`run_audit` 함수 시작) — 분기는 `:139-146`(빈
    stdout), `:147-152`(JSON 파싱 실패), `:153-161`(`actions` 키 부재).
  - 상세: 세 블록 모두 "사유 한 줄 출력 → 진단 정보 한 줄 출력 → `sys.exit(2)`" 형태가 동일하고,
    `sys.exit(2)` 가 세 곳에 각각 하드코딩돼 있다. 지금은 문제없지만, 네 번째 "판단 불가" 사유가
    추가될 때 그 블록에서 `sys.exit(2)` 를 빠뜨리면(=정상 흐름으로 새 버림) 이 스크립트 자신이
    막으려는 "판단 불가를 취약점 0건으로 오인하는" 바로 그 실패 클래스를 재현하게 된다.
  - 제안: `_undecidable(reason: str, detail: str) -> NoReturn` 같은 작은 헬퍼로 묶어 세 지점 모두
    같은 함수를 거치게 하면, 실수로 exit 코드를 빠뜨릴 여지가 구조적으로 줄어든다.

- **[INFO]** `eroded` 를 필드 이름 없는 4-tuple(`module, advisory, patched, keys`)로 만들어 다른
  함수에서 위치 기반으로 언패킹한다.
  - 위치: `scripts/check-override-floors.py:229-232`(`main()` 에서 tuple 생성)와 `:272-282`
    (`_report_eroded()` 에서 `for module, advisory, patched, keys in sorted(eroded):` 로 소비).
  - 상세: 현재는 생성부와 소비부가 한 파일 40여 줄 이내에 붙어 있어 당장 헷갈릴 위험은 낮지만,
    타입 힌트(`list[tuple[str, str, str, list[str]]]`)만 봐서는 각 자리가 advisory ID 인지 patched
    버전인지 알 수 없다. 같은 파일의 `widened`(2-tuple, `module, extra`)는 이 정도로 불투명하지
    않지만, 4-tuple 은 필드가 하나만 더 늘어도 순서 실수에 취약해지는 지점이다.
  - 제안: `typing.NamedTuple`(예: `class ErodedEntry(NamedTuple): module: str; advisory: str;
    patched: str; keys: list[str]`)로 바꾸면 생성부·소비부 양쪽에서 필드 의미가 자체 문서화된다.

- **[INFO]** 임시 디렉터리에 스크립트를 복사해 서브프로세스로 실행하는 셋업 코드가
  `run_with_stub_audit` 과 `test_missing_workspace_file_is_undecidable` 사이에 중복된다.
  - 위치: `.claude/tests/test_override_floors.py:64-70`(`run_with_stub_audit` 내부 — tmp 디렉터리
    생성·`scripts/` 생성·`SCRIPT` 내용 복사) vs `:320-329`(같은 3단계를 별도로 반복하는
    `FailClosedTest.test_missing_workspace_file_is_undecidable`).
  - 상세: 후자는 `pnpm-workspace.yaml` 을 일부러 두지 않는 케이스라 `run_with_stub_audit` 을 그대로
    쓸 수 없어 손으로 다시 짠 것으로 보이는데, "tempdir 만들고 `scripts/` 만들고 `SCRIPT` 내용을
    복사하는" 앞부분은 두 곳에서 문자 그대로 같다.
  - 제안: `run_with_stub_audit` 에 워크스페이스 파일 생성을 건너뛸 수 있는 옵션을 추가하거나, 공통
    부분만 `_stage_script(tmp)` 같은 헬퍼로 뽑아 두 곳이 공유하게 할 것.

- **[INFO]** `audit["advisories"]` 를 `classify_vulnerable()` 과 `main()` 이 각각 한 번씩 순회한다
  — 2차 리뷰에서 이미 지적됐고("우선순위 낮음") 이번에도 그대로 남아 있다.
  - 위치: `scripts/check-override-floors.py:188`(`classify_vulnerable()` 의 `reported` 구성 루프,
    함수는 `:165`부터) vs `:211-215`(`main()` 의 `patched_by_module` dict comprehension).
  - 상세: 기능·성능 문제는 없다(항목 수가 audit 결과 수십 건 수준). `classify_vulnerable()` 이
    돌려주는 `reported: dict[str, str]` 의 값 타입을 `(advisory_id, patched_versions)` 로
    확장했다면 `main()` 쪽 두 번째 순회가 필요 없었을 것이라는 구조적 여지만 남아 있다.
  - 제안: 우선순위 낮음 — 다음에 이 함수를 손댈 때 고려.

## 요약

이번 라운드는 1·2차 리뷰가 지적한 유지보수성 항목을 성실히 반영했다 — 2차 리뷰의 CRITICAL
(`harness-checks.yml` 의 중복 YAML 키로 PyYAML 설치 스텝이 소실된 구조적 결함)과 WARNING 3건
(`main()` 의 `widened` 조기 return 제거 및 "모아서 한 번에 보고"로 통일·테스트 헬퍼를 클래스
인스턴스 메서드에서 모듈 레벨 함수로 승격·"세 축" ↔ "네 축" 자기모순 서술 정정)이 실제 코드에서
전부 해소됐음을 현재 파일을 직접 읽어 확인했다. `scripts/check-override-floors.py` 는 함수가
짧고 단일 책임을 지키며, 이전 라운드에서 지적된 매직 넘버(`500`/`2000`/`10`)도 `_STDERR_PREVIEW`
등 이름 있는 상수로 옮겨졌고, exit code 관례(0/1/2)·에러 메시지 문구·`EXPECTED_*` 네이밍이
자매 스크립트 `check-pnpm-security-config.py` 와 일관된다. `.claude/tests/test_override_floors.py`
는 네 축(키 추출·분류·억제 경로 baseline·fail-closed)을 클래스 단위로 분리하고 각 테스트가 실제
과거 회귀와 연결된 docstring을 갖고 있어 읽기 좋다. 신규 `test_workflow_yaml_structure.py` 도
헬퍼-검출기-`DetectorTest` 3단 구조가 명확하다. 남은 항목은 전부 INFO 또는 하나의 WARNING 수준의
개선 여지로, 그중 유일한 WARNING(가짜 `pnpm` 스크립트를 f-string 으로 동적 조립하는 테스트 헬퍼가
이 스위트의 기존 "정적 스텁 + 환경변수 파라미터화" 관례에서 벗어남)을 제외하면 대부분 2차 리뷰에서
이미 "우선순위 낮음"으로 분류된 항목이 그대로 남아있는 수준이다. `review/code/2026/08/01/{01_12_24,
01_56_46}/**` (SUMMARY.md·meta.json·_retry_state.json·per-agent 리포트)와 `plan/in-progress/
deps-guard-hardening.md`·`PROJECT.md`·`.github/dependabot.yml`·`pnpm-workspace.yaml` 은 확인한
결과 자동 생성 산출물이거나 설정/문서 파일이라 함수 길이·중첩 깊이 같은 코드 유지보수성 기준이
적용되지 않으며, 별도로 지적할 구조적 문제는 없었다. 병합을 막을 항목은 없다.

## 위험도

LOW
