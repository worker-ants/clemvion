# RESOLUTION — 18_21_05 (라운드 7) · **수렴**

**CRITICAL 0 · WARNING 1 — 조치했고, 여기서 닫는다.** 조치가 **`plan/**` 에만** 닿으므로
§정지 규칙대로 수렴이다(`newest_code` 는 `codebase/**` 만 센다 → 리뷰가 낡지 않는다).

**이 라운드는 게이트가 요구한 것이다.** 라운드 6의 조치를 커밋한 뒤 `review_guard` 가
*"14 codebase/ file(s) changed AFTER the most recent resolved review"* 로 push 를 막았다 —
리뷰어가 **최종 코드를 본 적이 없기** 때문이다. 그래서 한 번 더 돌렸고, 그 결과
**10개 reviewer 전원이 `codebase/**` 에 대해 NONE** 을 냈다.

## 조치

| # | 분류 | 조치 |
|---|---|---|
| W1 | 문서 (plan 내부 모순) | 뮤테이션 개수 표기를 **9**로 통일 (`증거` 문단 · 소제목) |

### 같은 실수를 두 번 했다 — 그래서 SoT 를 지정했다

라운드 2 가 *"3종/5종 혼재"* 를 잡아 6종으로 통일했는데, 내가 뮤턴트 3개를 더 돌리고
**세 자리 중 한 곳만** 갱신해 재발시켰다. 숫자를 세 곳에 적는 형태가 원인이므로 표를
**개수의 SoT** 로 못박고 산문은 표를 가리키게만 했다.

## 이월 (INFO — 전부 트래커 또는 스코프 밖)

`15-chat-channel.md` glob 확장(planner) · `swagger.md §5-1` 규약 프로즈 + 가드 `code:` 등재
(planner, 이번에 신규 등재) · `ParseUUIDPipe` · 요청 바디 DTO · `response-contract` 배선 ·
`throwInvalidField` 넓은 타이핑 · 가드 대조군 정렬 값 단언 · frontend 부가 필드 미소비 ·
유저 가이드 MDX 오기.

## 공유 워크트리 오염 — 이번에도 관측됐고, **이번엔 해소까지 확인됐다**

`user_guide_sync` 가 검토 중 미커밋 뮤테이션을 관측했고 `testing` 이 *"자신이 검증용으로
만들었다 원복했다"* 고 적었다. summary 가 `git status` 로 워킹트리 clean 을 직접 재확인했다.
**리뷰어끼리의 오염**이라는 축은 트래커 항목에 이미 누적해 뒀다.

## TEST

- 이 라운드 이후 `codebase/**` 변경 **0** — 직전 4단계 `ALL PASS` (lint · unit · build ·
  e2e 305) 가 그대로 유효하다
- `--impl-done` `review/consistency/2026/09/12/18_08_30` **BLOCK: NO**
