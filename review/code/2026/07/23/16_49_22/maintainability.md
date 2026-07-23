# 유지보수성(Maintainability) 리뷰 — router_safety 정책표 44확장자 정정 + drift 가드 테스트

## 리뷰 범위 메모

diff 15개 파일 중 실질 코드는 파일 1~4(`README.md` 1줄 수치 정정, `router_safety.py` 1줄 수치 정정,
`.claude/tests/README.md` 표 1행 추가, 신규 `test_router_safety_policy_doc.py`)이다. 파일 5~15는
`review/code/2026/07/23/16_30_52/` 하위의 **이전 리뷰 세션 산출물**(SUMMARY/RESOLUTION/meta.json/
각 reviewer report)이 이번 커밋에 함께 커밋된 것으로, 코드가 아니라 리포트 텍스트이므로 가독성·
네이밍·함수 길이 등 유지보수성 항목이 적용되지 않는다(NONE, 리뷰 대상에서 제외). 이하 발견사항은
파일 1~4 대상이다.

## 발견사항

- **[WARNING]** 신규 테스트 클래스 내 캐싱 전략이 비일관적 — `_all_agents()` 가 memoize 되지 않아 표 행마다 subprocess 를 재기동
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:68` (`_all_agents` 정의), `:221` (`_reviewers_named_in`), `:240` (`test_docstring_table_names_exactly_the_reviewers_the_rules_force`)
  - 상세: `setUpClass`(`:86-90`)는 `router_safety` 상수 스냅샷(`cls.values = _router_safety_values()`)을 **클래스당 1회**만 subprocess 로 조회해 캐시한다. 그런데 `_all_agents()`(`:68`)는 동일하게 subprocess 로 `ALL_AGENTS` 를 조회함에도 어디에서도 캐시되지 않는다. `_reviewers_named_in`(`:221-228`)이 매 호출마다 `_all_agents()` 를 다시 실행하고, `test_docstring_table_names_exactly_the_reviewers_the_rules_force`(:240-258)는 정책표의 "(none)" 이 아닌 행마다(`for trigger, forced in rows: ... self._reviewers_named_in(forced)`) 이 함수를 호출한다 — 즉 정책표 행 수만큼(현재 9행 중 대다수) 매 테스트 실행 시 동일한 값을 얻기 위해 subprocess 를 반복 기동한다. 여기에 더해 `test_every_documented_reviewer_count_matches_all_agents`(:281)와 `test_reviewer_roster_count_and_names_match_the_orchestrator`(:305)도 각각 별도로 `_all_agents()` 를 호출한다. `values`(캐시됨)와 `agents`(캐시 안 됨) 사이의 이 비대칭은 같은 파일 안에서 일관되지 않은 패턴이라, 이후 이 파일을 확장하는 사람이 "픽스처는 이미 캐시돼 있다"고 오해하고 `_all_agents()` 를 반복 호출하는 코드를 추가하기 쉽다.
  - 제안: `setUpClass` 에서 `cls.agents = _all_agents()` 로 한 번만 조회해 캐시하고, `_reviewers_named_in`/두 테스트 메서드가 `self.agents`(또는 `set(cls.agents)`)를 참조하도록 변경. `_router_safety_values()`/`_all_agents()` 둘 다 클래스 스냅샷으로 통일하면 캐싱 정책이 파일 전체에서 일관돼진다.

- **[INFO]** 두 헬퍼 함수(`_router_safety_values`, `_all_agents`) 간 subprocess 호출·에러 처리 보일러플레이트 중복
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:46-65`(`_router_safety_values`), `:68-77`(`_all_agents`)
  - 상세: 두 함수 모두 `subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, cwd=str(REPO_ROOT))` 호출 후 `returncode != 0` 이면 `AssertionError(f"...{r.stderr[-1500:]}")`, 아니면 `json.loads(r.stdout.strip().splitlines()[-1])` 를 반환하는 동일 패턴을 반복한다. `-1500` 잘라내기 값도 두 곳에 하드코딩되어 있다. 다만 이 패턴은 같은 스위트의 `test_router_decision_trust.py` 등에서도 반복되는 기존 컨벤션이라 이번 PR 이 새로 만든 문제는 아니다.
  - 제안: `_run_python_json(script: str, context: str) -> dict | list` 공용 헬퍼로 추출하면 두 함수는 각자의 `script` 조립에만 집중할 수 있다. 즉시 조치가 필요한 사안은 아니며, 스위트 전반의 별도 리팩터링 후보로 남겨도 무방.

- **[INFO]** 정규식 기반 문서 파싱이 정확한 prose 문구에 강결합
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:92-104`(`_doc_extension_list`/`_readme_extension_list`), `:184`(`_POLICY_TABLE_ANCHOR`), `:279`(`ROSTER_COUNT_RE`)
  - 상세: `"Source-code extensions counted by \`_SOURCE_FORCED_REVIEWERS\`:\n"`, `"\| Source-code file \(\d+ extensions below\)"`, `"소스 코드 확장자: \`([^\`]+)\`"` 등 문서의 정확한 텍스트 패턴에 강하게 결합되어 있어, 향후 문서 문구를 자연스럽게 다듬으려는 편집자가 이 정규식을 모르고 깨뜨릴 위험이 있다. 다만 이 파일 docstring 이 스스로 "Prose-checking on purpose"(`:20`)로 명시하고 `.claude/tests/README.md` 의 문서-는-곧-스펙 컨벤션 예외와 정확히 연결돼 있어 의도된 트레이드오프다.
  - 제안: 현행 유지. 각 `assertIsNotNone` 실패 메시지가 이미 원인(정규식 불일치 vs 진짜 드리프트)을 구분할 수 있게 충실하므로 추가 조치 불요.

- **[INFO]** 단일 테스트 클래스가 세 개의 구분되는 정책 축을 모두 담당 — `PolicyMatrixMatchesConstantsTest`(322줄, 15개 테스트 메서드)
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:85-318`
  - 상세: 확장자 개수/목록 drift(7개 테스트), forced-reviewer 표 drift(3개 테스트), reviewer 로스터 카운트 drift(2개 테스트)가 한 클래스에 묶여 있다. `setUpClass` 로 파일 읽기·subprocess 조회를 1회만 수행하는 이점 때문에 하나로 유지한 것으로 보이며, 클래스명("PolicyMatrix")도 세 축을 아우르는 상위 개념으로 타당하다. 각 테스트 메서드 자체는 짧고 단일 책임을 갖고 있어 심각한 문제는 아니다.
  - 제안: 선택 사항. 축별로 별도 클래스 3개로 분리하고 `setUpClass` 픽스처를 mixin 또는 모듈 레벨 캐시로 공유하면 실패 시 어떤 정책 축이 깨졌는지 테스트 러너 출력(클래스명)만으로 더 빠르게 파악 가능하나, 현재도 테스트 메서드명이 충분히 구체적이라 즉시 조치가 필요한 수준은 아니다.

- **[INFO]** 파일 1(`README.md`)·파일 2(`router_safety.py`) diff — 각각 표 안 숫자 하나(`24`→`44`)만 정정하는 1줄 수정. 가독성·복잡도·중복 문제 없음.
  - 위치: `.claude/skills/code-review-agents/README.md:68`, `.claude/skills/code-review-agents/lib/router_safety.py:36`

- **[INFO]** 파일 3(`.claude/tests/README.md`) — 기존 표 행과 동일한 스타일(장문 단일 셀 서술)로 신규 행 1개 추가. 파일 전체가 이미 이런 고밀도 서술 컨벤션이므로 이번 변경만의 새로운 가독성 저하는 없음.
  - 위치: `.claude/tests/README.md:37`

## 요약

핵심 변경은 `router_safety.py`/`README.md` 두 곳의 "24→44 확장자" 수치 정정과, 동일 클래스의 drift(정책 문서 숫자·목록·표가 실제 상수와 어긋나는 문제)를 봉인하는 신규 회귀 가드 테스트(`test_router_safety_policy_doc.py`) 추가다. 신규 테스트 파일은 목적·근거(과거 두 차례 실측 miss 이력)를 docstring 에 상세히 기록했고, 각 테스트 메서드는 짧고 단일 책임을 가지며 실패 메시지도 원인을 구체적으로 설명해 전반적으로 가독성·네이밍·중첩 깊이는 양호하다. 다만 `_router_safety_values()`(캐시됨)와 `_all_agents()`(캐시 안 됨) 사이의 비일관된 메모이제이션 전략이 실질적 결함으로, 정책표 행 수만큼 동일 subprocess 호출을 반복하는 낭비와 향후 확장 시 혼동 소지가 있어 WARNING 으로 분류한다. 그 외 지적(헬퍼 함수 보일러플레이트 중복, 정규식-문서 결합도, 단일 클래스의 다축 책임)은 이미 알려진 트레이드오프이거나 기존 스위트 컨벤션과 일치하는 경미한 사항으로 INFO 수준이다.

## 위험도
LOW
