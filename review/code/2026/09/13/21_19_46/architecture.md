# 아키텍처(Architecture) 리뷰 — error-code-emission-axis

## 검토 범위

`origin/main..HEAD` 전체 diff(6 커밋, 라운드 1~5 fix 포함) 중 실질 코드 변경은
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (순수 스캐너, +234줄)와
`guide-identifier-existence.test.ts` (+429줄)이다. 나머지(`CHANGELOG.md`·`PROJECT.md`·
`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·이전 라운드 리뷰 산출물이라 아키텍처
관점에서 다룰 대상이 아니다. 두 핵심 파일을 `Read`/`git diff origin/main..HEAD`로 직접 확인했고,
`npx vitest run guide-identifier-existence.test.ts`로 76/76 GREEN을 실측했다(저장소 파일은
읽기만 했고 뮤테이션은 하지 않았다 — `git status --short`가 리뷰 산출물 디렉터리 외 변경 없음을
확인).

## 발견사항

- **[INFO]** 판정 로직 소유권이 이번 라운드에서 정착됨 (긍정적 확인)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `isMessagePrefixOnly`(447행), `computeNonEmittedOffenders`(471행)
  - 상세: 이전 라운드(19_51_33) architecture INFO#1이 지적한 "판정 로직이 테스트 파일의 지역 클로저라 존재 축 관례(스캐너가 판정을 소유)와 불일치"가 이번 diff에서 실제로 닫혔다. `isMessagePrefixOnly`/`computeNonEmittedOffenders`가 `guide-identifier-scan.ts`로 이동해 export되었고, 테스트 파일은 `sets` 번들을 조립해 정본 함수를 호출하는 얇은 소비자로 남았다. 베이스라인 단언과 `[한계]`/`[대조군]` 단언이 같은 함수를 공유하게 되어, 판정 체인의 항을 지우는 뮤턴트가 양쪽에서 동시에 RED가 되는 구조로 개선됐다(RESOLUTION.md 라운드 5가 뮤테이션으로 실측 확인).
  - 제안: 조치 불필요 — 아키텍처 개선이 확인됨.

- **[INFO]** `collectMatches` 제네릭 수집기가 위치 기반 캡처 그룹 인덱스에 암묵 결합
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:260-266`(정규식 3종 선언), `:281-291`(`collectMatches` 정의), `:373·385·427`(호출부 group 2·1·1)
  - 상세: `QUOTED_LITERAL`은 그룹 2(토큰), `MESSAGE_PREFIX`·`CATALOG_CODE`는 그룹 1을 쓴다. `collectMatches(texts, rx, group)`는 정규식 구조와 호출부의 숫자 인자가 수동으로 동기화되어야 하는 계약이라, 세 정규식 중 하나에 캡처 그룹을 추가/재배치하면 컴파일 에러 없이 조용히 잘못된 그룹을 수집한다(타입 시스템이 이 결합을 잡아주지 않는다). named capture group(`(?<token>...)`)을 쓰고 `m.groups.token`을 읽으면 이 결합이 사라진다.
  - 제안: 우선순위 낮음 — 현재는 대조군 테스트가 세 함수 각각의 정확한 산출을 실측으로 고정하고 있어 실질 위험은 낮다. 다음에 네 번째 축을 추가할 때 named group으로 전환을 고려할 것.

- **[INFO]** 같은 "텍스트들에서 정규식 매치 수집" 작업에 두 가지 반복 관용구가 공존
  - 위치: `guide-identifier-scan.ts:244`(주석 자체가 명시), 기존 axis는 `:495`·`:506,509`·`:532`·`:577,585`(수동 `rx.lastIndex = 0` + `while (exec)`), 신규 emission axis는 `:281-291`(`matchAll` 기반 `collectMatches`)
  - 상세: 모듈 주석이 이 비일관을 스스로 인지하고 있다 — 기존 4곳의 수동 `lastIndex` 관용구를 `matchAll` 기반으로 통일하는 리팩터가 있으면 다섯 번째 복제를 만들 뻔했는데, 대신 신규 축만 새 관용구로 작성하고 기존 4곳은 그대로 두는 절충을 택했다(별건 트래커 등재, 이번 diff의 스코프를 좁게 유지하려는 의도적 결정). 결과적으로 이 모듈은 동일 개념(여러 텍스트에서 정규식 캡처 전수 수집)에 대해 두 개의 병렬 구현 스타일을 갖게 되어, 다음에 다섯 번째 축이 추가될 때 "어느 관용구를 따라야 하는가"라는 판단 비용이 생긴다.
  - 제안: 조치 불필요(의도적·문서화·별건 추적됨). 다만 그 별건 리팩터가 실행될 때 `collectMatches`로 완전히 수렴시키는 것을 권장.

- **[INFO]** 카탈로그 탈출구 분기가 실코퍼스에서 검증 가능하게 발화하지 않는 상태로 남음 (의도적, 잘 방어됨)
  - 위치: `guide-identifier-scan.ts:427`(`collectCatalogCodes`) 및 `computeNonEmittedOffenders`(471행) 내 `!sets.catalogCodes.has(t)` 필터 항; 대응 단언은 `guide-identifier-existence.test.ts`의 `"[한계] 카탈로그 탈출구는 오늘 한 번도 발화하지 않는다"` 테스트
  - 상세: 설계상 "카탈로그에 등재되면 등록 없이도 통과"하는 탈출구는 오늘 실측(전수 조사)으로 발화 경우가 0건임이 코드·주석·plan(§B-2, §E) 모두에서 일관되게 확인된다. 이는 아직 실행되지 않은 별건 planner 트래커 항목(`CONTAINER_*`를 §1.4에 backfill)이 언젠가 집행되어야 의미를 갖는, 현재는 죽은 프로덕션 분기다 — 순수 YAGNI 관점에서는 "쓰이지 않는 확장 지점을 미리 만들어 둔" 형태의 선제적 일반화(speculative generality)에 해당한다. 다만 이 저장소는 이 사실을 숨기지 않고 합성 입력 대조군(`[대조군] 그래도 탈출구가 작동은 한다`)과 0-발화 단언(`[한계]`)으로 그 분기가 죽은 채 방치되지 않도록 캐너리를 걸어 두었다 — "리뷰어가 반복 지적하는 미실측 전제"의 안전한 처리 형태로 보인다.
  - 제안: 조치 불필요. 다만 backfill 트래커 항목이 최종적으로 won't-do로 처분되면 이 분기와 `[한계]`/`[대조군]` 테스트 3개는 함께 제거 대상이 된다는 점을 plan에 명시적 후속 조건으로 남겨두는 것을 권장(현재 plan §B-2 서술로 이미 충분히 추적되고 있어 강한 요구는 아님).

- **[INFO]** 테스트 파일이 두 개의 이질적 축(존재/발행)을 한 파일에서 계속 누적
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (934줄, `describe` 8개: 81행 메인 스위트 안에 발행 축 하위 describe 포함 + 507/539/583/605/639/715/785행 독립 describe 6개)
  - 상세: 파일이 "존재 축"(기준집합·백틱·외부 어휘) 검증에서 시작해 이번 diff로 "발행 축"(접두/리터럴/카탈로그/등록) 전체 스위트(베이스라인 + vacuity + 회귀 + 대조군 4종)를 추가로 얹었다. 두 축은 서로 다른 소스 뷰(`basis` 대 `messagePrefixes`/`quotedLiterals`)와 서로 다른 판정 정본을 쓰는 독립적인 관심사이고, 파일 하나가 계속 커지면서 SRP가 파일 레벨에서 느슨해지는 방향으로 가고 있다(현재도 900줄대).
  - 제안: 지금 당장 분리할 필요는 없다(같은 `describe("유저 가이드 식별자 실재성 가드")` 안에서 공유 fixture — `citations`·`sourceTexts`·`basis` — 를 재사용하고 있어 강제 분리 시 중복 로딩이 생긴다). 다만 세 번째 축이 추가되는 시점에는 `guide-identifier-existence-*.test.ts` 형태로 축별 분리를 검토할 것.

## 요약

이번 배치의 실질 코드는 문서/테스트 전용 정적 가드 모듈(`guide-identifier-scan.ts`)에 "발행 축"
하나를 추가한 것으로, 프로덕션 런타임 레이어와는 무관하다. 5라운드에 걸친 자기 개정을 통해
판정 로직이 테스트 파일의 지역 클로저에서 스캐너 모듈로 이동해 기존 "존재 축" 관례와 소유권이
정합해졌고(이전 라운드 architecture INFO#1이 해소됨), 거울상 허용목록(`GUIDE_EXTERNAL_VOCABULARY`
↔ `GUIDE_NON_EMITTED_VOCABULARY`)의 반대 제약을 명시적으로 문서화해 합치고 싶은 유혹을 사전에
차단한 점도 설계상 건전하다. 순환 의존성·레이어 경계 위반·안티패턴 수준의 결함은 발견되지 않았다.
남은 지적은 전부 INFO 수준의 사소한 결합/일관성 관찰(캡처 그룹 위치 인덱스의 암묵 결합, 두 반복
관용구의 공존, 실코퍼스에서 발화하지 않는 카탈로그 탈출구 분기, 파일 크기 증가 추세)이며, 모두
이미 코드 주석·plan·대조군 테스트로 인지되고 방어되어 있어 즉각 조치가 필요한 위험으로 보지 않는다.

## 위험도
LOW
