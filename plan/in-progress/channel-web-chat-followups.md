---
worktree: .claude/worktrees/channel-web-chat-followups-1feff2
started: 2026-05-30
owner: developer (TBD)
---

# Channel Web Chat — 잔여 surface (followup)

> 본 PR(`channel-web-chat-impl`)에서 핵심 end-to-end(위젯 SPA + SDK + loader + 경로-스코프 CORS + 샘플)를
> 구현했고, 아래 surface 는 후속으로 분리한다. 관련 spec 은 `status: partial` + 본 plan 을 `pending_plans` 에 등록.

## 종결 (parked, 2026-06-03)

잔여 항목은 **사용자 결정(2026-06-03)으로 전부 보류** — 현 시점 필요성 낮음. **활성 TODO 0건.** 신규 필요가
생기면 본 문서에서 재개하거나 별도 plan 으로 분리한다.

- ✅ **완료**: §1(공개 webhook rate-limit) · §3(임베드 soft 검증) · §4(rich presentation + `show`/`hide`/`updateProfile`, PR #436) · §5(token auto-refresh) · §6(M2 BYO-UI) · §7·7-b(CI wiring · resize/on/data-global)
- ⏸ **보류(비목표/추후)**: 동시 ≤3 캡(§1) · invisible challenge Turnstile/hCaptcha(§1) · 워크플로우 비용 가드(§2) · hard `frame-ancestors`(§3)
- 본 plan 은 spec/7 `pending_plans` 참조 대상이라 **`in-progress/` 유지**(plan-lifecycle: deferred ≠ complete — 미완 surface 가 있으면 `complete/` 이동 금지). frontmatter 가드 무파손.

## 잔여 항목

### 1. 공개 webhook 남용 방어 — auth-scoped rate-limit (spec 4-security §4) — ✅ 완료 (2026-06-02, D#1)
- **왜 분리**: `/api/hooks/:endpointPath` 는 위젯뿐 아니라 모든 webhook(서버-to-서버 GitHub 등 고빈도)을 받는
  공유 엔드포인트. blanket `@Throttle` 은 정당한 webhook 을 깨뜨린다. **trigger 의 `auth_config_id IS NULL`(공개)
  여부를 먼저 해석한 뒤 그 경우에만** IP/세션 throttle 을 적용하는 **커스텀 throttler/guard** 가 필요.
- 구현: `PublicWebhookQuotaService`(Redis fixed-window, fail-open) + `PublicWebhookThrottleGuard`
  (`hooks` 모듈). per-IP 시작 rate-limit(분당 10) + 시간당 신규 상한(20) + body 32KB. `@UseGuards` 로
  `receiveWebhook` 에만 적용. hooks 44 tests ✓ / tsc 0 err.
- ⏸ **동시 ≤3 캡 잔여 — 보류(2026-06-03)**: 대화 종료(conversationEnded) 신호의 widget→backend 연동 선행 필요
  → 별도 increment(quota service 확장). 현 시점 비목표.
- ⏸ **opt-in invisible challenge(Turnstile/hCaptcha) — 보류(2026-06-03)**: spec §4 opt-in 항목, 미구현. 워크스페이스
  opt-in + 외부 provider 의존이라 실제 남용이 문제되는 워크스페이스가 생길 때 별도 착수(설계 선행).

### 2. 워크플로우 측 비용 가드 (spec 4-security §4 — 핵심) — ⏸ 보류 (2026-06-02 이연 → 2026-06-03 보류 확정)
- AI 노드 대화당 최대 turn + 워크스페이스 일일 토큰/비용 예산 → 초과 시 우아한 종료. AI Agent 노드 설정 영역과
  맞물려 별도 설계(본 영역 밖, **execution-engine/AI 노드 spec 연계**).
- **선행: project-planner spec 설계 필요** (execution-engine 영역). 착수 전 결정해야 할 설계 질문:
  - **예산 단위/스코프**: (a) 워크스페이스 일일 토큰 예산 (b) 일일 비용($) 예산 (c) per-trigger(공개 위젯별) 예산 (d) 조합. 저장 위치(workspace 설정 vs trigger config vs AI 노드 config)?
  - **대화당 max turn**: AI 노드 config 필드인가, 채널/워크스페이스 전역인가? 기본값?
  - **미터링 지점**: 토큰 사용량 집계를 어디서 — AI 노드 실행 후 usage 이벤트? execution-engine 의 어느 hook? 실시간 누적 저장소(Redis/DB)?
  - **우아한 종료 의미**: 초과 시 (a) 현재 turn 완료 후 중단 (b) 즉시 중단 + 사용자 고지 메시지 (c) 워크플로우 종료 노드로 라우팅. 엔드유저에게 보이는 문구?
  - **리셋 주기/타임존**: "일일" 경계(워크스페이스 타임존? UTC?).
  - **공개 위젯 vs 일반 execution 구분 적용 여부**(D#1 의 `auth_config_id IS NULL` 신호 재사용?).
- 구현 범위(설계 후): execution-engine 토큰 미터 + 예산 초과 가드 + AI 노드/워크스페이스 config 표면 + 종료 UX.

### 3. 임베드 allowlist (spec 4-security §3) — ✅ soft 검증 완료 (2026-06-02, D#3)
- v1 클라이언트 soft 검증(§3-①) 연결 완료:
  - [x] per-workspace 임베드 allowlist config 엔드포인트(`GET /api/hooks/:endpointPath/embed-config`, 캐시 가능
    `Cache-Control: max-age=300`) — `EmbedConfigService`(trigger→workspace `interactionAllowedOrigins`, 미설정 시
    allow-all). 백엔드 66 tests.
  - [x] 위젯 부팅 시 soft 차단 연결 — `use-widget` boot 시 `detectHostOrigin` + embed-config fetch → 불허 host 면
    `BLOCKED` phase(렌더 거부). fail-open(fetch 실패·enforce off·origin 미탐지 시 허용). 프론트 44 tests.
  - ⏸ **opt-in hard `frame-ancestors`(§3-③, 동적 문서) — 보류(2026-06-03, 비목표 확정)**: spec 상 v1 기본 아님.
    동적 문서 제공이 필요한 워크스페이스만 감수 → 별도 increment(현재 미구현, 의도적 비목표).

### 4. rich presentation 렌더 (spec 1-widget-app §2 — 전체 렌더 A) — ✅ 완료 (2026-06-02, D#4)
- carousel/table/chart/template 전용 inline 렌더러 구현 (`components/presentations.tsx` + `lib/presentation.ts`).
  - shape 기반 판별(`classifyPresentation`) — flat envelope `{config,output,...}` 에서 type 추론.
  - carousel: 슬라이드+nav+per-item/공통 버튼. table: 헤더/행+truncated. chart: **의존성 없는 inline SVG**
    (bar/line/area/pie/donut). template: rendered **plain text 안전 렌더(태그 미해석, XSS 방어)**.
  - 메시지 타임라인 통합: `ConversationTurn.presentations`·`DisplayMessage.presentations`·reducer `AI_MESSAGE`·
    `threadToMessages`(presentation-only turn 포함)·`panel` inline. port 버튼 → `click_button`, link 버튼 → 새 탭.
  - 검증: lint/typecheck/build(static export) ✓, vitest 64 tests(+20).
- [x] **presentation 보강 완료** (2026-06-02): template html/markdown **풍부 렌더 + DOMPurify sanitize**
  (`lib/safe-html.ts`: marked→sanitize, 링크 새탭·noopener 강제, window 가드로 SSR/static-export 안전; text 는 plain).
  chart **축 레이블(xAxis/yAxis.label)·x틱·값 툴팁(`<title>`)·pie/donut 범례** 추가. deps: marked·dompurify.
  검증: lint/typecheck/build(static export) ✓, vitest 92 tests(+6).
- **[연관] `show`/`hide`/`updateProfile` command 위젯 SPA 핸들러 — ✅ 완료 (2026-06-03, PR #436)**: 과거 `use-widget.ts`
  `onCommand` 는 `open`/`close`/`sendMessage`/`shutdown` 만 처리했다.
  - **✅ spec 설계 확정 (2026-06-03)**: [`1-widget-app §3.2`](../../spec/7-channel-web-chat/1-widget-app.md) 에
    가시성 `visible`/`hidden` 축(open/close 와 직교) + `updateProfile` 소급불가 + `blocked` 분리 정의.
  - **✅ 구현 완료 (PR #436)**: `widget-state` `hidden` 상태 + SHOW/HIDE, `use-widget` onCommand `show`/`hide`/
    `updateProfile` 라우팅, `widget-app` 렌더 게이트. reducer 3 + 명령 통합 3 테스트.

### 5. per_execution 토큰 auto-refresh (spec 3-auth-session §3) — ✅ 완료 (2026-06-02, D#5)
- `use-widget` 에 자동 갱신 스케줄러 연결(§3 step7). 만료 `TOKEN_REFRESH_LEAD_MS`(30분) 이전 시점에 setTimeout →
  `EiaClient.refreshToken` → sessionRef/saveSession 갱신 → 재예약. start·복원 시 예약, ENDED·언마운트 시 정리.
  갱신 실패는 흡수(SSE 는 hard expiry 까지 유지). `refreshDelayMs` 순수 함수 추출 + 단위테스트(+5).

### 6. M2 BYO-UI headless client 정식 패키징 — ✅ 완료 (2026-06-02, D#6)
- **결정**: M2 headless client = `@workflow/sdk`(ClemvionClient) 단일 진실. web-chat 전용 headless 패키지 미신설
  (2-sdk §2 의존 방향 — web-chat → @workflow/sdk). ClemvionClient 가 이미 triggerWebhook/subscribeToExecution(SSE)/
  interact/refreshToken/cancel 전체 표면 보유.
- `examples/byo-ui-headless.ts`: 의사코드 → **실제 ClemvionClient 사용**(`startHeadlessChat` 헬퍼: start→SSE→submit→end).
- web-chat-sdk README `## M2 BYO-UI (headless)` 섹션 + examples README 갱신. 토큰 refresh 직접 스케줄 안내.

### 7-b. 위젯 리사이즈·이벤트 API 보강 (코드 리뷰 지적) — ✅ 완료 (2026-06-02, C-2)
- [x] `wc:resize` 수신 처리 — host(WidgetBridge)가 iframe 의 collapsed/expanded 크기 요청을 받아 iframe 엘리먼트 resize. spec `2-sdk §3` 명문화 + `bridge.applyResize` 구현·테스트.
- [x] `on()` 구독 해제 — `on()` 이 unsubscribe 함수 반환 + `off(event, cb?)` 제공(SPA 언마운트 누수 방지). spec `2-sdk §1/R3` 명문화 + bridge/index/loader 구현·테스트.
- [x] 전역 함수명(`ClemvionChat`) 충돌 방지 패턴 — loader `<script data-global="...">` opt-in 재지정 + 비-함수 점유 시 경고·중단(silent overwrite 금지). spec `2-sdk §1` 명문화 + `installGlobal(globalName)` 구현·테스트.

### 7. CI 테스트 오케스트레이션 wiring — ✅ 완료 (2026-06-02, D#7)
- `.claude/test-stages.sh`: `cmd_lint`/`cmd_unit`/`cmd_build` 에 web-chat-sdk + channel-web-chat 편입.
  독립 패키지(backend/frontend file:dep 에 안 묶임)라 `_ensure_web_chat_deps`(node_modules 부재 시 npm ci)로
  설치 순서를 분리 — 공유 harness install 순서 비파손.
- CI: `.github/workflows/web-chat-checks.yml` 신설 — 두 패키지 경로 변경 시 각 독립 install + lint/typecheck/
  test/build(SDK: tsc+loader, widget: next static export). frontend-checks.yml 흐름과 분리.
- 검증: `bash -n` 문법 OK, 양 패키지 `npm ci --dry-run` 정합(lock↔package.json), ensure helper 동작.
  (web-chat-sdk lint = eslint flat config, C-1 채택 완료.)

## 선행
- ~~npm scope·운영 CDN 확정~~ → **확정 완료**(2026-06-02): scope `@workflow/web-chat`, CDN 플레이스홀더+env ([`channel-web-chat-impl.md`](./channel-web-chat-impl.md) 진입 조건).
