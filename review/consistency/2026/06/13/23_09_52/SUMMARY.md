# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 모든 checker 에서 Critical 이 없으며, WARNING 1건·INFO 11건만 존재. 코드 동작·보안·빌드에 영향 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `workspace.transfer_ownership` verb 시제가 기존 도메인별 시제 규약(`auth_config` 현재형, `integration` 과거분사) 어느 카테고리에도 명시적으로 포함되지 않음 | `spec/5-system/1-auth.md §4.1` `AUDIT_ACTIONS` | `spec/conventions/` 내 감사 액션 명명 규약 전용 문서 없음 | `spec/conventions/audit-actions.md` 신규 생성 또는 `1-auth.md §4.1` 에 `workspace.*` 도메인 시제 예외를 명시적으로 추가 |

> 비고: WARNING #1 의 `workspace.transfer_ownership` 는 **본 변경이 도입한 액션이 아니며**(기존 구현), §4.1 점검 중 규약-카테고리 누락이 표면화된 것. 본 변경의 신규 액션(`user.*`)은 §4.1.A 에 시제 규약이 명시돼 있음. 규약 문서 보완은 planner 영역의 별도 follow-up.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `ip_address` nullable 표기 누락 — 코드·data-flow spec 은 optional 이나 data-model spec 표는 `String`(nullable 없음) | `spec/1-data-model.md §2.18` AuditLog 표 | `ip_address` 타입을 `String?` 로 정정 (문서 단독 수정, 기능 영향 없음) |
| 2 | Cross-Spec | `webauthn.controller` 참조 방식이 `1-auth.md §4.1` 주석과 `data-flow/1-audit.md §1.1` 표 사이에 상이 (모듈명 vs 파일경로) | `spec/5-system/1-auth.md §4.1` | 표기 통일 또는 교차 참조 명확화 (의미 모순 없음) |
| 3 | Cross-Spec | `9-user-profile.md §4.2` 화면 권한 매트릭스에 Audit Log 항목 없음 | `spec/2-navigation/9-user-profile.md §4.2` | "감사 로그 조회 — Admin+" 행 추가 검토 (scope 상이로 의무 아님) |
| 4 | Rationale Continuity | WebAuthn 추가 credential 등록도 `user.2fa_enabled` 기록한다는 명시 없음 | `spec/5-system/1-auth.md Rationale 4.1.B` | `details.firstCredential=false` 케이스를 Rationale 에 한 줄 추가 |
| 5 | Rationale Continuity | OAuth-only 사용자의 TOTP 비활성화 차단 시나리오 Rationale 미기록 | `spec/5-system/1-auth.md §1.4 / Rationale` | 한 줄 추가 |
| 6 | Convention Compliance | `1-auth.md` 에 명시적 `## Overview` 섹션 없음 | `spec/5-system/1-auth.md` 최상단 | 향후 개편 시 추가 권장 (강제 아님) |
| 7 | Convention Compliance | `11-mcp-client.md` 에 `## Rationale` 섹션 없음 | `spec/5-system/11-mcp-client.md` | 향후 리팩토링 시 이관 권장 |
| 8 | Convention Compliance | `10-graph-rag.md` `predicate` 설명 세 곳 중복 | `spec/5-system/10-graph-rag.md` | 교차 참조 추가 검토 |
| 9 | Convention Compliance | `10-graph-rag.md §Overview` 구현 상태 서술이 frontmatter `status` 와 중복 | `spec/5-system/10-graph-rag.md §Overview` | frontmatter 단일 SoT 유지 |
| 10 | Plan Coherence | `auth-config-webhook-followups.md §3` 잔여 spec 보완 미착수, 미할당 | `spec/5-system/1-auth.md §5` (비접촉) | 본 변경과 경합 없음 |
| 11 | Plan Coherence | stale worktree 3건 정리 미완 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | INFO 3건 — ip_address nullable 표기·webauthn 참조 표기·navigation 권한 매트릭스 |
| Rationale Continuity | NONE | 합의 원칙 7항목 전부 준수. INFO 2건(명시 권장) |
| Convention Compliance | LOW | WARNING 1건(workspace.* verb 시제 규약 카테고리 미포함, 기존 액션). INFO 4건 |
| Plan Coherence | NONE | active worktree 경합·결정 우회·중복 없음. INFO 2건 |
| Naming Collision | NONE | 신규 식별자 전 축 충돌 없음 |

## 권장 조치사항

1. (WARNING — planner follow-up) `1-auth.md §4.1` 에 `workspace.*` 시제 예외 명시 또는 `spec/conventions/audit-actions.md` 신규. 빌드 차단 없음.
2. (INFO — planner) `spec/1-data-model.md §2.18` AuditLog `ip_address` → `String?` 정정.
3. (INFO — planner) Rationale 4.1.B 에 WebAuthn 추가 credential `firstCredential=false`·OAuth-only TOTP 비활성 차단 보강.
4. (INFO — 운영) stale worktree 정리.
5. (INFO — 장기) 3섹션 구조 완전 적용.

---

검토 일시: 2026-06-13 23:09:52
diff-base: `fcd1d594`
검토 범위: `spec/5-system/` (구현 완료 후 검토 — `--impl-done`)
판정: **BLOCK: NO** (SPEC-CONSISTENCY 게이트 통과)
