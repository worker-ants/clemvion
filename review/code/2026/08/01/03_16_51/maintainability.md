# 유지보수성(Maintainability) 리뷰 — deps-guard-hardening (4차 라운드)

이번 라운드는 1~3차 리뷰(`review/code/2026/08/01/{01_12_24,01_56_46,02_38_45}`)가 지적한
유지보수성 관련 항목의 최종 조치 결과(커밋 `99f6110c0`)를 코드 직접 열람·실행으로
재검증하고, 그 조치 커밋 자체가 새로 만든 것이 있는지 별도로 훑었다.

## 발견사항

- **[INFO]** (긍정 관측, 재검증 완료) 2차 라운드 CRITICAL(`harness-checks.yml` 의 YAML 중복
  키로 PyYAML 설치 스텝이 소실되던 구조적 결함)과 2차 WARNING("세 축"/"Three axes" 자기모순
  서술)이 모두 해소된 상태임을 직접 확인했다.
  - 위치: `.github/workflows/harness-checks.yml`(`unittest` 잡, `Install PyYAML`/`Run harness
    unit tests` 두 스텝) / `.claude/tests/test_override_floors.py:7`(모듈 docstring).
  - 상세: `yaml.safe_load()` 로 파일을 직접 파싱해 `unittest` 잡의 스텝 6개가 각각
    `run`/`uses` 정확히 1개씩만 가짐을 재확인했다(`Install PyYAML` 이 `Run harness unit
    tests` 와 완전히 분리된 별도 스텝). 모듈 docstring 은 "네 축이다" 로 정정돼 있고 실제
    클래스 구성(`OverrideTargetExtractionTest`·`ClassificationTest`·
    `SuppressedPathBaselineTest`·`FailClosedTest` + 보조 `CombinedReportTest`/
    `SchemaDriftTest`/`MultipleMatchTest`)과 어긋나지 않는다. `python3 -m unittest
    discover -s .claude/tests -p 'test_*.py'` 를 이 worktree 에서 직접 실행해 **744건
    전부 PASS** 를 재확인했다(plan 문서의 "744건" 주장과 일치).

- **[INFO]** (긍정 관측, 재검증 완료) 3차 라운드 WARNING(테스트 헬퍼가 가짜 `pnpm` 실행파일
  소스를 f-string 으로 동적 조립하던 문제)과 INFO(`OVERRIDES` 픽스처가 두 클래스에 리터럴
  중복되던 문제)가 모두 해소됐다.
  - 위치: `.claude/tests/test_override_floors.py:47`(`MANAGED_OVERRIDES` 공유 상수),
    `:54-60`(`_PNPM_STUB` — 고정 문자열), `:71-113`(`run_with_stub_audit` — payload 를
    별도 파일에 쓰고 `STUB_AUDIT_PAYLOAD` 환경변수로 경로만 전달).
  - 상세: 스텁 `pnpm` 소스가 이제 이 스위트의 다른 스텁(`test_mermaid_lint_ready.py` 의
    `_NODE_STUB`)과 같은 관례 — 고정 소스 + 환경변수로 데이터 전달 — 로 통일됐다.
    `ClassificationTest.OVERRIDES`(`:206`)와 `MultipleMatchTest.OVERRIDES`(`:425`) 모두
    `MANAGED_OVERRIDES` 를 참조해, 한쪽만 고쳐 다른 쪽이 조용히 낡는 경로가 사라졌다.

- **[INFO]** `.claude/tests/test_override_floors.py` 에 클래스 내부 메서드 사이 빈 줄이
  2개(더블 블랭크) 남아, 파일 자신의 나머지 부분(클래스 경계=2줄, 메서드 간=1줄)과
  어긋나는 유일한 지점이다 — 이번 라운드가 반영한 조치 커밋(`99f6110c0`)이 편집 중 남긴
  자국으로 보인다.
  - 위치: `.claude/tests/test_override_floors.py:257-258`(빈 줄 2개) —
    `ClassificationTest.test_parent_scoped_override_is_matched_by_child_name`(끝은 `:256`)
    과 `test_advisory_without_github_id_falls_back_to_numeric_id`(시작은 `:259`) 사이.
  - 상세: 두 메서드 다 같은 클래스(`ClassificationTest`) 소속인데 그 사이에만 빈 줄이
    2개다. `git show 99f6110c0 -- .claude/tests/test_override_floors.py` 로 대조한 결과,
    이 자리는 원래(조치 전) `ClassificationTest` 의 마지막 메서드 바로 다음이 곧장 다음
    클래스였던 클래스-경계 지점이었다. 이번 커밋이 그 경계 **앞에** 새 메서드
    (`test_advisory_without_github_id_falls_back_to_numeric_id`)와 새 클래스 2개
    (`CombinedReportTest`, `SchemaDriftTest`)를 끼워 넣으면서, 원래 클래스 경계용이던 2줄
    간격이 메서드-메서드 경계로 그대로 남았다(diff 상 그 2줄은 `+`가 아니라 변경 없는
    문맥 줄이다). 파일 전체와 이번 diff 의 다른 두 신규/수정 Python 파일
    (`scripts/check-override-floors.py`, `.claude/tests/test_workflow_yaml_structure.py`)을
    빈 줄 2개 이상 구간 전수 스캔했을 때 이 지점이 유일한 클래스-내부 발생이었다(나머지는
    전부 올바른 top-level `def`/`class` 경계). 이 저장소는 `.claude/tests/` 에 대해
    black/ruff/flake8 같은 Python 포매터·린터 설정이나 CI 스텝이 없어(`.flake8`,
    `ruff.toml`, `pyproject.toml`, `.pre-commit-config.yaml` 부재 확인, 워크플로에도
    관련 스텝 없음) 이런 간격 drift 가 자동으로 잡히지 않는다.
  - 제안: 빈 줄 1개를 제거해 클래스 내부 메서드 간격을 파일 나머지(단일 빈 줄)와 통일.
    기능에는 영향이 없는 순수 스타일 정정이다.

- **[INFO]** (참고, 조치 불요) 3차 리뷰가 "우선순위 낮음"으로 명시적으로 미룬 항목들
  (`eroded`/`widened` 의 필드-이름 없는 tuple, `_report_widened`/`_report_eroded` 의 반복
  되는 "사유+진단+종료" 출력 구조, `advisories` 이중 순회, `_stage_script()` 도입 후에도
  `FailClosedTest.test_missing_workspace_file_is_undecidable` 이 워크스페이스 파일을
  일부러 생략하기 위해 그 헬퍼를 쓰지 않고 셋업을 손으로 반복하는 것)은 이번 라운드
  기준으로도 그대로 남아 있음을 확인했다. 전부 `plan/in-progress/deps-guard-hardening.md`
  의 "3차 리뷰에서 미조치로 남긴 것" 절에 근거와 함께 이미 기록돼 있어(예:
  "`_stage_script()` 로 스크립트 배치는 공유했다. 남은 중복은 워크스페이스 파일을 일부러
  두지 않는 쪽이라 헬퍼에 skip 옵션을 다는 건 그 테스트의 의도를 흐린다"), 새로 지적할
  필요가 없는 기지(旣知) 항목으로 판단해 이번 라운드에서는 재기재하지 않는다.

## 요약

1~3차 리뷰가 지적한 유지보수성 관련 CRITICAL 1건(`harness-checks.yml` YAML 중복 키)과
WARNING 다수(축 개수 자기모순, 테스트 스텁 동적 조립, `OVERRIDES` 리터럴 중복 등)는 모두
실제 코드를 직접 읽고 `yaml.safe_load`/전체 하네스 스위트(744건)를 실행해 재검증한 결과
해소된 상태다. `scripts/check-override-floors.py` 는 함수가 짧고 단일 책임(`chain_segments`
/`override_target`/`load_override_targets`/`run_audit`/`classify_vulnerable`/
`_report_widened`/`_report_eroded`)을 유지하며, `_undecidable(reason, detail) -> NoReturn`
헬퍼가 fail-closed 5개 호출부를 통합해 "사유마다 손으로 `sys.exit(2)` 를 적다 하나 빠뜨리는"
클래스의 재발 여지를 구조적으로 줄였다. 매직 넘버는 `_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/
`_KEY_PREVIEW` 등 이름 있는 상수로 옮겨져 있고, 신규 `test_workflow_yaml_structure.py` 도
헬퍼-검출기-`DetectorTest` 3단 구조로 읽기 좋다. 이번 라운드에서 새로 발견한 것은 조치
커밋(`99f6110c0`)이 남긴 순수 스타일 자국 1건 — `test_override_floors.py` 의 클래스 내부
메서드 사이에 빈 줄이 2개(파일 나머지는 1개) 남은 것 — 뿐이며, 기능·가독성에 실질적 영향은
없다. 그 외 3차 리뷰가 "우선순위 낮음"으로 명시적으로 미룬 항목들은 plan 문서에 근거와 함께
이미 추적되고 있어 재지적하지 않았다. 병합을 막을 사안은 없다.

## 위험도

LOW
