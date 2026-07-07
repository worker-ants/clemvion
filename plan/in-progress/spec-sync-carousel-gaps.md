---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# carousel — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/6-presentation/1-carousel.md

## 미구현 항목
- [ ] `layout` 별 렌더 변형 — spec §1/§4 는 `card` / `image` / `minimal` 레이아웃 재구성을 약속하나, 렌더러 `CarouselContent` (`codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`) 는 `config.layout` 을 미참조하고 항상 가로 스크롤 카드(`flex gap-2 overflow-x-auto`)로 렌더한다. `image` / `minimal` 변형 분기 미구현.

## 비고
- `layout` config 필드 자체는 schema 검증·echo 됨 (백엔드 정상). 미구현 surface 는 **프론트 렌더 변형**에 한정.
- §7 에러 메시지(영문화)·§5.1 meta 누락은 본 audit 에서 spec 본문 정정으로 처리 완료 (코드 변경 불필요).
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__6-presentation__1-carousel.md 참조.

## ⚠ 재분류 (2026-06-03 groom): decision-free 아님 → planner 결정 필요
- spec 은 `card` 레이아웃만 ASCII mockup 으로 정의하고 `image`/`minimal` 은 이름만 명시 — **두 변형의 실제 시각 디자인이 미정의**(image-dominant? text-only?). 단순 구현 불가, UX 결정 선행.
- 구현 위치(결정 후): `presentation-renderers.tsx` `CarouselContent`(:194) 상단에서 `(config?.layout as string) ?? 'card'` switch (ChartContent `chartType` switch :302-309 패턴). 테스트: `run-results/__tests__/presentation-renderers.test.tsx`.

## 결정 옵션 (2026-06-13)

**맥락**: `CarouselContent`(`presentation-renderers.tsx`:194)는 `config.layout` 을 전혀 읽지 않고 모든 모드를 `flex gap-2 overflow-x-auto` 가로 스크롤 카드(:229)로만 렌더한다. spec §1 config 표(:35)·§4 실행 로직(:144)·§5.1 출력 표(:179)는 `card`/`image`/`minimal` 세 값을 약속하지만 §2 설정 UI ASCII mockup(:55-94)은 `card` 한 가지 시각형만 그려 둔다 — `image`(이미지 지배형?)·`minimal`(텍스트 전용?)의 실제 시각 디자인이 spec 어디에도 정의돼 있지 않다. 따라서 단순 코드 분기 추가가 아니라 두 변형의 UX 형태를 무엇으로 확정할지가 선행 결정이며, 그 결정 없이는 구현 PR 의 spec 근거(Principle 7 config echo 대비 렌더)가 비게 된다.

### 옵션 A — spec 에 두 변형의 시각 디자인을 먼저 확정 후 구현
- 설명: `project-planner` 가 §2 에 `image`/`minimal` 용 ASCII mockup 과 §4 에 변형별 레이아웃 규칙(예: `image` = 이미지 풀블리드 + 제목 오버레이, `minimal` = 이미지 생략·제목/설명만)을 추가한 뒤, `developer` 가 그 spec 을 근거로 `CarouselContent` switch 를 구현한다.
- 장점:
  - 구현이 spec 근거를 100% 갖춰 spec-coverage audit·`/consistency-check` 가 깨끗하게 통과 (현 `partial` → `complete` 승격 명분 확보).
  - `card` 가 이미 ASCII mockup 으로 정의된 것과 같은 문서 일관성 — 세 변형이 동등하게 정의됨.
  - UX 의도가 코드 리뷰 이전에 합의돼 render 분기 구현이 단순 번역 작업이 된다.
- 단점:
  - planner → consistency-check → developer 2단계 핸드오프로 리드타임이 가장 길다.
  - 실제 화면을 보지 않은 채 ASCII 로 시각형을 확정 → 구현 단계에서 mockup 재조정 가능성 (재작성 비용).

### 옵션 B — 코드에서 합리적 기본 디자인을 정하고 spec 을 사후 정합
- 설명: `developer` 가 `image`/`minimal` 의 기본 시각형을 코드에서 먼저 구현(`image`=`h-20` 썸네일을 카드 전체 높이로 확대 + 텍스트 최소화, `minimal`=`<img>` 블록 제거 후 제목/설명만)하고, 직후 `project-planner` 가 §2/§4 를 구현 결과에 맞춰 정합한다.
- 장점:
  - 실제 렌더를 보며 디자인을 확정 → ASCII 추측보다 현실적, 재조정 루프 짧음.
  - 기존 `card` 마크업(:229-289)을 최소 변형해 빠르게 세 분기 확보 가능.
- 단점:
  - "spec 이 구현의 단일 진실" 원칙(CLAUDE.md) 역행 — 구현이 spec 을 선행하면 사후 정합 누락 시 또 다른 drift 발생.
  - `developer` 는 `spec/` read-only 이므로 결국 planner 핸드오프가 필요 → 단계 수가 A 와 크게 다르지 않으면서 순서만 뒤집힌 형태.
  - 사후 정합 전까지 spec-coverage 가 계속 갭으로 잡힌다.

### 옵션 C — `image`/`minimal` 을 spec 에서 제거하고 `card` 단일로 강등
- 설명: §1 config 표의 `layout` 타입을 `card` 단일로 축소(혹은 필드 자체 deprecate), §4·§5.1·각 §5.4/5.5 예시의 `layout` 언급을 정리하고 `carousel.schema.ts` 의 enum 도 좁힌다. 본 plan 의 미구현 항목은 "spec 약속 철회"로 종결.
- 장점:
  - 미정의 UX 결정을 회피 — 가장 빠른 종결, 렌더 코드 변경 0.
  - spec 과 코드가 즉시 일치 (현재 코드가 사실상 `card` 단일이므로).
- 단점:
  - 백엔드 schema·config echo·기존 `layout` 입력 UI(§2 의 `Layout: [card ▼]` dropdown)가 셋 중 하나를 전제로 설계돼 있다면 하위호환 파급 (`layout` 을 받던 기존 워크플로우 config). dropdown 자체를 제거해야 자기모순이 없어짐.
  - 제품 기능 축소 — 향후 `image`/`minimal` 재도입 시 Rationale 에 "한 번 기각" 이력이 남아 재논의 비용 발생.

**권장안**: **옵션 A**. 본 항목은 이미 2026-06-03 groom 에서 "decision-free 아님 → planner 결정 필요"로 재분류됐고(상단 ⚠ 섹션), spec 이 단일 진실인 본 프로젝트에서 UX 형태를 spec 에 먼저 확정하는 것이 drift 를 남기지 않는 정공법이다. dropdown·schema enum 이 이미 세 값을 노출 중이라 옵션 C 의 강등은 오히려 하위호환 정리 비용이 더 크다.

**트레이드오프**: 옵션 A 채택 시 (1) `project-planner` 가 §2 에 `image`/`minimal` ASCII mockup + §4 변형 규칙을 추가하는 spec write 가 필요하고, 그 직전 `consistency-check --spec`(0-common 레이아웃 규약·node-output convention 과의 정합) 의무 통과가 선행된다. (2) 이후 `developer` 가 `CarouselContent`(:194) 에 `chartType` switch(:309) 패턴의 `layout` switch 를 추가 — 기존 카드 마크업(:229-289)을 `card` 분기로 보존하고 `image`/`minimal` 분기를 신설, 착수 직전 `consistency-check --impl-prep` 통과. (3) `presentation-renderers.test.tsx` 에 세 layout 값별 렌더 분기 검증 케이스 추가. (4) 완료 후 `spec/4-nodes/6-presentation/1-carousel.md` frontmatter `status: partial` → `complete` 승격 및 §1/§4 의 "(Planned)" 단서 제거.

## 결정 기록 (2026-07-07, 사용자 확정) — 옵션 D: two-surface 분리

재조사에서 드러난 결정적 사실: `layout`(card/image/minimal)은 **이미 웹챗 위젯**(`codebase/channel-web-chat/src/widget/components/presentations.tsx` `CarouselView`)에서 완전히 구현·소비되고 있다 — `image` 는 이미지 지배(설명 생략), `minimal` 은 텍스트 전용(이미지 생략), `card` 는 이미지+제목+설명, 한 번에 한 슬라이드 + prev/next 내비. 즉 **인터랙티브 채널에서는 세 변형이 이미 살아있다**. 미구현 표면은 오직 **실행이력/run-results 디버그 프리뷰**(`presentation-renderers.tsx` `CarouselContent`)뿐이다.

이 프리뷰는 **이미 실행이 끝난 과거 스냅샷 → 인터랙션 불가**하고, 세 CSS 레이아웃을 픽셀 충실히 포팅해도 값어치가 낮으며 이미지 다수 eager 로드는 낭비다. 따라서:

| 결정 | 채택 | 요지 |
| --- | --- | --- |
| carousel `layout` 렌더 | **D (two-surface)** | **인터랙티브 채널(웹챗)** = 시각 레이아웃 준수(기구현). **실행이력 프리뷰** = 픽셀 재현 대신 **텍스트 포워드 데이터 뷰**(슬라이드별 제목·설명·버튼 라벨 + `layout` 배지 + **lazy 썸네일/URL**). 디버그 목적(데이터·이미지 매핑 확인)에 최적화하고 이미지 eager 로드를 제거. |

- 옵션 A(프리뷰에 세 시각형 포팅) 대비: 인터랙션 없는 디버그 화면에 시각 충실도를 투자하지 않고, 시각적 진실은 이미 웹챗에 존재하므로 제품 약속 손실 없음. 옵션 C(강등) 대비: `layout` 은 웹챗에서 실사용 중이라 제거 불가.
- 사용자 선택: 이미지 **완전 제외(순수 텍스트)** 가 아니라 **lazy 썸네일/링크 유지** (이미지 URL 매핑 확인 빈도 고려).

## 구현 착수 (developer) — Planned (본 PR)

- [ ] spec §1(layout 행)·§4(렌더 노트)를 two-surface 로 개정 (인터랙티브 채널 시각 레이아웃 / 프리뷰 텍스트 포워드).
- [ ] `CarouselContent`(`presentation-renderers.tsx`)를 텍스트 포워드로: `config.layout` 참조해 배지 표시, 이미지 `loading="lazy"` 썸네일 + URL 접근, 슬라이드별 제목·설명·버튼 라벨 나열.
- [ ] `presentation-renderers.test.tsx` 에 layout 배지·lazy 이미지·렌더 케이스 추가.
- [ ] carousel spec frontmatter `status: partial → implemented`, 본 plan 완료 이동.
