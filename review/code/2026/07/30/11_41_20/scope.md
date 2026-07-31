# 변경 범위(Scope) 리뷰 — retry-turn.service.ts / retry-turn.service.spec.ts

## 리뷰 방법

프롬프트에는 두 파일의 "전체 파일 컨텍스트"만 주어지고 unified diff 섹션이 없어(둘 다
`변경 유형: Review`), 실제 변경분을 확인하기 위해 `git diff b351731f0..414550a1d --
<파일>` 로 직전 커밋(`b351731f0`, 원자 claim 도입)과 현재 HEAD(`414550a1d`, 삽입 위치
결함 2건 수정)를 직접 대조했다. 아울러 같은 커밋에 포함된 나머지 파일
(`execution-engine.service.spec.ts`, `plan/in-progress/retry-turn-terminal-guard.md`,
`review/code/2026/07/28/20_32_57/RESOLUTION.md`)도 스코프 판단을 위해 대조 확인했다
(리뷰 payload 밖이지만 같은 커밋이므로 "무관한 파일 수정" 여부 판단에 필요).

## 발견사항

- **[INFO]** 이번 커밋의 모든 변경이 직전 ai-review 처분표(RESOLUTION.md)와 1:1 대응 — 스코프 이탈 없음
  - 위치: 파일 1 전체(특히 `RETRY_STATE_KEY` 상수 정의 42번째 줄, 클래스 docstring
    44~71번째 줄, `applyRetryLastTurn` 재배치 292~356번째 줄, `claimSpawnedRetryRow`
    추출 520~534번째 줄), 파일 2 전체(특히 (c) 테스트 재작성 443번째 줄 부근, 재배달
    회귀 테스트 466번째 줄 부근, (d)/(e) delete 검증 추가 511/528번째 줄 부근)
  - 상세: `git diff -w`(공백 무시)와 공백 포함 diff 의 stat 이 완전히 동일해
    (`216 insertions(+), 61 deletions(-)`, 두 파일 합산) 포맷팅-only 변경이 섞여 있지
    않음을 확인했다. 실질 변경은 정확히 여섯 항목으로 분해되고, 각각이
    `review/code/2026/07/28/20_32_57/RESOLUTION.md` 처분표의 "코드 / 수정" 행과
    1:1 대응한다: (1) CRITICAL #1 — `claimSpawnedRetryRow` 호출을 "`_retryState`
    부재→FAILED" 판정보다 앞으로 이동하고 그 판정 분기 자체를 삭제, (2) CRITICAL #2 —
    claim 성공 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 한 줄 추가,
    (3) W1 — 회귀 테스트 2건(최초부터 이미 claim 당한 흔적 / claim 후 try 진입 전
    예외+재배달 시뮬레이션), (4) W3 — `RETRY_STATE_KEY` 상수화(raw SQL 리터럴 통합),
    (5) W6 — claim 블록을 `private claimSpawnedRetryRow` 로 추출, (6) W9 — 클래스
    docstring·재진입 절차 목록에 2차 claim 단계 반영. 처분표에서 "plan 이관" 또는
    "미조치" 로 명시된 나머지 항목(W2/W4/W5/W7/W10~W12)은 실제로 이 두 파일 diff 에
    전혀 나타나지 않는다 — 코드에 손대지 않고 plan 문서에만 등재된 것과 일치한다.
    import 블록(1~33번째 줄)·설정 파일·무관 코드 영역 수정은 없다.
  - 제안: 없음 (정상 확인, 조치 불요)

- **[INFO]** 같은 커밋에 포함된 3개 부수 파일도 처분표 산출물과 일치 — "무관한 파일" 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    (통합 레벨 테스트 갱신), `plan/in-progress/retry-turn-terminal-guard.md`(§코드 표
    #15~#17 신규 + 6차 라운드 절 추가), `review/code/2026/07/28/20_32_57/RESOLUTION.md`
    (신설)
  - 상세: 리뷰 payload 에는 포함되지 않았으나 커밋 전체 diff(5 files changed)에는
    포함되는 파일들이다. `execution-engine.service.spec.ts` 의 36줄 변경은 W8 처분
    ("claim 실패 케이스 신규 추가 + missing `_retryState` 케이스를 discard 로 갱신")과
    정확히 일치하고, plan 문서 112줄 추가는 W2/W4/W7/백스톱갭 각각을 후속 항목으로
    등재하는 정상적인 plan-lifecycle 기록이며, RESOLUTION.md 신설은 developer
    워크플로가 요구하는 처분 문서 그 자체다. 세 파일 모두 "요청된 변경과 무관한 수정"
    이 아니라 같은 처분표가 낳은 필연적 산출물이다.
  - 제안: 없음 (정상 확인, 조치 불요)

- **[INFO]** 주석/JSDoc 볼륨이 실질 코드 변경(순서 이동 1건 + `delete` 1줄)에 비해 크지만, 반복 회귀 방지를 위한 이 저장소의 의도적 관례
  - 위치: 파일 1의 `applyRetryLastTurn` 재배치 주석(292~365번째 줄 부근)과
    `claimSpawnedRetryRow` JSDoc(470~519번째 줄)
  - 상세: 같은 코드 경로가 이미 5~6 라운드에 걸쳐 "손상 판정"과 "정상 race" 를 반복
    혼동해 살아있는 row 를 FAILED 로 오마킹하는 결함이 재도입된 이력이 있고(주석 자체가
    그 이력을 인용해 재발을 막으려는 목적임을 명시), RESOLUTION.md 의 mutation 5/5
    RED 검증 관례와 같은 계열의 "재발 방지 문서화" 다. 불필요한 주석 추가(점검 관점
    #6)로 보기 어렵다.
  - 제안: 없음 (참고용 기록)

## 요약

`414550a1d`(retry-turn.service.ts/.spec.ts 대상)는 직전 ai-review 6차 라운드가
지적한 CRITICAL #1·#2 두 결함의 수정에 정확히 국한돼 있고, 함께 번들된 W1/W3/W6/W9
네 항목도 그 라운드의 `RESOLUTION.md` 처분표에 "코드 / 수정" 으로 사전 승인된 항목과
1:1 대응한다. `git diff`(공백 포함/무시 양쪽 동일 stat)로 대조한 결과 포맷팅-only
변경, 무관 리팩토링, 사용하지 않는 임포트, 설정 파일 변경은 발견되지 않았고,
`RETRY_STATE_KEY` 상수 도입 후 원본 리터럴 잔존 여부도 점검했으나 주석/로그 문자열
외에는 남아 있지 않다(불완전 리팩토링 아님). 같은 커밋에 포함된 나머지 3개 파일
(엔진 통합 스펙, plan 후속 등재, RESOLUTION.md)도 동일 처분표가 요구하는 산출물이라
스코프 밖 수정으로 볼 수 없다. 변경 범위 관점에서 지적할 사항이 없다.

## 위험도

NONE
