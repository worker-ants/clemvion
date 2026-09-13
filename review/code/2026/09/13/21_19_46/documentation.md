# 문서화(Documentation) 리뷰 — error-code-emission-axis (라운드 6, `21_19_46`)

## 검토 방법

이 배치는 이미 5라운드(`19_23_22`→`19_51_33`→`20_13_13`→`20_34_32`→`20_57_13`)의
`/ai-review`+`--impl-done`을 거쳤고, 각 라운드의 documentation 리뷰가 지적한 항목(카탈로그
탈출구 자기모순 CHANGELOG, plan 체크박스, `where` 프리텍스트, `isMessagePrefixOnly` 서술
불일치, JSDoc 자기모순 개명 이력)이 모두 후속 커밋에서 실제로 해소됐음을 각 라운드
documentation.md·RESOLUTION.md 대조로 확인했다. 이번 라운드는 **직전 라운드(`20_57_13`)
이후 마지막 수정 커밋 `2931d921f`**(`git diff 57288e47f..2931d921f`)가 새로 들여온 코드·문서만
독립적으로 재검증했다 — 그 이전 5라운드분(수집기 3종, `isMessagePrefixOnly`, `parseWhereRefs`,
`staleGuideEntries` 등)은 로직이 이번 커밋에서 바뀌지 않았고 앞선 라운드들이 이미 문서 정확성을
반복 검증했으므로 재조사하지 않았다. 저장소 파일은 건드리지 않았다(읽기 전용, `git status
--short` clean 확인).

## 발견사항

- **[WARNING]** 라운드 5 수정이 새로 추가한 설계 근거 주석이 **옛 코드의 `.filter()` 호출
  횟수를 실제보다 하나 많게** 서술한다 — "네 번/네 개"라고 두 파일에서 반복하지만 실제로는
  세 번이었다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:462-463`
    (`computeNonEmittedOffenders` JSDoc), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:202`
    (같은 사실을 서술하는 인라인 주석)
  - 상세: 두 곳 모두 "베이스라인 단언은 `.filter(...)` 를 **네 번** 이어 붙였고"(scan.ts:462-463) /
    "종전엔 이 자리에서 `.filter(...)` **네 개**를 손으로 이어 붙였고"(existence.test.ts:202)
    라고 적는다. 그런데 라운드 5 커밋(`2931d921f`)의 diff 로 직접 확인한 **삭제된 실제 코드**는
    ```
    const offenders = [...new Set(citations.map((c) => c.token))]
      .filter(prefixOnly)
      .filter((t) => !catalogCodes.has(t))
      .filter((t) => !registeredNonEmitted.has(t))
      .sort();
    ```
    로 `.filter(...)` 호출이 **세 번**(`prefixOnly` · `!catalogCodes.has` · `!registeredNonEmitted.has`)
    이고 `.sort()`는 필터가 아니다. 새로 만든 `computeNonEmittedOffenders` 자신도 정확히
    `.filter()` 세 번짜리 체인이다(scan.ts:480-486, 직접 대조). 추정컨대 offender 판정식
    `인용됨 ∧ 접두-전용 ∧ ¬카탈로그 ∧ ¬등록`(scan.ts:459, 항이 4개)의 "네 항"과 옛 코드의
    "`.filter()` 호출 횟수"를 혼동한 것으로 보인다 — "인용됨"은 `[...new Set(...)]`으로 만든
    입력 집합 자체이지 별도 `.filter()` 호출이 아니다. 이 세션 자신이 반복 기록해 온
    "설계 근거는 쓰기 전에 뮤테이션/실측으로 검증하라"·"제목/개수 세기가 실제와 다르게
    반복됐다" 패턴과 같은 형태이며, 이번엔 그 근거가 **git diff로 바로 셀 수 있는 수치**임에도
    두 파일에 걸쳐 동일하게 틀렸다.
  - 제안: `.filter(...)` 를 **네 번**/**네 개** → **세 번**/**세 개**로 정정. (내용상 문제된
    결함 자체나 수정 방향에는 영향 없음 — 오직 "옛 코드가 얼마나 반복적이었나"를 서술하는
    수치만 부정확하다.)

## 확인 후 문제 없음으로 판단한 항목 (직전 라운드 지적의 해소 여부 재검증)

- **JSDoc 자기모순 개명 이력**(`20_57_13` documentation WARNING — "`staleGuideEntries` 로
  바꿨다, 첫 판도 `staleGuideEntries` 였는데") — `guide-identifier-existence.test.ts:67`을
  직접 열어 "첫 판은 `staleEntries` 였는데"로 정확히 정정됐음을 확인했다. `grep -n
  "staleGuideEntries\|staleEntries"`로 전수 대조한 결과 함수 선언(`:74`)·모든 호출부·이
  JSDoc 한 곳만 원래 이름을 언급해야 하는 자리이고, 지금은 그 한 곳만 정확히 옛 이름
  (`staleEntries`)을 쓴다 — 재발 없음.
- **plan 트래커 항목(3394) 미체크** — `spec-draft-nullable-notation-followups.md`에서
  해당 체크박스가 `[x]`로 바뀌었고, 술어가 왜 원안(AST 처분)과 다르게 착지했는지를 두 차례의
  반증 이력과 함께 설명하는 문단이 새로 추가됐음을 확인했다. 자매 항목(3404, 라운드 1에서
  이미 닫힘)과의 불균형도 해소됐다.
- **`computeNonEmittedOffenders` 정본 통합 자체의 JSDoc**(scan.ts:455-470) — 리뷰어가
  뮤테이션으로 관측한 사실(카탈로그 필터 삭제 뮤턴트가 정본 통합 **후에도** 생존)과 그 원인
  (실코퍼스에서 «접두 전용 ∩ 카탈로그»가 공집합이라 원리적으로 실코퍼스 기반 테스트로는
  못 잡음)을 정확히 서술하고 있고, `plan/in-progress/error-code-emission-axis.md`의 "I. 라운드
  5" 절 서술과도 문장 단위로 일치한다(반증 실측 표 포함).
- **CHANGELOG.md**(Unreleased 최상단 항목) — 라운드 5의 내부 리팩터(수집기 정본 통합,
  `computeNonEmittedOffenders` 추출)는 유저 가이드 문장·가드의 대외적 동작(허용/차단 기준)을
  바꾸지 않는 테스트 하니스 내부 구조 변경이라, 앞선 4라운드에서도 같은 성격의 리팩터(수집기
  3종 추출, `isMessagePrefixOnly` export 승격, `parseWhereRefs`/`staleEntries` 도입)에
  CHANGELOG 갱신을 요구하지 않은 것과 동일한 기준으로 판단해 이번에도 갱신 불필요로 본다.
- **가드 스위트 카운트 "71 → 76" 표기**(plan §I 말미) — `it(` 리터럴 개수를 직접 세어 대조한
  결과와 일치한다.

## 요약

라운드 5 수정 커밋(`2931d921f`)이 지난 라운드의 WARNING(JSDoc 자기모순 개명 이력) 두 건과
미체크 트래커 항목을 정확히 해소했음을 확인했다. 다만 그 수정이 새로 추가한 설계 근거 주석
자체에서 새로운 국소적 오류를 하나 발견했다 — 옛 코드의 `.filter()` 체인 길이를 "네 번/네 개"로
서술했지만 실제로는 "세 번/세 개"이며, 이는 판정식의 항 개수(4개)와 필터 호출 횟수(3개)를
혼동한 것으로 보인다. 두 파일(구현 JSDoc·테스트 인라인 주석)에 동일하게 반복돼 있어 단순
오타가 아니라 서술 자체의 오류다. 내용상 결함 진단이나 수정 방향에는 영향이 없는 수치
오류이지만, 이 저장소가 정확히 이런 형태의 "검증 안 된 근거 서술"을 여러 차례 반증해 온 이력이
있어 WARNING으로 표기한다. 그 외 CHANGELOG·PROJECT.md·plan·mdx 문서는 모두 최신 코드 상태와
정확히 일치하며 새로운 CRITICAL 급 문서화 결함은 없다.

## 위험도

LOW
