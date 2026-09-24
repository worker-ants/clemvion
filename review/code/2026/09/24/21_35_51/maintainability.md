# 유지보수성(Maintainability) 리뷰: docs-guard-trigger

## 검토 범위

이번 diff(11개 파일)의 실질 "코드"는 두 파일뿐이다 — 신규 테스트 `.claude/tests/test_spec_link_checks_scope.py` 와 `.github/workflows/spec-link-checks.yml`. 나머지는 `.claude/tests/README.md`(카탈로그 표 1행 추가) · `CHANGELOG.md` · `PROJECT.md` 문서 갱신, `plan/in-progress/docs-guard-trigger.md`(신규 plan), 그리고 이전 라운드(`review/code/2026/09/24/21_16_58/**`, `review/consistency/2026/09/24/{20_34_01,21_04_26}/**`)의 리뷰/컨시스턴시 산출물이다. 이 산출물들은 이미 완료된 리뷰 세션의 스냅샷(prose 리포트 + JSON 상태)이며 순환 복잡도·중첩·함수 길이 같은 코드 품질 축이 적용되지 않는다. `meta.json` 두 건(`review/consistency/2026/09/24/{20_34_01,21_04_26}/meta.json`)은 RESOLUTION.md 가 주장한 대로 `target_path` 가 저장소 상대경로로 정정되고 `scope_note` 로 원래 scratch 경로 사용 이유가 보존돼 있음을 직접 열어 확인했다 — 기록 보존 관례에 부합한다.

두 실코드 파일은 `Read` 로 전체 내용을 직접 확인했고, `test_spec_link_checks_scope.py` 가 재사용하는 `parse_pathspecs_block`(`test_harness_checks_paths_coverage.py:143`)도 대조해 서명·계약이 일치함을 확인했다. 저장소 파일에 어떤 쓰기도 하지 않았다(`git status --short` 로 확인 — 이 세션이 만든 리뷰 출력 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 워크플로 헤더 주석이 세 차례 사고 이력(도입 배경/`#912`, 2026-08-27, 2026-09-24)을 누적해 전체 119줄 중 약 33줄(≈28%)을 차지
  - 위치: `.github/workflows/spec-link-checks.yml:1-33`
  - 상세: 가독성에 즉각적 지장은 없지만, 같은 파일이 사고 일지 역할을 반복해서 겸하는 패턴이 이미 3회째다. 직전 리뷰 라운드(`review/code/2026/09/24/21_16_58/architecture.md`)가 이미 이 사안을 INFO 로 포착·기록했고 reviewer 스스로 "이번 PR 스코프를 넘는 후속 검토"로 분류했으므로, 이번 라운드에서 새로 조치가 필요한 결함으로 취급하지 않는다 — 동일 관찰의 재확인일 뿐이다.
  - 제안: 조치 불요(이미 처분됨). 다음에 같은 갭이 또 재발하면 그때 이력을 별도 문서로 옮기는 것을 고려.

- **[INFO]** `_docs_guard_run_commands()` 가 워크플로의 `run:` 문자열을 하드코딩된 부분 문자열 `"--filter frontend test"` 로 매칭
  - 위치: `.claude/tests/test_spec_link_checks_scope.py:44-52` (`_docs_guard_run_commands` 함수)
  - 상세: `pnpm --filter frontend test src/lib/docs/__tests__/` 라는 실제 커맨드 리터럴과 정확한 어순·공백이 일치해야 매칭된다. 예컨대 `pnpm --filter=frontend test ...` 처럼 pnpm 호출 방식이 바뀌면 `runs` 가 빈 리스트가 되고, 바로 다음 줄의 `assertEqual(len(runs), 1, ...)` 이 `got []` 메시지로 명확히 실패한다 — 침묵 실패가 아니라 즉시 드러나는 형태라 심각도는 낮다.
  - 제안: 조치 불요. 다만 이런 매칭이 두 번째로 필요해지면(다른 job/step에도 같은 패턴이 생기면) 상수로 추출해 중복을 막을 것.

- **[INFO]** `test_spec_link_checks_scope.py` 의 모듈 docstring 이 29줄로 김
  - 위치: `.claude/tests/test_spec_link_checks_scope.py:1-29`
  - 상세: 일반적인 Python 관례보다는 길지만, 이 저장소의 `.claude/tests/` 하위 다른 테스트 파일들(`test_workflow_yaml_structure.py`, `test_harness_checks_paths_coverage.py` 등, `.claude/tests/README.md` 표에 요약된 것처럼)도 동일하게 "왜 이 가드가 존재하는가"를 docstring 에 상세히 남기는 컨벤션을 따른다. 신규 결함이 아니라 기존 스타일과 일관됨.
  - 제안: 없음.

이 외에는 두 실코드 파일 모두 함수가 짧고(각 5~15줄), 중첩 깊이가 1~2단계를 넘지 않으며, 매직 넘버가 없고(문자열 상수는 모두 명명됨: `JOB`, `DOCS_GUARD_DIR`, `WORKFLOW`), 순환 복잡도가 낮다. 테스트 메서드명(`test_pathspecs_trigger_on_plan_and_spec`, `test_runs_the_docs_guard_directory_not_one_file`)은 검증 대상을 그대로 서술해 의도가 명확하고, 실패 메시지마다 "무엇이 왜 잘못됐는지"를 담아 향후 회귀 시 즉시 원인을 알 수 있게 했다. `parse_pathspecs_block` 을 재구현하지 않고 import 해 재사용한 것은 이 저장소가 반복 강조하는 "가드가 자신의 재구현을 검사하면 진짜 파서를 놓친다" 원칙과 일치한다.

`.claude/tests/README.md` 신규 행, `CHANGELOG.md` 신규 항목, `PROJECT.md` 갱신 문단은 모두 기존 문서들과 동일한 고밀도 산문 스타일(표의 다른 행들도 마찬가지로 한 줄에 압축된 장문)을 그대로 따르고 있어 일관성 문제는 없다.

## 요약

이번 변경의 실질 코드 표면은 좁고(신규 테스트 1개, 워크플로 YAML 1개 수정) 둘 다 짧고 단일 책임을 지키며, 기존 하네스 컨벤션(공유 파서 재사용, 좁고 이름 붙은 assertion, 뮤테이션으로 검증된 회귀 방지)을 그대로 따른다. 새로 발견된 사항은 모두 INFO 수준이며 그중 하나는 이미 직전 리뷰 라운드에서 같은 근거로 처분된 사안의 재확인이다. 나머지 파일(README/CHANGELOG/PROJECT.md 문서 갱신, plan 신설, 과거 리뷰·컨시스턴시 산출물)은 코드 품질 축이 적용되지 않는 범주이고 저장소 컨벤션에 부합한다. 차단 사유 없음.

## 위험도
NONE
