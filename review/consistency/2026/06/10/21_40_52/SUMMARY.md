# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — `spec/1-data-model.md §2.1 User` 엔티티가 인증 운영에 필수적인 다수 필드를 누락하고 있으며, 초대 토큰의 raw/hash 저장 정책 불일치가 보안 수정 브랜치 맥락에서 구현자 혼란을 야기할 수 있다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 초대 토큰 raw 저장 vs 이메일/비밀번호 재설정 토큰 SHA-256 해시 저장 — 동일 파일 내 병치 근거 없음. 보안 수정 브랜치에서 초대 토큰도 hash 대상으로 오인 가능 | `spec/5-system/1-auth.md §1.5.1` "저장 형태" | `spec/5-system/1-auth.md §1.1` (이메일·비번 재설정 토큰 hash 정책) + `spec/data-flow/12-workspace.md §1.2, §3.1` | raw 유지 시 §1.5 에 Rationale(§1.5.D) 추가. hash 전환 시 1-auth.md §1.5.1 + data-flow/12-workspace.md §1.2 시퀀스·§3.1 테이블 동시 갱신 |
| 2 | Cross-Spec | `user.password_hash` nullable 불일치 — auth spec 은 nullable(`OAuth 단독 가입 NULL`)이라 하나 data-model §2.1 에 `?` 표기 없음 | `spec/5-system/1-auth.md §1.1` "비밀번호 저장" | `spec/1-data-model.md §2.1 User` 테이블 | `spec/1-data-model.md §2.1` `password_hash` 를 `String?` 으로 수정, 설명에 "OAuth 단독 가입 NULL" 추가 |
| 3 | Cross-Spec | `login_attempts`, `locked_until` 필드가 data-model §2.1 에 없음 — data-flow §3.2 시퀀스가 직접 참조하는 컬럼 누락 | `spec/5-system/1-auth.md §1.1` "5회 실패 10분 잠금" | `spec/1-data-model.md §2.1 User`, `spec/data-flow/2-auth.md §3.2` | `spec/1-data-model.md §2.1` 에 `login_attempts Integer` (기본 0) + `locked_until Timestamp?` 추가 |
| 4 | Cross-Spec | 이메일 인증 관련 필드 전체 누락 — `email_verified`, `email_verify_token`, `email_verify_expires_at`, `oauth_provider`, `oauth_provider_id`, `password_reset_token`, `password_reset_expires_at` 등이 data-model §2.1 에 없음 | `spec/5-system/1-auth.md §1.1` "이메일 인증 필수" | `spec/1-data-model.md §2.1 User`, `spec/data-flow/2-auth.md §1` | `spec/1-data-model.md §2.1` 에 `data-flow/2-auth.md §1` 참조 필드 전체 동기화 추가 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 초대 Rate Limit 구체 값 불일치 — auth spec 은 "N회(구현 시 결정)"인데 workspace data-flow 는 "분당 10건(`INVITATION_THROTTLE`)"으로 확정 기술 | `spec/5-system/1-auth.md §1.5.1` Rate Limit | `spec/data-flow/12-workspace.md §1.2` | `spec/5-system/1-auth.md §1.5.1` Rate Limit 행을 "분당 10건(`INVITATION_THROTTLE`)"으로 갱신 |
| 2 | Cross-Spec | `invitation_already_accepted` 에러 코드 미정의 — workspace data-flow 는 409 사용, auth spec §1.5.4·error-codes.md §3 에 등재 없음 | `spec/5-system/1-auth.md §1.5.4` 에러 응답 표 | `spec/data-flow/12-workspace.md §1.8`, `spec/conventions/error-codes.md §3` | §1.5.4 에 `409 invitation_already_accepted` 행 추가 + error-codes.md §3 historical-artifact 등재 |
| 3 | Cross-Spec | 초대 가입 시 request body `email` 포함 여부 불일치 | `spec/5-system/1-auth.md §1.5.2` 흐름 4번 | `spec/2-navigation/10-auth-flow.md §2.1, §2.6` | §1.5.2 에 "invitationToken 존재 시 body의 email 무시, 토큰 email 사용" 명시 또는 register body 스키마 통합 정의 |
| 4 | Convention Compliance | §5 API 목록에서 응답 포맷이 `{ data: ... }` 래퍼 없이 plain 형태로 기술됨 (WebAuthn availability 등) | `spec/5-system/1-auth.md §5 API 엔드포인트` 표 | `spec/conventions/swagger.md §2-5`, `spec/5-system/1-auth.md §1.4.3` | §5 표 응답 기술을 `{ data: <본문> }` 래퍼 형식으로 통일하거나 표 상단에 "응답은 `{ data: ... }` 래퍼 포함" 주석 추가 |
| 5 | Plan Coherence | `auth-config-webhook-followups.md §3` 의 spec 보완 항목(`POST /api/auth-configs/:id/reveal` 행 추가)이 `1-auth.md §5` 에 미반영 잔존 | `spec/5-system/1-auth.md §5 API 엔드포인트` 표 | `plan/in-progress/auth-config-webhook-followups.md §3` | 착수 전 reveal 행 추가 + IP 추출 정책 cross-reference 를 선처리하거나 인지 사항으로 메모 |
| 6 | Plan Coherence | `refactor/04-security.md C-1` 과 `security-jwt-secret-fallback.md` 가 동일 변경(1-auth.md §2 fail-closed 명문화)을 중복 추적 — 착수 시 혼선 위험 | `spec/5-system/1-auth.md §2.1/§2.3` | `plan/in-progress/refactor/04-security.md §C-1`, `plan/in-progress/security-jwt-secret-fallback.md` | spec 갱신 책임 plan 을 단일화하고 상호 cross-reference 명시 |
| 7 | Plan Coherence | `refactor/04-security.md M-5` — SameSite 정책·CSRF 보완책이 1-auth.md §2.1/2.3 에 공백. 쿠키 동작을 건드리는 구현 착수 전 필요 | `spec/5-system/1-auth.md §2.1, §2.3` | `plan/in-progress/refactor/04-security.md §M-5` | M-5 spec 갱신을 planner 트랙으로 선처리하거나 현 SameSite=None 유지 근거를 Rationale 에 추가 |
| 8 | Plan Coherence | `refactor/04-security.md M-7` — 11-mcp-client.md §3.2 에 `MCP_ALLOW_INSECURE_URL` fail-closed 명문화 미비 | `spec/5-system/11-mcp-client.md §3.2` | `plan/in-progress/refactor/04-security.md §M-7` | M-7 spec 갱신을 planner 위임 작업 단위로 등재 |
| 9 | Plan Coherence | `unified-model-mgmt-5af7ee` worktree — stale 불명확(Step 1/2 음성), spec/5-system/ 내 1-auth.md 등 6개 파일 경합 가능성 | `spec/5-system/1-auth.md`, `10-graph-rag.md` 등 | worktree `claude/unified-model-mgmt-5af7ee` | `gh pr list --head claude/unified-model-mgmt-5af7ee --state all` 재확인 후 stale 이면 정리, active 이면 조율 후 착수 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `POST /api/auth/resend-verification` 경로 표기 불일치 (`/api/` prefix 누락) + §5 엔드포인트 목록 미등재 | `spec/5-system/1-auth.md §1.1` 표 | 경로를 `POST /api/auth/resend-verification` 으로 통일, §5 목록에 추가 |
| 2 | Cross-Spec | `WorkspaceInvitation` 엔티티가 `spec/1-data-model.md` 에 미정의 (data-flow §3.1 에만 기술) | `spec/1-data-model.md` 전체 | `spec/1-data-model.md` 에 섹션 추가하거나 data-flow/12-workspace.md §3.1 을 SoT 로 명시·교차 참조 |
| 3 | Convention Compliance | `1-auth.md §1.5.4` lower_snake_case 에러 코드 — historical-artifact 레지스트리 등재로 공식 예외 흡수 완료 | `spec/5-system/1-auth.md §1.5.4` | 현 상태 유지, 추가 조치 불요 |
| 4 | Convention Compliance | `11-mcp-client.md §6.2` `skipReason` lower_snake_case — 진단 메타 enum 으로 error-codes.md 규약 범위 외 명시됨 | `spec/5-system/11-mcp-client.md §6.2` | `error-codes.md §3` 에 "진단 메타 enum은 본 규약 적용 범위 외" 주석 추가 고려 (선택) |
| 5 | Convention Compliance | `10-graph-rag.md` 문서 구조 Overview/본문/Rationale 경계 불분명 | `spec/5-system/10-graph-rag.md` 전체 | 향후 리팩토링 시 §1~§8 를 Overview 외부 본문으로 분리 고려. 구현 착수 차단 아님 |
| 6 | Convention Compliance | `11-mcp-client.md` `## Overview` H2 섹션 없이 `## 1. 개요` 로 시작 | `spec/5-system/11-mcp-client.md` 전체 | 향후 리팩토링 시 3섹션 구조화 고려. 필수 아님 |
| 7 | Convention Compliance | `10-graph-rag.md` frontmatter `status: implemented` + `code:` glob — 규약 준수 확인 | `spec/5-system/10-graph-rag.md` frontmatter | 이상 없음 |
| 8 | Convention Compliance | `1-auth.md` frontmatter `status: partial` + `pending_plans` — 규약 준수 확인 | `spec/5-system/1-auth.md` frontmatter | 이상 없음 |
| 9 | Rationale Continuity | C3 fix 완료 후 `data-flow/15-external-interaction.md §1.5` 구현 갭 callout 제거 + `14-external-interaction-api.md §7.1` 컬럼 설명 재확인 필요 | `spec/data-flow/15-external-interaction.md §1.5` | fix 완료 후 갭 blockquote 제거 확인; §7.1 별도 변경 불필요 확인 |
| 10 | Rationale Continuity | V-03 `@Roles('admin')` 추가 — 1-auth.md §3.2/§3.3 권한 매트릭스 및 API 인가 원칙 이행. Rationale 위반 없음 | `spec/5-system/1-auth.md §3.2, §3.3` | 해당 없음 |
| 11 | Rationale Continuity | `QueryAuditLogDto.userId` 추가 — spec §4.2 원래 요구사항 이행. Rationale 번복 없음 | `spec/5-system/1-auth.md §4.2` | 해당 없음 |
| 12 | Naming Collision | `QueryAuditLogDto.userId` — entity·response DTO 와 동일 개념, 충돌 없음. spec 에 파라미터명 명시 보완 권장 | `spec/5-system/1-auth.md §4.2` | Swagger description 에 "필터 대상 사용자 UUID" 명시. spec 파라미터명 보완은 선택 |
| 13 | Naming Collision | C3 `notification-signing` ref 이름 — `normalizeNotificationSecretRef` 기존 패턴과 일치, 충돌 없음 | `codebase/backend/src/modules/triggers/triggers.service.ts` | 이상 없음. data-flow §1.5 갭 기술 갱신만 필요 |
| 14 | Plan Coherence | `spec-sync-auth-gaps.md` §1.3 LDAP/SAML — backlog plan, 착수 없음, 충돌 없음 | `spec/5-system/1-auth.md §1.3` | 변경 없음 |
| 15 | Plan Coherence | `spec-sync-mcp-client-gaps.md` 5개 항목 — spec 내 "미구현(Planned)" 표기와 정합 | `spec/5-system/11-mcp-client.md §3.3, §6.2, §8.2` | 변경 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | `spec/1-data-model.md §2.1 User` 엔티티에서 `password_hash nullable`, `login_attempts/locked_until`, 이메일 인증 필드 전체 누락 (Critical 4건). 초대 토큰 rate limit·에러 코드·가입 body 불일치 (Warning 3건) |
| Rationale Continuity | NONE | 계획 중인 V-03·C3 구현이 모든 관련 Rationale 와 일치. 기각 대안 재도입·원칙 위반 없음 |
| Convention Compliance | LOW | WARNING 1건(`§5 응답 래퍼 누락`). INFO 7건. CRITICAL 없음 |
| Plan Coherence | LOW | WARNING 4건(auth-config §5 gap, JWT fail-closed 중복 추적, SameSite 공백, MCP fail-closed 미명문화) + worktree 경합 WARNING 1건. CRITICAL 없음 |
| Naming Collision | NONE | 신규 식별자 모두 기존 코드베이스와 의미 일치. 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/1-data-model.md §2.1 User` 엔티티에 누락 필드 4종 추가:
   - `password_hash String?` (nullable 수정)
   - `login_attempts Int` (default 0) + `locked_until DateTime?`
   - 인증 필드 전체: `email_verified Boolean`, `email_verify_token String?`, `email_verify_expires_at DateTime?`, `password_reset_token String?`, `password_reset_expires_at DateTime?`, `oauth_provider String?`, `oauth_provider_id String?`
2. **(BLOCK 해소 필수 — 보안 수정 브랜치 맥락)** 초대 토큰 저장 정책을 명확화:
   - raw 저장 유지 결정 시 `spec/5-system/1-auth.md §1.5` 에 Rationale 추가 (HTTPS 전송으로 기밀성 보장, 직접 lookup 목적)
   - hash 전환 결정 시 1-auth.md §1.5.1 + data-flow/12-workspace.md §1.2·§3.1 동시 갱신
3. **(WARNING 해소 권장)** `spec/5-system/1-auth.md §1.5.1` Rate Limit 행을 "분당 10건(`INVITATION_THROTTLE`)"으로 갱신
4. **(WARNING 해소 권장)** `spec/5-system/1-auth.md §1.5.4` 에 `409 invitation_already_accepted` 추가 + `spec/conventions/error-codes.md §3` 등재
5. **(WARNING 해소 권장)** `spec/5-system/1-auth.md §5` API 표 응답 포맷을 `{ data: ... }` 래퍼 형식으로 통일
6. **(WARNING — 착수 전 조율)** `unified-model-mgmt-5af7ee` worktree stale 여부 확인: `gh pr list --head claude/unified-model-mgmt-5af7ee --state all`
7. **(WARNING — 계획 정합)** `refactor/04-security.md C-1` 과 `security-jwt-secret-fallback.md` 간 spec 갱신 책임 plan 단일화