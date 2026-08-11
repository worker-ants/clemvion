# 테스트(Testing) 리뷰 — `_named_in` 경계 고정 매치

## 검증 방법

`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 를 저장소 밖
scratch(`/private/tmp/.../scratchpad/named_in_boundary_review/claude_copy/`)에 복사하고(디렉터리
구조는 `lib`/`_lib`/`_shared` 상대 임포트가 깨지지 않도록 `.claude/` 전체를 그대로 유지),
그 사본의 `consistency_orchestrator.py` 만 `cp` 로 치환·복원하며 뮤테이션했다. `git
restore`/`git checkout` 은 쓰지 않았고, 실 워크트리(`.claude/skills/...`,
`.claude/tests/...`)는 세션 종료 시점에 `git status --porcelain` 으로 clean 임을 재확인했다.

각 뮤턴트에 대해 `test_consistency_bundle_priority.py` 의 신규/관련 테스트 12개
(경계 관련 테스트 전부 + 회귀용 기존 테스트 3개)를 재현하는 독립 드라이버
(`driver.py`)로 PASS/FAIL 을 실측했다 — `prioritize_bundle_files` 는 디스크 I/O 를 하지
않으므로 임의의 `ROOT` 문자열로 충분히 재현 가능함을 먼저 확인했다.

## 주장 검증 결과 — 둘 다 정확

| 뮤턴트 | 주장 | 실측 |
| --- | --- | --- |
| 경계 제거 (원래 `in` 복원) | 2건 RED: `test_longer_name_does_not_promote_the_shorter_one` · `test_extension_suffix_does_not_count` | **정확히 일치** — 이 2건만 FAIL, 나머지 10건 PASS |
| 과잉 조임 (`_NAME_START` → `(?<=/)`) | 4건 RED: `test_basename_mention_is_enough` + subTest 2(백틱·문장 끝) + `test_a_branch_plan_mention_outranks_any_other_plan_mention` | **정확히 일치** — 이 4건만 FAIL, 나머지 8건 PASS |

`consistency_orchestrator.py:290-293` 의 `_NAME_START`/`_NAME_END` 도입과
`test_consistency_bundle_priority.py:95-169` 의 신규 테스트 6개는 서로 정합적이며,
과거(같은 세션의 `spec-link-integrity` 앵커) 있었던 "자매 뮤턴트 중 하나만 잡혔는데 둘 다
검증됐다고 결론"하는 패턴은 이번엔 재현되지 않았다.

## 발견사항

- **[WARNING]** `_NAME_START` 문자 클래스의 `.` 와 `_` 가 **테스트로 보호되지 않는다** — 둘 다
  제거해도 12개 테스트 전부 GREEN.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:292` (`_NAME_START = r"(?<![A-Za-z0-9_.\-])"`) / 관련 코드 주석 `:289-291`
  - 상세: `_NAME_START` 클래스에서 `.` 만 빼거나(`mutantD`) `_` 만 빼도(`mutantE`)
    `test_consistency_bundle_priority.py` 의 어떤 테스트도 실패하지 않았다(각각 12/12
    PASS). 반면 대조군으로 만든 `-`(hyphen) 제거 뮤턴트는 `test_longer_name_does_not_promote_the_shorter_one`
    로 즉시 잡혔다 — `-` 는 실보고된 버그(`secret-store.md` → `store.md`)와 정확히 겹치는
    경계라 우연히 잘 커버되지만, `.` 와 `_` 는 그런 우연한 커버가 없다.
    코드 주석(`:289-291`)이 `.` 을 명시적으로 "LEADING class 에 넣은 이유"까지 설명하는데
    (`v2.store.md` 가 `store.md` 를 답하면 안 된다), 정작 그 시나리오를 직접 검증하는
    테스트가 없다. 별도 프로브로 실제 동작 차이를 확인했다:
    `_named_in("spec/conventions/store.md", "이 문서는 v2.store.md 를 대체한다")` 는
    원본에서 `False`, `.` 제거 뮤턴트에서 `True`. `_` 도 동일한 패턴
    (`secret_store.md` 예시로 확인, 원본 `False` → `_` 제거 뮤턴트 `True`).
  - 제안: `test_longer_name_does_not_promote_the_shorter_one` 과 짝을 이루는 `.`/`_` 버전을
    `_SUBSTRING_TRAP` 류로 하나씩 추가한다(예: `v2.store.md`, `secret_store.md` 를
    plan_text 에 넣고 `store.md` 가 승격되지 않음을 단언). 이 PR 이 경계를 "글자 단위로"
    정밀하게 고쳤다고 주장하는 만큼, 그 정밀함의 절반(문자 클래스 5종 중 2종)이 회귀
    테스트 없이 남아 있는 것은 이 diff 의 목적과 어긋난다.

- **[INFO]** `_NAME_END` 전체 제거는 `test_extension_suffix_does_not_count` 로 정확히
  잡힌다 — 갭 아님.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:293`
  - 상세: `_NAME_END = ""` 로 완전히 제거한 뮤턴트를 실행하면 딱 1건
    (`test_extension_suffix_does_not_count`, `node-output.md` 가 `node-output.mdx` 안에서
    매치되면 안 된다는 테스트)만 FAIL 하고 나머지 11건은 PASS. 트레일링 경계는 현재 이
    테스트 하나가 전담하고 있고, 정확히 의도한 시나리오를 잡는다.

- **[INFO]** `test_the_named_file_is_still_promoted` 는 만든 5개 뮤턴트(A/B/C/D/E, 그리고
  대조군 hyphen 뮤턴트 F) 중 **어느 것도 잡지 못한다** — 판별력 0.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:137-144`
  - 상세: 이 테스트의 픽스처(`_SUBSTRING_TRAP`, plan_text=`` `cafe24-api-catalog/store.md` 를 고친다 ``)에서
    매치되는 needle(`store.md`)은 항상 `/`(경로 구분자) 바로 뒤에 온다 —
    `cafe24-api-catalog/store.md`. `_NAME_START` 를 어떻게 좁히거나(`(?<=/)` 로 과잉
    조임) 넓혀도(`.`/`_` 제거) `/` 는 항상 제외 대상이므로 이 테스트는 절대 갈리지 않는다.
    테스트 자체의 목적(주석: "경계 도입이 실제 신호를 깨면 안 된다는 회귀 방지")은
    타당하고 실제로 다른 결함 클래스(예: `_named_in` 이 통째로 `False` 만 반환하도록
    깨지는 경우)는 잡아낸다 — 다만 "경계 고정"이라는 이번 diff 의 핵심 로직에 대해서는
    말 그대로 vacuous 하다. 이 자체가 결함은 아니고(짝이 되는
    `test_longer_name_does_not_promote_the_shorter_one` 이 판별력을 갖고 있음), 다만
    리뷰 요청에서 명시적으로 지목한 대상이라 기록해 둔다.

- **[INFO]** `test_mention_forms_that_must_still_count` 의 4개 subTest 중 **2개(frontmatter,
  markdown link)는 경계 관련 뮤턴트(A~F) 중 어느 것도 잡지 못한다** — 나머지 2개(백틱,
  문장 끝)만 판별력이 있고, 이는 원 주장의 "4건" 목록과 정확히 일치한다(frontmatter·
  markdown link 는 애초에 그 목록에 없었다).
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:146-161`
  - 상세: `frontmatter`("spec_impact:\n  - spec/5-system/4-execution-engine.md\n")와
    `markdown link`("[엔진](../5-system/4-execution-engine.md)")두 형태는 basename
    앞이 항상 `5-system/` 뒤의 `/` 이므로, `test_the_named_file_is_still_promoted` 와
    같은 이유로 START 클래스의 구체적 문자와 무관하게 항상 통과한다. `backticked
    basename`(백틱 뒤)과 `bare, sentence-final`(공백 뒤)만 `/` 가 아닌 경계 문자를
    실제로 시험하고, 그래서 `mutantB`(`(?<=/)` 과잉 조임)에서 이 둘만 FAIL 한다.
    docstring 이 "각 서브테스트를 독립적으로 확인해 한 폼의 통과가 나머지를 가리지
    못하게 한다"고 말하는 의도는 "언급 폼이 인식되는가"에 대해서는 맞지만, "경계
    문자 클래스가 정확한가"에 대해서는 이 중 절반만 기여한다 — 리뷰 요청이
    구체적으로 지목한 지점이라 여기 기록한다. 결함으로 보진 않는다(원 커밋의
    "4건" 주장이 이미 이 2개를 카운트에서 뺐다는 것은, 작성자가 이 비대칭을 이미
    인지하고 정확히 계산했다는 뜻이다).

## 회귀·격리·전체 스위트

- `test_consistency_bundle_priority.py` 35개 전부 GREEN(원본, 무뮤테이션):
  `cd .claude/tests && python3 -m unittest test_consistency_bundle_priority -v` → `Ran 35 tests ... OK`.
- 더 넓게 `test_consistency*.py` 전체(4개 파일, 79개 테스트)도 GREEN:
  `python3 -m unittest discover -p "test_consistency*.py"` → `Ran 79 tests ... OK`.
- `TheDocumentBeingEditedIsNeverOmittedTest.test_the_probe_leaves_no_residue` 등 기존
  프로브 원복 테스트도 이번 diff 와 무관하게 정상 통과 — 이번 변경이 다른 테스트의 격리를
  깨지 않았다.
- 프롬프트에 포함된 두 번째 diff 훈크(`_n_on_topic` 주석 정정, `:559-572`)는 순수 주석
  변경으로 별도 테스트 대상이 아니다. 다만 그 주석이 인용하는 "mutating the check away
  left every test green" 서술과, `_named_in` 관련 커버리지 갭(`.`/`_` 미테스트)이 같은
  성격의 문제라는 점은 지적할 가치가 있다 — 이번엔 핵심 회귀(경계 무력화)는 잘 잡히지만
  경계를 구성하는 문자 집합 전체가 잡히는 것은 아니다.

## 요약

`_named_in` 경계 고정에 대한 orchestrator 의 두 뮤테이션 주장(경계 제거 2건, 과잉 조임
4건)은 scratch 사본에서 독립 재현한 결과 **잡히는 테스트 개수와 이름까지 정확히
일치**했다 — 과거 발생했던 "자매 뮤턴트 중 하나만 검증되고 둘 다 검증됐다고 결론"하는
패턴은 이번엔 없다. `_NAME_END` 제거도 `test_extension_suffix_does_not_count` 로 정확히
잡힌다. 다만 `_NAME_START` 문자 클래스의 5개 문자 중 `-`(hyphen, 실보고 버그와 겹쳐
우연히 커버됨) 를 제외한 `.` 와 `_` 는 어떤 테스트도 보호하지 않는다는 실제 커버리지
갭을 확인했다 — 코드 주석이 `.` 의 존재 이유를 명시적으로 설명하는데도 그 시나리오를
검증하는 테스트가 없다. `test_the_named_file_is_still_promoted` 와
`test_mention_forms_that_must_still_count` 의 frontmatter/markdown-link 서브테스트는
경계 관련 뮤턴트에 대해 판별력이 없지만, 이는 "언급 폼 인식"이라는 별도 목적을 가진
의도된 회귀 방지 테스트이며 결함으로 보긴 어렵다. 하니스 전체 스위트(`test_consistency*.py`
79개)는 원본에서 전부 GREEN.

## 위험도

LOW — 현재 구현(`_NAME_START`/`_NAME_END`)은 정확하고, 두 뮤테이션 주장도 실측과
정확히 일치한다. 다만 `.`/`_` 문자 보호 테스트 부재는 향후 이 정규식이 리팩터링될 때
조용히 좁혀질 수 있는 실질적 커버리지 갭이라 WARNING 항목으로 남긴다.

STATUS: OK
