# Side Effect Review — harness bundle correctness (3R)

## 검토 방법

프롬프트에는 unified diff 없이 "전체 파일 컨텍스트"만 실려 있어, 실제로 무엇이 바뀌었는지는
`git diff origin/main...HEAD`로 6개 파일 전부 직접 대조했다. 이 세션은 같은 날 15_46_28(1R),
16_37_23(2R) 리뷰의 후속(3R)이라 그 두 리포트의 side_effect.md를 먼저 읽고, 2R이 지적한
CRITICAL/WARNING이 최신 커밋(`fdc8e423f`, "2R 리뷰 반영")에서 실제로 해소됐는지를 코드 대조 +
테스트 실행으로 재검증하는 데 집중했다.

## 발견사항

- **[INFO]** (1R부터 이월, 여전히 유효·비차단) `_BUNDLE_FILE_SENTINEL`은 구조적으로 위조 불가능한
  마커가 아니라 평범한 리터럴 문자열이다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:704` (정의).
  - 상세: 지금은 `target_doc`을 생성하는 4개 진입점(`--spec`/`--plan`의 원시 읽기, `--impl-prep`/
    `--impl-done`의 `format_file_bundle`, `--impl-done`의 `diff_section`) 전부가 `_neutralize_sentinel`을
    거치도록 이번 라운드(`fdc8e423f`)에서 보강됐고, 대응 회귀 테스트(`test_raw_spec_target_is_neutralised`,
    `test_rationale_sections_are_neutralised_too`, `test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`)도
    추가됐다 — 오늘 시점에는 안전하다. 다만 안전성이 "이 문자열은 본문에 나올 수 없다"는 구조적
    보장이 아니라 "모든 소비 경로가 빠짐없이 `_neutralize_sentinel`을 호출한다"는 **호출 규율**에
    의존한다는 점은 변하지 않았다 — 향후 5번째 진입점(예: 새 모드나 새 보조 코퍼스)이 추가되면서
    이 호출을 빠뜨리면 이번 PR이 막은 것과 동일한 버그 클래스(파일 경계 위조 → 본문 뒷부분 소실 +
    존재하지 않는 파일이 "생략됨"으로 등재)가 조용히 재발할 수 있다.
  - 제안: 새로운 이슈로 조치할 필요는 없음(이미 1R에서 INFO로 기록됨). 상수 정의 옆에 "새 진입점
    추가 시 반드시 `_neutralize_sentinel`을 통과시킬 것" 주석을 남기거나, 장기적으로 세션별
    파생 마커로 바꾸면 이 카테고리의 회귀 가능성 자체가 닫힌다.

- **[INFO]** (1R부터 이월, 여전히 유효·비차단) 새 sentinel(`<!-- @bundle-file -->`)이 checker
  프롬프트에 설명 없이 그대로 노출된다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:704`(정의),
    `format_file_bundle`(368행)·`extract_rationale_sections`(466행)의 삽입 지점.
  - 상세: `.claude/agents/*-checker.md`, `lib/role_instructions.py`(`CHECKER_INSTRUCTIONS`) 어디에도
    이 HTML 주석 마커의 의미를 설명하는 문구가 없음을 재확인(grep 0건). HTML 주석이라 대부분의 LLM이
    무해한 메타 표기로 넘기므로 실질 위험은 낮지만, 매 세션 프롬프트에 설명되지 않은 리터럴이
    추가된 상태는 그대로다.
  - 제안: 필요시 checker 공통 프리앰블에 한 줄 안내 추가(선택 사항).

- **검증 후 문제 없음 확인 (2R CRITICAL 해소 재검증)**: 2R(`16_37_23/side_effect.md`)이 지적한
  "`--spec`/`--plan`의 원시 `target_doc`이 `_neutralize_sentinel`을 거치지 않는다" CRITICAL은
  `fdc8e423f`에서 두 분기 모두 `target_doc = _neutralize_sentinel(read_text_file(target_abs))`로
  수정됨을 소스에서 직접 확인했다(`consistency_orchestrator.py:554`, `:561`). 같은 커밋이
  `--impl-done`의 `diff_section`에도 고유 sentinel 경계 + 이름(`_DIFF_LABEL`, 590행) +
  `_neutralize_sentinel(diff_text)`(597행 이하)를 부여해 4개 진입점 전부가 동일 방어를 받는다.
  이 변경 자체는 순수 텍스트 변환(치환·연결)이며 전역 상태·환경변수·네트워크·파일시스템에
  영향을 주지 않는다.

- **검증 후 문제 없음 확인 (2R WARNING 해소 재검증)**: 2R이 지적한 "신설 테스트가 서브프로세스
  안 `tempfile.mkdtemp()`를 정리하지 않아 고아 디렉터리가 쌓인다"는 `fdc8e423f`에서
  `try/finally` + `shutil.rmtree(d, ignore_errors=True)`로 수정됐다(`test_consistency_context_budget.py`
  177·187행, 207·217행, 238·255행 — 3곳 전부). 코드 대조에 그치지 않고 실제로
  `python3 -m pytest .claude/tests/test_consistency_context_budget.py`를 실행해 시스템 임시
  디렉터리(`tempfile.gettempdir()`)의 `tmp*` 항목 개수를 실행 전/후로 비교했다: 21 tests /
  29 subtests 전부 통과, 개수는 실행 전후 동일(고아 디렉터리 생성 없음) — 코드 리딩이 아니라
  실측으로 확인했다.

- **부작용 없음 확인 (신규 헬퍼·리팩터 전반)**: `_charge_notice`(code_review_orchestrator.py:561),
  `_neutralize_sentinel`/`_natural_key`(consistency_orchestrator.py:213/229)는 모두 인자만으로
  결과가 결정되는 순수 함수이고 각자 소속 모듈·대응 테스트 외 소비자가 없음을 grep으로 재확인
  (review/** 산출물 문서 언급 제외, 코드베이스 내 외부 호출부 0건) — 시그니처·공개 인터페이스
  파급 없음. `collect_markdown_files`의 정렬 키 변경(사전순 `.sort()` → `.sort(key=_natural_key)`,
  266행)은 함수가 반환하는 로컬 리스트를 in-place 정렬하는 기존 패턴 그대로이며 전역 변수에는
  손대지 않는다. diff 전체에서 `os.environ`/`subprocess`/`requests`/`socket` 관련 신규 호출은
  0건(grep 확인) — 환경변수·네트워크 관련 신규 부작용 없음. `build_files_section`에 추가된
  `source_lines`/`total_lines` 키는 함수 내부 로컬 `file_parts` 리스트에만 존재하고 함수는 최종
  문자열만 반환하므로(직접 소스 대조 완료), `_retry_state.json`/`meta.json` 등 디스크 상태로
  유출되지 않는다.

## 요약

이번 3R 세션에서 새로 발견된 CRITICAL/WARNING은 없다. 2R이 지적했던 CRITICAL(`--spec`/`--plan`
원시 `target_doc` 미중화로 인한 파일 경계 위조·본문 소실)과 WARNING(신설 테스트의 임시 디렉터리
미정리)은 최신 커밋(`fdc8e423f`)에서 모두 수정됐고, 이번 라운드에서 소스 대조 + 실제 테스트 실행
(임시 디렉터리 개수 실측)으로 재검증했다. 시그니처 변경·전역 상태·파일시스템 부작용·환경변수·
네트워크 호출·이벤트/콜백 어느 축에서도 신규 문제는 없으며, 신규 헬퍼(`_charge_notice`,
`_neutralize_sentinel`, `_natural_key`)는 전부 순수 함수이고 외부 소비자가 없어 인터페이스
파급도 없다. 1R부터 이월된 INFO 2건(sentinel이 호출 규율에 의존하는 구조적 취약성 여지,
sentinel이 checker에게 설명 없이 노출됨)은 오늘 시점 활성 결함이 아니라 비차단 관찰로 유지한다.

## 위험도
LOW
