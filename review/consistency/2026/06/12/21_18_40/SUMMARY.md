# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 하는지

## 전체 위험도
**MEDIUM** — 1건의 CRITICAL(병렬 worktree 파일 경합, 머지 충돌 위험), 4건의 WARNING(cross-spec 정책 공백 3건 + plan 절차 우회 1건 + 주석 명칭 불일치 1건), 다수 INFO(미구현 env var 괴리, 문서 구조 편차 등). CRITICAL은 spec 자체 결함이 아닌 워크트리 머지 순서 문제이므로 절차 조율로 해소 가능.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `hooks.service.ts` · `hooks.service.spec.ts` 를 active worktree `chat-channel-gaps-e5e3e8` (PR OPEN) 와 동시 수정 — 머지 순서에 따라 git conflict 발생 확실 | `codebase/backend/src/modules/hooks/hooks.service.ts` + `hooks.service.spec.ts` | `plan/in-progress/spec-sync-chat-channel-gaps.md` (worktree `chat-channel-gaps-e5e3e8`, PR OPEN) — CCH-CV-03 `handleChatChannelWebhook` hunk | `chat-channel-gaps-e5e3e8` 를 먼저 머지한 뒤 본 worktree rebase → conflict 재해소 후 재검증. |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/1-data-model.md §2.18.1` RefreshToken.ip_address 설명이 "CF-Connecting-IP 우선" 단순 기술로 `TRUST_CF_CONNECTING_IP` 조건부 신뢰 정책 누락 — IP 신뢰 정책이 문서마다 다르게 읽힘 | `spec/5-system/1-auth.md §2.3` 세션 정책 표 (클라이언트 IP 행) | `spec/1-data-model.md §2.18.1` main 640행 | 머지 시 worktree의 올바른 정의로 자동 해소. main 단독 참조 기간 중 혼선 인지 필요. |
| 2 | Cross-Spec | `spec/5-system/6-websocket-protocol.md` main 버전에 `notifications:{userId}` 채널 인가 전략 누락 — 임의 userId 구독이 허용될 것처럼 보이는 security 정책 공백 | `spec/5-system/6-websocket-protocol.md §3.3` (worktree: channelAuthorizers OCP 구조 + 채널별 인가 표) | `spec/5-system/6-websocket-protocol.md` main 143행 | 머지 시 worktree 버전으로 자동 해소. |
| 3 | Cross-Spec | `spec/conventions/swagger.md` main 버전에 §0 Swagger UI production 비노출 정책 전체 부재 — `ENABLE_SWAGGER_IN_PROD` opt-in · `isSwaggerEnabled` 함수 근거 없음 | `spec/conventions/swagger.md §0` (worktree 신설) | `spec/conventions/swagger.md` main 버전 | 머지 시 자동 해소. |
| 4 | Plan Coherence | `security-backlog-invitation-token-hash.md` 가 "사용자 결정 필요"로 유보한 §1.5.D Rationale 을 이번 diff 가 "raw 유지 결정" 방향으로 작성 — plan 절차 우회 | `spec/5-system/1-auth.md §Rationale 1.5.D` | `plan/in-progress/security-backlog-invitation-token-hash.md` §주의사항 | (A) raw 유지 확정 후 backlog plan 을 `plan/complete/` 이동; 또는 (B) §1.5.D 톤을 "현재 동작 + 해시 전환 검토 여지 명시"로 조정하여 결정 공간 보존. |
| 5 | Naming Collision | `audit-action.const.ts` 15번째 줄 주석의 `password_change · 2fa_*` 구 표기가 target spec §Rationale 4.1.A 에서 확정한 `user.password_changed · user.2fa_enabled · user.2fa_disabled` 신규 명칭과 불일치 — 구현자 혼선 위험 | `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 15번째 줄 주석 | `spec/5-system/1-auth.md §4.1 + §Rationale 4.1.A` 신규 명칭 확정 | 주석의 `password_change · 2fa_*` → `user.password_changed · user.2fa_enabled · user.2fa_disabled` 로 갱신. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `1-auth.md §2.1` Refresh 쿠키 기술 — main 버전이 SameSite/Path/CSRF 정책 누락 (구현은 이미 따르는 중) | `spec/5-system/1-auth.md §2.1 + §2.3` | 머지 시 자동 해소. |
| 2 | Cross-Spec | auth spec Rationale의 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 포함이 `7-llm-client.md §7.1` 과 일관 | `spec/5-system/1-auth.md Rationale "Production fail-closed 가드"` | 변경 불필요. |
| 3 | Rationale Continuity | M-5 SameSite none 기본 전환 시 기각된 "Lax 기본 원안" 이유가 Rationale 2.3.B 에 미기재 (plan 에만 있음) | `spec/5-system/1-auth.md §Rationale 2.3.B` | Rationale 2.3.B 에 "cross-site 배포 실사용 확인으로 Lax 기본 원안 기각" 한 줄 보완 권장. |
| 4 | Rationale Continuity | M-6 `notifications:` 채널 선제 fail-closed authorizer 결정 근거가 websocket spec Rationale 에 부재 (plan 에만 있음) | `spec/5-system/6-websocket-protocol.md ## Rationale` | Rationale 에 "emit 미구현임에도 authorizer 선제 배치 이유" 항목 신설 권장. |
| 5 | Rationale Continuity | m-3 `TRUST_CF_CONNECTING_IP` 결정 시 "인프라 AOP 강제 원안 기각" 근거가 auth spec Rationale 에 미기재 | `spec/5-system/1-auth.md §Rationale 2.3.B` | "CF Tunnel 사용으로 인프라 강제 불필요" 한 줄 추가 권장. |
| 6 | Convention Compliance | `1-auth.md §1.5.4` lower_snake_case 에러 코드 6건 — `error-codes.md §3` historical-artifact 레지스트리에 이미 정식 등재 | `spec/5-system/1-auth.md §1.5.4` | 현행 유지. 조치 불필요. |
| 7 | Convention Compliance | `10-graph-rag.md` Overview 헤딩에 `(제품 정의)` 접미어 + 별도 `## 1. 개요` 섹션 — 스타일 편차 (규약 강제 아님) | `spec/5-system/10-graph-rag.md` 최상단 | 향후 `## Overview` 단독 표기 통일 권장. |
| 8 | Convention Compliance | `10-graph-rag.md` Rationale 하위 제목이 설명형 (다른 spec 의 번호+ID 패턴과 다름) | `spec/5-system/10-graph-rag.md ## Rationale` | 선택적 개선. 강제 아님. |
| 9 | Convention Compliance | `11-mcp-client.md` 에 `## Overview` 섹션 없이 `## 1. 개요` 로 시작 — 영역 내 스타일 비일관성 | `spec/5-system/11-mcp-client.md` 시작부 | `## Overview` + `## 1. 개요` 통합 정비 권장. 강제 아님. |
| 10 | Naming Collision | `TRUST_CF_CONNECTING_IP` env var 가 spec 에만 존재, `client-ip.ts` 및 `.env.example` 미동기화 — spec vs 구현 간 CF-Connecting-IP 신뢰 정책 괴리 | `spec/5-system/1-auth.md §2.3` vs `codebase/backend/src/modules/auth/utils/client-ip.ts` | `client-ip.ts` 에 분기 로직 추가 + `.env.example` 문서화를 별도 플래닝 항목으로 추적 권장. |
| 11 | Naming Collision | `COOKIE_SAMESITE` env var 가 spec 에만 존재, `refresh-cookie.ts` 는 `sameSite: 'none'` 하드코딩 | `spec/5-system/1-auth.md §2.3` vs `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` | `refresh-cookie.ts` 에 `COOKIE_SAMESITE` 처리 로직 추가 + `.env.example` 문서화를 별도 impl 플래닝 추적 권장. |
| 12 | Naming Collision | Refresh 쿠키 Path — target spec `/api/auth` vs 코드 `COOKIE_PATH = '/'` 값 불일치 | `spec/5-system/1-auth.md §2.3` vs `refresh-cookie.ts` 4번째 줄 | `refresh-cookie.ts` 의 `COOKIE_PATH = '/'` → `/api/auth` 변경 필요. 별도 구현 추적 권장. |
| 13 | Naming Collision | `audit-action.const.ts` 주석의 `llm_config.*`/`rerank_config.*` 구 명칭 잔존 — `data-flow/1-audit.md` 는 이미 `model_config.*` 로 갱신 | `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 15번째 줄 | 주석을 `model_config.*` 로 갱신 권장. |
| 14 | Plan Coherence | `spec-fix-prod-guards-prose.md` 가 `1-auth.md §Rationale "Production fail-closed 가드"` 추가 수정 예정이나 이번 diff hunk 와 중복 없음 | `plan/in-progress/spec-fix-prod-guards-prose.md` | 착수 전 main 최신 기준 rebase 확인. |
| 15 | Plan Coherence | `chat-channel-followups-residual-1be5d3` worktree 물리 디렉토리 존재하나 PR MERGED — stale 잔류 | `.claude/worktrees/chat-channel-followups-residual-1be5d3` | `cleanup-worktree-all.sh --yes --force` 실행 권장. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | WARNING 3건: `1-data-model.md` IP 신뢰 정책 불일치, `websocket-protocol.md` notifications 채널 인가 공백, `swagger.md` production 비노출 정책 미기재. 모두 머지 시 자동 해소. |
| Rationale Continuity | LOW | INFO 3건: Lax 기본 기각·notifications 선제 authorizer·인프라 AOP 기각 근거가 plan 에만 있고 spec Rationale 에 미기재. 심각한 연속성 위반 없음. |
| Convention Compliance | NONE | CRITICAL/WARNING 없음. lower_snake_case 에러 코드는 historical-artifact 예외 정식 등재. 문서 구조 편차 3건은 모두 INFO 수준. |
| Plan Coherence | MEDIUM | CRITICAL 1건: `hooks.service.ts`/`spec` 파일 active worktree 경합. WARNING 1건: `security-backlog-invitation-token-hash.md` "사용자 결정 필요" 절차 우회. |
| Naming Collision | LOW | WARNING 1건: `audit-action.const.ts` 주석 구 감사 액션 명칭 잔존. INFO 3건: 미구현 env var(`TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE`) + Refresh Path 불일치. |

## 권장 조치사항

1. **(CRITICAL 해소 — 머지 순서 조율)** `chat-channel-gaps-e5e3e8` (PR OPEN) 를 먼저 main 에 머지한 뒤, 본 worktree `refactor-04-security-286de9` 를 main rebase → `hooks.service.ts` + `hooks.service.spec.ts` conflict 재해소 후 재검증. 또는 반대 순서를 명시적으로 결정하고 rebase 를 이 worktree 가 담당.
2. **(WARNING 해소 — plan 절차 정합)** `security-backlog-invitation-token-hash.md` 처리: §Rationale 1.5.D 를 raw 유지 확정으로 인정하면 해당 backlog plan 을 `plan/complete/` 이동; 아니면 §1.5.D 톤을 "현재 동작 설명 + 해시 전환 여지 보존"으로 완화.
3. **(WARNING 해소 — 주석 동기화)** `audit-action.const.ts` 15번째 줄 주석을 `user.password_changed · user.2fa_enabled · user.2fa_disabled` + `model_config.*` 로 갱신.
4. **(INFO — 구현 추적)** `TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE`, Refresh 쿠키 Path `/api/auth` 세 건을 별도 impl 플래닝 항목으로 등록하여 spec-impl 괴리 추적.
5. **(INFO — Rationale 보완 선택적)** `1-auth.md §Rationale 2.3.B` 에 Lax 기본 기각 사유 + 인프라 AOP 기각 사유 각 한 줄 추가; `6-websocket-protocol.md ## Rationale` 에 notifications 선제 authorizer 이유 항목 신설 — 강제 아님, 이후 spec 편집 시 반영 권장.
6. **(INFO — 정리)** stale worktree `chat-channel-followups-residual-1be5d3` 물리 디렉토리 정리: `cleanup-worktree-all.sh --yes --force`.
---

## Resolution (main Claude, 2026-06-12) — BLOCK 분석

**BLOCK:YES 의 Critical 은 본 PR 의 spec/code 결함이 아니라 워크트리 머지 순서 사안**이며, WARNING/INFO 다수는 origin/main base 기준 오탐이다.

- **Critical #1 (Plan Coherence — 머지 순서)**: `hooks.service.ts`(m-3 CF-IP 게이트)가 active worktree `chat-channel-gaps-e5e3e8`(PR OPEN)의 `handleChatChannelWebhook` 와 같은 파일을 수정 → 머지 시 conflict 가능. **다른 함수/hunk 라 의미 충돌 아님, text-level 머지 충돌**이다. 해소는 **머지 시점 rebase 순서 조율**(둘 중 먼저 머지된 쪽 기준 rebase) — 본 PR 내 코드 수정으로 해결할 사안이 아니다. PR 본문에 merge-order 주의 명시.
- **W1·W2·W3 (Cross-Spec)**: "main 버전에 누락 → 머지 시 worktree(본 PR) 버전으로 자동 해소" — **본 PR 이 정정하는 drift 그 자체**. 비실재(머지로 해소).
- **W4 (§1.5.D 초대토큰)**: §1.5.D 는 **기존 본문**(본 diff 가 2.3.B 를 그 앞에 삽입했을 뿐 1.5.D 미변경). 오귀인.
- **W5 / INFO13 (audit-action.const.ts 주석)**: 해당 파일은 **본 PR diff 에 없음**(audit 액션명은 본 작업 범위 밖). out-of-scope 기존 주석 drift.
- **INFO10·11·12 (env "미동기화"·`COOKIE_PATH='/'`)**: **오탐 확정** — checker 가 origin/main base 를 읽음. 본 worktree/커밋(1aa52b54) 은 `shouldTrustCfConnectingIp`(client-ip.ts)·`COOKIE_SAMESITE`(refresh-cookie.ts getRefreshCookieSameSite)·`COOKIE_PATH='/api/auth'` 를 모두 구현·커밋함(검증: grep 일치).
- **INFO3·4·5 (Rationale 보강 — 선택)**: 기각된 대안(Lax 기본·AOP 강제) 기록 권장. 본 PR 에서는 plan 티켓·draft·RESOLUTION 에 근거가 보존돼 있어 spec Rationale 추가는 차기 점진 개선으로 둔다(추가 spec 편집이 또 다른 --impl-done 재실행을 유발하는 루프 회피).

**판단**: spec-impl 정합성 측면의 실제 결함 0 (Critical 은 머지 순서, 나머지는 오탐/범위 밖/INFO). build-guard(spec-code-paths·plan-frontmatter) 573 PASS + 코드 grep 으로 구현 동기화를 직접 확인했다. 머지 순서 Critical 은 PR 본문에 명시하고 머지 시점에 조율한다.
