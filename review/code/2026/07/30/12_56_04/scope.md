# Scope Review — retry-turn.service.ts / retry-turn.service.spec.ts

## 조사 방법

리뷰 페이로드가 두 파일의 "전체 파일 컨텍스트"(diff 아님)로 주어져, 실제 변경 범위를
확정하기 위해 `git diff origin/main...HEAD -- <두 파일>` 과 `plan/in-progress/
retry-turn-terminal-guard.md`(이 worktree 의 유일한 관련 in-progress plan, frontmatter
`worktree: retry-atomic-claim-4d9e77`)를 대조했다. 이 plan 은 6~7 라운드에 걸친 ai-review
이력과 각 후속 커밋(`b351731f0`, `414550a1d`, `7a05c6ec8`, `886ca9395`)을 SUMMARY 번호
단위로 추적하는 단일 진실 문서였고, 두 파일의 diff 전 hunk 가 이 문서의 항목과 1:1 로
대응되는지 확인했다.

## 발견사항

- **[INFO]** 새로 추가된 `claimSpawnedRetryRow` JSDoc·`applyRetryLastTurn` 본문 인라인
  주석의 절대량이 크다(주석 ~60줄 vs 실제 SQL 로직 12줄).
  - 위치: `claimSpawnedRetryRow` 함수 (RetryTurnService, gate 538-552 및 그 위 JSDoc
    486-537) / `applyRetryLastTurn` 의 claim 삽입 블록 (gate 322-368)
  - 상세: 다만 각 문단은 전부 이번 작업 범위 내에서 실제로 발견·수정된 결함(CRITICAL
    #1: claim 을 손상 판정보다 먼저 실행해야 하는 이유, CRITICAL #2: in-memory
    delete 로 TypeORM jsonb 부활을 막는 이유, W2/W6/W9: 백스톱 갭·payload 영향·버전
    방어 정정)을 정확히 지목하고 있어 "무관한 주석"(점검관점 6)에 해당하지 않는다.
    plan 문서 §코드 표 #12 가 이미 유사한 패턴(`finalizeGuarded` 멱등 분기의 회고
    주석 ~40줄)을 "안정화 후 정리" 대상으로 추적 중이며, 이번 라운드에서 그 방침을
    그대로 따른 것으로 보인다 — 신규 스코프 이탈이 아니라 이 코드베이스가 반복 채택
    중인 기존 패턴(관찰: 결함 재발 방지를 위한 근거 주석 누적 우선, 정리는 후순위)이다.
  - 제안: 조치 불필요. 향후 안정화 라운드에서 `finalizeGuarded`(#12)와 함께 일괄
    정리 대상으로만 계속 추적.

- **[INFO]** `RETRY_STATE_KEY` 상수 도입이 `retryLastTurn`(기존 리터럴 2곳)과
  `applyRetryLastTurn`/`claimSpawnedRetryRow`(신규 리터럴 2곳) 총 4곳을 동시에
  건드려, 언뜻 "이번 작업과 무관한 기존 코드 리팩토링"(점검관점 2)으로 보일 수 있다.
  - 위치: `RETRY_STATE_KEY` 선언 (gate 42), `retryLastTurn` 사용처 (gate 163, 205,
    213, 220), `claimSpawnedRetryRow` 사용처 (gate 544, 549)
  - 상세: 이번 diff 자체가 동일 리터럴을 2곳 더 추가해 총 중복 지점을 4곳으로
    늘렸으므로("한쪽만 리네임되면 조용히 drift 한다"는 리스크는 이번 작업이 만든
    것), 신규 2곳만 상수화하면 리스크를 절반만 닫는 셈이 된다. `review/code/2026/
    07/28/20_32_57`(6R) WARNING #3 이 명시적으로 "raw SQL 리터럴 4곳(신규 2 + 기존
    2) + TS 프로퍼티 접근 통합"을 같은 라운드의 "함께 조치(저비용)" 항목으로
    지시했다 — developer 가 임의로 벌인 리팩토링이 아니라 지시된 저비용 결합
    수정이다.
  - 제안: 조치 불필요(이미 정당화된 변경).

- **[INFO]** (참고, 미재확인 대상) 6R RESOLUTION 이 "무관 plan 문서 편집 2건이 이미
  `b351731f0` 에 같은 커밋으로 포함됨 — 되돌리지 않음, 기록만"이라고 이미 스코프
  이슈를 기록해 두었다. 이는 `plan/`·`spec/` 문서 파일에 대한 것으로, 이번 리뷰
  대상인 `retry-turn.service.ts`/`retry-turn.service.spec.ts` 두 파일 자체에는
  해당하지 않는다 — 재조사하지 않았고, 새 발견으로 재기재하지 않는다.

## 커밋 단위 대조 (7R 이후 최신 2건)

가장 최근 두 코드 커밋(`7a05c6ec8`, `886ca9395`)은 `review/code/2026/07/30/11_41_20/
RESOLUTION.md` 의 처분표(SUMMARY #2/#3/#4/#6/#9)와 완전히 1:1 대응된다.

- `7a05c6ec8`(주석 전용, 30 insertions/12 deletions) — RESOLUTION #2(백스톱 자기모순
  정정)·#3(stale `runAiConversationLoop` 참조 정정)·#6 절반(JSDoc 명시)·#9(typeorm
  버전 주석 다듬기) 그대로. 코드 로직 변경 0줄 — 순수 문서 정정.
- `886ca9395`(테스트 전용, 62 insertions/1 deletion) — RESOLUTION #4(claim 성공+
  in-memory 부재 방어분기 회귀 테스트)·#6 나머지 절반(NODE_STARTED payload 회귀
  테스트 + `NodeEventType` import) 그대로. 프로덕션 코드 변경 0줄.

두 커밋 모두 지시된 항목 외의 추가 수정(다른 메서드 손질, 포맷팅, 미사용 임포트,
설정 변경)이 없다.

## 전체 diff 대조 (origin/main 기준, 4개 코드 커밋 누적)

`b351731f0`→`414550a1d`→`7a05c6ec8`→`886ca9395` 로 이어지는 전체 diff(retry-turn.
service.ts 190줄, .spec.ts 212줄)를 hunk 단위로 대조한 결과, 모든 변경이 다음 중
하나로 귀속된다:

1. 2차 원자 claim(`claimSpawnedRetryRow`) 신설과 `applyRetryLastTurn` 진입 순서
   재배치 (P1 본 작업).
2. 그 claim 이 후속 ai-review 6R/7R 에서 드러낸 결함 2건(살아있는 delivery 오판,
   jsonb 부활)의 수정.
3. 위 1·2 를 검증하는 회귀 테스트(behavior-lock) 추가.
4. 위 변경을 반영한 JSDoc/docstring 정정(stale 참조 제거 포함).

`finalizeGuarded`/`completeRetryExecution`/`failRetryExecution`/
`resumeGraphAfterRetry`(종결 2경로 가드, `#1022`/`#1024` PR 산출물)는 이번 diff
hunk 에 전혀 나타나지 않아 — 이번 작업이 그 영역을 건드리지 않았음을 확인했다.
`markSpawnedRowFailed` 추출(plan §코드 표 #9, 반복 3회 지적)처럼 이미 지적됐지만
이번 라운드 지시 범위 밖인 항목은 실제로 손대지 않은 채 남아 있어, "지시된 것만
정확히 수행"하는 규율이 유지되고 있다.

## 요약

두 파일의 전체 diff(origin/main 대비 4개 코드 커밋 누적)와 최신 2개 커밋(7R
resolution) 모두, `plan/in-progress/retry-turn-terminal-guard.md` 에 기록된 승인된
작업 항목·ai-review RESOLUTION 처분표와 hunk 단위로 완전히 대응된다. 의도 이상의
변경, 무관한 리팩토링, 요청 없는 기능 확장, 무관한 파일/코드 영역 수정, 포맷팅과
뒤섞인 실질 변경, 불필요한 주석, 미사용 임포트, 의도치 않은 설정 변경 — 8개 점검
관점 중 어느 것도 새로운 위반을 발견하지 못했다. 유일하게 눈에 띄는 패턴(주석
누적)은 이미 plan 문서가 별도 항목(§코드 표 #12)으로 추적 중인 기존 정책이며 이번
diff 가 그 정책을 확장 적용한 것이지 신규 이탈이 아니다.

## 위험도

NONE
