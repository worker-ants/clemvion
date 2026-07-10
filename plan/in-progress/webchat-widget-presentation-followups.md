---
worktree: (unstarted)
started: 2026-07-11
owner: developer
---

# 웹채팅 위젯 presentation 후속 (truncation 표면 확장)

> 출처: PR #901 (`plan/complete/widget-presentation-restore.md` §6) 의 `/ai-review` 이관 항목.
> #901 이 `asEnvelope` 에서 `PresentationPayload.truncation` 을 흡수해 **table 잘림 배너**를 살렸으나,
> 흡수한 4개 cap 키 중 실제 소비되는 것은 `rowsTruncated` 뿐이다. 나머지 3개는 아직 소비처가 없다.

## 미구현 항목

- [ ] **위젯 truncation 배너에 총 개수 노출** (ai-review 23_04_23 requirement #3)
      메인 프런트엔드(`codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx:316`)
      는 `truncated · total {itemsTotalCount ?? rowsTotalCount}` 로 잘리기 전 총 개수를 함께 보여준다.
      위젯은 `TableData.truncated: boolean` 만 소비해 "일부 행만 표시됩니다." 고정 문구뿐이다.
      → `TableData`/`CarouselData` 에 `totalCount?: number` 추가 여부는 **표면 확장**이라 planner 결정 선행.
      현행 spec(`7-channel-web-chat/1-widget-app.md` §2)은 총 개수 표시를 강제하지 않는다 — 회귀 아님.

- [ ] **카루셀 잘림 배너 미구현** (ai-review 23_04_23 testing #12)
      `asEnvelope` 는 `itemsTruncated`/`itemsTotalCount` 를 `output` 으로 흡수하지만 `CarouselData` 에
      `truncated` 필드가 없어 **소비처가 없는 죽은 필드**다(`presentation.ts` `toCarousel`).
      table 과 대칭이 되려면 `CarouselData.truncated` + `CarouselView` 배너 + 렌더 테스트가 필요하다.
      1MB cap 의 carousel tail-truncate 는 백엔드에 실재한다(`render-tool-provider.ts` `applyOneMbCap`).

- [ ] (선택) 테스트 헬퍼 `payloadOf` 중복 (ai-review maintainability #8·#10)
      `conversation.test.ts` · `presentations.test.tsx` 2곳에 시그니처가 미묘하게 다른 채 중복 정의됨.
      리뷰어 권고대로 **3번째 소비처가 생기면** 공용 fixture 로 추출한다. 지금은 조치하지 않는다.

## 착수 조건

첫 두 항목은 위젯 렌더 표면을 넓히므로 `project-planner` 가 `1-widget-app.md` §2 에 표시 계약을 먼저 정의해야
한다(총 개수 노출 여부 · 카루셀 배너 문구). 그 결정 없이 developer 가 임의로 UI 문구를 만들면 메인 FE 와
비대칭이 굳는다.

## Rationale

**R1 — #901 에서 분리한 이유.** #901 의 스코프는 "`truncation` 유실이라는 **버그** 수정" 이었다. 총 개수 노출과
카루셀 배너는 **없던 UI 를 새로 만드는 표면 확장**이라 spec 결정이 선행돼야 하고, 버그 수정 PR 에 섞으면 회귀
범위와 신규 기능 범위가 뒤섞인다. ai-review 도 두 건 모두 "이 diff 가 만든 회귀 아님 / 스코프 밖" 으로 판정했다.

**R2 — 흡수는 유지한다(죽은 필드여도).** `itemsTruncated` 등이 현재 소비되지 않는다고 해서 `asEnvelope` 의 4-키
화이트리스트에서 빼지 않는다. Presentation 공통 §10.4 가 네 키를 한 묶음의 cap 메타로 규정하므로, 소비처가
생길 때 흡수 계층을 다시 건드리지 않도록 계약을 온전히 유지하는 편이 낫다.
