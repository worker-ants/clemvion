# 성능(Performance) 코드 리뷰 — error-code-emission-axis (라운드 N, `22_06_10`)

## 검토 방법

`git diff origin/main`(현재 브랜치 누적 diff, 프롬프트에 첨부된 16개 파일과 실질적으로
동일한 변경 집합)을 기준으로, 실질 코드가 있는 두 파일 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 정규식 3종 +
공용 수집기 `collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY`)와
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(그 축을
소비하는 단언 + `resolveSourceLines` 캐시 + 신규 대조군 describe 블록들) — 를
`Read`/`grep`으로 직접 열어 확인했다. 이 배치는 이미 여러 라운드(`19_23_22` ~
`21_41_2x`)의 `/ai-review`·`--impl-done` 을 거쳤고, 이전 성능 라운드(`19_51_33/performance.md`)
가 지적한 항목(정규식 재클론 트레이드오프)과 다른 라운드(`21_19_46` performance
WARNING#1, `where` 항목마다 `walkTree` 반복)가 이미 `resolveSourceLines` 캐시로 고쳐진
상태다. 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는
문서·plan·리뷰 산출물이라 성능 관점 대상이 아니다. 대상 두 파일 모두 **테스트/개발 시점
전용 코드**(`__tests__/` 하위, vitest 로만 실행)이며 런타임 프로덕션 요청 경로에는
포함되지 않는다 — 판정 전반의 전제다.

## 발견사항

- **[INFO]** `resolveSourceLines` 의 basename 캐시가 이전 라운드의 N+1 `walkTree` 를
  올바르게 닫았다 — 확인 후 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:87-101`
    (`sourceLinesCache`/`resolveSourceLines` 정의), 호출부는 `:219` 부근 `where` 검증
    `it()` 안의 `for (const { file, line } of refs)` 루프
  - 상세: `resolveSourceLines(file)` 은 `path.basename(file)` 을 키로 `Map` 조회 후
    캐시 미스일 때만 `walkTree(repoRoot(), ["codebase/backend/src"], …)` 로 전체
    트리를 훑는다. `where` 검증 테스트는 `GUIDE_NON_EMITTED_VOCABULARY` 의 각 항목마다
    `parseWhereRefs()` 로 뽑은 **여러** `파일:줄` 참조를 순회하는데, 등록 3항목·참조
    4개 중 3개가 같은 파일(`execution-engine.service.ts`)을 가리킨다 — 캐시가 없으면
    참조 개수만큼 트리 전체를 재순회한다(이전 라운드 `21_19_46` performance
    WARNING#1 이 정확히 이 패턴을 지적했다). 지금은 파일당 1회만 순회하도록 고쳐져
    있음을 직접 확인했다.
  - 영향: 목록 상한이 5(`NON_EMITTED_VOCABULARY_CAP`)로 고정돼 있어 캐시가 없어도
    최악의 경우 트리 순회가 5회를 넘지 않는다 — 원래도 "실질 비용 낮음"으로 처분됐던
    항목이지만, 지금은 그 상한과 무관하게 **고유 파일 수**로 더 타이트하게 유계화됐다.
  - 제안: 조치 불필요 — 개선이 이미 반영됨. 기록 목적의 INFO.

- **[INFO]** 발행 축 수집기가 `matchAll` 로 정규식을 텍스트마다 재클론한다 — 기존
  라운드에서 이미 검토·수용된 트레이드오프, 회귀 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:281-291`
    (`collectMatches` 정의), 호출부 `collectQuotedLiterals`(`:369-374` 부근)·
    `collectMessagePrefixes`(`:382-386` 부근)가
    `guide-identifier-existence.test.ts` 의 `sourceTexts`(backend `src` + `packages`
    전체 `.ts`, 수백 파일)에 대해 describe 블록 최상위에서 각 1회 호출된다.
  - 상세: `text.matchAll(rx)` 는 호출마다 `rx` 를 복제한 새 `RegExp` 를 만든다 — 파일
    자체 주석(`:242-257`)이 이 트레이드오프(공유 `lastIndex` 오염 회피 vs 재클론
    비용)를 명시한다. `QUOTED_LITERAL`·`MESSAGE_PREFIX` 두 정규식이 파일 수만큼
    재구성되지만, 정규식 자체가 단순(겹치지 않는 정량자 구조, `security.md` 가 이미
    ReDoS 여부 확인)하고 `sourceTexts` 는 describe 블록 최상위에서 1회만 적재·재사용돼
    (신규 I/O 없음) `it()` 마다 반복 재계산되지 않는다.
  - 영향: 테스트 스위트 1회 실행에 수백 회의 소규모 `RegExp` 생성이 늘어나는 정도로,
    `vitest run` 전체 소요 시간에 눈에 띄는 영향을 줄 규모가 아니다. 프로덕션 요청
    경로에는 노출되지 않는다.
  - 제안: 조치 불필요 — 이전 라운드(`19_51_33/performance.md`)의 처분과 동일 결론.
    코퍼스가 크게 늘거나(예: frontend 소스까지 기준집합 확장) 축이 더 늘면 그때
    `lastIndex` 재사용 방식 전환을 재검토(이미 별건 트래커 항목).

- **확인 후 문제 없음(참고)**: `computeNonEmittedOffenders`/`isMessagePrefixOnly` 신규
  판정 체인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` —
    `isMessagePrefixOnly`(`:395-401` 부근)·`computeNonEmittedOffenders`(`:420-436` 부근)
  - 상세: `[...new Set(citedTokens)].filter(...).filter(...).filter(...).sort()` 는
    citedTokens(가이드 mdx 인용 수, 수십~백여 개 규모) 크기에 선형이고 각 `.has()`
    조회는 `Set`/`ReadonlySet` 기반 O(1)이다. 알고리즘적 결함(중첩 정량자로 인한
    재앙적 백트래킹, O(n²) 누적 등) 없음. 이전엔 이 판정이 테스트 파일 안에
    `.filter()` 3회를 손으로 이어 붙인 형태였는데, 하나의 정본 함수로 합쳐지면서
    베이스라인·대조군이 같은 계산을 공유하게 됐다 — 성능상 중립이며 정확성 관점의
    개선(중복 계산 제거)이다.
  - 제안: 조치 불필요.

- 그 외 문서 파일(`CHANGELOG.md`·`PROJECT.md`·`logic.mdx`·`logic.en.mdx`)과 plan/review
  산출물은 성능 관점에서 논할 대상이 아니다(정적 텍스트, 실행 경로 없음).

## 요약

이 배치는 여전히 dev-time 테스트 하니스 코드(가이드 식별자 존재/발행 검증 스캐너)와
문서 정정으로 구성되며, 프로덕션 런타임 경로·DB·네트워크·블로킹 I/O 를 전혀 건드리지
않는다. 이전 라운드가 지적한 유일한 실질 성능 이슈(`where` 검증이 참조마다 backend
전체 트리를 재순회하는 N+1 형태의 `walkTree`)는 `resolveSourceLines` 의 basename
캐시로 이미 닫혀 있음을 직접 확인했다. 남은 유일한 언급 거리는 `matchAll` 채택으로
인한 정규식 재클론 오버헤드인데, 이는 공유 `lastIndex` 오염(정확성 결함)을 피하기
위한 의도적·문서화된 트레이드오프이고 테스트 전용 코드라 실질적 영향이 없다 —
이전 성능 라운드의 판정과 동일하다. 신규 판정 함수(`computeNonEmittedOffenders` 등)는
`Set` 기반 O(1) 조회와 선형 필터 체인만 사용해 알고리즘 복잡도 문제가 없다. 알고리즘
복잡도·메모리·캐싱·블로킹 I/O·자료구조 선택 어느 관점에서도 이번 라운드에서 새로
발견된 성능 결함은 없다.

## 위험도

NONE
