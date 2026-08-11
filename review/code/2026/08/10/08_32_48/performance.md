# 성능(Performance) 리뷰 결과

## 발견사항

- **[WARNING]** `truncate_file_bundle` 의 드롭 루프가 O(n²) — 이미 처리한 `dropped` 청크를 매 반복마다 다시 계산
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:825-842` (`truncate_file_bundle`, `while kept:` 루프)
  - 상세: `while kept:` 루프는 한 번에 파일 하나씩만 `kept`→`dropped` 로 옮기면서(`dropped.insert(0, kept.pop())`), 매 반복마다 `_omitted_notice([rel_of(c) for c in dropped])` 와 `stubs = "".join(stub_of(c) for c in dropped)` 를 **`dropped` 전체에 대해 처음부터 다시 계산**한다. `dropped` 는 반복마다 최대 1개씩만 늘어나므로 이미 이전 반복에서 계산된 원소까지 매번 재계산하는 셈이고, 여기에 `sum(len(c) for c in kept)` 까지 더해 반복당 O(len(dropped)+len(kept)) 작업이 최악의 경우 n번(파일 수만큼) 반복돼 전체 O(n²) 가 된다. `rel_of`(`chunk.split("\`")`, maxsplit 없이 전체 분할)와 `stub_of`(f-string 포매팅)는 둘 다 계산 비용이 0 이 아니라서 재계산이 순수 오버헤드다. 이 함수는 `spec/conventions/*-api-catalog/` 처럼 코드 내 주석이 "222개 nested 파일 강등" 이라 실측해 둔, 실제로 n 이 수백에 달하는 코퍼스(conventions 번들)에 대해 매 checker(최대 5개, `budget_substitutions` 가 checker 마다 다른 budget 으로 재호출) 마다 반복 호출된다. 오늘 규모(수백 파일, 단명 CLI)에서 치명적이진 않지만, 이 파일 자체가 "858KB 스펙 덤프", "230개 카탈로그" 처럼 스케일에 민감하다고 이미 여러 곳에서 실측·문서화해 둔 코드베이스라 방치하면 다음 회귀 후보다.
  - 제안: `dropped`/`kept` 에 대해 누적 길이(running total)를 유지하고, 새로 드롭되는 청크 1개에 대해서만 `stub_of`/`rel_of` 를 계산해 캐시(예: `dict[id(chunk), stub]`)하도록 바꾸면 O(n) 으로 줄일 수 있다. `rel_of` 도 `chunk.split("\`", 2)` 로 maxsplit 을 지정하면 청크 전체를 백틱마다 분할하는 낭비를 없앤다.

- **[WARNING]** `spec-plan-completion.test.ts` — 같은 `plan/complete/` 트리·같은 파일들을 두 `describe` 블록이 각각 재순회·재파싱
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:119-133`, `:145-148`, `:184-200`
  - 상세: 첫 `describe("Gate C …")` 블록(119-121행)이 `collectCompletePlans(root)` 로 `plan/complete/` 전체를 재귀 스캔한 뒤, 124-133행에서 파일마다 `fs.readFileSync` + `matter()` 로 프런트매터를 파싱해 `enforced` 를 구한다. 145-148행의 `for (const abs of enforced)` 루프는 `enforced` 에 속한 각 파일을 **또 한 번** `fs.readFileSync`+`matter()` 로 다시 읽고 파싱한다(같은 파일을 같은 테스트 파일 안에서 2회 파싱). 더 나아가 184-186행의 두 번째 `describe("완료 plan 은 미완을 주장하지 않는다", …)` 블록은 `collectCompletePlans(root)` 를 **독립적으로 다시 호출**해 디렉터리 재귀 스캔을 통째로 한 번 더 수행하고, 192-200행에서 전체 파일에 대해 `fs.readFileSync`+`matter()` 를 세 번째로(사실상 파일 전체 집합 기준으로는) 반복한다. 현재 `plan/complete/` 는 231개 이상(파일 자체 주석에 명시)이라 테스트 스위트 로드 시점(vitest 는 `describe` 콜백을 동기 평가)마다 같은 디렉터리 트리 워크가 2회, 같은 파일 집합의 frontmatter 파싱이 최소 2~3회 중복된다.
  - 제안: `collectCompletePlans(root)` 결과와 각 파일의 `matter()` 파싱 결과(`{abs, data}`)를 모듈 스코프에서 한 번만 계산해 두 `describe` 블록이 공유하도록 리팩터링하면 디렉터리 워크·파일 I/O·YAML 파싱 중복을 없앨 수 있다.

- **[INFO]** `plan-link-integrity.test.ts` — `collectPlanMarkdown` 이중 실행(직접 호출 + `findBrokenPlanLinks` 내부 호출)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts:113-119`(직접 호출), `:127`(`findBrokenPlanLinks(root)`) / 관련 구현: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:268-293`(`collectPlanMarkdown`), `:304-308`(`findBrokenPlanLinks`)
  - 상세: "scans a non-trivial plan set…" 테스트가 113행에서 `collectPlanMarkdown(root)` 를 호출해 `plan/**` 전체(현재 440개 이상, 주석에 실측치 명시)를 재귀 스캔하고 각 파일을 `fs.readFileSync` 로 읽어 링크 토큰 수를 센다. 곧이어 모듈 스코프 127행의 `findBrokenPlanLinks(root)` 가 내부적으로 `collectPlanMarkdown(root)` 를 **다시** 호출해 동일 디렉터리를 재귀 스캔하고, `findBrokenLinksInFiles` 가 같은 파일들을 `extractLinks` 로 한 번 더 읽는다. 결과적으로 같은 400여 개 파일에 대해 디렉터리 워크 2회 + 파일 읽기가 서로 다른 목적(링크 토큰 카운트 vs 링크 파싱)으로 2회 이상 발생한다. 각 `it()` 이 독립 검증이라는 테스트 관례상 불가피한 면이 있고 규모도 CI 1회 실행 기준 수십 ms 수준이라 급하지는 않다.
  - 제안: 급하지 않으면 유지해도 무방하나, 스캔 대상이 더 커지면 `collectPlanMarkdown(root)` 결과를 모듈 스코프에서 한 번 계산해 두 지점이 공유하도록 정리할 수 있다.

- **[INFO]** `prioritize_bundle_files`/`_named_in` — 파일 수 × 거대 문자열(최대 ~755KB) 부분문자열 검색을 tier 계산마다 반복
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:283-292`(`_named_in`), `:295-352`(`prioritize_bundle_files`, 특히 `tier()` 332-347행과 `sorted(...)` 352행)
  - 상세: `tier(path)` 는 파일마다 `_named_in(rel, branch_plan_text)` 와 `_named_in(rel, plan_text)` 를 호출하고, 각각 `rel in plan_text or os.path.basename(rel) in plan_text` 형태로 최대 수백 KB(주석 실측: in-progress plan 63개 연결 시 755,385자)짜리 문자열에 대한 부분문자열 검색을 수행한다. `sorted(file_paths, key=lambda p: (tier(p), …))` 가 파일마다 이 key 함수를 1회씩 호출하므로, conventions 번들처럼 파일 수가 수백(카탈로그 포함)인 경우 `파일수 × corpus 크기` 에 비례하는 스캔 비용이 발생하고, 이 계산이 `--impl-done` 모드에서 `other_spec_files`/`convention_files`/`plan_files`/`scope_files` 네 번의 `_prioritized(...)` 호출에 걸쳐 반복된다.
  - 제안: 오늘 규모(단명 CLI, 초당 수십~수백 ms 이내로 추정)에서는 시급하지 않다. 코퍼스가 더 커지면 `plan_text`/`branch_plan_text` 에서 언급된 경로·베이스네임 집합을 한 번만 정규식/토큰화로 추출해 `set` 조회로 바꾸는 편이 안전하다.

- **[INFO]** 테스트 하네스의 fresh-interpreter subprocess 패턴이 스위트 실행시간에 누적 비용
  - 위치: `.claude/tests/test_consistency_bundle_priority.py`, `.claude/tests/test_consistency_context_budget.py` 전반 (각 `run_in_orchestrator` 호출)
  - 상세: `_lib` 이름 충돌을 피하려고 매 `it`/`test_*` 마다 별도 Python 인터프리터를 서브프로세스로 띄운다(문서화된 의도적 격리). 두 파일 합쳐 수십 개의 테스트 메서드가 있어 서브프로세스 기동 비용이 누적된다.
  - 제안: 정합성(격리) 이 성능보다 우선한 의도적 트레이드오프로 보이므로 변경을 권하지 않는다. 참고용으로만 기록.

## 요약

이번 변경분 중 성능에 실질적으로 영향을 줄 수 있는 지점은 `consistency_orchestrator.py` 의 `truncate_file_bundle` 이 파일 드롭 시 이미 처리한 항목까지 매 반복 재계산하는 O(n²) 구조인 것과, `spec-plan-completion.test.ts` 가 `plan/complete/` 전체(231개 이상)를 두 `describe` 블록에서 각각 재순회·재파싱하는 중복 I/O 두 가지다. 둘 다 현재 스케일(수백 파일, 단명 CLI/CI 테스트)에서 체감 지연을 일으킬 정도는 아니지만, 코드베이스 자체가 코퍼스 크기(858KB 스펙 덤프, 230개 카탈로그, plan 440개 이상)에 이미 여러 번 데어 실측·주석으로 남겨온 이력을 고려하면 다음 회귀 후보로 방치하기보다 지금 정리하는 편이 싸다. 그 외 항목(부분문자열 검색 반복, 디렉터리 재스캔)은 INFO 수준으로, 즉각 조치가 필요하지는 않다. `_READ_CACHE` 도입으로 같은 실행 내 파일 이중 읽기를 막은 점은 방향이 맞는 개선이다.

## 위험도

LOW
