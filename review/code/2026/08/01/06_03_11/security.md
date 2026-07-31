# 보안(Security) 리뷰 — scripts/check-override-floors.py 외 1건

## 스코프 메모

리뷰 대상은 2개 파일이다.

- `review/code/2026/08/01/05_36_28/testing.md` — 이전 라운드(9차) 테스트 리뷰의 산출물(정적
  마크다운 문서)이다. 실행되는 코드가 아니고, 본문·코드 스니펫 어디에도 시크릿·자격증명·
  인젝션 가능 구문이 없다. 보안 관점에서 특기할 내용 없음.
- `scripts/check-override-floors.py`(신규 386줄) — `pnpm-workspace.yaml` 의 `overrides` 바닥이
  새 CVE 로 침식됐는지 검출하는 CI 전용 로컬 스크립트. 실질적 보안 검토 대상은 이 파일이다.

검증 방법: 코드 추적(전체 386줄 직접 정독) + grep 전수 확인.
`grep -nEi "api[_-]?key|secret|password|token\s*=|Authorization|BEGIN (RSA|EC|PRIVATE)|AKIA[0-9A-Z]{16}"`,
`shell=True|os.system|subprocess.call|subprocess.Popen`, `yaml.load\b`(unsafe 버전) 세 패턴 모두
0건. `deps-security-checks.yml` 을 대조해 `--audit-level=moderate` 가 기존 audit 잡과 동일한
관례를 따른 의도적 선택임도 확인했다(신규 도입 편차 아님).

## 발견사항

- **[INFO]** 하위 프로세스(`pnpm audit`)·예외의 raw 출력을 잘라 CI 로그(stderr)에 그대로
  echo — 레지스트리 인증 오류 시 자격증명 편린이 로그에 남을 이론적 가능성.
  - 위치: `scripts/check-override-floors.py:207-212`(`except OSError as exc: _undecidable(...,
    f"  {type(exc).__name__}: {exc}")`), `:214-219`(`stderr={proc.stderr[:_STDERR_PREVIEW]}`),
    `:222-223`(`_undecidable("... 파싱하지 못했다:", out[:_STDOUT_PREVIEW])`). 관련 상수:
    `:72-74`(`_STDERR_PREVIEW = 500`, `_STDOUT_PREVIEW = 2000`, `_KEY_PREVIEW = 10`).
  - 상세: `run_audit()` 은 `pnpm audit --json` 의 stdout/stderr 를 각각 최대 2000/500자까지
    그대로 잘라 stderr(CI 로그)로 출력한다. 패키지 매니저가 레지스트리 인증 실패 시 요청 URL에
    Basic-Auth/쿼리스트링 형태의 자격증명을 포함한 오류 메시지를 내는 사례가 알려져 있어, 만약
    발생하면 그 편린을 그대로 재출력하는 통로가 된다. 다만 (a) 이 저장소 CI 로그의 접근 권한은
    통상 저장소 접근 권한과 같은 신뢰 경계 안에 있고, (b) 이 echo 패턴은 스크립트 docstring 이
    같은 계열로 언급하는 `check-pnpm-security-config.py` 와 동일한 기존 관례를 따른 것이라 이번
    diff 가 새로 도입한 위험이 아니다. 실제 익스플로잇 가능성은 낮다.
  - 제안: 급하지 않음. 필요하면 알려진 시크릿 패턴(레지스트리 토큰 형식 등)에 대한 redaction 을
    `_undecidable()` 출력 직전에 추가하거나, CI 워크플로(`deps-security-checks.yml`)의 로그 가시
    범위가 저장소 접근 권한과 동일한 경계인지 별도로 확인하는 정도로 충분.

- **[INFO]**(긍정 관측) YAML 파싱은 `yaml.safe_load()` 를 사용해 임의 Python 객체 역직렬화
  (RCE) 경로를 차단했고, `pnpm audit` 호출은 `subprocess.run([...])` 리스트 인자 형태
  (`shell=True` 미사용, 커맨드·인자 전부 하드코딩)라 쉘 인젝션 표면이 없다. 유일한 입력원
  (`pnpm-workspace.yaml`)도 저장소 내부 관리 파일이라 외부/네트워크 공격자 통제 밖이다.
  - 위치: `scripts/check-override-floors.py:143`(`data = yaml.safe_load(path.read_text(encoding
    ="utf-8"))`), `:195-201`(`subprocess.run(["pnpm", "audit", "--audit-level=moderate", "--json"],
    cwd=REPO_ROOT, capture_output=True, text=True, timeout=_AUDIT_TIMEOUT_SEC)`)
  - 상세: 전형적 위험 API(`yaml.load` unsafe·`shell=True`·`os.system`·`eval`/`exec`·`pickle`)를
    grep 전수 확인한 결과 모두 0건. 하드코딩 API 키·비밀번호·토큰·인증서 패턴도 0건. 유일한
    정규식(`_NAME_CHAR`/`_INNER_SPACE`/`_RANGE_SUFFIX`, `:95,96,99`)도 중첩 quantifier 가 없는
    단순 문자 클래스·단일 quantifier 조합이라 ReDoS 위험이 없다(설령 있어도 입력원이 공격자
    통제 밖이라 이중으로 안전).
  - 제안: 조치 불요. 검증 기록 목적.

- **[INFO]**(긍정 관측) 판단 불가 상태를 전부 `_undecidable()`(exit 2, 반환형 `NoReturn`)로
  일관되게 fail-closed 처리하고, `ignoreCves` CVE 수용 범위를 경로 단위로 고정
  (`EXPECTED_SUPPRESSED_PATHS`)해 억제 범위가 조용히 확대되는 것을 막는다 — "안전한 기본값"
  설계가 이 진단 도구 자체의 신뢰성(= 취약점 은폐가 없다는 보장)에 직접 기여한다.
  - 위치: `scripts/check-override-floors.py:63-69`(`EXPECTED_SUPPRESSED_PATHS`),
    `:168-178`(`_undecidable()`)
  - 상세: 별도 조치 불필요, 설계 강점으로 기록.
  - 제안: 조치 불요.

## 요약

신규 파일 `scripts/check-override-floors.py` 는 CI 전용 로컬 감사 도구로 네트워크 수신 입력이나
사용자 인증 표면이 없다. 인젝션(SQL/XSS/커맨드/경로탐색) 벡터는 코드 추적과 grep 전수 확인
결과 없음을 확인했다 — `subprocess` 호출은 리스트 인자로 `shell=True` 없이 고정 커맨드만
실행하고, YAML 파싱은 `yaml.safe_load()` 로 임의 객체 역직렬화를 차단하며, 유일한 정규식들은
중첩 quantifier 가 없어 ReDoS 위험이 없고 그 입력원(`pnpm-workspace.yaml`)도 저장소 내부
관리 파일이라 공격자 통제 밖이다. 하드코딩된 시크릿·자격증명은 0건이고, 인증/인가·세션 관리는
이 스크립트의 성격상 해당 사항이 없다. 유일하게 남긴 관찰은 하위 프로세스(`pnpm audit`)의 raw
stdout/stderr 를 잘라 CI 로그로 그대로 echo 하는 지점 — 레지스트리 인증 오류 시 자격증명
편린이 로그에 남을 이론적 가능성이 있으나, 이 diff 가 새로 만든 위험이 아니라 인접 스크립트와
동일한 기존 관례이고 신뢰 경계도 저장소 접근 권한과 같아 실제 익스플로잇 가능성은 낮다. 오히려
이 스크립트는 `_undecidable()` 을 통한 일관된 fail-closed 설계, CVE 수용 범위의 경로 단위 고정
등 보안 진단 도구로서 모범적인 설계를 보인다. 함께 포함된
`review/code/2026/08/01/05_36_28/testing.md` 는 실행되지 않는 이전 라운드 리뷰 산출물(마크다운)
로 보안 관점에서 특기할 내용이 없다.

## 위험도

LOW — Critical/Warning 없음. INFO 3건(에러 메시지 raw echo 관련 방어적 제안 1건 + 긍정 관측
2건). 이 diff 자체가 의존성 보안 하드닝 목적의 코드이며, 인젝션·하드코딩 시크릿·인증 우회·
안전하지 않은 역직렬화 등 실제 취약점은 발견되지 않았다.
