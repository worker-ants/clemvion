---
worktree: webchat-carousel-truncation-6b9553
started: 2026-07-11
owner: developer
---

# 웹채팅 위젯 presentation 후속 (truncation 표면 확장)

> 출처: PR #901 (`plan/complete/widget-presentation-restore.md` §6) 의 `/ai-review` 이관 항목.
> #901 이 `asEnvelope` 에서 `PresentationPayload.truncation` 을 흡수해 **table 잘림 배너**를 살렸으나,
> 흡수한 4개 cap 키 중 실제 소비되는 것은 `rowsTruncated` 뿐이다. 나머지 3개는 아직 소비처가 없다.

## 미구현 항목

- [x] **위젯 truncation 배너에 총 개수 노출** (ai-review 23_04_23 requirement #3)
      — **table 부분 해소**(planner 결정 spec §2/R8 + 구현, branch `claude/webchat-truncation-total-count`):
      `TableData.totalCount?` 추가·`toTable` 이 `output.rowsTotalCount` 투영·TableView 배너
      `총 N개 중 일부만 표시돼요.`. **carousel 잔여**는 아래 항목 2(배너 자체가 0→1 신설)와 병합/의존
      — carousel 배너가 생기면 `CarouselData.totalCount?` + `itemsTotalCount` 소비를 함께 처리한다.
      **완료(2026-07-12, PR webchat-carousel-truncation)**: carousel 도 `CarouselData.totalCount?` +
      `toCarousel` 이 `output.itemsTotalCount` 투영(finite-guard toTable 대칭)·`CarouselView` 배너로 총 개수 노출.

- [x] **카루셀 잘림 배너 미구현** (ai-review 23_04_23 testing #12)
      `asEnvelope` 는 `itemsTruncated`/`itemsTotalCount` 를 `output` 으로 흡수하지만 `CarouselData` 에
      `truncated` 필드가 없어 **소비처가 없는 죽은 필드**다(`presentation.ts` `toCarousel`).
      table 과 대칭이 되려면 `CarouselData.truncated` + `CarouselView` 배너 + 렌더 테스트가 필요하다.
      1MB cap 의 carousel tail-truncate 는 백엔드에 실재한다(`render-tool-provider.ts` `applyOneMbCap`).
      **완료(2026-07-12, PR webchat-carousel-truncation)**: `CarouselData.truncated`/`totalCount` 추가·
      `toCarousel` 이 `output.itemsTruncated`/`itemsTotalCount` 투영·`CarouselView` 배너(`wc-carousel-truncated`,
      `carousel.truncatedWithCount`/`carousel.truncated` ko/en i18n)·변환/렌더 테스트. spec §2/§4/R8 계약 정의.
      channel-web-chat vitest(350, 신규 포함)·typecheck·build·catalog parity·e2e-full(playwright 46) green. ai-review 2R 반영(CHANGELOG·CSS·복원 thread 컴포넌트 테스트·asTotalCount 정수 가드).

- [ ] (선택) 테스트 헬퍼 `payloadOf` 중복 (ai-review maintainability #8·#10)
      `conversation.test.ts` · `presentations.test.tsx` 2곳에 시그니처가 미묘하게 다른 채 중복 정의됨.
      리뷰어 권고대로 **3번째 소비처가 생기면** 공용 fixture 로 추출한다. 지금은 조치하지 않는다.

## 착수 조건

첫 두 항목은 위젯 렌더 표면을 넓히므로 `project-planner` 가 `1-widget-app.md` §2 에 표시 계약을 먼저 정의해야
한다(총 개수 노출 여부 · 카루셀 배너 문구). 그 결정 없이 developer 가 임의로 UI 문구를 만들면 메인 FE 와
비대칭이 굳는다.

> **i18n 경유 (2026-07-12 위젯 chrome i18n 활성 이후):** 카루셀 배너 등 신설 chrome 문구는 하드코딩하지 않고 위젯 로컬
> catalog(`codebase/channel-web-chat/src/lib/i18n/catalog.ts`)에 **ko/en 키를 추가**하고 `t()` 로 렌더한다(table 배너
> `table.truncatedWithCount`/`table.truncated` 선례, SoT [1-widget-app §4](../../spec/7-channel-web-chat/1-widget-app.md)).
> parity 가드(`catalog.test.ts`) 통과 필수.

## Rationale

**R1 — #901 에서 분리한 이유.** #901 의 스코프는 "`truncation` 유실이라는 **버그** 수정" 이었다. 총 개수 노출과
카루셀 배너는 **없던 UI 를 새로 만드는 표면 확장**이라 spec 결정이 선행돼야 하고, 버그 수정 PR 에 섞으면 회귀
범위와 신규 기능 범위가 뒤섞인다. ai-review 도 두 건 모두 "이 diff 가 만든 회귀 아님 / 스코프 밖" 으로 판정했다.

**R2 — 흡수는 유지한다(죽은 필드여도).** `itemsTruncated` 등이 현재 소비되지 않는다고 해서 `asEnvelope` 의 4-키
화이트리스트에서 빼지 않는다. Presentation 공통 §10.4 가 네 키를 한 묶음의 cap 메타로 규정하므로, 소비처가
생길 때 흡수 계층을 다시 건드리지 않도록 계약을 온전히 유지하는 편이 낫다.
