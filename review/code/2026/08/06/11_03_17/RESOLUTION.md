# RESOLUTION — 5R (harness-review-ci-backstop)

리뷰어 14/14 성공. **CRITICAL 3 / WARNING 10.** RISK=CRITICAL.
5명이 독립 mutation 으로 실증했다.

## 다섯 라운드째 같은 형태 — 우회가 한 층 밖으로 이동한다

4R 에서 `review-gate.yml` **문서 전체**를 고정해 그 파일 안에는 열린 필드가 없어졌다.
그래서 이번엔 그 방어를 **CI 에 실어 나르는 층**과 **스크립트 입력 축**으로 옮겨갔다.

| # | 우회 | 왜 통과했나 |
|---|---|---|
| C1 | `harness-checks.yml` job 에 `if: false` / `continue-on-error` | 그 불변식이 `review-gate.yml` **한 파일에만** 걸려 있었다. 이게 무력화되면 하네스 826개 전부가 조언으로 격하된다 |
| C2 | discovery 패턴을 `test_[!r]*.py` 로 한 글자 좁힘 | **"파일이 옳다" 와 "CI 가 그 파일을 부른다" 는 다른 사실**이다. 가드 11개가 영원히 안 도는데 개별 실행하면 전부 GREEN |
| C3 | `os.environ["GITHUB_ACTOR"] == …` 조기 return / `REVIEW_GATE_SKIP` override / actor 화이트리스트 | 전부 **비-Call 접근**(Subscript/Compare/IfExp)이라 호출 허용 목록을 통과했고, 행위 테스트는 `{**os.environ}` 으로 부모 환경을 상속해 **재현 자체가 불가능**했다 |

C1 의 `continue-on-error` 절반은 리뷰가 도는 동안 main 이 독립적으로 찾아 이미 닫았다
(`14ca978c4`) — 같은 패턴을 예상하고 한 층 밖을 먼저 본 결과다. 리뷰어 4명이 그 미커밋
상태를 관측하고 보고만 했다(손대지 않음).

## 처분

- **C1 잔여** — job 레벨 `if:` 는 정당한 쓰임이 있어(봇 면제) 금지가 아니라 **등재제**로 뒀다.
  등재되지 않은 조건이 나타나면 실패하고, 등재하는 순간이 "이게 게이트를 끄는 조건인가" 를
  사람이 판단할 자리다. 죽은 등재도 실패시킨다.
- **C2** — 하네스 스위트를 부르는 명령을 **정확 일치**로 고정하고, 그 패턴이 실제
  `test_*.py` 전부를 덮는지도 대조한다.
- **C3** — 두 축을 함께 닫았다. (1) 정적: `environ`/`getenv`/`argv`/`putenv` 접근 금지 —
  이 스크립트의 입력은 argparse 가 전부라 유한하다. (2) 행위: 부모 환경 상속을 없애
  **최소 명시 환경**으로 돌리고, `GITHUB_ACTOR`/`REVIEW_GATE_SKIP` 등을 채운 **적대적 환경**
  에서도 같은 표가 나오는지 함께 본다.

## WARNING 처분

| # | 내용 | 처분 |
|---|---|---|
| W4 | `harness-checks.yml` 주석이 "두 가드" 만 나열 — `WorkflowWiringTest` 가 세 번째로 이 glob 폭에 의존 | 세 번째 항목 등재 |
| W5 | README 가 4R 이전(이미 뚫린) 수준 서술에 머묾 | 4세대 이력 + 두 한계 명시로 재작성 |
| W6 | advisory 문자열 한 곳만 `\uXXXX` escape 라 `grep "하향 감지"` 가 건너뜀 | 리터럴로 통일 |
| W9 | pyyaml pin 정규식이 큰따옴표만 인식 — 홑따옴표/무인용은 "다르다" 가 아니라 **안 잡혀 조용히 통과** | 세 형태 인식 + "언급했는데 못 읽은 파일" 검출 추가 |
| W1·W3·W7·W8·W10 | harness-checks `concurrency` 미검증 · pin 하한 미검증 · 테스트 메서드 책임 과다 · `evaluate_review` 성능 상한 · 스텁 경계 문서화 | 미처분 — 별도 범위이거나 이 PR 의 결함이 아님 |

## 검증

- harness 스위트 **829 tests OK**.
- mutation **4종 전부 RED** (전부 사본에서 실행):
  `harness-checks job if: false` · discovery 패턴 좁힘 · `os.environ` 조기 return ·
  `REVIEW_GATE_SKIP` 로 판정 override.
