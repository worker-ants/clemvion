---
worktree: .claude/worktrees/channel-web-chat-followups-1feff2
started: 2026-05-30
owner: developer (TBD)
---

# Channel Web Chat — 잔여 surface (followup)

> 본 PR(`channel-web-chat-impl`)에서 핵심 end-to-end(위젯 SPA + SDK + loader + 경로-스코프 CORS + 샘플)를
> 구현했고, 아래 surface 는 후속으로 분리한다. 관련 spec 은 `status: partial` + 본 plan 을 `pending_plans` 에 등록.

## 잔여 항목

### 1. 공개 webhook 남용 방어 — auth-scoped rate-limit (spec 4-security §4)
- **왜 분리**: `/api/hooks/:endpointPath` 는 위젯뿐 아니라 모든 webhook(서버-to-서버 GitHub 등 고빈도)을 받는
  공유 엔드포인트. blanket `@Throttle` 은 정당한 webhook 을 깨뜨린다. **trigger 의 `auth_config_id IS NULL`(공개)
  여부를 먼저 해석한 뒤 그 경우에만** IP/세션 throttle 을 적용하는 **커스텀 throttler/guard** 가 필요.
- 범위: per-IP 시작 rate-limit, 익명 세션+IP 동시/누적 대화 상한, 메시지/페이로드 크기 제한.

### 2. 워크플로우 측 비용 가드 (spec 4-security §4 — 핵심)
- AI 노드 대화당 최대 turn + 워크스페이스 일일 토큰/비용 예산 → 초과 시 우아한 종료. AI Agent 노드 설정 영역과
  맞물려 별도 설계(본 영역 밖, execution-engine/AI 노드 spec 연계).

### 3. 임베드 allowlist hard 강제 (opt-in) (spec 4-security §3-③)
- v1 은 클라이언트 soft 검증(`detectHostOrigin` helper 만 존재, 실제 allowlist fetch·렌더 차단 미연결).
  - [ ] per-workspace 임베드 allowlist config 엔드포인트(캐시 가능 JSON) + 위젯 부팅 시 soft 차단 연결.
  - [ ] opt-in hard `frame-ancestors`(동적 문서) — 비기본.

### 4. rich presentation 렌더 (spec 1-widget-app §2 — 전체 렌더 A)
- 현재 위젯은 텍스트·버튼·Form·추천질문·AI multi-turn 렌더. **carousel/table/chart/template presentation 의
  전용 inline 컴포넌트**는 미구현(`ai_message.presentations[]` 수신은 되나 전용 렌더 없음).
- **[연관] `show`/`hide`/`updateProfile` command 위젯 SPA 핸들러 미구현**: `use-widget.ts` `onCommand` switch 는
  `open`/`close`/`sendMessage`/`shutdown` 만 처리. `show`/`hide`(런처 가시성)는 1-widget-app §3 상태기계에 런처
  visible/hidden 상태 추가가 선행돼야 하고(project-planner), `updateProfile` 는 진행 중 세션 profile 갱신 의미
  정의 필요. spec 2-sdk §3 `wc:command` 표·§5 타입에는 명시됨 — handler 갭만 잔존.

### 5. per_execution 토큰 auto-refresh (spec 3-auth-session §3)
- `EiaClient.refreshToken` 메서드는 있으나, 만료 30분 이내 자동 갱신 스케줄링 미연결.

### 6. M2 BYO-UI headless client 정식 패키징
- 현재 `@workflow/sdk`(EIA 클라이언트) 재사용을 샘플로만 시연. 정식 headless API 표면 노출·문서는 후속.

### 7-b. 위젯 리사이즈·이벤트 API 보강 (코드 리뷰 지적) — ✅ 완료 (2026-06-02, C-2)
- [x] `wc:resize` 수신 처리 — host(WidgetBridge)가 iframe 의 collapsed/expanded 크기 요청을 받아 iframe 엘리먼트 resize. spec `2-sdk §3` 명문화 + `bridge.applyResize` 구현·테스트.
- [x] `on()` 구독 해제 — `on()` 이 unsubscribe 함수 반환 + `off(event, cb?)` 제공(SPA 언마운트 누수 방지). spec `2-sdk §1/R3` 명문화 + bridge/index/loader 구현·테스트.
- [x] 전역 함수명(`ClemvionChat`) 충돌 방지 패턴 — loader `<script data-global="...">` opt-in 재지정 + 비-함수 점유 시 경고·중단(silent overwrite 금지). spec `2-sdk §1` 명문화 + `installGlobal(globalName)` 구현·테스트.

### 7. CI 테스트 오케스트레이션 wiring
- `codebase/channel-web-chat` + `codebase/packages/web-chat-sdk` 를 `.claude/test-stages.sh`(lint/unit/build) + CI
  install 절차에 편입. 현재는 **로컬 검증만 완료**(각 패키지 lint/test/build 통과) — 공유 harness/CI 설치 순서를
  깨지 않도록 별도 작업으로 분리. (~~web-chat-sdk lint 처리 결정 필요~~ → **eslint devDep 채택 완료** C-1: `eslint.config.mjs` flat config.)

## 선행
- ~~npm scope·운영 CDN 확정~~ → **확정 완료**(2026-06-02): scope `@workflow/web-chat`, CDN 플레이스홀더+env ([`channel-web-chat-impl.md`](./channel-web-chat-impl.md) 진입 조건).
