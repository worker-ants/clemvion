# RESOLUTION — ② push 가드 blind + allowlist

리뷰: `review/code/2026/07/23/14_23_23/SUMMARY.md` — **RISK=CRITICAL, Critical 3, Warning 3**.
forced(router_safety) 8명 전원 결과 확보(`forced_missing: []`).

리뷰가 옳았다. **주장만 믿지 않고 3건 전부 직접 재현한 뒤** 고쳤다. 셋 다 설계(blind 1차 +
빼기만 하는 allowlist)의 문제가 아니라 **해제 규칙 하나(`_MESSAGE_ARG`)의 결함**이었다 —
이 plan 이 "인용을 아는 정밀 판정은 무한 표면" 이라고 경고한 바로 그 함정이다.

## Critical (3) — 전부 재현 → 수정 → 회귀 고정

### C1 (SECURITY) — 홑따옴표 이스케이프 오판정 = 게이트 완전 우회

POSIX 셸은 `'…'` 안에서 이스케이프를 처리하지 않는다(첫 `'` 가 항상 닫고, 홑따옴표 자체를
넣을 수도 없다). 그런데 `_MESSAGE_ARG` 는 겹따옴표 규칙(`\\.` = 이스케이프 쌍)을 양쪽에
적용했다. 그래서 값이 홀수 개 백슬래시로 끝나면 본문이 **다음 홑따옴표까지** 늘어난다.

**재현(수정 전)**: `git commit -m 'a\' && git push -- 'end'`
→ redact 결과 `git commit -m '                   'end'` — 실행되는 `&& git push --` 가 **소실**,
`_is_git_push=False`. 미검토 코드가 그대로 push 된다.

**수정**: 인용 종류별 본문 분리 — `'` 는 `[^']*`(셸 의미와 정확히 일치), `"` 만 이스케이프 쌍 인정.
**재현(수정 후)**: redact 결과 `git commit -m '  ' && git push -- 'end'`, `_is_git_push=True`.

### C2 (SIDE_EFFECT/PERFORMANCE) — 파국적 백트래킹으로 훅 정지

`(?:\\.|(?!(?P=q)).)*` 의 두 대안이 **백슬래시에서 겹친다**. 닫는 따옴표가 없으면 엔진이
지수적으로 탐색한다. 이 훅은 PreToolUse 로 **모든 Bash 호출을 동기 게이팅**하므로 hang =
세션 정지(또는 하네스 타임아웃에 의한 fail-open).

**재현(수정 전)**: 백슬래시 2개마다 ~2.5배 — 16개 0.001s / 20개 0.005s / 22개 0.013s / 24개 0.033s.
**수정**: 두 대안을 **서로소**로 — 폴백이 백슬래시를 배제(`[^"\\]`).
**재현(수정 후)**: 40개·200개·500개 전부 0.00004s 이하(선형).

### C3 (TESTING) — 메시지 blanking 이 살아있는 확장을 드러냄

메시지를 지우면 legacy 의 **우연한** 매치가 사라지는데, 그 아래에 blind 가 애초에 못 잡던
**살아있는 `$(git push …)`** 가 있으면 차단이 조용히 통과로 뒤집힌다.

**재현(수정 전)**: `git commit -m "fix: retry push notification bug" && echo "log: $(git push origin main)"`
→ legacy=True, new=**False**. `$(git push …)` 는 셸이 실제로 실행한다.

**수정**: 종전엔 매칭된 body **국소 범위**만 inert 검사했다 → **명령 전체**에 확장 토큰
(`$(`·백틱·`${`)이 하나라도 있으면 **해제 자체를 보류**한다. 비용은 "확장이 함께 있는 명령의
정직한 메시지도 차단"(오탐 = 안전 방향)이며 그 비용을 숨기지 않고
`test_message_beside_any_expansion_is_conservatively_blocked` 로 고정했다.

## Warning (3) — 전부 반영

| # | 카테고리 | 조치 |
|---|----------|------|
| 1 | Architecture | 두 훅의 판정 로직 격차 확대 → 항목 C 는 이번 PR 밖 defer(리뷰어도 "합리적" 판정). followups plan 에 **선행 해소 + 공유 형태**(1차 패턴은 각자, redaction 만 공유)까지 기록해 조기 착수 가능 상태로 만들어 뒀다. |
| 2 | Maintainability | `CORPUS`/`RELEASED` 이중 SoT → `CORPUS` 를 `(command, note, release_reason)` 3-필드로 재구성하고 `RELEASED` 는 거기서 **파생**. 명령 리터럴이 한 곳에만 존재한다. |
| 3 | Testing | `git tag … -F -` 해제 경로 무테스트 → 코퍼스에 tag heredoc 해제 1건 + **tag 판 소유 세그먼트 위장 거부** 1건 추가, `ReleaseTest.test_tag_heredoc_body_is_released` 도 추가. |

## INFO 중 반영한 것

- #6 빈 heredoc 본문 경계 → `test_empty_heredoc_body_terminates_and_keeps_the_real_push`.
  (초안은 이걸 "해제" 케이스로 넣었다가 **legacy 가 애초에 차단하지 않는 입력**이라 전제가
  틀렸음을 테스트가 잡아냈다 → 무한루프 방지 + 뒤따르는 진짜 push 유지 검사로 교정.)
- #8 `_is_git_push()` 요약 독스트링 추가.

## INFO 중 미반영(사유)

- #1(규칙 순서 의존성 문서화)·#5(길이 보존 불변식 주석)·#7(`-F "path"` 의미 차이 주석):
  코드 주석 밀도는 이미 높고, 세 건 다 동작 영향 없음. Critical 수정에 집중.
- #2(테스트가 private 멤버 결속): **의도된 pinning** 이라고 리뷰어도 명시. `_lib/` 추출 시 함께 갱신.
- #3(공백 줄 3개)·#4(`re.VERBOSE` 전환): 스타일. #4 는 오히려 정규식을 건드리는 리스크.
- #9(모듈 독스트링에 설계 안내): 설계 설명은 `_GIT_PUSH` 바로 위 주석 블록에 있고 거기가
  발견 지점으로 더 자연스럽다.
- #10(`main()` 3중 fail-open): 선재 정책, plan §E 가 추적 중. 범위 밖.

## 비-vacuity

수정 후 뮤턴트로 재확인(치환 적용·문법 검사 선행):

| 뮤턴트 | 결과 |
|--------|------|
| 인용 종류별 분리 되돌림(옛 모호 패턴) | 3 failures — C1 PoC·홑따옴표 해제·메시지 해제 테스트가 포착 |
| `[^"\\]` → `[^"]`(겹침만 재도입) | `BacktrackingTest` 30초 내 3 failures |
| 명령 전체 inert 검사 제거 | 4 failures — C3 회귀 테스트가 포착 |

**테스트 설계 교훈**: 초판 ReDoS 테스트는 호출이 **반환된 뒤** 시간을 재서 진짜 hang 을
실패가 아니라 무한 정지로 만들었다(뮤턴트 실행이 2분에 강제 종료돼 발견). 파국적 백트래킹은
C 레벨 `re` 안에서 일어나 시그널도 안 받는다 → **서브프로세스 + 하드 타임아웃**으로 교체.

## 검증

- `test_push_guard_allowlist.py` 25건, 전체 하네스 스위트 **367건 OK**.
- 게이트 스텁 프로세스 레벨 e2e: 진짜 push 3종 차단, 오탐 3종 통과.
- 리뷰 권고 4번("CRITICAL 수정·회귀 확보 전 진행 금지") 준수 — 수정과 회귀 테스트를 모두
  확보한 뒤 fresh 재리뷰를 돌린다.
