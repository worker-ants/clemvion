# 유지보수성(Maintainability) Review

검토 대상 17개 파일 중 5개(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`,
`test_block_integrity.py`)는 프롬프트에서 크기 제한으로 생략되어 있었으므로, 판단 전에
`Read` 로 실제 파일을 직접 열어 확인했다(아래 위치는 모두 그 실제 소스 파일의 줄 번호).
길이·중첩 깊이는 감으로 판단하지 않고 AST 로 직접 측정했다(`ast.FunctionDef` 별 줄 수,
`elif` 체인의 인위적 깊이를 `col_offset` 비교로 제외한 "시각적" 중첩 깊이).

라운드 7 이 지적한 두 결함도 확인했다: (a) `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 가
`[ \t…]`(개행 미포함)를 쓰고 있어 O(n²) 회귀는 재발하지 않았고, 서브프로세스+timeout 기반
회귀 테스트(`VerdictParserStaysLinearTest`)가 있다. (b) `guard_review_before_push.py` 의
`_evaluate_over_targets` 는 차단 target 이후에도 loop 를 계속 돌아 이후 target 의 advisory 를
수집하며(더 이상 `return` 하지 않음), `NotesFromLaterTargetsSurviveAnEarlierBlockTest` 가
이를 고정한다. 둘 다 유지보수성 관점에서도 양호 — 수정 사유와 재발 방지 테스트가 코드 옆에
남아 있다.

## 발견사항

- **[WARNING]** 세 orchestrator 의 CLI 디스패치 보일러플레이트(`--resume`/`--update`)가
  글자 그대로 반복된다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1373-1391`(resume), `:1401-1407`(update) / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:885-903`(resume), `:911-917`(update) / `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:535-544`(resume), `:550-556`(update)
  - 상세: `diff`/`grep` 으로 직접 대조 확인. `--update` 블록 7줄은 세 파일 모두 완전히
    동일하다. `--resume` 블록은 `code_review_orchestrator.py` 와 `consistency_orchestrator.py`
    사이에 17줄이 사실상 동일(디버그 로그 문구 "reviewers"/"checkers", "Resuming
    session"/"Resuming consistency session" 한 단어만 다름)하고, `merge_coordinator_
    orchestrator.py` 는 `_reconcile_state_with_disk` 호출이 빠진 축약판이다(이 누락 자체는
    파일 내 주석과 `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 항목 9번에
    이미 추적돼 있음 — 그 부분은 새로 지적하는 것이 아니다). 이번 PR 의 핵심 목적이 바로
    "Change both"(실제로는 "Change all 3") 패턴 제거(`_shared/retry_state.py` 추출)인데,
    그 목적이 상태 bookkeeping 함수 5종의 **본체**에서는 달성됐지만 그 함수들을 호출하는
    **CLI 배선 계층**에서는 그대로 반복되고 있다 — 정확히 이 리팩터가 없애려던 것과 같은
    종류의 위험(한쪽만 고치고 잊음)이 한 겹 위에 남아 있는 셈이다.
  - 제안: `_shared/retry_state.py` 에 `handle_resume_cli(sd, label)` / `handle_update_cli(...)`
    같은 공용 헬퍼를 두어 세 `main()` 이 위임하게 하면, `--resume` 계약이 바뀔 때 3곳을
    손으로 맞출 필요가 없어진다. (참고로 `merge_coordinator` 의 reconcile 누락은 이미
    "다른 skill 의 동작 변경이라 별도 PR" 로 결정돼 있으므로, 이 리팩터는 최소한 코드
    review/consistency 두 파일 사이의 순수 문구 차이만 있는 사본부터 통합해도 된다.)

- **[WARNING]** `build_files_section` 이 서로 다른 예산 전략 3가지를 한 함수(실측 201줄,
  이번 리뷰 대상 중 최장 함수)에 누적하고 있다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:509-709`
  - 상세: AST 로 전체 9개 파일의 함수 길이를 스캔한 결과 이 함수가 1위(201줄)였다.
    "예산 없음(unbounded)" / "header+diff 만으로도 상한 초과" / "content 예산 배분" 세
    경로가 순차 분기로 한 함수 안에 있고, 각 경로가 "notice 문구 길이도 예산에 포함해야
    한다"는 동일한 불변식을 각자 손으로 재구현한다. 이 구조 자체가 이미
    `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 항목 3번("`build_files_
    section` 이 예산 전략 3개를 한 함수(약 190줄)에 누적")으로 추적돼 있어 새로 발견한
    것은 아니지만, 실측치(201줄)로 재확인하고 유지보수성 관점에서도 별도 함수로 쪼개는 편이
    낫다는 점을 재확인한다 — 3R 에서 발견된 CRITICAL 이 정확히 이 구조(같은 불변식의 중복
    구현)에서 재발했던 전례가 있다.
  - 제안: 이미 등재된 방향대로 `_render_unbounded` / `_render_diff_only_overflow` /
    `_allocate_content_budget` 로 분리하고, 예산 계상은 이미 있는 `_charge_notice` 헬퍼로
    3경로 모두 통일.

- **[INFO]** `collect_context` 가 4개 모드의 target 구성 + 코퍼스 수집·랭킹·조립을 한
  함수(183줄)에 담고 있다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:391-573`
  - 상세: AST 실측 결과 이 파일에서 가장 긴 함수(183줄). `--spec`/`--plan`/`--impl-prep`/
    `--impl-done` 4가지 모드별 target 결정 로직(468-532행)과, 공통 우선순위 랭킹
    (`_prioritized`, 420-428행) 및 spec/conventions/plan 세 코퍼스 조립(534-563행)이 이어져
    있다. 각 모드 분기 자체는 짧고 주석이 촘촘해 당장 가독성이 크게 나쁘지는 않지만, 함수
    하나가 "target 결정" + "코퍼스 수집" + "우선순위 정렬" + "번들 조립" 네 책임을 진다.
    시각적 중첩 깊이는 실측 5(대부분 `elif` 체인이 아니라 진짜 중첩)로 다른 함수보다 깊다.
  - 제안: 모드별 target 구성부(`--spec`/`--plan`/`--impl-prep`/`--impl-done` 분기)를
    `_build_spec_target`/`_build_impl_done_target` 등으로 추출하면 각 모드를 독립적으로
    수정·테스트하기 쉬워진다. 시급하지 않음 — 현재도 분기별 문서화가 잘 돼 있어 정보 수준으로
    남긴다.

- **[INFO]** `failopen_state` 모듈 부재 시 사용할 최소 `Outcome` 폴백이 두 훅에서 서로
  다른 코드 형태로 재구현돼 있다
  - 위치: `.claude/hooks/guard_review_before_push.py:791-799`(모듈 레벨 `_Outcome` 클래스
    별칭) / `.claude/hooks/guard_review_before_stop.py:100-115`(`_new_outcome()` 함수가
    지역 `_Fallback` 클래스 인스턴스를 반환)
  - 상세: 두 폴백 모두 `answered`/`bypassed`/`degraded`/`notes` 네 필드로 완전히 동일하지만
    (직접 대조 확인), 하나는 "모듈 레벨에서 클래스 이름을 조건부로 바꿔치기"하고 다른 하나는
    "함수 안에서 지역 클래스를 정의해 인스턴스를 반환"하는 서로 다른 패턴을 쓴다.
    `guard_review_before_stop.py:110-112` 의 주석 자체가 "the push side already diverged
    once by having it on only one of its two" 라고 밝히고 있어, 이 두 사본이 필드 하나가
    누락되는 방식으로 실제로 어긋난 전례가 이미 있다. `failopen_state` 가 import 실패했을
    때를 위한 폴백이라 그 모듈 안으로 옮길 수 없다는 제약(폴백의 존재 이유 자체가 그 모듈의
    부재)은 이해되지만, 두 파일이 같은 개념을 다른 형태로 구현하고 있다는 점은 남는다.
  - 제안: 최소 필드셋을 `failopen_state` 를 import 하지 않는 아주 작은 별도 shim(예:
    `_lib/_outcome_fallback.py`, 순수 dataclass)으로 뽑아 두 훅이 동일 소스를 참조하게
    하거나, 최소한 두 훅이 같은 코드 형태(둘 다 `_new_outcome()` 패턴)를 쓰도록 통일.

- **[INFO]** `_import_reason` 두 사본 중 하나가 백슬래시 연속줄에서 들여쓰기를 잃었다
  - 위치: `.claude/hooks/guard_review_before_push.py:805-806`
  - 상세: `cat -e` 로 직접 확인 — 805행 끝의 `\` 연속 이후 806행
    (`f"{module} imported but {symbol} is None"`)이 들여쓰기 없이 컬럼 0 에서 시작한다.
    저장소 전체에서 이 파일에만 유일한 `\`-연속줄 패턴이다(grep 으로 확인 — 다른 8개 파일엔
    없음). 같은 로직의 사본인 `.claude/hooks/guard_review_before_stop.py:121-122` 는 괄호
    기반 줄바꿈으로 정상 들여쓰기돼 있어, 사실상 같은 함수의 두 사본이 서로 다른 포맷
    스타일을 갖게 됐다.
  - 제안: `guard_review_before_stop.py` 와 동일하게 괄호로 감싸 들여쓰기를 정리. (또는 두
    사본을 `failopen_state.import_failure_reason` 위임 + 각 훅에는 `failopen_state is None`
    분기만 남기는 방향으로 더 줄일 수도 있음 — 지금도 그 함수가 있으면 위임하고 없을 때만
    이 한 줄짜리 폴백을 쓰므로 큰 변화는 아님.)

- **[INFO]** `_GATE_REVIEW`/`_GATE_PLAN`/`_ALL_GATES` 상수 세 줄이 두 훅 파일에 문자
  그대로 중복
  - 위치: `.claude/hooks/guard_review_before_push.py:726-730` / `.claude/hooks/guard_review_before_stop.py:95-97`
  - 상세: `_GATE_REVIEW = "REVIEW"`, `_GATE_PLAN = "PLAN"`,
    `_ALL_GATES = frozenset({_GATE_REVIEW, _GATE_PLAN})` 가 두 파일에서 동일하다(각 파일
    고유의 `_FAILOPEN_STATE_NAME` 은 의도적으로 다름 — 별도 스트릭 파일이라 정당한 차이).
    게이트 이름 자체는 두 훅이 공유하는 개념이라 `_lib/failopen_state.py` 에 공통 상수로
    옮길 수 있는 자리다. 규모가 작아(3줄) 실질 위험은 낮음.
  - 제안: 우선순위 낮음 — 세 번째 게이트가 추가되는 시점에 함께 정리해도 무방.

## 요약

전반적으로 코드베이스는 유지보수성 관리가 잘 되어 있다: 상수는 대부분 이름이 있고 도출
근거가 주석에 남아 있으며(매직 넘버 문제 거의 없음), 함수는 대체로 단일 책임을 지키고,
실측(AST)한 시각적 중첩 깊이도 최대 4~5 수준으로 과도하지 않다. 라운드 7 이 지적한 두
결함(O(n²) 정규식, 차단 경로의 advisory 유실)은 실제로 견고하게 고쳐졌고 재발 방지 테스트가
코드 옆에 남아 있어 "고쳤다는 주석"이 아니라 "고쳐졌음을 계속 증명하는 테스트"로 뒷받침된다.
다만 이번 라운드에서 새로 확인한 실질적 중복이 하나 있다 — `_shared/retry_state.py` 추출이
상태 bookkeeping **함수 본체**의 "Change both" 위험은 없앴지만, 그 함수들을 호출하는 세
orchestrator 의 **CLI 디스패치 블록**(`--resume`/`--update`)은 여전히 손으로 맞춰야 하는
사본으로 남아 있다. 이는 이 PR 자신이 내세우는 목적과 정확히 같은 종류의 위험이라 우선
정리 대상으로 제안한다. `build_files_section`(201줄)과 `collect_context`(183줄)는 함수 길이·
다중 책임 관점에서 여전히 크지만 전자는 이미 plan 에 후속 항목으로 등재돼 있고, 나머지
발견(Outcome 폴백 재구현, 포맷 불일치, 게이트 상수 중복)은 모두 소규모 INFO 수준이다.
CRITICAL 급 유지보수성 결함은 없었다.

## 위험도

LOW
