# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 해당 없음.

## 전체 위험도
**LOW** — 규약 직접 위반·spec 간 모순 없음. WARNING 2건(Rationale 미기록·plan 섹션 미폐쇄)은 spec 변경 자체를 차단하지 않으나 후속 보완 권장.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Rationale Continuity | G-2 "현행 유지" 결정 번복 근거가 spec `## Rationale` 에 미반영 — CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 규약 미충족 | `spec/conventions/cafe24-api-catalog/_overview.md` (Rationale 섹션 부재) | `plan/in-progress/cafe24-backlog-residual.md` §G-2 (2026-06-02 "현행 유지"), §G-3l (2026-06-27 제거 결정) | `_overview.md` 에 `## Rationale` 섹션을 추가하고 (a) G-2 번복 근거(HTML authoritative 확정·비동작 404·사용자 결정 2026-06-27), (b) 미문서화 seed vs `deprecated` 경로 구분, (c) 향후 제거 절차 참조를 기록 |
| W-2 | Plan Coherence | `plan/in-progress/cafe24-backlog-residual.md` §G-2 섹션이 미폐쇄 — G-3l(2026-06-27) 완료로 9 ops 전부 제거됐으나 §G-2 는 여전히 "후속 조치 대기" 상태로 기술됨 | `plan/in-progress/cafe24-backlog-residual.md` §G-2 | 동일 파일 §G-3l (체크박스 [x] 완료) | §G-2 섹션 상단에 "✅ G-3l(2026-06-27)에서 9 ops 전부 제거 결정 및 완료 — 본 항목 해소됨" 주석 추가 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | "~180 endpoint" 근사치 4곳이 실제 지원 수(485)와 3배 차이 — pre-existing | `spec/4-nodes/4-integration/4-cafe24.md` §Overview·§Rationale, `spec/4-nodes/3-ai/0-common.md` line 65, `spec/2-navigation/4-integration.md` line 1106 | 별도 spec 수정 PR에서 "~180" → "~500" 또는 "485+" 로 일괄 동기 (`_overview.md §5` 주석 "endpoint 합계는 ~500" 과 통일) |
| I-2 | Convention Compliance + Rationale Continuity | `_overview.md` §6에 endpoint 제거 절차가 정의되어 있지 않음 (신규 등재 절차만 존재) | `spec/conventions/cafe24-api-catalog/_overview.md` §6 | §6 에 "endpoint 제거 절차" 소절 추가 |
| I-3 | Rationale Continuity | `_overview.md` §3 `deprecated` 경로와 "미문서화 seed outright 제거" 경로의 구별이 spec 내 미명시 | `spec/conventions/cafe24-api-catalog/_overview.md` §3 (status enum) | `## Rationale` 에 outright 제거 vs deprecated 구분 명시 |
| I-4 | Cross-Spec + Plan Coherence | plan §G-1-remaining의 "store 106" 수치 stale (제거 후 실제 105); G-3 이력 블록·G-3m 문구 stale | `plan/in-progress/cafe24-backlog-residual.md` §G-1-remaining, G-3 이력 블록, §G-3m | stale 수치/문구 보강 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | "~180" 근사치 4곳 stale(pre-existing INFO), plan §G-2 이력 불일치(INFO), §G-1-remaining 수치 stale(INFO) |
| Rationale Continuity | LOW | G-2 번복 Rationale 미반영(WARNING), deprecated vs outright 제거 경로 미명시(INFO), 제거 절차 미정의(INFO) |
| Convention Compliance | NONE | `_overview.md` `## Rationale` 부재(INFO, pre-existing·_ prefix 면제), 제거 절차 미정의(INFO) — 규약 직접 위반 없음 |
| Plan Coherence | LOW | §G-2 미폐쇄(WARNING), G-3 이력 노트 stale(INFO) — spec 차단 이슈 없음 |
| Naming Collision | success | 식별자 충돌 없음 (제거 작업이라 신규 충돌 불가) |

---

## 권장 조치사항

1. **(W-1 해소)** `_overview.md` 에 `## Rationale` 섹션 추가: G-2 번복 근거·미문서화 seed 제거 경로 정의·endpoint 제거 절차 기록.
2. **(W-2 해소)** plan §G-2 상단에 "✅ G-3l(2026-06-27) 완료 — 본 항목 해소됨" 주석 추가.
3. **(I-4)** plan §G-1-remaining "store 106" → "store 105"; G-3 이력 블록·§G-3m stale 문구 보강.
4. **(I-1 별도 트랙)** "~180" 근사치 4개 파일 동기 — pre-existing, 별도 spec PR.
