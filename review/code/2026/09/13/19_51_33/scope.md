# 변경 범위(Scope) 리뷰 — error-code-emission-axis (라운드 2, `19_51_33`)

## 검토 방법

프롬프트가 크기 제한으로 생략한 파일(파일 5·7 diff, 파일 6 후반부, 파일 10·19·20·23·26·... 전문)은
`git diff afaef5bef..HEAD -- <path>` 로 직접 재현해 전문을 확인했다. 대상 diff 는 두 커밋
(`65256a109` feat + `a397ccc55` fix 라운드1)의 누적분, 총 36개 파일이며 `git diff --stat` 로 파일
목록이 프롬프트의 20~36번 항목(생략된 나머지)과 정확히 일치함을 확인했다.

## 발견사항

- **[INFO]** 커밋 범위에 `review/code/2026/09/13/19_23_22/**`(ai-review 라운드1, 11개 산출물)와
  `review/consistency/2026/09/13/{18_40_54,19_23_31}/**`(consistency-check 두 세션, 각 7~9개
  산출물) 총 27개 리뷰 산출물이 포함돼 있다.
  - 위치: `review/code/2026/09/13/19_23_22/*`, `review/consistency/2026/09/13/18_40_54/*`,
    `review/consistency/2026/09/13/19_23_31/*` (전부 신규 파일)
  - 상세: 이 파일들은 기능 코드가 아니라 CLAUDE.md 가 의무화한 두 게이트(`developer` 구현 착수 직전
    `--impl-prep`, 구현 완료 후 `/ai-review` + Critical/Warning fix)의 산출물이다. `review/` 는
    gitignore 대상이 아니고 소실 방지를 위해 코드와 함께 커밋하는 것이 이 저장소의 정착된 관례다
    (직전 라운드 scope 리뷰 `review/code/2026/09/13/19_23_22/scope.md` 도 동일하게 판단했다). 스코프
    이탈이 아니라 정상 워크플로 부산물로 판단한다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` — 이 작업과 별개인 대형
  트래커 문서에 3군데(체크 완료 1건 + 신규 항목 2건 + `--impl-prep` 재현 노트 1건, 총 ~65줄)가
  추가됐다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 게이트 기준
    `3404~3410`, `3419~3460`, `4062~4074`)
  - 상세: 세 삽입 모두 이번 배치가 직접 만들거나 소비한 사실을 정확히 그 사실을 이미 기록하고 있던
    기존 항목에 이어붙인 것이다 — (1) `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 항목을
    `[x]` 로 체크하고 실측 근거 기록(이번 배치가 닫은 항목), (2) `--impl-done`
    (`review/consistency/2026/09/13/19_23_31`)이 명시적으로 "별도 plan 항목으로 등재" 권고한 2건을
    신규 등재, (3) `--impl-prep` 세션에서 우연히 재현된 기존에-알려진 harness 결함(consistency 예산
    초과)을 같은 결함을 이미 추적하던 항목에 교차 기록. 그 문서의 다른 4000줄 이상은 diff 에 전혀
    나타나지 않으며, 인접 서술을 재작성하거나 건드리지 않았다. `review/**` 는 SoT 가 아니므로
    plan 으로 옮기지 않으면 소실된다는 이 저장소의 반복 교훈과도 일치한다.
  - 제안: 조치 불필요.

- 그 외 8개 실질 변경 파일(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`·`logic.en.mdx`·
  `guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·
  `plan/in-progress/error-code-emission-axis.md`)은 `plan/in-progress/error-code-emission-axis.md`
  가 정의한 작업 범위(가이드 문장 정정 2건 + 발행 축 술어·데이터·테스트)와 1:1 대응한다. 전체
  diff 를 `git diff`로 재현해 대조한 결과:
  - `logic.mdx:114`·`logic.en.mdx:103` — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가
    "코드로 실패한다"는 서술을 "메시지 접두일 뿐 전용 코드는 없다"로 정정. KO/EN 동형, plan §D
    처분과 정확히 일치.
  - `guide-identifier-scan.ts` — `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 정규식,
    `collectMatches` 공유 헬퍼(+3 얇은 래퍼), `GUIDE_NON_EMITTED_VOCABULARY` 신규 export. 이번
    라운드에 새로 추가된 `collectMatches` 추출은 `review/code/2026/09/13/19_23_22/maintainability.md`
    WARNING#7 을 그대로 반영한 fix-라운드 변경이고, RESOLUTION.md 가 같은 근거를 기록한다 — 새로운
    스코프 이탈이 아니라 직전 라운드 리뷰 지적에 대한 응답.
  - `guide-identifier-existence.test.ts` — import 6개(`collectQuotedLiterals`,
    `collectMessagePrefixes`, `collectCatalogCodes`, `GUIDE_NON_EMITTED_VOCABULARY` 및 신규
    describe 블록들) 전부 새 "발행 축" 테스트에서 실제로 소비된다. 미사용 임포트 없음. 추가된
    `where` grep 검증·상한 상수·경계 대조군 describe 는 모두 같은 RESOLUTION.md 가 기록한
    WARNING#4~#6 fix 에 대응한다.
  - `PROJECT.md:300` — 해당 테스트 파일 설명 한 항목만 "발행 축" 단락 추가, 기존 서술 보존.
  - `CHANGELOG.md` — 이번 변경 요약 신규 추가, 기존 항목 재작성 없음.
  - `plan/in-progress/error-code-emission-axis.md` — 신규 plan 파일, 이 작업 자체의 추적 문서.
  - 위 파일들에서 요청 범위를 벗어난 무관한 리팩토링·기능 확장·포맷팅/주석/임포트/설정 변경은
    발견하지 못했다. `guide-identifier-scan.ts` 상단 주석 1줄 정정(`## 이 가드가 **못** 보는 것` 표제
    변경)도 새로 추가한 발행 축의 정확한 범위를 반영하는 데 필요한 최소 수정이다.

- 포맷팅·주석·임포트·설정 관점에서 지적할 무관한 변경은 발견하지 못했다. 모든 diff hunk 가
  plan 체크리스트 또는 직전 라운드 리뷰 지적사항(RESOLUTION.md)에 직접 대응하며, 의도 밖
  리팩토링·기능 확장·무관한 파일 수정은 관측되지 않았다.

## 요약

36개 변경 파일 전부가 세 범주 중 하나로 설명된다 — (1) `plan/in-progress/error-code-emission-axis.md`
체크리스트에 1:1 대응하는 실질 코드/문서 변경 8개, (2) CLAUDE.md 가 의무화한 `--impl-prep`·
`/ai-review` 게이트의 산출물(리뷰/일관성-검토 27개, 커밋 관례 준수), (3) 이 배치가 다른 플랜
문서에 이미 존재하던 트래커 항목에 정확히 대응하는 3건의 소규모 추가(체크 완료·신규 등재·교차
기록). 신규 실질 코드 변경(`collectMatches` 공유 헬퍼, 경계 대조군, `where` grep 검증, 상한 상수)은
전부 직전 라운드 자체 리뷰(`19_23_22`)의 WARNING fix 로 RESOLUTION.md 가 근거를 명시하고 있어
스코프 확장이 아니라 fix-cycle 의 정상 산출물이다. 불필요한 리팩토링, 과잉 기능 확장, 무관한 파일
수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도
NONE
