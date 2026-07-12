# 요구사항(Requirement) 리뷰 — webchat carousel truncation banner (fresh, 21_59_01 RESOLUTION 반영 후)

## 발견사항

- **[WARNING]** `wc-carousel-truncated` 배너에 대응 CSS 규칙 없음 — table 배너와 시각적 비대칭
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView` (`<div className="wc-carousel-truncated">`, L165 부근) / `codebase/channel-web-chat/src/widget/styles.ts` (미변경)
  - 상세: 이번 diff·plan(`plan/in-progress/webchat-widget-presentation-followups.md`)·RESOLUTION(`review/code/2026/07/12/21_59_01/RESOLUTION.md`) 모두 "table 과 완전 대칭" 을 명시적으로 주장한다. 그러나 `TableView` 의 동일 배너에는 `.wc-table-truncated { font-size: 11px; color: #9ca3af; margin-top: 4px; }` 규칙이 `styles.ts` 에 존재하는 반면, 신규 `.wc-carousel-truncated` 는 어떤 규칙도 없다(`git diff origin/main -- codebase/channel-web-chat/src/widget/styles.ts` 결과 0줄 — 이번 changeset 이 `styles.ts` 를 전혀 건드리지 않음, `grep -n "wc-carousel" src/widget/styles.ts` 로 `.wc-carousel-truncated` 부재 확인). 결과적으로 carousel 잘림 배너는 부모 `.wc-carousel` 의 기본 텍스트 스타일(더 큰 폰트·진한 색·여백 없음)을 그대로 물려받아, table 배너(작은 회색 캡션)와 시각적으로 어긋난다. 테스트(`presentations.test.tsx`)는 텍스트 콘텐츠만 단언하므로 이 갭을 잡지 못한다.
  - 제안: `styles.ts` 에 `.wc-carousel-truncated { font-size: 11px; color: #9ca3af; margin-top: 4px; }` (또는 `.wc-table-truncated` 와 공유하는 선택자 `.wc-table-truncated, .wc-carousel-truncated { ... }`) 추가. 코드 fix — `project-planner` 개입 불요.

- **[INFO]** plan 문서의 완료 노트 테스트 카운트가 RESOLUTION 이후 최종 수치와 다름 (사소, 비차단)
  - 위치: `plan/in-progress/webchat-widget-presentation-followups.md` "완료(2026-07-12, PR webchat-carousel-truncation)" 노트 — "channel-web-chat vitest(344, 신규 포함)"
  - 상세: 실측(`npx vitest run` 전체) 결과 현재 350 tests pass — `review/code/2026/07/12/21_59_01/RESOLUTION.md` 의 "350 passed (기존 344 + 신규 6, isInteger tighten 무회귀)" 이 최종 정확한 수치다. plan 완료 노트는 RESOLUTION 이전에 작성된 "344" 를 그대로 남겨 두 문서 간 숫자가 어긋난다. 기능적 영향 없음.
  - 제안: plan 완료 노트의 "344" 를 "350(RESOLUTION 반영 후)" 로 갱신하거나 RESOLUTION.md 링크로 대체.

## 요구사항 충족 검증 요약

- **기능 완전성**: `CarouselData.truncated`(필수 boolean)·`totalCount?`(optional number) 필드, `toCarousel` 의 `output.itemsTruncated`/`itemsTotalCount` 투영, `CarouselView` 의 조건부 배너 렌더가 모두 구현됨 — plan 의 두 미구현 항목(총 개수 노출·카루셀 잘림 배너)이 `toTable`/`TableView` 와 완전히 대칭 패턴으로 해소됨. 단, CSS 스타일링 대칭은 누락(WARNING 위 참조).
- **엣지 케이스**: `itemsTotalCount: 0`(경계, 유효) / NaN·-1·Infinity·12.5·"5"(모두 `undefined` 강등) / 부재(`undefined`) / 비잘림 기본값(`truncated:false, totalCount:undefined`) 모두 `it.each` 로 테스트됨. `items.length===0` 이면 `CarouselView` 가 조기 `null` 반환(배너 포함 전체 미노출) — `TableView` 의 `!columns.length && !rows.length` 조기반환과 대칭되는 기존 패턴, 신규 회귀 아님.
- **TODO/FIXME**: 변경 5개 코드 파일 전수 grep 결과 TODO/FIXME/HACK/XXX 없음.
- **의도와 구현 간 괴리**: 주석("§2/R8 — 흡수된 output.itemsTruncated/itemsTotalCount 를 투영... asTotalCount 로 toTable 과 대칭")과 실제 구현이 정확히 일치. 단 plan/RESOLUTION 이 주장하는 "완전 대칭"은 CSS 를 포함하지 않아 그 범위에서는 실제 구현이 문서 주장보다 좁다(위 WARNING).
- **에러 시나리오**: 백엔드가 `itemsTruncated`/`itemsTotalCount` 미전송 시 `truncated=false`/`totalCount=undefined` 로 안전 폴백. 신뢰 못 할 total(NaN/Infinity/음수/소수/문자열)은 전부 `undefined` 로 강등되어 "총 NaN개…" 유출 없음(테스트로 커버, `Number.isInteger` 포함 tighten 확인).
- **데이터 유효성**: 공유 헬퍼 `asTotalCount(v): number | undefined` — `typeof v === "number" && Number.isInteger(v) && v >= 0` — spec §R8 "유한한 비음수 정수" 문구와 정확히 일치(이전 라운드 INFO 로 지적된 `Number.isFinite`→`Number.isInteger` 미비는 이번 changeset 에서 `toCarousel`/`toTable` 양쪽 동반 tighten 으로 이미 해소됨, `presentation.ts` 최종본 확인).
- **비즈니스 로직**: `truncated=true` + 총 개수 있음 → `carousel.truncatedWithCount`("총 {{count}}개 중 일부만 표시돼요."), 총 개수 없음 → `carousel.truncated`("일부만 표시돼요.") 폴백, `truncated=false` → 배너 미노출. spec §R8/§4 문구와 정확히 일치(ko/en 모두).
- **반환값**: `toCarousel` 은 모든 코드 경로에서 `CarouselData` 전체 필드(`layout, items, buttons, truncated, totalCount`)를 반환 — 누락 경로 없음.
- **spec fidelity (line-level)**:
  - `spec/7-channel-web-chat/1-widget-app.md` §R8(L228-234) — "table·carousel 둘 다 대칭으로 소비한다: table 은 `output.{rowsTruncated|rowsTotalCount}`, carousel 은 `output.{itemsTruncated|itemsTotalCount}`... `totalCount` 는 유한한 비음수 정수만 채택" — 코드의 `asTotalCount`/`toCarousel`/`toTable` 과 필드명·검증 규칙 모두 정확히 일치.
  - §4(L146-148 부근) — "table·carousel 잘림 배너("총 N개 중 일부만 표시돼요."·table 무개수 "일부 행만 표시돼요."·carousel 무개수 "일부만 표시돼요.")" — `catalog.ts` ko/en 신규 키(`carousel.truncatedWithCount`/`carousel.truncated`) 문구와 정확히 일치.
  - §2 표(L45 부근) — "(table·carousel 대칭 — table 은 rows*, carousel 은 items* cap 키를 소비해 각각 잘림 배너를 렌더)" — 이번 diff 이전 서술("carousel 은 잘림 배너 자체가 미구현")을 정확히 대체.
  - `catalog.test.ts` 의 ko/en parity·placeholder 가드는 `Object.keys` 제네릭 비교라 신규 키 추가만으로 자동 커버(별도 테스트 갱신 불요) — 확인됨.
  - CSS 스타일링(§R8/§4 어디에도 CSS 명세는 없음 — spec 은 문구·필드 계약만 규정) 은 spec 침묵 영역이라 spec-fidelity 위반은 아니지만, 같은 changeset 의 plan/RESOLUTION 문서가 자체적으로 "table 대칭 완료" 를 주장하는 것과는 괴리(위 WARNING).
- **검증 재실행**: `npx vitest run`(channel-web-chat 전체) 350 passed / `npx tsc --noEmit` clean — RESOLUTION.md 의 검증 수치와 일치, 회귀 없음.

## 요약

이번 diff 는 `plan/in-progress/webchat-widget-presentation-followups.md` 의 두 미구현 항목(카루셀 잘림 배너 신설 + 총 개수 노출)을 `toTable`/`TableView` 패턴과 로직·문구·i18n·테스트 수준에서 대칭으로 완성했고, 직전 라운드(`review/code/2026/07/12/21_59_01`)에서 지적된 WARNING 2건(top-level truncation 투영 미검증·`asTotalCount` 헬퍼 미추출)과 INFO(정수 가드 미비)까지 모두 반영되어 spec §R8/§4/§2 문구와 line-level 로 정확히 일치한다(재실행 검증: vitest 350 passed, tsc clean). 새로 발견한 갭은 하나로, `styles.ts` 가 이번 changeset 에서 전혀 갱신되지 않아 신규 `wc-carousel-truncated` 클래스에 대응 CSS 규칙이 없다는 점이다 — 기능(텍스트 노출)은 정상 동작하지만 plan/RESOLUTION 문서가 명시적으로 주장하는 "table 완전 대칭" 은 시각적 스타일 측면에서 미완성이다. CRITICAL 은 없다.

## 위험도

LOW
