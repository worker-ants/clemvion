# 변경 범위(Scope) 리뷰 — retry-ie-residuals-c4a1b2 (3라운드)

## 배경 확인

`git log --oneline -3` = `91c817608`(리뷰 2R 조치) → `15374b657`(리뷰 1R 조치) →
`59dd12869`(원 수정). 이번 프롬프트는 `origin/main...HEAD` 누적 diff(11개 코드/plan 파일 +
직전 두 라운드 review 산출물 28개)를 담고 있다 — 1·2라운드와 동일한 방식으로 매 라운드 전체
누적 diff 를 재검토하는 이 저장소의 표준 절차와 일치한다. `git show --stat 91c817608` 로
이번 라운드에서 **새로 추가된 코드**만 별도로 대조했다.

## 발견사항

- **[INFO]** 3라운드(`91c817608`)의 실질 코드 변경은 정확히 4곳, 전부 2라운드 SUMMARY 의
  WARNING 1건 + INFO 3건에 1:1 대응한다 — 스코프 이탈 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts`
    (신규 `phase` assertion, `git show 91c817608` 기준 +5줄) ·
    `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
    (`assertLinkedTransitionApplied` JSDoc 계약에 마킹-실패 흡수 서술 4줄 추가) ·
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    (`markSpawnedRowFailed` JSDoc 에 `@param spawnedRow` 2줄 추가)
  - 상세: `git show --stat 91c817608` 로 확인한 코드 파일 변경분은 3개 파일 총 11줄
    삽입뿐이다(review 산출물 커밋 제외). 커밋 메시지가 예고한 "WARNING 1건(중복 등재 상호
    참조, plan 문서만) + INFO 3건(phase 로그 단언·JSDoc 계약·@param 태그)"과 실제 diff 가
    정확히 일치함을 직접 대조했다. 새로운 함수·분기·설정 변경은 없다.
  - 제안: 없음(정상).

- **[INFO]** plan 문서 2건(`ie-resume-turn-boundary-cancel.md`,
  `retry-turn-terminal-guard.md`)의 이번 라운드 편집도 코드 변경과 1:1 대응하며, 낡은 실측
  문장은 삭제 대신 취소선으로 보존한다 — CLAUDE.md 의 plan 위생 관행과 일치.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md`(`### 정정 (C-4 리뷰 2R)` 섹션 신설,
    `INFO 2`/`W3` 체크박스 전환) · `plan/in-progress/ie-resume-turn-boundary-cancel.md`
    (`markExecutionFailed` 항목에 리뷰어 제안 한 줄 추가)
  - 상세: `git diff origin/main...HEAD -- plan/in-progress/retry-turn-terminal-guard.md` 전문을
    직접 읽어 대조 — 새로 체크(`[x]`)된 두 항목(1차 라운드 INFO 2, 이하 W3)이 정확히 이번
    코드 변경(`@param spawnedRow` 추가)의 근거이고, 원문은 `~~취소선~~` 으로 남아 "무엇이
    거짓이 됐는지" 추적 가능하다. `markExecutionFailed` 항목에 붙은 리뷰어 제안 한 줄은
    실행이 아니라 **다음 착수자를 위한 스코프 메모**로, 이번 PR 이 그 리팩터에 손대지 않았음을
    확인했다(코드 diff 에 `markExecutionFailed` 관련 변경 없음).
  - 제안: 없음.

- **[INFO]** `retry-turn.service.spec.ts` 신규 테스트 5건(원자 consume SQL 가드 1건 +
  edge-case 3건 + `error` 클리어 회귀 2건, 이번 프롬프트 diff 생략분을 `git diff` 로 직접
  확인)도 모두 두 plan 트래커의 체크리스트 항목(W6, INFO 14, INFO 2)에 1:1 대응하며, 각
  fixture 가 실제로 해당 분기를 가르는 값으로 구성돼 있다(예: `retryAfterSec` 를 `details`
  에서 빼고 `_retryState` 에만 남겨 fallback 경로를 강제).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
    (신규 `'원자 consume 이 jsonb_exists 가드와…'`, `'rejects with INVALID_EXECUTION_STATE…'`,
    `'reads retryAfterSec from _retryState…'`, `'skips the retryAfterSec countdown…'`,
    `'자연 종결이 이전 시도의 error 를 비운다…'`, `'fallback 종결(completeRetryExecution)도…'`)
  - 상세: 요청 범위를 벗어난 무관한 테스트 추가나 리팩터는 없음.
  - 제안: 없음.

- **[INFO]** `review/code/2026/09/01/17_55_50/**`·`review/code/2026/09/01/18_13_45/**`
  (직전 두 라운드 리뷰 산출물, 총 28개 파일)이 이번 changeset 에 신규 파일로 포함돼 있다 —
  1·2라운드 scope 리뷰가 이미 같은 사실을 지적하고 "저장소 표준 절차, 조치 불요"로 처분했다.
  - 위치: `review/code/2026/09/01/17_55_50/*`, `review/code/2026/09/01/18_13_45/*`
  - 상세: CLAUDE.md 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
    규약과 일치하고, 각 라운드의 `RESOLUTION.md` 가 다음 라운드 조치의 직접 근거로 참조된다.
    무관한 파일 번들링이 아니다.
  - 제안: 없음(재확인, 신규 결함 아님).

- **[INFO]** (참고, 스코프 밖) `retry-turn-terminal-guard.md` 의 "C-4 처분" 문단이 본문에
  "남긴 **6**건의 사유" 라고 쓰면서 바로 아래 표는 7행이다(6개 남긴 항목 + `~~1R INFO
  2~~`라는 "닫혔다"는 설명용 1행). `grep -c '^\s*- \[ \]'` 실측은 6으로 본문 수치와는
  일치하지만, 표 행수(7)와는 얼핏 어긋나 보인다.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md` (`## C-4 처분 (2026-09-01)` 표,
    특히 취소선 처리된 마지막 행 `~~1R INFO 2 (finalizeGuarded 부수효과)~~`)
  - 상세: 그 행 자체의 설명("남긴 것이 아니라 2R 에서 닫혔다")이 왜 표에는 있지만 "남긴 건수"
    에는 안 들어가는지를 명시하므로 사실관계 오류는 아니다. 다만 "표 = 남긴 항목 목록"이라는
    독자의 기본 가정과 어긋나는 형태라 오독 여지가 남는다. scope 관점의 이탈은 아니고
    documentation/requirement 리뷰어 영역에 더 가까워 조치를 요구하지 않는다.
  - 제안: 조치 불요(참고 기록). 다음에 이 표를 손댈 때 "닫힌 항목"을 별도 각주나 표 밖
    문단으로 분리하면 더 명확해진다.

## 요약

이번 3라운드 changeset 은 직전 라운드(`18_13_45`) SUMMARY 의 WARNING 1건 + INFO 3건만을
정확히 겨냥한 초소형 조치다(`git show --stat 91c817608` 기준 코드 3파일 11줄). 코드
변경(`ai-turn-orchestrator.service.ts` JSDoc 계약 보강, `retry-turn.service.ts` `@param` 태그,
`ai-turn-orchestrator.service.spec.ts` phase 단언)은 전부 plan 체크리스트 항목에 1:1
대응하고, plan 문서 편집은 낡은 실측을 취소선으로 보존하는 이 저장소의 관행을 지킨다. 누적
diff 전체(1·2라운드 코드 + review 산출물 28개 커밋)를 다시 훑어도 요청 범위를 벗어난 리팩터·
기능 확장·무관한 파일 수정·의미 없는 포맷팅/주석/임포트 변경은 발견되지 않았다 — 이는 1·2라운드
scope 리뷰의 결론과도 일치한다. 유일한 참고 사항은 plan 문서 표의 행수 표기가 얼핏 수치와
어긋나 보이는 문서 서술 방식(사실관계 오류 아님)으로, scope 게이트를 막을 사유가 아니다.

## 위험도

NONE
