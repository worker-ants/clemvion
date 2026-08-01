# RESOLUTION — 7R (harness-block-backstop)

리뷰어 14/14 성공. **CRITICAL 1 / WARNING 20 / INFO 다수.** RISK=CRITICAL.

7R 은 6R 의 changeset 오구성(리뷰 산출물만 담고 소스 0개) 때문에 **이 소스에 대한 사실상 첫
정식 리뷰**다. 그리고 그 판단이 옳았음이 곧바로 증명됐다 — 6R 이 못 본 CRITICAL 이 나왔다.

## CRITICAL — 판정 파서가 O(n²) (requirement)

`_BLOCK_AT_LINE_START` 선두 문자 클래스 `[\s>#*_\`-]*` 의 `\s` 가 **개행을 포함**해,
`re.MULTILINE` 의 `^` 앵커와 맞물려 매 줄 시작마다 같은 스캔을 반복한다.

**직접 재현** (`("> "*3+"\n") * n`, `BLOCK:` 없음 → 전수 실패 경로):

| n_lines | 1000 | 2000 | 4000 | 8000 | 16000 |
|---|---|---|---|---|---|
| `[\s…]` (현행) | 0.027s | 0.085s | 0.331s | 1.333s | **5.375s** |
| `[ \t…]` (수정) | 0.000s | 0.000s | 0.000s | 0.001s | 0.001s |

입력 2배마다 시간 **×4** — 이차 확정. 이 경로는 **매 push·매 turn-end 마다** 디스크의 모든
세션에 대해 동기 실행되고, SUMMARY 는 LLM 이 쓰는 markdown 이라 크기 강제가 없다. 훅이
타임아웃에 걸리면 fail-open 되므로, 이 PR 이 강화하려는 게이트가 정반대로 우회된다.

**처분: 수정.** `\s` → ` \t`. 거동은 불변이다 — `^` 가 이미 판정 줄 시작에 앵커하므로 클래스가
줄을 넘을 이유가 없었다. **커밋된 SUMMARY 1,506개 전수 검증: 판정이 달라진 문서 0건.**

### 리뷰어 간 판정이 갈렸고, 실측이 정답이었다

- security: "중첩 정량자·모호한 교차 일치 없음 → ReDoS 패턴 아님" (정적 형태 판단)
- performance: "이번 신규 코드 성능 문제 없음" (실측 없음)
- requirement: 3회 연속 벤치마크 + 수정 검증

**형태만 보는 정적 판단이 실측에 반증된 사례다.** main 이 직접 재현해 requirement 를 채택했다.

### 길이 상한은 채택하지 않았다 (명시적 판단)

리뷰어는 `_MAX_REDACTION_INPUT` 선례를 따라 입력 상한을 함께 권했다. 채택하지 않은 이유:

1. **상한은 이차 패턴을 못 막는다.** 256KB 여도 이차면 파국이다. 진짜 방어는 선형 패턴이다.
2. 같은 선례의 주석이 **"길이 상한은 절대 DETECTION 을 가로막아선 안 된다"** 고 경고한다 —
   여기서 상한 초과를 `None` 으로 처리하면 세션이 채택되지 않아 게이트는 안전 방향이지만,
   거대한 SUMMARY 하나가 push 를 영구 차단하는 함정이 된다.

대신 **선형성 자체를 회귀 테스트로 고정**했다. 서브프로세스 + 하드 타임아웃으로 짰다 —
백트래킹은 CPython C 레벨 `re` 안에서 일어나 시그널이 안 들어가므로, 반환 후 경과시간을 재는
in-process 테스트는 스위트를 통째로 hang 시킨다. 크기는 실측으로 정했다(20,000줄 = 구 패턴
~8.4s vs 현 패턴 ~1ms, timeout 5s). 작게 잡으면 깨진 코드도 통과해 vacuous 해진다.

## WARNING — 처분한 것

| # | 내용 | 처분 |
|---|---|---|
| W19 | multi-worktree 에서 `_evaluate_over_targets` 가 첫 차단 target 에서 즉시 `return` → **그 뒤 target 들의 notes 가 영구 유실** | 수정: `return` → `blocked` 기억 후 루프 완주. 회귀 테스트 2개 |
| W12 | 두 orchestrator 의 옛 `Mirror code_review_orchestrator` 헤더가 이번 PR 이 추가한 위임 설명과 모순 (6R 도 지적, 미처분) | 양쪽 헤더 재작성 |
| W10 | `merge_coordinator` 만 위임 함수 정의 순서가 뒤집혀 forward-reference | 재배치 |
| W18 | `PlanStubs` 가드가 `evaluate_plan` 스텁만 보고 대칭인 `evaluate_review` 스텁은 무방비 | 양쪽 다 보도록 확장 |
| W13 | plan 문서가 자기 목록 항목 수를 잘못 셈 (7 → 실제 11) | 정정 |

### W19 가 왜 중요한가

내 주석은 *"A note filed by a target that then blocks is the one most worth keeping"* 이라
적혀 있었다. 그건 **같은 target 이 차단하는** 경우다. 리뷰어가 지적한 건 그 반대 배치 —
앞선 target 이 차단하면 뒤 target 의 notes 는 **수집 기회조차 못 얻는다**. 그리고 push 가
거부되는 그 순간이 바로 모든 advisory 를 봐야 할 때다. 주석이 절반만 다루고 있어서 완결돼
보였다.

## WARNING — 기등재/후속 (이 PR 밖)

`evaluate_review` boolean flag(§5) · `merge_coordinator` reconcile 미위임(§9) ·
`_retry_state.json` lost update(§10) · `build_files_section` 3전략(§3) · `_lib` 네임스페이스
충돌 · `push_blocks` 를 `Protocol` 로 강제 · `review_guard.py` 1,017줄 · push/stop notes
재출력 정책 비대칭 · `_run()` 인라인 vs `_report_notes()` 구조 불일치 · git 서브프로세스
반복 호출 3건 — 전부 plan §후속에 등재됐거나 구조 리팩터라 별도 범위.

## 검증

- harness 스위트 **753 tests OK** (7R 착수 시 750 → 신규 3).
- mutation 3종 전부 RED:
  - `[M 이차 패턴 회귀]` FAILED — 5.008s 에 타임아웃 (정상 시 전체 0.4s)
  - `[M 조기 return]` FAILED — 뒤 target notes 유실을 잡는다
  - `[M 스텁 push_blocks 제거]` FAILED — 6R 에서 고친 가드가 계속 문다
