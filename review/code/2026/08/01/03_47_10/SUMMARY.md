# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건, WARNING 2건(모두 testing 에이전트, 대상: `scripts/check-override-floors.py`). 두 WARNING 은 이 스크립트가 스스로 막겠다고 선언한 "취약점이 있는데 조용히 통과" 실패 클래스와 동일한 성격의 테스트 커버리지 갭이며, 실제 뮤턴트 주입으로 실증됨. forced(router_safety) reviewer 6명(maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `run_audit()` docstring 이 명시한 "returncode 로 성공을 판단하지 않는다" 불변식을 검증하는 테스트가 없다. 테스트 스텁(`_PNPM_STUB`)이 `sys.exit()`을 호출하지 않아 advisory 존재(실제 pnpm 이면 exit 1)/무취약(exit 0) 여부와 무관하게 종료 코드가 항상 0이다. **실측**: `if proc.returncode != 0: _undecidable(...)` 뮤턴트를 주입하면 실제 pnpm 처럼 exit 1+유효 JSON 을 내는 스텁에서는 정상 취약점 분류가 "판단 불가"(exit 2)로 완전히 오분류됐으나, 현재 테스트 스위트(exit 0 고정 스텁)에서는 같은 뮤턴트가 28개 테스트 전부 GREEN 을 유지 — 이 스크립트가 막으려는 실패의 거울상이 탐지되지 않음 | `scripts/check-override-floors.py:141-153` (`run_audit()`) | `run_with_stub_audit()`/`_PNPM_STUB`에 종료 코드 파라미터를 추가하고, 취약점이 실제 존재하는 케이스(예: `ClassificationTest.test_advisory_on_managed_package_fails`)를 스텁이 `sys.exit(1)`을 내는 변형으로 복제해 회귀 고정 |
| 2 | testing | `pnpm-workspace.yaml` 최상위 `overrides:` 키가 통째로 없거나 오타(`override:`)인 경로에 fail-closed 도 테스트도 없다. `data.get("overrides") or {}`가 조용히 빈 dict 를 반환해 `targets`가 `{}`가 되고, 결과적으로 항상 `OK: override 대상 0개 패키지`로 exit 0 — 이 스크립트 전체가 방어하는 "설정 파싱이 깨졌는데 취약점 0건과 구별 안 되는 성공"과 동일한 실패 형태인데 이 경로만 `_undecidable()` 가드가 없음 (파일 자체 부재는 별도로 잡혀 테스트도 있음 — "키는 있는데 구조가 다른" 경우와 대비되는 "키 자체 부재"만 빠짐) | `scripts/check-override-floors.py:118` (`load_override_targets()`) | `overrides` 키가 최상위에서 아예 없을 때(파일은 파싱됐지만 키 자체가 없는 경우) `_undecidable()`로 fail-closed 처리하고 `EXPECTED_SITES`/`FailClosedSiteCountTest` 카운트에도 반영하는 회귀 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 실패 진단 경로에서 `pnpm audit`의 raw stdout/stderr 일부(최대 2000/500자)를 CI 로그로 그대로 출력. 정상 상황에서 자격증명 노출은 없으나, private registry 인증 실패 등 예외 케이스에서 토큰이 섞여 나올 가능성을 코드 레벨에서 배제하지 않음(기존 스크립트들과 동일 관례) | `scripts/check-override-floors.py:157,162,168,221,231,239` | 필요 시 알려진 토큰/Basic-Auth URL 패턴에 대한 redaction 을 preview 적용 전에 추가 |
| 2 | security | `pnpm` 바이너리를 절대경로가 아닌 PATH 기반 이름으로 호출(공급망 침해 시 이론적 위험, `shell=True` 미사용이라 인자 인젝션은 없음). 리포지토리 전반의 기존 관례와 일치 | `scripts/check-override-floors.py:147` | 별도 조치 불요 |
| 3 | requirement / side_effect / testing (공통 지적) | `run_audit()`의 `subprocess.run`에 `timeout=`이 없어, 레지스트리 응답 지연 시 무기한 대기 가능. `_undecidable()` 6곳은 "응답은 왔지만 형태가 이상함"만 다루고 "응답 자체가 안 옴"은 다루지 않음. CI job timeout(`deps-security-checks.yml`)이 최종 백스톱이라 안전 불변식은 유지됨 | `scripts/check-override-floors.py:146-151` | `timeout=120` 등을 추가하고 `subprocess.TimeoutExpired`를 `_undecidable()`로 라우팅 |
| 4 | requirement | fail-closed 스키마 드리프트 방어가 "6곳"으로 코드에 결속돼 있으나, `advisories`/`actions`가 dict/list 가 아닌 다른 truthy 값(예: 문자열)으로 오면 그 6곳 밖에서 미가공 `AttributeError`로 죽는다. 조용한 성공은 아니라 핵심 위험(취약점 0건 오인)은 재현되지 않으나 진단 메시지 품질이 traceback 으로 저하 | `scripts/check-override-floors.py:195-196,199,206` | 필수 아님. 실제 관측되면 `isinstance` 체크 추가 |
| 5 | scope | 스크립트가 `eroded`/`widened` 2개 판정 축을 가짐 — plan §1 원문은 "오버라이드 하한 < 알려진 패치 하한"(eroded) 한 축만 명시. `widened`(ignoreCves 억제분 재유입 검출) 축은 구현 중 실측으로 드러난 자기 사각(가드 자신이 `ignoreCves`로 무력화되는 문제)을 막기 위한 보강이며 plan 문서에 근거가 기록돼 있어 범위 이탈 아님 | `classify_vulnerable()` 173-233행, `main()` 250-265행 | 조치 불요, 기록 목적 |
| 6 | side_effect | `_undecidable()`의 `sys.exit(2)`가 top-level `main`/`__main__` 경계가 아니라 업무 로직 함수 내부(`run_audit`/`classify_vulnerable`/`main`) 6곳에서 직접 발생. 현재는 모든 테스트가 서브프로세스로만 이 경로를 실행해 테스트 러너가 죽을 위험은 없음 | `scripts/check-override-floors.py:125-135` (정의), 호출부 154-239 | 조치 불요. 향후 in-process 재사용 계획이 생기면 예외 발생 방식으로 전환 고려 |
| 7 | side_effect | PyYAML 미설치 시 **import 시점**에 `sys.exit(2)` 발생(ImportError 대신). 자매 스크립트 `check-pnpm-security-config.py`와 동일 관례 | `scripts/check-override-floors.py:47-51` | 조치 불요 |
| 8 | maintainability | `classify_vulnerable()` 내 스키마 드리프트 가드 2곳(`advisories`/`actions` 검사)이 구조적으로 동일한 모양으로 중복. 이 중 두 번째(`actions`) 자리가 바로 직전 라운드에서 실제 버그가 났던 지점이라, 세 번째 유사 검사 추가 시 같은 방식으로 손으로 베끼면 재발 여지 있음. 이 프로젝트의 "3번째 발생까지 보류" 기준에 아직 못 미침(현재 2회) | `scripts/check-override-floors.py:217-222`, `227-232` | 지금은 조치 불요. 3번째 유사 검사 추가 시 공통 헬퍼로 추출 권장 |
| 9 | maintainability | `classify_vulnerable`이 이번 델타로 파일 내 최장 함수가 됨(61줄, docstring 20줄 포함) — 단, 여전히 단일 응집 책임 유지 중이라 분리 필요 수준 아님. (긍정 관측: 같은 델타가 `actions_with_module`이라는 공유 파생값을 도입해 직전 라운드 버그의 근본 원인 — 관측 대상과 판정 변수의 불일치 — 를 구조적으로 줄임) | `scripts/check-override-floors.py:173-233` | 조치 불요. 향후 분기 추가 시 분리 후보로 기록 |
| 10 | testing | `classify_vulnerable()`/`main()`의 2·3차 폴백 분기(advisory 식별자의 `name` 최종 폴백, `resolves[].path` 부재 시 `"?"`, `patched_versions` 부재 시 `"?"`)가 테스트되지 않음. exit code/fail-closed 판정에는 영향 없는 순수 출력 포맷팅이라 심각도는 낮으나, 도달 시 CI 로그 진단 가치가 떨어짐 | `scripts/check-override-floors.py:203,210,245` | 우선순위 낮음. 여유가 있으면 각 폴백에 한 줄 케이스 추가 |
| 11 | documentation | 모듈 docstring 이 "실측 5건"을 나열한 직후(`:6-12`) "위 4건"으로 좁혀 부르는 대목(`:14`)이, 5건 중 어느 1건이 왜 빠지는지 그 문장 시점엔 밝히지 않아 순서상 잠깐 모호(사실관계 오류는 아님, 7줄 뒤 `:21`에서 해소). 원커밋부터 존재해온 문구로 1~4차 리뷰에서 지적된 적 없음 | `scripts/check-override-floors.py:6-14` | 급하지 않은 선택적 다듬기. `:14`에 PR 번호(`#1038`)를 즉시 명시하면 근거가 그 자리에서 바로 섬 |
| 12 | documentation | `main()`/`_report_widened()`/`_report_eroded()` 3개 함수에 독립 docstring 없음 — 형제 스크립트의 기존 관례와 일치하고 인접 인라인 주석이 이미 있어 실질 정보 손실은 없음 | `scripts/check-override-floors.py` (`main`, `_report_widened`, `_report_eroded`) | 강제성 없는 선택 사항. `main()`에 2~3줄 요약 docstring 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CI 로그 subprocess 원문 노출 가능성(INFO), PATH 기반 pnpm 호출(INFO) — 둘 다 리포지토리 기존 관례와 일치, 인젝션/시크릿/ReDoS 표면 없음 |
| requirement | LOW | 라이브 `pnpm audit` 직접 실행으로 실측 검증(override 대상 26개 정확 일치, 오탐 0건 확인). timeout 부재·6곳 밖 스키마 드리프트 미가공 예외만 INFO |
| scope | LOW | widened/eroded 2축 구조가 plan §1 원문보다 확장이나, 구현 중 실측 발견 보강으로 plan 문서에 근거 기록돼 범위 이탈 아님 |
| side_effect | LOW | 신규 네트워크 호출(pnpm audit)은 의도된 설계이고 테스트가 스텁으로 완전 격리 확인. FS/전역 상태 부작용 없음, 기존 호출자 없어 파손 위험 없음 |
| maintainability | LOW | 직전 라운드 버그 조치 델타가 유지보수성도 개선(공유 파생값 도입). 스키마 드리프트 가드 2곳 구조적 중복은 아직 헬퍼화 임계(3회) 미달 |
| testing | MEDIUM | WARNING 2건 — (1) returncode 불변식 미검증(뮤턴트로 실증: 스텁이 항상 exit 0이라 실제 취약점 오분류 회귀가 탐지 안 됨), (2) `overrides` 키 완전 부재 시 fail-closed 미적용(항상 조용히 "대상 0개"로 통과) |
| documentation | LOW | 4차 리뷰의 문서 수치 drift(6곳 fail-closed) 해소를 코드 직접 대조로 재검증 완료. docstring 서술 순서 모호 1건(INFO)만 신규 |

## 발견 없는 에이전트

없음 — 실행된 7개 에이전트 모두 최소 1건 이상(INFO 이상)의 발견사항을 보고했다.

## 권장 조치사항

1. **(WARNING #1)** `_PNPM_STUB`/`run_with_stub_audit()`에 종료 코드 지정 파라미터를 추가하고, 취약점이 실제 존재하는 시나리오를 `sys.exit(1)` 스텁으로 복제해 "returncode 로 판단하지 않는다" 불변식에 대한 회귀 테스트를 고정한다.
2. **(WARNING #2)** `load_override_targets()`에서 `overrides` 키가 최상위에서 아예 없는 경우를 `_undecidable()`로 fail-closed 처리하고, `EXPECTED_SITES`/`FailClosedSiteCountTest` 카운트 갱신 + 회귀 테스트를 추가한다.
3. (선택, 낮은 우선순위) `run_audit()`의 `subprocess.run`에 `timeout=`을 추가하고 `TimeoutExpired`를 `_undecidable()`로 라우팅한다(3개 reviewer 공통 지적).
4. (선택) `classify_vulnerable()`/`main()`의 미검증 폴백 분기(`name` 최종 폴백, `path`/`patched_versions`의 `"?"`)에 대한 케이스를 `ClassificationTest`에 추가한다.
5. (선택, 문서) 모듈 docstring `:14`에 PR 번호(`#1038`)를 즉시 명시해 "5건 나열 → 4건으로 좁힘" 서술의 근거를 앞당긴다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing (6명) — forced 전원 결과 확보 확인됨(누락 없음)
  - **제외**: 7명 (아래 표). 개별 사유는 routing 출력에 세부 텍스트가 제공되지 않았으며, diff 범위가 신규 CI/의존성 감사 스크립트 1개 파일(`scripts/check-override-floors.py`)로 한정되어 해당 영역(성능/아키텍처/의존성 계약 변경/DB/동시성/API 계약/사용자 가이드)과 무관하다고 router 가 판단한 것으로 추정됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — diff 범위(단일 CI 스크립트)와 무관 |
  | architecture | router 판단 — diff 범위(단일 CI 스크립트)와 무관 |
  | dependency | router 판단 — diff 범위(단일 CI 스크립트)와 무관 (패키지 의존성 자체가 아닌 CI 가드 코드) |
  | database | router 판단 — diff 범위(단일 CI 스크립트)와 무관 |
  | concurrency | router 판단 — diff 범위(단일 CI 스크립트)와 무관 |
  | api_contract | router 판단 — diff 범위(단일 CI 스크립트)와 무관 |
  | user_guide_sync | router 판단 — diff 범위(단일 CI 스크립트)와 무관 |