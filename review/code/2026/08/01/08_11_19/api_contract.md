# API 계약(API Contract) Review

## 범위 확인

이번 변경분(17개 파일: `.claude/_shared/*`, `.claude/hooks/*`, `.claude/agents/consistency-summary.md`,
`.claude/skills/{code-review-agents,consistency-checker,merge-coordinator}/**`, `.claude/tests/*`,
`plan/in-progress/harness-review-gate-ci-backstop.md`)은 HTTP/REST API 표면(`codebase/backend` 라우트·
컨트롤러·DTO 등)을 전혀 포함하지 않는다. 따라서 본 체크리스트의 **URL/경로 설계·페이지네이션·인증/인가**
항목은 적용 대상이 없다(하위 호환성/버전관리 항목도 마찬가지 — 외부에 공개된 REST 버전 계약이 없다).

다만 harness 내부에도 "계약"이라 부를 만한 인터페이스가 존재한다 — orchestrator 들의 CLI 인자 표면,
Stop/Push 훅의 stdin/stdout 프로토콜, sub-agent 호출 규약(STATUS 라인·마크다운 반환 형식). 코드 리뷰어
목록에 `api_contract` 가 범위 한정 없이 상시 포함되는 구조(코드 확인: `code_review_orchestrator.py`
`ALL_AGENTS`)이므로, "요청 검증"·"응답 형식" 두 항목을 이 내부 인터페이스들에 느슨히 적용해 실제로
코드를 열람하고 테스트 실행 로직까지 추적했다. round 8 지침대로 **주석 검사가 아니라 실제 코드/테스트
동작을 확인**한 결과를 아래에 기록한다.

## 발견사항

- **[INFO] (검증됨 — 결함 아님) 7R 이 지적한 두 실결함은 이번 라운드 코드에서 실제로 고쳐져 있고, 각각
  실측 기반 회귀 테스트로 고정돼 있다**
  - 위치: `.claude/hooks/guard_review_before_push.py` 의 `_evaluate_over_targets` 함수(809행 정의) ·
    `.claude/_shared/block_integrity.py` 의 `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` (79-84행) ·
    `.claude/tests/test_block_integrity.py` 의 `NotesFromLaterTargetsSurviveAnEarlierBlockTest`(416행)와
    `VerdictParserStaysLinearTest`(470행)
  - 상세:
    (a) 정규식 O(n²) — `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 는 `[\s...]` 대신 `[ \t...]` 를 써서
    `re.MULTILINE` 에서 줄 경계를 넘는 재시도가 불가능하다. `VerdictParserStaysLinearTest.
    test_no_verdict_in_a_large_document_returns_fast` 는 **서브프로세스 + 5초 하드 타임아웃**으로
    20,000줄 입력(`BLOCK:` 없는 텍스트)을 돌려 실제로 시간을 잰다 — in-process 로 elapsed time 을
    assert 하지 않고 서브프로세스인 이유까지 docstring 에 명시("C-level `re}` 백트래킹은 시그널이
    안 닿는다"). 코드 자체도 `block_integrity.py` 상단 docstring 에 실측 표(구 패턴 16k줄=5.375s,
    현재 패턴 16k줄=0.001s)를 남겨 자기 검증 가능.
    (b) 블로킹 target 이후 advisory 유실 — `_evaluate_over_targets` 는 더 이상 블록 발생 시 루프
    중간에서 `return` 하지 않는다. 매 target 반복에서 `notes` 수집(864-873행)이 `result.push_blocks`
    체크(874행)보다 **항상 먼저** 실행되므로, 블로킹 target 의 앞이든 뒤든 어느 위치의 target
    advisory 도 유실되지 않는다. `NotesFromLaterTargetsSurviveAnEarlierBlockTest.
    test_a_later_targets_note_is_kept_when_an_earlier_one_blocks` 는 실제 `_evaluate_over_targets`
    함수를 파일 경로로 로드해 stub target 2개(앞: block+note, 뒤: no-block+note)로 구동하고 두 note
    가 모두 `outcome.notes` 에 남는지, 그리고 메시지는 **첫 번째** 블로커 것인지를 함께 단언한다.
    이 테스트 클래스의 docstring 이 정확히 round 8 사전 안내와 같은 문구를 쓴다: "코멘트가 반대쪽
    배치(블로킹 target *자신의* note)만 방어해서 완전해 보였다."
  - 제안: 없음(확인 목적의 기록). 두 항목 모두 재발 없음을 코드 실행 경로와 테스트 실행 결과로
    확인했다.

- **[WARNING] `code_review_orchestrator.py` 의 CLI 파라미터가 서로 조용히 충돌한다 —
  `--commit`/`--range`/`--branch` 가 `--files`(위치 인자)를 경고 없이 덮어씀**
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 의
    `collect_change_infos()` (1229행 정의, 분기는 1235행 `args.commit` → 1242행 `args.range` →
    1248행 `args.branch` → 1254행 `args.files` → 1261행 default 순서의 `if/elif` 체인)
  - 상세: 네 개의 "무엇을 리뷰할지" 선택자가 `argparse` 상호 배타 그룹으로 선언돼 있지 않고 수작업
    `if/elif` 로만 걸러진다. 두 개 이상이 함께 주어지면(예: `--branch origin/main file_a.py
    file_b.py`) 앞쪽 분기가 조용히 이기고 뒤쪽 인자는 **에러도 stderr 경고도 없이** 폐기된다.
    같은 저장소의 자매 스크립트 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
    는 정확히 이 문제를 `parser.add_mutually_exclusive_group(required=False)` (847행)로 막아 두
    모드 인자가 동시에 오면 argparse 자체가 즉시 에러를 내도록 설계돼 있다 — 올바른 패턴이 같은
    코드베이스에 이미 존재한다. 이 결함은 가상의 우려가 아니라 이미 이번 리뷰 번들의 file 17
    (`plan/in-progress/harness-review-gate-ci-backstop.md` §11, "신규 발견, 2026-08-01 6R")에
    "게이트 자체를 무력화할 수 있는 결함" 으로 기록돼 있고, 그 문서 자체가 지적하듯 이 저장소가
    지금 권장하는 표준 절차("커밋 후에는 `--branch <base>` 를 명시 `--files` 목록과 함께 줘야
    diff base 가 맞는다")가 바로 이 충돌 조합이다 — 실측 사례로 17개 변경 파일이 리뷰 대상에서
    통째로 빠진 적이 있다(review 산출물만 담긴 changeset 으로 대체됨). 직접 코드를 읽어 이번
    라운드 시점에도 미해결임을 확인했다 — 이번 diff 가 새로 만들거나 악화시킨 것은 아니다.
  - 제안: 이미 문서화된 최소 조치(두 옵션이 함께 오면 `--files` 우선 + 무시되는 옵션을 stderr 로
    경고)를 적용하거나, `consistency_orchestrator.py` 처럼 `argparse` mutually-exclusive-group 로
    승격해 구조적으로 차단.

- **[INFO] 세 orchestrator CLI 의 미인식 인자 처리 엄격도가 문서화 없이 갈린다**
  - 위치: `code_review_orchestrator.py` main (1361행: `args, _ = parser.parse_known_args()`),
    `merge_coordinator_orchestrator.py` main (533행: `args, _ = parser.parse_known_args()`),
    `consistency_orchestrator.py` main (878행: `args = parser.parse_args()`)
  - 상세: `parse_known_args()` 를 쓰는 두 orchestrator 는 인식 못 하는 플래그(오탈자 등)를 조용히
    무시하고 계속 진행하지만, `consistency_orchestrator.py` 만 `parse_args()` 로 즉시 에러를 낸다.
    세 스크립트가 `_shared/retry_state.py` 등 인프라를 대칭적으로 공유하도록 설계돼 있는데 이
    입력 검증 축만 근거 주석 없이 갈린다 — 오탈자 플래그가 두 orchestrator 에서는 조용히 무시된
    채 기본 경로로 빠질 수 있다.
  - 제안: 의도된 관용(하네스가 부가 인자를 덧붙이는 경우 대응)인지 단순 누락인지 확인 후 정책을
    통일하거나 이유를 주석으로 남길 것. 심각도는 낮음 — 호출자가 대체로 개발자/하네스 자신이라
    외부 공격 표면은 아니다.

## 요약

이번 변경분은 REST/HTTP API 표면을 전혀 건드리지 않으므로 URL/경로 설계·페이지네이션·인증/인가·버전관리
항목은 적용 대상이 없다. "요청 검증"·"응답 형식" 관점을 harness 내부 CLI/훅/sub-agent 계약에 느슨히
적용해 코드와 테스트 실행 로직을 직접 추적한 결과, round 7 이 지적한 두 실결함(검증 정규식 O(n²), 블로킹
push target 이후 advisory 유실)은 이번 라운드 코드에서 실제로 고쳐져 있고 각각 실측 기반 회귀 테스트
(서브프로세스 타임아웃 측정, 실제 함수를 구동하는 target-순서 테스트)로 고정돼 있음을 주석이 아니라
코드 실행 경로·테스트 실행 결과로 확인했다. 다만 이 리뷰 세션 자체가 사용하는
`code_review_orchestrator.py` 의 CLI 인자 계약에는 별개의, 이미 같은 번들의 plan 문서에 기록된 미해결
결함이 남아 있다 — `--commit`/`--range`/`--branch` 가 명시 `--files` 목록을 경고 없이 덮어써, 이
저장소가 지금 권장하는 "커밋 후 `--branch` + 명시 파일" 병용 절차에서 실제로 리뷰 대상이 통째로 사라진
전례가 있다. 이번 라운드가 새로 만들거나 악화시킨 결함은 아니지만 코드를 직접 읽어 아직 남아 있음을
재확인했다. 그 외 sub-agent 출력 프로토콜(`consistency-summary.md` 의 두 모드·3-파트 반환 형식)과 세
orchestrator 의 `--summary-state` 출력 형식 차이는 모두 의도적이고 테스트로 고정된 분기이며 결함이
아니다.

## 위험도
LOW
