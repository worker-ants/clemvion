# 문서화(Documentation) 리뷰 — error-code-emission-axis (라운드 7, `21_41_23`)

## 검토 방법

이 배치는 이미 6라운드(`19_23_22`→`19_51_33`→`20_13_13`→`20_34_32`→`20_57_13`→`21_19_46`)의
`/ai-review`+`--impl-done`을 거쳤다. 각 라운드 documentation 리뷰가 지적한 항목(카탈로그 탈출구
자기모순 CHANGELOG, plan 체크박스, `where` 프리텍스트, `isMessagePrefixOnly` 서술 불일치, JSDoc
자기모순 개명 이력, `.filter()` 호출 횟수 오기)이 후속 커밋에서 실제로 해소됐음을 각 라운드
documentation.md·RESOLUTION.md 대조로 재확인했다. 이번 라운드는 **직전 라운드(`21_19_46`) 이후
마지막 수정 커밋 `eb53aba1c`**(`git show eb53aba1c`)가 새로 들여온 코드·문서만 독립적으로
재검증했다 — `resolveSourceLines` 캐시 도입, `.filter()` 횟수 정정(네 번→세 번), `spec_impact`
5경로 추가, `3-error-handling.md §1.4` 항목 상호 링크. 그 이전 6라운드분(수집기 3종,
`isMessagePrefixOnly`, `parseWhereRefs`, `staleGuideEntries`, `computeNonEmittedOffenders` 등)은
로직이 이번 커밋에서 바뀌지 않았고 앞선 라운드가 이미 반복 검증했으므로 재조사하지 않았다.

인용된 소스 줄 번호는 실제 소스 파일을 `grep -n`/`sed -n`으로 전수 직접 대조했다(아래 WARNING이
그 결과다). 저장소 파일은 건드리지 않았다(읽기 전용, `git status --short` clean 확인).

## 발견사항

- **[WARNING]** 이 배치가 새로 추가한 두 "실측 근거" 문단이 인용하는 소스 줄 번호가
  **실제 위치보다 1줄 앞**을 가리킨다 — 인용된 줄은 `nodeExec.error = { message }`가 아니라
  그 직전 줄(`nodeExec.status = NodeExecutionStatus.FAILED;`)이다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3446`, `:3475`
    (둘 다 `origin/main...HEAD` diff의 `+` 신규 추가 줄 — 이번 PR이 처음 써넣은 문장이다)
  - 상세: 두 곳 모두 `` `execution-engine.service.ts:8016` 이 `nodeExec.error = { message }` 로
    기록한다 `` 라고 쓴다. 그러나 실제 소스(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`)를
    직접 열어 확인하면:
    ```
    8016:         nodeExec.status = NodeExecutionStatus.FAILED;
    8017:         nodeExec.error = { message };
    ```
    `nodeExec.error = { message };`는 **8017행**이다(`grep -n "nodeExec.error = { message }"` 결과
    유일 매치, 파일 전체 8,882줄 중 이 한 곳뿐). 이 PR은 `execution-engine.service.ts`를
    전혀 건드리지 않으므로(`git diff origin/main...HEAD --stat`에 해당 파일 없음) 줄 번호가
    이후 커밋으로 밀린 것이 아니라 **애초에 잘못 세어 적힌 것**이다.
    이 인용은 이 배치의 핵심 설계 결정(“`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`는
    `code` 필드로 방출되지 않으므로 문장 정정이 맞다”)을 뒷받침하는 유일한 코드 실측 근거이고,
    `spec/conventions/review-citations.md §2`가 요구하는 “인용은 grep으로 그대로 대조되는
    file:line”을 어긴다. 실제로 이 저장소는 이번 PR 안에서만도 같은 클래스(bare 인용·
    프리텍스트 인용)의 결함을 최소 4번 잡아 고쳤는데(`review/consistency/2026/09/13/{19_51_39,20_13_19}`
    WARNING#2), 이번엔 “줄 번호가 아예 없음”이 아니라 “줄 번호가 있지만 1줄 어긋남”이라 그
    가드들이 겨냥하지 않는 형태다.
    같은 잘못된 줄 번호(`:8016`)가 이 PR 이전부터 최소 6개 라운드의 `review/**` 산출물
    (`19_23_31/RESOLUTION.md`, `20_13_13/{RESOLUTION,documentation,requirement,SUMMARY}.md`,
    `20_34_32/{documentation,requirement,SUMMARY}.md`, `20_57_13/{requirement,documentation}.md`,
    `21_19_46/requirement.md`, `21_41_23/requirement.md` 등)에 반복 등장하며, 그중 다수가
    “직접 `Read`로 대조, 전부 일치” 또는 “grep으로 확인”이라고 명시적으로 주장한다 — 여러 라운드의
    requirement/documentation 리뷰어가 같은 틀린 줄 번호를 검증했다고 반복 보고한 것으로 보인다.
    다만 이 `review/**` 파일들은 과거 세션의 append-only 기록이라 소급 수정 대상이 아니다 —
    **이번에 실제로 고쳐야 할 자리는 이 PR이 신규로 써넣은 `plan/**` 두 줄뿐이다.**
    (결론 자체 — “`nodeExec.error`에 `code` 필드가 없다” — 는 인접 줄 8015-8018 구간을 봐도
    여전히 참이라 이 배치의 설계 결정 자체를 뒤집을 필요는 없다. 인용 정밀도만의 문제다.)
  - 제안: 두 곳 모두 `execution-engine.service.ts:8016` → `:8017`로 정정.

## 확인 후 문제 없음으로 판단한 항목

- **`resolveSourceLines` 캐시 도입 JSDoc**(`guide-identifier-existence.test.ts` — `basename`으로
  소스 파일을 찾아 줄 배열을 준다는 서술, "파일당 한 번만" 순회한다는 서술) — 구현과 정확히
  일치한다. `sourceLinesCache`가 `basename` 키로 캐싱하고, 캐시 미스일 때만 `walkTree`를
  호출하는 구조를 코드로 직접 대조했다.
- **`.filter()` 횟수 정정**(`guide-identifier-scan.ts`의 `computeNonEmittedOffenders` JSDoc,
  `guide-identifier-existence.test.ts:224`) — "네 번/네 개"가 "세 번/세 개"로 정확히 정정됐고,
  실제 옛 커밋(`2931d921f~1`)의 삭제된 체인을 `git show`로 대조한 결과 `.filter(` 3회가 맞다
  (라운드 6 documentation.md의 WARNING이 정확히 해소됨).
- **`plan/in-progress/spec-draft-nullable-notation-followups.md`의 `spec_impact` 5경로 추가** —
  본문 항목("spec 6파일이 `CONTAINER_*`를 코드로 적는다")의 표가 나열하는 정확히 6개 파일
  (`4-execution-engine.md` 기존 + 신규 5개: `2-edge.md`·`0-canvas.md`·`0-common.md`·`7-map.md`·
  `9-foreach.md`)과 1:1로 일치한다. `3-loop.md`가 목록에 없는 것은 누락이 아니다 — 본문이
  명시하듯 그 파일은 "이미 맞게 적은 선례"로 인용될 뿐 수정 대상이 아니다(정정 대상 6개와
  참조용 선례 1개를 혼동하지 않도록 본문 자체가 구분해 두었다).
- **`§1.4` 항목 상호 링크 추가**(`spec-draft-nullable-notation-followups.md:3494-3498`) — 기존
  "한 턴에 묶어라" 합의를 인용하는 문장이 정확히 그 절 위치에 추가됐고, 그 합의가 실제로
  같은 문서 위쪽(`§1` 관련 다른 두 항목)에 존재함을 확인했다.
- **CHANGELOG.md 자기 일관성** — 최상단 Unreleased 항목의 "78종 중 28종 미등재, 그중 25종은
  진짜 발행되는 통합 코드" 서술이 `guide-identifier-scan.ts`의 `collectCatalogCodes` JSDoc과
  단어 단위로 일치하고, 라운드 5 이후 자기모순(카탈로그 덕에 통과 vs 소비자 인용 때문에 통과)은
  이미 해소된 채로 유지되고 있다.
- **PROJECT.md:300** — "발행 축(2026-09-13 추가)" 문단이 이번 배치의 실제 강제 사항(등록 시
  사유 필수, 카탈로그=탈출구, 잔여 한계)을 정확히 요약하고 있고 코드 상태와 어긋나지 않는다.
- **가드 스위트 카운트 "71 → 76" 표기**(plan §J) — `it(` 리터럴 개수를 직접 세어 대조한 결과와
  일치한다.
- **(참고, 조치 불요)** `review/code/2026/09/13/21_19_46/performance.md` INFO#3이
  `computeNonEmittedOffenders`를 "4단 `.filter()` 체인"으로 서술하는데 실제로는 3단이다 —
  다만 이 파일은 과거 세션의 append-only 산출물이라 소급 수정 대상이 아니고, 그 INFO 자체가
  "조치 불요"로 이미 낮은 우선순위 처리돼 있어 이 라운드에서 별도 조치를 요구하지 않는다.

## 요약

라운드 6 수정 커밋(`eb53aba1c`)이 지난 라운드의 WARNING(성능 캐시, `.filter()` 횟수 오기,
`spec_impact` 누락, `§1.4` 항목 고립)을 전부 정확히 해소했음을 확인했다. 다만 이번 배치가
새로 써넣은 "실측 근거" 문장 2곳이 인용하는 소스 줄 번호(`execution-engine.service.ts:8016`)가
실제 위치보다 1줄 어긋나 있다 — 올바른 줄은 8017이다. 이 인용은 이 PR의 핵심 설계 결정을
뒷받침하는 유일한 코드 근거이자, 저장소가 `review-citations.md §2`로 명문화하고 이번 PR
안에서도 여러 차례 스스로 잡아낸 "인용 정확성" 결함 클래스와 같은 성격이다. 결론(“`code` 필드
없음”) 자체는 인접 줄을 봐도 여전히 참이라 설계나 코드 동작에는 영향이 없지만, 정밀 인용을
요구하는 이 저장소의 규약 기준으로는 정정이 필요하다. 그 외 CHANGELOG·PROJECT.md·plan·mdx
문서·JSDoc·테스트 이름은 모두 최신 코드 상태와 정확히 일치하며 새로운 CRITICAL급 문서화 결함은
없다.

## 위험도

LOW
