# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical 0건, Warning 2건(모두 testing 리뷰어. `scripts/check-override-floors.py`
`main()`의 `widened` 계산 루프(288-296행) 내 필터 로직 2곳이 뮤턴트 실측으로 무검증 확인됨).
나머지 6개 에이전트(security/requirement/scope/side_effect/maintainability/documentation)는 전부
LOW(INFO만 발견). router_safety 강제(forced) 목록 7명(documentation, maintainability,
requirement, scope, security, side_effect, testing) 전원 결과 확보 확인 — 강제 화이트리스트
누락 없음.

## Critical 발견사항

해당 없음 — 이번 라운드 7개 에이전트 전원 Critical 발견사항 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `main()`의 `widened` 계산에서 "override 미대상은 건너뛴다" 가드(`if module not in targets: continue`)가 어떤 테스트로도 검증되지 않음. 가드를 `if False:`(무력화)로 뮤턴트 주입해도 38개 테스트 전부 GREEN 유지(실측 확인). 깨지면 override 와 무관한 패키지가 거짓으로 CI 를 fail시킬 수 있음(핵심 "조용한 성공" 위험은 아니지만 스크립트가 선언한 범위 경계를 조용히 벗어나는 회귀를 못 잡음) | `scripts/check-override-floors.py:290-291` (`main()` 288-296행) | `SuppressedPathBaselineTest`(또는 신규 클래스)에 override 미관리 모듈이 `actions[]`에 등장해도 `widened`에 포함되지 않는 케이스 추가 |
| 2 | testing | `EXPECTED_SUPPRESSED_PATHS`에 아직 등록되지 않은 override-대상 모듈이 처음 억제되는 경로가 검증되지 않음. `.get(module, set())`의 기본값 분기를 "미등록 모듈은 이미 수용된 것으로 취급"하도록 뮤턴트 주입해도 38개 테스트 전부 GREEN 유지(실측 확인) — 이 스크립트가 스스로 막으려는 "설정이 깨졌는데 취약점 0건과 구별 안 되는 조용한 성공"을 정확히 재현 | `scripts/check-override-floors.py:293` (`allowed = EXPECTED_SUPPRESSED_PATHS.get(module, set())`) | `EXPECTED_SUPPRESSED_PATHS`에 키가 없는 override-관리 모듈(예: `liquidjs`)이 `actions[]`에 등장하면 항상 `widened`로 fail 하는 회귀 테스트 추가(위 항목과 같은 9줄 루프이므로 한 테스트 클래스에 두 케이스 병합 권장) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, side_effect, documentation | 6차 WARNING 3건(`overrides` 값 타입 미검증·YAML 파싱 예외 미처리·`TimeoutExpired` 미검증) 해소를 소스 직접 대조 + 38개 회귀 테스트 실행(전부 PASS)으로 3인 독립 재확인 | `scripts/check-override-floors.py:119-148,164-187` | 조치 불요 |
| 2 | requirement | `classify_vulnerable()`의 `suppressed` 판정이 모듈 단위라, 한 모듈에 억제된 CVE 와 억제 안 된 CVE 가 동시에 있으면 그 실행의 `widened` 진단 세부가 누락될 수 있음(단, 같은 모듈이 `eroded`로 이미 fail 하므로 핵심 fail-closed 불변식은 안 깨짐 — 완결성 수준) | `scripts/check-override-floors.py:234-247` | 우선순위 낮음 — 여유 있으면 `suppressed`를 (module, path) 단위로 분리하는 것을 검토 |
| 3 | requirement | 관련 제품 spec 문서 없음, `spec_impact: none` 및 plan Rationale 이 실제와 일치 | `spec/` 전체(grep 0건) | 조치 불요 |
| 4 | scope | 리뷰 산출물 20개 동봉은 이 브랜치 10개 커밋 전부가 예외 없이 따르는 확립된 관례이며 범위 이탈 아님. 실제 코드 델타도 직전 두 라운드가 지적한 지점에만 정확히 국한(무관 함수/임포트/포맷팅 변경 없음) | N/A(신규 파일 20개), `scripts/check-override-floors.py:77,119-148,172-188` | 조치 불요 |
| 5 | scope, side_effect | `plan/in-progress/deps-guard-hardening.md`·`.claude/tests/test_override_floors.py`가 이번 페이로드(21개 파일)에는 없었으나 직접 열람해 이상 없음을 확인(router 파일 선별의 커버리지 참고사항, 최종 결론에는 영향 없음) | N/A | router 의 `.claude/**`/`plan/**` 제외 정책을 명문화해두면 향후 재확인 비용 절감(낮은 우선순위) |
| 6 | side_effect, documentation | `_undecidable()` fail-closed 호출 지점이 8→9곳으로 증가 — 코드(`grep` 실측 9곳)·테스트(`FailClosedSiteCountTest.EXPECTED_SITES=9`)·`.claude/tests/README.md`·plan 문서 4곳 수치가 모두 일치, drift 없음 | `scripts/check-override-floors.py:133,139,184,190,198,201,254,264,274` | 조치 불요 |
| 7 | side_effect, documentation | `_AUDIT_TIMEOUT_SEC=300`(초) 도입으로 무기한 대기 위험 해소. 근거 주석의 "CI 잡 타임아웃(10분)보다 넉넉히 짧다"는 서술이 `.github/workflows/deps-security-checks.yml`의 실제 `timeout-minutes: 10`과 대조해 정확함 | `scripts/check-override-floors.py:75-77,164-187` | 조치 불요 |
| 8 | side_effect | 전역 상태/환경변수/시그니처 부작용 없음 — `global` 0건, `os` 모듈 자체 미임포트, 완전 신규 파일이라 파손될 기존 호출자 없음 | `scripts/check-override-floors.py` 전체 | 조치 불요 |
| 9 | side_effect | 테스트 하네스의 부작용 격리(환경변수 dict 복사 후 자식에만 전달, `TemporaryDirectory` 자동 정리)를 소스 직접 대조로 재검증 | `.claude/tests/test_override_floors.py:87-131` | 조치 불요 |
| 10 | side_effect, security | 리뷰 산출물 20건(5·6차 라운드)은 정적 문서로 런타임 부작용 표면이 없고, 시크릿/자격증명 혼입도 없음(양쪽 독립 스캔, 매칭 0건) | `review/code/2026/08/01/{03_47_10,04_09_43}/*` | 조치 불요 |
| 11 | maintainability, testing | "최상위 키 프리뷰" 진단 삼항식이 YAML 경로(`:143`)와 JSON 경로(`:204`)에 구조적으로 중복되며, YAML 쪽만 비-문자열 최상위 키(PyYAML 1.1 리졸버가 `on`/`yes`/`no` 등을 불리언으로 해석)가 섞이면 `sorted()`가 `TypeError`로 죽을 수 있음(양쪽 리뷰어가 독립적으로 직접 재현). `overrides` 파싱 실패와 동시 충족해야 하는 좁은 이중 조건이며, 어차피 비-0 종료(exit 1, traceback)이므로 핵심 "조용한 성공" 불변식은 안 깨짐 | `scripts/check-override-floors.py:143` | 급하지 않음 — `sorted(data)`를 `list(data)` 또는 `sorted(data, key=str)`로 교체해 비교 불가능성 제거 |
| 12 | maintainability | 6차 델타(`load_override_targets()` 재작성)가 기존 파일 관용구(`_undecidable()` 단일 진입점, `NoReturn`, named 상수, 인접 근거 주석)를 정확히 재사용해 신규 구조적 결함을 들이지 않음(긍정 관측) | `scripts/check-override-floors.py:119-148` | 조치 불요 |
| 13 | documentation | 갱신된 `load_override_targets()`/`run_audit()`의 docstring·인라인 주석이 실제 코드 동작과 정확히 일치, 오래된 주석 없음 | `scripts/check-override-floors.py:119-148,164-206` | 조치 불요 |
| 14 | documentation | 모듈 docstring "실측 5건→4건" 서술 순서가 6라운드째 이어지는 저우선순위 모호함(사실관계 오류는 아님, `:21`에서 뒤늦게 해소됨) | `scripts/check-override-floors.py:6-14` | 급하지 않음 — `:14`에 PR 번호(`#1038`)를 즉시 명시하면 근거가 그 자리에서 바로 섬 |
| 15 | documentation | `RESOLUTION.md` 부재는 "fix 후 fresh clean review 로 대체" 기존 관례와 일치하는 패턴이나, 그 전제(이번 라운드가 clean 으로 끝남)는 이번 라운드가 WARNING 2건(testing)을 발견해 성립하지 않음 | `review/code/2026/08/01/{01_12_24,01_56_46,02_38_45,03_16_51,03_47_10,04_09_43}/` | 아래 "권장 조치사항" 참고 — WARNING 조치 후 재수렴 필요 |
| 16 | documentation | README/CHANGELOG/`PROJECT.md` 갱신 대상 없음(재점검 완료), 신규 반영된 리뷰 세션 산출물 20개의 구조적 무결성(JSON 파싱·코드펜스 짝·마크다운 표 열 개수) 확인 | `PROJECT.md:48`, `review/code/2026/08/01/{03_47_10,04_09_43}/*` | 조치 불요 |
| 17 | security | 실패 진단 경로가 `pnpm audit --json`의 raw stdout/stderr 일부를 CI 로그(stderr)에 노출. 이 저장소는 `.npmrc`/`pnpm-workspace.yaml`에 private registry 인증 설정이 없어(직접 확인) 현재 토큰 노출 가능성은 낮음 | `scripts/check-override-floors.py:133,193,198` | 조치 불요(향후 private registry 도입 시 알려진 토큰/Basic-Auth URL 패턴 redaction 검토) |
| 18 | security | `pnpm` 바이너리를 PATH 기반 이름으로 호출(절대경로 미사용). `subprocess.run`이 리스트 인자 + `shell=True` 미사용이라 인자 인젝션 자체는 없음(CI 환경 PATH 오염 시나리오에서만 이론적 의미) | `scripts/check-override-floors.py:174` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | INFO 2건 — 실패 진단 경로의 raw stdout/stderr 일부 CI 로그 노출(private registry 미사용으로 위험 낮음), PATH 기반 `pnpm` 호출. 인젝션/시크릿/인증 등 전통적 취약점 표면 없음 |
| requirement | LOW | INFO 3건 — 6차 WARNING 3건 해소 재확인(38/38 PASS 직접 실행), `classify_vulnerable()`의 모듈 단위 `suppressed` 판정이 진단 완결성만 좁힘(불변식 유지), spec 무관 확인 |
| scope | LOW | INFO 4건 — 전부 범위 이탈 아님으로 확인. 리뷰 산출물 동봉은 확립된 관례, 코드 델타는 지적된 지점에만 정확히 국한, `widened` 축도 plan 근거 있음 |
| side_effect | LOW | INFO 7건 — WARNING 해소 재확인, fail-closed 8→9곳 증가(drift 없음), timeout 도입으로 무기한 대기 해소, 전역/시그니처 부작용 없음, 테스트 격리 직접 검증 |
| maintainability | LOW | INFO 3건 — 키 프리뷰 삼항식 중복(YAML 측 `TypeError` 취약, testing 과 공동 발견), 6차 델타의 관용구 재사용 긍정 관측, 기존 3건 재확인(변화 없음) |
| testing | **MEDIUM** | **WARNING 2건** — `main()`의 `widened` 계산 루프(288-296행) 내 필터 로직 2곳이 뮤턴트 실측 결과 무검증(38/38 GREEN 유지). 이 스크립트가 막으려는 "조용한 성공"을 정확히 재현하는 갭 포함 |
| documentation | LOW | INFO 6건 — fail-closed 개수(9)·timeout 주석(10분) 4곳 일치 재확인, docstring 정합, carried-forward 저우선순위 1건(6라운드째), RESOLUTION.md 관례는 이번 라운드엔 조건부 미성립 |

## 발견 없는 에이전트

없음 — 이번 라운드 7개 에이전트(forced 전원) 모두 최소 INFO 이상의 발견사항을 보고했습니다
(testing 은 WARNING 2건 포함). "문제 없음"으로 완전히 비어 있는 에이전트는 없습니다.

## 권장 조치사항

1. **(최우선)** testing WARNING 2건 조치 — `scripts/check-override-floors.py` `main()`의 `widened`
   계산 루프(288-296행, 특히 290-291행 override-미관리 스킵 가드·293행 `EXPECTED_SUPPRESSED_PATHS`
   기본값 분기)에 대한 회귀 테스트 2종을 `.claude/tests/test_override_floors.py`에 추가한다.
   뮤턴트로 실측된 두 결함 형태(무관 패키지 거짓 fail / 신규 억제 경로 무검증 통과 = "조용한 성공"
   재현)를 각각 고정할 것.
2. **(선택, 저비용)** `load_override_targets()`의 143행 `sorted(data)`를 `list(data)` 또는
   `sorted(data, key=str)`로 교체해, 비-문자열 YAML 최상위 키가 섞였을 때 진단 메시지 조립
   자체가 `TypeError`로 죽는 좁은 이중 조건을 제거한다(maintainability+testing 공동 지적).
3. **(선택, 6라운드째 이월)** 모듈 docstring `:14` 문장에 PR 번호(`#1038`)를 즉시 명시해 "4건"의
   출처를 그 문장 시점에 바로 밝힌다.
4. 위 1번(WARNING 2건) 조치 후 `RESOLUTION.md` 작성 또는 fresh clean `/ai-review` 재실행으로
   이번 라운드를 clean 상태로 수렴시킨다 — documentation 리뷰가 조건부로 남긴 "RESOLUTION.md
   불요" 결론의 전제(이번 라운드가 clean)를 충족시키기 위함.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 실행된 7명 전원이 forced 목록과 정확히 일치. forced 전원 결과 확보 확인, 누락 없음.
  - **제외**: 아래 표 (7명) — payload 에 reviewer 별 구체적 제외 사유가 포함되지 않아(이름만 나열됨) 개별 사유를 확인할 수 없었습니다. 변경 표면이 CLI 스크립트(`scripts/check-override-floors.py`) 및 그 회귀 테스트/CI 배선 단독이라는 점에서 API 계약·DB·동시성·성능·사용자 가이드 영역과 무관하다는 추정은 가능하나, 이는 이 요약 에이전트의 추정이며 router 가 명시한 근거는 아닙니다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 사유 미제공(payload 에 개별 사유 없음) |
  | architecture | 사유 미제공 |
  | dependency | 사유 미제공 |
  | database | 사유 미제공 |
  | concurrency | 사유 미제공 |
  | api_contract | 사유 미제공 |
  | user_guide_sync | 사유 미제공 |