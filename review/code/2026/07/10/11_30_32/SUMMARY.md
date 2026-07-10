# Code Review 통합 보고서

## 전체 위험도
**LOW** — CI 관측성(flaky surfacing) 스크립트/테스트/워크플로 설정만 다루는 후속 fix 커밋. 읽을 수 있었던 5개 reviewer(scope/side_effect/maintainability/testing/documentation) 모두 위험도 LOW, CRITICAL 없음. 다만 `security`·`requirement` reviewer 는 manifest 상 `success` 이나 output 파일이 디스크에 존재하지 않아 내용을 확인하지 못했다(아래 참고) — 이 두 영역은 재확인 전까지 미검증 상태.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/scope | `test_flaky_table_lists_each` 에서 두 번째 엔트리("테스트 2")의 title 렌더 검증(`self.assertIn("테스트 2", md)`)이 커밋 메시지에 언급 없이 삭제됨. `entries` fixture 는 여전히 2건을 구성하고 `flaky 2건` 카운트 검증은 남아있으나, 다건(multi-entry) 렌더에서 두 번째 이후 행이 누락되는 회귀를 이 테스트가 더 이상 잡지 못함(조용한 커버리지 축소) | `.claude/tests/test_report_playwright_flaky.py` `RenderMarkdownTest.test_flaky_table_lists_each` | `self.assertIn("테스트 2", md)` 복원. 의도된 정리였다면 커밋 메시지에 사유 명시 |
| 2 | documentation | 신규 테스트 모듈 docstring이 "harness-checks 트리거가 `scripts/**` 글롭" 이라고 서술하지만, 실제 이번 커밋(W1)이 등록한 것은 `scripts/report_playwright_flaky.py` 개별 리터럴 경로(`migration-check.yml` 선례와 동일 방식). `scripts/` 하위 신규 스크립트 추가 시 개별 등재 없으면 여전히 트리거 안 되는데, docstring은 이미 커버된다고 오인시켜 이 커밋이 막으려던 것과 같은 유형의 트리거 갭을 재발시킬 소지 | `.claude/tests/test_report_playwright_flaky.py` 모듈 docstring vs `.github/workflows/harness-checks.yml` `on.pull_request.paths` | docstring을 "개별 경로 등재 필요(신규 스크립트마다 각각 등재)"로 정정, `scripts/**` 글롭 표현 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 3 | scope/documentation | 테스트 헬퍼 `_spec()` docstring 이 파라미터(`status`/`retries`) 설명을 잃고 한 줄로 축약됨. 커밋 메시지의 조치 목록 밖 변경 | `.claude/tests/test_report_playwright_flaky.py:75-81` | 필요 시 파라미터 설명 최소 1줄 복원(조치 불필요, 사소) |
| 4 | maintainability/testing | `CrossFilePathGuardTest` 의 cross-file 정합 검증이 정규식 텍스트 매칭이라 `e2e.yml`/`playwright.config.ts` 의 순수 서식(줄바꿈·따옴표 스타일) 변경에도 오탐 실패할 수 있음. 의도된 트레이드오프이나 문서화되지 않은 결합 | `.claude/tests/test_report_playwright_flaky.py:225-241` | 조치 불필요(현재 트레이드오프 합리적). 필요 시 대상 파일 쪽에 역참조 주석 추가 |
| 5 | side_effect/maintainability | `main()` 의 blanket `except Exception` 이 `print(f"...{exc!r}")` 로 stdout 에만 남고 GitHub UI(step summary/`::warning::`)에는 아무 신호도 남기지 않으며, traceback 없이 repr 만 출력해 향후 실제 회귀 발생 시 원인 추적이 어려움. W4 가 의도적으로 선택한 "항상 exit 0" 트레이드오프의 잔여 표면이며 크래시 자체는 `test_unexpected_schema_does_not_crash` 로 고정돼 있음 | `scripts/report_playwright_flaky.py` `main()` (라인 ~173-174, ~2306) | 필수 아님. `::warning::flaky-report 처리 중 예외(무시)` 한 줄과 `traceback.print_exc()` 추가 시 가시성/디버깅 편의 개선 |
| 6 | side_effect/testing | `continue-on-error: true` (`e2e.yml`) 추가가 이 step 의 실패 흡수 범위를 스크립트 바깥(인터프리터 부재 등)까지 넓히며, 이를 가드하는 테스트가 없어 향후 실수로 제거돼도 알려주는 회귀 테스트가 없음. 스크립트 자체는 이미 항상 exit 0 이라 정상 경로엔 영향 없음(의도된 이중 방어) | `.github/workflows/e2e.yml` `Surface flaky (retry-passed) tests` step | 조치 불필요(낮은 우선순위). 원하면 `continue-on-error: true` 존재를 확인하는 정규식 테스트 추가 가능 |
| 7 | testing | `_emit_annotations`(`::warning::` 출력 + `_gha_escape` 적용)에 대한 직접 테스트 부재 — title 에 개행/`%` 가 섞인 경우 어노테이션이 깨지는 회귀를 잡을 테스트 없음 | `scripts/report_playwright_flaky.py` `_emit_annotations` | `redirect_stdout` 으로 `::warning file=...,line=N::<escaped-title>` 포맷 단언 케이스 추가 |
| 8 | documentation | `_emit_annotations` 함수에 docstring 부재 — 같은 모듈의 형제 헬퍼(`_safe_int`/`_max_flaky_retry`/`_load_report`/`_gha_escape`)는 모두 보유 | `scripts/report_playwright_flaky.py` `_emit_annotations(flaky)` | 한 줄 docstring 추가 |
| 9 | testing | `GhaEscapeTest` 가 함수가 처리하는 `\r` 케이스를 커버하지 않음(`\n`/`%` 만 검증) | `.claude/tests/test_report_playwright_flaky.py:180-183` | `self.assertEqual(flaky._gha_escape("a\rb"), "a%0Db")` 케이스 추가 |
| 10 | testing | `test_unexpected_schema_does_not_crash` 가 `rc == 0` 만 단언, step summary 가 부분 상태로 기록되지 않았는지는 미검증 | `.claude/tests/test_report_playwright_flaky.py:216-219` | `self.assertEqual(written, "")` 한 줄 추가로 저비용 보강 |
| 11 | documentation | `RESOLUTION.md` 가 "fix" 로 표시한 INFO 10 이 실제 반영과 부분 불일치 — line==0 시 markdown 은 `:line` 생략하지만 `::warning::` 어노테이션은 그대로 출력하는 비대칭은 이번 diff 에서도 미설명 상태(신규 `main()` docstring은 별개 불변식만 설명) | `review/code/2026/07/10/11_02_46/RESOLUTION.md` vs `scripts/report_playwright_flaky.py` | `_emit_annotations`/`_location` 근처 1줄 주석 추가 또는 RESOLUTION.md 문구 정정 |
| 12 | maintainability | `# noqa: BLE001` 이 저장소에 배선되지 않은 Ruff 전용 규칙 코드를 참조(저장소는 flake8/pyflakes 코드만 사용, ruff 설정/CI 없음) — 어떤 도구도 소비하지 않는 죽은 지시자 | `scripts/report_playwright_flaky.py:173` | 일반 주석으로 대체하거나 `noqa` 태그 제거 |
| 13 | maintainability | `typing.Iterator` 와 PEP 604 `X \| None`/빌트인 제네릭 스타일이 한 파일에 혼재 | `scripts/report_playwright_flaky.py:25,42` vs `141`,`70`,`154` | `Iterator` 를 `collections.abc.Iterator` 로 옮기거나 전체를 빌트인 제네릭으로 통일 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| scope | LOW | 스코프 일탈 경미 — 테스트 assertion 삭제 1건(WARNING)·순수 포맷팅/docstring 축약 곁가지(INFO), 나머지 5개 실질 파일은 커밋 메시지 항목과 1:1 대응 |
| side_effect | LOW | 새 전역 상태·부작용 없음. `main()` 예외 흡수의 CI 가시성 트레이드오프, `continue-on-error` 범위 확장 모두 의도된 설계의 자연스러운 확장(INFO) |
| maintainability | LOW | 리포트 경로 3중 하드코딩(직전 WARNING)은 SoT 주석+cross-file 가드로 해소됨. 남은 것은 스타일 관찰(존재하지 않는 linter 참조 noqa, typing 스타일 혼용 등 INFO)뿐 |
| testing | LOW | 이전 Warning 6건은 실질 조치됐으나, 조치 과정에서 다건 렌더 커버리지 후퇴 1건(WARNING) 동반. 나머지는 저비용 보강 가능한 INFO 갭 |
| documentation | LOW | 트리거 배선/dangling 경로/docstring 부재 등 대부분 정확히 해소. 신규 테스트 docstring 이 트리거 방식을 부정확 서술(WARNING)하는 등 해소 과정에서 새 부정확성 소량 발생 |
| security | 미확인 | output 파일이 디스크에 없어 내용 확인 불가(manifest 상 success) — 재확인 필요 |
| requirement | 미확인 | output 파일이 디스크에 없어 내용 확인 불가(manifest 상 success) — 재확인 필요 |

## 발견 없는 에이전트

해당 없음 — 읽을 수 있었던 5개 에이전트(scope/side_effect/maintainability/testing/documentation) 모두 최소 INFO 이상 발견사항을 보고함.

## 권장 조치사항
1. **security·requirement reviewer 산출물 부재 확인** — manifest 는 두 reviewer 를 `success` 로 표시했으나 `security.md`/`requirement.md` 가 실제 디스크에 기록되지 않았다(known Workflow 인프라 갭: subagent success 인데 output 파일 미기록). 두 영역은 이번 통합에서 검증되지 않았으므로 재실행 또는 세션 로그 복원으로 실제 내용을 확보할 것.
2. `test_flaky_table_lists_each` 의 `self.assertIn("테스트 2", md)` 복원 — 다건 렌더 커버리지 회귀 방지(WARNING #1).
3. 신규 테스트 모듈 docstring 정정 — harness-checks 트리거가 `scripts/**` 글롭이 아니라 개별 경로 등재 방식임을 명시(WARNING #2), 향후 동일 유형의 트리거 누락 재발 방지.
4. (선택) `RESOLUTION.md` INFO 10 라벨을 실제 반영 범위에 맞게 정정하거나 `_emit_annotations`/`_location` 의 `line==0` 비대칭에 1줄 주석 추가.
5. (선택) `_emit_annotations` docstring/전용 테스트 추가, `GhaEscapeTest` `\r` 케이스 보강, `noqa: BLE001`/typing 스타일 정리 — 전부 저비용 INFO 수준.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (소스 코드 변경(`.claude/tests/test_report_playwright_flaky.py`, `codebase/frontend/playwright.config.ts`, `scripts/report_playwright_flaky.py`) 및 문서 파일 변경(`PROJECT.md` 외)에 대해 항상 적용되는 강제 규칙에 의해 전원 forced)
  - **제외**: 7명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff는 CI 스크립트/테스트/워크플로 설정 변경으로 성능 영향 관련성 낮음(세부 사유 프롬프트 미포함) |
  | architecture | 라우터 판단 — 아키텍처 구조 변경 없음(세부 사유 미포함) |
  | dependency | 라우터 판단 — 의존성 변경 없음(세부 사유 미포함) |
  | database | 라우터 판단 — DB 관련 변경 없음(세부 사유 미포함) |
  | concurrency | 라우터 판단 — 동시성 관련 변경 없음(세부 사유 미포함) |
  | api_contract | 라우터 판단 — API 계약 변경 없음(세부 사유 미포함) |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 동기화 대상 아님(세부 사유 미포함) |