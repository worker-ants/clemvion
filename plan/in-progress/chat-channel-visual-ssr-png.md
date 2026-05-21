---
status: backlog
created: 2026-05-22
owner: project-planner
priority: v2 (의존성 추가 결정 필요 — 사용자 escalate)
---

# Plan — Chat Channel 시각형 노드 SSR PNG 격상

## 배경

[CCH-MP-04 v1](../../spec/5-system/15-chat-channel.md#33-노드--채널-ui-매핑) 은 chart / carousel / table 을 **MarkdownV2 텍스트/monospace 표현** 으로 발송한다 (의존성 추가 없음, 즉시 동작 — chat-channel-visual-impl 에서 완료). 시각적 품질은 SSR PNG 보다 낮음.

본 plan 은 v2 격상 — satori 또는 chromium 기반 SSR 로 raw 데이터로부터 PNG 이미지를 만들어 `sendPhoto` 로 발송하는 작업을 추적한다.

## 배경 — `output.rendered` snapshot 폐기 (D5 / 2026-05-17)

기존 spec 은 "chart 노드가 `output.rendered` SVG 를 제공 → 어댑터가 PNG 변환" 가정이었으나, D5 (2026-05-17) 에 `output.rendered` HTML/SVG snapshot 이 폐기되었다 (frontend `TableContent` / chart 컴포넌트가 raw 데이터로부터 직접 렌더). 따라서 어댑터가 raw 데이터로부터 직접 SSR 책임을 진다.

## 결정 항목 (사용자 escalate)

| 옵션 | 장점 | 단점 |
|---|---|---|
| (A) satori + @resvg/resvg-js | lightweight (~10MB), React-like JSX, Vercel 검증 | font 제한, 복잡한 layout 어려움 |
| (B) headless chromium (puppeteer) | full CSS/HTML, 임의 layout | 무거움 (~200MB), 메모리·CPU 비용 |
| (C) 노드 native (node-canvas + chart.js) | 의존성 적음 (~20MB), chart 특화 | table/carousel layout 별도 구현 |

배포 환경 / 비용 / chart 외 다른 노드의 SSR 필요성 trade-off 에 따라 사용자 결정 필요.

## 범위 (옵션 결정 후)

### Phase 1 — SSR adapter abstraction
- `VisualRenderer { renderChart(payload): Promise<Buffer>, renderTable(payload): Promise<Buffer>, renderCarousel(items): Promise<Buffer> }` 인터페이스
- 의존성 동적 import (어댑터 미사용 환경에서 cold start 비용 회피)

### Phase 2 — Chart PNG
- `renderChartFallback` 의 monospace 텍스트 fallback 유지 + PNG path 추가
- `uiMapping.visualNode='photo'` 일 때 PNG, `'text_only'` 또는 미설정 v2 default 분기 결정

### Phase 3 — Table PNG
- `renderTableFallback` 텍스트 fallback 유지 + PNG path 추가 (rows ≤ 50, column 자동 너비)

### Phase 4 — Carousel PNG (collage)
- 1~5장 카드를 1장의 collage PNG 으로 결합 (텔레그램 sendPhoto 1회)

### Phase 5 — Fallback 정책
- SSR 실패 시 (font 누락, timeout 등) MarkdownV2 텍스트로 graceful degrade
- `chat_channel_health = 'degraded'` 갱신 (CCH-SE-01 와 동일 정책)

## 의존 관계

- 관련 spec: spec/5-system/15-chat-channel.md §3.3 (CCH-MP-04), spec/4-nodes/7-trigger/providers/telegram.md §5.4
- 다른 노드 (Email integration 의 chart embed 등) 도 같은 SSR 인프라 공유 검토 — 별 plan 분리 가능

## Out of Scope

- 다른 chat channel provider (Slack / KakaoTalk) 의 PNG 발송 — 첫 SSR 인프라 도입 후 별 plan
- 다른 모듈 (email integration 등) 의 SSR 통합 — 본 plan 의 phase 1 인터페이스를 재사용 가능하나 별 plan 분리
