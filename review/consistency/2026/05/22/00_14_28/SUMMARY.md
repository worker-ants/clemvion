# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

세션: `review/consistency/2026/05/22/00_14_28`
모드: `--spec spec/0-overview.md` (단일 진입점이나 본 PR 은 spec/0-overview.md · spec/1-data-model.md · spec/4-nodes/_product-overview.md · 6개 cross-ref spec · CLAUDE.md 까지 묶음)
대상 변경: spec-overview-followups-bundle worktree 의 4개 follow-up (§1 Filter enum · §2 Cafe24 §6.1 이동 · §3 Rationale 섹션 신설 · §4 CLAUDE.md 루트 spec 항목)

---

## 전체 위험도

**MEDIUM** — Flyway undo 스크립트 식별자의 구현·규약 괴리, plan 체크박스-문서 상태 불일치, worktree 간 텍스트 경합이 복수 존재하나 전부 수정 가능한 수준. Critical 없음.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | 위치 | 충돌 대상 | 본 PR 처리 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale / Naming (공통) | §6.3 "Internal MCP Bridge 패턴 확장" 행이 Cafe24 완료 위치로 §6.2 를 참조 — Rationale 결정(§6.1 이동)과 직접 모순 | `spec/0-overview.md:101` | 동일 파일 §6.1 (line 82), Rationale "Cafe24 통합을 §6.1" 항 | **즉시 fix** — `§6.2` → `§6.1` 로 수정 |
| W-2 | Naming Collision | §2.8 "롤백 지원" 행이 `U{version}__{description}.sql` undo 스크립트 정의 — Flyway Community 미지원, 실제 codebase 에 U*.sql 없음 | `spec/0-overview.md §2.8` (line 290) | `spec/conventions/migrations.md` (append-only), `codebase/backend/migrations/` (U*.sql 부재) | **본 PR 범위 밖** — 별도 follow-up plan 으로 추적 (§2.8 전체 재작성 필요) |
| W-3 | Plan Coherence | `spec-overview-followups-2026-05-18.md §2` 체크박스가 미완료이나 target 은 안(A) 반영 완료 | plan §2 | spec/0-overview.md §6.1 | **fix** — 본 PR 의 plan 갱신에서 [x] 처리 |
| W-4 | Plan Coherence | plan §3 체크박스 미완료이나 Rationale 섹션 이미 존재 | plan §3 | spec/0-overview.md ## Rationale | **fix** — 본 PR 의 plan 갱신에서 [x] 처리 |
| W-5 | Plan Coherence | `spec-followup-cron-7d-statemachine §A-3` 이 동일 Cafe24 행 텍스트 경합 | `plan/in-progress/spec-followup-cron-7d-statemachine.md §A-3` | spec/0-overview.md §6.1 Cafe24 행 | **PR 본문 명시** — `spec-followup-cron-7d-statemachine` PR 이 본 PR 머지 후 리베이스해야 함 (자동 충돌 가능성 낮음 — 이동된 §6.1 행에 추가 텍스트 append) |
| W-6 | Plan Coherence | plan §4 CLAUDE.md 갱신이 target §8 변경 내용과 교차 확인 필요 | plan §4 | spec/0-overview.md §8 문서 컨벤션 | **본 PR 에서 동시 처리** — CLAUDE.md 행 추가 + §8 문서 컨벤션 bullet 동시 갱신, 정합 |
| W-7 | Convention Compliance | 루트 레벨 파일 naming convention 이 §8 에만 기술, CLAUDE.md 미반영 — 단일 진실 위반 | spec/0-overview.md §8 | CLAUDE.md §명명 컨벤션 | **본 PR §4 작업으로 해소** — CLAUDE.md 표에 루트 레벨 행 추가 |
| W-8 | Cross-Spec | §6.1 "노드 시스템" 행이 Parallel 을 완료에 포함하지만 §6.2 가 Parallel 노드(P1) 를 별도로 부분 구현 분류 — 이중 표현 | spec/0-overview.md §6.1, §6.2 | spec/4-nodes/_product-overview.md §4.10 Parallel | **본 PR 범위 밖** — Parallel 분류 정리는 별도 follow-up (사전 plan §2 의 "§6 구조 변화 없음" 원칙 유지) |

---

## 참고 (INFO)

| # | Checker | 항목 | 본 PR 처리 |
|---|---------|------|------|
| I-1 | Cross-Spec | §6.1 Integration 목록 "(HTTP·Database·Send Email)" — Cafe24 누락 | follow-up |
| I-2 | Cross-Spec | §8 data-flow 범위 "1-audit ~ 12-workspace" — `0-overview.md` 누락 | follow-up |
| I-3 | Cross-Spec | §6.1 Cafe24 행 PR 번호 stale 위험 | 즉각 수정 불필요 |
| I-4 | Convention | §3.4 Inline Alert 위치 이유를 본문→Rationale 로 이전 — 3섹션 원칙 부합 | 변경 불필요 |
| I-5 | Convention | §8 문서 컨벤션 bullet 순서 (루트 레벨이 `_product-overview.md` 뒤) | 선택 사항, 변경 없음 |
| I-6 | Convention | §8 data-flow 가 §4 표에 없음 | 필수 아님 |
| I-7 | Convention | Rationale 항목에 날짜/PR 번호 없음 | 규약 의무 아님, 선택 |
| I-8 | Plan | `cafe24-bg-refresh-tuning` 후속 절에 spec 갱신 메모 누락 | follow-up |
| I-9 | Plan | `0-unimplemented-overview.md` plan 목록 stale | 머지 후 chore commit |
| I-10 | Naming | `flyway-{env}.conf` 환경별 설정 파일명 미존재 | W-2 와 묶어 follow-up |
| I-11 | Naming | `S3_BUCKET` 기본값 `workflow-storage` 가 `spec/data-flow/4-file-storage.md` 에 미반영 | follow-up |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §6.3 Cafe24 stale 참조 + §6.1 Parallel 이중 분류 |
| Rationale Continuity | LOW | §6.3 Cafe24 참조가 Rationale 결정과 모순 (= W-1) |
| Convention Compliance | LOW | 루트 레벨 naming convention CLAUDE.md 미반영 (= W-7) |
| Plan Coherence | MEDIUM | plan 체크박스 stale + worktree 텍스트 경합 |
| Naming Collision | MEDIUM | Flyway U__ undo (OSS 미지원) + flyway-{env}.conf 미정의 |

---

## 본 PR 의 결론

- **BLOCK: NO** — 즉시 차단 필요 사항 없음.
- W-1 (Cafe24 §6.2 → §6.1 stale ref): 본 PR 내에서 즉시 fix.
- W-3/W-4/W-6/W-7: 본 PR 작업 또는 plan 갱신으로 이미 해소.
- W-2/W-8 + I-1·I-2·I-8·I-10·I-11: 본 PR scope 밖. 별도 follow-up plan 으로 추적 권고.
- W-5: `spec-followup-cron-7d-statemachine` PR 이 본 PR 머지 후 리베이스 — PR 본문에 머지 순서 명시.
