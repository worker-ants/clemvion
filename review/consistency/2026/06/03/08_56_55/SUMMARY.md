# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**MEDIUM** — Critical 없음. WARNING 4건(cross-spec 2건 + convention 2건 + naming 1건)이 구현 시 처리 경로 미정의 및 빌드타임 가드 누락으로 실제 결함으로 이어질 수 있음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | 위젯 패널 collapse 시 SSE 연결 유지 전제 아래 iframe suspend·재연결 시나리오와 EIA `Last-Event-Id` 복원 흐름이 위젯 spec에 미명시 | `spec/7-channel-web-chat/1-widget-app.md §3.1` | `spec/5-system/14-external-interaction-api.md §5.2·§EIA-NF-03` | `1-widget-app.md §3.1`에 SSE 재연결 절차 추가. EIA §5.2·§EIA-NF-03 교차 참조 명시 |
| W2 | Cross-Spec | 재로드 복원 시 storage stale 토큰과 EIA blacklist 간 처리 경로 미명시 — blacklist 기인 `401` vs 만료 `401` 구별 로직 누락 | `spec/7-channel-web-chat/3-auth-session.md §3` | `spec/5-system/14-external-interaction-api.md §8.3` | `3-auth-session.md §3`에 재로드 복원 시퀀스 명시 |
| W3 | Convention | `spec/7-channel-web-chat/` 영역이 `spec-impl-evidence §1` 빌드타임 가드 적용 범위 밖 | `spec/7-channel-web-chat/*.md` frontmatter | `spec/conventions/spec-impl-evidence.md §1` INCLUDE_PREFIXES | INCLUDE_PREFIXES에 `spec/7-channel-web-chat/` 추가 + 테스트 배열 동기화 |
| W4 | Convention | `4-security.md`에 `## Rationale` 섹션 없음 | `spec/7-channel-web-chat/4-security.md` | project-planner SKILL §Spec 문서 구조 | `4-security.md` 끝에 `## Rationale` 추가 |
| W5 | Naming Collision | `WEB_CHAT_WIDGET_ORIGINS` 환경변수명이 spec 본문·`.env.example`에 미명시 | `spec/7-channel-web-chat/0-architecture.md §4` | `codebase/backend/src/common/cors/web-chat-cors.ts` | `0-architecture.md §4`에 env 키 명시 + backend `.env.example` 예시 |

## 참고 (INFO) — 데모 구현 관련 발췌

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| I6 | Rationale | 데모 host bridge의 `event.origin` 검증 처리 방침 미명시 (dev-only이나 postMessage 보안 요건) | `demo-host.tsx`에서 `wc:*` 수신 시 `event.source`/`event.origin` 검증 또는 데모 전용 완화 사유 주석 |
| I9 | Plan | `show`/`hide`/`updateProfile` wc:command 위젯 핸들러 미구현 | 데모에서 해당 버튼 노출 시 비활성/미구현 주석 |
| I7 | Plan | `channel-web-chat-demo.md`가 spec/7 `pending_plans`에 미등재 (선택) | `1-widget-app.md` `pending_plans:`에 추가 권장 (spec write=project-planner) |
| I8 | Plan | `channel-web-chat-impl.md`/`followups.md`의 `worktree:` 가 소멸 worktree 지칭 | 차기 착수 시 갱신 |

(전체 INFO I1~I11 및 Checker별 위험도는 원 산출 참조 — 본 보고서는 데모 구현 관련 항목 위주 발췌.)

## 처리 방침 (본 dev-harness PR)
- **W1~W5**: 모두 기존 spec/ 문서 갭. 본 PR(dev 전용 데모 하니스 추가)과 무관하며 spec write 는 developer 권한 밖 → **project-planner 후속**으로 이관 (plan 노트에 기록). 본 PR 차단 사유 아님.
- **I6**: 데모 구현에 반영 — iframe 메시지 수신 시 `event.source === iframe.contentWindow` + origin 검증.
- **I9**: 데모는 위젯이 실제 처리하는 `open`/`close`/`sendMessage` 만 명령 버튼으로 노출. `show`/`hide`/`updateProfile` 미노출.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | SSE 재연결(W1) + stale 토큰 blacklist(W2) 미명시 (기존 spec 갭) |
| Rationale Continuity | NONE | 기각 대안 재도입·원칙 위반 없음 |
| Convention Compliance | LOW | spec-impl-evidence 가드 미포함(W3) + 4-security Rationale 누락(W4) |
| Plan Coherence | NONE | spec/7 경합 없음 |
| Naming Collision | LOW | WEB_CHAT_WIDGET_ORIGINS 문서화 갭(W5). 실 충돌 없음 |
