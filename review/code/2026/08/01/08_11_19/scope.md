# 변경 범위(Scope) 리뷰 — round 8

> 방법론: 프롬프트 번들 중 4개 파일(`review_guard.py`/`guard_review_before_push.py`/
> `code_review_orchestrator.py`/`consistency_orchestrator.py`)이 크기 제한으로 생략돼 있어
> 전부 `Read`로 직접 열었다. 판단은 검사(inspection)가 아니라 실측으로 교차검증했다 —
> `git -C <repo> diff origin/main...HEAD`(파일별 개별 diff + `--numstat` + `git diff -w`
> 로 포맷팅 잡음 유무 수치 확인), `git show <commit>`으로 라운드별 커밋 각각의 diff,
> `git log -S`로 특정 import/코드 조각의 도입 커밋 특정. round 7의 scope.md
> (`review/code/2026/08/01/02_25_18/scope.md`)를 먼저 읽어 이전 판정과의 연속성을 확인한 뒤
> 독립적으로 재검증했다.

## 발견사항

- **[WARNING]** 3라운드 전 커밋이 남긴 죽은 주석(orphaned comment) — 삭제된 import 를 계속
  가리킨다.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:42-45`
    (주석 42-43줄, 그 아래 import 44-45줄 — `Read`로 직접 확인한 실제 소스 줄번호)
  - 상세: `b06982ec4`(3R, 커밋 메시지의 "[W2] consistency_orchestrator 의 미사용
    `_report_paths_lib` import 제거")가 `from _shared import report_paths as
    _report_paths_lib` 를 죽은 코드로 정확히 제거했다(로직이 `_shared/retry_state.py` 로
    위임됐으므로 타당한 삭제). 그런데 바로 위에 있던 설명 주석 — "Report location/validity is
    shared with the push/stop gate and the code-review orchestrator — see
    `.claude/_shared/report_paths.py`. One rule, three consumers." — 는 그대로 남아, 지금은
    `from _shared import block_integrity as _block_integrity` /
    `from _shared import retry_state as _retry_state_lib` 위에 얹혀 있다. 이 둘 중 어느 것도
    주석이 말하는 대상이 아니다. `git log -S"import block_integrity as _block_integrity"`로
    확인하면 그 import 자체는 더 이른 `a0dcebea2`(1R)에서 추가됐고, 3R 이 `report_paths` 줄만
    골라 지우면서 주석을 함께 정리하지 않았다 — 3R 커밋 메시지가 스스로 "리팩터가 무관한 근거
    주석을 삼킨 사고"를 고쳤다고 서술하는 바로 그 라운드에서, 반대 방향(주석이 삭제된 코드보다
    더 오래 살아남음) 결함이 생겼다. 이 파일이 실제로 `report_paths.py` 규칙을 계속 쓰는 경로는
    간접적이다 — `retry_state.reconcile_state_with_disk` 내부의 `_report_paths_lib.has_report`
    호출(`.claude/_shared/retry_state.py:109`)을 통해서다. 같은 패턴의
    `code_review_orchestrator.py:43-47` 주석은 그 아래 `_report_paths_lib` 가 `missing_reports`
    로 여전히 직접 쓰이고 있어(`code_review_orchestrator.py:262`) 정확하다 — 오염은
    `consistency_orchestrator.py` 사본에만 있다. 5개 라운드(3R~7R, 14명×5회) 동안 아무 리뷰어도
    잡지 못했다. 기능적 영향은 없다(순수 문서/가독성) — 실제 위임 상태를 설명하는 정확한 주석이
    바로 몇 줄 아래("State bookkeeping lives in `.claude/_shared/retry_state.py`…")에 이미
    있어 계속 읽는 독자는 바로잡히지만, 이 특정 블록만 읽으면 오도된다.
  - 제안: 주석을 삭제하거나 "`report_paths` 규칙은 이제 `retry_state.py` 를 통해 간접 소비된다"
    로 갱신. 최소 조치로는 그냥 삭제해도 무방 — 같은 정보를 아래쪽 주석이 이미 정확히 담고 있다.

- **[INFO]** 논리적으로 독립인 두 관심사(Critical 하향 금지 backstop + orchestrator 상태
  bookkeeping DRY 추출)가 한 브랜치에 계속 번들돼 있음 — round 7 자체 scope 리뷰에서 이미
  지적됐고 이번 라운드에도 그대로 유효, 새로운 문제는 아님.
  - 위치: `.claude/_shared/block_integrity.py:1-27` (모듈 docstring) /
    `.claude/_shared/retry_state.py:1-29` (모듈 docstring)
  - 상세: `30cc0f738`(feat: 하향 금지 backstop)와 `7b54b088a`(refactor: 상태 bookkeeping
    추출)는 기능적으로 독립이다 — `block_integrity.py` 는 `retry_state.py` 를 import 하지
    않는다. round 7 의 scope.md 가 이미 "제안: 조치 불필요"로 판정한 항목이며, 이번 라운드의
    round-7-fix 커밋(`5526fc8f8`)도 이 번들 구조에 아무것도 더하지 않았다(그 커밋이 건드린 6개
    파일 전부 CRITICAL 정규식 수정 또는 W10/W12/W13/W18/W19 개별 처분으로 정확히 대응). 커밋
    단위 분리(`feat`/`refactor`/`fix` 접두), 코드 내 상호 참조 주석(예:
    `block_integrity.py` 의 정규식 주석이 "the 'Change both' shape this branch is elsewhere
    removing"이라고 직접 언급), 그리고 이관되지 않은 부분(merge_coordinator 의 self-healing
    미이식)의 명시적 후속 등재로 투명하게 관리된다.
  - 제안: 조치 불필요. 향후 이 작업 계열을 별도 PR 로 쪼갤 계획이면 backstop 기능과 상태
    bookkeeping 리팩터를 분리하는 편이 리뷰 인지 부하를 줄인다.

- **[INFO]** 함수 재배치로 생긴 공백 줄 2줄 — round 7에서 이미 지적, 변화 없음(연속성 확인
  목적으로만 재기재).
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:302-303`
    (`def _routing_distrust_reason` 바로 위, `Read`로 직접 확인)
  - 상세: `_apply_status_update` 본문이 `_shared/retry_state.py` 로 위임되며 파일 앞쪽으로
    재배치됐고, 그 결과 `_routing_distrust_reason` 앞 공백 줄이 1→2줄이 됐다. 실질 로직
    변경과 섞여 있지 않고 리뷰를 방해하지 않는다.
  - 제안: 조치 불필요.

## 확인했지만 문제 없음 (참고)

- **브랜치 전체 diff 범위**: `git diff --stat origin/main...HEAD -- . ':!review/**'` 결과가
  리뷰 대상 17개 파일과 정확히 일치하며 그 외 파일은 없다 — `.claude/settings.json`,
  `.claude.project.json` 등 설정 파일 변경 없음.
- **포맷팅 잡음 없음**: 같은 범위에 대해 `git diff`와 `git diff -w`(공백 무시)의 출력 줄 수가
  2328줄로 동일 — 실질 변경에 섞인 공백/줄바꿈 전용 diff가 없다는 뜻.
- **이번 라운드 델타(`5526fc8f8`, 7R 반영 커밋) 정밀 검증**: 건드린 6개 코드/문서 파일
  (`block_integrity.py`, `guard_review_before_push.py`, `consistency_orchestrator.py`,
  `merge_coordinator_orchestrator.py`, `test_block_integrity.py`, plan 문서) 각각의 diff를
  개별 확인 — 모든 hunk가 커밋 메시지가 명명한 항목(CRITICAL 정규식, W19, W12, W10, W18,
  W13) 중 정확히 하나에 1:1 대응한다. 임의 리팩터·불필요한 주석·미사용 import 추가 없음.
- **import 사용처 전수 확인**: `review_guard.py`/`consistency_orchestrator.py`/
  `code_review_orchestrator.py` 에 새로 추가된 `_block_integrity`/`_retry_state_lib` import
  는 전부 실제로 쓰인다(각각 `summary_block_verdict`/`contradiction_note`,
  `ALL_CHECKERS`/`load_state` 등, `load_state`/`save_state`/`reconcile_state_with_disk`/
  `apply_status_update`/`emit_summary_state`). `merge_coordinator_orchestrator.py` 의
  `_retry_state_lib` 도 세 위임 함수에서 사용 확인.
- **`review/code/2026/08/01/02_25_18/**` 세션 산출물**: 이번 커밋에 함께 커밋됐지만, 이
  저장소는 `review/**` 를 gitignore 하지 않고 라운드별 세션을 커밋하는 것이 확립된
  컨벤션이다(round 7 scope.md 도 동일 결론) — 무관 파일 혼입이 아니다.
  `review/code/2026/08/01/02_25_18/RESOLUTION.md` 를 직접 읽어 그 서술(CRITICAL 1건 +
  W19/W12/W10/W18/W13)이 실제 코드 diff와 정확히 일치함을 확인했다.
- **plan 문서 변경(90줄)**: 전문을 다시 대조 — `worktree:` 필드 갱신, 팔로우업 #9~#12 신설,
  §관측(1)/(2) 2026-08-01 실측 갱신, §결정 섹션 갱신 등 전부 이 브랜치 자신의 티켓
  (`harness-review-gate-ci-backstop`) 본문이며 무관한 계획 항목의 유입은 없다.

## 요약

전체 범위 통제는 매우 엄격하다. 브랜치 전체(12커밋, `origin/main` 대비)의 diff는 정확히
리뷰 대상 17개 파일(+ 컨벤션에 따라 커밋되는 `review/**` 세션 산출물)에 국한되고, 설정 파일
변경·포맷팅 전용 diff·미사용 import 는 발견되지 않았다. 이번 라운드가 새로 반영한 델타(7R
발견 반영 커밋 `5526fc8f8`)는 특히 정밀하다 — CRITICAL 정규식 수정과 W10/W12/W13/W18/W19
다섯 건 전부가 각자 정확히 대응하는 코드 hunk 하나씩으로만 구현되어 있고, 곁다리 리팩터나
무관한 정리는 전혀 없다. 유일하게 새로 찾은 실질 항목은 3라운드 전 죽은 import 제거가 그
위의 설명 주석을 갱신하지 못하고 남긴 것으로, 기능에는 영향이 없으나 5개 라운드 동안
발견되지 않은 문서 정확성 결함이다. round 7 자체 scope 리뷰가 이미 짚은 두 INFO 항목(관심사
번들링, 공백 줄 2개)은 이번 라운드에도 변화 없이 유효하며 투명하게 관리되고 있어 조치가
필요하지 않다.

## 위험도

LOW
