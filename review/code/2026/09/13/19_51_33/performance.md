# 성능(Performance) 코드 리뷰 — error-code-emission-axis

## 검토 범위

이 배치의 실질 코드 변경은 두 파일에 국한된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 정규식 3종 + 공용 수집기 `collectMatches` + `GUIDE_NON_EMITTED_VOCABULARY`)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(그 축을 소비하는 단언·대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·`review/**`)는 문서·plan·리뷰 산출물이라 성능 관점 대상이 아니다. 대상 두 파일 모두 **테스트/개발 시점 전용 코드**이며(`__tests__/` 하위, vitest 로만 실행), 런타임 프로덕션 요청 경로에는 포함되지 않는다 — 이 점이 아래 판정 전반의 전제다.

## 발견사항

- **[INFO]** 신규 3-수집기가 `String.prototype.matchAll` 을 쓰면서 텍스트마다(=파일마다) 정규식 객체를 새로 클론한다 — 기존 4곳의 수동 `lastIndex` 관용구보다 정규식 재컴파일 횟수가 늘어난다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `collectMatches` 정의(`281`~`291`), 호출부 `collectQuotedLiterals`(`369`~`374`)·`collectMessagePrefixes`(`382`~`386`)가 `guide-identifier-existence.test.ts:86-87` 에서 `sourceTexts`(backend `src` + `packages` 전체 `.ts`, vacuity floor 로 `500` 파일 초과가 보장됨— 테스트 파일 `104`행)에 대해 각각 전수 호출된다.
  - 상세: `text.matchAll(rx)` 는 스펙상 매 호출마다 `rx` 를 `source`/`flags` 로 복제한 새 `RegExp` 인스턴스를 만든다(공유 `lastIndex` 오염을 피하려는 의도이고, 파일 자체 주석(`242`~`257`, `276`)이 이 트레이드오프를 정확히 설명하고 있다). 결과적으로 `QUOTED_LITERAL`·`MESSAGE_PREFIX` 두 정규식이 각각 500개+ 파일마다 재구성되어, 기존 4곳(`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`)이 정규식 객체 하나를 재사용하며 `lastIndex = 0` 만 리셋하는 방식보다 (파일 수 × 정규식 수)만큼의 추가 객체 생성·컴파일 오버헤드가 생긴다.
  - 영향: 테스트 스위트 1회 실행에서 수백 회의 소규모 `RegExp` 생성이 늘어나는 정도로, `vitest run` 전체 소요 시간에 눈에 띄는 영향을 줄 규모는 아니다(패턴 자체가 단순하고 파일 크기도 개별 소스 파일 수준). 프로덕션 요청 경로에는 전혀 노출되지 않는다.
  - 제안: 현재 트레이드오프(정확성 > 미세 성능, 명시적으로 문서화됨)는 합리적이라 조치를 강제하지 않는다. 다만 이 코퍼스가 앞으로 더 커지거나(예: frontend 소스까지 기준집합에 포함) 다섯 번째 축이 추가돼 매트릭스가 늘어나면, `rx.lastIndex = 0` 재사용 방식으로 전환하는 편이 유리해지는 지점이 온다 — 그 판단은 이미 등재된 "4곳 `lastIndex` 통합 리팩터" 트래커 항목과 함께 재검토하면 된다.

- **[INFO]** 새 발행 축이 기존에 이미 적재된 `sourceTexts` 를 재사용해 추가 I/O 없이 순수 계산만 늘렸다 — 확인 후 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-58`(`sourceTexts` 최초 적재), `:86-93`(발행 축이 같은 배열을 재사용, `catalogCodes` 만 파일 1개를 추가로 읽음)
  - 상세: `collectQuotedLiterals(sourceTexts)`/`collectMessagePrefixes(sourceTexts)` 는 기준집합용으로 이미 `fs.readFileSync` 된 문자열 배열을 그대로 받는다 — 파일을 다시 열지 않는다(N+1 I/O 없음). 추가되는 것은 그 문자열들에 대한 2회의 추가 선형 정규식 스캔뿐이고, 이는 describe 블록 최상위(테스트 컬렉션 시점)에서 **1회만** 실행되며 개별 `it()` 마다 반복 재계산되지 않는다. `catalogCodes` 를 위한 `spec/5-system/3-error-handling.md` 읽기도 파일 1개, 1회 호출이라 무해하다.
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **확인 후 문제 없음(참고)**: `collectMatches` 자체(`texts × matchAll` 이중 루프)는 시간복잡도가 코퍼스 총 문자 수에 선형이며 알고리즘적 결함(이중 정량자로 인한 재앙적 백트래킹 등)이 없다 — `UPPER_SNAKE` 를 감싸는 세 정규식(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`) 모두 겹치지 않는 정량자 구조를 그대로 물려받는다(`security.md` INFO#1 이 이미 확인). 테스트 본문의 `isMessagePrefixOnly` 판별과 `citations.filter(...)` 체인(`existence.test.ts:160-186`)은 전부 `Set.has`(O(1)) 기반이라 코퍼스 크기에 비해 추가 비용이 무시할 만하다. 신규 목록(`GUIDE_NON_EMITTED_VOCABULARY`, 3항목)과 상수(`NON_EMITTED_VOCABULARY_CAP = 5`)는 크기가 작아 메모리·순회 비용에 영향이 없다. 문서 파일들(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`)과 plan/review 산출물은 성능 관점에서 논할 대상이 아니다.

## 요약

이 배치는 사실상 전부 dev-time 테스트 하니스 코드(가이드 식별자 존재/발행 검증 스캐너)와 문서 정정으로 구성되며, 프로덕션 런타임 경로·DB·네트워크·블로킹 I/O 는 전혀 건드리지 않는다. 신규 수집기 3종은 이미 메모리에 적재된 `sourceTexts` 를 재사용해 추가 파일 I/O 를 만들지 않고, describe 블록 최상위에서 1회만 계산되어 N+1 이나 반복 재계산 패턴이 없다. 유일한 언급 거리는 `matchAll` 채택으로 인해 정규식 객체가 파일마다 재클론되는 미세한 오버헤드인데, 이는 공유 `lastIndex` 오염(정확성 결함)을 피하기 위한 의도적·문서화된 트레이드오프이고 테스트 전용 코드라 실질적 영향이 없다. 알고리즘 복잡도·메모리·캐싱·블로킹 I/O·자료구조 선택 어느 관점에서도 즉시 조치가 필요한 성능 결함은 발견되지 않았다.

## 위험도
NONE
