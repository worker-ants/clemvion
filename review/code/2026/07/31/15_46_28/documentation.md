STATUS=success ISSUES=4

# Documentation Review — harness 번들링 3커밋 (natural sort · `_charge_notice` · sentinel splitter)

## 발견사항

- **[WARNING]** plan 상단 배너가 같은 커밋이 갱신한 체크리스트와 자기모순 + 삭제된 테스트명 참조
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:12-17` (상단 배너) vs `:105` (체크리스트, 이 리뷰 대상 커밋에서 `[x]`로 갱신)
  - 상세: 배너는 "**완전히 닫힌 것은 아니다** — 같은 tier 안의 정렬은 여전히 순수 사전순이라(`test_ties_stay_alphabetical` 이 현재 동작으로 고정) … 아래 체크리스트의 natural sort 항목은 **여전히 열린 후속**이다"(gate 14/15/17) 라고 명시한다. 그런데 이번 리뷰 대상 커밋(`0b99b3757`)이 정확히 `_natural_key` 를 도입해 그 tie-break 를 구현했고, 같은 파일의 체크리스트 항목(gate 105, "natural sort 로 교체 ✅ 2026-07-31")을 `[x]`로 갱신했다. 배너가 이름으로 지목한 `test_ties_stay_alphabetical` 도 바로 이 커밋에서 `test_ties_use_natural_order_not_lexicographic`(반대 단언)로 교체돼 이제 코드베이스에 존재하지 않는다(`grep` 로 확인: `.claude/tests/test_consistency_bundle_priority.py`엔 새 이름만 남아 있음). 결과적으로 같은 파일 안에서 "상단 요약"과 "체크리스트 본문"이 서로 반대 사실을 말하는 상태가 됐다. 더 나쁜 건 이 배너 위치(원 커밋 `296d3a232`, 이미 origin/main 에 병합됨)가 직전 리뷰 라운드(`review/code/2026/07/31/11_58_11` WARNING #2, "배너: …:9-23(특히 12행) vs 미체크 항목")가 정확히 지목했던 자리라는 점이다 — 그때는 "배너가 코드를 앞서갔다"는 지적이었는데, 이번엔 코드가 배너를 따라잡았는데도 배너 자체는 갱신하지 않아 반대 방향으로 다시 어긋났다. 같은 결함 클래스(배너-체크리스트 drift)가 형태만 바뀌어 재발한 셈이다.
  - 제안: 배너 문단(gate 13-17)을 "tier 내부 tie-break 는 2026-07-31 `_natural_key` 도입으로 구현 완료"로 정정하고, `test_ties_stay_alphabetical` 참조를 제거하거나 `test_ties_use_natural_order_not_lexicographic` 로 교체할 것.

- **[WARNING]** 리팩터 커밋이 남긴 3줄 분량 중복 인라인 주석
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:739-745` (`build_files_section` 내부, `_notice_text`/`_charge_notice` 사용 분기)
  - 상세: 739-742행("… has to come out of `available` too — `truncate_to_line_boundary` only bounds the text it returns. Budget for the widest form of the note (kept == total gives the most digits).")과 바로 다음 743-745행("Budget for the widest form of the note (kept == total gives the most digits) — `truncate_to_line_boundary` bounds only the text it returns, not what gets appended to it.")이 동일한 내용을 문장만 바꿔 두 번 반복한다. `git diff origin/main...HEAD`(커밋 `ad9701b3e`, "안내문 예산 계상을 `_charge_notice` 하나로")로 확인: 새 3줄이 옛 3줄 **뒤에 추가**되고 옛 줄은 지워지지 않은 편집 잔재다. 이 커밋 자체가 "네 지점의 예산 계상을 하나로 모아 산발적 설명을 줄인다"는 취지였던 만큼, 같은 자리에 설명이 두 벌 남은 건 그 취지와 어긋난다.
  - 제안: 두 블록 중 하나를 삭제(내용이 완전히 동일하므로 어느 쪽을 남겨도 무방 — 더 뒤에 추가된 743-745 유지 + 739-742 삭제를 권장).

- **[WARNING]** 테스트 모듈 docstring 이 같은 커밋이 고친 동작을 여전히 옛 방식으로 서술
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:7-9` (모듈 최상단 docstring)
  - 상세: "`collect_markdown_files` returns plain alphabetical order and `truncate_file_bundle` drops from the tail, so for `spec/5-system/` the budget went to `1-auth.md` / `10-graph-rag.md` / `11-mcp-client.md` while `4-execution-engine.md` … fell off the end" 라고 현재시제(`returns`/`drops`)로 단언한다. 그런데 바로 이 리뷰 대상 커밋이 `collect_markdown_files`(`consistency_orchestrator.py`)를 `files.sort(key=_natural_key)`로 바꿔, 더 이상 "plain alphabetical order"를 반환하지 않는다 — 같은 테스트 파일 안의 신규 테스트 `test_ties_use_natural_order_not_lexicographic`(:183)가 정확히 그 반대(자연정렬 시 `1-auth → 4-execution-engine → 10-graph-rag → 11-mcp-client` 순서)를 단언한다. 즉 파일 맨 위 요약과 파일 맨 아래 새 테스트가 서로 다른 사실을 말한다. (위 첫 번째 발견사항과 같은 근본 원인 — natural sort 를 알리는 산문 3곳 중 plan 체크리스트 1곳만 갱신되고 나머지는 남았다.)
  - 제안: "returns plain alphabetical order"를 "used to return plain alphabetical order (tie-break is now natural sort via `_natural_key`)"처럼 과거형으로 정정하거나, 이 문단을 "tier 0/1 이 모두 비는 세션에서도 같은 tier 내부는 이제 natural sort" 식으로 현재 동작에 맞게 다시 서술할 것.

- **[INFO]** `.claude/tests/README.md` 의 해당 테스트 요약이 이번에 추가된 보장을 언급하지 않음 (이번 diff 범위 밖의 후속)
  - 위치: `.claude/tests/README.md:57` (`test_consistency_bundle_priority.py` 행 — 이번 리뷰 대상 5개 파일에는 포함되지 않음)
  - 상세: 이 행은 "Pins the four tiers …, that reordering never drops or invents a file, and that `collect_context` **uses** the result …"까지만 나열하고, 이번 커밋이 새로 고정한 속성("tier 내부 tie-break 는 natural order")은 목록에 없다. 이 파일은 diff 대상이 아니라 CRITICAL/WARNING 은 아니지만, "이 테스트가 무엇을 보장하는지"를 요약하는 목적의 문서라 새 보장이 빠진 채 남는다.
  - 제안: 여유 있을 때 "…and that ties within a tier resolve by natural, not lexicographic, order" 를 추가.

## 점검하고 결함 없음을 확인한 항목 (참고)

- **CHANGELOG.md**: 갱신 불필요 — 이 저장소의 확립된 관례를 실측 확인(`fix(harness)`/`refactor(harness)`/`docs(harness)` 커밋 19건 전수 조사 결과 단 한 건도 `CHANGELOG.md` 를 건드리지 않음). `CHANGELOG.md` 는 `codebase/` 제품 변경 전용이고 이번 변경은 `.claude/` 하네스 내부 도구다.
- **설정 문서(env var)**: 이번 diff 는 `os.environ`/`getenv` 호출을 추가·변경하지 않음(신규 env var 없음). `REVIEW_MAX_FILE_SIZE`(55,296)/`REVIEW_MAX_PROMPT_SIZE`(141,557) 등 기존 상수는 이 diff 밖이고, `code-review-agents/SKILL.md:195-196` 의 문서화된 값과도 정확히 일치함을 확인.
- **`--diff-base` 스코프 문서**: 직전 리뷰 라운드 WARNING #4(CLI help 가 `--impl-done` 전용으로만 서술)는 이미 이 diff 이전에 해소되어 있음을 확인(`consistency_orchestrator.py` 의 `--diff-base` help 텍스트가 "Used by --impl-done … and by ALL modes to rank the context bundles" 로 이미 정확함, 그리고 `consistency-checker/SKILL.md:52` 도 동일 내용 반영) — 재확인만, 새 결함 아님.
- **신규 함수 docstring**: `_natural_key`, `_charge_notice` 등 이번 diff 가 신설한 공개/준공개 함수는 모두 근거·실측치를 포함한 docstring 을 갖춤. `ContentCannotForgeAFileBoundaryTest` 클래스 docstring 은 "제거된 세 번째 테스트"의 제거 사유까지 남겨 모범적임.
- **테스트 개수 인용**: plan 문서가 인용한 "`test_consistency_bundle_priority.py` 18건"(gate 156)을 실제 `def test_` 개수로 직접 세어 확인 — 정확히 18건 일치. 직전 라운드가 지적했던 "테스트 개수 drift"(WARNING #3)는 표현을 "라운드마다 증가 — 정확한 수는 파일이 SoT" 로 완화해 재발 구조 자체를 해소함.

## 요약

세 커밋(natural sort tie-break, 예산 계상 `_charge_notice` 통합, sentinel 기반 파일 경계)은 개별적으로는 이 코드베이스의 평소 기준에 비춰도 매우 높은 밀도의 근거·실측치 포함 docstring/주석을 갖추고 있고, 신규 함수는 전부 적절히 문서화되었으며 CHANGELOG·env var·API 문서는 실제로 갱신 대상이 아님을 확인했다(모두 실측으로 확인, 억측 아님). 다만 "natural sort 를 실제로 구현"한 이번 변경이 그 사실을 알려야 할 산문 3곳(plan 배너, plan 체크리스트, 테스트 모듈 docstring) 중 정확히 체크리스트 1곳만 갱신하고 나머지 둘은 옛 상태를 현재형으로 서술한 채 남겨, 같은 파일 안에서 자기모순이 두 군데 생겼다 — 그중 plan 배너 쪽은 직전 리뷰 라운드가 이미 한 번 지적했던 정확히 그 자리가 반대 방향으로 다시 어긋난 것이라 재발 패턴이 있다. 별도로 리팩터 커밋이 남긴 3줄 중복 인라인 주석도 발견했다. 네 건 모두 위치가 명확하고 한두 줄 수정으로 닫히는 저비용 결함이다.

## 위험도

MEDIUM
