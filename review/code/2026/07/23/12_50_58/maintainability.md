# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 두 dynamic import 의 try/catch 블록이 거의 동일한 코드 반복
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs:91-100`(jsdom) 및 `:118-127`(mermaid)
  - 상세: 두 블록은 구조(`let X; try { ({...} = await import("...")); } catch (e) { console.error(...); process.exit(EXIT_TOOLING_BROKEN); }`)가 동일하고 의존성 이름·구조분해 형태(`{ JSDOM }` vs `{ default: mermaid }`)만 다르다. 전형적인 "2회 반복" DRY 후보. 다만 RESOLUTION.md 가 기록한 대로 각 catch 가 서로 다른 문자열(`could not import jsdom` / `could not import mermaid`)을 내는 것이 `test_lint_mermaid_exit_codes.py`(`test_second_import_failure_also_exits_3`)가 "어느 catch 가 발화했는지"를 구분하는 근거이므로, 헬퍼로 추출해도 스펙 문자열(`specifier`)만 넘기면 테스트 가능성은 유지된다(예: `async function importOrFailOpen(specifier, pick)` 헬퍼 + `process.exit` 호출부만 공유). 2회 반복이라 "rule of three" 관점에서는 지금 상태도 허용 범위지만, 3번째 유사 import(향후 추가 의존성)가 생기면 반드시 추출 대상이다.
  - 제안: 지금 당장 강제할 사안은 아님. 향후 세 번째 유사 블록이 생기면 공용 헬퍼로 추출.

- **[INFO]** exit code `3`(tooling-broken) 이 mjs/python/bash 세 언어에 각각 독립 리터럴로 하드코딩됨
  - 위치: `.claude/tools/mermaid-lint/lint-mermaid.mjs:30` (`EXIT_TOOLING_BROKEN = 3`), `.claude/hooks/lint_mermaid_posttooluse.py:38` (`_EXIT_TOOLING_BROKEN = 3`), `.githooks/pre-commit` (`mermaid_rc -eq 3`)
  - 상세: 개념적으로 하나의 "계약 상수"가 언어 경계 때문에 세 곳에 물리적으로 중복된다. 매직 넘버 자체는 세 위치 모두 상세 주석으로 의미를 설명하고 있어 "의미불명" 문제는 없고, 이번 diff 가 `test_mermaid_lint_ready.py::ConsumerBindingTest.test_tooling_broken_exit_code_agrees_across_consumers` 로 3자 일치를 정규식 pinning 테스트해 drift 를 loud fail 로 전환했다(리포지토리의 `MARKER_NAME` 계열과 동일한 기존 컨벤션 재사용). 언어 경계상 진짜 단일 소스는 불가능하므로 이 정도가 실용적 상한이다.
  - 제안: 조치 불요. 이미 동급 문제(MARKER_NAME)의 기존 패턴을 그대로 재사용한 일관된 해법.

- **[INFO]** 안내 메시지 문구가 3개 소비처마다 표현이 다름
  - 위치: `lint-mermaid.mjs:96-97`("tooling unavailable — could not import X ... Skipping the mermaid check. Reinstall with: ..."), `lint_mermaid_posttooluse.py:220-223`("skipped (linter tooling failed to load — likely a corrupt node_modules). Run: ..."), `.githooks/pre-commit` 신규 분기("skipped (tooling failed to load)." + 별도 "Reinstall with:" 줄)
  - 상세: 세 메시지가 같은 상황(의존성 import 실패)을 설명하지만 표현이 통일돼 있지 않다(예: "Run:" vs "Reinstall with:"). 기능에는 영향 없고, 각 파일이 이미 갖고 있던 "deps not installed" 자매 메시지와 각각 톤을 맞춘 결과라 완전한 새 불일치는 아니다.
  - 제안: 필수는 아니나, 세 메시지의 안내 문구("Run/Reinstall with: (cd .claude/tools/mermaid-lint && npm install)") 부분만이라도 정확히 동일한 문자열로 맞추면 grep 가능성이 좋아진다.

- **[INFO]** 신규 테스트 메서드 내부의 `import re` 가 모듈 상단이 아닌 함수 로컬
  - 위치: `.claude/tests/test_mermaid_lint_ready.py:137` (`test_tooling_broken_exit_code_agrees_across_consumers` 내부)
  - 상세: 같은 파일의 다른 임포트(`json`, `os`, `shutil`, `subprocess`, `sys`, `tempfile`, `unittest`)는 모두 모듈 상단에 있는데 `re` 만 테스트 메서드 안에서 로컬 임포트된다. 다만 저장소의 다른 테스트 파일(`test_consistency_target_validation.py`, `test_report_playwright_flaky.py`)에도 함수-로컬 임포트 선례가 있어 완전히 낯선 패턴은 아니다.
  - 제안: 파일 상단으로 옮겨 이 파일 자체의 일관성을 높이는 편이 근소하게 더 낫지만, 강제할 사안은 아님.

- **[INFO]** `_EXIT_TOOLING_BROKEN` 분기가 기존 "deps not installed" 분기와 메시지·구조가 거의 동일한 패턴 반복
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:185-195`(기존 not-ready 분기) 및 `:215-225`(신규 tooling-broken 분기)
  - 상세: 두 분기 모두 `print(..., file=sys.stderr); return 0` 형태로 구조가 동일하고 안내 문구 패턴("mermaid-lint: skipped (...). Run: (cd .claude/tools/mermaid-lint && npm install)")도 유사하다. 다만 각 print 문자열은 서로 다른 원인을 설명하므로 (설치 안 됨 vs 설치는 됐으나 손상) 문자열 자체를 병합하면 원인 구분이 사라진다. 함수로 추출해도 얻는 것은 "print+return 0" 두 줄 뿐이라 실익이 작다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 기존 파일들이 이미 확립한 스타일(가드 클로즈 기반 flat 분기, 모듈 상수 + 상세 주석, cross-language 상수는 pinning 테스트로 결속)을 그대로 따르는 좁은 범위의 수정이다. `main()`(python)·최상위 스크립트(mjs) 모두 중첩 깊이가 얕고 각 함수/분기가 단일 책임을 유지해 가독성이 좋다. 유일하게 눈에 띄는 반복은 `lint-mermaid.mjs`의 두 dynamic-import try/catch 블록(구조 동일, 의존성 이름만 다름)인데, 테스트가 두 catch 를 개별 문자열로 구분해야 하는 요구와 공존 가능한 추출 여지가 있음에도 2회 반복에 그쳐 지금 강제할 정도는 아니다. exit code `3`의 3-언어 중복 리터럴은 아키텍처상 불가피하며 이미 pinning 테스트로 drift 위험을 닫았다. 전반적으로 매직넘버·중복코드·복잡도·네이밍 컨벤션 모두 기존 코드베이스와 일관되며, Critical/Warning 급 유지보수성 결함은 없다.

## 위험도
LOW
