# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견이 없으므로 차단 불필요

## 전체 위험도
**LOW** — 모든 발견사항이 INFO 수준. 직접적인 모순·차단 사유 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 변경 4 응답 shape 변경(`{ success: true }` → `{ accessToken }`)이 `9-user-profile.md §2.0/§2.2` 성공 흐름 서술에 미반영 | `spec/2-navigation/9-user-profile.md §2.0, §2.2` | draft 에 변경 4-bis 로 "응답 accessToken 으로 auth-store 갱신 후 `/profile` 리다이렉트" 한 줄 추가 권장 |
| 2 | Cross-Spec | Rationale §2.3.C 에 IP 추출 서술이 기존 §2.3.B 와 부분 중복 | `spec/5-system/1-auth.md Rationale §2.3.C` | IP 추출 직접 서술 대신 "IP 추출은 §2.3.B/Rationale 2.3.B 기준" 참조 한 줄로 대체 |
| 3 | Cross-Spec | user.* 5개 행에 ipAddress 추가 시 "비고" 열 형식 명시 필요 | `spec/data-flow/1-audit.md §1.1` caller 표 | auth_config 행 형식을 참고해 일관되게 적용 |
| 4 | Rationale Continuity | `session_revoked` enum 값이 기존 그대로(신설 없음)라 DB CHECK 제약·마이그레이션 불요임을 draft 가 명시하지 않음 | draft §A-1 변경 2 비고 또는 Rationale §A-1 | "enum 값(`session_revoked`)은 기존 그대로 — DB CHECK 제약 및 마이그레이션 불요" 한 줄 추가 |
| 5 | Rationale Continuity | auth_config 계열 ipAddress 동반의 원초적 Rationale(포렌식 목적)가 이 draft 에서도 선언되지 않음 | draft Rationale B-1 항 | "auth_config 계열의 ipAddress 동반은 포렌식·사후 감사 목적으로 도입됐으며(data-flow §1.1 기존 서술), user.* 확장도 동일 근거" 한 줄 추가 |
| 6 | Convention Compliance | frontmatter `status: in-progress` 필드가 plan-lifecycle §4 비표준 확장 | `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md` frontmatter | 현 상태 유지 가능. 필요 시 plan-lifecycle 규약에 표준 허용 필드로 등재 고려 |
| 7 | Plan Coherence | `spec-draft-unified-model-management.md` 가 이미 완료된 PR(#541·#545 MERGED)에도 `in-progress/` 에 잔류 | `plan/in-progress/spec-draft-unified-model-management.md` | `plan/complete/` 또는 `plan/complete/archive/` 로 이동 (본 작업 차단 불요) |
| 8 | Plan Coherence | `auth-config-webhook-followups.md` 의 worktree·branch stale (PR #547 MERGED) | `plan/in-progress/auth-config-webhook-followups.md` | `./cleanup-worktree-all.sh --yes --force` 실행 권장. 잔여 §2~4 항목 필요 시 새 worktree 재기동 |
| 9 | Naming Collision | (충돌 없음 — 6개 관점 전수 검토 결과) | — | 현행 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | INFO 4건: 응답 shape 서술 누락·§2.3.C 중복·user.* 비고 열 형식·session_revoked 의미 동기화 |
| Rationale Continuity | NONE | INFO 2건: DB CHECK 마이그레이션 불요 미명시·ipAddress 포렌식 근거 미선언 |
| Convention Compliance | NONE | INFO 3건: frontmatter status 필드(허용 범주)·3섹션 구조(plan 문서 비대상)·data-flow frontmatter 면제 |
| Plan Coherence | NONE | INFO 2건: stale worktree 잔류 plan 2건(작업 차단 없음) |
| Naming Collision | NONE | 충돌 0건 — 요구사항 ID·타입명·endpoint·이벤트명·ENV var·파일 경로 전수 이상 없음 |

## 권장 조치사항

1. **(BLOCK 해소 우선)** 없음 — BLOCK 사유 없음.
2. **(spec 완전성 향상 — 선택적)** draft 에 변경 4-bis 추가: `spec/2-navigation/9-user-profile.md §2.0` 비밀번호 변경 성공 흐름에 "응답 accessToken 으로 auth-store 갱신 후 `/profile` 리다이렉트" 명기.
3. **(spec 간소화 — 선택적)** Rationale §2.3.C 에서 IP 추출 직접 서술 제거 후 "§2.3.B 기준" 참조 한 줄로 대체.
4. **(draft 명확화 — 선택적)** 변경 2 비고에 "session_revoked enum 재사용 — DB CHECK 제약·마이그레이션 불요" 한 줄 추가.
5. **(draft 명확화 — 선택적)** Rationale B-1 에 ipAddress 동반의 포렌식 목적 근거 한 줄 추가.
6. **(housekeeping — 별도 작업)** stale plan 2건(`spec-draft-unified-model-management.md`, `auth-config-webhook-followups.md`) `plan/complete/` 이동 및 `./cleanup-worktree-all.sh --yes --force` 실행.

---

검토 일시: 2026-06-13
검토 모드: `--spec` (spec draft)
Target: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`
