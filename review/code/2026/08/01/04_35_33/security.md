# Security Review — deps-guard-hardening (7차 라운드)

## 리뷰 범위 및 방법

이번 라운드에 전달된 페이로드는 21개 파일이다: `review/code/2026/08/01/03_47_10/*`(5차 리뷰 산출물 10개, `SUMMARY.md`/`_retry_state.json`/`meta.json` 포함) + `review/code/2026/08/01/04_09_43/*`(6차 리뷰 산출물 10개) + `scripts/check-override-floors.py`(실제 소스, 361줄). 프롬프트 diff 는 `/dev/null` 기준(=origin/main 기준 전체 신규)이라 6차례 누적 조치 전부가 한 diff 로 보인다.

실제 코드 표면은 `scripts/check-override-floors.py` 하나뿐이고 나머지 20개는 이전 라운드의 리뷰 마크다운/JSON 산출물(정적 텍스트, 실행되지 않음)이므로, 코드 실행 관점 보안 분석은 이 스크립트 하나에 집중했다. 리뷰 산출물 20개는 시크릿·자격증명 혼입 여부만 별도로 스캔했다(`grep -rniE "api[_-]?key|secret|password|token|ghp_|sk-...|AKIA...|-----BEGIN"` → 매칭 없음, 오탐 필터 후 0건).

추가로 다음을 직접 검증했다:
- `git show 68e9064d3 -- scripts/check-override-floors.py` / `git show 1598f542f -- scripts/check-override-floors.py` 로 5·6차 조치 커밋의 실제 델타를 대조해 보안 회귀 없음을 확인.
- `grep -n -E "eval\(|exec\(|pickle|marshal|__import__|os\.system|shell=True"` → 매칭 0건 (인젝션 계열 위험 패턴 부재 확인).
- `.npmrc`/`pnpm-workspace.yaml`에 private registry 인증 설정 부재 확인 (`_authToken`/`registry=` 매칭 0건) — 아래 INFO 1 의 실제 발현 가능성 판단 근거.
- `.github/workflows/deps-security-checks.yml`(이번 diff 밖, 컨텍스트 확인용)에서 `run:` 블록에 `${{ github.event.* }}` 등 신뢰 불가 컨텍스트를 직접 문자열 보간하는 GH Actions 스크립트 인젝션 패턴 없음을 확인.

## 발견사항

- **[INFO]** 실패 진단 경로에서 서브프로세스 raw 출력/파싱 예외 메시지 일부를 CI 로그(stderr)에 그대로 노출
  - 위치: `scripts/check-override-floors.py:133`(`f"  {exc}"` — 6차 조치로 신규 추가된 YAML 파싱 예외 메시지), `:193`(`proc.stderr[:_STDERR_PREVIEW]`, 500자), `:198`(`out[:_STDOUT_PREVIEW]`, 2000자)
  - 상세: fail-closed 진단을 위해 `pnpm audit --json`의 stdout/stderr 원문 일부를 그대로 stderr(CI 로그)에 출력한다. 정상 상황에서 자격증명 노출은 없으나, private registry 인증 실패 등 예외 케이스에서 레지스트리 응답에 토큰이 섞여 나올 가능성을 코드 레벨에서 배제하지 않는다. 직접 확인한 결과 이 저장소의 `.npmrc`/`pnpm-workspace.yaml`에는 private registry·`_authToken` 설정이 없어(공개 npm registry만 사용) 현재로선 이 경로가 실제로 토큰을 담을 가능성은 낮다. `:133`의 YAML 예외 메시지는 이번 6차 조치(`1598f542f`)로 신규 추가된 지점인데, 파싱 대상이 외부 응답이 아니라 이미 git 추적되는 로컬 설정 파일(`pnpm-workspace.yaml`)이라 정보 노출 성격이 stdout/stderr 케이스와 다르다(내용이 이미 저장소에 공개돼 있음) — 위험이 새로 늘지 않았다. 1~6차 리뷰에서 반복 확인된 관찰이며 자매 스크립트 `check-pnpm-security-config.py`와 동일 관례.
  - 제안: 조치 불요(기존 결론 유지, 6차 연속 동일 판단). 향후 private registry 를 도입하면 그 시점에 알려진 토큰/Basic-Auth URL 패턴에 대한 redaction 을 preview 적용 전에 추가할 것.

- **[INFO]** `pnpm` 바이너리를 PATH 기반 이름으로 호출(절대경로 미사용)
  - 위치: `scripts/check-override-floors.py:174` (`subprocess.run(["pnpm", "audit", ...])`)
  - 상세: PATH 조회에 의존한다. `shell=True`를 쓰지 않고 리스트 인자로 호출하므로 인자 인젝션 자체는 없으며, CI/빌드 환경 PATH 오염(공급망 침해) 시나리오에서만 이론적 의미가 있다. 저장소 전반의 기존 관례와 일치.
  - 제안: 별도 조치 불요.

## 확인한 항목 (이상 없음)

- **인젝션**: `subprocess.run`은 전 지점 리스트 인자 + `shell=True` 미사용(`eval`/`exec`/`os.system`/`pickle`/`marshal`/`__import__` 매칭 0건, grep 실측). `yaml.safe_load()`(:129, 임의 객체 역직렬화 위험 회피)와 `json.loads()`(:196) 만 사용해 안전하지 않은 `yaml.load()` 패턴 없음. SQL/XSS/LDAP 표면 자체가 없다(웹/DB 접점이 없는 CLI 스크립트).
- **하드코딩된 시크릿**: 스크립트·20개 리뷰 산출물 전체 grep 결과 API 키/토큰/비밀번호 패턴 매칭 없음. `EXPECTED_SUPPRESSED_PATHS`(:62-68)는 CVE ID·의존성 체인 경로일 뿐 시크릿이 아니다.
- **인증/인가**: 해당 없음 — CI 전용 로컬 스크립트로 인증/세션 경계가 없다.
- **입력 검증**: `load_override_targets()`(:119-148)가 이번 5·6차 조치로 (a) YAML 파싱 예외(:128-133), (b) `overrides` 값이 dict 가 아닌 모든 경우(키 부재/오타/`None`/문자열/리스트, :134-144)를 한 조건으로 fail-closed 처리하도록 강화됐고, `run_audit()`(:164-206)도 subprocess timeout(:181, 300초) + `TimeoutExpired`(:183-187)·빈 출력(:189-194)·JSON 파싱 실패(:195-198)·`actions` 키 부재(:199-204) 를 각각 fail-closed 로 검증한다. 코드 직접 대조 결과 `_undecidable(` 호출부는 정확히 9곳(`grep -c` 실측)이며 이는 6차 조치 커밋 메시지가 선언한 "8곳 → 9곳"과 일치한다.
- **OWASP Top 10 (일반)**: 안전하지 않은 역직렬화(A08 계열) 회피(`safe_load`), 보안 설정 오류 방지가 이 스크립트의 존재 목적 자체(A05 계열 대응 도구). 해당 카테고리에서 신규 결함 없음.
- **암호화**: 해시/암호화 사용 없음(해당 없음). 평문 전송 우려 없음 — 네트워크 호출은 `pnpm audit`(레지스트리 HTTPS, 이 스크립트가 직접 프로토콜을 다루지 않음) 하나뿐.
- **에러 처리**: 위 INFO 1 외 특이사항 없음 — 모든 예외 경로가 명확한 사유와 함께 exit 2 로 귀결되고, uncaught traceback 노출 경로가 6차 조치로 크게 좁혀졌다(YAML 파싱 실패가 이전엔 traceback+exit 1 이었으나 이제 fail-closed 메시지+exit 2).
- **의존성 보안**: 신규 외부 의존성 없음(PyYAML 은 자매 스크립트가 이미 쓰던 기존 의존성 재사용, `pip install "pyyaml>=6,<7"`로 major 고정). 이 스크립트 자체가 의존성 취약점 관리 도구다.
- **회귀 검증**: `git show 68e9064d3`/`git show 1598f542f`로 5·6차 조치 델타를 직접 대조한 결과, `subprocess.run` 호출 형태(리스트 인자·`shell=True` 미사용)는 그대로 유지된 채 timeout·예외 처리만 추가돼 보안 관점 회귀가 없음을 확인했다.

## 요약

리뷰 대상의 실질 코드 표면은 `scripts/check-override-floors.py`(CI 전용 의존성 보안 가드) 하나이며, 나머지 20개 파일은 이전 두 라운드(5차·6차)의 정적 리뷰 산출물이다(시크릿 혼입 스캔 결과 이상 없음). `pnpm audit --json`과 `pnpm-workspace.yaml`의 override 선언을 대조해 "이미 관리 중인 패키지의 침식된 보안 바닥"을 검출하는 이 스크립트는 인젝션·시크릿·인증/세션·암호화 관점에서 전통적 취약점 표면이 사실상 없으며, `subprocess.run`은 리스트 인자로 커맨드 인젝션을 차단하고 `yaml.safe_load`/`json.loads`로 안전하게 파싱한다. 5차(`68e9064d3`)와 6차(`1598f542f`) 조치 커밋을 직접 대조한 결과, `run_audit()`의 subprocess timeout·`load_override_targets()`의 YAML 예외 처리·`overrides` 값 타입 검증이 모두 안전하게(보안 회귀 없이) 추가되어, 이 보안 통제 자신이 "설정/응답 파싱 실패가 취약점 0건과 구별되지 않는 조용한 통과"로 이어지는 fail-open 결함 클래스를 구조적으로 좁혔음을 확인했다. 잔여 항목은 실패 진단 경로의 raw 서브프로세스 출력/예외 메시지 일부 CI 로그 노출과 PATH 기반 `pnpm` 호출 2건(둘 다 INFO)뿐이며, 1~6차 리뷰에서 이미 반복 확인·판단이 끝난 저위험 관찰로 이번 라운드에서도 동일 결론이다(private registry 미사용 확인으로 첫째 항목의 실제 발현 가능성이 낮음을 추가 검증). Critical·Warning 수준의 신규 보안 결함은 발견되지 않았다.

## 위험도

LOW
