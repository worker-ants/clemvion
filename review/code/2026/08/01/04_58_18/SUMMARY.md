# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — Critical 0건, WARNING 2건(모두 테스트 스위트 신뢰성/커버리지 갭이며 프로덕션 코드
자체의 결함은 아님 — 회귀 스위트 간헐적·비결정적 실패 1건[requirement], 직전 라운드 fix 의 회귀
테스트 부재 1건[testing]). `scripts/check-override-floors.py` 자체의 보안·부작용·범위·유지보수성·
문서화 관점은 security/scope/side_effect/maintainability/documentation 5개 reviewer 전원이
8차 연속 LOW·clean 으로 수렴했다. router_safety 강제 포함(forced) 목록 7명 전원의 결과가 정상
확보되어 누락은 없다 — "강제 화이트리스트 미이행" 사각지대 없음.

## Critical 발견사항

없음 — 이번 라운드 실행된 7개 reviewer 전원 Critical 발견사항 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | 회귀 스위트가 간헐적·비결정적으로 실패한다 — `WidenedFilterTest.test_managed_module_absent_from_baseline_always_widens`. 전체 스위트를 50회 반복 실행한 결과 1회(≈2%) exit 0("OK")로 끝났다(스텁이 정상 동작했다면 나올 수 없는 결과). 이후 49회 + 추가 재현 시도 109회(전체 스위트 재실행 49회 + 격리 실행 60회)에서는 재현되지 않았다. 가장 유력했던 "로컬 시스템 `pnpm` 과의 PATH 경합(TOCTOU)" 가설은 빈 임시 디렉터리에서 실제 `pnpm audit --json` 을 직접 실행해 반증했다(관측 결과 `ERR_PNPM_AUDIT_NO_LOCKFILE` → exit 2 가 예상되나, 실제 관측은 exit 0). CI(`harness-checks.yml`)는 이 unittest 잡에 `pnpm` 을 설치하지 않아 최소한 이 메커니즘으로는 위협받지 않는 것으로 보이나, 근본 원인 자체는 미확정이다. | `.claude/tests/test_override_floors.py:416-421`(대상 프로덕션 코드는 `scripts/check-override-floors.py:290-298`, `main()`의 `widened` 계산 루프) | `run_with_stub_audit()` 를 (discover 가 아닌 Python 레벨에서) 500회 이상 스트레스 반복해 재현율을 정밀 특정. 재현 시 실제 실행된 바이너리를 자체 진단할 수 있도록 스텁 진입 마커·stdout/stderr 전량 캡처 계측 추가. push 직전 최종 검증 라운드라는 시점을 고려해 우선 처리 권장. |
| 2 | Testing | 7차 INFO(`sorted()` 의 `TypeError` 가능성)의 프로덕션 수정(`sorted(data, key=str)`)은 완료됐으나, 이를 지키는 회귀 테스트가 하나도 없다 — mutation 으로 `sorted(data, key=str)` 를 원래의 `sorted(data)` 로 되돌려도 `.claude/tests/test_override_floors.py` 40개 전부 GREEN 을 유지함을 직접 확인했다. 실패 방향이 "조용한 성공"이 아니라 항상 비-0 종료(진단 품질 저하일 뿐)라 심각도는 낮지만, 완전 무검증 상태라는 점에서 이 리뷰 체인이 6차 라운드에 동일 형태(`TimeoutExpired` 분기)에 부여했던 것과 같은 급의 WARNING. | `scripts/check-override-floors.py:140-146`(특히 `:145`), 대응 테스트는 `.claude/tests/test_override_floors.py` 전체에 0건(`grep -n "key=str\|TypeError"` 매칭 없음) | testing.md 가 제시·직접 검증(현재 코드에서 통과 확인)한 한 줄 테스트를 그대로 추가: `run_with_stub_audit({}, 'overrides: "liquidjs"\non: true\n')` 호출 후 `returncode == 2` 및 stderr 에 `"Traceback"` 부재를 단언하는 `test_diagnostic_survives_mixed_type_top_level_keys`. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | (신규) `pnpm-workspace.yaml` 읽기(`path.read_text`)가 YAML 파싱 예외 처리 블록(`try/except yaml.YAMLError`) 밖에 있다 — 파일이 유효하지 않은 UTF-8 을 담고 있으면 `UnicodeDecodeError` 가 그대로 전파되어 미가공 traceback 과 함께 exit 1 로 죽는다. 이 스크립트 어휘에서 exit 1 은 "침식 발견"을 의미하므로, 이 좁은 조건(파일 인코딩 오류)에서는 구문 오류(이미 방어됨)와 달리 "판단 불가(exit 2)"와 혼동될 수 있다. 핵심 fail-closed 불변식("조용한 성공 없음")은 깨지지 않는다. | `scripts/check-override-floors.py:127`(`read_text`), `:128-130`(`try/except` 범위) | 급하지 않음 — `read_text` 호출을 `try` 블록 안으로 옮기거나 `except (yaml.YAMLError, UnicodeDecodeError, OSError)` 로 확장해 파일 I/O 실패도 exit 2 로 fail-closed 처리. |
| 2 | Security | (신규) 리포트 출력 함수가 `pnpm audit` 응답·override 키에서 뽑은 값을 새니타이징 없이 그대로 CI 로그에 출력 — 이론적 로그 위조(CWE-117 인접, OWASP A09 인접) 표면이나, npm 패키지명 문자셋 제약(공백·개행 불허)과 advisory 값이 신뢰된 소스(GitHub Advisory DB)에서 파생된다는 점에서 실효 위험은 매우 낮음. | `scripts/check-override-floors.py:241,248,331-334,350-353`(`_report_widened`/`_report_eroded` 등) | 조치 불요. 향후 advisory 의 자유 텍스트 필드(제목·설명)를 소비하게 되면 그때 개행/제어문자 스트리핑 고려. |
| 3 | Security | (carried-forward, 8차 연속 동일 판단) 서브프로세스 raw stdout/stderr 일부·YAML 파싱 예외 메시지가 CI 로그(stderr)에 그대로 노출 + `pnpm` 바이너리를 PATH 기반 이름으로 호출(절대경로 미사용). 현재 `pnpm-workspace.yaml`에 private registry/`_authToken` 설정이 없어 실제 토큰 노출 가능성은 낮음. | `scripts/check-override-floors.py:133,176,195,200` | 조치 불요. private registry 도입 시 토큰/Basic-Auth URL 패턴 redaction 재검토. |
| 4 | Maintainability | (신규) 신규 설명 주석(`key=str` 근거, `:143-144`)이 두 f-string 리터럴이 암묵적으로 하나로 연결되는 지점 한가운데 끼어들어, 이 함수가 이미 확립한 "주석은 `_undecidable()` 호출 직전에" 관례를 깬다(문법적으로는 무해 — `py_compile`/`ast.parse` 로 직접 재확인). | `scripts/check-override-floors.py:139-146`(특히 `:142-145`) | `:136-138`의 기존 설명 블록에 한 줄로 합치거나, 호출 시작(`:139`) 바로 앞으로 이동. |
| 5 | Documentation | (신규, 게이트 스코프 밖 확장 점검) `.claude/tests/test_override_floors.py` 모듈 docstring의 "축 3"/"나머지 두 클래스" 서술이 이번에 신설된 `WidenedFilterTest` 를 반영하지 않는다 — 신설 회귀 클래스를 해당 축 문단에 흡수해 온 축-4 의 기존 관례에서 이번 한 곳만 비켜났다(사실관계 오류는 아님). | `.claude/tests/test_override_floors.py:22-25,40-43,390-399` | 급하지 않음 — 축-3 문단 끝에 두 경계조건(override 미관리 스킵, baseline 부재 시 fail-closed 기본값)을 한두 문장 추가하거나 "나머지 클래스들"로 일반화. |
| 6 | Documentation | (carried-forward, 5·6·7차에 이어 4라운드 연속 이월) 모듈 docstring의 "실측 5건 → 위 4건" 서술 순서가 한 문장 시점에서 잠깐 모호(사실관계 오류는 아님, `:21`에서 뒤늦게 해소됨). 원커밋(`6b55b0f48`)부터 존재. | `scripts/check-override-floors.py:6-14`(특히 `:14`) | 수정 비용이 낮으므로 이번 기회에 최종 정리하거나, "의도적으로 조치하지 않음"으로 명시 확정해 매 라운드 재언급을 종결. |
| 7 | Testing | (신규, mutation 검증 부수 관찰) `WidenedFilterTest` 가 `EXPECTED_SUPPRESSED_PATHS` 에 아직 등록되지 않은 `"liquidjs"` 모듈명에 의존 — 향후 그 키가 추가되면 테스트 전제가 깨질 수 있는 낮은 확률의 미래 결합 리스크(실패 방향이 "조용한 통과"가 아니라 "빨간불"이라 자기진단적, 심각도 낮음). | `.claude/tests/test_override_floors.py:416-421` | 조치 불요, 참고 기록. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Critical/Warning 0건. INFO 4건(신규 2건: YAML 예외처리 범위 밖 `read_text`, 리포트 출력 새니타이징 부재 / carried-forward 2건: stderr 노출, PATH 기반 `pnpm`). 7차 조치 델타(`fdc7ad801`) 보안 회귀 없음 직접 대조 확인. |
| requirement | MEDIUM | WARNING 1건 — 회귀 스위트 간헐적 비결정적 실패(50회 중 1회, ≈2%, 근본원인 미확정). PATH 경합 가설은 직접 프로브로 반증. 프로덕션 로직(기능완전성·엣지케이스·에러시나리오·반환값·spec 무관)은 8차 연속 이상 없음. |
| scope | LOW | Critical/Warning 0건. 델타가 7차 지적사항(Warning 2건+INFO 1건)에 정확히 국한, 무관 변경·설정 변경·over-engineering 없음. |
| side_effect | LOW | Critical/Warning 0건. `sorted` 수정은 행동 보존적 방어 수정(`isinstance(data, dict)` 가드 안에서만 호출), 전역 mutation/파일쓰기/네트워크 신규 표면 없음. |
| maintainability | LOW | Critical/Warning 0건. INFO 1건 신규(주석 배치가 지역 관례 이탈, 문법적으로 무해). `key=str` 선택은 직전 라운드 제안 대안보다 견고(긍정 관측). |
| testing | MEDIUM | WARNING 1건 — `sorted(key=str)` 수정에 회귀 테스트 부재(mutation 검증: 되돌려도 40/40 GREEN 유지). 신설 `WidenedFilterTest` 2건은 뮤턴트 각 1건씩 정확히 겨냥함을 직접 검증(긍정 관측). |
| documentation | LOW | Critical/Warning 0건. INFO 2건(신규: docstring 축-3 미반영 / 4라운드 이월: "5건→4건" 서술순서 모호). 신규 주석의 PyYAML 주장은 직접 재현으로 정확성 확인. fail-closed 지점(9)·CI 타임아웃(10분) drift 없음. |

## 발견 없는 에이전트

해당 없음 — 이번 라운드 실행된 7개 에이전트 전원이 최소 1건 이상의 INFO(또는 WARNING) 관측을
보고했다(Critical/Warning 이 0건인 5개 에이전트도 각자 INFO 관측은 있음).

## 권장 조치사항

1. **[WARNING/testing]** `scripts/check-override-floors.py:145`(`sorted(data, key=str)`) 수정을
   지키는 회귀 테스트 1줄을 `.claude/tests/test_override_floors.py` 에 추가한다 — testing.md 가
   제시하고 현재 코드에서 통과를 직접 검증한 `test_diagnostic_survives_mixed_type_top_level_keys`
   형태를 그대로 적용 가능한 최저비용 조치다.
2. **[WARNING/requirement]** 회귀 스위트의 간헐적 비결정적 실패
   (`WidenedFilterTest.test_managed_module_absent_from_baseline_always_widens`, ≈2%) 재현율을
   `run_with_stub_audit()` 500회 이상 스트레스 실행으로 정밀 특정하고, 재현 시 실제 실행된
   바이너리를 자체 진단할 수 있는 계측(마커 파일·stdout/stderr 전량 캡처)을 추가한다. push
   직전 최종 검증 라운드라는 시점을 고려해 우선 처리를 권장한다.
3. **[INFO/security]** `pnpm-workspace.yaml` 의 `path.read_text(encoding="utf-8")` 호출(`:127`)을
   YAML 파싱 예외 처리 범위 안으로 옮기거나 `except` 절을 `(yaml.YAMLError, UnicodeDecodeError,
   OSError)` 로 확장해 fail-closed 일관성을 강화한다.
4. **[INFO/maintainability]** 신규 설명 주석(`:143-144`)을 `:136-138` 기존 설명 블록에 합치거나
   호출 직전(`:139`)으로 옮겨 이 함수의 지역 관례와 정합시킨다.
5. **[INFO/documentation]** `.claude/tests/test_override_floors.py` 모듈 docstring 축-3 문단에
   `WidenedFilterTest` 를 반영하고, "실측 5건→4건" 서술 순서를 이번 기회에 최종 정리해 4라운드째
   이월되는 항목을 종결한다.
6. **[INFO/security]** 로그 새니타이징 부재·PATH 기반 `pnpm` 호출은 현재 조치 불요 — private
   registry 도입 등 조건 변화가 있을 때만 재검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명) — 아래 사유는 이번 라운드 프롬프트가 개별 근거 텍스트 없이 이름만
    전달해, 변경분 성격(CI 전용 Python 스크립트 진단 메시지 조립부 3줄 + 이전 라운드 리뷰
    산출물 정적 파일)에 근거해 **추정**한 것이다(라우터 산출 근거 파일 자체는 이 워크플로
    입력에 없음).
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) —
    이번 라운드 실행된 reviewer 전원과 정확히 일치한다. 즉 이 변경분에 대한 router 의 조직적
    선택은 사실상 0명이었고, 실행된 7명 전부가 router_safety 표준 화이트리스트에 의해 강제
    포함되었다. **forced 전원의 결과가 정상 확보**되어(pending·누락 없음) "강제 포함인데
    결과 없음"에 해당하는 사각지대는 없다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(개별 사유 텍스트 미제공) — 성능 민감 코드 경로 변경 없음(진단 메시지 조립부 3줄) 추정 |
  | architecture | 라우터 판단(개별 사유 텍스트 미제공) — 아키텍처/모듈 경계 변경 없음 추정 |
  | dependency | 라우터 판단(개별 사유 텍스트 미제공) — 신규/제거 의존성 없음(기존 `sorted` 내장 함수 재사용) 추정 |
  | database | 라우터 판단(개별 사유 텍스트 미제공) — DB 접점 없음(CLI 스크립트) 추정 |
  | concurrency | 라우터 판단(개별 사유 텍스트 미제공) — 동시성 코드 경로 없음 추정 |
  | api_contract | 라우터 판단(개별 사유 텍스트 미제공) — API 계약 변경 없음 추정 |
  | user_guide_sync | 라우터 판단(개별 사유 텍스트 미제공) — 사용자 가이드 문서 대상 아님(`spec_impact: none`, CI 내부 스크립트) 추정 |