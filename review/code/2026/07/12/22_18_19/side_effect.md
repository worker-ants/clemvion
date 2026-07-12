# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `CarouselData` 인터페이스에 non-optional 필드 `truncated: boolean` 추가 (public 인터페이스 시그니처 변경)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — `export interface CarouselData` (`truncated: boolean`, `totalCount?: number`)
  - 상세: export 된 인터페이스에 optional 이 아닌 필드를 추가했다. 이 타입을 직접 리터럴로 구성하는 소비처가 있었다면 컴파일 타임에 깨진다. repo 내 `CarouselData` 생성 지점은 `toCarousel()` 단 하나, 소비 지점은 `CarouselView`(`presentations.tsx`) 단 하나뿐이며 둘 다 같은 diff 에서 동기화됐다(`toTable`/`TableData` 의 기존 선례와 동일 패턴). channel-web-chat 은 독립 export 번들이라 외부(메인 frontend) 가 이 타입을 import 할 수 없어 저장소 밖 영향도 없다.
  - 제안: 조치 불요. 향후 이 타입의 두 번째 소비처가 생기면 필드 동기화를 함께 확인할 것.

- **[INFO]** `toTable` 의 `totalCount` 검증 로직이 기존 `Number.isFinite` 기준에서 공유 헬퍼 `asTotalCount`(`Number.isInteger`) 기준으로 소급 강화됨 — 이미 배포된 함수의 동작 변화
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:122` (`asTotalCount`), `toTable` (§247 부근, 인라인 `rawTotal`/`totalCount` 블록 제거 후 `asTotalCount(output.rowsTotalCount)` 로 교체)
  - 상세: 이번 diff 의 본래 목적은 `toCarousel` 에 대칭 필드를 추가하는 것이지만, 그 과정에서 `toTable`(기존에 이미 프로덕션에 존재하던 함수)의 `totalCount` 판정도 함께 바뀌었다. 이전에는 `Number.isFinite(rawTotal) && rawTotal >= 0` 만 확인해 `12.5` 같은 소수도 유효한 `totalCount` 로 통과시켰으나, 신규 공유 헬퍼는 `Number.isInteger` 를 추가로 요구해 소수는 이제 `undefined` 로 떨어진다. RESOLUTION.md(INFO1)에 문서화된 의도된 tighten(spec §R8 "정수" 정합)이고 관련 회귀 테스트도 추가됐지만, `toTable` 은 이번 changeset 의 핵심 대상(carousel)이 아닌 **기존에 이미 소비되던 함수**이므로 "카루셀 대칭 추가" 라는 changeset 의 표면적 스코프보다 실제 동작 변경 범위가 한 단계 넓다는 점을 기록해 둔다. 백엔드가 `rowsTotalCount` 를 정수 이외로 보낼 가능성은 낮아(항상 카운트) 실질 위험은 낮다.
  - 제안: 조치 불요 — 의도된 tighten 이며 RESOLUTION 에 이미 근거가 남아 있음. PR 설명에 "table totalCount 판정도 함께 tighten 됨"을 한 줄 명시하면 리뷰 가시성이 좋아진다(선택).

- **[INFO]** dead-field 활성화로 인한 소급 UI 노출 — 배포 시점에 기존 백엔드 응답 데이터에 대해 코드 diff 범위보다 넓은 화면 변화 발생 가능
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView` (신규 `wc-carousel-truncated` 블록)
  - 상세: `asEnvelope`/`truncationMeta` 는 이전부터 `itemsTruncated`/`itemsTotalCount` 를 `output` 으로 흡수해 왔으나 소비처가 없어 죽은 필드였다(plan 문서에 명시된 기존 사실). 이번 변경으로 그 필드가 처음으로 소비되면서, 배포 시점에 이미 `itemsTruncated: true` 를 실어 보내고 있던 기존 AI carousel 응답(1MB cap 이 걸린 실제 응답)이 있다면 코드만으로 잘림 배너가 즉시 노출되는 동작 변화가 생긴다. 의도된 spec 반영(§2/R8)이며 버그는 아니다.
  - 제안: 조치 불요 — 배포 노트/QA 체크리스트에 "기존 잘림 carousel 응답에 배너가 새로 보임" 을 언급하면 좋음(선택, 이전 라운드에서도 동일 권고).

- **[INFO]** i18n catalog(`catalog.ts`)에 신규 키 4개(`carousel.truncatedWithCount`/`carousel.truncated`, ko+en) 추가 — 순수 데이터 추가, 부작용 없음
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts`
  - 상세: 전역 상태 변경이나 새 전역 변수 도입 없음. 기존 `WIDGET_STRINGS`(모듈 로드 시 `deepFreeze` 되는 상수) 객체에 리프 키만 추가했고 ko/en parity 유지(`catalog.test.ts` 가드 대상). `WidgetTranslationKey` 타입은 `keyof typeof WIDGET_STRINGS.ko` 파생이라 자동 확장되며 별도 시그니처 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/07/12/21_59_01/*` 하위 다수 신규 파일(RESOLUTION.md, SUMMARY.md, `_retry_state.json`, `meta.json`, 각 reviewer `.md`) — 파일시스템 신규 생성
  - 위치: `review/code/2026/07/12/21_59_01/`
  - 상세: 코드 자체의 부작용이 아니라 `/ai-review` 워크플로우 산출물이 diff 에 포함된 것 — 프로젝트 컨벤션상(`review/code/<타임스탬프>/`) 정상적인 이력 기록이며 커밋 대상이 맞다(CLAUDE.md 정보 저장 위치 표). 런타임 코드 경로에는 영향 없음.
  - 제안: 조치 불요.

## 요약

이번 changeset 은 carousel 잘림 배너를 table 과 대칭으로 신설하는 응집된 diff다. `CarouselData` 에 non-optional 필드를 추가하는 인터페이스 변경이 있지만 유일한 생성/소비 지점이 동일 diff 안에서 함께 갱신돼 실질 위험은 없다. 가장 주목할 지점은 두 가지다 — (1) 공유 헬퍼 추출 과정에서 이미 프로덕션에 존재하던 `toTable` 의 `totalCount` 판정 기준이 `isFinite`→`isInteger` 로 소급 강화됐다는 점(의도된 spec 정합이나 changeset 표면 스코프보다 넓은 동작 변화), (2) 흡수만 되고 죽어있던 `itemsTruncated`/`itemsTotalCount` 필드가 소비되기 시작하면서 배포 즉시 기존 응답 데이터에 대해 UI 가 소급 변화할 수 있다는 점(계획된 기능 확장). 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 관련 의도치 않은 부작용은 발견되지 않았다.

## 위험도
LOW
