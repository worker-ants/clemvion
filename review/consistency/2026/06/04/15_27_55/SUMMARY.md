# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

검토 대상: `spec/5-system/4-execution-engine.md` (PR2a — §8 active-running 누적 타임아웃)
검토 모드: `--impl-done`, diff-base=`origin/main`
검토일: 2026-06-04

---

## 전체 위험도

**CRITICAL** — Flyway 마이그레이션 V073 번호가 active OPEN PR 과 충돌하며, 두 브랜치가 모두 main 에 머지되면 Flyway 가 오류를 일으킨다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | Flyway 마이그레이션 버전 번호 V073 이중 사용 — 두 브랜치 동시 머지 시 `FlywayException: Found more than one migration with version 073` | `codebase/backend/migrations/V073__execution_active_running_ms.sql` | OPEN PR #459 `claude/ai-context-memory-9c7e6e`: `V073__agent_memory_hnsw_384.{sql,conf}` (V072–V078 점유). (워크플로 SUMMARY 는 #462 로 적었으나 #462 는 실제 V079 — 충돌 아님; 실 충돌은 #459) | migrations.md §6 머지 race 안전망: 나중 머지 브랜치가 재부여. **현 시점 V073 은 origin/main(max V072)+1 로 convention·CI(`check-migration-versions.py --base origin/main`) 모두 통과.** 머지 순서 결정 후 후발 브랜치가 rebase 시 재부여. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 제안 | 처리 |
|---|---------|------|-------------|------|------|
| 1 | Cross-Spec | `spec/5-system/3-error-handling.md:60` 의 §8 앵커가 헤더 변경 후 죽은 링크 | `3-error-handling.md:60` (`#8-동시-실행-제한-미구현--planned`) | `#8-동시-실행-제한-부분-구현` 으로 수정 | FIXED |
| 2 | Convention Compliance | `.env.example` 주석에 마크다운 볼드(`**active-running**`) | `codebase/backend/.env.example` | 볼드 제거 | FIXED |
| 3 | Plan Coherence | `spec/0-overview.md`, `spec/1-data-model.md` 를 두 브랜치가 동시 수정 — hunk 인접 시 머지 충돌 위험 | `spec/0-overview.md`, `spec/1-data-model.md` | 머지 완료 후 base 최신화 + re-resolve | 머지 race (C-1 과 동일 사유, merge-time) |
| 4 | Plan Coherence | `plan/in-progress/spec-update-pr2a-timeout.md` 의 spec 갱신 항목들이 이미 구현됨 — plan 상태 불일치 | `spec-update-pr2a-timeout.md` W1/W2/W3/W8/W9 | "반영 완료" 로 갱신 | FIXED |
| 5 | Plan Coherence | `exec-intake-queue-impl.md` "PR2 이관" 항목(system-status MONITORED_QUEUES + e2e)이 이미 구현됨 | `exec-intake-queue-impl.md` PR2 이관 섹션 | 체크박스 `[x]` 플립 | FIXED |

---

## 참고 (INFO)

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| 1 | Cross-Spec | `spec/1-data-model.md:455` 의 §8 앵커도 구 이름 | FIXED (W1 과 함께) |
| 2 | Cross-Spec | 2단계 per-workflow 설정 도입 시 `1-data-model.md §2.4` settings 키 동기화 필요 | PR2b 후속 |
| 3 | Cross-Spec | `execution-run` 이 큐 카탈로그/레지스트리에 이미 등재 — 충돌 없음 확인 | 조치 불요 (이전 Critical 해소 확인) |
| 4 | Rationale Continuity | active-running 기준·EXECUTION_TIMEOUT 분리·2단계 설정·항상 enqueue — 모두 Rationale 정합 | 조치 불요 |
| 5 | Rationale Continuity | `applyContinuation()` JSDoc "publisher 측 BullMQ 우회 없음" 명시 권장 | 선택 |
| 6 | Rationale Continuity | `V073` SQL 주석에 `0=무제한` int4 동작 미기술 | 선택 |
| 7–9 | Convention Compliance | frontmatter `status: partial`/`code:` glob/`user_guide:` — 모두 규약 준수, user_guide 선택 | 조치 불요 |
| 10 | Naming Collision | `EXECUTION_TIME_LIMIT_EXCEEDED` vs `EXECUTION_TIMEOUT` 의미 분리 명시 — 충돌 없음 | 조치 불요 |
| 11 | Naming Collision | `V073.conf` 부재 — 단순 ADD COLUMN 은 트랜잭션 기본 모드라 `.conf` 불요 | 조치 불요 |
| 12 | Plan Coherence | `execution-engine-residual-gaps.md` G2 장애물 3 — PR3 착수 시 재점검 | PR3 후속 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §8 앵커 죽은 링크(WARNING 1); spec↔구현 직접 충돌 없음 |
| Rationale Continuity | NONE | 모든 Rationale 결정과 정합; INFO 4건 |
| Convention Compliance | LOW | `.env.example` 볼드(WARNING 1); 에러코드·마이그레이션 명명·frontmatter 모두 준수 |
| Plan Coherence | CRITICAL | V073 번호 충돌(CRITICAL 1) + spec/plan 상태 불일치 WARNING 3 |
| Naming Collision | NONE | 신규 식별자 충돌 없음; INFO 5건 |

---

## 권장 조치사항

1. **(C-1 머지 race)** `V073` 은 현 origin/main 기준 convention·CI 통과 상태. 머지 순서 합의 후 후발 브랜치(본 PR vs #459)가 rebase 시점에 번호 재부여 (migrations.md §5/§6). 선제 renumber(V080 등)는 gap 금지·`outOfOrder=false` 위반이라 금지.
2. **(W1/INFO1)** `3-error-handling.md:60` + `1-data-model.md:455` §8 앵커 `#8-동시-실행-제한-미구현--planned` → `#8-동시-실행-제한-부분-구현`. → FIXED
3. **(W2)** `.env.example` `**active-running**` → `active-running`. → FIXED
4. **(W4/W5)** `spec-update-pr2a-timeout.md` 반영완료 갱신 + `exec-intake-queue-impl.md` 체크박스 `[x]` 플립. → FIXED
