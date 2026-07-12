# 테스트(Testing) 리뷰 — carousel 잘림 배너 (fresh round, 21_59_01 후속)

대상: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`, `src/lib/presentation.ts`(+`.test.ts`),
`src/widget/components/presentations.tsx`(+`.test.tsx`), `plan/in-progress/webchat-widget-presentation-followups.md`,
`spec/7-channel-web-chat/1-widget-app.md`. 이번 diff 는 직전 라운드(`review/code/2026/07/12/21_59_01`) 의
WARNING/INFO 를 반영한 결과물이며, 해당 라운드 산출물(SUMMARY/RESOLUTION/각 리뷰어 리포트)도 같은 changeset 으로 커밋됨.

## 발견사항

- **[WARNING]** 직전 라운드 testing WARNING("AI `render_carousel` top-level `truncation` → `truncated`/`totalCount`
  투영 경로 미검증")이 RESOLUTION.md 상 "전부 반영"으로 표시돼 있으나, 실제로는 **부분 반영**에 그친다 — `toTable` 대비
  여전히 비대칭인 커버리지 갭이 남아 있다.
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:254-266`(`toCarousel — top-level truncation
    이 있어도 items 파싱은 그대로`, 이번 diff 가 `expect(c.truncated).toBe(true)`/`expect(c.totalCount).toBe(500)`
    2개 단언만 추가) vs 같은 파일의 `toTable` 전용 테스트군(`:232` 흡수, `:244` `rowsTruncated=false` 케이스, `:269`
    `truncation` 부재 시 payload 값 보존, `:279` payload/truncation 동일 키 충돌 시 top-level 우선 lock-in, `:290`
    `truncation` 이 null/문자열이면 no-op, `:298` 미등록 키 비흡수, `:311` `rowsTotalCount` 투영) — 7건.
  - 위치(컴포넌트): `codebase/channel-web-chat/src/widget/components/presentations.test.tsx` `"복원 thread
    presentation (PresentationPayload) 렌더"` describe 블록(391-483행) — `payloadOf("table", ..., {rowsTruncated,
    rowsTotalCount})` 를 사용하는 컴포넌트 테스트가 3건(441/458/474행) 있으나, 이번 diff 가 이 describe 블록에 추가한
    테스트는 **0건**이다. 이번 diff 가 새로 넣은 carousel 배너 테스트 2건(`presentations.test.tsx` 신규 diff 636-661행)은
    모두 `{ output: {...} }` envelope 를 직접 주입하는 `"PresentationBlock — 종류별 렌더"` describe 블록에만 있다.
  - 상세: 직전 라운드 testing 리포트의 제안은 3가지였다 — (1) 기존 top-level truncation 유닛 테스트에 truncated/totalCount
    단언 추가, (2) `toTable` 의 우선순위 lock-in·null/문자열 no-op 등을 carousel 버전으로 최소 1~2건 추가, (3)
    `presentations.test.tsx` 복원 thread describe 블록에 `payloadOf("carousel", ..., {itemsTruncated, itemsTotalCount})`
    컴포넌트 테스트 1건 추가. RESOLUTION.md 는 (1)만 반영하고 W1 을 "전부 반영"으로 닫았다. (2)/(3)은 미반영 상태다.
    `asEnvelope`/`truncationMeta` 가 `toTable`/`toCarousel` 공유 코드라 즉각적인 실제 버그 가능성은 낮지만(공유 로직
    자체는 `toTable` 테스트가 이미 방어), 이번 spec 개정(`1-widget-app.md`)이 "table·carousel 대칭 — table 은 `rows*`,
    carousel 은 `items*` cap 키를 소비"라고 **명시적으로** 대칭 계약을 선언한 만큼, 그 계약 전체(우선순위 lock-in·no-op·
    AI 경로 실제 렌더링까지)를 테스트로 고정하지 못한 상태로 남아 있다. 특히 컴포넌트 레벨(3)은 "AI `render_carousel` 이
    실제로 위젯에서 잘림 배너를 렌더한다"는 사용자 관찰 가능한 계약을 검증하는 유일한 테스트인데, 이 경로 자체가
    전무하다 — 향후 `CarouselView`/`classifyPresentation`/`asEnvelope` 리팩터가 AI 경로만 깨뜨려도 어떤 테스트도
    실패하지 않는다.
  - 제안: `toCarousel` 에 `toTable` 과 대칭인 우선순위 lock-in(`payload.itemsTruncated=true` + `truncation.itemsTruncated=false`
    → false)·null/문자열 `truncation` no-op·미등록 키 비흡수 테스트를 최소 1~2건 추가. `presentations.test.tsx`
    복원 thread describe 블록에 `payloadOf("carousel", {...}, { itemsTruncated: true, itemsTotalCount: N })` 컴포넌트
    테스트 1건을 추가해 AI 경로 렌더까지 실측 검증한다. RESOLUTION 문서의 "전부 반영" 표현도 실제 반영 범위에 맞게
    정정 권장.

- **[INFO]** (긍정) `asTotalCount` 헬퍼 추출로 `toCarousel`/`toTable` 신뢰-값 판정 로직 중복이 해소되고, 두 함수가
  같은 함수를 호출하므로 향후 규칙 변경 시 drift 위험이 구조적으로 줄었다.
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:255-257`(`asTotalCount`), `toCarousel`(535행)/`toTable`(561행)
    호출부.
  - 상세: 직전 라운드 maintainability WARNING("검증 로직 인라인 복제")과 testing 리포트가 암묵적으로 우려한 drift
    위험이 실제로 해소됨 — 테스트 관점에서도 "한 곳만 고치면 두 경로 모두 갱신"되므로 회귀 방지 효과가 있다.

- **[INFO]** (긍정) 신뢰 못 할 `itemsTotalCount` 이형 테스트가 `it.each([NaN, -1, Infinity, 12.5, "5"])` 로
  파라미터화돼 `toTable` 의 대응 테스트(531행대, 동일 패턴)와 스타일이 통일됨 — 케이스별 실패 진단이 명확해졌고
  직전 라운드 INFO(관심사 혼합·for 루프 스타일 불일치) 2건 모두 실질적으로 해소.
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:70-79`.
  - 상세: `12.5`(소수) 케이스가 추가된 것은 `asTotalCount` 에 `Number.isInteger` 가드가 새로 들어간 것(spec §R8 "정수"
    요구사항과의 정합, requirement INFO1 대응)의 회귀 가드로도 기능한다 — 향후 누군가 `Number.isInteger` 를
    `Number.isFinite` 로 되돌리는 실수를 하면 이 케이스가 즉시 실패한다. 적절한 엣지 케이스 보강.

- **[INFO]** (긍정) 0 경계값(`itemsTotalCount: 0`) 전용 테스트 추가로 falsy-값 함정(`totalCount` 판정을
  `typeof === "number"` 로 하는지, `!totalCount` 같은 falsy 체크로 하는지)이 명시적으로 고정됨.
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:59-64`.
  - 상세: 렌더 측(`presentations.tsx` `CarouselView`) 도 `typeof totalCount === "number"` 분기라 0 이 폴백 문구로
    새지 않지만, 이 정확한 조합(변환 함수의 0 처리)을 유닛 테스트로 고정한 것은 직전 라운드 INFO 요청에 정확히 부합.
    다만 컴포넌트 레벨에서 `totalCount: 0` 이 실제로 "총 0개 중…" 배너로 렌더되는지(0 이 falsy 라 배너 자체가
    숨겨지지 않는지)는 여전히 컴포넌트 테스트로 검증되지 않는다 — 유닛 레벨만 커버. 리스크는 낮음(렌더 코드가
    `typeof` 가드를 이미 씀)이나 완전한 대칭을 원한다면 컴포넌트 테스트 1건도 고려 가능.

- **[정보/확인]** 회귀 안전성 — 실행 확인 완료.
  - 상세: `npx vitest run src/lib/presentation.test.ts src/widget/components/presentations.test.tsx
    src/lib/i18n/catalog.test.ts` 직접 실행 결과 3개 파일 92 테스트 전부 통과. `CarouselData` 에 `truncated`/`totalCount`
    가 non-optional/optional 로 새로 추가돼도 기존 테스트가 `toEqual` 전체비교가 아닌 개별 프로퍼티 단언(`c.layout`,
    `c.items` 등)만 쓰므로 깨지지 않는다 — 직전 라운드 확인 그대로 유효.

- **[정보/확인]** Mock 적절성·테스트 격리.
  - 상세: `toCarousel`/`toTable` 등 순수 함수는 mock 없이 직접 입력→출력 검증(적절). 컴포넌트 테스트는 `onButton`
    콜백만 `vi.fn()` 으로 스텁하고 실제 DOM 렌더(`@testing-library/react`)로 검증 — 과도한 mock 없이 실동작에
    근접한 검증. `"carousel — 잘림 배너 무개수 폴백 + 비잘림이면 배너 없음"` 테스트는 동일 텍스트 쿼리 충돌을 피하려
    `unmount()` 후 재렌더하는 방식으로 격리를 명시적으로 챙김 — 좋은 습관. 테스트 간 공유 mutable 상태 없음(각
    `it` 이 독립적으로 payload 리터럴 구성).

- **[정보/확인]** i18n 카탈로그 신규 키(`carousel.truncatedWithCount`/`carousel.truncated`)는 `catalog.test.ts`
  의 동적 키-순회 parity 가드(ko/en 키 집합 동일성·빈 문자열 금지·`{{placeholder}}` parity·deep-freeze)로 전용
  테스트 없이 자동 커버됨 — 직전 라운드 확인 그대로 유효, 별도 조치 불요.

## 요약

이번 라운드는 직전 `/ai-review` 의 WARNING(테스트 커버리지 갭)·INFO(0 경계·it.each 스타일·헬퍼 추출) 대부분을
성실히 반영해 `toCarousel`/`CarouselView` 핵심 요구사항(총 개수 노출·무개수 폴백·신뢰 못 할 total 방어·0 경계)을
탄탄하게 커버하고, `asTotalCount` 공유 헬퍼 추출로 향후 drift 위험도 구조적으로 줄였다. 다만 RESOLUTION.md 가
"전부 반영"이라 표기한 직전 testing WARNING(AI `render_carousel` 의 top-level `truncation` 투영 경로 미검증)은
실제로는 유닛 테스트 단언 1건 확장에 그쳤고, `toTable` 이 가진 우선순위 lock-in·null/문자열 no-op 등 나머지 대칭
테스트군과 — 결정적으로 — 실제 렌더 경로를 검증하는 컴포넌트 테스트는 여전히 0건이다. 이번 spec 개정이 "table·carousel
대칭"을 명문화한 만큼, 그 계약이 완전히 테스트로 잠기지 않은 채 두 번째 라운드에서도 남아 있다는 점은 재차 지적할
가치가 있다. 실행(`vitest run`)으로 확인한 회귀 안전성, mock 적절성, 테스트 격리는 모두 양호하다.

## 위험도

MEDIUM
