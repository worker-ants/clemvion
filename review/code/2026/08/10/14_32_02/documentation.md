# 문서화(Documentation) 리뷰

지시에 따라 diff 파일(1~8번, ai-review 배치-분할 제거 커밋)뿐 아니라 저장소 전체를
"batch"·"분할"·"마지막 줄" 축으로 grep 하고 관련 소스를 `Read` 로 직접 대조했다 —
직전 라운드가 "이번 변경이 닫은 결함을 문서가 아직 열려 있다고 서술한다" 를 WARNING 으로
잡고 정정한 것과 같은 클래스가 그 두 파일 밖에 더 있는지 확인하기 위해서다.

## 발견사항

- **[WARNING]** `lib/session.py` 의 두 docstring 이 "배치 분할" 을 지금도 일어날 수 있는
  일로 서술한다 — 이번 changeset 이 배치 분할 자체를 없앴는데도
  - 위치: `.claude/skills/code-review-agents/lib/session.py:7-10` (`_MAX_SESSION_NAME_ATTEMPTS`
    바로 위 주석: `a batch split produces 2 names and a burst of parallel sessions a handful
    more`), `:38-41` (`create_session_dir` docstring: `` `--prepare` on a 74-file changeset
    splits it into two batches and prepares both back to back ``)
  - 상세: `git blame` 로 확인한 결과 이 두 문단은 커밋 `c9e0e2ff7b`(2026-08-10 11:20:51)
    에서 작성됐고, 배치 분할 자체를 제거한 커밋 `193d43fc5`(같은 날 14:02:47, 이번
    changeset 이 리뷰하는 `.claude/skills/code-review-agents/SKILL.md`/`README.md` 의
    "지금은 분할이 없다" 문구를 도입한 그 커밋)는 그보다 나중이다. 즉 이 두 문단은
    **작성 시점엔 맞았지만 같은 날 나중 커밋이 전제를 없앴는데 갱신되지 않았다.**
    `_MAX_SESSION_NAME_ATTEMPTS` 의 주석은 지금도 "배치 분할이 2개 이름을 만든다"를
    50 이라는 상한을 정당화하는 살아있는 근거 중 하나로 제시하고, `create_session_dir`
    docstring 은 "That is not hypothetical: `--prepare` … splits it into two batches and
    prepares both back to back" 라고 현재형으로 단언한다. 이 changeset 이 리뷰 대상으로
    삼은 `SKILL.md`/`README.md`/`code_review_orchestrator.py` 세 곳은 전부 과거형("used to
    slice", "지금은 분할이 없다")으로 정확히 고쳐졌는데, 같은 결함 클래스를 만드는 원인
    설명이 `lib/session.py` 에는 그대로 남아 있다 — 직전 라운드가 잡은 "닫힌 결함을 아직
    열려 있다고 서술" 과 정확히 같은 형태이며, `lib/session.py` 는 이 diff 파일 목록 밖이지만
    지시대로 저장소 전체를 훑어 발견했다.
  - 제안: 두 문단을 과거형으로 정정 — 예: "Until 2026-08-10, a batch split could also
    produce 2 names in the same second; that path is gone (see
    `code_review_orchestrator.py`'s `_warn_large_changeset`), so the remaining source of
    same-second collisions is parallel sessions." `_MAX_SESSION_NAME_ATTEMPTS` 의 근거
    문단도 동일하게 갱신.

- **[WARNING]** 새로 추가된 "삭제-전용 커밋" 방어가 자신이 참조하는 docstring 과
  `.claude/tests/README.md` 카탈로그 행 어디에도 반영되지 않았다
  - 위치: `.claude/tests/test_line_anchors.py:65-92` (`pick_commit_fixture` docstring —
    문서-전용 커밋·merge 커밋 2종만 기술), `:110-116` (이번 diff 가 추가한 인라인 주석,
    `"the same shape as the doc-only and merge cases above"` 로 위 docstring 의 두 사례를
    직접 지시); `.claude/tests/README.md:65` (`test_line_anchors.py` 행)
  - 상세: 이번 커밋(`ffb2cfbe5`)의 메시지 자체가 "그 함수 docstring 이 이미 같은 클래스
    실패 2종(문서-전용 커밋·merge 커밋)을 기록하고 있어 세 번째 변종을 같은 자리에
    닫았다" 고 말하지만, 실제로 `pick_commit_fixture` 의 docstring(65-92행)은 정확히
    2종만 기술한 채 갱신되지 않았고, 세 번째 사례(삭제-전용 커밋)는 루프 안의
    인라인 주석(110-116행)으로만 존재한다 — 그 주석 자체가 "위" 두 사례를 가리키는
    지시어("above")를 쓰고 있어, docstring 을 먼저 읽는 독자는 이 세 번째 방어가
    같은 함수의 같은 계보라는 것을 docstring 만으로는 알 수 없다. `git show ffb2cfbe5
    --stat` 로 확인한 결과 이 커밋은 `test_line_anchors.py` 만 고쳤고
    `.claude/tests/README.md` 의 `test_line_anchors.py` 행(65번)은 건드리지 않았다 —
    그 행은 여전히 "doc-only last commit"·"MERGE commits" 두 실패 형태만 나열하고
    새로 닫은 세 번째 형태(삭제-전용 커밋, `e4ce8adf8` 실측)를 언급하지 않는다. 직전
    라운드가 지적한 "닫은 결함을 두 문서가 아직 열려 있다고 서술" 과는 결이 다르지만
    (여기는 "틀린 서술" 이 아니라 "새로 닫은 사례의 최초 등재 누락"), 근본 원인은
    같다 — 코드에 새 사례를 추가하면서 그 사례의 근거를 담는 문서(같은 파일의
    docstring, 카탈로그 행)를 함께 갱신하지 않은 것.
  - 제안: `pick_commit_fixture` docstring 끝에 세 번째 문단(삭제-전용 커밋, `e4ce8adf8`
    실측, `git show <sha>:<path>` 가 빈 문자열을 반환하는 경로)을 추가하고,
    `.claude/tests/README.md:65` 행에도 같은 문장을 반영해 두 지점이 이 함수가 방어하는
    세 번째 사례를 함께 기록하게 한다.

- **[WARNING]** `plan/in-progress/harness-review-gate-followups.md` 의 상위 체크리스트
  항목이 하위 항목 3개가 모두 완료됐는데도 미해결로 남아 있다
  - 위치: `plan/in-progress/harness-review-gate-followups.md:467`(섹션 헤더 `## 원 plan
    에서 함께 넘어온 미해결 조사 1건`), `:469`(`- [ ] **동일 커밋의 형제 파일이 부분만
    뽑히는 원인 확인**`)
  - 상세: 이 부모 항목의 목적은 "동일 커밋의 형제 파일이 부분만 리뷰되는 원인을
    확인" 하는 것이었다. 그 아래 중첩된 하위 항목은 `create_session_dir()` 충돌
    회피(513행, `[x]` 구현 완료 2026-08-10), 배치 분할 제거(523행, `[x]` 처분 완료
    2026-08-10 — 바로 이번 changeset 의 핵심 커밋), router fail-closed 방어(583행,
    `[x]` 처분 완료 2026-08-10) 셋뿐이고 전부 `[x]` 다(551행의 `[~]` 는 "원문 — 위
    처분의 근거로 보존" 이라 명시된 아카이브 항목이라 열린 항목이 아니다). 즉 부모가
    던진 질문("원인 확인")에 대한 답이 이미 세 갈래로 전부 나와 있는데, 부모 체크박스
    자체와 그 섹션 헤더("미해결 조사 1건")는 이번 diff 가 그 아래 내용을 대폭 갱신하면서도
    함께 갱신되지 않았다. 직전 라운드가 `tests/README.md`/`code-review-agents/README.md`
    에서 잡은 "닫힌 결함을 문서가 아직 열려 있다고 서술" 과 정확히 같은 형태이고, 이번엔
    plan 문서에서 재발했다.
  - 제안: 하위 3항목이 실제로 이 investigation 의 전부라면 469행을 `[x]` 로 바꾸고
    467행 헤더를 "해결된 조사"로 정정(또는 항목 자체를 상단 완료 섹션으로 이동).
    아직 못 다룬 원인 후보가 남아 있다고 판단한다면 그 잔여 스코프를 469행 본문에
    명시적으로 한 줄 남겨 "3건은 닫혔고 남은 것은 X" 형태로 만든다 — 지금처럼 빈
    채로 두면 다음 독자가 "아직 원인 미상" 으로 오독한다.

- **[INFO]** (이번 diff 밖, 인접 편집 파일에서 발견) `REVIEW_AGENTS` 기본값 설명의
  reviewer 총원이 13으로 적혀 있으나 실제는 14
  - 위치: `.claude/skills/code-review-agents/README.md:226`
  - 상세: `git blame` 확인 결과 이 행은 2026-05-15(`02b5eb99f`)에 "13" 으로 적힌 뒤
    이번 changeset 을 포함해 한 번도 갱신되지 않았다. 반면 `code_review_orchestrator.py`
    의 `ALL_AGENTS`(102-107행)는 `user_guide_sync` 를 포함해 14개이고, 같은 파일의
    `SKILL.md` 서두("디폴트 14개")·이 changeset 안의 여러 `meta.json`(`"agents": […]`
    14개 배열)도 14로 일관된다. 이번 diff 가 직접 건드린 줄은 아니라 diff 범위 밖의
    사전 존재 결함이지만, 바로 옆(227~234행)을 이번 changeset 이 편집한 파일이라
    같이 적어 둔다.
  - 제안: `(전체 13)` → `(전체 14)` 로 정정. 이 값을 손으로 다시 세는 대신
    `test_router_safety_policy_doc.py` 류의 "roster vs `ALL_AGENTS`" 파생 검증을
    이 표에도 확장하면 다섯 번째 reviewer 가 추가될 때 같은 드리프트가 재발하지
    않는다.

## 요약

이번 changeset 자체(`ai-review.md`/`code-review-agents/README.md`·`SKILL.md`/
`code_review_orchestrator.py`/`test_line_anchors.py`/`test_review_prepare_single_session.py`)는
리뷰 세션 배치 분할을 제거하면서 계약 문서 3곳(SKILL.md, README.md ×2, 모듈 docstring)을
전부 과거형으로 정확히 고쳤고, `test_review_prepare_single_session.py`·
`test_review_session_dir_collision.py` 등 테스트 카탈로그도 이미 이전 라운드에서
"닫힌 결함을 아직 열려 있다고 서술" 하던 두 곳(인접 모순 행, 사라진 로그 이벤트)을
바로잡은 상태다. 다만 지시대로 저장소 전체를 같은 축("batch"/"분할"/"마지막 줄")으로
훑은 결과, 같은 클래스의 잔여가 diff 밖 세 곳에서 발견됐다 — (1) `lib/session.py` 의
두 docstring 이 이제는 일어나지 않는 "배치 분할" 을 여전히 현재형 근거로 쓰고,
(2) 이번 diff 가 추가한 "삭제-전용 커밋" 방어가 자신이 지시하는 docstring 문단과
README 카탈로그 행에 반영되지 않았으며, (3) 이번 diff 가 대폭 갱신한 plan 문서에서
하위 항목 3개가 모두 완료됐는데도 상위 체크박스와 섹션 헤더가 "미해결" 로 남아 있다.
셋 다 기능에는 영향이 없는 순수 문서 정확성 문제이지만, 같은 형태가 한 PR 안에서
반복(플러스 이전 라운드까지 합치면 4~5회)된다는 점에서 "코드를 고치면서 그 코드를
설명하는 문서/주석을 전부 훑어 함께 고친다" 는 절차적 체크리스트가 필요해 보인다.
추가로 diff 범위 밖이지만 인접한 `REVIEW_AGENTS` 카운트(13 vs 실제 14) 도 발견해
INFO 로 남긴다.

## 위험도

MEDIUM — 개별 발견은 전부 비차단 문서 정확성 문제(CRITICAL 없음)지만, 정확히 같은
결함 클래스("닫힌 결함/새 방어가 문서에 반영되지 않음")가 이번 diff 안에서만도
독립적으로 3회 재발했다는 패턴 자체가 구조적 신호다.
