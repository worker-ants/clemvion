# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** table/carousel 잘림 배너 JSX 블록이 2번째로 동일 패턴 반복(3번째 소비처 등장 시 추출 후보)
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView`(신규 블록, `wc-carousel-truncated`) / `TableView`(기존 블록, `wc-table-truncated`)
  - 상세: `{truncated && (<div className="wc-X-truncated">{typeof totalCount === "number" ? t("X.truncatedWithCount", {count: totalCount}) : t("X.truncated")}</div>)}` 형태가 클래스명·i18n 키 접두사만 다르고 그대로 반복된다. 이 프로젝트는 동일 저장소 내 테스트 헬퍼 `payloadOf` 중복 건에서 이미 "3번째 소비처가 생기면 공용화, 2곳까지는 그대로 둔다"는 rule-of-three 정책을 채택한 바 있고(`plan/in-progress/webchat-widget-presentation-followups.md`), 직전 리뷰 라운드(`review/code/2026/07/12/21_59_01/maintainability.md`)에서도 같은 판단으로 조치 불요 처리됐다. 현재 diff 에서도 그 상태가 그대로 유지되고 있어 재확인 차원의 INFO로만 남긴다.
  - 제안: 조치 불필요. chart/template 등 3번째 잘림 배너가 생기면 공용 `<TruncationBanner truncated totalCount kind t>` 컴포넌트로 추출 검토.

- **[INFO]** ko 로케일에서 `carousel.truncated` 만 도메인 명사(개수 대상)를 생략 — table/carousel 간 문구 패턴 비대칭
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts` ko `table.truncated`("일부 행만 표시돼요.") vs `carousel.truncated`("일부만 표시돼요.")
  - 상세: en 로케일은 `table.truncated`("Showing some **rows** only.")와 `carousel.truncated`("Showing some **items** only.") 양쪽 모두 도메인 명사를 포함해 대칭을 이루는 반면, ko 로케일은 `table.truncated`만 "행"을 명시하고 `carousel.truncated`는 명사 없이 "일부만"으로 축약되어 있다. 기능상 문제는 없고(사용자에게 자연스러운 한국어 표현일 수 있음) 오탈자·버그도 아니지만, 같은 파일 내 동일 목적의 두 키가 ko/en 간 패턴 일관성이 어긋나는 점은 리뷰어가 다음에 유사 키를 추가할 때 어느 쪽을 관례로 따라야 할지 혼동을 줄 수 있다.
  - 제안: 조치 필수는 아님. 필요 시 `"carousel.truncated": "일부 항목만 표시돼요."` 로 맞춰 en 과 동일하게 도메인 명사를 포함시키는 안을 검토(문구 결정이므로 사용자/기획 확인 권장).

- **[INFO]** 직전 리뷰 라운드(WARNING)에서 지적된 `asTotalCount` 인라인 중복은 이번 diff 에서 이미 해소됨 — 회귀 없음 확인
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` (신규 `asTotalCount` 헬퍼, `toCarousel`/`toTable` 공유)
  - 상세: `toCarousel`/`toTable` 이 각자 `rawTotal`/`typeof ... Number.isFinite ...` 블록을 인라인 복제하던 기존 WARNING이, 파일 상단 `as*` 정규화 헬퍼군(`asArray`/`asRecord`/`asButtons`) 바로 아래에 `asTotalCount(v): number | undefined`로 추출되어 양쪽에서 재사용되는 형태로 반영됐다. 동시에 검증 규칙에 `Number.isInteger`가 추가되어 spec §R8("비음수 정수") 문구와도 코드가 합치됐다(직전 라운드 INFO1도 함께 해소). 신규 테스트(`it.each([NaN, -1, Infinity, 12.5, "5"])`)도 `toTable` 기존 스타일과 통일되어 파일 내 일관성이 개선됐다. 새로운 결함 아님 — 개선 확인용 기록.
  - 제안: 없음(유지).

## 요약

이번 diff 는 기존 `toTable`/`TableView` 잘림 배너를 `toCarousel`/`CarouselView` 로 대칭 확장한 작은 변경으로, 네이밍(`truncated`/`totalCount`), 주석 스타일, i18n catalog 키 구성, `as*` 헬퍼 관례(`asTotalCount` 공유 추출) 모두 기존 코드베이스 패턴을 충실히 따른다. 직전 리뷰 라운드에서 지적된 검증 로직 인라인 복제(WARNING)와 테스트 스타일 불일치(INFO)는 이번 diff에서 이미 해소되어 회귀 없이 반영된 것을 확인했다. 남은 사항은 배너 JSX 2곳 중복(3번째 소비처 발생 시 추출 — 팀이 이미 rule-of-three로 결정)과 ko 로케일에서만 나타나는 `table.truncated`/`carousel.truncated` 간 명사 포함 여부의 사소한 문구 비대칭 정도로, 모두 차단 사유가 아닌 참고 수준이다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 새로 도입된 문제는 없다.

## 위험도

LOW
