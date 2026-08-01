# 테스트(Testing) 리뷰 — deps-guard-hardening (3차, 라운드 2 조치 재검증)

이 라운드는 2차 리뷰(`review/code/2026/08/01/01_56_46`)가 지적한 CRITICAL(`harness-checks.yml`
YAML 매핑 중복 키로 PyYAML 설치 소실)과 Warning 8건에 대한 조치 결과물이다. diff 만 읽지 않고
전체 하네스 스위트를 직접 실행하고, 핵심 함수를 직접 import·실행하고, 실제로 두 종류의
mutation(과거 커밋의 실제 손상 파일 재생, `main()` 조기 return 재삽입)을 적용해 "고쳐졌다는
주장"과 "테스트가 실제로 막는다는 주장" 을 재검증했다.

## 회귀 검증 메모 (2차 CRITICAL 재확인)

`.github/workflows/harness-checks.yml`을 직접 읽고, `python3 -m unittest discover -s
.claude/tests -p 'test_*.py'`를 실행해 **739건 전부 PASS**를 확인했다(로컬에 PyYAML 6.0.3
설치됨). 구조 수정 자체도 직접 검증했다 — `Install PyYAML` 스텝(81-82행)이 `Run harness unit
tests` 스텝(84-85행) **앞**의 완전히 분리된 스텝으로 복원되어 있고, `yaml.safe_load()`로
파싱해도 각 스텝이 `run`/`uses` 정확히 하나만 가짐을 확인했다. 추가로, 신설된
`test_workflow_yaml_structure.py`의 두 검출 함수(`_duplicate_keys`, `_steps`)를 **실제 손상됐던
과거 커밋(`3ff26348c`)의 `harness-checks.yml` 원문**에 대해 직접 실행해, `line 76: 'run'` 중복과
`run`/`uses` 모두 없는 스텝을 정확히 잡아냄을 확인했다(합성 fixture `BROKEN_SAMPLE`뿐 아니라
실제 사고 파일로도 non-vacuous). 2차 CRITICAL은 **유효하게 조치됨**.

## 발견사항

- **[WARNING]** plan 문서의 회귀 테스트 수치가 이번 라운드 추가분을 반영하지 못해 stale하다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:110-111`
  - 상세: "`test_override_floors.py` **18건**... 하네스 전체 스위트 731건 통과"라는 서술은
    커밋 `969f7ac0d`(2차 리뷰 대상 시점) 기준으로는 정확했다 — `git show
    969f7ac0d:.claude/tests/test_override_floors.py | grep -c "def test_"` = 18. 그러나 이번
    3차 조치 커밋(`c019a3e1b`)이 같은 파일에 `test_scope_package_in_the_middle_of_a_chain`(축1,
    중간 scope 체인 — 2차 WARNING 대응)과 `test_missing_workspace_file_is_undecidable`(축4,
    워크스페이스 파일 부재 — 2차 INFO 대응)를 추가해 실제로는 **20건**이 됐다(직접 실행 확인:
    `python3 -m unittest discover -s .claude/tests -p 'test_override_floors.py'` → `Ran 20
    tests ... OK`). 하네스 전체 스위트도 신설 `test_workflow_yaml_structure.py`(+6)까지 더해
    현재 **739건**이다(직접 실행 확인). 흥미롭게도 같은 파일의 아직 미커밋 워킹트리 편집(`git
    diff` 로 확인 — 스테이징 전)은 체크리스트 맨 아래에 "TEST WORKFLOW (3차) ... 하네스 739
    OK"를 정확한 수치로 새로 추가해 두었는데, 정작 그보다 위쪽인 110-111행의 "18건/731건"은
    갱신되지 않고 남아 있다. 같은 커밋(`c019a3e1b`)의 커밋 메시지 자체가 "축 개수 서술·중간
    scope 체인"을 조치 항목으로 명시하면서도, 그 조치가 만든 개수 변화가 정작 위쪽 통계
    서술에는 전파되지 않은 것이다 — 이 저장소가 반복적으로 겪어온 "나중에 늘어난 항목이 서두
    요약 숫자에 반영 안 됨" 클래스(같은 PR 안 "세 축"→"네 축" 오기와 동일 성격, 그 오기는
    이번 라운드에 정정됨)의 재발이다.
  - 제안: 110-111행을 "test_override_floors.py 20건 ... 하네스 전체 스위트 739건 통과"로 정정.

- **[WARNING]** 2차 리뷰가 실제로 실패를 재현했던 정확한 조합(체인 중간 scope + leaf 의
  scope+range)이 회귀 테스트로 그대로 pin되지 않았다 — 수정 자체는 올바르게 확인됨.
  - 위치: `scripts/check-override-floors.py:95-111`(`chain_segments`/`override_target`) 대비
    `.claude/tests/test_override_floors.py:170-181`(`test_scope_package_in_the_middle_of_a_chain`)
  - 상세: 2차 리뷰(`review/code/2026/08/01/01_56_46/testing.md`)가 원래 보고한 실패 예시는
    `override_target("a>@scope/b>@scope/c@>=1.0.0")` → 기대 `"@scope/c"`, 당시 버그는
    `"@scope/b>"`를 반환했다(체인 **중간**의 scope와 **leaf**의 scope+range가 동시에 존재하는
    조합). 이번 라운드에서 `chain_segments()`/`override_target()`이 `_NAME_CHAR` 문자 단위
    스캔 방식으로 재작성됐고, 직접 import해 확인한 결과 이 정확한 입력에 대해 이제 올바르게
    `"@scope/c"`를 반환한다(`python3 -c` 로 직접 재현·확인 완료) — **수정 자체는 유효하다**.
    다만 신설된 회귀 테스트 `test_scope_package_in_the_middle_of_a_chain`(170-181행)은 "중간
    scope"(`a>@scope/b>c`)와 "레인지가 부모에 붙은 형태"(`parent@>=1.0.0>child`)를 각각
    **별도로만** pin하고, 2차 리뷰가 실제로 실패를 재현했던 그 정확한 조합 문자열은 이 테스트
    파일 어디에도 리터럴로 남아있지 않다. 이 파일의 다른 모든 축은 "실측으로 실패했던 정확한
    입력"을 그대로 pin하는 것이 확립된 관례다(`test_version_range_suffix_is_not_a_parent_path`의
    `undici@>=7.0.0`, `test_scope_package_with_range`의 `@babel/core@>=7.0.0` 등) — 이 조합만
    그 관례에서 벗어나 있다. 오늘은 통과하지만, 향후 리팩터링이 "중간 scope"만 별도 처리하는
    방향으로 회귀해 "leaf의 스코프+레인지 결합" 케이스를 다시 깨뜨려도 현재 스위트로는
    검출되지 않는다.
  - 제안: `test_scope_package_in_the_middle_of_a_chain` 안에
    `self.assertEqual(self.mod.override_target("a>@scope/b>@scope/c@>=1.0.0"), "@scope/c")`
    한 줄만 추가하면 된다.

- **[INFO]** `main()`의 widened+eroded 동시 보고 로직이 회귀 테스트로 고정되지 않음 — 2차부터
  이월된 항목이며, 이번에 직접 mutation으로 재확인했다.
  - 위치: `scripts/check-override-floors.py:219-248`(`main`, 특히 234-248행 — "둘 다 계산한
    뒤 한 번에 보고한다" 주석과 함께 조기 return을 제거한 부분).
  - 상세: 코드 주석(241-243행)은 이 설계를 "widened 조기 return을 없애 같은 실행에서 eroded도
    함께 본다"는 명시적 수정으로 설명한다. 그러나 `.claude/tests/test_override_floors.py`
    어디에도 `advisories`(eroded 유발)와 `actions[]`(widened 유발)를 **동시에** 주입하는
    테스트가 없다 — `ClassificationTest`(193-247행)와 `SuppressedPathBaselineTest`(249-278행)가
    각각 한 축만 사용한다. 직접 mutation으로 검증했다: `if widened: _report_widened(widened);
    return 1`을 234행 이후·`eroded` 계산(229행) 앞에 재삽입해도 기존 20개 테스트 전부
    GREEN을 유지한다(적용 후 재실행으로 확인, 이후 원본으로 즉시 복원 — `git diff`로 무변경
    확인). exit code 계약(실패 시 항상 1)은 이 mutation에서도 변하지 않으므로 위험도는
    낮지만, "두 실패를 한 번에 보고한다"는 이 라운드가 스스로 명시한 수정 자체는 회귀
    테스트로 무방비 상태다. 2차 리뷰(dependency.md, testing.md)가 이미 INFO로 지적했고 이번
    라운드에도 미조치로 남아 있다.
  - 제안: managed 패키지 A에는 `advisories`(eroded 유발), managed 패키지 B에는 baseline 밖
    `actions[]` 경로(widened 유발)를 동시에 주입해 stderr에 두 블록이 모두 나타나는지 확인하는
    테스트 1건 추가. 우선순위 낮음 — 정확성이 아니라 리포트 완결성 문제.

- **[INFO]** `classify_vulnerable()`의 신규 `str(...)` 캐스팅 방어 코드가 테스트되지 않는다.
  - 위치: `scripts/check-override-floors.py:192`
  - 상세: 2차 리뷰(requirement.md INFO)가 "`github_advisory_id` 없이 `id`(정수)만 있으면
    `reported` 값이 `int`가 돼 `sorted(eroded)` 시 `TypeError` 가능"이라 지적했고, 이번
    라운드에서 `str(adv.get("github_advisory_id") or adv.get("id") or name)`로 명시 캐스팅해
    반영됐다(인접 주석도 이유를 남김 — 긍정적인 조치). 그러나
    `.claude/tests/test_override_floors.py`의 모든 advisory fixture(`ClassificationTest`
    193-247행, `MultipleMatchTest` 334-353행)는 예외 없이 `github_advisory_id`를 포함하므로,
    정작 새로 추가된 이 방어 분기(폴백 캐스팅)를 실행하는 테스트가 없다.
  - 제안: `github_advisory_id` 없이 `id`(int)만 있는 advisory로 `ClassificationTest`류 케이스
    1건 추가해 캐스팅 경로를 실제로 실행시킬 것. 우선순위 낮음.

- **[INFO]** (긍정 관측) 신설 테스트의 설계 품질이 높다 — mock 남용 없음, 완전한 격리, 의도
  서술이 명확함.
  - 위치: `.claude/tests/test_override_floors.py`(`run_with_stub_audit`, 48-107행),
    `.claude/tests/test_workflow_yaml_structure.py`(`_duplicate_keys`, 53-75행).
  - 상세: `run_with_stub_audit`는 `unittest.mock`으로 내부를 패치하는 대신 PATH 앞에 가짜
    `pnpm` 실행파일을 얹어 **실제 스크립트를 서브프로세스로 통째로** 돌리는 블랙박스 방식이라
    구현 리팩터링에 강하다. 모든 서브프로세스 테스트가 `tempfile.TemporaryDirectory()`로
    완전히 격리되고, 스크립트 사본의 `REPO_ROOT`가 `__file__` 기준으로 재계산되므로 실제
    저장소의 `pnpm-workspace.yaml`을 우연히 읽어버릴 위험이 없음을 직접 확인했다(
    `test_missing_workspace_file_is_undecidable`가 정확히 이 경계를 노린다). 2차
    Maintainability WARNING이었던 "`_run_with_stub_audit`가 `ClassificationTest`의
    private-스러운 인스턴스 메서드로 갇혀 다른 3개 클래스가 unbound-method로 빌려 쓴다"는
    이번 라운드에서 모듈 레벨 함수 `run_with_stub_audit`로 승격되어 해소됐다(48행). 각
    테스트 docstring이 실측 실패 사례·원인·판단 기준을 구체적으로 서술해 가독성이 높다.
    `test_workflow_yaml_structure.py`의 `_duplicate_keys` 역시 `yaml.SafeLoader`의 서브클래스를
    **함수 호출마다 새로 정의**해 `add_constructor`를 등록하므로, 전역 `yaml.SafeLoader`
    상태를 오염시키지 않아 테스트 간 격리가 안전하다. 조치 불요 — 다음 축을 위한 참고 패턴으로
    유지 권장.

## 요약

3차 라운드는 2차 CRITICAL(`harness-checks.yml`의 YAML 매핑 중복 키로 PyYAML 설치가 소실되던
결함)을 실제로 올바르게 조치했다 — 구조 재배치를 직접 파싱해 확인했고, 신설
`test_workflow_yaml_structure.py`의 두 검출기를 실제로 손상됐던 과거 커밋 원문에 대해 실행해
non-vacuous함을 검증했으며, 하네스 전체 739건이 로컬에서 PASS함을 확인했다. `override_target()`의
"체인 중간 scope" 버그(2차 WARNING)도 문자 단위 스캔 방식 재작성으로 올바르게 해소됐음을 직접
import해 확인했다 — 다만 2차 리뷰가 실제로 실패를 재현했던 정확한 조합 입력이 신규 테스트에
리터럴로 pin되지 않아, 이 저장소의 다른 모든 축이 따르는 "실측 실패를 그대로 재현" 관례에서
이 한 곳만 벗어나 있다(WARNING). 두 번째 발견은 plan 문서의 테스트 수치(`test_override_floors.py`
18건, 하네스 731건)가 이번 라운드가 추가한 테스트 2건·전체 스위트 8건 증가분을 반영하지 못해
stale하다는 점이다(WARNING) — commit별 실제 테스트 개수를 `git show`로 직접 대조해 확인했고,
같은 파일 안에 정확한 수치("739 OK")를 담은 아직 커밋되지 않은 편집이 이미 존재한다는 점에서
정정이 쉽고 이미 진행 중임을 확인했다. 그 외에는 이 라운드가 스스로 "둘 다 계산해 한 번에
보고한다"고 명시한 `main()`의 widened+eroded 동시 보고 로직에 회귀 테스트가 없다는 점(2차부터
이월, 이번에 실제 mutation으로 재확인)과, 신규 방어 코드(`str()` 캐스팅)가 테스트되지 않는다는
점을 INFO로 남긴다 — 둘 다 exit code 계약에는 영향이 없는 낮은 위험도다. 테스트 설계 자체는
mock을 남용하지 않는 블랙박스 서브프로세스 방식, 완전한 tempdir 격리, 실측 실패를 그대로
서술하는 docstring 등 전반적으로 견고하다.

## 위험도

LOW
