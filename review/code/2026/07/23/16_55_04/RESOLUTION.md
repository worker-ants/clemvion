# RESOLUTION — §E fail-open 관측가능화

리뷰: `review/code/2026/07/23/16_55_04/SUMMARY.md` — RISK=MEDIUM, Critical 0, **Warning 9**.
forced 7명 전원 확보(`forced_missing: []`).

## Warning (9) — 전부 반영

### W1 — `if __name__ == "__main__":` 블록 중복

내가 Edit 하면서 **기존 블록을 남긴 채 새로 추가**했다. 첫 블록의 `sys.exit()` 때문에 두 번째는
도달 불가능한 dead code라 동작엔 무해하지만(6명 실측 일치), documentation 리뷰어가 CRITICAL 로
본 이유가 타당하다 — 자기서술성을 중시하는 파일에 설명 없는 중복이 남으면 "의도된 이중
안전장치인가 머지 실수인가" 를 판단할 근거가 없다. → 제거(현재 1개).

### W2 — BYPASS 가 살아있는 streak 를 리셋

초판은 `degraded` 가 비면 무조건 리셋했다. REVIEW 가 2회 연속 degraded 인 상태에서 무관한
사유로 `BYPASS_REVIEW_GUARD=1` 을 쓰면 카운터가 **수정 확인 없이 0** 이 된다 — 이 기능이
막으려는 상황을 그대로 재현한다.

**수정**: 게이트별로 `degraded`/`answered`/`bypassed` 를 구분하고, 리셋은 **양쪽 게이트가 모두
실제로 답했을 때만**.

> 여기서 **내 첫 수정도 틀렸고 테스트가 잡았다**: "아무 게이트나 답하면 리셋" 으로 고쳤는데,
> PLAN 이 답한 것은 REVIEW 의 건강에 대한 증거가 아니다. bypass 된 REVIEW + clean PLAN 조합에서
> 여전히 streak 가 지워졌다. → "degraded 0 **AND** bypassed 0 AND answered 있음" 으로 좁혔다.

출력 파라미터 3개가 되어 `_Outcome` 객체로 정리(INFO #5 도 함께 해소).

### W3 — `_run_gates` 진입 *전* 예외가 관측 밖

`try/finally` 가 게이트 실행만 감쌌다. `_read_payload()`/`_is_git_push()` 예외는 그대로
빠져나가 하네스의 "non-0/non-2 = 허용" 으로 통과되고 **아무 기록도 남지 않았다** — plan 이
말한 3중 fail-open 중 ③이 사실상 미해결이었다. 하필 그 경로가 3라운드 연속 버그가 났던
detection 코드다.

**수정**: `main()` 전체를 감싸고 `DETECTION` 게이트로 계수. 실증 — 탐지에 예외를 주입하면
exit 0(정책 유지) + `DETECTION gate — RuntimeError: …` + streak 1.

### W4 — streak read-increment-write 에 락 없음 (lost update)

**의도적 잔여로 승인하고 코드에 기록**. 근거: **1차 신호인 per-push 배너는 무조건 출력되며 이
레이스에 영향받지 않는다** — 잃을 수 있는 건 누적 카운트뿐이고 최악은 에스컬레이션이 한 push
늦어지는 것이다. 관측용 카운터에 `fcntl.flock` 은 과설계다(저장소가 §G 에서 같은 판단을 한
선례가 있다).

### W5·W6·W7 — 테스트 갭

- W5: 에스컬레이션이 streak 1·2 에서 **나오지 않음**을 단언 추가(`>= 1` 같은 off-by-one 이
  통과하던 상태였다).
- W6: "BYPASS 는 미계수" 계약을 **실제로 깨진 게이트를 bypass** 하는 조합으로 검증
  (`review="import_error"` + `bypass_review=True`). 기존 테스트는 *정상이지만 차단하는* 게이트만
  써서 degradation 경로에 도달조차 안 했다. + W2 회귀 테스트(bypass 가 streak 를 안 지움)와
  비-push 가 streak 를 안 지움까지 추가.
- W7: 양 게이트 동시 degraded → streak 는 **1만 증가**(푸시 단위 계수)하고 stderr·state 에 둘 다
  기록됨을 단언.

### W8 — 모듈 docstring 이 신규 부작용 미언급

Contract 절 뒤에 fail-open 관측 정책 문단 추가(배너·state 경로·연속 카운트·3회 에스컬레이션·
BYPASS 는 리셋 안 함).

### W9 — plan 최상위 체크리스트 E 미동기화

`- [x] E — … 3안(유지 + 관측가능화) 구현 완료` 로 갱신. ([[feedback_stale_plan_claims_and_checklist_sync]]
가 경고한 "체크리스트는 두 군데" 를 또 밟았다.)

## INFO 중 반영한 것

- #5 출력 파라미터 mutate → `_Outcome` 객체.
- #7 `_write_streak(streak, gates)` → `degraded` 로 용어 통일.
- #8 `os.path.exists`+`os.remove` TOCTOU → `try/except FileNotFoundError`.
- #11 `_FAILOPEN_ESCALATE_AT=3` 선정 근거 주석.
- #12 `_state_path`/`_read_streak`/`_write_streak` docstring.

## INFO 중 미반영(사유)

- #1/#2/#3 (예외 메시지 영속화·`CLAUDE_PROJECT_DIR` 미검증·비원자적 쓰기): 대상이 로컬 개발자
  세션 자신(신뢰 경계 내)이고, `_read_streak` 이 모든 파싱 실패를 흡수해 self-heal 된다.
  리뷰어도 전부 "조치 불요".
- #4 `_lib/` 분리: 2번째 소비처가 없다(YAGNI). 생기면 C 항목과 함께.
- #6 게이트 블록 5단계 구조 중복: 이번 diff 이전부터 존재, 3번째 게이트가 생기면 재검토.
- #9/#10 (손상 state 직접 주입 테스트·`CLAUDE_PROJECT_DIR` 미설정 폴백): subprocess e2e 로
  간접 커버되고 우선순위 낮음.
- #13 테스트 모듈 docstring Scope 갱신: 신규 테스트들의 개별 docstring 이 이미 설명한다.

## 검증

- `test_guard_review_before_push_main.py` **32건**, 전체 하네스 스위트 **457건 OK**.
- 뮤턴트: 보고 호출 제거 → 관측 테스트 5/6 포착 / DETECTION catch 제거 → 해당 테스트 포착.
- 수동 e2e: 3회 연속 degrade → 1→2→3 증가·3회차 에스컬레이션, 정상 복구 시 state 삭제.
