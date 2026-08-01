# 보안(Security) 리뷰

## 발견사항

- **[WARNING]** `pnpm audit` 실행 실패/이상 응답이 "취약점 0건"과 구분되지 않아 신규 가드가 fail-open 할 수 있음
  - 위치: `scripts/check-override-floors.py:101-118` (`run_audit()`), 소비부 `scripts/check-override-floors.py:127` (`main()`)
  - 상세: `run_audit()`은 `proc.returncode`를 전혀 검사하지 않는다(주석: "audit 은 취약점이 있으면 비-0 으로 끝나므로 코드로 판단하지 않는다" — 이 자체는 의도된 설계). 문제는 그 다음 분기다: stdout이 비어 있으면(109-112행) "취약점 0건"으로 간주해 무조건 `{}`를 반환하고, `main()`(127행)은 `run_audit().get("advisories")`가 `None`이어도 그냥 `{}`로 치환해 계속 진행한다. 즉 `pnpm audit --json`이
    1) 완전히 빈 stdout을 내거나(레지스트리 타임아웃 등으로 아무 것도 못 찍은 경우),
    2) 파싱은 되지만 `{"error": {...}}` 형태처럼 `advisories` 키가 없는 JSON을 내는 경우(레지스트리 접속 실패·인증 오류 등 pnpm 자체가 구조화된 에러를 낼 때)
    둘 다 "override 대상 N개 중 취약 재유입 0건 — OK"로 조용히 통과(exit 0)한다. 이 스크립트가 막으려는 것이 정확히 "조용한 보안 회귀"인데, 스크립트 자신이 audit 미실행 상황을 "정상"과 구분하지 못해 같은 성격의 실패 모드를 갖고 있다. 같은 워크플로의 `audit` 잡(`.github/workflows/deps-security-checks.yml`의 `pnpm audit --audit-level=moderate`, 순수 종료코드 기반)이 같은 네트워크 장애에서 함께 실패할 가능성은 있지만, 두 잡은 서로 다른 메커니즘(하나는 stdout 파싱, 하나는 순수 exit code)으로 성패를 판정하므로 반드시 동반 실패한다는 보장은 없다 — 예컨대 `pnpm audit --json`이 부분 실패로 빈 출력을 내는 경우와 `pnpm audit`(비-json)의 실패 조건이 정확히 일치하지 않을 수 있다.
  - 제안: `proc.returncode`가 pnpm audit이 실제 정의하는 "정상"/"취약점 발견" 코드 집합에 속하는지 확인하고, 그 외 코드는 실행 실패로 처리한다. 또한 파싱된 JSON에 `advisories` 키가 아예 없거나 최상위 `error` 키가 있으면 "0건"이 아니라 "판단 불가 → 실패(exit 2)"로 fail-closed 처리할 것. 최소한 "빈 stdout"과 "advisories 키 부재"를 서로 다른 원인(진짜 0건 vs 실행 실패)으로 나눠 후자를 non-zero exit으로 만드는 편이, 이 가드의 설계 목적(조용한 회귀 방지)과 일관된다.

- **[INFO]** 신규 `override-floors` 잡이 참조하는 서드파티 GitHub Actions가 가변 태그로 고정됨 — 공급망 하드닝 관점에서는 불변 commit SHA 고정이 더 안전하나, 파일 내 기존 `config-guard`/`audit` 잡과 동일한 기존 관례를 그대로 따른 것이라 이 diff가 새로 도입한 회귀는 아니다.
  - 위치: `.github/workflows/deps-security-checks.yml:79-85` (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `actions/setup-python@v7`)
  - 상세: 메이저 버전 태그는 이동 가능해 이론상 태그 재지정을 통한 공급망 공격에 노출될 수 있다. 다만 리포 전체(및 이 파일의 기존 두 잡)가 이미 이 컨벤션을 쓰고 있어, 이번 신규 잡이 새로 만든 취약점은 아니다.
  - 제안: 이번 PR 스코프 밖이지만, 향후 별도 트랙으로 워크플로 전체의 액션을 SHA 고정하는 하드닝을 검토할 만하다.

- **[INFO]** 테스트 하네스가 `advisories` dict를 `json.dumps()`로 감싸 f-string에 그대로 삽입해 가짜 `pnpm` 스크립트 소스를 생성함 — 값에 `"""` 시퀀스가 있으면 생성되는 파이썬 소스의 트리플쿼트를 깨고 코드가 주입될 수 있는 패턴이지만, 값은 전부 같은 테스트 파일 안의 하드코딩된 리터럴이라 공격자가 통제 가능한 입력 경로가 없다. 실제 취약점 아님(신뢰 경계 밖 입력 없음), 완결성 차원에서만 기록.
  - 위치: `.claude/tests/test_override_floors.py:112-121` (`_run_with_stub_audit`)

## 요약

이번 변경은 의존성 보안 거버넌스를 강화하는 CI/스크립트/문서 작업으로, 변경 목적 자체가 보안 하드닝이다. 신규 코드에서 SQL/커맨드/경로 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, XSS 등 고전적 OWASP Top 10 클래스 취약점은 발견되지 않았다 — `subprocess.run` 호출은 전부 리스트 인자로 `shell=True` 없이 이뤄지고, YAML 파싱은 `yaml.safe_load`만 사용하며, 처리 대상(override 키·advisory JSON)은 모두 리포지토리 내부 파일과 `pnpm audit` 응답으로 외부 사용자 입력 경로가 없다. 유일하게 실질적인 결함은 신규 `scripts/check-override-floors.py`의 `run_audit()`이 "`pnpm audit` 실행 자체의 실패"와 "취약점 0건"을 구분하지 않아, 레지스트리 장애·에러 응답 상황에서 가드가 fail-open 할 수 있다는 점이다 — 이 PR의 취지(조용한 보안 회귀 차단)와 정확히 대칭되는 결함이라 WARNING으로 분류했다. 이 가드는 기존 `pnpm audit --audit-level=moderate` 잡(순수 종료코드 기반, 별도 fail-closed 경로)의 보조 계층이라 실무 영향은 제한적이지만, 코드 자체의 논리 결함이므로 수정을 권고한다. 그 외에는 서드파티 액션의 태그 고정(기존 컨벤션 유지, 신규 회귀 아님)과 테스트 전용 문자열 조립 패턴(공격 경로 없음) 등 경미한 INFO 수준 관찰뿐이다.

## 위험도

LOW
