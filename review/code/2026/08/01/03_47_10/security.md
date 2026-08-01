# Security Review — scripts/check-override-floors.py

### 발견사항

- **[INFO]** 실패 경로에서 `pnpm audit` 의 raw stdout/stderr 일부를 CI 로그로 그대로 출력
  - 위치: `scripts/check-override-floors.py:157`, `scripts/check-override-floors.py:162`, `scripts/check-override-floors.py:168`, `scripts/check-override-floors.py:221`, `scripts/check-override-floors.py:231`, `scripts/check-override-floors.py:239` (모두 `_undecidable()` 호출부의 `detail` 인자)
  - 상세: fail-closed 진단을 위해 `proc.stderr[:_STDERR_PREVIEW]`(500자), `out[:_STDOUT_PREVIEW]`(2000자) 등 서브프로세스 출력 원문 일부를 그대로 stderr 로 출력한다. `pnpm audit` 이 정상 상황에서 자격증명을 노출하지는 않지만, private registry 인증 실패 등 예외 케이스에서 레지스트리 URL 에 내장된 토큰이나 `.npmrc` 관련 오류 문자열이 섞여 나올 가능성을 코드 레벨에서 배제하고 있지 않다. CI 로그는 대개 커밋 권한자보다 넓은 대상에게 노출된다.
  - 제안: 즉각적인 위험은 낮음(이 리포지토리의 다른 fail-closed 스크립트들도 동일 패턴을 사용하는 기존 관례). 필요 시 알려진 토큰/Basic-Auth URL 패턴에 대한 간단한 redaction 을 previews 적용 전에 두는 정도로 충분.

- **[INFO]** `pnpm` 바이너리를 PATH 기반 이름으로 호출
  - 위치: `scripts/check-override-floors.py:147` (`subprocess.run(["pnpm", "audit", ...])`)
  - 상세: 절대경로가 아닌 `PATH` 조회에 의존한다. 빌드/CI 환경의 `PATH` 가 오염되면(공급망 침해 시나리오) 이론상 악성 `pnpm` 이 실행될 수 있으나, `shell=True` 를 쓰지 않고 리스트 인자로 호출하므로 인자 인젝션 자체는 없다. 이는 이 파일만의 결함이 아니라 리포지토리 전반의 기존 관례와 일치한다.
  - 제안: 별도 조치 불요. 참고 기록 목적.

### 요약

`scripts/check-override-floors.py` 는 `pnpm audit --json` 결과와 `pnpm-workspace.yaml` 의 override 선언을 대조해 "이미 관리 중인 패키지의 침식된 보안 바닥"을 검출하는 CI 전용 방어 스크립트다. 외부 사용자 입력이나 네트워크 요청을 신뢰 경계 안에서 직접 받는 서비스 코드가 아니라 로컬 리포지토리 설정 파일(`pnpm-workspace.yaml`)과 고정된 서브프로세스 호출(`pnpm audit`)만 다루므로 전통적인 인젝션(SQL/XSS/커맨드/LDAP/경로 탐색) 표면이 사실상 없다. `subprocess.run` 은 `shell=True` 없이 리스트 인자로 호출돼 커맨드 인젝션 위험이 없고, YAML 파싱은 `yaml.safe_load`(임의 객체 역직렬화 위험 회피)를, JSON 파싱은 `json.loads`(안전) 를 사용한다. 하드코딩된 시크릿·자격증명은 없으며 `EXPECTED_SUPPRESSED_PATHS` 의 CVE ID/경로는 의도적으로 문서화된 리스크 수용값이지 시크릿이 아니다. `_NAME_CHAR`/`_RANGE_SUFFIX` 정규식은 상호 배타적 문자 클래스 구조(`[^@]+` 뒤에 리터럴 `@`)라 파국적 백트래킹(ReDoS) 가능성이 없고, `chain_segments()` 는 정규식이 아닌 단순 순회라 동일 우려가 없다. 오히려 이 스크립트는 모호한 audit 응답을 "취약점 0건" 으로 오판하지 않도록 `_undecidable()` 로 강제 fail-closed(exit 2) 시키는 설계를 일관되게 적용해, 보안 도구 자체의 설계 품질이 높다(예: `advisories`/`actions` 스키마 변경 시 조용한 통과를 막는 방어적 검증). 유일하게 언급할 만한 점은 실패 진단 경로에서 서브프로세스 raw 출력 일부를 CI 로그로 노출한다는 것과 `pnpm` 을 PATH 기반으로 호출한다는 점인데, 둘 다 익스플로잇 가능한 결함이 아니라 이 리포지토리의 기존 관례와 일치하는 낮은 우선순위 관찰 사항이다. 인증/인가, 암호화, 세션 관리, 의존성 취약점 관점에서도 해당 사항이 없다(이 스크립트 자체가 의존성 취약점 관리를 위한 가드).

### 위험도
LOW
