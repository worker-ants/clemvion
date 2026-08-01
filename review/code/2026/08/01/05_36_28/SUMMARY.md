# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0, WARNING 4건(requirement 2·testing 1·scope 1). Critical 급 즉각 위험은
없으나, `requirement`와 `testing`이 각각 실측(직접 재현/mutation)으로 검증한 신규 WARNING이
이 스크립트 자신의 핵심 안전 불변식("exit 1은 오직 침식 발견만을 의미한다", "fail-closed
경로는 회귀 테스트로 고정된다")의 사각지대를 정면으로 겨냥하고 있어 MEDIUM으로 판정한다.
forced(router_safety) 7개 reviewer 전원 결과 확보 확인 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `run_audit()`의 `except subprocess.TimeoutExpired`가 `pnpm` 바이너리를 못 찾는 경우(`FileNotFoundError`)를 포섭하지 못해, 이 스크립트가 가장 경계하는 "exit 1(침식 발견)과 판단-불가 상황의 혼동"을 정확히 재현한다. **직접 재현 확인**(PATH에서 pnpm 제외 후 실행 → `FileNotFoundError` traceback + exit 1). 직전(8차) 조치가 형제 함수 `load_override_targets()`의 YAML 읽기 경로는 이미 고쳤으나 `run_audit()`의 서브프로세스 호출은 빠뜨렸다. | `scripts/check-override-floors.py:176-191` (특히 `:187`) | `except (subprocess.TimeoutExpired, OSError):`로 확장, `load_override_targets()`와 동일하게 `_undecidable()`로 라우팅. `mock.patch.object(subprocess, "run", side_effect=FileNotFoundError(...))` 회귀 테스트 추가 |
| 2 | Requirement | `chain_segments()`가 체인 구분자 `>` 앞에 공백이 있으면(OR-레인지 보호를 위한 의도된 설계의 반대편 부작용) 체인으로 분할하지 않아, 사람이 가독성을 위해 공백을 넣은 override 키(`"next > postcss"`)가 조용히 매칭 불가능한 유령 대상이 된다 — 크래시도 `_undecidable()` 경고도 없이 `OK` 메시지로 위장. **직접 재현 확인**(`chain_segments("next > postcss")` → 분할 안 됨). 같은 클래스(`>` 분할 규칙 오류)의 4번째 형제 사례(1차 Warning 2건 + 2차 Critical 1건에 이어). 오늘 `pnpm-workspace.yaml`은 전부 공백 없는 형식이라 현재 미트리거, `check-pnpm-security-config.py`의 baseline 대조가 부분 백스톱 제공 | `scripts/check-override-floors.py:95, 101-110, 113-117, 149-151` | `override_target()` 결과에 공백이 남으면(실제 npm 패키지명은 공백 불가) `_undecidable()`로 fail-closed. `OverrideTargetExtractionTest`에 `"next > postcss"` 케이스 추가 |
| 3 | Testing | 8차 조치가 넓힌 예외 처리(`except (yaml.YAMLError, UnicodeDecodeError, OSError)`)에 회귀 테스트가 없다. **mutation 검증**: 원래 `except yaml.YAMLError`로 되돌려도 41/41 GREEN 유지되지만, 되돌린 코드를 잘못된 UTF-8 바이트로 실제 실행하면 `returncode=1` + raw traceback(이 스크립트 어휘로 "침식 발견"과 동일 코드)이 재현된다. plan 문서의 "모두 종결" 서술과 상충(documentation INFO 참고) | `scripts/check-override-floors.py:128-135` (특히 `:131-132`) | `load_override_targets()`를 직접 호출하는 in-process 테스트 추가 (testing 리뷰어가 검증된 테스트 코드 제시 완료) |
| 4 | Scope | 커밋 `f46c560e9`("RESOLUTION 작성 — 라운드 1~7 조치 통합 기록")가 메시지 범위를 벗어나, 커밋 당시 아직 진행 중이던 8차 리뷰 세션(`04_58_18`)의 미완료 산출물 6개(`_retry_state.json`/`maintainability.md`/`meta.json`/`scope.md`/`security.md`/`side_effect.md`)를 함께 포함. 854줄 삽입 중 커밋 메시지가 밝힌 `RESOLUTION.md`는 78줄뿐 | 커밋 `f46c560e9` | 기능적 영향 없음(harness는 디스크 상태로 재개, 커밋 경계 비의존), 未push 상태로 급하지 않음. 필요 시 push 전 `f46c560e9`의 무관 파일 6개를 `614d72ba3`로 정리(대화형 rebase 필요 — 사람 판단 권장). 향후 `git add`를 커밋 메시지 범위로 좁히는 습관화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Maintainability/Documentation (교차 확인) | 8차 리뷰가 지적한 INFO 갭 2건(YAML `read_text()`가 예외 처리 범위 밖에 있던 것, `key=str` 설명 주석이 f-string 리터럴 사이에 낀 것)이 이번 델타로 정확히 해소됨을 3개 reviewer가 교차 확인 | `scripts/check-override-floors.py:14-15, 128-135, 138-143` | 조치 완료 확인. 추가 조치 불요 |
| 2 | Documentation | plan 체크리스트가 라운드 7 직후 명시적으로 예고했던 "RESOLUTION" 항목이, 라운드 8이 비-clean(Warning 2건)으로 끝났음에도 근거 설명 없이 사라짐. `04_58_18/RESOLUTION.md`도 미생성 | `plan/in-progress/deps-guard-hardening.md:185-198` | 다음 RESOLUTION.md(사이클 종결 시 작성) 표에 라운드 8 Warning 2건을 라운드 1~7과 같은 형식으로 포함 |
| 3 | Documentation | plan의 "INFO 1... 모두 종결" 표현이 예외 처리 확장(WARNING 3)에 대해서는 testing 리뷰어가 실측한 회귀 테스트 부재보다 앞서 있음 — 이 브랜치가 5~8차에 걸쳐 일관 적용한 "코드+테스트가 모여야 fix" 기준 미달 | `plan/in-progress/deps-guard-hardening.md:196-197` | WARNING 3 조치(회귀 테스트 추가) 전까지 plan 서술을 "코드 수정 완료, 회귀 테스트는 후속 보강 예정"처럼 조건부로 다듬기 |
| 4 | Maintainability | "주석이 인접 리터럴/인자 사이에 낀다" 패턴이 `load_override_targets()`는 이번에 정리됐으나, 직전 라운드가 "같은 성격"이라 명시적으로 연결했던 자매 사례 `run_audit()`(6차부터 이월)는 그대로 남아 파일 내 일관성이 근소하게 벌어짐 | `scripts/check-override-floors.py:176-186` (특히 `:182-184`) | 급하지 않음. 여유 시 `subprocess.run(` 호출 직전으로 주석 이동 |
| 5 | Documentation | 신규 `OSError` 추가 근거가 인접 주석에 명시되지 않음(이 파일의 다른 모든 `_undecidable()` 분기는 "왜"를 상세히 설명하는 관례와 대비) | `scripts/check-override-floors.py:129-132` | 급하지 않음. "`OSError`는 `main()`의 존재 확인과 이 호출 사이의 TOCTOU 경합을 닫는다" 한 문장 추가 |
| 6 | Testing | flaky 가드 메커니즘(`StubNotUsed`/마커) 자체를 지키는 자동화된 메타 회귀 테스트가 없음 — 커밋이 주장하는 뮤턴트 검증을 독립 재현해 메커니즘 자체는 유효함을 확인했으나 스위트에 남지 않음. 테스트 인프라 영역(프로덕션 코드 아님)이라 우선순위 낮음 | `.claude/tests/test_override_floors.py:85-86, 97-164` | 급하지 않음. 여유 시 `run_with_stub_audit` 대상 메타 테스트 추가 |
| 7 | Security | 저위험 반복 관찰 3건(변경 없음, 5~8차와 동일 판단): 서브프로세스 원문/예외 메시지 CI 로그 노출, PATH 기반 `pnpm` 호출(절대경로 미사용), 리포트 출력값 미새니타이징(이론적 로그 위조 표면) | `scripts/check-override-floors.py:135, 178, 197, 202, 208, 243, 250, 333-336, 352-355` | 조치 불요(기존 결론 유지). 향후 private registry 도입 시에만 토큰 redaction 고려 |
| 8 | Maintainability | 기존 저우선순위 4건 변화 없이 유효: `classify_vulnerable()` 내 스키마 드리프트 가드 구조적 중복 2곳(발생 2회, 헬퍼 추출 보류 기준 미달), 최장 함수(61줄), `main()`의 `widened`/`eroded` 인라인 계산 비대칭, 키 프리뷰 삼항식 구조적 유사 | `scripts/check-override-floors.py:213-273, 276-321, 147, 208` | 조치 불요 |
| 9 | Testing | 8차 WARNING("`sorted(key=str)` 회귀 테스트 부재") 대응 신규 테스트가 mutation 검증 결과 정확히 그 뮤턴트 1건만 잡음(vacuous 아님). `expect_stub_ran=False` 배선도 `_undecidable()`로 빠지는 6개 시나리오 전체에 누락 없이 정확히 적용됨 | `.claude/tests/test_override_floors.py:521-532, 492-540` | 조치 불요(검증 기록 목적) |
| 10 | Side Effect | 이번 델타(예외 처리 범위 확장) 및 테스트 헬퍼 신규 파일시스템 부작용(`tempfile.TemporaryDirectory()` 격리, `os.environ` 사본 전달) 모두 새 위험 표면을 만들지 않고 기존 위험(미포착 예외로 인한 crash)을 하나 줄임을 확인 | `scripts/check-override-floors.py:128-135`, `.claude/tests/test_override_floors.py:75, 129-151` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Critical/Warning 0. 8차 INFO 갭(YAML 예외 처리) 해소 확인 + 저위험 반복 관찰 3건(변경 없음) |
| requirement | MEDIUM | WARNING 2건 신규(직접 재현 검증) — `run_audit()` FileNotFoundError 미포착, `chain_segments()` 공백 포함 체인 키 매칭 실패(같은 클래스 4번째 사례) |
| scope | LOW | WARNING 1건 — 커밋 `f46c560e9` 메시지-내용 불일치(8차 세션 미완료 산출물 6개 혼입, 기능 영향 없음·未push) |
| side_effect | LOW | Critical/Warning 0. 예외 처리 확장이 새 위험 없이 기존 crash 위험 하나 흡수 확인 |
| maintainability | LOW | Critical/Warning 0. INFO 갭 2건 해소 확인 + 잔여 일관성 격차 1건(주석 배치, 저우선순위) |
| testing | MEDIUM | WARNING 1건(mutation 검증) — `UnicodeDecodeError`/`OSError` 예외 처리 회귀 테스트 부재. 8차 WARNING 조치 2건은 mutation으로 non-vacuous 확인 |
| documentation | LOW | Critical/Warning 0. RESOLUTION 추적 누락 우려 + plan "모두 종결" 서술이 testing WARNING보다 앞섬(forward-looking) |

## 발견 없는 에이전트

없음 — forced 7개 에이전트 전원 최소 INFO 이상 발견(대부분 이전 라운드 조치 확인 또는 저우선순위 관찰).

## 권장 조치사항

1. `run_audit()`의 `except subprocess.TimeoutExpired:`를 `except (subprocess.TimeoutExpired, OSError):`로 확장하고 `_undecidable()`로 라우팅 + `FileNotFoundError` 주입 회귀 테스트 추가 (WARNING 1, requirement).
2. `chain_segments()`/`override_target()` 결과값에 공백이 남으면 `_undecidable()`로 fail-closed 가드 추가 + `"next > postcss"` 류 테스트 케이스 추가 (WARNING 2, requirement).
3. `load_override_targets()`의 `UnicodeDecodeError`/`OSError` 처리 경로에 in-process 회귀 테스트 추가 — testing 리뷰어가 검증된 테스트 코드를 이미 제시함 (WARNING 3, testing).
4. (낮은 우선순위) push 전 커밋 `f46c560e9`의 무관 파일 6개를 `614d72ba3`로 정리할지 사람이 판단 — 대화형 rebase 필요, 기능적 영향은 없음 (WARNING 4, scope).
5. 이번 리뷰-조치 사이클이 최종 종결될 때 RESOLUTION.md에 라운드 8 Warning 2건과 9차(본 라운드) Warning 4건을 함께 표로 기록 (INFO 2, documentation).
6. 조치 1~3 완료 전까지 plan 서술 "모두 종결"을 "코드 수정 완료, 회귀 테스트 후속 보강 예정"처럼 조건부로 다듬기 (INFO 3, documentation).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명) — 전원 `forced(router_safety)` 목록과 정확히 일치
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, forced 전원 결과 확보됨)
  - **제외**: 7명 (아래 표)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 개별 사유를 제공하지 않음 |
  | architecture | 라우터가 개별 사유를 제공하지 않음 |
  | dependency | 라우터가 개별 사유를 제공하지 않음 |
  | database | 라우터가 개별 사유를 제공하지 않음 |
  | concurrency | 라우터가 개별 사유를 제공하지 않음 |
  | api_contract | 라우터가 개별 사유를 제공하지 않음 |
  | user_guide_sync | 라우터가 개별 사유를 제공하지 않음 |