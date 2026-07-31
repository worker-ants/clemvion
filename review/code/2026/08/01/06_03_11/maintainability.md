# 유지보수성(Maintainability) 리뷰

## 리뷰 대상

- `scripts/check-override-floors.py` (신규 파일, 386줄) — 실제 프로덕션 코드. 아래 발견사항은 전부 이 파일 대상.
- `review/code/2026/08/01/05_36_28/testing.md` (신규 파일, 이전 라운드 리뷰 산출물) — 산문 리포트로, 함수/네이밍/중첩/복잡도 같은 코드 구조 관점이 적용되지 않는다. 헤더·불릿·코드블록 인용이 잘 구조화돼 있고 중복·과도한 장문 문단 없이 읽기 쉬워 별도 발견사항 없음.

## 발견사항

- **[WARNING]** `main()` 이 오케스트레이션과 두 개의 비트리비얼 도메인 로직(수용 경로 확장 diff, override-대상 상관분석)을 겸하고 있다 — 같은 파일 안의 비슷한 급 로직은 전부 이름 있는 함수로 추출됐는데 이 둘만 인라인이다.
  - 위치: `scripts/check-override-floors.py:297-342`(`main()`), 특히 `:313-321`("widened" 경로 diff 계산), `:323-326`("eroded" 상관 계산)
  - 상세: 같은 파일에서 `chain_segments`(:102-111), `override_target`(:114-129), `load_override_targets`(:132-165), `run_audit`(:181-231), `classify_vulnerable`(:234-294)는 전부 독립 함수 + docstring으로 분리돼 있고, 그중 `override_target`/`load_override_targets`/`run_audit`는 테스트가 `mod.<함수명>()` 직접 호출로 빠르게 단위 검증한다(`.claude/tests/test_override_floors.py:182-263`의 `OverrideTargetExtractionTest`, `:604-635`의 `AuditTimeoutTest`, `run_audit` 는 `mock.patch.object(mod.subprocess, "run", ...)`로 인-프로세스 모킹). 반면 widened(경로 집합 diff)·eroded(override 대상 상관) 계산은 비슷하거나 더 복잡한 도메인 규칙이면서도 이름·docstring 없이 `main()`에 인라인돼 있다. 실제로 이 두 로직을 겨냥한 테스트(`WidenedFilterTest`:440-472, `CombinedReportTest`:345-369)는 `classify_vulnerable`조차 직접 호출하지 않고(`grep -n "classify_vulnerable" .claude/tests/test_override_floors.py` 0건) 전부 stub `pnpm`을 PATH에 심어 스크립트 전체를 서브프로세스로 실행하는 `run_with_stub_audit()` 경로로만 도달한다 — 다른 로직 대비 훨씬 무거운 테스트 설정이 필요하다. `main()` 자체도 존재 확인 → `load_override_targets` → `run_audit` → `classify_vulnerable` → dict 컴프리헨션 → 루프 2개(각 조건 포함) → 최종 분기 3개(OK/widened/eroded)가 한 함수에 모여 있어 조건 분기가 10개 안팎으로 늘어난다.
  - 제안: `_diff_widened_paths(suppressed, targets) -> list[tuple[str, set[str]]]` 와 `_correlate_eroded(reported, targets, patched_by_module) -> list[tuple[str, str, str, list[str]]]` 로 추출하면 `main()`은 순수 오케스트레이션+출력만 남고, 두 계산은 `override_target`/`run_audit`처럼 인자만 넣어 직접 단위 테스트할 수 있게 된다.

- **[INFO]** 다른 튜닝 상수(`_STDERR_PREVIEW`, `_STDOUT_PREVIEW`, `_KEY_PREVIEW`, `_AUDIT_TIMEOUT_SEC`)는 전부 이름 붙은 모듈 상수 + 근거 주석을 갖는데, `pnpm audit` 호출의 심각도 임계값만 인라인 문자열 리터럴이고 선택 근거 주석이 없다.
  - 위치: `scripts/check-override-floors.py:196`(`["pnpm", "audit", "--audit-level=moderate", "--json"]`)
  - 상세: `.github/workflows/deps-security-checks.yml:76`의 기존 `pnpm audit --audit-level=moderate`와 실제로 같은 값임을 직접 대조해 확인했다 — 값 자체는 안전하고 임의로 고른 매직 넘버는 아니다. 다만 파일의 다른 모든 튜닝 상수는 "왜 이 값인가" 주석이 붙어 있는 반면 이 값만 그 관례에서 빠져 있어, 미래 독자가 "moderate를 왜 골랐는지"(low로 낮추면 무엇을 더 잡는지, high로 올리면 무엇을 놓치는지, 기존 audit 잡과 왜 같아야 하는지)를 알려면 워크플로 파일까지 따라가야 한다.
  - 제안: `# .github/workflows/deps-security-checks.yml 의 audit 잡과 동일 임계값` 정도의 한 줄 주석을 추가하거나, `_AUDIT_LEVEL = "moderate"`로 이름 붙여 다른 `_*_PREVIEW`/`_AUDIT_TIMEOUT_SEC` 상수들과 나란히 둔다.

## 요약

`scripts/check-override-floors.py`는 전반적으로 모범적인 유지보수성을 보인다 — 모듈 docstring이 "왜 이 가드가 필요한가"부터 "옛 정규식 방식이 왜 틀렸는가"까지 설계 이력을 상세히 남기고, `_undecidable()`을 `NoReturn`으로 고정해 fail-closed 분기 누락을 타입 단계에서 막는 설계가 깔끔하다. 네이밍도 일관적이다 — 언더스코어 없는 이름(`chain_segments`, `override_target`, `load_override_targets`, `run_audit`, `classify_vulnerable`)은 테스트가 `mod.<이름>()`으로 직접 호출하는 대상, 언더스코어 접두(`_undecidable`, `_report_widened`, `_report_eroded`)는 내부 전용 출력 헬퍼로 정확히 갈려 있고, `EXPECTED_SUPPRESSED_PATHS`(언더스코어 없음, 수동 편집 대상) vs `_STDERR_PREVIEW` 등(언더스코어, 내부 튜닝값) 구분도 형제 스크립트 `scripts/check-pnpm-security-config.py`의 `EXPECTED_OVERRIDES`/`EXPECTED_ONLY_BUILT`/`EXPECTED_IGNORED_CVES` 패턴과 그대로 맞는다. 중첩 깊이는 전체적으로 2단 이내로 얕고, 매직 넘버는 대부분 이름 붙은 상수로 옮겨져 있으며, `from __future__ import annotations` + 완전한 타입힌트 사용도 이웃 스크립트(`check-migration-versions.py`, `check-e2e-playwright-config.py`)와 일치한다. 유일한 구조적 아쉬움은 `main()`이 오케스트레이션과 두 개의 이름 없는 도메인 로직(widened/eroded)을 겸해 파일 내 다른 동급 로직과 비일관적이라는 점이고(WARNING), 감사 심각도 임계값 하나만 다른 상수들의 "근거 주석 붙이기" 관례에서 벗어나 있다(INFO). 두 항목 모두 정확성이나 안전성에는 영향이 없고 구조·테스트 용이성 개선 여지에 관한 것이다. 리뷰 산출물인 `testing.md`는 산문 문서라 코드 구조 관점 발견사항이 없다.

## 위험도

LOW — Critical 없음, WARNING 1건(`main()` 책임 과다·widened/eroded 로직 미추출), INFO 1건(감사 임계값 근거 주석 부재). 둘 다 정확성·안전성이 아니라 구조적 개선 여지에 관한 것이며 기존 코드베이스 스타일과의 정합성은 전반적으로 높다.
