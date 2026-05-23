---
status: backlog
created: 2026-05-22
owner: project-planner
priority: v2 (의존성 추가 결정 필요 — 사용자 escalate)
related_pr: PR #261 (v1 MarkdownV2 fallback 구현)
---

# Plan — Chat Channel 시각형 노드 SSR PNG 격상 (Chart / Table / Carousel)

## 현재 상태 (v1 MarkdownV2 fallback — PR #261 머지 후)

PR #261 이 의존성 추가 없이 **MarkdownV2 텍스트/monospace 표현** 으로 chart/table/carousel 3종을 즉시 동작 가능하도록 구현했다. 코드 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` (`renderChartFallback` / `renderTableFallback` / `renderCarouselFallback`).

### v1 의 실제 동작 (구현 완료)

#### Chart — `renderChartFallback`
- 입력: `nodeOutput.payload.{title, labels, series}` (chart node 의 spec output 형식)
- 출력: `📊 {title}` + MarkdownV2 code block (` ```...``` `) 으로 wrap 된 monospace mini horizontal bar chart
- 정렬: 각 카테고리 = `label` (cell width = max(label, 12) pad) + `█` bar (`max(1, round(value/max * 24))` cell) + `value` (number, integer/float trim)
- 다중 시리즈: first series 만 표시 + `(전체 N개 시리즈 중 "name" 만 표시)` footer 안내
- 4096자 초과 시 `splitByLimit` 으로 chunk (raw text 위에 escape 미적용 path — `chunkRichText` 사용)
- 빈 series → `📊 {title}` 만 안내 (chart 미표시)

예시 출력 (월별 매출, 4개 카테고리):
```
📊 월별 매출

```
1월           ████████████ 100
2월           ████████████████████████ 200
3월           ██████ 50
4월           ██████████████████ 150
```
```

#### Table — `renderTableFallback`
- 입력: `nodeOutput.payload.{title, columns: [{key, label?}], rows: Array<Record<string, unknown>>, rowsTruncated?, rowsTotalCount?}`
- 출력: `📋 {title}` + MarkdownV2 code block 으로 wrap 된 monospace 표
- column 너비 계산: 각 column 별 `max(label.length, cell값들의 길이)` cap to 16 (cell max width)
- cell 16자 초과 시 `slice(0, 15) + '…'` ellipsis truncate
- header separator 행: `─` 으로 column 너비만큼, column 경계는 `─┼─`
- data 행 column 경계: ` │ `
- row cap 20: 21번째부터 폐기 + `(외 N행 — 전체 M행)` footer
- 명시적 `rowsTruncated=true` flag → `(상위 N행 표시 — 전체 M행)` footer
- column 0개 → `(열 정보가 없습니다.)` 안내
- 4096자 초과 시 chunk

예시 출력 (주문 내역):
```
📋 주문 내역

```
#  │ 품목 │ 수량
─┼─────┼────
1  │ 사과 │ 3
2  │ 바나나 │ 5
```
```

#### Carousel — `renderCarouselFallback`
- 입력: `nodeOutput.payload.{title?, items: Array<{title?, description?, imageUrl?, buttons?}>}`
- 출력: **sequential ChannelMessage 시퀀스** (1 message per card, sendPhoto 미사용)
  - global title 있으면 첫 메시지: `🎴 {title}`
  - 각 카드 message: `*{escapeMarkdownV2(title)}*\n{escape(description)}\n🖼 {escape(imageUrl)}` (각 필드는 비어 있으면 줄 생략)
  - 카드 cap 10장, 11번째부터 폐기 + 마지막 메시지: `(외 N장 — 전체 M장)`
  - items 0개 → `(카드가 없습니다.)` 안내
- imageUrl 은 v1 에서 URL 텍스트로만 표시 — sendPhoto 미사용 (fetch + Buffer 변환 부담 회피)

예시 출력 (3장 추천 상품, image URL 포함):
```
🎴 추천 상품
*상품 A*
설명 A
🖼 https://x/a.jpg
*상품 B*
설명 B
🖼 https://x/b.jpg
...
```

### v1 의 한계

| 한계 | 영향 | v2 해결 path |
|---|---|---|
| chart 가 색상·legend·multi-series 표현 불가 | 단일 시리즈 mini bar 만 — 비즈니스 인사이트가 풍부한 chart 는 정보 손실 | satori/canvas SSR 로 full-color chart PNG |
| table 의 cell 16자 / row 20 cap | 큰 dataset (예: 100행, 긴 description 필드) 은 truncate 안내만 보임 | PNG 로 row 50까지 + cell pixel-width 정렬 |
| carousel imageUrl 이 URL 텍스트로만 표시 | 봇 사용자가 이미지를 보려면 URL 클릭 — UX 단절 | sendPhoto 로 image bytes 직접 발송 (단일 카드) 또는 collage PNG (다수 카드) |
| Telegram 외 다른 provider (Slack, KakaoTalk) 에서 MarkdownV2 표현 비호환 | v1 은 텔레그램 단일 provider — 향후 provider 추가 시 각자 fallback 별도 구현 필요 | SSR 인프라가 provider-neutral 한 image bytes 를 만들면 모든 provider 가 동일 path |

### v1 동작을 의도적으로 끄는 방법 (구현 완료)

`Trigger.config.chatChannel.uiMapping.visualNode: 'text'` 설정 시 chart/table/carousel 시각 메시지는 텍스트만 발송 (carousel 의 imageUrl 도 무시) 후 `inline_keyboard` 버튼만 발송. 이미 v1 구현됨.

> **(2026-05-23 갱신, spec-telegram-chat-channel-ui-polish 결정 3 반영)**
> 기존 `visualNode: 'text_only'` enum 값은 `'text'` 로 rename 되었음 (영문 일관성 — `photo` / `auto` 와 동급 단어). DB 에 저장된 legacy `'text_only'` 는 어댑터의 read-time normalize 로 `'text'` 로 변환. spec SoT: [Convention §2.3](../../spec/conventions/chat-channel-adapter.md#23-chatchannelconfig).

---

## v2 격상 (본 plan 의 진입 작업)

### 진입 트리거

다음 중 하나가 충족되면 본 plan 을 `in-progress` → 실 작업 진입:

1. **사용자 우선순위 결정**: visual fidelity 향상이 v1 fallback 만족도보다 우선
2. **다른 provider 도입** (Slack/KakaoTalk 등) — provider-neutral image bytes path 가 필요
3. **다른 모듈 SSR 필요** (Email integration 의 chart embed, PDF 리포트 등) — 같은 SSR 인프라 공유

진입 전까지 본 plan 은 backlog 유지. v1 fallback 이 실제 동작하므로 사용자 가치는 이미 확보된 상태.

### 결정 항목 #1 — SSR 라이브러리 선정 (사용자 escalate)

| 옵션 | 의존성 크기 | 장점 | 단점 | best fit |
|---|---|---|---|---|
| (A) **satori + @resvg/resvg-js** | ~10MB | Vercel 검증, lightweight, React-like JSX (`react/jsx-runtime`), font 임베드 | 복잡한 CSS (flex/grid 부분 지원), font 제한 (Korean 등은 별도 woff2 번들 필요) | chart 의 단순 layout · table 의 row stripe |
| (B) **headless chromium (puppeteer-core + @sparticuz/chromium)** | ~200MB | full HTML/CSS/Web Font, 임의 layout, 기존 frontend chart 컴포넌트 재사용 가능 | 무거움 (cold start 1-3초), 메모리 비용 (~150MB/instance), serverless 비호환 가능 | 본격 chart (recharts 등) · template SSR |
| (C) **node-canvas + chart.js (node-chart)** | ~30MB | chart 전용 native, 빠름, image bytes 직접 | table/carousel layout 별도 구현, ARM64 build issue 사례 | chart 만 격상 |
| (D) **외부 SaaS** (예: QuickChart API) | 0 (HTTP) | 의존성 0, 즉시 동작 | 외부 의존, 비용·rate-limit, SSRF 정책 정합 | 빠른 격상 prototype |

권장 선택지: (A) satori — 텔레그램 envelope 의 단순함과 잘 맞음. 폰트 번들 (Pretendard / NotoSansKR woff2 ~1MB) 한국어 지원.

### 결정 항목 #2 — fallback 정책 ✅ **결정 완료 (2026-05-23, option (b) 변형 채택)**

**채택 결정**: `spec-telegram-chat-channel-ui-polish` PR (#281) 결정 3 에서 enum 을 `"text" | "photo" | "auto"`, default `"auto"` 로 확정. 위 표의 옵션 (b) 변형 — `text_only` 폐기 + `auto` 신설.

| `visualNode` | v1 동작 | v2 동작 (본 plan 진입 후) |
|---|---|---|
| `text` (구 `text_only`) | MarkdownV2 텍스트/monospace (carousel imageUrl 도 무시) | 동일 — text 모드 (PNG 변환 안 함) |
| `photo` | fallback to text + warning 로그 (v2 SSR 인프라 없음). `chat_channel_health` 변경 없음 — 정상 fallback | SSR PNG → `sendPhoto` (chart/table/carousel 전부) |
| `auto` (default) | chart/table → text (가독성 우선), carousel → 카드별 imageUrl 있으면 `sendPhoto` else `sendMessage` (기존 telegram §5.4 동작) | chart/table → text (v2 에서도 정밀도 유지), carousel → 카드별 imageUrl 분기 + 5장 collage PNG 시도 |

핵심 결정:
- chart / table 의 `auto` 동작은 v1·v2 모두 text 우선 (데이터 정밀도가 PNG 보다 monospace text 가 더 가독적)
- `photo` v1 fallback 의 health 변경 없음 (v1 인프라 미도입은 사용자 error 가 아니라 정상 fallback)
- legacy `text_only` 값 read-time normalize (`text_only` → `text`) 정책 — 어댑터 입력 단계
- 노드타입 × enum × v1/v2 완전 매트릭스 SoT: [`spec/4-nodes/7-trigger/providers/telegram.md §5.4`](../../spec/4-nodes/7-trigger/providers/telegram.md#54-carousel--chart--table-cch-mp-04)

본 plan 의 잔존 결정은 #1 (SSR 라이브러리 선정) 뿐. 사용자 escalate 대기 중.

### Phase 별 작업 (옵션 결정 후)

#### Phase 1 — SSR adapter abstraction
- `codebase/backend/src/modules/chat-channel/visual/` 신설
- `VisualRenderer` interface:
  ```typescript
  interface VisualRenderer {
    renderChart(payload: ChartPayload): Promise<Buffer>;
    renderTable(payload: TablePayload): Promise<Buffer>;
    renderCarousel(items: CarouselItem[]): Promise<Buffer>; // collage 1~5장
  }
  ```
- 선택된 SSR 라이브러리 동적 import (어댑터 미사용 환경에서 cold start 비용 회피)
- 폰트 번들 (한국어 + 영문 sans-serif) — repo 에 commit 또는 build-time fetch

#### Phase 2 — Chart PNG
- `renderChartFallback` 의 텍스트 path 유지 (graceful fallback)
- `renderChartPng(payload, config): Promise<ChannelMessage>` 신설 — `body.kind='image'` + bytes Buffer
- SSR template (satori): 800x400 canvas, single/multi series bar/line, legend, title, axis labels
- chart node payload 의 `chartType` (`bar` / `line` / `pie` 등) 처리

#### Phase 3 — Table PNG
- `renderTablePng(payload, config)` — 800x{auto-height} 표, row stripe, header bold
- row cap 50 (v1 의 20 보다 확장), cell 픽셀 너비 자동 정렬 (8자 → 약 96px)
- column 너비 합이 800 초과 시 비례 축소

#### Phase 4 — Carousel PNG (collage)
- `renderCarouselPng(items)` — 1~5장 카드를 1장 collage PNG (3x2 grid 또는 horizontal scroll-mimic)
- 각 카드 = (imageUrl fetch → resize 256x256) + title bold + description (2 lines max)
- imageUrl fetch 실패 시 placeholder
- 6장 이상은 첫 5장 + "외 N장" overlay

#### Phase 5 — `renderButtons` 의 visual 분기 갱신
- 현 `renderButtons` 의 `visualKind === 'chart'/'table'/'carousel'` 분기에서 v2 PNG 우선 시도, 실패 시 v1 fallback 호출
- error path 로그 + `markDegraded` 호출 (CCH-SE-01 정합)

#### Phase 6 — Spec 갱신
- `spec/5-system/15-chat-channel.md` CCH-MP-04 — v2 격상 완료 명시, v1 fallback 은 graceful degrade path 로 격하
- `spec/4-nodes/7-trigger/providers/telegram.md` §5.4 — PNG path 가 default, v1 텍스트는 fallback 명시
- 유저 가이드 갱신: "이미지로 차트 전송" + "SSR 실패 시 텍스트 fallback" 안내

#### Phase 7 — 테스트
- visual snapshot test (PNG bytes hash 또는 pixel diff) — chart/table/carousel
- fallback path 단위 테스트 (SSR throw → 텍스트 fallback 확인)
- e2e: 실제 텔레그램 sendPhoto 까지 (mocked Bot API)

### 의존 관계

- 관련 spec: `spec/5-system/15-chat-channel.md` §3.3 (CCH-MP-04), `spec/4-nodes/7-trigger/providers/telegram.md` §5.4
- 관련 코드: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts` (v1 fallback path 유지)
- 다른 노드 / 모듈 (Email integration, PDF 리포트) 도 같은 SSR 인프라 공유 검토 — Phase 1 의 interface 를 재사용 가능하나 별 plan 분리 권장

### Out of Scope

- **다른 chat channel provider (Slack / KakaoTalk) 의 PNG 발송**: 첫 SSR 인프라 도입 후 별 plan. 본 plan 은 Telegram 한정.
- **다른 모듈 (email integration 등) 의 SSR 통합**: Phase 1 인터페이스 재사용 가능하나 별 plan.
- **사용자 정의 chart 스타일** (color theme, legend 위치 등): v2.1 follow-up.
- **GIF / video output**: v2 범위 외.

### v1 fallback 유지 정책

본 plan 의 v2 격상 시에도 v1 의 `renderChartFallback` / `renderTableFallback` / `renderCarouselFallback` 함수는 **삭제하지 않고 graceful degrade path 로 유지**한다. SSR 실패 (font 누락, timeout, 메모리 부족 등) 시 v1 텍스트 fallback 으로 자동 전환되어 봇 사용자가 최소 정보는 받을 수 있어야 한다 — `chat_channel_health = 'degraded'` 갱신은 CCH-SE-01 와 동일 정책.
