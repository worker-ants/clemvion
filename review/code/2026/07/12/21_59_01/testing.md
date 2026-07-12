# 테스트(Testing) 리뷰 — webchat-carousel-truncation

대상: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`, `src/lib/presentation.ts`(+`.test.ts`),
`src/widget/components/presentations.tsx`(+`.test.tsx`), `plan/in-progress/webchat-widget-presentation-followups.md`,
`spec/7-channel-web-chat/1-widget-app.md`

## 발견사항

- **[WARNING]** AI `render_carousel` 의 top-level `truncation` → `truncated`/`totalCount` 투영 경로가 unit·component
  양쪽 다 검증되지 않음 (table 은 대칭적으로 촘촘히 커버됨)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` 기존 테스트 `"toCarousel — top-level truncation
    이 있어도 items 파싱은 그대로"`(447-456행) / `codebase/channel-web-chat/src/widget/components/presentations.test.tsx`
    `"복원 thread presentation (PresentationPayload) 렌더"` describe 블록(1467-1559행)
  - 상세: 이번 diff 가 새로 추가한 `toCarousel` truncated/totalCount 테스트 2건(176-194행)은 모두 `{ config, output }`
    envelope 의 `output.itemsTruncated`/`output.itemsTotalCount` 를 **직접** 넣어 검증한다. 그러나 `CarouselData` 에
    `truncated`/`totalCount` 필드가 실제로 소비되는 프로덕션 경로 중 하나는 AI `render_carousel` 의
    `PresentationPayload{ type, payload, truncation }` shape — 이 경우 `asEnvelope`/`truncationMeta` 가
    top-level `truncation.{itemsTruncated,itemsTotalCount}` 를 `output` 으로 흡수한 뒤 `toCarousel` 이 그걸 읽는다.
    이 정확한 경로를 테스트하는 기존 케이스(`"toCarousel — top-level truncation 이 있어도 items 파싱은 그대로"`)는
    **여전히 `items`/`layout` 만 단언**하고 `truncated`/`totalCount` 는 확인하지 않는다 — `CarouselData` 에 이 필드가
    생긴 지금, 정확히 그 테스트를 확장했어야 할 자리에서 놓쳤다. `toTable` 쪽은 이 동일 경로에 대해 4건의 전용 테스트
    (top-level `rowsTruncated` 흡수, `rowsTotalCount` 투영, payload-vs-top-level 우선순위 lock-in, `truncation`
    이 null/문자열일 때 no-op)를 갖고 있고 `presentations.test.tsx` 에도 "AI render_table 의 top-level
    truncation(+총 개수) → 총 개수 잘림 배너 노출" 컴포넌트 테스트가 있다. carousel 에는 이 중 어느 것도 대응 테스트가
    없다. 코드 주석이 명시적으로 "toTable 과 대칭"이라 서술하는 만큼, 테스트도 그 대칭을 유지해야 미래에 carousel 과
    table 의 흡수 로직이 (실수로) 갈라져도 잡아낼 수 있다. 현재는 공유 코드(`asEnvelope`/`truncationMeta`)라 실행
    동작은 사실상 정확할 가능성이 높지만, carousel 전용 리팩터가 이 결합을 깨도 carousel 테스트만으로는 절대
    검출되지 않는다.
  - 제안: (1) `presentation.test.ts` 의 기존 447-456행 테스트에 `expect(c.truncated).toBe(true)` /
    `expect(c.totalCount).toBe(500)` 단언 추가(또는 별도 신규 테스트로 분리), (2) `toTable` 의 우선순위 lock-in·
    non-object truncation no-op 테스트를 carousel 버전으로 최소 1~2건 추가, (3) `presentations.test.tsx` 의 복원
    thread describe 블록에 `payloadOf("carousel", {...}, { itemsTruncated: true, itemsTotalCount: N })` 컴포넌트
    테스트 1건 추가.

- **[INFO]** `totalCount === 0` 경계값 미검증
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` `toCarousel`/`toTable` 의
    `rawTotal >= 0` 가드, `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView`/`TableView`
    의 `typeof totalCount === "number"` 렌더 분기
  - 상세: `totalCount = 0` 은 가드를 통과하고(`0 >= 0`), 렌더 조건도 `typeof totalCount === "number"` 라 falsy 값
    함정 없이 정상 동작하는 것으로 보이나(0 이 아니라 `undefined` 여부로 분기), 이 정확한 경계값(0)을 명시적으로
    검증하는 테스트는 unit·component 어디에도 없다. 실제 백엔드가 `truncated=true`면서 `totalCount=0` 을 보낼
    가능성은 낮지만(잘렸다는 것은 최소 1개 이상 존재), 코드가 "유한한 비음수 정수" 라고 명시적으로 0 을 포함해
    서술한 이상 경계값 테스트로 그 계약을 고정해 두는 편이 안전하다.
  - 제안: `it.each` 목록에 `0` 을 유효값으로 추가하거나, `totalCount: 0` 을 별도 케이스로 1건 추가.

- **[INFO]** 신규 테스트 1건이 두 관심사(기본값 케이스 + 신뢰 못 할 total 케이스)를 한 `it` 에 묶음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` 183-194행
    `"toCarousel — 비잘림 기본값 + 신뢰 못 할 totalCount 는 undefined"`
  - 상세: 이름과 본문 모두 "비잘림 기본값"(truncated=false, totalCount=undefined)과 "신뢰 못 할 totalCount(4가지
    이형)" 두 축을 한 테스트에 섞고 있다. `toTable` 쪽의 대응 로직은 `it.each`(531-544행)로 파라미터화해 케이스별로
    분리되어 있어 실패 시 어떤 이형이 깨졌는지 더 명확히 드러난다. 기능적 결함은 아니지만 가독성·실패 진단
    편의성 면에서 `toTable` 패턴과 맞추는 편이 낫다.
  - 제안: `it.each([[Number.NaN, ...], [-1, ...], [Infinity, ...], ["5", ...]])` 형태로 분리하거나 최소한
    두 개의 `it` 으로 나눈다.

- **[정보/확인]** 기존 회귀 테스트는 신규 필드에 영향받지 않음(긍정 확인)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` 전체(예: 240행대 `toCarousel — dynamic
    output.items 우선` 등 기존 테스트들)
  - 상세: `CarouselData` 반환 객체에 `truncated`/`totalCount` 가 새로 추가돼도, 기존 테스트들은 전부 특정 프로퍼티만
    단언(`c.layout`, `c.items` 등)하고 객체 전체를 `toEqual` 로 비교하지 않으므로 깨지지 않는다. 회귀 관점에서
    안전하게 확장된 것으로 확인된다.

- **[정보/확인]** `catalog.ts` 신규 키(`carousel.truncatedWithCount`/`carousel.truncated`)는 기존 parity 가드로
  자동 커버됨
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.test.ts`
  - 상세: 이 테스트는 `Object.keys(WIDGET_STRINGS.ko/en)` 를 동적으로 순회하는 일반 가드(키 집합 동일성·빈 문자열
    금지·`{{placeholder}}` parity·deep-freeze)라 신규 키 2개(ko/en)가 추가돼도 **키별 전용 테스트 추가 없이** 자동으로
    parity·placeholder·freeze 검증이 적용된다. 별도 조치 불필요.

## 요약

이번 변경은 `toTable` 에서 이미 검증된 truncation 투영 로직을 `toCarousel` 에 대칭 이식하면서, 직접 `output.itemsTruncated`/
`output.itemsTotalCount` 를 넣는 unit 테스트와 렌더 배너를 확인하는 component 테스트를 새로 추가해 핵심 요구사항(총 개수
노출·비잘림/무개수 폴백·신뢰 못 할 total 방어)을 충실히 커버한다. 다만 AI `render_carousel` 의 `PresentationPayload.truncation`
(payload 바깥 top-level) 이 `asEnvelope`/`truncationMeta` 흡수를 거쳐 `truncated`/`totalCount` 로 정확히 투영되는지를
검증하는 테스트가 unit·component 레벨 모두에서 빠져 있다 — 같은 경로에 대해 `toTable` 은 4건 이상의 전용 테스트를 갖고
있어 대칭성이 깨진 지점이다. 현재 로직이 table 과 완전히 공유되므로 즉각적인 버그로 이어질 가능성은 낮지만, 코드 주석이
스스로 "toTable 과 대칭" 이라 명시한 계약을 테스트가 완전히 고정하지 못하는 상태다. 나머지(경계값 0, 테스트 관심사 분리)는
경미한 개선 여지이며, i18n 카탈로그 parity 가드는 신규 키를 자동 커버해 추가 조치가 불필요하다.

## 위험도

MEDIUM
