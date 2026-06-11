# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

## 전체 위험도
**LOW** — 동일 위배가 두 checker(Cross-Spec, Convention Compliance)에서 공통 지적된 WARNING 2건, 독립 WARNING 1건 추가. Critical 0건.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec + Convention Compliance (통합) | `password_change`, `2fa_enable/disable` — `<resource>.<verb>` dot-prefix 규약 미준수. 슬래시 압축 표기로 `AUDIT_ACTIONS` 리터럴 불명확 | `spec/5-system/1-auth.md §4.1` Planned 표 (인증 행) | 동 파일 §4.1 "Action naming 규약: `<resource>.<verb>` 필수" + `spec/data-flow/1-audit.md §1.1` 커버리지 갭 설명 | `user.password_change`, `user.2fa_enable`, `user.2fa_disable` (또는 `auth.*` 체계)로 확정 변경. `spec/data-flow/1-audit.md §1.1` 동기화. 슬래시 표기 분리 필수 |
| W-2 | Plan Coherence | plan 파일 미커밋 수정본(`status: in-progress`, `worktree: claude/auth-config-audit`)과 HEAD(`status: backlog`, `worktree: unstarted`) 불일치 | `plan/in-progress/auth-config-webhook-followups.md` (unstaged modified) | HEAD 공식 plan 기록 | 수정본을 커밋해 착수 선언 공식화하거나 새 브랜치/worktree 에서 착수 커밋 생성. 현 worktree 브랜치(`claude/audit-coverage-naming`)는 PR #543 squash-merge 완료 → 새 브랜치 권장 |
| W-3 | Naming Collision | `document:graph_error` 이벤트 — `10-graph-rag.md` + `data-flow/6-knowledge-base.md` 에서 "dead-declared, 미emit" 처리이나, `6-websocket-protocol.md` 723행 + `2-navigation/5-knowledge-base.md` 182행은 emit 가능 이벤트로 열거 | `spec/5-system/6-websocket-protocol.md` 723행 + `spec/2-navigation/5-knowledge-base.md` 182행 | `spec/5-system/10-graph-rag.md §6`, `spec/data-flow/6-knowledge-base.md` | 두 파일에서 `_error` 항목을 제거하거나 `(dead-declared, 미emit)` 주석 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `POST /auth/resend-verification` — `/api` prefix 누락 | `spec/5-system/1-auth.md §1.1` 인라인 경로 표 | `POST /api/auth/resend-verification` 으로 통일 |
| I-2 | Rationale Continuity | 프론트엔드 `limit: 9999` — API 규약 §4.1 상한(100) 초과. 서버 ValidationPipe `@Max(100)` 가 강제되면 런타임 400 가능 | `codebase/frontend/src/lib/api/model-configs.ts` | `limit: 100` 으로 되돌리거나 서버 상한 규약 갱신 + spec §4.1 동시 업데이트 (갱신 시 Rationale 필요) |
| I-3 | Convention Compliance | `1-auth.md` — `## Overview` 섹션 미선언 (3섹션 구조 미충족) | `spec/5-system/1-auth.md` | 모두에 간략한 `## Overview` 블록 추가 |
| I-4 | Convention Compliance | `11-mcp-client.md` — `## Overview` + `## Rationale` 섹션 모두 미선언 | `spec/5-system/11-mcp-client.md` | `## Overview` + `## Rationale` 섹션 추가 (transport 선택·Internal Bridge 설계 근거 등 집약) |
| I-5 | Convention Compliance | `cafe24-api-catalog/_overview.md` — basename 이 `_product-overview.md` 컨벤션과 상이 | `spec/conventions/cafe24-api-catalog/_overview.md` | 카탈로그 내부 보조 문서로 허용 범위 내. CLAUDE.md 에 보조 문서 예외 주석 보강 선택 가능 |
| I-6 | Plan Coherence | `auth-config-webhook-followups.md §1` 선결 조건(AUDIT_ACTIONS 상수 파일 마련) — PR #543 으로 이미 해소 | `plan/in-progress/auth-config-webhook-followups.md §1` | "선결 완료" 로 체크. `AUTH_CONFIG_CREATE` 등 4종 상수 append 만 잔여 |
| I-7 | Plan Coherence | `spec/5-system/1-auth.md §4.1` Planned 항목(`auth_config.create/update/delete/regenerate`)과 구현 의도 정합. 3단계(상수 추가 → `record()` 삽입 → Planned→구현됨 이동) 명확 | `spec/5-system/1-auth.md §4.1` | 추적 메모. 블록 사유 없음 |
| I-8 | Naming Collision | `KB-GR-*` / `NF-GR-*` 요구사항 ID — 다른 spec 에서 동일 prefix 없음 | `spec/5-system/10-graph-rag.md` | 충돌 없음 확인 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 1건(audit action dot-prefix 미준수) + INFO 1건(경로 표기 불일치) |
| Rationale Continuity | NONE | 모든 Rationale 연속성 이상 없음. INFO 1건(limit:9999 spec-impl 갭) |
| Convention Compliance | LOW | WARNING 1건(동 Cross-Spec 와 동일 audit action) + INFO 3건(섹션 구조·파일명) |
| Plan Coherence | LOW | WARNING 1건(plan 미커밋 불일치) + INFO 2건(선결 완료·구현 3단계 명확) |
| Naming Collision | LOW | WARNING 1건(document:graph_error 처리 불일치) + INFO 다수(충돌 없음 확인) |

---

## 권장 조치사항

1. **(W-1 해소 — 구현 착수 전 권장)** `spec/5-system/1-auth.md §4.1` Planned 표의 `password_change`, `2fa_enable/disable` 를 `user.password_change`, `user.2fa_enable`, `user.2fa_disable` 로 확정 변경. `spec/data-flow/1-audit.md §1.1` 동기화.
2. **(W-2 해소 — 착수 선언 공식화)** `plan/in-progress/auth-config-webhook-followups.md` 미커밋 수정본을 커밋하거나, 새 브랜치(`claude/auth-config-audit` 등)에서 착수 선언 커밋 생성. 현 worktree 브랜치는 PR #543 squash-merge 완료(stale) 이므로 새 브랜치 권장.
3. **(W-3 해소 — 구현 전 스펙 정합)** `spec/5-system/6-websocket-protocol.md` 723행 + `spec/2-navigation/5-knowledge-base.md` 182행의 `document:graph_error` 항목 제거 또는 `(dead-declared, 미emit)` 주석 추가.
4. **(I-2 — 런타임 에러 예방)** `codebase/frontend/src/lib/api/model-configs.ts` 의 `limit: 9999` → `limit: 100` 으로 복원하거나 서버 상한 규약·spec 동시 갱신.
5. **(I-1)** `spec/5-system/1-auth.md §1.1` 경로 표기 `/api` prefix 통일 (low-effort, 단독 커밋 가능).
6. **(I-3/I-4 — 선택)** `1-auth.md` `## Overview` + `11-mcp-client.md` `## Overview`/`## Rationale` 섹션 추가 (3섹션 구조 준수).