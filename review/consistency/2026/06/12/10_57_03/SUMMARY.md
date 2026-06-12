# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — OPEN PR #558(`pr4b-kb-embedding-retire`)이 rebase 없이 머지되면 main 에 확정된 §4.1 Rationale 와 Planned 인증 액션 정규화가 되돌아간다. WARNING 2건은 plan 에서 요청한 spec 보완이 target 에 미반영된 상태다. 나머지 checker 들은 LOW~NONE 수준이다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | OPEN PR #558(`pr4b-kb-embedding-retire`)이 PR #552 squash-merge 이전 베이스의 `1-auth.md`를 포함 — 머지 시 `§4.1 Planned 표` 인증 액션 구 표기(`password_change, 2fa_enable/disable`) 회귀 + `Rationale §4.1.A` 전체 삭제 + `§4.1 읽기측 계약` 블록쿼트 삭제 발생 | `spec/5-system/1-auth.md §4.1 Planned 표` (라인 366), `Rationale §4.1.A` (라인 593–609) | PR #558(`claude/pr4b-kb-embedding-retire`), PR #552(MERGED, `audit-sot-hygiene-8fc5f1`) | PR #558을 `origin/main`에 **rebase** 한 뒤 `1-auth.md` 충돌 해소. `§4.1.A` Rationale 및 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 정규화 보존 필수. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `auth-config-webhook-followups.md §3` 에서 요청한 `POST /api/auth-configs/:id/reveal` 의 §5 API 엔드포인트 표 추가 누락 | `spec/5-system/1-auth.md §5 API 엔드포인트` 표 | `plan/in-progress/auth-config-webhook-followups.md §3` 첫 번째 불릿 | `§5` 표에 `POST /api/auth-configs/:id/reveal` 행 추가 (Admin+, 비밀번호 재확인 + audit 기록 필수). plan §3 해당 불릿 체크 처리. |
| 2 | Plan Coherence | `auth-config-webhook-followups.md §3` 이 요청한 ip_whitelist fail-closed 동작("clientIp 불명 시 거부") 명시가 `§2.3` 에 누락 | `spec/5-system/1-auth.md §2.3 세션 정책` 클라이언트 IP 행 (라인 300) | `plan/in-progress/auth-config-webhook-followups.md §3` 두 번째 불릿 | `§2.3` 클라이언트 IP 행에 "ip_whitelist fail-closed: clientIp 불명 시 거부" 명시 추가. `12-webhook.md` 대상 항목은 별도 spec 편집으로 해소. |
| 3 | Convention Compliance | `§5 API 엔드포인트` 표에서 `GET /api/auth/2fa/webauthn/availability` 응답이 `{ enabled: boolean }` (data 래퍼 없음) 으로 표기 — `§1.4.3` 의 `{ data: { enabled: boolean } }` 및 `api-convention §5.1` (`TransformInterceptor` 래핑 규약)과 불일치 | `spec/5-system/1-auth.md §5 API 엔드포인트` 표 | `spec/5-system/2-api-convention.md §5.1`, `spec/conventions/swagger.md §2-5`, target `§1.4.3` | `§5` 표 해당 행을 `{ data: { enabled: boolean } }` 으로 수정. |
| 4 | Convention Compliance | `§5 API 엔드포인트` 표에서 `GET /api/auth/2fa/webauthn/credentials` 응답이 `[{id, ...}]` raw 배열 표기 — 목록 응답은 `{ data: [...] }` 래퍼여야 함 (`api-convention §5.2`) | `spec/5-system/1-auth.md §5 API 엔드포인트` 표 | `spec/5-system/2-api-convention.md §5.2` | `응답: { data: [{id, deviceName, transports, lastUsedAt, createdAt}] }` 로 수정. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | RBAC 매트릭스 `Integration (Org)` 행 — Organization-scope CRUD 세부 분리 해상도 차이 (모순 아님) | `spec/5-system/1-auth.md §3.2` vs `spec/2-navigation/9-user-profile.md §4.2`, `spec/2-navigation/4-integration.md §8` | `§3.2` `Integration (Org)` 행 아래 "Org-scope 생성·수정·삭제·회전은 Admin+. Editor 는 읽기만" 주석 추가 또는 행 분리. |
| 2 | Cross-Spec | `9-user-profile.md §4.2` 에 Marketplace·Statistics·Auth Config·Model Config·Audit Log 행 없음 — RBAC 항목 집합 차이 | `spec/5-system/1-auth.md §3.2` vs `spec/2-navigation/9-user-profile.md §4.2` | `9-user-profile.md §4.2` 에 "전체 권한 매트릭스는 `spec/5-system/1-auth.md §3.2` 가 SoT" 참조 주석 추가. |
| 3 | Cross-Spec | `§1.1` 인증 메일 재발송 행에 유효기간 누락 — `§5` 및 `data-flow/2-auth.md §1.7` 은 24h 명시 | `spec/5-system/1-auth.md §1.1` | `§1.1` 재발송 행에 "(재발급 토큰 유효기간 24h)" 추가. |
| 4 | Cross-Spec | `GET /api/invitations/:token` throttle 30/min 이 target 에 미언급 (`data-flow/12-workspace.md §1.2` 에만 있음) | `spec/5-system/1-auth.md §1.5.1` 또는 `§5` 표 | `§5` `GET /api/invitations/:token` 행에 "throttle 30/min (공개 조회)" 주석 추가. |
| 5 | Cross-Spec | `§5` 에 `/api/users/me/enable-2fa`·`/api/users/me/confirm-2fa` alias 미언급 — `9-user-profile.md §6.1` 이 SoT 를 target 으로 인정하는 구조이므로 충돌 아님 | `spec/5-system/1-auth.md §5` | `§5` 해당 행에 "alias: `/api/users/me/enable-2fa` / `confirm-2fa`" 주석 추가 (선택). |
| 6 | Cross-Spec | `data-flow/1-audit.md §1.1` — `auth_config.*` 5개 action 이 target §4.1 과 완전 일치. 충돌 없음 | `spec/5-system/1-auth.md §4.1` | 조치 불필요. |
| 7 | Cross-Spec | `§5` forgot-password 행에 throttle 미언급 — `data-flow/2-auth.md §2.2` 및 target `§1.7` 은 IP당 5 req/min 명시 | `spec/5-system/1-auth.md §5` forgot-password 행 | `§5` 해당 행에 `throttle 5/min (IP)` 주석 추가. |
| 8 | Rationale Continuity | `§2.3 강제 종료 재인증` WebAuthn 우선 적용 확장에 대한 별도 Rationale 부재 | `spec/5-system/1-auth.md §2.3` | `Rationale 2.3.B` 로 "강제 종료 재인증에서의 WebAuthn 우선 원칙 확장" 근거 추가 (선택). |
| 9 | Rationale Continuity | WebAuthn 복구 코드 재발급 허용 이유 (`Rationale 1.4.B` 또는 `1.4.B-1`) 부재 | `spec/5-system/1-auth.md §1.4.1` | Rationale 에 "도난/분실 기기 시나리오 대응 + 비밀번호 재확인으로 강도 유지" 근거 추가 (선택). |
| 10 | Rationale Continuity | §4.1 감사 액션 현재형 통일 — 본문-Rationale 완전 정합. 추가 조치 불필요 | `spec/5-system/1-auth.md §4.1` | 조치 불필요. |
| 11 | Convention Compliance | 문서 최상단 `## Overview` 섹션 부재 — 직접 `## 1. 인증` 으로 시작 | `spec/5-system/1-auth.md` 상단 | 기존 인트로 blockquote 를 `## Overview` 섹션으로 승격 (권장). |
| 12 | Convention Compliance | Rationale 내부 subsection 번호가 비선형 (`1.5.A` → `1.4.A` 역순 배치) | `spec/5-system/1-auth.md §Rationale` | Rationale 항목을 본문 섹션 번호 순으로 재정렬 (편의성 제안, 의무 아님). |
| 13 | Convention Compliance | `§1.5.4` lower_snake_case 에러 코드 — `error-codes.md §3` historical-artifact 레지스트리에 이미 등재, 주석도 명시적. 규약 위반 아님 | `spec/5-system/1-auth.md §1.5.4` | 조치 불필요. |
| 14 | Convention Compliance | frontmatter `code:` 가 `auth-configs.service.ts` 단일 파일만 참조 — 글로브 `auth-configs/**/*.ts` 권장 | `spec/5-system/1-auth.md` frontmatter | `codebase/backend/src/modules/auth-configs/**/*.ts` 글로브로 교체 (권장, 가드 통과에는 영향 없음). |
| 15 | Plan Coherence | `security-backlog-invitation-token-hash.md` 가 `spec_impact: spec/5-system/1-auth.md` 선언, 아직 unstarted — 충돌 없음, 추적용 | `spec/5-system/1-auth.md §1.5.D Rationale` | target §1.5.D 변경 시 plan 과 연동 필요함 주의. 현재 조치 불필요. |
| 16 | Naming Collision | TOTP alias 엔드포인트 이중 게재 — `9-user-profile.md §6.1` 에 `canonical` 주석이 있어 의미 충돌 아님, 문서 중복 표기 | `spec/2-navigation/9-user-profile.md §6.1` | `9-user-profile.md §6.1` 표에서 alias 행 삭제 또는 "alias 미지원, canonical endpoint 직접 사용" 주석으로 대체. |
| 17 | Naming Collision | `WEBAUTHN_INVALID` 동일 문자열이 API 응답 error.code 와 LoginHistory.failure_reason 두 레이어에서 사용 — 의도적 설계이나 미명시 | `spec/5-system/1-auth.md §5`, `spec/1-data-model.md §2.18.2` | `error-codes.md` 또는 target §4.3 주석에 두 레이어 중복 사용이 의도적임을 명시. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 직접 모순 없음. RBAC 해상도 차이·throttle/유효기간 주석 누락 등 동기화 편의 개선 7건 (모두 INFO). |
| Rationale Continuity | NONE | 기각된 대안 재도입·invariant 위반 없음. Rationale 보완 제안 2건 (모두 INFO). |
| Convention Compliance | LOW | CRITICAL 없음. API 응답 래퍼 표기 불일치 2건 (WARNING), 문서 구조·frontmatter 개선 4건 (INFO). |
| Plan Coherence | HIGH | CRITICAL 1건 (PR #558 stale base — §4.1 Rationale 삭제 위험). WARNING 2건 (plan 요청 spec 보완 미반영). |
| Naming Collision | NONE | 의미 충돌 없음. alias 이중 게재·에러코드 레이어 중복 INFO 2건. |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** PR #558(`claude/pr4b-kb-embedding-retire`)을 `origin/main`에 **rebase** 하고, `spec/5-system/1-auth.md` 충돌 시 `§4.1 Planned 표`의 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 정규화 및 `Rationale §4.1.A` 전체를 **보존**한다. 머지 담당자가 `git rebase origin/main` 후 diff 를 확인해야 한다.
2. **(WARNING 해소 권장)** `spec/5-system/1-auth.md §5` 표에 `POST /api/auth-configs/:id/reveal` 행 추가 (`auth-config-webhook-followups.md §3` 첫 번째 불릿 해소).
3. **(WARNING 해소 권장)** `§2.3` 클라이언트 IP 행에 "ip_whitelist fail-closed: clientIp 불명 시 거부" 명시 추가 (`auth-config-webhook-followups.md §3` 두 번째 불릿 해소).
4. **(WARNING 해소 권장)** `§5` 표의 WebAuthn availability 응답을 `{ data: { enabled: boolean } }` 으로, credentials 응답을 `{ data: [{...}] }` 으로 수정해 `api-convention §5.1~5.2` 와 일치시킨다.
5. **(INFO 선택)** stale worktree 2건(`audit-sot-hygiene-8fc5f1`, `test-code-http-hardening-10aad3`) 정리 권장.
6. **(INFO 선택)** `9-user-profile.md §4.2` 에 "전체 권한 매트릭스 SoT: `spec/5-system/1-auth.md §3.2`" 참조 주석 추가로 RBAC 항목 집합 차이 해소.
7. **(INFO 선택)** `§1.1` 재발송 행에 "(재발급 토큰 유효기간 24h)" 추가, `§5` forgot-password 행에 "throttle 5/min (IP)" 주석 추가.