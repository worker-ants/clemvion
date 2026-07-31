# 테스트(Testing) 리뷰 — deps-guard-hardening (4차, 최종 검증 라운드)

## 사전 검증 메모

이 diff 는 1~3차 리뷰(`01_12_24`·`01_56_46`·`02_38_45`)가 지적한 사항에 대한 누적 조치 결과다.
diff 판독에 그치지 않고 직접 실행·재현해 검증했다.

- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 를 이 worktree 에서 직접
  재실행 — **744건 전부 PASS**(`plan/in-progress/deps-guard-hardening.md:112` 의 "하네스 전체
  744건 통과" 서술과 일치). `test_override_floors.py` 단독 25건, `test_workflow_yaml_structure.py`
  6건, `test_dependabot_npm_coverage.py` 14건, `test_harness_checks_paths_coverage.py` 26건,
  `test_tests_readme_catalog.py` 5건 — 개별 재실행으로도 전부 PASS 확인.
- 커밋 `99f6110c0` 메시지가 주장하는 "뮤턴트 4종(조기 return 부활 · 스키마 드리프트 2종 · id
  폴백 제거) 전부 RED" 를 각각 직접 적용(cp 백업 후 mutate → 재실행 → cp 복원 → `git diff` 로
  원상복구 확인)해 재현했다 — **4종 전부 정확히 1건씩 FAIL** 로 확인됨(과대·과소 주장 없음 —
  이 저장소가 과거 반복 지적했던 "mutation 수치 오기" 부류가 이번엔 아니다).
- 3차 testing 라운드(`review/code/2026/08/01/02_38_45/testing.md`)가 지적한 WARNING 2건("체인
  중간 scope + 리프 scope+range 조합이 리터럴로 pin 되지 않음", "plan 회귀 테스트 수치 stale")과
  INFO 2건(widened+eroded 동시 보고 미검증, id 폴백 미검증)은 이번 커밋에서 전부 해소됨을 소스
  대조로 확인했다 — `test_scope_package_in_the_middle_of_a_chain` 에 정확한 조합 리터럴
  추가(`.claude/tests/test_override_floors.py:188-191`), plan 수치 정정(`plan/in-progress/deps-guard-hardening.md:110-112`),
  `CombinedReportTest` 신설(`:278-302`), `test_advisory_without_github_id_falls_back_to_numeric_id`
  신설(`:259-275`). 재이월 없음.

## 발견사항

- **[WARNING]** 이번 라운드가 새로 추가한 "스키마 드리프트 fail-closed" 방어가 `actions[]` **만**
  드리프트하고 `advisories` 는 (다른 패키지에 대해) 정상 파싱되는 조합에서는 발동하지 않고
  조용히 통과한다 — 직접 재현으로 확인한 실동작 결함이며, 정확히 이 방어 코드 자신이 막으려는
  "조용한 통과" 클래스를 그 방어 코드 자신이 재현한다.
  - 위치: `scripts/check-override-floors.py:222`(`classify_vulnerable()` 안
    `if actions and not suppressed and not reported:`) — 문제는 이 조건의 `and not reported`
    절. 대응 테스트 갭은 `.claude/tests/test_override_floors.py:305-334`(`SchemaDriftTest`),
    특히 `:323-329`(`test_actions_without_module_is_undecidable`).
  - 상세: `run_audit()`(`scripts/check-override-floors.py:138-170`)은 최상위 `actions` 키
    존재만 확인하고 반환하므로, `classify_vulnerable()` 이 그 아래 필드명 드리프트를 직접
    막아야 한다. 실제 코드는 두 개의 독립된 방어를 둔다 — (1) `if advisories and not reported`
    (216행, `advisories` 축), (2) `if actions and not suppressed and not reported`(222행,
    `actions` 축). (1)은 `actions`/`suppressed` 상태와 무관하게 항상 정확히 동작한다. 그러나
    (2)는 `and not reported` 절 때문에 **`reported` 가 이미 비어있지 않으면 절대 발동하지
    않는다** — `reported` 는 오직 `advisories` 에서만 채워지므로, "`advisories` 는 어떤
    패키지에 대해서든 정상 파싱되고 `actions[]` 만 스키마가 바뀐" 조합에서 `not reported` 가
    거짓이 되어 드리프트 신호가 완전히 가려진다. 이 worktree 에서 `test_override_floors.py`
    의 `run_with_stub_audit()` 헬퍼를 직접 import 해 재현했다:
    ```python
    r = run_with_stub_audit(
        advisories={"1": {"module_name": "some-unmanaged-pkg",
                           "github_advisory_id": "GHSA-x",
                           "patched_versions": ">=9.9.9"}},
        overrides="overrides:\n  liquidjs: ^10.27.1\n",
        actions=[{"action": "review", "pkg": "brace-expansion"}],  # module → pkg (드리프트)
    )
    # 실측: r.returncode == 0
    # 실측 stdout: "OK: override 대상 1개 패키지 중 취약 재유입 0건 (...)"
    ```
    `advisories` 의 `some-unmanaged-pkg` 는 override 대상이 아니라 `reported` 만 채우고
    `eroded`/`widened` 어느 쪽에도 안 잡히지만, 그 존재만으로 222행의 `not reported` 가
    거짓이 되어 `actions[]` 의 `pkg`(→`module` 개명) 드리프트가 무시된다. 결과적으로
    `ignoreCves` 로 이미 수용된 CVE 가 새 경로로 재유입돼도(`widened` 가 감지해야 할
    시나리오, `SuppressedPathBaselineTest` 가 정상 스키마에서 검증하는 바로 그 경로) 이
    조합에서는 `suppressed` 가 항상 빈 dict 가 되어 `widened` 검출 축 전체가 조용히
    무력화된다 — audit 응답에 무관한 advisory 가 하나라도 섞여 있기만 하면(현실적으로 흔한
    상황: unmanaged 패키지의 CVE 는 이 가드의 정상 동작 범위에서 항상 등장할 수 있다) 발동
    조건 자체가 사라진다. `SchemaDriftTest` 의 두 테스트는 모두 `advisories={}` 로
    고정(`:317`, `:325`)하고 있어 `reported` 가 애초에 비어 있는 케이스만 pin 하며, "다른
    패키지의 advisories 는 살아있고 actions 만 드리프트" 조합은 이 파일 어디에도 없다.
  - 제안: 222행의 판정을 `reported`(무관한 다른 축의 상태)에 기대지 말고, `actions[]` 원소
    자체에 `module` 키가 있는지 여부로 직접 판단하도록 좁힐 것. 예:
    `actions_with_module = [a for a in actions if "module" in a]` 를 두고
    `if actions and not actions_with_module: _undecidable(...)` 로 바꾸면, "모든 action 이
    이미 `reported` 로 처리돼 정당하게 `suppressed` 에서 빠진" 정상 케이스와 "`module` 키
    자체가 없어진" 드리프트 케이스를 `reported` 상태에 의존하지 않고 구분할 수 있다.
    `SchemaDriftTest` 에 위 재현 스니펫을 그대로 회귀 테스트로 추가할 것(advisories 는 override
    미대상 패키지로 채우고 actions 만 드리프트시켜 exit 2 를 기대).

- **[INFO]** `test_dependabot_npm_coverage.py` 의 워크스페이스-루트 예외 파싱
  (`directory: "/"` → `""`)이 이 파일의 다른 파서 경계 케이스처럼 합성 텍스트로 고립
  pin 되지 않고, 실제 `.github/dependabot.yml` 을 읽는 라이브 테스트로만 검증된다.
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py:43`(`_WORKSPACE_ROOT_DIRECTORY = ""`)
    대비 `:209-250`(`ParserEdgeCaseTest` — 다른 형태는 전부 합성 `text` 로 pin),
    `:309-321`(`test_workspace_root_stays_registered`, 실파일 대상).
  - 상세: 같은 파일의 `_parse_dependabot_npm_directories()` 는 `directory:` 값을
    `.strip().strip("/")` 로 정규화하므로 `"/"` 는 빈 문자열이 된다(`:109`). 이 정규화
    자체가 옳다는 것을 확인하는 유닛은 실제 리포 파일에 의존하는
    `test_workspace_root_stays_registered`/`test_root_exception_does_not_admit_workspace_members`
    뿐이며, `ParserEdgeCaseTest` 처럼 `directory: "/"` 를 합성 텍스트로 직접 넣어
    `_parse_dependabot_npm_directories()` 가 `{""}` 를 내는지 고립 검증하는 케이스는 없다.
    같은 클래스의 다른 세 테스트(따옴표/주석·비-npm ecosystem 무시)는 전부 이 패턴을
    따르므로 형태상 비대칭이다. 실제 리포 파일이 이 값을 가지고 있는 한 회귀는 안 잡히지만,
    실질적 위험은 낮다(다른 두 라이브 테스트가 이미 종단 간으로 이 경로를 매 실행마다
    태운다).
  - 제안: 우선순위 낮음. 여유가 있으면 `ParserEdgeCaseTest` 에
    `_parse_dependabot_npm_directories()` 를 `directory: "/"` 합성 텍스트로 직접 호출해
    `{""}` 를 기대하는 케이스 1건을 추가해 다른 엣지케이스들과 관례를 맞출 것.

- **[INFO]** (긍정 관측) mutation 주장 4건을 전부 직접 재현·원복해 정확함을 확인했다 — 과대·
  과소 계상 없이 "전부 RED" 주장과 실측이 정확히 일치한다(이 저장소가 반복 지적해 온 "mutation
  수치 오기" 클래스가 이번엔 없음). 신규 테스트의 설계 품질도 전반적으로 높다: `unittest.mock`
  대신 PATH 우선순위로 가짜 `pnpm` 실행파일을 얹어 스크립트를 서브프로세스 블랙박스로 통째로
  돌리는 방식(`.claude/tests/test_override_floors.py:71-113`, `run_with_stub_audit`)이라 내부
  리팩터링에 강하고, 모든 서브프로세스 호출이 `tempfile.TemporaryDirectory()` 로 완전히
  격리되며(`REPO_ROOT` 가 스테이징된 스크립트의 `__file__` 기준으로 재계산돼 실제 저장소
  파일을 우연히 읽을 위험이 없음, `test_missing_workspace_file_is_undecidable` 이 이 경계를
  직접 겨냥), `GlobSemanticsTest.test_classifier_actually_uses_these_semantics`
  (`.claude/tests/test_dependabot_npm_coverage.py:186-206`)의 모듈 전역 monkeypatch 도
  `try/finally` 로 감싸 단언 실패 시에도 원상복구가 보장된다. `test_workflow_yaml_structure.py`
  의 `_duplicate_keys()` 도 호출마다 `yaml.SafeLoader` 서브클래스를 새로 만들어
  `add_constructor` 를 등록하므로 라이브러리 전역 상태를 오염시키지 않는다(직접 확인:
  `yaml.SafeLoader.yaml_constructors` 가 호출 전후 동일). 각 테스트 docstring 이 실측 실패
  사례·원인·판단 기준을 구체적으로 서술해 의도가 명확하다.
  - 위치: 위 서술 참조 — 조치 불요, 참고 패턴으로 유지 권장.

## 요약

이번 diff(4차 라운드)는 1~3차 리뷰가 지적한 CRITICAL 5건·WARNING 다수를 모두 실제로 해소했음을
직접 재실행·재현으로 확인했다 — 하네스 스위트 744건 전부 PASS, plan 문서의 테스트 수치(25건/
744건)가 실측과 정확히 일치, 커밋 메시지가 주장하는 mutation 4종도 전부 정확히 재현됨. 3차
testing 라운드가 남긴 WARNING 2건·INFO 2건도 이번 커밋에서 리터럴 pin 추가·수치 정정·
`CombinedReportTest`·id 폴백 테스트로 전부 해소됐다. 다만 이번 라운드가 새로 도입한 "스키마
드리프트 fail-closed" 방어 자체에 미검증 사각지대가 하나 남아 있다 — `actions[]` 만 드리프트하고
`advisories` 는 (다른 override-미대상 패키지에 대해) 정상 파싱되는 조합에서는 222행의
`and not reported` 절 때문에 방어가 발동하지 않고 조용히 통과한다는 것을 직접 재현으로
확인했다. 이는 정확히 이 기능이 막으려는 "조용한 통과" 실패 클래스를 그 기능 자신이 부분적으로
재현하는 것이며, `SchemaDriftTest` 의 두 케이스가 모두 `advisories={}` 로 고정돼 있어 이 조합을
커버하지 않는다. 트리거 조건이 특정적(pnpm 이 `advisories`/`actions` 를 비대칭적으로 개명하는
미래의 외부 스키마 변경)이라 지금 당장 깨지는 상태는 아니지만, 실제 코드 로직의 결함이자
동시에 회귀 테스트로 잡히지 않는 갭이므로 병합 전 조치를 권고한다. 그 외에는 테스트 격리·
가독성·mock 적절성·기존 회귀 테스트의 유효성 모두 매우 높은 수준이다.

## 위험도

MEDIUM
