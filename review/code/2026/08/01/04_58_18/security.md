# Security Review — deps-guard-hardening (8차 라운드)

## 리뷰 범위 및 방법

이번 라운드 페이로드는 31개 파일이다: 5차(`03_47_10`)·6차(`04_09_43`)·7차(`04_35_33`) `/ai-review`
세션 산출물 각 10개(총 30개, `SUMMARY.md`/`_retry_state.json`/`meta.json`/에이전트별 리포트 9종)와
`scripts/check-override-floors.py`(실제 소스, 363줄) 1개. 프롬프트가 크기 제한으로 파일 31의 diff·
전체 컨텍스트를 생략했으므로 `Read`로 작업트리의 현재 파일을 직접 열어 검증했다. 이 파일은 이미
7차례 리뷰-조치 사이클(`3ff26348c`~`fdc7ad801`)을 거친 상태이며, 7차 리뷰(testing 관점, WARNING 2건
— `main()`의 `widened` 필터 루프 무검증 + `sorted()` TypeError)를 조치한 커밋
`fdc7ad801`("7차 리뷰 조치")이 반영된 **이후** 상태가 이번 라운드의 실제 검토 대상이다.

추가로 직접 확인했다:
- `git show fdc7ad801 -- scripts/check-override-floors.py` — 실제 코드 델타는 `sorted(data)` →
  `sorted(data, key=str)` 1줄뿐(나머지는 `.claude/tests/test_override_floors.py`에 테스트만 추가).
  보안 관점 회귀 없음.
- `.github/workflows/deps-security-checks.yml` — 트리거가 `pull_request`(`pull_request_target` 아님)
  + `push(main)` + `schedule`뿐이라 포크 PR에 시크릿이 노출되는 권한 상승 경로 없음. `override-floors`
  잡은 `timeout-minutes: 10`.
- `pnpm-workspace.yaml`에 private registry/`_authToken`/`registry=` 설정 없음(재확인) — 아래 INFO 1의
  실제 발현 가능성 판단 근거.
- 리뷰 산출물 30개(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33}/*`) 전체에 대해 직접
  `grep -rniE "api[_-]?key|secret|password|token|ghp_|sk-...|AKIA...|-----BEGIN"`를 재실행 — 매칭은
  전부 리뷰어 자신의 "토큰/시크릿 스캔했음"이라는 서술문 내부 언급뿐이고 실제 시크릿 값은 0건.
- `eval\(|exec\(|pickle|marshal|__import__|os\.system|shell=True` 매칭 0건(재확인).

## 발견사항

- **[INFO]** (재확인, 5~7차와 동일 판단) 실패 진단 경로에서 서브프로세스 raw 출력·YAML 예외 메시지
  일부를 CI 로그(stderr)에 그대로 노출
  - 위치: `scripts/check-override-floors.py:133`(`_undecidable(f"{path} 를 YAML 로 파싱하지 못했다:", f"  {exc}")`),
    `:195`(`f"  exit={proc.returncode} stderr={proc.stderr[:_STDERR_PREVIEW]}"`),
    `:200`(`_undecidable("...", out[:_STDOUT_PREVIEW])`)
  - 상세: fail-closed 진단을 위해 `pnpm audit --json`의 stdout/stderr 원문 일부(최대 2000/500자)와
    YAML 파싱 예외 메시지를 그대로 stderr에 출력한다. 정상 상황에서 자격증명 노출은 없으나, private
    registry 인증 실패 등 예외 케이스에서 레지스트리 응답에 토큰이 섞여 나올 가능성을 코드 레벨에서
    배제하지 않는다. 이번 라운드에 `pnpm-workspace.yaml`을 직접 재확인한 결과 private registry·
    `_authToken` 설정이 없어(공개 npm registry만 사용) 현재 이 경로가 실제로 토큰을 담을 가능성은
    낮다. `:133`의 YAML 예외 메시지는 파싱 대상이 외부 응답이 아니라 이미 git 추적되는 로컬 설정
    파일(`pnpm-workspace.yaml`)이라 노출 성격이 stdout/stderr 케이스와 다르다(내용이 이미 저장소에
    공개돼 있음). 1~7차 리뷰에서 반복 확인된 관찰이며 자매 스크립트 `check-pnpm-security-config.py`
    와 동일 관례.
  - 제안: 조치 불요(기존 결론 유지, 8차 연속 동일 판단). 향후 private registry를 도입하면 그 시점에
    알려진 토큰/Basic-Auth URL 패턴에 대한 redaction을 preview 적용 전에 추가할 것.

- **[INFO]** (재확인, 5~7차와 동일 판단) `pnpm` 바이너리를 PATH 기반 이름으로 호출(절대경로 미사용)
  - 위치: `scripts/check-override-floors.py:176`(`subprocess.run(["pnpm", "audit", "--audit-level=moderate", "--json"], ...)`)
  - 상세: `shell=True`를 쓰지 않고 리스트 인자로 호출하므로 인자/커맨드 인젝션은 없다. CI/빌드
    환경의 PATH가 오염되면(공급망 침해 시나리오) 이론상 악성 `pnpm`이 실행될 수 있으나, 저장소
    전반의 기존 관례와 일치하는 낮은 우선순위 관찰이다.
  - 제안: 별도 조치 불요.

- **[INFO]** (신규 관측) `pnpm-workspace.yaml` 읽기(`path.read_text`)가 YAML 파싱 예외 처리
  블록 바깥에 있어, 파일 인코딩 문제 시 이 스크립트가 스스로 경계하는 "exit 1 = 침식 발견"과
  "판단 불가"의 혼동이 좁은 조건에서 재현될 수 있다
  - 위치: `scripts/check-override-floors.py:127`(`text = path.read_text(encoding="utf-8")`, `try` 블록
    시작은 `:128`), 비교 대상 `:130`(`except yaml.YAMLError as exc:`)
  - 상세: `load_override_targets()`의 `try/except yaml.YAMLError`(128~130행)는 `yaml.safe_load(text)`
    호출만 감싸고, 그 직전 줄(127행)의 `path.read_text(encoding="utf-8")`은 이 보호 밖에 있다.
    `pnpm-workspace.yaml`이 유효하지 않은 UTF-8 바이트를 담고 있으면(에디터 오설정·머지 충돌 산물
    등으로 실무에서 드물게 발생) `UnicodeDecodeError`(`yaml.YAMLError`의 하위 클래스가 아닌
    `ValueError` 계열)가 이 함수 밖으로 그대로 전파되어 처리되지 않은 traceback과 함께 파이썬
    기본 종료 코드 1로 죽는다. 이 파일의 어휘에서 exit 1은 "침식 발견"을 의미하므로, 바로 위
    131~132행 주석("안 잡으면 traceback과 함께 exit 1로 죽는다 — 이 스크립트 어휘에서 1은 '침식
    발견'이라 구문 오류가 정상 발견 신호와 같은 코드가 된다")가 YAML **구문** 오류에 대해 명시적으로
    경계하는 바로 그 실패 형태가, 그보다 한 단계 앞선 **파일 인코딩** 오류에 대해서는 여전히 열려
    있다는 뜻이다. 핵심 안전 불변식("조용한 성공 없음")은 깨지지 않는다 — 비-0 종료는 유지된다 —
    는 점에서, 5차 리뷰(`requirement.md`)가 이미 INFO로 판정한 "6곳 밖 스키마 드리프트 시 미가공
    예외"와 정확히 같은 위험 등급이다. 1~7차 리뷰 산출물(문서화·요구사항·테스트·보안 라운드 포함)
    어디에도 이 구체적 트리거(파일 인코딩)가 명시적으로 언급된 적은 없어 신규 관측으로 판단한다.
  - 제안: 급하지 않음. 여유가 있으면 `text = path.read_text(encoding="utf-8")`를 `try` 블록
    안으로 옮기거나 `except (yaml.YAMLError, UnicodeDecodeError, OSError) as exc:`로 확장해 파일
    I/O 실패도 동일하게 exit 2(판단 불가)로 fail-closed 처리할 것을 권장.

- **[INFO]** (신규 관측, 낮은 실효 위험) 리포트 출력 함수가 `pnpm audit` 응답·override 키에서 뽑은
  값을 새니타이징 없이 그대로 CI 로그에 출력 — 로그 위조(CWE-117류) 표면이 이론상 존재하나 npm
  패키지명 문자셋 제약으로 사실상 차단됨
  - 위치: `scripts/check-override-floors.py:241`(`reported[module] = str(adv.get("github_advisory_id") or adv.get("id") or name)`),
    `:248`(`paths = [r.get("path", "?") for r in (action.get("resolves") or [])]`),
    `:331-334`(`_report_widened`의 `print(f"\n  [{module}] 신규 경로 {len(extra)}건", ...)` 등),
    `:350-353`(`_report_eroded`의 `print(f"\n  [{module}] {advisory}", ...)` 등)
  - 상세: `module`/`advisory`/`patched`/`path`/`keys` 값은 `pnpm audit --json` 응답과
    `pnpm-workspace.yaml`의 override 키에서 그대로 가져와 이스케이프 없이 `print(...)`로 CI
    로그(stdout/stderr)에 쓴다. 이론적으로는 이런 값에 개행·제어 문자가 섞이면 CI 로그 라인을
    위조(log forging)해 사람이 로그를 오독하게 만들 수 있다(OWASP A09 로깅 실패 인접 범주). 다만
    실제 발현 가능성은 낮다 — `module_name`은 npm 레지스트리가 퍼블리시 시점에 강제하는 패키지명
    문자셋(소문자·제한된 특수문자, 공백/개행 불허)의 제약을 받고, advisory id·`patched_versions`는
    사용자가 아니라 GitHub Advisory Database가 큐레이션한 값이며, override 키·경로 문자열은 이미
    신뢰된 로컬 저장소 설정(`pnpm-workspace.yaml`)에서 파생된다. `title`/`overview`/`recommendation`
    같은 advisory의 자유 텍스트 필드는애초에 이 스크립트가 소비하지 않는다. 1~7차 리뷰 어디에서도
    이 각도(출력 새니타이징 부재)가 명시적으로 언급된 바 없어 기록 목적으로 신규 추가하되, 조치
    우선순위는 매우 낮다.
  - 제안: 조치 불요. 향후 이 스크립트가 advisory의 자유 텍스트 필드(제목·설명 등)를 소비하게
    되면 그때 개행/제어문자 스트리핑을 고려할 것.

## 확인한 항목 (이상 없음)

- **인젝션**: `subprocess.run`은 전 지점(`:175-184`) 리스트 인자 + `shell=True` 미사용. `eval`/`exec`/
  `os.system`/`pickle`/`marshal`/`__import__`/`shell=True` 매칭 0건(재실행 확인). `yaml.safe_load()`
  (`:129`, 임의 객체 역직렬화 위험 회피)와 `json.loads()`(`:198`)만 사용. SQL/XSS/LDAP/경로 탐색
  표면 자체가 없다(웹/DB 접점이 없는 CLI 스크립트, 경로는 `REPO_ROOT` 기준 고정 상수만 사용).
- **하드코딩된 시크릿**: 스크립트·리뷰 산출물 30개 전체에서 API 키/토큰/비밀번호/인증서 패턴
  매칭 없음(재확인). `EXPECTED_SUPPRESSED_PATHS`(`:62-68`)는 CVE ID·의존성 체인 경로일 뿐 시크릿이
  아니다.
- **인증/인가**: 해당 없음 — 사용자 대면 서비스가 아닌 CI 전용 로컬 스크립트, 세션/권한 경계가
  없다. 트리거 워크플로(`deps-security-checks.yml`)도 `pull_request_target`이 아닌 일반
  `pull_request`라 포크 PR에 시크릿이 노출되는 권한 상승 경로가 없다.
- **입력 검증**: `load_override_targets()`(`:119-150`)가 YAML 파싱 실패·`overrides` 키 부재/오타/
  값 없음/비매핑을 단일 `isinstance` 조건(`:134-146`)으로, `run_audit()`(`:166-208`)이 subprocess
  timeout(`:183`, 300초)·빈 출력(`:191-196`)·JSON 파싱 실패(`:197-200`)·`actions` 키 부재
  (`:201-207`)를 각각 fail-closed로 검증한다. `_undecidable(` 호출부는 정의부(`:153`) 제외 정확히
  9곳(`grep -c` 재실측)으로 6~7차 리뷰가 확인한 수치와 일치한다.
- **OWASP Top 10(일반)**: 안전하지 않은 역직렬화(A08 계열) 회피(`safe_load`), 보안 설정 오류 방지가
  이 스크립트의 존재 목적 자체(A05/A06 계열 대응 도구). 해당 카테고리 신규 결함 없음.
- **암호화**: 해시/암호화 사용 없음(해당 없음). 평문 전송 우려 없음 — 네트워크 호출은 `pnpm audit`
  (레지스트리 HTTPS, 이 스크립트가 프로토콜을 직접 다루지 않음) 하나뿐.
- **의존성 보안**: 신규 외부 의존성 없음(PyYAML은 자매 스크립트가 이미 쓰던 기존 의존성 재사용,
  `pip install "pyyaml>=6,<7"`로 major 고정). `yaml.safe_load()`만 사용해 PyYAML의 알려진 위험
  패턴(`yaml.load()`/`FullLoader`의 임의 객체 역직렬화)에 해당하지 않는다. 이 스크립트 자체가
  의존성 취약점 관리 도구(override 바닥 침식 검출)다.
- **7차 조치 델타 회귀 검증**: `git show fdc7ad801 -- scripts/check-override-floors.py`로 직접
  대조한 결과 `sorted(data)` → `sorted(data, key=str)` 1줄 변경뿐이며, `subprocess.run`/
  `yaml.safe_load`/`json.loads` 호출 형태는 전혀 건드리지 않아 보안 관점 회귀가 없다.

## 요약

`scripts/check-override-floors.py`는 8차례째 리뷰를 거치는 CI 전용 의존성 보안 가드로, 인젝션·
하드코딩 시크릿·인증/인가·안전하지 않은 역직렬화 등 전통적 취약점 표면이 사실상 없는 상태로
수렴해 있다. `subprocess.run`은 `shell=True` 없이 리스트 인자로만 호출되고, YAML은
`yaml.safe_load`, JSON은 `json.loads`로 안전하게 파싱하며, 입력 검증(fail-closed) 9개 지점이
전용 회귀 테스트로 고정돼 있다. 7차 조치 커밋(`fdc7ad801`)이 낸 실 코드 델타는 진단 메시지의
`sorted()` 정렬 키 하나뿐이라 보안 관점 회귀는 없다. 이번 라운드에서 독립적으로 재검토한 결과
Critical·Warning 은 발견되지 않았다. 1~7차와 동일한 저위험 INFO 2건(서브프로세스 raw 출력/예외
메시지의 CI 로그 노출, PATH 기반 `pnpm` 호출)이 여전히 유효하며 둘 다 이 저장소의 기존 관례와
일치해 조치가 급하지 않다. 이번 라운드에서 직접 찾은 신규 관측 2건은 모두 INFO 수준이다 — (1)
`pnpm-workspace.yaml` 읽기(`path.read_text`)가 YAML 파싱 예외 처리 범위 밖에 있어 파일 인코딩
문제 시 "exit 1(침식 발견)"과 "판단 불가"가 혼동될 수 있는 좁은 갭(핵심 불변식은 유지), (2) 리포트
출력이 advisory/override 데이터를 새니타이징 없이 로그에 쓰는 이론적 로그 위조 표면(npm 패키지명
문자셋 제약으로 실효 위험은 매우 낮음). 리뷰 산출물 30개(5~7차 세션)는 정적 markdown/JSON
스냅샷으로 재확인 결과 시크릿 혼입이나 실행 가능한 코드 표면이 없다.

## 위험도

LOW — Critical·Warning 없음. 8차 연속 동일 결론(5차·7차와 동일 LOW, 6차 WARNING은 다음 라운드에서
이미 해소 확인됨). 신규 INFO 2건은 모두 핵심 fail-closed 불변식을 훼손하지 않는 낮은 우선순위
관찰이다.
