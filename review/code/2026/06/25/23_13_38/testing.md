# Testing Review

## 발견사항

### [INFO] toTable AI payload — truncated 필드 미검증
- 위치: `presentation.test.ts` — "toTable/toChart — payload 에서 데이터 추출" (line 160-167)
- 상세: `toTable` AI payload 테스트에서 `tb.truncated` 값을 검증하지 않음. `toTable` 내부는 `output.rowsTruncated === true` 로 판별하는데, AI payload 경로에서 `asEnvelope` 가 payload 를 output 으로 매핑한 뒤 `payload.rowsTruncated` 가 `true` 일 때 `truncated` 가 정상적으로 `true` 가 되는지 확인되지 않음. 현재 테스트는 columns/rows 추출만 검증.
- 제안: `{ type: "table", payload: { ..., rowsTruncated: true } }` 케이스를 추가하거나, 기존 테스트에 `expect(tb.truncated).toBe(false)` 최소 검증 추가.

### [INFO] toChart AI payload — title/xLabel/yLabel 미검증
- 위치: `presentation.test.ts` — "toTable/toChart — payload 에서 데이터 추출" (line 164-167)
- 상세: AI payload 경로의 `toChart` 테스트가 `chartType`·`points` 만 검증. `title`, `xLabel`, `yLabel`, `colors` 등은 검증하지 않음. AI 카루셀처럼 실 wire 캡처를 기반으로 한 chart 픽스처가 아니라서 edge case 누락.
- 제안: `payload.title`, `payload.xAxis`, `payload.yAxis` 포함 픽스처로 확장.

### [INFO] itemButtons 병합 순서 검증 없음
- 위치: `presentation.test.ts` — "toCarousel — payload.items/layout/global buttons + itemButtons 를 각 item 에 병합" (line 137-148)
- 상세: itemButtons 가 item.buttons 뒤에 병합되었는지(`[...item.buttons, ...itemButtons]`) 순서를 구체적으로 검증하지 않음. `toContain` 만 사용하므로 순서 역전 버그가 통과될 수 있음. 또한 itemButtons 만 있는 아이템(item.buttons 가 없는 경우)과 item.buttons 만 있는 경우의 분기 검증이 없음.
- 제안: `expect(labels).toEqual(["구매하기", "자세히 보기"])` 처럼 순서 검증 추가.

### [INFO] 노드 카루셀의 itemButtons 병합 회귀 미검증
- 위치: `presentation.test.ts` — converters describe 블록 (line 37-101)
- 상세: 커밋 메시지에서 "노드 카루셀도 동일 개선" 이라고 명시했으나, `{config, output}` envelope 경로에서 `config.itemButtons` 가 있을 때 각 item 에 병합되는지를 검증하는 테스트가 없음. converters 블록의 `toCarousel` 테스트에는 `itemButtons` 픽스처가 없어 새 기능이 노드 경로에서도 작동하는지 회귀 보장이 부족.
- 제안: `{ config: { itemButtons: [...], items: [...] } }` 를 사용하는 테스트를 converters 블록에 추가.

### [INFO] toTemplate — rendered/content 우선순위 충돌 케이스 미검증
- 위치: `presentation.test.ts` — "toTemplate — AI payload 의 content 를 rendered 로 매핑" (line 150-158)
- 상세: `output.rendered` 와 `output.content` 가 동시에 존재할 때 `rendered` 가 우선됨(`typeof output.rendered === "string"` 먼저 분기). 이 우선순위 동작을 검증하는 테스트가 없음. AI payload 가 잘못 구성되어 두 필드가 동시에 있을 경우의 정책 확인이 필요.
- 제안: `payload: { rendered: "R", content: "C" }` 입력시 `t.rendered === "R"` 인지 검증하는 케이스 추가.

### [INFO] presentations.test.tsx — AI PresentationPayload 경로 컴포넌트 통합 테스트 미추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-ai-presentation-render-beb2be/codebase/channel-web-chat/src/widget/components/presentations.test.tsx`
- 상세: plan 문서에 "(가능 시 `presentations.test.tsx` 에 PresentationBlock(PresentationPayload) 렌더 1건.)" 이라고 명시되어 있으나 추가되지 않음. `classifyPresentation` → 분기 → 컴포넌트 렌더 전체 통합 경로 커버가 unit 계층(`presentation.test.ts`)에만 있고, 컴포넌트 계층에서 PresentationPayload shape 가 실제 DOM 으로 렌더되는지 검증되지 않음.
- 제안: `PresentationBlock payload={aiCarouselPayload}` 통합 테스트 1건 추가. `screen.getByTestId("wc-carousel")` + item title 확인이면 충분.

### [INFO] classifyPresentation — payload: null 케이스 미검증
- 위치: `presentation.test.ts` — "classifyPresentation — payload 없는 type-만 객체는 PresentationPayload 로 보지 않음" (line 132-135)
- 상세: `{ type: "carousel" }` (payload 누락) 케이스는 검증하지만 `{ type: "carousel", payload: null }` 케이스는 검증하지 않음. 구현 코드는 `o.payload && typeof o.payload === "object"` 로 체크하므로 null 은 falsy 로 처리되어 정상 동작하나, 명시적 테스트가 없어 향후 리팩터링 시 회귀 위험.
- 제안: `expect(classifyPresentation({ type: "carousel", payload: null })).toBeNull()` 추가.

### [INFO] toTable/toChart 콤바인 테스트 — 단일 it 블록에 두 컨버터 검증
- 위치: `presentation.test.ts` line 160-167
- 상세: "toTable/toChart — payload 에서 데이터 추출" 이 하나의 `it` 블록에서 `toTable` 과 `toChart` 를 모두 검증. 한 assertion 이 실패하면 나머지 assertion 이 스킵되어 실패 원인 진단이 어려워짐. 테스트 격리 관점에서도 각 컨버터가 독립 it 블록을 갖는 것이 바람직.
- 제안: `toTable — AI payload` / `toChart — AI payload` 로 it 블록 분리.

---

## 요약

이번 변경에서 추가된 `PresentationPayload (AI 에이전트 render_* 도구)` describe 블록은 신규 두 shape 처리의 핵심 경로(classifyPresentation 4종 판별, toCarousel itemButtons 병합, toTemplate content 매핑, 회귀 envelope)를 잘 커버하고 있으며, 실 SSE wire 픽스처 기반 테스트가 의도를 명확히 표현한다. 단, itemButtons 병합 순서 검증 부족, 노드 카루셀 itemButtons 회귀 테스트 누락, rendered/content 우선순위 동시 존재 케이스 미검증, 컴포넌트 계층 통합 테스트 미추가(plan 에 명시된 항목), toTable/toChart 단일 it 블록 격리 부재 등 낮은 위험도의 커버리지 갭이 남아있다. 기존 테스트는 변경 후에도 회귀 케이스를 명시적으로 포함하며 모두 유효하다. 전반적으로 테스트 구조는 양호하고 추가된 테스트들이 버그 픽스를 충분히 뒷받침하나, 위의 INFO 항목들을 보완하면 장기 유지보수성이 향상된다.

## 위험도

LOW
