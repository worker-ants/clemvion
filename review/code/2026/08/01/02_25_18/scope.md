# 변경 범위(Scope) 리뷰 — round 7

> 컨텍스트: 6R changeset 이 `--branch` 가 `--files` 를 조용히 덮어써 review 산출물 44개만 담고
> 소스 0개였던 결함(plan §후속 11)이 있어, 이번 7R 이 이 소스에 대한 사실상 첫 정식 리뷰다.
> 프롬프트 번들은 3개 파일(`review_guard.py`/`guard_review_before_push.py`/
> `code_review_orchestrator.py`)이 크기 제한으로 생략돼 있어 전부 `Read` 로 직접 열었고,
> `test_block_integrity.py` 도 116/600줄만 실려 전체를 다시 읽었다. 판단은 `git diff
> origin/main...HEAD`(파일별 개별 diff 포함)로 교차검증했다.

## 발견사항

- **[INFO]** 서로 다른 두 관심사(Critical 하향 금지 기계적 backstop + orchestrator 상태
  bookkeeping 5종 DRY 추출)가 한 브랜치에 번들돼 있다.
  - 위치: `.claude/_shared/block_integrity.py:100-101` (`summary_block_verdict` docstring)
  - 상세: `30cc0f738`(feat: Critical 하향 금지 backstop)과 `7b54b088a`(refactor: 상태
    bookkeeping을 `_shared/retry_state.py` 로 추출)는 서로 기능적으로 독립이다 —
    `block_integrity.py` 는 `retry_state.py` 를 import 하지 않는다. 다만 번들 자체는
    **투명하게 공개**돼 있다: `block_integrity.py` 코드 주석이 "Two copies of a `BLOCK:`
    regex is the 'Change both' shape this branch is elsewhere removing" 라고 직접
    교차 언급하고, 두 관심사가 커밋 단위로 분리돼 있으며(`feat(harness): ...` vs
    `refactor(harness): ...`), 이후 커밋들(`e364b4159`, `a0dcebea2` 등)도 각 관심사를
    라벨링해 서술한다. `merge_coordinator_orchestrator.py` 로의 추출 확장(1R 피드백 반영,
    `a0dcebea2`)도 동일 patrún — 동일 함수만 위임하고 행동 변화(자기치유 도입)는
    "다른 skill 의 동작 변경이라 별도 PR 로 분리한다" 고 명시적으로 후속 등재했다
    (`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-112`).
  - 제안: 조치 불필요. 향후 PR 분리 시 "기계적 backstop" 과 "상태 bookkeeping DRY" 를
    별도 PR 로 쪼개는 편이 리뷰어 인지 부하를 줄이겠지만, 이번 경우처럼 교차 참조 주석 +
    별도 커밋 + 후속 항목의 명시적 defer 로 투명하게 관리되면 통합해도 무방하다.

- **[INFO]** 함수 재배치 과정에서 생긴 공백 줄 2줄 추가(실질 변경과 무관).
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:302-303`
  - 상세: `_apply_status_update` 본문이 `_shared/retry_state.py` 로 위임되면서 그 정의가
    파일 하단에서 상단으로 옮겨졌고, 그 결과 `_routing_distrust_reason` 앞에 빈 줄이
    1줄→2줄로 바뀌었다(PEP8 스타일 정합화). 실질 로직 변경과 섞여 있지 않고 별도로도
    식별 가능해 리뷰를 방해하지 않는다.
  - 제안: 조치 불필요. 언급은 완전성을 위한 것.

## 확인했지만 문제 없음 (참고)

- `review/code/2026/07/31/**` ~ `2026/08/01/01_49_32/**` 산출물이 diff 에 포함돼 있으나,
  이 저장소는 `review/**` 를 gitignore 하지 않고(§CI 백스톱 티켓 자체가 2026-08-01 실측으로
  확인) 각 라운드 세션을 커밋하는 것이 확립된 컨벤션이다 — 무관한 파일 혼입이 아니다.
- `plan/in-progress/harness-review-gate-ci-backstop.md` 의 "## 관측 — ... 2건(2026-07-27,
  실측)" 절과 in-flight 스코프 수정 서술은 **이 브랜치 이전에 이미 병합된 `296d3a232`(#1037)
  의 산출물**이며(`git merge-base origin/main HEAD` 가 그 커밋을 이미 포함), 이 브랜치는
  그 절을 수정 없이 그대로 승계한다(`git diff` 로 해당 구간 무변경 확인) — plan 문서가 다른
  세션의 작업을 자기 것으로 잘못 주장하는 사고는 아니다. 실제로 이 브랜치가 새로 추가한 항목은
  `worktree:` 필드 갱신, §후속 9~12번, §관측(2) 아래 "재발 관측 8번째", §결정 섹션의
  2026-08-01 실측 갱신, 그리고 §후속 11(`--branch`가 `--files`를 덮어쓰는 결함, 신규 발견)이며
  전부 diff 에 `+` 로 정확히 나타난다.
- `code_review_orchestrator.py` / `consistency_orchestrator.py` / `merge_coordinator_
  orchestrator.py` 의 `json`/`datetime` import 는 위임 후에도 각 파일의 `prepare_session`
  등에서 계속 쓰이고 있어 dead import 가 아니다. `consistency_orchestrator.py` 에서
  `_report_paths_lib` import 는 위임으로 실제 미사용이 됐고 정확히 제거돼 있다(잔존 dead
  import 없음).
- `.claude/settings.json`, `.claude.project.json` 등 설정 파일은 변경분에 없다
  (`git diff origin/main...HEAD --stat -- .claude/` 로 확인 — 리뷰 대상 17개 파일 중
  `.claude/` 하위 16개와 정확히 일치, 그 외 없음).
- 3R 커밋(`b06982ec4`)이 스스로 밝히듯, 이전 라운드의 정규식 기반 상태 추출 스크립트가
  함수 사이 모듈-레벨 주석(라우터 신뢰 근거 27줄 등)을 실수로 삼켰던 사고가 있었으나
  같은 브랜치 안에서 원본 그대로 복원되어 `origin/main` 대비 순변경 없음 — 현재 diff 에는
  잔존하지 않는다.

## 요약

전체적으로 범위 통제가 상당히 엄격하다. `git diff origin/main...HEAD` 로 재확인한 결과 코드
변경분은 정확히 리뷰 대상 17개 파일(그리고 `review/**` 세션 산출물)에 국한되며, 각 파일의
변경분은 (1) Critical 하향 금지 규약의 기계적 backstop, (2) 두 orchestrator 가 "Change both"
주석으로 손 동기화하던 상태 bookkeeping 5종의 `_shared/retry_state.py` 추출(제3 소비자
`merge_coordinator_orchestrator.py` 로의 부분 확장 포함), (3) 이 두 기능을 6개 라운드에 걸쳐
리뷰가 지적한 결함(advisory 스트림 처리, 스로틀 키잉, 테스트 스텁 결함 등)에 대한 최소 폭의
수정 커밋들로 명확히 분해된다. 요청 범위를 벗어난 기능 확장, 무관한 파일 수정, 실질 변경에
묻힌 포맷팅/주석/임포트 잡음, 의도치 않은 설정 변경은 발견되지 않았다. 유일하게 지적할 만한
점은 두 개의 논리적으로 분리 가능한 관심사(backstop 기능 / 상태 bookkeeping DRY 리팩터)가 한
브랜치에 번들돼 있다는 것인데, 이는 코드 자체의 교차 참조 주석과 커밋 단위 분리로 투명하게
공개돼 있어 실질적 문제로 보기 어렵다. `merge_coordinator_orchestrator.py` 로의 확장은 오히려
모범적으로 스코프를 관리한 사례로 — 동일 코드만 위임하고 행동 변화(자기치유 도입)는 명시적으로
별도 PR 로 미뤘다.

## 위험도

LOW
