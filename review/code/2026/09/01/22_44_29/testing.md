# 테스트(Testing) 리뷰

## 범위에 대한 메모

이번 changeset 68개 파일 중 실제 "코드"(사람이 유지보수하는 실행 로직)는 4개뿐이다 —
`.claude/hooks/_lib/plan_guard.py`(정규식 확장), `.claude/tests/test_plan_guard.py`(신규
테스트 3건), `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`(통합 테스트
보강), `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 가드+테스트).
나머지는 `plan/**` 트래킹 문서와 `review/consistency/**` 세션 산출물이라 이 관점의 채점
대상이 아니다. 아래 발견은 이 4개 파일과, 그로부터 파생되는 저장소 다른 위치의 드리프트에
집중했다.

## 발견사항

- **[WARNING]** `_CHECKBOX` 정규식 확장이 만드는 **반대 방향** 오탐(허위 "완료" 신호)이
  테스트되지 않았고, 저장소 자체 역사에 정확히 이 형태의 실제 선례가 있다
  - 위치: `.claude/hooks/_lib/plan_guard.py:87`(`_CHECKBOX` 정의), `:237-268`
    (`_all_checkboxes_done`) / 회귀 테스트: `.claude/tests/test_plan_guard.py:265-301`
    (`test_open_checkbox_inside_blockquote_counts` 등 3건)
  - 상세: 이번 확장(`^\s*` → `^[\s>]*`)의 근거는 "인용문 안의 **열린** 체크박스가 숨어서
    완료로 오판되면 안 된다"이고, 신규 테스트 3건도 전부 그 방향(열린 인용 체크박스가
    열림으로 카운트됨, 서술 인용은 카운트 안 됨)만 고정한다. 그런데 이 정규식은 대칭이라
    **닫힌** 인용 체크박스(`> - [x] ...`)도 이제 `done_count` 에 잡힌다. 직접 재현했다
    (저장소 밖 scratch 스크립트, 파일 변경 없음):
    ```
    body = "## status\n> - [x] quoted from another plan already resolved\n\n## todo\n- 작업: prose bullet (no checkbox)\n"
    # 옛 정규식(`^\s*...`)  → done=0, open=0 → _all_checkboxes_done == False
    # 새 정규식(`^[\s>]*...`) → done=1, open=0 → _all_checkboxes_done == True
    ```
    즉 **top-level 체크박스가 하나도 없고**, 후속 작업이 프로즈 불릿(`- 작업: ...`)으로만
    추적되는 문서에서, 다른 문서를 인용하며 남긴 **닫힌** 체크박스 한 줄만으로 문서 전체가
    "완료"로 판정된다. 이는 가상의 케이스가 아니다 — `plan/complete/auth-config-webhook-followups.md`
    가 `in-progress/` 였을 때(`git show`로 확인 가능한 커밋 이전 상태) 정확히 이 구조를 썼다:
    상단 blockquote 에 다른 세션 상태를 인용하며 `> - [x] ...` 9줄을 닫힌 상태로 나열하고,
    그 아래 §2~§4 는 전부 `-` 프로즈 불릿(실제 체크박스 아님)으로 남은 작업을 추적했다. 같은
    모양의 `in-progress/` 문서가 이 diff 이후 생기면 Stop-gate 가 "체크박스 모두 완료 →
    complete/ 로 이동" 을 잘못 권한다.
  - 이미 한 라운드 전 리뷰에서 "블록쿼트 닫힌 체크박스 대칭 테스트"가 INFO 로 지적됐고
    `review/code/2026/09/01/22_25_37/RESOLUTION.md` 는 "정규식 대칭성상 실패 가능성이
    낮다"는 이유로 미조치·우선순위 판단으로 미뤘다. 그 근거는 위 실측(저장소 자체 역사에
    동일 문서 구조 선례 존재)과 배치된다 — "낮은 확률"이 아니라 "이 저장소가 실제로 쓰던
    패턴"이라, WARNING 으로 재상정한다. (소프트 넛지일 뿐 push 하드블록은 아니므로 CRITICAL
    까지는 아니다.)
  - 제안: `test_narrative_bracket_mention_is_not_a_checkbox` 옆에 미러 테스트를 추가한다 —
    top-level 체크박스 없이 인용문 안 **닫힌** 체크박스만 있는 본문이 여전히
    `_all_checkboxes_done() == False` 를 반환하는지(현재는 `True` 를 반환해 RED가 될 것).
    반환값이 의도적으로 `True` 여야 한다면 그 판단을 주석과 커밋 메시지에 명시하고, 아니면
    "인용문 안 체크박스는 열림 판정에만 기여하고 완료 판정에는 기여하지 않는다"는 방향으로
    로직을 비대칭화한다.

- **[WARNING]** `stray-tool-tags.test.ts` 의 "전제" 테스트 임계값(`MIN_EXPECTED_MD_FILES=100`)
  이 이 테스트가 막으려는 바로 그 실패 모드 — **두 스캔 루트 중 하나가 조용히 빠지는 경우**
  — 를 못 잡는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:58`
    (`const MIN_EXPECTED_MD_FILES = 100`), `:109-111`(`it("[전제] 스캔이 실제로 파일을
    봤다…")`), `:83-90`(`collectScanTargets` — `walkTree(root, ["plan", "spec"], …)`)
  - 상세: 이 전제 테스트의 존재 이유는 "스캔이 통째로 실패해도(예: 위반 수집 분기가
    한 번도 안 돌아도) 위반 0건 테스트가 초록으로 남는" 과거 실패(158 tests GREEN 인데
    수집 분기 미실행 이력, 파일 헤더 주석)를 막는 것이다. 그런데 실측하면
    `plan/`(archive 제외) 505개, `spec/` 386개로 **각 루트 단독으로도 100을 훌쩍 넘는다**.
    즉 `["plan", "spec"]` 중 한 쪽 문자열에 오탈자가 나거나(`"pla"` 등) 그 루트의 스캔이
    조용히 실패해도, 남은 한 루트만으로 전제 테스트가 여전히 통과한다 — "부분 실패"를
    구분 못 하는 구조다. 완전 실패(0건)만 잡고, 이 테스트 스위트가 실제로 겪었던 것과
    같은 클래스의 "분기 일부가 안 도는" 실패는 부분 스캔에 대해서는 여전히 vacuous 하다.
  - 제안: 완화안 두 가지 중 하나 — (a) `collectScanTargets` 대신 `walkTree(root, ["plan"], …)`
    와 `walkTree(root, ["spec"], …)` 를 각각 호출해 두 루트 모두 개별 하한(예: 각 200개)을
    넘는지 따로 단언한다. (b) 최소한 "두 루트 각각에서 최소 1개 이상"이라는 더 약한 개별
    하한이라도 추가해, 한 루트가 완전히 빠지는 시나리오만은 잡히게 한다.

- **[WARNING]** `_CHECKBOX` 확장과 같은 목적의 **독립 사본**이 `.claude/tools/plan-stale-audit.sh`
  에 있는데 이번 PR 이 갱신하지 않았고, 그 드리프트를 잡는 테스트/가드도 없다
  - 위치: `.claude/tools/plan-stale-audit.sh:123-125`
    (`total_box="$(grep -cE '^[[:space:]]*-[[:space:]]*\[[ x]\]' "$plan" …)"`,
    `done_box="$(grep -cE '^[[:space:]]*-[[:space:]]*\[x\]' "$plan" …)"`)
  - 상세: 이 스크립트는 plan 문서의 체크박스 진행률을 세어 "DONE?" 후보를 판정하는
    **별도 구현**이다(`.claude/hooks/_lib/plan_guard.py` 와 무관한 bash 정규식). 이번 diff 는
    `plan_guard.py` 의 `_CHECKBOX` 만 blockquote 인식하도록 넓혔고, 이 스크립트의 grep 패턴은
    여전히 `^[[:space:]]*-...`(공백만 허용, `>` 없음)로 옛 동작 그대로다. `plan_guard.py`
    모듈 docstring 자신이 "the pair drifted twice in a row" 라며 정확히 이 클래스의 실패를
    두 번 겪었다고 적어 두었는데(git_probe 공유화 배경), 이번에도 같은 패턴의 새 드리프트가
    생겼다 — 다만 이번엔 다른 파일(shell script)이라 기존 AST 동일 함수 검출 테스트
    (`test_no_identical_function_survives_in_two_guards`, Python 함수 전용)의 사정권 밖이다.
    이 스크립트는 "informational only"(스크립트 자체 주석)라 push/Stop 을 막지는 않으므로
    CRITICAL 은 아니지만, 두 카운팅 로직이 이제 "인용문 안 체크박스를 세는가"에 대해 서로
    다른 답을 낸다는 사실을 아무 테스트도 고정하지 않는다.
  - 제안: 이번 PR 범위에서 굳이 스크립트를 고칠 필요는 없지만(감사용 도구, 하드 게이트
    아님), `plan_guard.py` 의 `_CHECKBOX` 주석 또는 `harness-review-gate-followups.md`
    후속 항목에 "이 확장이 `plan-stale-audit.sh` 의 독립 카운팅과 드리프트를 만들었다"는
    한 줄을 남겨 다음에 그 스크립트를 만질 사람이 동기화 여부를 판단할 수 있게 한다.

## 확인했으나 문제 없음 (근거 기록)

- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 의 신규 멀티라인 ANCHOR
  통합 테스트(`:94-110`)는 line 계산을 직접 손으로 추적해 검증했다 — 공유 fixture
  `spec/doc.md` 는 1행 헤딩, 2행 공백, 3~6행 단일행 링크 4개, 7~8행 멀티라인 링크이고,
  테스트가 기대하는 `#nope→4`, `./missing.md→5`, `./real.md#no-such-anchor→7`(시작 줄)이
  실제 줄 배치와 정확히 일치한다. 같은 fixture 를 쓰는 기존 테스트(`findBrokenLinks reports
  DEAD + broken self-anchor…`)의 기대 배열도 새 위반 1건(`ANCHOR ./real.md#no-such-anchor`)을
  포함하도록 함께 갱신돼 있어 공유 `beforeAll` fixture 변경으로 인한 회귀는 없다. 코멘트가
  주장하는 "단위 층 5곳이 이미 멀티라인/혼재/3줄 스팬을 잠근다"도 같은 파일의 `extractLinks`
  관련 테스트(`:338, :362-386` 부근에 line 필드 단언)로 실측 확인됨 — 이번 추가는 정확히
  비어 있던 "통합 진입점이 그 line 을 떨구지 않는가" 층 하나만 메운다.
- `stray-tool-tags.test.ts` 의 `skipDir("archive")` 대조군 fixture(`archive/ 는 스캔하지
  않는다 — 그 밖은 스캔한다`)는 제외 대상(`plan/complete/archive/from-x/old.md`)과 포함
  대상(`plan/complete/kept.md`)을 함께 심어 "0건이 제외 때문인지 스캔 실패 때문인지"를
  가른다 — 이전 라운드 testing WARNING(무력화해도 10/10 GREEN)이 실제로 닫혔다. 부수로
  `collectScanTargets` 로 `walkTree` 호출을 한 곳에만 두어 "사본이 둘이면 한쪽만 바뀌어도
  아무도 모른다"는 재발 경로도 막았다.
- `.claude/tests/test_plan_guard.py` 신규 테스트 3건(`test_open_checkbox_inside_blockquote_counts`,
  `test_nested_blockquote_open_checkbox_counts`, `test_narrative_bracket_mention_is_not_a_checkbox`)
  은 모두 `tempfile.TemporaryDirectory()` 로 격리돼 있고 서로 상태를 공유하지 않는다.
  `test_narrative_bracket_mention_is_not_a_checkbox` 는 "넓히는 변경이 반대 방향 오탐을
  만들지 않는가"를 확인하는 대조군으로 설계 의도가 명확하고 docstring 도 정확하다.

## 요약

핵심 코드 변경(`plan_guard.py` 의 `_CHECKBOX` 정규식 확장)에 대한 신규 회귀 테스트 3건은
전부 "인용문 안 열린 체크박스가 숨지 않는가"라는 **한 방향**만 잠그고, 같은 정규식이 대칭적으로
만드는 **반대 방향**(top-level 체크박스 없이 인용문 안 닫힌 체크박스만으로 "완료" 오판)은
테스트도, 로직 결정도 없이 남아 있다 — 그리고 이 방향은 가상의 엣지 케이스가 아니라 저장소
자체가 실제로 썼던 문서 구조(`auth-config-webhook-followups.md`)와 일치한다(직접 재현
스크립트로 확인, `False`→`True` 전환). 신규 가드 `stray-tool-tags.test.ts` 의 "스캔이 실제로
돌았다"는 전제 테스트도 실측 파일 수(plan 505·spec 386, 각각 단독으로 임계값 100을 초과)
기준으로는 "두 루트 중 하나가 조용히 빠지는" 부분 실패를 못 잡는 약한 방어다. 그 외
`spec-links.test.ts` 의 통합 layer line 전달 테스트와 `stray-tool-tags.test.ts` 의
`skipDir` 대조군은 이전 라운드에서 지적된 vacuous-test 위험을 정확하고 견고하게 닫았다.
세 WARNING 모두 하드 게이트(push 차단)를 새로 여는 것은 아니라 CRITICAL 은 아니지만,
첫 번째(블록쿼트 닫힌 체크박스)는 이미 한 번 "낮은 확률"로 미뤄졌던 항목이 실은 저장소
실사용 패턴과 정면으로 겹친다는 새 근거가 있어 재상정할 가치가 있다.

## 위험도

MEDIUM
