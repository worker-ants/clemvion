# 아키텍처(Architecture) Review

리뷰 대상 핵심 코드: `codebase/channel-web-chat/src/lib/presentation.ts`,
`codebase/channel-web-chat/src/widget/components/presentations.tsx` (+ 대응 테스트 2개).
나머지 파일(`plan/**`, `review/consistency/**`, `spec/**`)은 문서/산출물이라 아키텍처 관점 대상에서 제외.

## 발견사항

- **[INFO]** table/carousel 간 truncation 메타 소비 비대칭 — 향후 패턴 중복 위험
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` (`truncationMeta`/`TRUNCATION_KEYS`, `toTable`, `toCarousel`)
  - 상세: `TRUNCATION_KEYS`(L650-655)는 `rowsTotalCount`/`itemsTotalCount` 를 포함해 4개 키 전부를 이미 `asEnvelope()` 단계에서 `output` 으로 흡수한다. 이번 변경은 `toTable()`(L749-771)에만 `totalCount?: number` 투영 로직을 추가했고 `toCarousel()`(L727-743)/`CarouselData` 는 그대로다. `itemsTotalCount` 는 여전히 `output` 까지는 도달하지만 어떤 컨버터도 그 값을 타입화된 필드로 노출하지 않는 "dead field" 상태가 table 케이스와 동일한 형태로 carousel 쪽에 남는다. `plan/in-progress/spec-draft-webchat-truncation-total-count.md` 의 "스코프 경계"가 이를 의도적 분리(carousel 잘림 배너 자체 미구현)로 명시하고 있어 현재는 결함이 아니지만, `TableData`/`CarouselData` 가 각각 독립적으로 `truncated`/`totalCount` 필드 쌍을 갖는 구조라 후속 PR 이 carousel 잘림 배너를 추가할 때 동일한 "type guard + 필드 추가 + 컴포넌트 조건부 렌더" 패턴을 그대로 복붙할 공산이 크다.
  - 제안: 지금 당장 리팩터할 필요는 없음(YAGNI). 다만 carousel 잘림 배너 구현 착수 시 `{ truncated: boolean; totalCount?: number }` 형태의 공유 타입(예: `TruncationInfo`)을 `TableData`/`CarouselData` 가 함께 참조하도록 추출하는 편이 두 컨버터 간 필드 이름/의미 drift(예: 한쪽만 라벨이 달라지는 사고)를 막기 좋다. `TRUNCATION_KEYS` allowlist 자체는 두 종류 모두에 이미 대칭적으로 대응하므로 컨버터 레벨만 후속에서 맞추면 됨.

- **[INFO]** 배너 문구 포맷 로직이 뷰 컴포넌트에 인라인 — locale 확장 시 재배치 필요
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx:1587-1593` (`TableView`)
  - 상세: `totalCount` 유무에 따른 두 문구 분기(`총 {N}개 중 일부만 표시돼요.` / `일부 행만 표시돼요.`)가 JSX 내부에 리터럴로 박혀 있다. `presentation.ts`(데이터 정규화 레이어)와 `presentations.tsx`(뷰 레이어)의 책임 분리 자체는 이번 diff 에서 잘 유지됐고(데이터 파싱은 전부 `toTable`이 담당, 컴포넌트는 순수 렌더만), 이 지점은 그 경계 위반이 아니라 "표시 문자열 조합"이라는 별도 관심사가 뷰 레이어에 얹혀 있다는 확장성 관점의 관찰이다. spec(`spec/7-channel-web-chat/2-sdk.md §4`)에 이미 `BootConfig.locale: 'ko'|'en'` 필드가 존재하므로, 향후 다국어 지원 시 이런 카운트 포맷 문자열들이 여러 컴포넌트에 흩어져 있으면 일괄 교체가 어려워진다. (i18n 하드코딩/문체 자체는 convention_compliance checker 가 이미 별도 WARNING 으로 지적했으므로 여기서는 아키텍처 관점의 "포맷 로직 위치"만 언급.)
  - 제안: 즉시 조치 불요. 위젯이 실제 다국어를 지원하게 되는 시점에 문구 포맷 함수(예: `formatTruncationBanner(totalCount?: number): string`)를 `lib/` 로 추출해 재사용 가능하게 하는 정도로 충분 — 지금 단일 사용처에 대해 조기 추상화할 필요는 없음.

- **[INFO]** 기존 확립된 어댑터 패턴을 정확히 따름 (긍정 관찰)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:749-771`
  - 상세: `toTable()` 의 `totalCount` 투영은 기존 `truncated: output.rowsTruncated === true` 와 동일한 위치·동일한 타입가드 스타일(`typeof output.rowsTotalCount === "number" ? ... : undefined`)로 추가돼, 파일 전체가 따르는 "asEnvelope 로 두 wire shape 을 통일 → 타입가드로 방어적 파싱" 패턴(Adapter/Facade)과 완전히 일관된다. `TRUNCATION_KEYS` allowlist(임의 키 spread 금지) chokepoint 를 그대로 재사용해 새 필드를 흘려보낸 것도 기존 아키텍처 결정(주석 L648-649 "통째로 spread 하면 장래 truncation shape 확장이 payload 의 동명 렌더 필드를 조용히 덮어쓸 수 있다")을 존중한 확장이다. 순환 의존성, 레이어 경계 침범, God object화 등 구조적 리스크는 관찰되지 않는다.

## 요약

이번 변경은 `TableData` 인터페이스에 옵셔널 필드(`totalCount?: number`) 하나를 추가하고 이를 기존 `asEnvelope`/`truncationMeta` 흡수 체인의 확립된 컨버터 패턴(defensive type-guard 투영)에 정확히 맞춰 `toTable()`에 투영, `TableView` 컴포넌트가 소비하도록 배선한 순수 additive 변경이다. 데이터 정규화(`lib/presentation.ts`)와 렌더(`widget/components/presentations.tsx`) 레이어 책임 분리, SOLID(특히 OCP — 기존 컨슈머에 영향 없이 옵셔널 필드 확장) 모두 위반 없이 유지됐고 순환 의존성·안티패턴도 없다. 유일하게 짚을 만한 지점은 table 에만 적용되고 carousel 은 (계획적으로) 미적용 상태로 남아 동일 패턴이 후속 PR 에서 반복될 잠재적 여지, 그리고 문구 포맷 로직이 뷰 컴포넌트에 인라인돼 있어 향후 locale 확장 시 재배치가 필요할 수 있다는 점인데 둘 다 현재 스코프에서는 정당한 설계이며 조기 추상화가 오히려 불필요한 복잡성(YAGNI 위반)을 유발할 수 있어 INFO 수준으로만 기록한다.

## 위험도
NONE
