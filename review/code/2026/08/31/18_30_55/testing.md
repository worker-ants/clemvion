# 테스트(Testing) 리뷰

## 검증 방법

정적 분석 외에 실제로 실행/뮤테이션했다 (전부 원복 확인, `git status --short` 로 잔여물 없음 확인):

- `.claude/tests/test_consistency_scope_census.py` — `python3 -m unittest`: **12/12 PASS**.
- 위 스위트 대상 `_scope_delta_census` 의 scope-prefix 필터를 `r.startswith(prefix)` → `scope_rel in r`
  로 뮤테이션 → `test_prefix_does_not_leak_to_sibling_directory` 가 **정확히** RED (원복 완료, `cp` 사용).
- `codebase/backend/.../workflow-assistant.controller.swagger.spec.ts` — `npx jest`: **2/2 PASS**.
- 위 스위트 대상 `list()` 라우트의 `@ApiUnauthorizedResponse` 데코레이터를 제거 → 두 번째 `it` 가
  정확히 RED(누락된 라우트 id 를 리포트). 원복 후 재실행 GREEN 확인 (`cp` 사용, `git checkout` 미사용).

## 발견사항

- **[WARNING]** `_scope_delta_census` 의 scope-hits 20개 초과 시 "... 외 N건" 절단 분기가 테스트 커버리지 밖
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:525-528` (`shown = "".join(... scope_hits[:20])` / `more = f"... 외 {len(scope_hits) - 20}건\n" if len(scope_hits) > 20 else ""`)
  - 상세: `.claude/tests/test_consistency_scope_census.py` 의 `ScopeDeltaCensus` 테스트들은 전부 scope 매치가 0~1개인 fixture 만 사용한다 (`test_scope_hits_are_listed_by_path` 등, 파일 98-105). `scope_hits` 가 21개 이상일 때의 슬라이스(`[:20]`)와 `len(scope_hits) - 20` 오프셋 계산은 어떤 테스트도 실행하지 않는다. 이 함수는 `--impl-done` 이 넓은 scope(예: `spec/5-system/`)에 대해 큰 diff 를 다룰 때 실사용 경로이므로(같은 plan 문서가 `spec/5-system/`=18개 파일 케이스를 여러 차례 실측 사례로 들고 있다), 21개 이상 변경 파일이 드문 입력이 아니다. `- 20` 오프셋이 `- 19`/`- 21` 등으로 깨지거나 `[:20]` 이 `[:19]` 로 깨져도 현재 스위트는 GREEN 이다.
  - 제안: `scope_hits` 21~25개 정도의 fixture 로 `"... 외 N건"` 문구의 정확한 N 값과 20개까지만 개별 경로가 나열되는 것을 단언하는 케이스 추가.

- **[INFO]** `diff_lines`(변경 줄 수) 값이 어떤 테스트에서도 검증되지 않음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:522` (`diff_lines = diff_text.count("\n") if diff_text.strip() else 0`)
  - 상세: `test_present_diff_warns_that_absence_below_means_truncation` (test 파일 124-128행)은 `"1개 파일"` 과 `"예산에 잘렸다"` 문구만 확인하고 `{diff_lines}줄` 부분(diff_line 문자열의 `f"- **구현 diff: {diff_files}개 파일 / {diff_lines}줄**"`)의 실제 숫자는 단언하지 않는다. 표시용 부가 정보이고 판정 로직에 영향을 주지 않아 CRITICAL 은 아니지만, `ONE_FILE_DIFF` 가 몇 줄인지 알고 있는 fixture이므로 값 하나 추가하는 비용이 낮다.
  - 제안: `assertIn(f"{ONE_FILE_DIFF.count(chr(10))}줄", out)` 형태로 한 줄 추가.

- **[INFO]** `CensusIsWiredIntoImplDone` 의 배선 테스트는 두 substring 존재만 확인 — impl_done 분기 "안"에서 호출되는지는 검증하지 않음(자체 docstring 이 이미 인지하고 있는 한계)
  - 위치: `.claude/tests/test_consistency_scope_census.py:136-157` (`test_collect_context_calls_the_census`)
  - 상세: `'_scope_delta_census(' in src` 와 `'args.impl_done' in src` 를 독립적으로 체크한다. `_scope_delta_census(...)` 호출을 `impl_done` 분기 밖(예: `elif args.impl_prep:` 블록)으로 옮기면서 원래 자리에서만 지워도 두 substring 모두 여전히 소스에 존재하므로 이 테스트는 GREEN 을 유지한다. 테스트 자체 docstring 이 "Source inspection is coarse, but it is the axis those cases cannot reach" 라고 명시적으로 한계를 인정하고 있어 새로 발견한 결함은 아니지만, 실제 실행 경로 검증(예: `run()` 으로 `--impl-done` 전체를 얕게 흘려 census 헤더가 출력에 나타나는지 정규식으로 검사)이 더 강한 보증이 될 수 있다는 점은 남겨 둔다.
  - 제안: 우선순위 낮음(현재 방식이 이미 "헬퍼 테스트 ≠ 호출부 테스트" 결함을 잡는 axis 로는 충분히 기능함을 뮤테이션으로 확인). 리소스가 있을 때 `--impl-done` end-to-end 스모크로 승격 고려.

## 요약

`_scope_delta_census`/`_count_diff_files` (파일 1) 는 `test_consistency_scope_census.py` (파일 2) 로 12개 케이스 전량 커버되며, 실제로 재실행(12/12 GREEN)·뮤테이션(scope-prefix 누출을 정확히 RED로 검출)까지 확인했다. 각 assertion 이 "주어를 명시"하도록 설계돼(`scope(...) 델타: N개 파일`) 형제 라인(diff 줄)과의 문자열 충돌을 피한 점, 배선(호출부) 테스트를 별도 axis 로 분리한 점, `truncate_file_bundle` 로 본문을 통째로 날리는 예산에서도 census 가 생존하는지까지 확인하는 `CensusSurvivesTruncation` 테스트는 이 변경의 핵심 목적(예산 절단 vs 부재 구분)을 정확히 겨냥한다. 유일한 실질 갭은 `scope_hits` 20개 초과 시의 절단 메시지(WARNING) — 실사용 시나리오(`spec/5-system/` 같은 대형 scope)에서 발생 가능한 입력인데도 fixture 가 전부 0~1건 규모라 회귀 감지가 안 된다. `diff_lines` 값 미검증은 표시용 정보라 영향이 작다(INFO). workflow-assistant 컨트롤러 변경(파일 6·7)은 새 swagger 스펙 테스트로 완전히 커버되며, 공허 방지 전제 테스트(`toHaveLength(7)`)와 실제 뮤테이션 검증(데코레이터 1개 제거 → 정확히 RED) 모두 확인했다. chat-channel 세 파일(3·4·5)은 주석의 line-number 참조만 제거한 순수 문서 정정으로 테스트 영향 없음을 `git diff` 로 직접 확인했다. 전체적으로 테스트 설계 품질이 이 저장소의 일반적인 높은 기준(뮤테이션 근거·주어 명시·서브프로세스 격리)에 부합한다.

## 위험도

LOW
