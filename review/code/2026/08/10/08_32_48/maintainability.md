# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 신규 헬퍼 `_n_on_topic` 이 `_prioritized`의 스코프-필터 로직과, `prioritize_bundle_files` 내부 `tier()`의 tier 0/1 판정 로직을 각각 별도로 재구현한다 — 세 곳이 같은 규칙을 따로 유지해야 한다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:521` (`_prioritized`), `:535` (`_n_on_topic`), `:332` (`prioritize_bundle_files` 내부 `tier`)
  - 상세: `_prioritized`(521-533)와 `_n_on_topic`(535-552)은 `prefix = os.path.relpath(scope_abs, root).rstrip("/") + "/"` 와 `changed = {r for r in _rank_changed if r.startswith(prefix)}` 두 줄을 그대로 반복한다. 더 심각한 것은 `_n_on_topic`의 `if rel in changed or (not _is_catalog_bulk(rel) and _named_in(rel, _rank_branch_plan_text))`(546-548)이 `tier()`(332-347)의 "tier 0 또는 1" 판정을 **독립적으로 재구현**한 것이라는 점이다. `_n_on_topic`의 docstring 자체가 "the count has to agree with `_prioritized`'s own tiering" 이라고 명시하면서도 실제로는 `tier()`를 호출하지 않고 조건을 손으로 다시 적었다 — tier 순서나 catalog 강등 조건이 나중에 바뀌면 두 곳 중 한쪽만 갱신되어 diff 스플라이스 위치가 조용히 어긋날 수 있다. 이 모듈이 속한 파일들의 커밋 이력(예: `.claude/_shared/git_probe.py` 헤더)이 정확히 이 "같은 로직을 두 곳에 손으로 유지하다 drift"하는 실패를 반복해 기록해온 것과 같은 패턴이다.
  - 제안: `tier()`를 `prioritize_bundle_files`에서 분리해 `_tier_of(rel, changed, branch_plan_text, plan_text)` 같은 모듈 레벨 함수로 노출하고, `_n_on_topic`은 그 결과가 `{0, 1}`인지로 판정하도록 바꾼다. `scope_abs` → `changed` prefix-필터 계산도 별도 헬퍼로 뽑아 `_prioritized`/`_n_on_topic` 양쪽에서 재사용한다.

- **[WARNING]** 신규 함수 `worktree_changed_files`가 `branch_diff_files`의 에러 처리 블록(try/except + rc!=0 분기 + 메시지 트렁케이션)을 거의 그대로 복제한다.
  - 위치: `.claude/_shared/git_probe.py:263` (`worktree_changed_files`, 특히 288-298) vs `:200` (`branch_diff_files`, 특히 246-259)
  - 상세: 두 함수 모두 `except Exception as exc: on_error(f"...: {type(exc).__name__}: {exc}"[:240]); return []` 와 `if rc != 0: reason = err.strip()[:200] or f"rc={rc} (timeout or git unavailable)"; on_error(...); return []` 패턴을 문자 그대로 반복한다(라벨 문자열만 다름). 이 모듈의 docstring(1-38줄) 자체가 "review_guard.py 와 plan_guard.py 가 다섯 함수를 byte-identical 하게 복제하다 drift 했다"는 것을 이 파일이 존재하는 이유로 명시하는데, 정작 이 PR 이 그 파일 안에 새 복제를 하나 만들었다.
  - 제안: 공통 부분을 `_run_and_report(args, cwd, timeout, on_error, label) -> tuple[int, str, str] | None` 같은 내부 헬퍼로 뽑아 두 함수 모두 위임하게 한다.

- **[WARNING]** 신규 함수 `collectPlanMarkdown`이 기존 `collectSpecMarkdown`·`collectCodebaseSources`와 거의 동일한 스택 기반 디렉터리 순회 로직을 세 번째로 반복 구현한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:268` (`collectPlanMarkdown`, 신규) vs `:130` (`collectSpecMarkdown`) vs `:333` (`collectCodebaseSources`)
  - 상세: 세 함수 모두 "루트가 없으면 빈 배열 반환 → 스택에 push → `readdirSync(withFileTypes)` 로 순회하며 디렉터리는 스택에, 파일은 확장자·제외 조건을 걸러 relPath 계산해 push → `localeCompare`로 정렬"이라는 동일한 골격을 각자 손으로 반복한다. 차이는 루트(들), 제외 조건(`inGeneratedCatalog` / `archive` 이름 / `CODEBASE_SKIP_DIRS` Set), 확장자 필터(`.md` / `.ts`+`.tsx`)뿐이다. 이번 PR 이 이 골격을 세 번째로 복제해 넣은 것이라, 예를 들어 "제외 디렉터리를 대소문자 무시로 비교" 같은 수정이 필요해지면 세 곳 중 일부만 고쳐질 위험이 생긴다.
  - 제안: `walkFiles(roots: string[], { skipDir, matchFile }): SpecMdFile[]` 형태의 공용 순회 헬퍼로 통합하고 세 함수를 그 위의 얇은 래퍼로 만든다.

- **[INFO]** `collect_context`가 4개 CLI 모드(`--spec/--plan/--impl-prep/--impl-done`)의 분기 처리와 순위 결정용 클로저 3개(`_prioritized`, `_n_on_topic`, `_require_target`)를 한 함수 안에 모두 담고 있어 225줄에 달한다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:483`-`707`
  - 상세: `_require_target`(554-590, 37줄)은 외부 클로저 변수를 전혀 캡처하지 않는데도(인자로만 동작) `collect_context` 내부에 중첩되어 있어 함수 길이만 늘린다. `main()`(1003-1114, ~112줄) 역시 `--resume`/`--summary-state`/`--update`/일반 4가지 실행 모드를 한 함수에서 순차 분기한다.
  - 제안: `_require_target`은 모듈 레벨로 옮긴다. `collect_context`는 모드별 분기(spec/plan 단일문서 vs impl_prep/impl_done 스코프+diff)를 별도 함수로 쪼개면 각 분기를 독립적으로 테스트하기 쉬워진다(현재도 `run_in_orchestrator`를 통해 결과적으로는 테스트되고 있으나, 함수가 커질수록 신규 분기 추가 시 회귀 지점이 늘어난다).

- **[INFO]** 신규 테스트 파일 `test_consistency_bundle_priority.py`에서 `class Args: spec = plan = impl_prep = diff_base = None; impl_done = None` 형태의 인라인 스텁 클래스가 이번 PR 로 4곳(335, 457, 535, 622행)에 반복 삽입됐고, 형태도 두 가지(한 줄로 합친 버전 vs `impl_done`을 별도 줄로 뺀 버전)로 갈라진다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:335, 457, 535, 622`
  - 상세: 같은 저장소의 `.claude/tests/test_consistency_context_budget.py`는 동일한 문제를 프리앰블 레벨의 공용 `class ArgsFor` (해당 파일 51-60행 근방, `_PREAMBLE`의 `extra=` 인자)로 한 번만 정의해 재사용하는데, 이 파일은 그 패턴을 따르지 않고 매 테스트마다 손으로 반복한다. 이 코드는 `run_in_orchestrator`로 별도 인터프리터에 문자열로 실행되므로 IDE 리팩터링·타입체크의 도움을 받지 못해, 실제 `argparse.Namespace`에 새 모드 플래그가 추가될 때 4곳 중 일부만 갱신될 위험이 일반 코드보다 크다.
  - 제안: 이 파일의 `_PREAMBLE`(`_harness.orchestrator_preamble` 호출부)에도 `test_consistency_context_budget.py`의 `ArgsFor`와 동등한 공용 스텁을 `extra=`로 주입해 4곳의 인라인 정의를 제거한다.

- **[INFO]** 서사형(narrative) docstring 관행이 이 변경분 전반(특히 `git_probe.py`의 `_run_git_raw`, `_origin_default_branch_over_network`)에서 함수 본문 대비 매우 높은 비중을 차지한다(예: `_run_git_raw`는 코드 10줄에 docstring 35줄).
  - 위치: `.claude/_shared/git_probe.py:131`-`167` (`_run_git_raw`)
  - 상세: 이 저장소 전반의 확립된 컨벤션(이력·실측치를 남겨 재발을 막는 방식)과 일치하고, 실제로 이 파일 자체가 "docstring 없이 계약만 반복하다 drift 했다"는 문제를 겪은 이력이 있어 의도적 선택으로 보인다. 다만 첫 문장만으로 계약을 파악하기 어려운 경우가 있어(서사가 계약보다 먼저 나옴), 향후 함수를 스캔하는 새 기여자 입장에서는 첫 줄에 "무엇을 반환/실패시 무엇을 하는지"를 한 줄로 못박고 그 아래에 서사를 붙이는 편이 조금 더 빠르게 읽힌다는 점만 남겨둔다. 액션이 필요한 결함은 아니다.

## 요약

이번 diff(9개 파일, 순수 신규/확장)는 각 파일 내에서 개별 함수 단위로는 잘 읽히고, 이름·의도가 명확하며, 매직 넘버는 대부분 상수화되어 있고, 회귀를 촘촘히 고정하는 테스트가 함께 실려 있다. 다만 "동일 로직을 여러 곳에서 손으로 유지하다 drift"라는, 이 코드베이스 스스로가 여러 차례 겪고 명문화까지 한 실패 패턴이 이번 PR 안에서도 세 군데(orchestrator 의 tier 판정 이중 구현, git_probe 의 에러 처리 블록 복제, spec-links.ts 의 세 번째 디렉터리 순회 함수) 새로 발생했다. 모두 지금 당장 동작을 깨뜨리지는 않지만, 이 저장소의 기존 사고 이력을 볼 때 방치 시 실제 정합성 버그로 이어질 개연성이 있어 WARNING으로 분류했다. `collect_context`의 길이·중첩 클로저와 테스트 파일의 반복 스텁은 당장 위험하지는 않은 스타일 수준 이슈다.

## 위험도

MEDIUM
