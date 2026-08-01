# 유지보수성(Maintainability) 리뷰 — deps-guard 04_09_43

리뷰 대상 11개 파일 중 실질 코드는 `scripts/check-override-floors.py` 1개뿐이다(신규 347줄, `pnpm audit` 기반 override 바닥 침식 검출 CI 가드). 나머지 10개(`review/code/2026/08/01/03_47_10/{SUMMARY.md,_retry_state.json,documentation.md,maintainability.md,meta.json,requirement.md,scope.md,security.md,side_effect.md,testing.md}`)는 harness 가 자동 생성한 직전 리뷰 세션(5차 라운드)의 산출물(마크다운 리포트·JSON 상태 파일)이며, CLAUDE.md 규약대로 `review/code/**` 에 커밋되는 것이 정상 동작이다. 함수 길이·중첩·매직넘버 등 코드 지표를 적용할 대상이 아니라 별도로 훑어 구조 이상(스키마 불일치, 손상된 표 등)이 없음만 확인했다 — 이상 없음.

`scripts/check-override-floors.py` 는 오늘 이미 5차례 리뷰를 거친 파일로, 이번 라운드는 직전(03_47_10) 이후 실제로 바뀐 부분(WARNING 조치 커밋 `68e9064d3` — `_AUDIT_TIMEOUT_SEC` 도입, `load_override_targets()` 의 `overrides` 키 부재 가드, `run_audit()` 의 timeout/예외 처리)을 직접 diff 로 대조하고, 파일 전체를 독립적으로 재검토했다. `.claude/tests/test_override_floors.py`(569줄, 이 세션 라우팅 범위 밖)를 보조 근거로만 열람해 아래 발견사항 중 하나(테스트 결합도 관련)의 사실관계를 검증했다.

## 발견사항

- **[INFO]** `classify_vulnerable()` 내 스키마 드리프트 가드 2곳이 구조적으로 동일한 모양 — 직전 라운드부터 이어지는 관측, 이번 라운드에서 변경 없음
  - 위치: `scripts/check-override-floors.py:239-244`(`if advisories and not reported:`), `:249-254`(`if actions and not actions_with_module:`)
  - 상세: 두 블록 모두 `if <원본 컬렉션> and not <파생 필터 결과>: _undecidable(f"...하나도 없다...", f"  본 키: {...}[:_KEY_PREVIEW]")` 형태로 사실상 같은 모양이며, "본 키" 계산식(`sorted({k for adv in advisories.values() for k in adv})` vs `sorted({k for a in actions for k in a})`)만 다르다. 이 프로젝트가 `plan/in-progress/deps-guard-hardening.md` 에서 이미 채택한 "3번째 발생 전까지 헬퍼 추출 보류" 기준에 현재 2회로 아직 못 미친다. 5차 라운드 리뷰(review/code/2026/08/01/03_47_10/maintainability.md)가 동일하게 지적했고, 이번 델타(`68e9064d3`)는 이 두 블록을 건드리지 않아 판단이 그대로 유효하다.
  - 제안: 조치 불요. 3번째 유사 스키마 검사가 추가되는 시점에 `_check_schema_field(collection, filtered, label)` 류 헬퍼로 통합.

- **[INFO]** `classify_vulnerable()` 가 파일 내 최장 함수(61줄, docstring 20줄 포함) — 여전히 단일 응집 책임 유지
  - 위치: `scripts/check-override-floors.py:195-255`
  - 상세: `main()`(258-303, 46줄)·`run_audit()`(150-192, 43줄)보다 길다. 다만 "advisories/actions 를 reported/suppressed 로 분류 + 스키마 가정 2곳을 fail-closed 로 검증" 이라는 하나의 응집된 책임을 유지하며, 중첩도 최대 2단계(반복문 안 조건문)를 넘지 않는다. 분리가 필요한 임계에는 아직 도달하지 않았다는 5차 라운드 판단에 동의한다.
  - 제안: 조치 불요. 향후 3번째 판정 축(예: widened/eroded 외 신규 축)이 추가될 때 분리 후보로 재검토.

- **[INFO]** `main()` 이 오케스트레이션과 `widened`/`eroded` 산출 로직을 함께 갖고 있어, 파일의 나머지 부분("가져오기/변환은 이름 있는 함수, 보고는 `_report_*`") 패턴과 결이 다르다
  - 위치: `scripts/check-override-floors.py:274-282`(`widened` 계산), `:284-287`(`eroded` 계산) — 둘 다 `main()`(258-303) 내부
  - 상세: `load_override_targets`/`run_audit`/`classify_vulnerable` 는 각각 이름과 docstring을 가진 단일 책임 함수이고, 출력 쪽도 `_report_widened`/`_report_eroded` 로 대칭적으로 분리돼 있다. 그런데 그 사이 단계 — "억제된 항목 중 baseline 밖으로 늘어난 경로 찾기"(widened, 조건부 continue + 집합 차 8줄)와 "override 대상인 reported 골라내기"(eroded, 4줄) — 는 이름 없이 `main()` 본문에 그대로 인라인돼 있어 `_report_*` 짝이 없는 비대칭이다. (테스트 파일을 확인한 결과, `classify_vulnerable()` 처럼 이미 독립 함수로 뽑혀 있는 로직조차 `.claude/tests/test_override_floors.py` 에서 직접 단위 호출되지 않고 전부 `run_with_stub_audit()` 서브프로세스 경유로만 검증되므로, 이 인라인을 함수로 뽑는다고 해서 테스트 방식이 곧바로 바뀌리라는 보장은 없다 — 즉 이 제안은 테스트 가능성 문제가 아니라 순수하게 파일 자체의 "작고 이름 있는 함수" 관례와의 일관성 문제다.)
  - 제안: 급하지 않음. `main()` 에 세 번째 판정 축이 추가되거나 이 블록이 더 길어지면 `_compute_widened(suppressed, targets)`/`_compute_eroded(reported, targets, patched_by_module)` 로 뽑아 `_report_widened`/`_report_eroded` 와 대칭을 맞추는 것을 권한다.

- **[INFO]** 자매 스크립트와 저장소 루트 계산 방식이 다름 — 사소한 스타일 편차, 결함 아님
  - 위치: `scripts/check-override-floors.py:53-54`(`REPO_ROOT`/`WORKSPACE_YAML` 모듈 상수) vs `scripts/check-pnpm-security-config.py:92`(`main()` 내부 지역변수 `root`)
  - 상세: 이 파일은 `REPO_ROOT` 를 모듈 레벨 상수로 두고 3곳(`run_audit`의 `cwd=`, `main`의 `WORKSPACE_YAML.exists()`, `load_override_targets(WORKSPACE_YAML)`)에서 재사용하는 반면, 같은 목적의 자매 스크립트 `check-pnpm-security-config.py` 는 동일 계산을 `main()` 안의 지역변수로 1회만 사용한다. 둘 다 유효한 방식이고 이 파일 쪽이 재사용 빈도상 모듈 상수화가 더 자연스럽다 — 결함이 아니라 두 자매 스크립트 간 미세한 컨벤션 차이 기록 목적.
  - 제안: 조치 불요.

- **[INFO]** `run_audit()` 의 timeout 설명 주석이 `subprocess.run()` 인자 목록 중간에 3줄로 끼워져 있음
  - 위치: `scripts/check-override-floors.py:164-166`(주석), `:167`(`timeout=_AUDIT_TIMEOUT_SEC,`)
  - 상세: `capture_output=True`/`text=True` 다음, `timeout=` 인자 바로 위에 "왜 timeout 이 필요한가"를 설명하는 3줄 주석이 함수 호출 인자 나열 중간에 위치한다. 문법적으로 무해하고 설명 대상 바로 위라는 근접성은 있으나, 인자 목록을 시각적으로 끊어 읽기 리듬이 흐트러진다. 파일의 다른 주석들(예: `_KEY_PREVIEW` 등 상수 옆 한 줄 주석)은 대체로 정의부 밖에 위치한다.
  - 제안: 급하지 않음. 여유가 있으면 주석을 `subprocess.run(` 호출 직전으로 옮기거나 한 줄로 축약.

## 요약

`scripts/check-override-floors.py` 는 5차 리뷰를 거치며 이미 짧고 단일 책임인 함수, 이름 붙은 매직넘버 상수(`_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/`_KEY_PREVIEW`/`_AUDIT_TIMEOUT_SEC`), 얕은 중첩(최대 2단계), fail-closed 패턴의 반복 사용(`_undecidable()` 단일 진입점)으로 수렴된 상태이며, 이번 라운드에서 대조한 최신 델타(timeout·overrides 키 부재 가드)도 기존 스타일과 정확히 같은 관용구(named constant, `_undecidable()` 위임, "왜"를 설명하는 인접 주석)로 작성돼 새로운 결함을 들여오지 않았다. 매직 넘버·깊은 중첩·순환 복잡도 과다는 발견되지 않았고, 유일한 구조적 중복(스키마 드리프트 가드 2곳)은 프로젝트가 이미 채택한 "3회째까지 보류" 기준 아래에 있어 조치 대상이 아니다. 이번 라운드에서 새로 짚은 것은 `main()` 의 widened/eroded 인라인 계산이 파일의 나머지 "이름 있는 함수" 관례와 비대칭이라는 점과 자매 스크립트 간의 사소한 스타일 편차뿐이며, 둘 다 INFO 수준의 전방주시형 제안이다. 병합을 막을 CRITICAL·WARNING 은 없다.

## 위험도

LOW
