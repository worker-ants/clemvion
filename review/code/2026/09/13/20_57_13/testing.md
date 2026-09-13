# 테스트(Testing) 코드 리뷰 — error-code-emission-axis (라운드 5)

## 검토 범위

실질 테스트 코드는 `guide-identifier-existence.test.ts`(신규 발행 축 단언 7종 + 대조군 다수)와
`guide-identifier-scan.ts`(수집기 3종 + `GUIDE_NON_EMITTED_VOCABULARY`)에 집중된다. 두 파일은
프롬프트 크기 제한으로 diff 가 생략돼 `Read` 로 원본 전체를 직접 열어 확인했다(위치 인용은 그
실제 소스 줄 번호다). 나머지 파일(CHANGELOG·PROJECT.md·`logic{,.en}.mdx`·`plan/**`·
`review/**`)은 문서/추적 산출물이라 테스트 관점 발견사항이 없다.

이미 라운드 1~4 에서 대조군·진리표·`where` 다중 매치·이름 충돌 등 다수의 결함이 실측·뮤테이션으로
잡혀 있고(체크리스트 §체크리스트, plan §E~H), 그 처분 이력을 다시 지적하지 않도록 각 라운드의
`testing.md` 를 먼저 확인했다. 아래 발견사항은 그 이력에 없는 것만 추렸다.

`npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts` 로 현재 71/71 GREEN 을
직접 확인했다(`codebase/frontend`에서 실행 — 워크스페이스 루트에서 돌리면 다른 vitest 버전을 잡는
기존 함정이 있음, 이번엔 올바른 위치에서 실행).

## 발견사항

- **[WARNING]** "카탈로그 탈출구" 의 **실제 프로덕션 필터**가 뮤테이션에 무방비 — 71/71 GREEN 으로 생존을 직접 실측
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:192-199`
    (`it("접두 전용이면서 카탈로그에도 없는 인용은 **등록돼 있다** (베이스라인 0)"`)`)의
    `.filter((t) => !catalogCodes.has(t))` 절. 대비되는 병렬 계산은 `:326-340`
    (`it("[한계] 카탈로그 탈출구는 **오늘 한 번도 발화하지 않는다**"`)`)의 `rescuedByCatalog`.
  - 상세: 실제 offender 판정(가이드가 인용한 식별자 중 등록·정정이 필요한 것을 골라내는 코드)은
    `offenders = citations.filter(prefixOnly).filter(t => !catalogCodes.has(t)).filter(t => !registeredNonEmitted.has(t))`
    이다. 이 파일은 뮤테이션 규약(cp 백업 → 수정 → 검증 → cp 원복)에 따라
    `.filter((t) => !catalogCodes.has(t))` 한 줄을 통째로 삭제하고 스위트를 재실행했다 — 결과는
    **71/71 GREEN**(변화 없음, 원복 완료·`git status --short` 로 확인). 즉 "카탈로그에 있으면
    등록 없이 통과한다"는 이 축의 핵심 설계 문장을 구현하는 코드 줄이 실제로는 **어떤 테스트도
    지목하지 않는다**.
    원인은 이미 이 파일 자신이 자세히 문서화한 사실(§`collectCatalogCodes` JSDoc, plan §B-3·§E) —
    오늘 코퍼스에서 «접두 전용 ∩ 카탈로그»가 공집합이라, 이 필터 절이 있든 없든 `offenders` 결과가
    똑같다. `:326-340` 의 "[한계]" 테스트가 바로 이 공집합 사실을 `rescuedByCatalog` 로 이미
    단언하고 있지만, **그 계산은 실제 offender 로직과 별개의 병렬 구현**(`filter(prefixOnly).filter(t => catalogCodes.has(t))`)이라, 진짜
    offender 계산부의 해당 절이 삭제·반전돼도 `rescuedByCatalog` 쪽 단언은 아무 영향을 받지 않는다
    — "탈출구가 언젠가 발화하면 이 단언이 RED 로 알려준다"는 이 파일의 반복된 설계 의도(§E·§D-2
    JSDoc)가 **실제 프로덕션 코드 경로에는 적용되지 않는** 셈이다. 카탈로그가 채워지는(트래커
    §1.4 backfill 이 집행되는) 순간 이 필터가 있어야만 올바르게 동작하는데, 그 시점 이전까지는
    누가 이 절을 지우거나 조건을 반전시켜도 회귀 테스트가 조용히 통과한다.
  - 제안: `isMessagePrefixOnly` 에 이미 적용한 패턴(정본이 판정 로직을 소유 + 분리 인자 truth
    table)을 이 필터 체인에도 적용한다 — 예:
    `export function computeNonEmittedOffenders(tokens, prefixOnly, catalogCodes, registered): string[]`
    를 `guide-identifier-scan.ts` 에 추가하고, 베이스라인-0 테스트와 `[대조군] 탈출구가 작동은
    한다` 테스트 양쪽이 **같은 함수**를 호출하도록 통일한다. 그러면 `[대조군]` 절의 합성
    `synthCatalog`/`synthPrefixes`/`synthQuoted` 가 실제로 이 함수를 호출해 `offenders` 가
    비어 있음을 검증할 수 있고(현재는 세 개별 Set 을 따로 조회만 하고 조합된 결과를 단언하지
    않는다), 카탈로그 필터가 사라지거나 반전되면 그 합성 테스트가 즉시 RED 가 된다.

- **[INFO]** `EXTERNAL_VOCABULARY_CAP`·`NON_EMITTED_VOCABULARY_CAP` 이 "같은 값으로 둔다"는
  주석상 불변식을 단언이 강제하지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:21-27`
  - 상세: 주석이 "거울상 목록과 **같은 값**으로 둔다"고 명시적으로 선언하지만(`:24-27`), 두 상수가
    실제로 같은지 확인하는 단언은 없다. 각 목록은 자신의 상한만 개별로 검사한다(`:409-414`,
    `:286-293`). 한쪽만 바뀌어도 어떤 테스트도 알리지 않는다.
  - 제안: `expect(NON_EMITTED_VOCABULARY_CAP).toBe(EXTERNAL_VOCABULARY_CAP)` 한 줄을 추가하거나,
    상수를 하나로 통합하고 두 자리에서 재사용한다. 기능 영향은 없어 INFO.

- **[INFO]** `where` 파싱 검증의 `hits.length !== 1` 분기(다중/부재 파일)가 실제 코퍼스·합성
  테스트 어느 쪽으로도 도달하지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:254-258`
  - 상세: 현재 등록된 3개 항목의 `where` 는 모두 `codebase/backend/src` 안에서 파일명이 유일한
    두 파일(`makeshop.handler.ts`, `execution-engine.service.ts`)을 가리켜(grep 으로 직접 확인,
    각각 정확히 1건) `hits.length === 1` 분기만 실행된다. `broken.push(... hits.length 건)` 줄
    자체를 지워도(또는 조건을 반전해도) 오늘 스위트는 영향받지 않는다 — `parseWhereRefs` 대조군
    (`:271-284`)도 파서 자체만 겨누고 이 분기는 겨누지 않는다.
  - 제안: 낮은 우선순위. 굳이 닫으려면 존재하지 않는 파일명을 가리키는 합성 `where` 로 이
    분기만 겨누는 단위 테스트를 추가할 수 있으나, 등록 목록이 실제로 그런 입력을 받을 가능성이
    낮아 조치를 강제하지는 않는다.

## 테스트 격리·가독성·Mock 적절성 (문제 없음, 확인만)

- 파일시스템을 실제로 읽는 통합-성격 테스트(`fs.readFileSync`)이며 mock 을 쓰지 않는다 — 이 가드의
  설계 목적(실제 코퍼스 대비 실재성 검증) 자체가 진짜 파일을 요구하므로 적절하다. `readIfPresent`
  가드 없이 `spec/5-system/3-error-handling.md` 를 직접 읽는 점은 `side_effect.md`(같은 세션)가
  이미 지적·판단했고 기존 관행과 일치해 재지적하지 않는다.
- 최상위 `describe` 안의 공유 상태(`sourceTexts`, `basis`, `citations` 등)는 읽기 전용 계산이라
  테스트 간 상호오염 위험이 없다. 각 `it` 는 독립 실행 가능하다.
- 신규 함수(`collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`·
  `isMessagePrefixOnly`) 전부 합성 경계 대조군을 갖췄고, 두 판정이 갈리는 값을 이름으로 고정하는
  이 파일의 규율을 충실히 따른다. `MAX_ITERATIONS_EXCEEDED` vs `CONTAINER_MISSING_EMIT` 대조
  (`:308-324`)는 발행 축의 핵심 갈림을 정확히 짚는다.
- `parseWhereRefs`·`staleGuideEntries` 는 라운드 2~4 에서 이미 대조군을 얻었고 뮤테이션으로
  검증됐다(plan §F·§G). 회귀 테스트로서 유효하다.

## 요약

가장 실질적인 갭은 발행 축의 "카탈로그 탈출구" 설계 — 카탈로그 등재 여부로 등록 의무를
면제하는 로직 — 를 실제로 실행하는 필터 절이 회귀 테스트의 보호를 받지 못한다는 점이다(WARNING,
직접 뮤테이션으로 71/71 GREEN 생존을 실측·원복 완료). 원인은 이 가드 자신이 이미 자세히 문서화한
"오늘 이 교집합은 공집합"이라는 사실 그 자체이고, 안전망 역할을 하도록 설계된 `[한계]`/`[대조군]`
테스트가 실제 offender 계산 코드와 분리된 병렬 구현이라 서로를 지켜주지 못한다. 나머지는 상수
불변식 미검증·희귀 분기 미도달 같은 낮은 우선순위 INFO 두 건뿐이다. 그 외 신규 코드는 이 파일이
스스로 세운 "합성 대조군 필수" 규율을 매우 촘촘히 지키고 있고, 라운드 1~4 가 이미 잡은 결함들은
재발하지 않았다(회귀 확인).

## 위험도

LOW
