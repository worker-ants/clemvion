# Security Review — deps-guard-hardening (9차 라운드)

## 리뷰 범위 및 방법

이번 라운드(`05_36_28`) 페이로드는 41개 리뷰 산출물 파일(5~8차 `/ai-review` 세션의 markdown/JSON
스냅샷)과 `scripts/check-override-floors.py` 1개 소스 파일로 구성된다. 프롬프트가 크기 제한으로 이
소스 파일의 diff/전체 컨텍스트를 모두 생략했으므로(파일 42), `git log`/`git show`/`Read`로
작업트리를 직접 대조해 검증했다.

- `git log --oneline -5` 로 최신 커밋이 `614d72ba3`("8차 리뷰 조치 — flaky 스텁을 구조로 제거 +
  sorted 회귀 테스트")임을 확인.
- `git show 614d72ba3 -- scripts/check-override-floors.py` 로 이번 라운드가 실제로 다루는
  순델타를 직접 추출(`.claude/tests/test_override_floors.py`·`plan/in-progress/deps-guard-hardening.md`
  변경은 코드 리뷰 게이트 스코프 밖 — 1~8차 라운드가 반복 확인한 `.claude/**` 제외 정책과 일치).
- 직전(8차) 보안 리뷰 `review/code/2026/08/01/04_58_18/security.md`(LOW, INFO 4건)를 직접 열람해,
  그 라운드가 새로 지적한 관측 2건이 이번 델타로 조치됐는지 대조.
- `scripts/check-override-floors.py` 전체(366줄)를 `Read`로 직접 열람해 인젝션·시크릿·인증·
  암호화·에러 처리 표면을 재확인.

## 발견사항

- **[INFO]** (조치 확인, 긍정 관측) `load_override_targets()`의 `path.read_text()`가 이번
  델타로 `try/except` 보호 범위 **안**으로 들어와, `UnicodeDecodeError`/`OSError`도
  `yaml.YAMLError`와 동일하게 `_undecidable()`(exit 2, fail-closed)로 라우팅된다 — 직전(8차)
  보안 리뷰가 지적한 정확히 그 갭이 해소됐다.
  - 위치: `scripts/check-override-floors.py:128-135` (`load_override_targets()`)
  - 상세: 이전 버전은 `text = path.read_text(encoding="utf-8")`가 `try` 블록 **밖**에 있어,
    `pnpm-workspace.yaml`이 유효하지 않은 UTF-8 바이트를 담고 있으면(에디터 오설정·머지 충돌
    산물 등) `UnicodeDecodeError`가 처리되지 않은 traceback과 함께 파이썬 기본 종료 코드
    **1**로 전파됐다 — 이 스크립트 어휘에서 1은 "침식 발견"이라, 파일 인코딩 문제가 정상 발견
    신호와 같은 코드로 혼동될 여지가 있었다(8차 보안 리뷰가 실제로 이 좁은 갭을 신규 INFO로
    지적). 이번 델타는 `read_text()` 호출 자체를 `try` 블록 안으로 옮기고 `except` 절을
    `(yaml.YAMLError, UnicodeDecodeError, OSError)` 3종으로 확장해 "설정 파일을 읽거나
    파싱하지 못하면 무조건 exit 2"라는 단일 불변식으로 통합했다. `OSError` 추가는 `main()`이
    이미 `WORKSPACE_YAML.exists()`를 선행 검사하지만(`:277-279`, 파일 완전 부재는 별도
    경로), 존재 확인과 읽기 사이의 권한 변경·`IsADirectoryError` 류의 잔여 I/O 실패까지
    fail-closed로 포섭한다. `_undecidable`은 `NoReturn`이라 `except` 이후 코드(`:136`)는
    `data`가 정상 할당됐다고 안전하게 가정할 수 있다 — 타입 계약 위반 없음. 노출되는 예외
    메시지(`type(exc).__name__: {exc}`)도 예외 클래스명과 파이썬 표준 오류 문구뿐이라
    민감 정보 노출로 이어지지 않는다.
  - 제안: 조치 완료로 판단. 추가 조치 불요.

- **[INFO]** (재확인, 5~8차와 동일 판단·변경 없음) 실패 진단 경로에서 서브프로세스 raw 출력·
  예외 메시지 일부를 CI 로그(stderr)에 그대로 노출
  - 위치: `scripts/check-override-floors.py:135` (`f"  {type(exc).__name__}: {exc}"`),
    `:197` (`stderr={proc.stderr[:_STDERR_PREVIEW]}`), `:202` (`out[:_STDOUT_PREVIEW]`),
    `:208` (`받은 키: {list(data)[:_KEY_PREVIEW] ...}`)
  - 상세: `pnpm audit --json`의 stdout/stderr 원문 일부(최대 2000/500자)와 YAML/OS 예외
    메시지를 그대로 stderr(CI 로그)에 출력하는 패턴은 이번 델타로도 유지된다. `:135`는
    이번에 `type(exc).__name__`이 추가됐지만 노출 내용은 예외 클래스명뿐이라 민감도가 늘지
    않았다. `pnpm-workspace.yaml`에 private registry/`_authToken` 설정이 없어(1~8차에 걸쳐
    반복 확인됨) 현재 이 경로가 실제 토큰을 담을 가능성은 낮다. 1~8차 리뷰에서 반복 확인된
    저위험 관찰이며 자매 스크립트 `check-pnpm-security-config.py`와 동일 관례.
  - 제안: 조치 불요(기존 결론 유지). 향후 private registry 도입 시 토큰/Basic-Auth URL 패턴
    redaction을 preview 적용 전에 추가할 것.

- **[INFO]** (재확인, 5~8차와 동일 판단·변경 없음) `pnpm` 바이너리를 PATH 기반 이름으로
  호출(절대경로 미사용)
  - 위치: `scripts/check-override-floors.py:178`
    (`subprocess.run(["pnpm", "audit", "--audit-level=moderate", "--json"], ...)`)
  - 상세: `shell=True` 미사용 + 리스트 인자 호출이라 커맨드/인자 인젝션은 없다. CI 환경 PATH
    오염 시나리오에서만 이론적 의미가 있으며 저장소 전반의 기존 관례와 일치. 이번 델타는 이
    호출부를 건드리지 않았다.
  - 제안: 별도 조치 불요.

- **[INFO]** (재확인, 8차와 동일 판단·변경 없음) 리포트 출력 함수가 advisory/override
  파생 값을 새니타이징 없이 CI 로그에 출력 — 이론적 로그 위조(CWE-117 인접) 표면, 실효
  위험 매우 낮음
  - 위치: `scripts/check-override-floors.py:243` (`reported[module] = str(...)`),
    `:250` (`paths = [r.get("path", "?") ...]`), `:333-336` (`_report_widened`),
    `:352-355` (`_report_eroded`)
  - 상세: `module`/advisory id/path/override 키 값을 이스케이프 없이 `print(...)`로
    stderr에 쓴다. npm 패키지명 문자셋 제약(개행·제어문자 불허)과 값의 출처(레지스트리
    큐레이션 데이터 + 로컬 저장소 설정)로 실제 발현 가능성은 매우 낮다. 이번 델타는 이 코드
    경로를 변경하지 않았다 — 8차 보안 리뷰가 이미 이 등급으로 판단한 항목의 연장.
  - 제안: 조치 불요.

## 그 외 확인 (이상 없음)

- **인젝션**: `subprocess.run` 전 지점(`:177-186`) 리스트 인자 + `shell=True` 미사용.
  `eval`/`exec`/`os.system`/`pickle`/`marshal`/`__import__` 매칭 0건(재확인). `yaml.safe_load()`
  (`:131`)와 `json.loads()`(`:200`)만 사용 — 안전하지 않은 `yaml.load()` 패턴 없음. SQL/XSS/
  LDAP/경로 탐색 표면 자체가 없다(웹/DB 접점이 없는 CLI 스크립트, 경로는 `REPO_ROOT` 기준
  고정 상수만 사용).
- **하드코딩된 시크릿**: 스크립트 및 이번 페이로드의 리뷰 산출물 전체에서 API 키/토큰/
  비밀번호/인증서 패턴 없음. `EXPECTED_SUPPRESSED_PATHS`(`:63-69`)는 CVE ID·의존성 체인
  경로일 뿐 시크릿이 아니다.
- **인증/인가**: 해당 없음 — 사용자 대면 서비스가 아닌 CI 전용 로컬 스크립트, 세션/권한
  경계가 없다.
- **입력 검증**: `load_override_targets()`(`:120-152`)가 파일 I/O·YAML 파싱 실패,
  `overrides` 키 부재/오타/값 없음/비매핑을 단일 `isinstance` 조건(`:136-148`)으로,
  `run_audit()`(`:168-210`)이 subprocess timeout(`:185`, 300초)·빈 출력·JSON 파싱 실패·
  `actions` 키 부재를 각각 fail-closed로 검증한다. `_undecidable(` 호출부는 정의부(`:155`)
  제외 9곳.
- **OWASP Top 10(일반)**: 안전하지 않은 역직렬화(A08 계열) 회피(`safe_load`), 보안 설정
  오류 방지가 이 스크립트의 존재 목적 자체(A05/A06 계열 대응 도구). 신규 결함 없음.
- **암호화/평문 전송**: 해당 없음. 네트워크 호출은 `pnpm audit`(HTTPS, 프로토콜을 스크립트가
  직접 처리하지 않음) 하나뿐.
- **의존성 보안**: 신규 외부 의존성 없음(PyYAML은 자매 스크립트가 이미 쓰는 기존 의존성 재사용,
  major 고정). 이 스크립트 자체가 의존성 취약점 관리 도구.
- **회귀 검증**: `git show 614d72ba3 -- scripts/check-override-floors.py` 대조 결과
  `subprocess.run`/`yaml.safe_load`/`json.loads` 호출 형태는 전혀 변경되지 않아 보안 관점
  회귀가 없다.
- **테스트 인프라(스코프 밖, 참고 확인)**: 같은 커밋의 `.claude/tests/test_override_floors.py`
  변경(스텁 `pnpm` 원자적 rename 배치 + 실행 마커 검증)은 flaky 테스트를 구조적으로 막기 위한
  테스트 하네스 강화로, 프로덕션 코드나 CI 트리거 조건을 변경하지 않는다 — 보안 관점 영향 없음.

## 요약

이번 9차 라운드에서 `scripts/check-override-floors.py`에 실제로 남은 코드 델타(커밋
`614d72ba3`)는 `load_override_targets()`의 파일 읽기(`path.read_text()`)를 YAML 파싱과 같은
예외 처리 블록으로 통합하고 `UnicodeDecodeError`/`OSError`까지 fail-closed 경로로 포섭한 것이
핵심이다 — 이는 직전(8차) 보안 리뷰가 지적한 신규 관측을 정확히 해소하는 안전 방향 강화이며
보안 관점 회귀는 없다. `subprocess.run`은 여전히 `shell=True` 없이 리스트 인자로만 호출되고,
YAML/JSON 파싱도 안전한 API(`yaml.safe_load`/`json.loads`)만 사용한다. 인젝션·하드코딩
시크릿·인증/인가·암호화 관점에서 전통적 취약점 표면은 8차까지 이어 이번 라운드에도 없다.
잔여 관찰 사항은 1~8차에 걸쳐 반복 확인된 저위험 INFO 3건(서브프로세스 원문/예외 메시지 CI
로그 노출, PATH 기반 `pnpm` 호출, 리포트 출력 값 미새니타이징에 의한 이론적 로그 위조
표면)이며 전부 이번 델타로 변경되지 않은 기존 코드 경로에 대한 것으로 우선순위는 낮다.
리뷰 산출물 41개(5~8차 세션의 정적 markdown/JSON)에도 시크릿 혼입이나 실행 가능한 코드
표면이 없다. Critical·Warning 수준의 보안 결함은 발견되지 않았다.

## 위험도

LOW — Critical·Warning 없음. 9차 연속 동일 결론(5·7·8차와 동일 LOW, 6차 WARNING은 이후
라운드에서 이미 해소 확인됨). 이번 라운드의 유일한 실 코드 변경은 직전 라운드가 지적한 INFO
갭을 닫는 안전 방향 강화다.
