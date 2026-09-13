# 테스트(Testing) 코드 리뷰 — error-code-emission-axis (누적 7라운드 시점)

## 검토 범위·방법

이 배치의 테스트 관점 실질 대상은 여전히 두 파일뿐이다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기·
`isMessagePrefixOnly`·`computeNonEmittedOffenders`·`GUIDE_NON_EMITTED_VOCABULARY`)와
`guide-identifier-existence.test.ts`(그 축의 단언 + 진리표/경계 대조군). 나머지
(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·이전
6라운드 `/ai-review`·`--impl-done` 세션 산출물이라 테스트 코드 대상이 아니다.

이 축은 이미 6라운드(19_23_22→19_51_33→20_13_13→20_34_32→20_57_13→21_19_46)를 거치며 매
라운드 testing 리뷰어가 발견한 갭(수집기 3종 경계 대조군·`isMessagePrefixOnly` 진리표·
`staleGuideEntries` 판별 대조군·`computeNonEmittedOffenders` 정본화·`where` 다중 참조 파싱)이
채워졌다. 이번 세션이 새로 보는 것은 **라운드 6 fix 커밋(`eb53aba1c`)이 들여온 것** —
`resolveSourceLines`(basename 캐시)로 `where` 검증의 반복 파일시스템 순회를 없앤 성능 리팩터
— 이며, `git diff 2931d921f..eb53aba1c -- <두 파일>`로 라운드 6 자신의 diff를 추출해 그 위에서
집중 검토했다. 두 파일의 그 외 부분은 라운드 1~6이 이미 검토했고 이번 라운드 사이에
변경되지 않았다(`git diff origin/main...HEAD` 전체와 대조 확인).

### 독립 재현 (저장소 뮤테이션, 완료 후 `cp`로 원복·`git status --short`로 확인)

- `guide-identifier-existence.test.ts` 단독 실행(`npx vitest run
  src/lib/docs/__tests__/guide-identifier-existence.test.ts`) → **76 passed (76)**, 베이스라인
  확인.
- **신규 뮤테이션**: `resolveSourceLines`의 유일성 가드 `found.length === 1`(96행)을
  `found.length >= 1`로 완화 — "파일이 유일하게 특정되지 않으면(0건·2건 이상) `null`" 이라는
  이 함수 자신의 docstring(81~85행)이 명시한 계약을 정확히 깨는 뮤턴트. 재실행 →
  **76 passed (76), 전부 GREEN — 생존**. 즉 이 계약을 지키지 않아도 현재 스위트는 아무것도
  모른다. 원본을 즉시 `cp`로 복원했고 `diff`+`git status --short`로 저장소가 리뷰 산출물
  디렉터리 외에는 깨끗함을 확인했다(아래 재현 로그 참조).
  - 참고로 `codebase/backend/src` 아래 동일 basename(`index.ts`)이 **46개** 존재해, 이 가드가
    지키려는 "유일성 불충족 → null" 분기는 순전히 가설적이지 않다 — 등록 항목이 늘어나면서
    (`NON_EMITTED_VOCABULARY_CAP = 5`, 현재 3) `where` 가 흔한 basename을 가리킬 개연성은
    현실적이다.

## 발견사항

- **[WARNING]** `resolveSourceLines`의 유일성 가드(모호/부재 파일 → `null`)를 겨눈 판별
  fixture가 전혀 없다 — 뮤테이션으로 생존을 직접 확인했다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:86-100`
    (`resolveSourceLines` 정의부, 특히 96행 `found.length === 1`), 유일한 호출부는 285행
    (`const lines = resolveSourceLines(file);`)
  - 상세: 이 함수는 라운드 6에서 "`where` 참조마다 `backend/src` 1,304 파일을 다시 순회한다"는
    성능 지적(`review/code/2026/09/13/21_19_46` performance WARNING#1)을 고치며 새로 도입됐다.
    도입 당시 함수 docstring에 "유일하게 특정되지 않으면(0건·2건 이상) `null` — 호출부가 그것을
    결함으로 보고한다"고 명시적 계약을 적었는데, 이 계약을 지키는 코드(`found.length === 1`
    분기)를 검증하는 테스트가 하나도 없다. 유일한 소비처(285행)는 실코퍼스(등록 3항목·참조
    4개, basename 2종: `execution-engine.service.ts`·`makeshop.handler.ts`)만 돌리는데, 오늘
    그 2개 basename은 각각 정확히 1건씩만 매치되어 `found.length === 1` 분기만 지나간다 —
    0건·2건 이상 분기는 실코퍼스로 **한 번도 관측되지 않는다**. 이 저장소가 바로 이 파일에서
    3차례(수집기 3종·`isMessagePrefixOnly`·`staleGuideEntries`) 반복해 이름 붙인 패턴 —
    **"헬퍼 테스트 ≠ 호출부 테스트"** — 이 네 번째로 재발한 사례다. 앞의 세 사례는 매번
    합성/진리표 대조군을 받아 라운드마다 WARNING으로 처리됐는데, 라운드 6에 도입된 이
    함수만 같은 처치를 받지 못한 채 이번 라운드에 처음 검토대에 올랐다.
  - 실측 영향: 위 뮤테이션이 실증하듯, 만약 향후 등록 항목이 흔한 basename(`index.ts` 등,
    저장소에 46개 존재)을 가리키게 되어 매치가 2건 이상이 되면, 이 계약이 깨진 코드는 **잘못된
    (임의의) 파일을 골라 토큰 유무를 검사**하고 — 우연히 토큰이 없으면 결함으로 보고되지만,
    우연히 같은 토큰 문자열이 그 파일에도 있으면 **틀린 파일을 근거로 통과시킨다**. 즉 이
    가드가 막으려는 "프리텍스트 방지"(`where`가 실제로 그 토큰을 담는지 확인) 라는 이 축의
    핵심 목적 자체가 조용히 무력화될 수 있는데, 어떤 테스트도 그 상황을 감지하지 못한다.
  - 제안: 라운드 3(`staleGuideEntries`)·라운드 5(`computeNonEmittedOffenders`)가 쓴 것과 같은
    패턴으로, `resolveSourceLines`에 대한 별도 `describe` 블록을 추가해 (a) 존재하지 않는
    basename → `null`, (b) 두 판정이 갈리는 합성 케이스로 basename이 2건 이상 매치되는 상황
    (`walkTree` 호출 인자를 조작하기 어려우면, 최소한 실제로 46개 존재하는 `index.ts` 를
    `resolveSourceLines("index.ts")`로 직접 호출해 `null`이 나오는지)을 고정할 것. 캐시 히트
    경로(같은 key 재호출 시 동일 값 반환)는 이미 285행 루프가 같은 basename을 3회 소비해
    간접적으로 검증되므로 별도 조치 불요.

- **[INFO]** (기존 추적 항목 재확인, 조치 불요) `computeNonEmittedOffenders`의 `new Set`
  중복 제거를 겨눈 fixture 부재는 라운드 6(`review/code/2026/09/13/21_19_46` testing
  INFO#1)이 이미 뮤테이션으로 확인·등재했고 같은 라운드 RESOLUTION이 "거짓 PASS로 이어지지
  않음 — 진단 품질만"으로 낮은 우선순위 처분을 내렸다. 이번 라운드 사이에 관련 코드 변경이
  없어 재확인만 하고 새 항목으로 올리지 않는다.

- **[INFO]** 회귀 검증: 라운드 1~6에서 지적됐던 항목들이 실제로 코드에 반영돼 있는지
  대조했다 — `staleGuideEntries`(임포트 이름 충돌 회피, existence.test.ts:74-79)·
  `isMessagePrefixOnly`가 `guide-identifier-scan.ts`로 이전돼 진리표 대조군을 가짐(scan.ts:
  719-725, existence.test.ts의 "`isMessagePrefixOnly` — 진리표 대조군" describe)·
  `computeNonEmittedOffenders` 정본화(scan.ts:746-762)·`parseWhereRefs`의 다중 `파일:줄` 파싱 +
  대조군(existence.test.ts:55-62, "[대조군]" 테스트)·"세 번"/"네 항" 주석 정정 — 전부 diff와
  일치하게 반영되어 있다. 회귀 없음.

## 요약

두 대상 파일은 6라운드에 걸쳐 촘촘히 다져진 뮤테이션-검증 테스트 스위트(76건 GREEN)를
유지하고 있고, 라운드 1~5가 지적한 갭은 전부 합성 진리표·경계 대조군으로 닫혀 있다.
이번 라운드가 새로 들여온 유일한 실질 코드(`resolveSourceLines`, basename 캐시로 `where`
검증의 반복 파일시스템 순회를 없앤 성능 리팩터)는 그 자신의 docstring이 명시한 핵심 계약
("유일하게 특정 안 되면 null")을 검증하는 테스트가 없다는 것을 뮤테이션으로 직접 확인했다 —
이 파일이 이미 세 차례 반복해 이름 붙인 "헬퍼 테스트 ≠ 호출부 테스트" 패턴의 네 번째
재발이다. 실코퍼스만으로는 이 분기가 영원히 관측되지 않고(현재 basename 2종 모두 유일
매치), 저장소에 동일 basename이 46개(`index.ts`) 존재해 등록 항목이 늘면 현실적으로 부딪힐
수 있는 경로다. 그 외 나머지 코드는 이전 라운드가 이미 검증했고 회귀도 없다.

## 위험도

LOW — dev-time 전용 가드 코드의 방어 분기 하나에 국한된 커버리지 갭이며, 프로덕션 런타임에
영향이 없고 오늘 시점 실코퍼스로는 트리거되지 않는다. 다만 이 저장소 자신이 같은 클래스를
세 번 WARNING으로 다뤘던 전례를 고려해 INFO가 아니라 WARNING으로 기록한다.
