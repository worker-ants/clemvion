# Security Review — deps-guard-hardening (6차 라운드)

## 리뷰 범위 메모

이번 라운드에 전달된 페이로드는 두 종류로 나뉜다.

1. `review/code/2026/08/01/03_47_10/{SUMMARY.md,_retry_state.json,documentation.md,maintainability.md,meta.json,requirement.md,scope.md,security.md,side_effect.md,testing.md}` — 직전(5차) `/ai-review` 라운드의 산출물이 신규 파일로 커밋된 것. 프로젝트 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이 지정한 정상 저장 위치이며, 전부 정적 markdown/JSON 스냅샷(로컬 절대경로·에이전트 이름·리뷰 텍스트)이다. 실행되는 코드가 아니고 외부 입력을 처리하지 않으며, 하드코딩 시크릿·토큰·자격증명·인젝션 표면을 전수 확인한 결과 없음.
2. `scripts/check-override-floors.py` (신규 347줄) — 실제 CI 의존성 보안 게이트 스크립트. 이번 라운드의 보안 리뷰는 이 파일에 집중했다.

`scripts/check-override-floors.py`는 이미 1~5차 리뷰를 거쳤고, 이번 라운드 diff는 직전(5차) testing/requirement/side_effect 리뷰어가 지적한 두 갭 — (a) `subprocess.run`에 `timeout=` 부재, (b) `pnpm-workspace.yaml`의 `overrides` 키가 통째로 없을 때 fail-closed 미적용 — 을 조치한 결과물이다. 코드를 직접 `Read`하고 실제 저장소 파일(`scripts/check-override-floors.py`, `pnpm-workspace.yaml`)과 대조해 재검증했다.

## 발견사항

- **[WARNING]** `load_override_targets()`의 방금 추가된 fail-closed 가드가 **키 존재 여부만** 검사하고 **값의 타입**은 검사하지 않아, `overrides:` 값이 매핑이 아닌 형태(값 없음/`null`, 문자열, 리스트)로 손상되면 여전히 조용히 "대상 0개(또는 오염된 소수)"로 통과한다.
  - 위치: `scripts/check-override-floors.py:119-134` (`load_override_targets()`), 구체적으로 `:122`(키 존재만 검사하는 가드)와 `:132`(`for key in data.get("overrides") or {}:` — 값 자체의 타입을 검증하지 않고 바로 순회)
  - 상세: 직전 라운드는 "`overrides:` 키가 통째로 없거나 오타"인 경우를 `_undecidable()`로 막았다(`:122` `"overrides" not in data`). 그런데 이 검사는 **키의 존재**만 보고 **값의 형태**는 보지 않는다.
    - `overrides:` 뒤에 아무 값도 없는 YAML(= `yaml.safe_load` 결과 `data["overrides"] is None`, 예를 들어 override 블록 내용을 실수로 전부 지우고 키만 남기는 흔한 편집 실수)는 `"overrides" not in data`가 `False`(키는 있음)라 `:122` 가드를 통과하고, `:132`의 `data.get("overrides") or {}`가 `None or {}` → `{}`로 조용히 빠져 `targets = {}`가 된다. 결과: `main()`이 `OK: override 대상 0개 패키지 중 취약 재유입 0건`으로 exit 0 — 바로 직전 라운드에 고친 것과 **동일한 실패 형태**(설정이 깨졌는데 "취약점 0건"과 구별 안 되는 성공)가 다른 트리거(키 부재 대신 키의 값 부재)로 재현된다.
    - 더 나아가 `overrides:`가 매핑이 아닌 스칼라/시퀀스로 손상된 경우(예: YAML 병합 실수로 `overrides: "placeholder"` 또는 `overrides: [a, b]`)는 `or {}`가 truthy 값을 그대로 통과시켜(`"placeholder" or {}` → `"placeholder"`) `for key in "placeholder":`가 **예외 없이** 문자열의 각 글자를 "override 키"로 순회한다. `override_target()`은 단일 글자에도 예외를 던지지 않으므로(`chain_segments`/`_RANGE_SUFFIX` 모두 매치 실패 시 원문 그대로 반환), 결과적으로 실제 26개 override 대상은 전부 유실되고 `p`, `l`, `a` 같은 존재하지 않는 "패키지명"으로 채워진 `targets`가 생긴다. 이 경우 `main()`은 크래시하지 않고 `OK: override 대상 N개 패키지 중 취약 재유입 0건`처럼 **그럴듯한 정상 메시지**를 출력한다 — 실제로는 진짜 override 대상 전체에 대한 보호가 조용히 무력화된 상태인데, 로그만 보면 정상 동작처럼 보인다는 점에서 앞의 `None` 케이스보다 한층 더 조용하다(정수처럼 순회 불가능한 타입이면 `TypeError`로 크래시해 fail-closed 방향으로 안전하게 실패하지만, 문자열/리스트처럼 순회 가능한 타입은 예외조차 없다).
    - 이 파일의 나머지 fail-closed 지점들(`run_audit()`의 `isinstance(data, dict)`, `classify_vulnerable()`의 `advisories`/`actions` 스키마 드리프트 가드)은 모두 "컨테이너가 있는데 기대한 원소 형태가 아님"까지 검사하는 반면, `load_override_targets()`만 유일하게 최상위 값의 타입 검사 없이 바로 소비한다는 점에서 파일 내부적으로도 일관성이 깨진다.
  - 제안: `:122`의 가드를 키 존재 검사에서 값 타입 검사로 확장한다. 예:
    ```python
    overrides = data.get("overrides")
    if not isinstance(data, dict) or not isinstance(overrides, dict):
        _undecidable(...)
    for key in overrides:
        ...
    ```
    `isinstance(overrides, dict)`는 `None`·문자열·리스트·정수를 전부 걸러내면서도 기존에 의도적으로 정상 취급하려던 `overrides: {}`(명시적 빈 매핑)는 그대로 통과시켜, 코드 주석(`:123-125`)이 이미 선언한 "키 자체의 부재만 가른다"는 설계 의도와 실제로 정확히 부합하게 된다. `EXPECTED_SITES`/관련 회귀 테스트(`.claude/tests/test_override_floors.py`, 이번 라운드 diff 밖)에 `overrides: null`과 `overrides: "x"` 케이스를 추가하는 것을 권장.

- **[INFO]** 실패 진단 경로에서 `pnpm audit`의 raw stdout/stderr 미리보기(최대 2000/500자)를 CI 로그에 그대로 노출 — 5차 리뷰와 동일한 관찰, 라인 번호만 `_AUDIT_TIMEOUT_SEC` 추가로 이동.
  - 위치: `scripts/check-override-floors.py:179`(`f"  exit={proc.returncode} stderr={proc.stderr[:_STDERR_PREVIEW]}"`), `:184`(`out[:_STDOUT_PREVIEW]`)
  - 상세: 정상 상황에서 자격증명이 섞일 일은 없으나, private registry 인증 실패 등 예외적 `pnpm audit` 오류 출력에 토큰/Basic-Auth URL이 포함될 가능성을 코드 레벨에서 배제하지 않는다. CI 로그는 리포지토리 커밋 권한자보다 넓게 노출되는 경우가 많다. 리포지토리 내 다른 fail-closed 스크립트들과 동일한 기존 관례.
  - 제안: 필수 아님. 여유가 있으면 알려진 토큰/Basic-Auth URL 패턴에 대한 redaction을 미리보기 자르기 이전에 추가.

- **[INFO]** `pnpm` 바이너리를 절대경로가 아닌 PATH 조회로 실행 — 5차 리뷰와 동일한 관찰.
  - 위치: `scripts/check-override-floors.py:160` (`subprocess.run(["pnpm", "audit", "--audit-level=moderate", "--json"], ...)`)
  - 상세: `shell=True`를 쓰지 않고 리스트 인자로 호출하므로 인자/커맨드 인젝션은 없다. PATH 오염(공급망 침해) 시 이론적 위험이 있으나 리포지토리 전반의 기존 관례와 일치.
  - 제안: 별도 조치 불요.

- **[INFO]**(개선 확인) `_AUDIT_TIMEOUT_SEC = 300`과 `subprocess.TimeoutExpired` → `_undecidable()` 라우팅이 이번 라운드에 추가되어, 직전 라운드가 지적한 "레지스트리 무응답 시 무기한 대기" 갭이 안전하게(fail-closed로) 해소됐음을 코드 대조로 확인.
  - 위치: `scripts/check-override-floors.py:77`, `:159-173`
  - 상세: 조용한 통과가 아니라 명시적 exit 2(판단 불가)로 떨어지므로 이 스크립트의 핵심 안전 불변식과 일치한다.
  - 제안: 조치 불요.

## 그 외 확인 (이상 없음)

- 인젝션: `yaml.safe_load()`(임의 객체 역직렬화 없음), `json.loads()`(안전), `subprocess.run()`은 `shell=True` 미사용 + 리스트 인자 — SQL/커맨드/LDAP 인젝션 및 YAML 역직렬화 취약점 없음. 경로는 전부 `REPO_ROOT` 기준 고정 상수(`WORKSPACE_YAML`)라 경로 탐색 표면 없음.
- 하드코딩 시크릿: 스크립트·리뷰 산출물(markdown/JSON) 전체에서 API 키·비밀번호·토큰·인증서 없음. `EXPECTED_SUPPRESSED_PATHS`의 값은 CVE ID/의존성 체인 경로이며 시크릿이 아님.
- 인증/인가: 해당 없음(사용자 대면 서비스가 아닌 로컬 CI 스크립트).
- 정규식(`_NAME_CHAR`, `_RANGE_SUFFIX`): 단순 문자 클래스/앵커 구조로 파국적 백트래킹 여지 없음. 입력도 공격자 제어가 아닌 리포지토리 로컬 설정 파일.
- 암호화/평문 전송: 해당 사항 없음(자체 네트워크 페이로드에 자격증명을 다루지 않음, `pnpm` CLI의 인증은 상속된 환경에 위임).
- 의존성 보안: 신규 외부 의존성 없음(PyYAML은 자매 스크립트가 이미 사용 중). 이 스크립트 자체가 의존성 취약점 가드.

## 요약

`scripts/check-override-floors.py`는 인젝션·시크릿·인증 표면이 사실상 없는 CI 전용 방어 스크립트이며, 이번 라운드는 직전 라운드가 지적한 timeout 부재를 안전하게 해소했다(양호). 다만 같은 라운드에 함께 고친 `load_override_targets()`의 "`overrides` 키 부재" fail-closed 가드가 **키 존재만** 검사하고 **값의 타입**은 검사하지 않아, `overrides:`가 `null`이거나 매핑이 아닌 다른 타입(문자열·리스트)으로 손상되는 경로에서 이 스크립트가 막으려는 바로 그 실패 형태("설정이 깨졌는데 취약점 0건과 구별 안 되는 조용한 성공")가 다른 트리거로 재현된다 — 특히 문자열/리스트 케이스는 크래시조차 없이 그럴듯한 "OK" 메시지를 낸다. 단일 `isinstance(overrides, dict)` 검사로 두 하위 케이스(값 부재·값 타입 오류) 모두 닫히고, 기존에 의도한 "명시적 빈 매핑은 정상"이라는 설계도 그대로 보존된다. 나머지 항목(subprocess 원문 CI 로그 노출, PATH 기반 pnpm 호출)은 5차 리뷰와 동일한 INFO 수준 관찰로 리포지토리 기존 관례와 일치해 조치가 급하지 않다.

## 위험도

MEDIUM — 신규 WARNING 1건(같은 함수 내 방금 고친 가드의 값-타입 검증 누락, 외부 공격자가 아닌 리포지토리 편집 실수로 트리거되는 fail-open). Critical 없음. 나머지는 5차 리뷰와 동일한 INFO 수준.
