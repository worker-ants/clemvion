# 요구사항(Requirement) 리뷰 — error-code-emission-axis

## 발견사항

- **[WARNING]** `MAX_ITERATIONS_EXCEEDED` 회귀 테스트/JSDoc 이 실제 통과 메커니즘을 잘못 지목한다 — "카탈로그 덕에 통과" 가 아니라 "소비자 Set 인용" 때문이다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:200` (`it("[회귀] \`MAX_ITERATIONS_EXCEEDED\` 는 **카탈로그 덕에** 통과한다", …)`), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:379-381` (`collectCatalogCodes` JSDoc — *"`MAX_ITERATIONS_EXCEEDED` 처럼 접두로만 발행되지만 spec 이 정식 코드로 인정한 것이 통과한다"*)
  - 상세: `isMessagePrefixOnly(t) = messagePrefixes.has(t) && !quotedLiterals.has(t)` 이다. `MAX_ITERATIONS_EXCEEDED` 는 `execution-failure-classifier.ts:76` 의 소비자 `Set` 에 `'MAX_ITERATIONS_EXCEEDED'` 로 **정확히-토큰만 담긴 따옴표 리터럴**로도 등장하므로 `quotedLiterals.has("MAX_ITERATIONS_EXCEEDED")` 가 `true` 다. 즉 `isMessagePrefixOnly("MAX_ITERATIONS_EXCEEDED")` 는 **이미 `false`** 이고, 이 토큰은 `offenders` 필터의 **첫 단계에서 걸러져 카탈로그 검사(`!catalogCodes.has(t)`)에 도달하지도 않는다**. 세 소스 파일(`execution-failure-classifier.ts`·`loop-executor.ts`·`execution-engine.service.ts`)과 `spec/5-system/3-error-handling.md` 를 대상으로 스캐너의 세 정규식(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`)을 직접 재현해 실측했다:
    ```
    MAX_ITERATIONS_EXCEEDED { quoted: true,  prefix: true, catalog: true,  isMessagePrefixOnly: false }
    CONTAINER_MISSING_EMIT  { quoted: false, prefix: true, catalog: false, isMessagePrefixOnly: true }
    CONTAINER_MULTIPLE_EMIT { quoted: false, prefix: true, catalog: false, isMessagePrefixOnly: true }
    ```
    즉 오늘 코퍼스에서 **카탈로그(`collectCatalogCodes`)는 `MAX_ITERATIONS_EXCEEDED` 를 통과시키는 데 관여하지 않는다** — 통과시키는 것은 정확히 이 축의 §B 가 스스로 "함정"·"거짓 PASS" 라고 이름 붙인 그 소비자-인용 경로다(`spec/5-system/3-error-handling.md §1.4`: *"소비자·분류기 쪽 어휘이지 발행 경로의 앵커가 아니다"*). `plan/in-progress/error-code-emission-axis.md` §B-3·CHANGELOG "잔여 한계" 절은 이 실제 메커니즘(소비자 인용이 접두-전용 판정을 푼다)을 **정확히** 서술하고 있어, 같은 PR 안에서 상위 문서(CHANGELOG/plan)와 하위 in-code 주석·테스트 제목이 서로 다른 원인을 지목하는 내부 불일치다.
  - 왜 문제인가: 오늘은 결과가 우연히 같아(둘 다 GREEN) 기능 결함은 아니다. 그러나 이 "[회귀]" 테스트는 이 축의 **두 토큰 클래스를 가르는 정확한 지점**을 이름으로 고정하려는 목적으로 작성됐는데, 실제로는 그 지점을 가리키지 못한다. `CATALOG_CODE` 뮤테이션(빈 집합)이 RED 를 내는 것도 이 테스트의 `catalogCodes.has(...)).toBe(true)` 단언이 사실 확인용으로 직접 걸려 있기 때문이지, `offenders` 계산 경로가 카탈로그에 의존해서가 아니다 — 이 프로젝트가 반복 기록해 온 "설계 근거는 뮤테이션으로 반증해 보라" 클래스의 재발이다.
  - 제안: JSDoc/테스트 제목·주석에서 "카탈로그 덕에 통과한다" 표현을 "소비자 Set(`execution-failure-classifier.ts`)의 정확한-리터럴 인용 때문에 `isMessagePrefixOnly` 가 이미 `false` 가 되어 카탈로그 단계 자체에 도달하지 않는다"로 정정하고, 별도로 `quotedLiterals`/카탈로그 각각이 **단독으로** offenders 를 걸러내는 실제 사례(또는 그런 사례가 오늘 0건이라는 사실)를 vacuity 절에 명시할 것을 권한다.

- **[WARNING]** `GUIDE_NON_EMITTED_VOCABULARY` 가 스스로 "`GUIDE_EXTERNAL_VOCABULARY` 의 거울상"이라 서술하면서도, 원본이 강제하는 4가지 중 2가지(상한·"여전히 인용되는가" 죽은 항목 방지)를 이식하지 않았다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:287-307` (`GUIDE_NON_EMITTED_VOCABULARY` JSDoc, "위 목록의 **거울상**이다" 서술), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:171-198` (등록 3종에 대한 테스트 4개)
  - 상세: `GUIDE_EXTERNAL_VOCABULARY` 는 스캐너 상단 주석이 명시하듯 "네 가지"(외부 시스템 이름 의무·**상한**·**여전히 인용될 것**·기준집합에 없을 것)를 테스트가 강제해 허용목록이 "은폐 수단"이 되지 않게 막는다(`EXTERNAL_VOCABULARY_CAP = 5`, `it("각 항목이 여전히 가이드에 인용된다 …")`). `GUIDE_NON_EMITTED_VOCABULARY` 는 대응하는 3개(실제 접두-전용인가·기준집합에 있는가·사유 명시)만 강제하고, **상한 검사와 "여전히 가이드에 인용되는가"(죽은 등록 방지) 검사가 없다.** 후자가 없으면, 나중에 가이드 문장이 리라이트되어 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 더 이상 인용하지 않게 되어도 등록 항목 3개는 그대로 남아 무한정 누적될 수 있다. `isMessagePrefixOnly` 테스트("등록된 3종이 실제로 접두 전용이다")는 **소스**의 메시지-접두 상태만 재검증할 뿐, **가이드가 여전히 그 토큰을 인용하는지**는 검증하지 않는다.
  - 제안: `GUIDE_EXTERNAL_VOCABULARY_CAP` 과 대칭인 상한 상수, 그리고 `citations` 기준 "여전히 인용된다" 죽은-항목 검사를 추가해 두 목록의 강제 항목 수를 실제로 대칭시킬 것.

## 참고 (INFO — 이미 다른 산출물에 등재됨, 재조치 불필요)

- `spec/4-nodes/1-logic/9-foreach.md §6` 열 제목 "메시지 / 코드"의 모호성, `spec/5-system/3-error-handling.md §1.4` 카탈로그에 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 미등재 — `review/consistency/2026/09/13/18_40_54/cross_spec.md` WARNING(#2)·`rationale_continuity.md` WARNING(#3) 이 이미 지적했고 plan §D 가 "이번 PR 범위 밖 후속"으로 정확히 defer 했다. 직접 실측(`grep`)으로 재확인만 하고 새 결함으로 카운트하지 않는다.
- mdx 문장(KO/EN) 변경은 실제 구현(`execution-engine.service.ts:7121,7125,7130` — 일반 `Error` + 템플릿 리터럴 메시지 접두, 구조화 `error.code` 없음)과 line-level 로 정확히 일치한다. KO/EN 두 문장도 의미가 동등하다.
- `guide-identifier-existence.test.ts` 스위트를 직접 실행해 46/46 GREEN 을 확인했다(plan 이 claim 한 "39 → 46"과 일치).

## 요약

기능적으로는 GREEN 이다 — 새 "발행 축"이 실제로 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 잡아 등록을 강제했고, mdx 문장 정정은 실제 엔진 동작(일반 Error, 메시지 접두, 구조화 코드 없음)과 정확히 일치하며, 전체 스위트(46/46)도 통과한다. 다만 이 축을 지탱하는 핵심 서사(`MAX_ITERATIONS_EXCEEDED` 가 "카탈로그 덕에" 통과한다는 [회귀] 테스트/JSDoc)는 실제 실행 경로와 다르다 — 실측 결과 이 토큰은 카탈로그 단계에 도달하기 전에 `quotedLiterals`(소비자 Set 인용) 단계에서 이미 걸러진다. CHANGELOG 의 "잔여 한계" 절은 이 실제 메커니즘을 정확히 서술하고 있어, in-code 주석·테스트 이름만 정정하면 되는 국소적 문제다. 두 번째로, 새로 도입한 `GUIDE_NON_EMITTED_VOCABULARY` 는 스스로 "거울상"이라 부르는 `GUIDE_EXTERNAL_VOCABULARY` 대비 강제 항목이 2개(상한·죽은-등록 방지) 적어 장기적으로 무한 누적 위험이 있다. 두 발견 모두 오늘의 베이스라인-0 판정을 뒤집지는 않으므로 WARNING 으로 분류한다.

## 위험도

MEDIUM
