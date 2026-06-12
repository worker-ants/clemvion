# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**CRITICAL** — 활성 worktree(`pr4b-kb-embedding-retire`)가 target과 동일 섹션을 반대 방향으로 편집 중이어서 merge 시 충돌이 확정되며, convention_compliance checker가 별도 CRITICAL(에러 코드 표 주석 누락)을 발견함.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 활성 worktree `pr4b-kb-embedding-retire`가 `spec/5-system/1-auth.md §4.1 Planned 표` + `§Rationale 4.1.A` 를 **반대 방향**(구표기 `password_change` 유지 + Rationale 14줄 전체 삭제)으로 수정 중 — merge 충돌 확정 | `spec/5-system/1-auth.md §4.1 Planned 표`, `§Rationale 4.1.A` | `plan/in-progress/spec-draft-unified-model-management.md` (worktree `pr4b-kb-embedding-retire`) | (1) `pr4b-kb-embedding-retire` 측의 §4.1 변경 범위를 조율해 직렬화를 결정하거나 (2) 해당 worktree가 main 반영 후 리베이스 시 target 변경을 흡수하도록 plan frontmatter에 명시 |
| 2 | Convention Compliance | `§1.5.4` 에러 코드 표에서 `forbidden`·`rate_limited` (lowercase)의 historical-artifact 예외 근거 주석 누락 — 독자가 나머지 4개 초대 코드와 달리 이 두 코드의 lowercase 이유를 spec 내에서 추적 불가. 잘못된 선례 답습 위험 | `spec/5-system/1-auth.md §1.5.4` 에러 응답 표 | `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 (`forbidden`/`rate_limited` 는 초대 API 한정 명시) | §1.5.4 blockquote에 `forbidden`·`rate_limited` lowercase 이유를 명시 — "초대 흐름 v1 출하 시 정착한 초대 API 전용 예외. 신규 코드는 이를 선례로 삼지 않는다." + `error-codes.md §3` cross-reference |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `9-user-profile.md §6.1` API 표가 세션 강제 종료 재인증을 "비밀번호/TOTP 재인증" 으로만 기술 — WebAuthn 경로 및 OAuth-only 이메일 OTP 대체 경로 누락 | `spec/5-system/1-auth.md §2.3` | `spec/2-navigation/9-user-profile.md §6.1` (`POST /api/users/me/sessions/:familyId/revoke`, `revoke-others`) | `9-user-profile.md §6.1` 해당 엔드포인트 설명을 "비밀번호/TOTP/WebAuthn 재인증. OAuth-only 는 이메일 OTP 대체. 상세: [인증 spec §2.3]" 으로 보완하거나 cross-reference 링크 명시 |
| 2 | Cross-Spec | `9-user-profile §4.2` RBAC 매트릭스가 Auth Config·Model Config·Audit Log·Statistics 등을 누락 — 두 매트릭스의 역할 분담 의도가 어디에도 명시되지 않아 불완전 여부 모호 | `spec/5-system/1-auth.md §3.2` | `spec/2-navigation/9-user-profile.md §4.2` | `9-user-profile.md §4.2`에 "전체 RBAC 매트릭스 SoT는 [인증/인가 §3.2]" 임을 명시하는 주석 추가 |
| 3 | Convention Compliance | frontmatter `pending_plans` 에 등재된 두 plan 파일의 실존 여부 — 특히 `auth-config-webhook-followups.md`는 `debc90ee` 커밋(감사 로그 구현) 병합 이후에도 in-progress 잔류 | `spec/5-system/1-auth.md` frontmatter `pending_plans` | `spec/conventions/spec-impl-evidence.md §2.1`; `spec-pending-plan-existence.test.ts` build-time 강제 | `plan/in-progress/auth-config-webhook-followups.md`·`spec-sync-auth-gaps.md` 실존 및 완료 여부 확인. 모든 pending_plans 완료 시 `status: partial → implemented` 승격 의무 발생 |
| 4 | Plan Coherence | `auth-config-webhook-followups.md §3` reveal 엔드포인트 직접 행 추가 요청을 target이 cross-reference 위임 방식으로 대체 처리했으나 plan 체크박스가 미갱신 | `spec/5-system/1-auth.md §5` (AuthConfig CRUD cross-reference 문단) | `plan/in-progress/auth-config-webhook-followups.md §3` | target 머지 후 해당 체크박스를 완료 또는 "cross-reference 위임으로 해소됨" 주석으로 갱신 |
| 5 | Plan Coherence | `spec-sync-auth-gaps.md` pending_plans 참조가 target 변경과 무관하게 유지되어 진행 상황 추적 불명확 | `spec/5-system/1-auth.md` frontmatter | `plan/in-progress/spec-sync-auth-gaps.md` | target 머지 후 `auth-config-webhook-followups.md §3` 해소 항목을 plan에 반영해 정합성 유지 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `GET /api/audit-logs` 엔드포인트가 `data-flow/1-audit.md §2.1`과 중복처럼 보이나 의도적 분리(API 계약 vs 구현 흐름), 내용 일치 | `spec/5-system/1-auth.md §5` | 향후 변경 시 동시 갱신 관계임을 인지. 선택적으로 target §5 해당 행에 `(data-flow/1-audit.md §2.1 구현 흐름 참조)` 링크 추가 |
| 2 | Cross-Spec | 이메일 인증 토큰 유효 기간(24h)이 세 문서에 중복 기술 — 모순 없음 | `spec/5-system/1-auth.md §5`, `spec/1-data-model.md §2.1`, `spec/2-navigation/10-auth-flow.md §2.4` | 향후 값 변경 시 누락 방지를 위해 `data-model.md §2.1`을 SoT로 삼고 나머지는 참조 링크로 연결 권장 |
| 3 | Cross-Spec | 초대 Rate Limit(분당 10건)이 두 문서에 기술, 어느 쪽이 SoT인지 모호 — 모순 없음 | `spec/5-system/1-auth.md §1.5.1`, `spec/data-flow/12-workspace.md §1.2` | 실질 SoT는 코드(`INVITATION_THROTTLE`). 현재 상태 허용 범위 |
| 4 | Rationale Continuity | `execution.re_run` 동사 시제 예외(과거분사도 현재형도 아님)에 대한 Rationale 항목 미기술 | `spec/5-system/1-auth.md §4.1`, `§Rationale 4.1.A` | §Rationale에 `4.1.B` 항목으로 `execution.re_run`이 historical-artifact임을 명시, 또는 4.1.A 내 예외로 추가 |
| 5 | Rationale Continuity | `WEBAUTHN_ALLOW_FALLBACK=1`이 "운영 사용 금지"임에도 Production fail-closed throw 목록에서 제외된 이유 미기술 | `spec/5-system/1-auth.md §1.4.3`, `§Rationale Production fail-closed 가드` | fail-closed 가드 Rationale에 제외 사유 한 줄 명시 (예: "WebAuthn 비활성 시 인증 전면 우회가 아닌 기능 미제공 — 운영 보안 위협 등급 낮아 warn") 또는 throw 대상 추가 검토 |
| 6 | Convention Compliance | §5 API 표 응답 컬럼 표기 불일치 — 일부는 `{ data: { ... } }` 래퍼 포함, 일부는 생략 | `spec/5-system/1-auth.md §5` | 표기 통일(항상 `{ data: ... }` 래퍼 포함) 또는 관례 명시. 기능 오류 아님 |
| 7 | Convention Compliance | `## Overview` 명시적 섹션 헤딩 없이 바로 본문 진입 — CLAUDE.md "권장" 사항이나 강제 아님 | `spec/5-system/1-auth.md` 전체 구조 | `spec/5-system/` 영역의 일관된 패턴이므로 변경 불필요 |
| 8 | Naming Collision | `webauthn_failed` LoginHistory 이벤트 — 세 파일 모두 동일 의미로 일관 사용, 충돌 없음 | `spec/5-system/1-auth.md §4.3`, `spec/1-data-model.md`, `spec/data-flow/1-audit.md` | 유지 |
| 9 | Naming Collision | `login-history-pruner` BullMQ 큐명 — 5개 파일 동일 의미로 일관, 충돌 없음 | `spec/5-system/1-auth.md §Rationale 1.4.G` 외 4개 파일 | 유지 |
| 10 | Plan Coherence | `spec-audit-action-prose` worktree는 `spec/5-system/1-auth.md` 미접촉 — 충돌 없음 | — | 해당 없음 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `9-user-profile.md`의 재인증 경로·RBAC 매트릭스 참조 불완전. 직접 모순 없음 |
| Rationale Continuity | LOW | `execution.re_run` 시제 예외·`WEBAUTHN_ALLOW_FALLBACK` fail-closed 제외 근거 미기술. 기존 결정 번복 없음 |
| Convention Compliance | MEDIUM | `forbidden`/`rate_limited` lowercase 주석 누락(CRITICAL 격상), `pending_plans` 실존 검증 필요(WARNING) |
| Plan Coherence | CRITICAL | `pr4b-kb-embedding-retire` 활성 worktree가 §4.1 + Rationale 4.1.A를 반대 방향 편집 — merge 충돌 확정 |
| Naming Collision | NONE | 식별자 전 영역(frontmatter id, 엔티티, endpoint, env, 감사 액션, 에러 코드) 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 — Plan Coherence CRITICAL)** `pr4b-kb-embedding-retire` worktree의 `spec/5-system/1-auth.md §4.1 Planned 표` + `§Rationale 4.1.A` 변경 범위를 `spec-auth-hygiene` 담당자와 조율. 두 worktree 중 하나를 먼저 merge하고 나머지를 리베이스하는 직렬화 순서를 결정한 뒤 plan frontmatter에 명시.
2. **(BLOCK 해소 — Convention Compliance CRITICAL)** `spec/5-system/1-auth.md §1.5.4` blockquote에 `forbidden`·`rate_limited` (lowercase)의 historical-artifact 예외 근거를 명시. `error-codes.md §3` cross-reference 포함.
3. **(WARNING 해소)** `9-user-profile.md §6.1` 세션 강제 종료 API 설명에 WebAuthn / OAuth-only 이메일 OTP 재인증 경로 보완 및 `[인증 spec §2.3]` cross-reference 추가.
4. **(WARNING 해소)** `9-user-profile.md §4.2` 상단에 "전체 RBAC 매트릭스 SoT: [인증/인가 §3.2]" 주석 추가.
5. **(WARNING 해소)** `plan/in-progress/auth-config-webhook-followups.md`·`spec-sync-auth-gaps.md` 실존 및 완료 여부 확인. 완료된 항목은 plan 체크박스 갱신 후 complete 로 이동. 모든 pending_plans 완료 시 `status: partial → implemented` 승격.
6. **(WARNING 해소)** target merge 후 `auth-config-webhook-followups.md §3` reveal cross-reference 위임 해소 체크박스 갱신.
7. **(INFO 권장)** §Rationale에 `execution.re_run` historical-artifact 근거(`4.1.B`)와 `WEBAUTHN_ALLOW_FALLBACK` fail-closed 제외 이유 한 줄 추가.
8. **(INFO 권장)** stale worktree(`audit-sot-hygiene-8fc5f1`, `test-code-http-hardening-10aad3`) 정리: `./cleanup-worktree-all.sh --yes --force` 실행 권장.