# 변경 범위(Scope) 리뷰

## 검토 방법

리뷰 대상은 `origin/main` 대비 이 브랜치의 커밋 2개다:

- `30cc0f738` — `feat(harness)`: Critical 하향 금지 정책에 기계적 backstop (`.claude/_shared/block_integrity.py` 신설 + `.claude/hooks/_lib/review_guard.py` 배선 + 테스트)
- `7b54b088a` — `refactor(harness)`: 상태 bookkeeping 5종을 `.claude/_shared/retry_state.py` 로 추출 (`code_review_orchestrator.py`/`consistency_orchestrator.py` 양쪽에서 delegate 로 교체 + 테스트)

각 커밋의 `git diff origin/main...HEAD` 전체를 직접 대조했고, 이 워크트리(`harness-block-backstop-b56163`)와 관련된 `plan/in-progress/*.md`(`harness-review-gate-ci-backstop.md`, `harness-consistency-summary-downgrade-rule.md`)를 함께 확인해 "의도된 범위"의 근거로 삼았다.

## 발견사항

- **[WARNING]** 서로 무관한 두 작업(신규 backstop 기능 + orchestrator 상태 bookkeeping DRY 리팩토링)이 한 브랜치에 함께 묶여 있고, 후자는 이 task 의 백로그 근거 문서 어디에도 등재돼 있지 않다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:48`(신규 import), `:189-206`(`_load_state`/`_save_state`/`_reconcile_state_with_disk`/`_apply_status_update`/`_emit_summary_state` delegate 5종) / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:45`(신규 import), `:93-110`(동일 delegate 5종) / 신규 파일 `.claude/_shared/retry_state.py` 전체
  - 상세:
    - 워크트리 이름(`harness-block-backstop-b56163`)과 `plan/in-progress/harness-review-gate-ci-backstop.md` 의 명시적 backlog 항목 2번("하향 금지 정책에 기계적 backstop 이 없다 … 후보: orchestrator 가 checker 리포트의 `[CRITICAL]` 수를 세어 최종 `BLOCK:` 와 모순되면 stderr 경고")은 커밋 `30cc0f738` 하나만을 가리킨다. 이 커밋은 `block_integrity.py`(신규 100줄) + `review_guard.py` 배선(13줄) + 전용 테스트로, 딱 그 backlog 항목의 범위에 정확히 대응한다 — 여기까지는 범위 이탈이 없다.
    - 반면 커밋 `7b54b088a`(리팩토링, 294줄 순변경)는 이 두 plan 문서 어디에도, 그리고 `plan/in-progress/` 전체를 뒤져도 대응하는 항목이 없다. 오히려 같은 `harness-review-gate-ci-backstop.md` 의 항목 6("git 브랜치-diff 헬퍼가 두 orchestrator 에 중복")과 항목 9("fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제")는 **성격이 거의 동일한 orchestrator-간 중복 문제**인데도 명시적으로 defer(보류) 처리돼 있다. 즉 같은 종류의 "두 orchestrator 중복 제거"라는 저울질에서, retry_state 쪽만 이번 세션에 즉시 실행되고 나머지 둘은 보류된 셈이라 선택 기준이 이 리뷰 범위 안에서는 드러나지 않는다.
    - 이 리팩토링은 backstop 기능(1)이 전혀 필요로 하지 않는 파일들(`code_review_orchestrator.py` 155줄, `consistency_orchestrator.py` 111줄)을 건드린다 — `block_integrity.py`/`review_guard.py` 배선 쪽에서 이 두 orchestrator 파일을 참조하는 지점은 없다(각 커밋의 `git diff --stat` 이 완전히 분리된 파일 집합을 보인다).
    - 이 저장소는 사소한 항목(정렬 알고리즘 tie-break, 예산 계산 1건 등)까지도 `plan/in-progress/**` 에 실측 근거와 함께 기록하는 관행이 매우 엄격하게 지켜지고 있다(두 plan 문서 자체가 그 증거). 294줄·2파일 규모의 리팩토링에 그 흔적이 전혀 없다는 것은, 이 변경이 "이 세션에 원래 요청된 작업"이 아니라 작업 도중 발견해 추가로 처리한 항목일 가능성을 시사한다.
  - 제안: 리팩토링 자체의 근거(AST 비교로 5개 중 4개 동일 실측, `_shared/report_paths.py` 추출 선례, 자체 회귀 테스트 4건)는 탄탄하고 별도 커밋·별도 테스트 파일로 깔끔히 분리돼 있어 **품질 문제는 아니다.** 다만 이 task 이름이 가리키는 범위(backstop) 밖이므로: (a) 별도 브랜치/PR 로 분리하거나, (b) 이미 이번 푸시에 포함하기로 했다면 최소한 `plan/in-progress/` 에 "왜 이번 세션에 함께 처리했는지"를 한 줄이라도 남겨 이 저장소 자체의 "모든 실질 변경은 plan 에 추적된다" 관행과 정합시킬 것을 권장한다.

- **[INFO]** 두 커밋 각각의 내부 범위는 순수하다.
  - 상세: `30cc0f738`(backstop) 은 `block_integrity.py`/`review_guard.py`/테스트/README 카탈로그 행 추가만으로 완결되고, 백로그 항목이 제안한 구현("checker 리포트의 `[CRITICAL]` 개수를 세어 `BLOCK:` 과 모순되면 경고")을 그대로, 그 이상도 이하도 아니게 구현했다 — CLI 플래그·설정 옵션·차단(exit) 동작 등 요청되지 않은 확장이 없다. `7b54b088a`(리팩토링) 도 순수 delegate 치환이고, 두 orchestrator 에서 이제 쓰이지 않게 된 `datetime`/`json` import 를 확인했으나 둘 다 파일 내 다른 위치(`code_review_orchestrator.py:1073`/`:1070`, `consistency_orchestrator.py:821`/`:818`)에서 여전히 쓰이고 있어 죽은 import 가 남지 않았다. 포맷팅-only 변경이나 무관한 주석·설정 변경은 발견되지 않았다.
  - 위치: 해당 없음(문제 없음의 확인)
  - 제안: 없음

## 요약

브랜치는 두 커밋으로 구성되며, 첫 번째(Critical 하향 금지 기계적 backstop)는 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 2와 정확히 대응하는, 범위 안의 작업이다. 두 번째(orchestrator 상태 bookkeeping 5종의 `_shared/retry_state.py` 추출)는 코드 품질 자체는 우수하고 별도 커밋·테스트로 격리돼 있지만, 이 task 의 이름·plan 근거가 가리키는 범위 밖의 무관한 리팩토링이며 대응하는 backlog/plan 문서가 없다. 그 외에는 포맷팅 뒤섞임, 죽은 import, 설정 변경, 불필요한 주석 등 전형적인 스코프 이탈 징후가 없어 각 커밋 내부의 순도는 높다.

## 위험도

LOW
