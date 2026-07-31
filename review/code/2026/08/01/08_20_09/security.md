# 보안(Security) 리뷰 — scripts/check-override-floors.py 외 1건 (11차 라운드)

## 스코프 메모

router 가 넘긴 14개 파일 중 실제 프로덕션 코드는 2개뿐이다.

- `scripts/check-override-floors.py`(현재 303줄) — `pnpm-workspace.yaml` 의 `overrides` 바닥이
  새 CVE 로 침식됐는지 검출하는 CI 전용 로컬 스크립트. 직전 라운드(`06_03_11`) 대비 축소돼
  있다 — `git log`로 확인한 결과 커밋 `f71be98d8`("축 3(ignoreCves 억제분 추적) 철회")가
  `widened`/`EXPECTED_SUPPRESSED_PATHS`/`_report_widened`·`classify_vulnerable()` 의
  `actions[]` 기반 suppressed 판정을 전부 제거했다. 이는 직전 라운드 SUMMARY.md 가 낸
  CRITICAL 2건(스키마 드리프트 오판·항상 발동 불가능한 죽은 코드)을 "버그 수정"이 아니라
  "그 축 자체를 제거"로 해소한 것 — 실제 코드(`Read`)와 커밋 diff(`git show f71be98d8`)를
  직접 대조해 확인했다.
- `scripts/check-pnpm-security-config.py`(149줄) — `overrides`/`onlyBuiltDependencies`/
  `auditConfig.ignoreCves` 스냅샷을 baseline 과 대조하는 순수 로컬 가드. 같은 커밋에서
  `EXPECTED_IGNORED_CVES` 가 `set()` 으로 비워져(2-place 규약 유지, `pnpm-workspace.yaml` 의
  `auditConfig.ignoreCves: []` 와 동기) `ignoreCves` 억제 CVE 0건 상태를 baseline 으로 고정한다.

나머지 12개 파일(`review/code/2026/08/01/{05_36_28,06_03_11}/*.{md,json}`)은 이전 라운드
`/ai-review` 세션의 산출물(정적 리포트·상태 파일)이 신규 파일로 저장소에 편입되면서 이번
라운드의 diff 에 잡힌 것이다. 실행되는 코드가 아니고, `grep -nEi
"api[_-]?key|secret|password|BEGIN (RSA|EC|OPENSSH|PRIVATE)|AKIA[0-9A-Z]{16}"` 전수 확인 결과
매치는 이전 security.md 자신이 인용한 grep 패턴 문자열 1건뿐(실제 시크릿 아님) — 보안 관점의
신규 발견사항 없음. `.claude/tests/test_override_floors.py` 는 이번 라운드도 router 파일 목록
밖(`.claude/**` 제외 정책, 11개 라운드 전부 동일 판단)이라 리뷰 대상에서 제외했다.

검증 방법: 두 스크립트 전체를 `Read` 로 직접 정독(전체 파일 컨텍스트가 프롬프트 크기 제한으로
생략돼 있어 원본을 직접 열었다) + grep 전수 확인 + `git log`/`git show f71be98d8`로 직전 라운드
CRITICAL findings 의 해소 여부를 커밋 단위로 대조.

## 발견사항

- **[INFO]**(carried, 재확인) 하위 프로세스(`pnpm audit`)·예외의 raw 출력을 잘라 CI 로그
  (stderr)에 그대로 echo — 레지스트리 인증 오류 시 자격증명 편린이 로그에 남을 이론적 가능성.
  직전 라운드(`06_03_11/security.md`)와 동일한 패턴·동일 위험도이며 이번 델타로 새로 생기거나
  악화되지 않았다(라인 번호만 파일 축소로 재배치).
  - 위치: `scripts/check-override-floors.py:193-198`(`except OSError as exc:` 블록의
    `f"  {type(exc).__name__}: {exc}"`), `:199-205`(`stderr={proc.stderr[:_STDERR_PREVIEW]}`),
    `:206-209`(`out[:_STDOUT_PREVIEW]`). 관련 상수 `:58-60`(`_STDERR_PREVIEW = 500`,
    `_STDOUT_PREVIEW = 2000`, `_KEY_PREVIEW = 10`). `load_override_targets()` 의
    `:134`(`f"  {type(exc).__name__}: {exc}"`)도 같은 패턴이나 로컬 `pnpm-workspace.yaml` 파싱
    예외 텍스트라 위험은 더 낮다.
  - 상세: `run_audit()` 은 `pnpm audit --json` 의 stdout/stderr 를 각각 최대 2000/500자까지
    그대로 잘라 stderr(CI 로그)로 출력한다. 패키지 매니저가 레지스트리 인증 실패 시 요청 URL 에
    Basic-Auth/쿼리스트링 형태의 자격증명을 포함한 오류 메시지를 내는 사례가 알려져 있어, 발생
    시 그 편린을 그대로 재출력하는 통로가 된다. 다만 (a) 이 저장소 CI 로그의 접근 권한은 통상
    저장소 접근 권한과 같은 신뢰 경계 안에 있고, (b) 이 echo 패턴은 형제 스크립트
    `check-pnpm-security-config.py` 와 같은 기존 관례를 따른 것이라 이번 라운드가 새로 도입한
    위험이 아니다.
  - 제안: 급하지 않음(carried). 필요하면 알려진 시크릿 패턴(레지스트리 토큰 형식 등)에 대한
    redaction 을 `_undecidable()` 출력 직전에 추가하거나, CI 워크플로 로그 가시범위가 저장소
    접근 권한과 동일 경계인지 별도 확인.

- **[INFO]**(긍정 관측, 교차 커밋 검증) 직전 라운드(`06_03_11`)가 낸 CRITICAL 2건 —
  `classify_vulnerable()` 의 스키마 드리프트 오판(`action.get("module")` 이 pnpm 정상 응답에서
  `null` 인 경우를 드리프트로 오판)과 `widened`/`EXPECTED_SUPPRESSED_PATHS`(항상 발동 불가능한
  죽은 코드) — 가 현재 HEAD 에서 **그 축 전체를 제거**하는 방식으로 실제로 해소돼 있다. 남은
  코드에 취약점 은폐로 이어질 새 결함은 발견되지 않았다.
  - 위치: `scripts/check-override-floors.py:220-249`(`classify_vulnerable()`, docstring 이
    "actions[] 는 읽지 않는다 ... 2026-08-01 실측으로 철회했다"로 명시), `:252-280`(`main()`,
    `widened` 계산·`_report_widened()` 호출 완전히 부재). 대응 커밋
    `f71be98d8`(`git show f71be98d8 -- scripts/check-override-floors.py`).
  - 상세: `classify_vulnerable()` 은 이제 `audit.get("actions")` 를 전혀 참조하지 않고
    `advisories` 딕셔너리만으로 취약 패키지를 판정한다 — CRITICAL #1 이 지적한 `action.get(
    "module")` 오판 경로 자체가 코드에서 사라졌다. `main()` 도 `widened` 계산·
    `EXPECTED_SUPPRESSED_PATHS` 대조·`_report_widened()` 호출이 전부 제거돼, CRITICAL #2 가
    "항상 발동 불가능"이라 지적한 메커니즘 자체가 더 이상 존재하지 않는다. `ignoreCves` 억제
    CVE 관리 책임은 `check-pnpm-security-config.py` 의 `EXPECTED_IGNORED_CVES`(baseline
    직접 대조, 현재 `set()`)로 일원화됐고, 같은 커밋이 `pnpm-workspace.yaml` 의
    `auditConfig.ignoreCves` 를 `[]` 로 함께 비워 2-place 편집 규약을 유지한다 — 억제된 CVE
    0건 상태가 fail-closed 로 고정된다(재등장 시 `pnpm audit` 잡이 직접 잡는다). "검증 불가능한
    코드가 지킨다고 주장하는 것"을 제거하고 더 신뢰 가능한 단일 메커니즘(baseline diff)으로
    책임을 옮긴 것은 보안 도구 자체의 신뢰성 관점에서 개선이다.
  - 제안: 조치 불요. 검증 기록 목적.

- **[INFO]**(긍정 관측) 인젝션·시크릿 관련 이전 라운드 결론이 현재 코드에서도 그대로 유지된다.
  - 위치: `scripts/check-override-floors.py:129`(`yaml.safe_load(...)`),
    `:181-187`(`subprocess.run(["pnpm", "audit", "--audit-level=moderate", "--json"], cwd=
    REPO_ROOT, capture_output=True, text=True, timeout=_AUDIT_TIMEOUT_SEC)`),
    `:81,82,85`(`_NAME_CHAR`/`_INNER_SPACE`/`_RANGE_SUFFIX`),
    `scripts/check-pnpm-security-config.py:92`(`yaml.safe_load(...)`)
  - 상세: 전형적 위험 API(`yaml.load` unsafe·`shell=True`·`os.system`·`subprocess.call`/
    `Popen`·`eval`/`exec`/`pickle`) grep 전수 확인 결과 두 스크립트 모두 0건. 하드코딩
    API 키·비밀번호·토큰·인증서 패턴도 0건(`AKIA[0-9A-Z]{16}` 포함). `subprocess.run` 은
    리스트 인자 + 고정 커맨드라 쉘 인젝션 표면이 없다. 유일한 입력원(`pnpm-workspace.yaml`)은
    저장소 내부 관리 파일(PR 리뷰 경계 안)이라 외부/네트워크 공격자 통제 밖이고, 세 정규식
    모두 중첩 quantifier 없는 단순 문자 클래스 조합이라 ReDoS 위험도 없다. 인증/인가·세션
    관리·평문 전송 등은 이 CLI 전용 로컬 스크립트 성격상 해당 사항 없음.
  - 제안: 조치 불요.

- **[INFO]**(범위 확인, 조치 불요) 이번 라운드 페이로드 밖(`.github/workflows/
  deps-security-checks.yml`, `.github/workflows/harness-checks.yml`, `.github/dependabot.yml`,
  `pnpm-workspace.yaml`)이 브랜치 누적 diff 에는 포함돼 있어(직전 라운드 SUMMARY.md 가 이미
  범위 밖으로 기록한 파일들과 동일) 참고용으로 `git diff origin/main...HEAD` 로 훑었다. 신규
  `override-floors` 잡·PyYAML 설치 스텝 모두 고정 커맨드(`python3 scripts/check-override-
  floors.py`, `pip install "pyyaml>=6,<7"`)이고 `${{ github.event.* }}` 류를 `run:` 블록에
  직접 문자열 보간하는 패턴은 없어(Actions script-injection 클래스) 스팟체크 결과 특기할
  결함 없음 — 다만 이 라운드의 공식 판정 대상은 아니므로 새 발견사항으로 등재하지 않는다.
  - 위치: 프롬프트 "리뷰 대상 파일" 목록 자체
  - 제안: 최종 push 전 위 파일들을 포함한 스코프 확인을 한 번은 수행할 것을 권장(직전 라운드와
    동일 권고 유지).

## 요약

이번 라운드의 실질 검토 대상인 두 스크립트(`check-override-floors.py`, `check-pnpm-
security-config.py`)는 인젝션(SQL/XSS/커맨드/경로탐색)·하드코딩 시크릿·안전하지 않은
역직렬화·안전하지 않은 암호화 어느 항목에서도 결함이 발견되지 않았다 — `subprocess` 는 리스트
인자로 고정 커맨드만 실행하고, YAML 은 `yaml.safe_load()` 로만 파싱하며, 유일한 정규식들은
ReDoS 안전하고 그 입력원도 저장소 내부 관리 파일이다. 특히 이번 라운드는 직전 라운드
(`06_03_11`)가 `requirement` 관점에서 낸 CRITICAL 2건(스키마 드리프트 오판·항상 발동 불가능한
`widened` 억제-재유입 탐지)이 실제로 해소됐음을 커밋(`f71be98d8`)과 현재 코드를 직접 대조해
확인했다 — 버그를 패치하는 대신 검증 불가능했던 축 자체를 제거하고, 그 책임을 더 신뢰 가능한
`check-pnpm-security-config.py` baseline 대조(`EXPECTED_IGNORED_CVES`)로 넘긴 설계 판단으로,
보안 진단 도구 자체의 신뢰성을 오히려 높인다. 유일하게 남은 관찰은 `pnpm audit` 하위 프로세스의
raw stdout/stderr 를 CI 로그에 그대로 echo 하는 지점(레지스트리 인증 오류 시 자격증명 편린
노출 이론적 가능성)인데, 직전 라운드와 동일한 낮은 위험도로 carried 되며 이번 델타가 새로
만들거나 악화시킨 위험이 아니다. 나머지 12개 파일(이전 라운드 리뷰 산출물 markdown/json)은
실행되지 않는 정적 문서이며 grep 전수 확인 결과 시크릿·인젝션 벡터가 없다.

## 위험도

LOW — Critical/Warning 없음. INFO 4건(에러 메시지 raw echo 관련 방어적 제안 1건 carried +
긍정 관측 2건(직전 CRITICAL 해소 확인 포함) + 범위 확인성 스팟체크 1건). 이 diff 자체가
의존성 보안 하드닝 목적의 코드이며, 실제 취약점은 발견되지 않았다.
