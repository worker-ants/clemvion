# 문서화(Documentation) 리뷰 — error-code-emission-axis (라운드 3)

## 검토 방법

이 라운드는 이미 두 번의 `/ai-review`(`19_23_22` C0·W7 → 수정 `a397ccc55`, `19_51_33`
C0·W4 → 수정 `a4b98eda8`)와 대응하는 `--impl-done`이 문서화 관점을 반복 검토·수정한
뒤의 최종 diff를 본다. 이전 두 라운드의 documentation.md가 낸 지적(카탈로그 탈출구
자기모순 CHANGELOG, plan 체크박스, `where` 프리텍스트, 거울상 강제 부족 등)이 실제로
해소됐는지 직접 코드를 `Read`하고, 인용된 소스·spec 줄 번호를 `grep`/`sed`로 독립
재검증했다. 그 위에서 라운드 2 수정 커밋(`a4b98eda8`)이 새로 들여온 코드·문서에
새로운 결함이 있는지 찾았다.

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING은 찾지 못했다. 독립적으로 재현한 검증은
다음과 같다:

- `guide-identifier-scan.ts`의 `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 필드 3건을
  직접 `grep -n`으로 대조 — `execution-engine.service.ts:7121`·`:7125`(`CONTAINER_MISSING_EMIT`),
  `:7130`(`CONTAINER_MULTIPLE_EMIT`), `makeshop.handler.ts:436`(`MAKESHOP_UNRESOLVED_PATH_PARAM`)
  전부 실제 소스 줄과 토큰이 정확히 일치한다(테스트의 `parseWhereRefs` grep 강제와 별개로
  수동 재확인).
- `execution-engine.service.ts:8016` (`nodeExec.error = { message }`, `code` 필드 없음) —
  plan·CHANGELOG가 반복 인용하는 실측 근거를 직접 `sed`로 열어 확인, 정확하다.
- `spec/5-system/3-error-handling.md §1.4`의 "소비자·분류기 쪽 어휘이지 엔진 발행
  경로의 앵커가 아니다"·"나머지 7종은 앵커 없는 맨 문자열" 인용을 원문과 대조 — 정확한
  발췌이고, "7종" 카운트(`EXECUTION_TIMEOUT`·`RECURSION_DEPTH_EXCEEDED`·
  `MAX_ITERATIONS_EXCEEDED`·`CYCLE_DETECTED`·`INVALID_EXPRESSION`·`VARIABLE_NOT_FOUND`·
  `TYPE_MISMATCH`, 앵커 열 "없음")도 표를 직접 세어 일치를 확인했다.
- `spec/5-system/4-execution-engine.md:332-333`, `spec/4-nodes/1-logic/3-loop.md:189-191`을
  직접 열어 plan(`spec-draft-nullable-notation-followups.md`)이 인용한 문장·표 형태와
  대조 — 정확히 일치한다(라운드 2 documentation.md가 7개 spec 파일 전부에 대해 이미
  같은 방식으로 검증했다고 보고했고, 이번엔 그중 2개를 표본으로 재검증했다).
- `CHANGELOG.md`의 자기모순(라운드 2 WARNING — "카탈로그 덕에 통과"/"소비자 인용 때문에
  통과"가 같은 항목에 공존)은 라운드 2 수정(`a4b98eda8`)에서 해당 문단이 반증된 서사를
  뺴고 "그 탈출구는 오늘 한 번도 발화하지 않는다"로 정정돼 있고, 바로 아래 "잔여 한계"
  문단과 더는 모순되지 않는다.
- `PROJECT.md:300`, `guide-identifier-scan.ts`의 JSDoc, `guide-identifier-existence.test.ts`의
  테스트 제목·주석 — `isMessagePrefixOnly`의 실제 진리표(접두 O·리터럴 O → false)와
  세 곳 모두 동일한 설명을 쓰고 있다. 하나만 고치고 자매를 놓치는 패턴(이 저장소가
  반복 겪은 형태)이 이번엔 재발하지 않았다.
- 가드 스위트 `it(` 개수를 직접 세어 **68**을 확인 — RESOLUTION.md(`19_51_33`)·plan §F가
  주장한 "63 → 68"과 일치한다.

## 확인 후 문제 없음(참고, 재발 아님)

- `PROJECT.md:300`은 발행 축의 핵심 규칙(카탈로그=탈출구, 잔여 한계)만 설명하고
  라운드 1~2에서 추가된 세부 강제(상한 5·"여전히 인용되는가"·`where`의 `parseWhereRefs`
  grep 검증)까지는 언급하지 않는다. 이는 라운드 2 documentation.md가 이미 "기존
  `GUIDE_EXTERNAL_VOCABULARY` 항목 설명 수준과 같은 축약이라 새로운 결함이 아니다"로
  판정한 것과 동일한 자리이고, 그 판단은 지금도 유효하다 — 조치 불요.
- `review/code/2026/09/13/19_23_22/requirement.md`는 이번 프롬프트 번들에서 diff 내용이
  누락돼 표시됐다(헤더만 있고 본문 없음, "생략" 안내도 없음). 저장소에서 직접 열어보니
  실제로는 34줄짜리 정상 파일이다 — 프롬프트 조립 과정의 누락으로 보이며, 리뷰 대상
  코드·문서 자체의 결함이 아니라서 별도 항목으로 올리지 않는다.

## 요약

라운드 1·2에서 documentation 관점이 지적한 항목(CHANGELOG 자기모순, plan 체크박스,
`where` 프리텍스트, 거울상 목록 강제 불균형, `isMessagePrefixOnly` 서술 불일치)은
전부 실측 재확인 결과 정확히 해소돼 있고, 그 해소 과정에서 새로 도입된 서술(`where`의
여러 `파일:줄` 처리, `isMessagePrefixOnly`를 정본으로 승격한 JSDoc 등)도 실제 소스
줄 번호·동작과 어긋나지 않는다. 이번 배치는 소스 코드 자체를 바꾸지 않고 사용자 가이드
문장 2건을 정정하며, 그 정정을 지키는 가드(발행 축)와 CHANGELOG/PROJECT.md/plan 서술을
서로 어긋나지 않게 묶어 두는 데 세 라운드를 들였다 — 그 결과 지금 시점의 문서·주석·
테스트 이름·plan 서술은 상호 일치하고 실제 소스와도 일치한다. 새로 보고할 CRITICAL/
WARNING은 없다.

## 위험도
NONE
