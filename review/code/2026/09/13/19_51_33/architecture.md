# 아키텍처(Architecture) 리뷰 — error-code-emission-axis

## 검토 범위

이 배치의 실질 아키텍처 표면은 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
(스캐너 모듈, 신규 "발행 축" 수집기 3종 + `GUIDE_NON_EMITTED_VOCABULARY`)와
`guide-identifier-existence.test.ts`(그 축의 단언 및 발행-여부 판정 로직)로 좁다. 나머지
(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`/`logic.en.mdx`·`plan/**`·`review/**`)는 문서/프로세스
산출물이라 SOLID·결합도·레이어·순환의존 관점의 표면이 없다. 이 харness 는 프로덕션 레이어
(프레젠테이션/비즈니스/데이터)에 속하지 않는 빌드·테스트 타임 정적 검증 도구이므로, 점검 관점 중
"레이어 책임"·"순환 의존성"은 해당 사항이 옅다(순환 없음, 단방향 import 확인함:
`guide-identifier-existence.test.ts` → `guide-identifier-scan.ts`/`tree-walk`/`impl-anchor-parse`).

## 발견사항

- **[INFO]** 발행 축의 핵심 분류 술어(`isMessagePrefixOnly`)와 판정 체인(offenders 필터)이
  스캐너 모듈이 아니라 테스트 파일에 정의돼 있어, 이 파일이 스스로 확립한 "축 소유권은
  스캐너 모듈에" 관례와 어긋난다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:98-100`
    (`const isMessagePrefixOnly = (token: string): boolean => messagePrefixes.has(token) && !quotedLiterals.has(token);`),
    `:161-167`(`offenders` 필터 체인 — `isMessagePrefixOnly` → `!catalogCodes.has` →
    `!registeredNonEmitted.has`)
  - 상세: 존재 축의 분류 로직(`scanIdentifierCitations`, `collectSourceTokens`,
    `collectEnvDeclarations`)은 전부 `guide-identifier-scan.ts`에서 **export 된 순수 함수**로
    소유되고, 테스트는 그 결과를 소비만 한다. 반면 발행 축의 실질적인 "이 토큰이 메시지
    접두-전용인가"라는 도메인 판정(`isMessagePrefixOnly`)과, 그것을 카탈로그·등록 목록과
    합성해 "위반인가"를 최종 결정하는 필터 체인은 scan.ts 가 아니라 test.ts 안에서만
    조립된다. 같은 파일의 `plan_coherence.md`(리뷰 산출물, 파일 26)조차 "가이드 가드
    양방향화" 후속 항목이 "이 축의 구분을 재사용하는 것이 자연스럽다"고 적어 두어 재사용
    가능성을 이미 전제하는데, 재사용 대상 로직이 테스트 파일에 갇혀 있으면 재사용하려는
    다음 소비자가 동일한 불리언 식을 복제해야 한다. 또한 이 판정은 순수하게 유닛
    테스트하기 좋은 도메인 로직(입력: quotedLiterals/messagePrefixes 두 Set, 토큰 하나)인데,
    지금은 실제 저장소 코퍼스를 통해서만 간접 검증된다(같은 파일의 "[회귀]" 테스트가 실제
    코퍼스 값에 의존해 이 함수를 검증 — 코퍼스가 바뀌면 그 검증 경로도 함께 흔들린다).
  - 제안: `isMessagePrefixOnly(token, {quotedLiterals, messagePrefixes}): boolean` 형태로
    `guide-identifier-scan.ts` 에 export 하고, 테스트는 그 함수를 import 해 합성 fixture 로
    직접 유닛 테스트할 수 있게 한다. 존재 축과 동일한 "스캐너가 판정 로직을 소유, 테스트는
    소비" 경계를 발행 축에도 적용하면 다음 축을 추가할 때 따라야 할 관례가 하나로 통일된다.

- **[INFO]** 거울상으로 명시된 두 허용목록(`GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY`)이
  공통 필드(`token`·`why`)를 공유하면서도 타입 수준에서는 이를 표현하는 공유 인터페이스가 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:300-310`
    (`GUIDE_EXTERNAL_VOCABULARY: readonly { token: string; system: string; why: string }[]`),
    `:333-338`(`GUIDE_NON_EMITTED_VOCABULARY: readonly { token: string; where: string; why: string }[]`)
  - 상세: 두 목록은 JSDoc 대조표(같은 파일 `:315-318`)로 "거울상"임을 문서화하고 있지만,
    실제 타입 선언은 각각 독립적인 인라인 객체 리터럴 타입이다. 공통 필드(`token`·`why`)와
    맥락 필드(`system` vs `where`) 구조가 사실상 같은 패턴(식별자 + 면제 사유 + 맥락 한
    필드)인데 이를 코드 차원의 공유 타입(예: `interface VocabularyEntry<K extends string> { token: string; why: string } & Record<K, string>`
    또는 최소한 `{ token: string; why: string }` 베이스 인터페이스를 두 곳이 extends)으로
    표현하지 않는다. 지금은 두 목록의 "닮음"이 JSDoc 산문에만 존재하고 타입 시스템에는
    없어서, 세 번째 거울상 목록이 추가될 때(이 파일 자신이 `#1330` 이후 두 번째 번복이라고
    적어 둔 패턴이 반복될 가능성을 시사) 그 유사성을 다시 산문으로만 재서술하기 쉽다.
  - 제안: 두 항목 다 낮은 우선순위지만, 공유 베이스 인터페이스를 두면 "두 목록이 반대
    제약을 갖는 거울상"이라는 설계 의도가 컴파일 타임에도 드러난다(예: 리뷰어가 필드
    이름만 보고도 계열을 알 수 있음). 즉시 조치 불요, 세 번째 목록이 생기는 시점에 함께
    고려할 사항으로 남긴다.

- **[INFO]** 발행 축의 "위반" 판정이 세 개의 독립된 예외 채널(존재-축 허용목록 `allowed`,
  카탈로그 탈출구 `catalogCodes`, 발행-축 등록 목록 `registeredNonEmitted`)의 합성으로 결정돼,
  축이 늘수록 단일 게이트 조건의 분기 표면이 누적된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:161-167`
    (offenders 필터 체인)
  - 상세: 이번 배치의 RESOLUTION.md(파일 9)가 스스로 기록한 사례가 이 위험을 실증한다 —
    "카탈로그 탈출구 덕에 통과한다"는 최초 서술이 실은 `quotedLiterals`(다른 채널)와의
    상호작용 때문에 틀렸다는 것을 리뷰 라운드에서 뒤늦게 발견했다(`MAX_ITERATIONS_EXCEEDED`
    사례). 즉 여러 예외 메커니즘이 하나의 불리언 체인으로 합쳐지면, 어떤 조건이 실제로
    특정 토큰의 통과를 결정하는지가 코드를 순서대로 읽는 것만으로는 드러나지 않고 단계별
    실측(디버깅)이 필요해진다 — 이 배치 자체가 그 비용을 한 번 치렀다. 축이 두 개(존재·
    발행)인 지금은 감당할 만하지만, 이 파일의 plan_coherence 리뷰(파일 26)가 "다섯 번째
    축"을 이미 예견하고 있어 이 체인은 계속 자랄 가능성이 높다.
  - 제안: 즉시 리팩터를 요구하지는 않는다(오늘 기능은 정확하고 뮤테이션 검증도 통과했다).
    다만 다음 축을 추가할 때는 `classifyToken(token): "existent" | "external" | "message-prefix-registered" | "catalog-exempt" | "offending"` 류의
    단일 판정 함수로 수렴시켜, "왜 이 토큰이 통과했는가"를 필터 체인을 손으로 추적하지
    않고 함수 하나의 반환값으로 답할 수 있게 하는 것을 고려할 가치가 있다.

## 긍정적으로 확인한 설계 (참고)

- `collectMatches(texts, rx, group)` 공유 수집기 추출(`guide-identifier-scan.ts:281-291`)은
  신규 축 3종의 근접 중복을 없애면서도 개방-폐쇄 원칙에 부합하는 확장점을 만들었다 — 다음
  축은 정규식 상수 하나 + `collectMatches` 호출 한 줄로 추가 가능하다(기존 4곳의 수동
  `lastIndex` 루프 패턴을 답습하지 않음).
  이 리팩터가 남긴 기존 4곳의 수동 `lastIndex` 관용구와의 이중 관용구 공존은 유지보수성
  리뷰(`maintainability.md`)가 이미 다루고 있어 본 리뷰에서 중복 지적하지 않는다.
- 스캐너(순수 함수 + 데이터)와 테스트(단언)의 파일 분리는 이 저장소의 기존 harness 관례
  (`impl-anchor-parse.ts`/`impl-anchor-existence.test.ts` 등)와 일관되며, 존재 축 로직에
  한해서는 모듈 소유 경계가 깔끔하다.
- 순환 의존성 없음 — `guide-identifier-existence.test.ts` → `guide-identifier-scan.ts` 단방향.
  export 표면(`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`·
  `collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`·두 허용목록)이
  기존 시그니처를 변경하지 않는 순수 추가라 하위 호환성 파괴(LSP 위반 여지)가 없다.

## 요약

이번 배치는 harness(테스트 타임 정적 스캐너) 코드에 국한돼 프로덕션 레이어·서비스 경계에
영향이 없고, 순환 의존성이나 계층 책임 위반도 없다. 가장 눈에 띄는 긍정적 설계는
`collectMatches` 로의 일반화 — 근접 중복 3곳을 없애면서 다음 축 추가 시의 확장 비용을
낮췄다. 다만 세 가지 미세한 아키텍처 결(grain)이 있다: (1) 발행 축의 핵심 분류 로직이
스캐너 모듈이 아닌 테스트 파일에 있어 존재 축과의 모듈 소유권 관례가 일관되지 않고 재사용이
막혀 있다, (2) 거울상으로 문서화된 두 허용목록이 타입 수준에서는 그 관계를 표현하지 않는다,
(3) 발행 축의 최종 판정이 세 개의 독립 예외 채널을 체인으로 합성해, 이 배치 자신의 리뷰
라운드에서 실제로 상호작용 오판(카탈로그 vs 소비자-인용)이 한 번 발생했을 만큼 분기 표면이
누적되고 있다. 셋 다 기능 결함이 아니라 다음 축(들)이 추가될 때 유지보수 비용을 좌우할
설계 결이라 INFO 수준으로 남기며, 이번 PR 을 막을 사유는 아니다.

## 위험도
LOW
