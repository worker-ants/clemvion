# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `CarouselData` 인터페이스에 non-optional 필드 `truncated: boolean` 추가
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` (interface `CarouselData`, `truncated`/`totalCount?`)
  - 상세: 공개(export) 인터페이스에 optional 이 아닌 `truncated: boolean` 을 추가했다. 만약 이 타입을 직접 리터럴로 구성하는 외부 consumer 가 있었다면 컴파일 타임에 깨진다. 리포지토리 내 grep 결과 `CarouselData` 를 구성하는 곳은 `toCarousel()` 단 하나뿐이고, 이 함수는 diff 에서 함께 갱신되어 즉시 위험은 없다(`toTable`/`TableData` 의 기존 선례와 동일 패턴). `CarouselView` 도 같은 diff 에서 `truncated`/`totalCount` 를 구조분해하도록 갱신됨.
  - 제안: 조치 불요(현재 유일한 production consumer 가 함께 갱신됨). 향후 이 타입을 참조하는 새 소비처가 생기면 동일하게 갱신 필요함을 인지.

- **[INFO]** `CarouselView` 렌더 출력에 신규 DOM 블록(`wc-carousel-truncated`) 추가 — 기존에 흡수만 되고 미소비이던 `itemsTruncated`/`itemsTotalCount`(dead field)가 이제 실제로 UI 에 반영됨
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView`
  - 상세: `asEnvelope`/`truncationMeta` 는 이전부터 `itemsTruncated`/`itemsTotalCount` 를 `output` 으로 흡수하고 있었으나 소비처가 없어 죽은 필드였다(plan 문서에 명시). 이번 변경으로 백엔드가 이미 이 필드를 실어 보내고 있던 기존 프로덕션 presentation 데이터가 있다면, 배포 즉시(코드만으로) 잘림 배너가 소급 노출되는 동작 변화가 생긴다. 이는 의도된 기능(§2/R8, plan `webchat-widget-presentation-followups.md`)이며 버그가 아니다 — 부작용이라기보다 계획된 표면 확장이지만, "다른 함수를 건드리지 않고 죽은 필드를 살린다"는 점에서 배포 시점에 UI 변화가 코드 diff 범위보다 넓게 나타날 수 있음을 리뷰 기록으로 남긴다.
  - 제안: 조치 불요 — 의도된 spec 반영. 배포 노트/QA 체크리스트에 "기존 잘림 carousel 응답에서 배너가 새로 보임"을 언급하면 좋음(선택).

- **[INFO]** i18n catalog(`catalog.ts`)에 신규 키 4개(`carousel.truncatedWithCount`/`carousel.truncated`, ko+en) 추가 — `deepFreeze` 로 module load 시 동결되는 기존 동작 범위 안에서의 순수 데이터 추가
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`
  - 상세: 전역 상태 변경이나 새 전역 변수 도입 없음. 기존 `WIDGET_STRINGS` 객체에 키를 추가한 것뿐이며 ko/en parity 를 유지함(`catalog.test.ts` 가드 대상). 부작용 없음.

## 요약
검토 대상 변경은 `CarouselData`/`toCarousel`/`CarouselView` 세 지점에 걸쳐 table 잘림 배너와 대칭되는 신규 필드(`truncated`, `totalCount`)를 추가하고, 이를 소비하는 렌더 블록과 i18n 키를 함께 추가한 응집된 diff다. `CarouselData` 인터페이스 변경은 non-optional 필드 추가라는 점에서 이론적으로는 호출자 영향(항목 5)이 있을 수 있으나, 저장소 내 유일한 생성 지점(`toCarousel`)과 유일한 소비 지점(`CarouselView`)이 모두 같은 diff 안에서 동기화되어 실질적 위험은 없다. 전역 변수·환경 변수·파일시스템·네트워크·이벤트 콜백 관련 부작용은 발견되지 않았다. 유일하게 기록해 둘 만한 지점은 "죽은 필드를 살리는" 성격의 변경이라, 이미 `itemsTruncated`를 보내고 있던 기존 백엔드 응답이 있다면 배포 후 UI가 코드 diff 범위 이상으로 즉시 달라져 보일 수 있다는 점이다(의도된 것으로 plan/spec에 문서화됨).

## 위험도
LOW
