---
worktree: (assigned at impl-start)
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

### 5. per_execution 토큰 auto-refresh (spec 3-auth-session §3)
- `EiaClient.refreshToken` 메서드는 있으나, 만료 30분 이내 자동 갱신 스케줄링 미연결.

### 6. M2 BYO-UI headless client 정식 패키징
- 현재 `@workflow/sdk`(EIA 클라이언트) 재사용을 샘플로만 시연. 정식 headless API 표면 노출·문서는 후속.

### 7. CI 테스트 오케스트레이션 wiring
- `codebase/channel-web-chat` + `codebase/packages/web-chat-sdk` 를 `.claude/test-stages.sh`(lint/unit/build) + CI
  install 절차에 편입. 현재는 **로컬 검증만 완료**(각 패키지 lint/test/build 통과) — 공유 harness/CI 설치 순서를
  깨지 않도록 별도 작업으로 분리. (web-chat-sdk 는 eslint devDep 추가 또는 tsc-only 로 lint 처리 결정 필요.)

## 선행
- npm scope·운영 CDN 확정([`channel-web-chat-impl.md`](./channel-web-chat-impl.md) 진입 조건).
