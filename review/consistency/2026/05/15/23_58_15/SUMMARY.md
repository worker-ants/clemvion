# Consistency Check 통합 보고서 (재검토)

**BLOCK: NO** — Critical 발견 없음. 이전 세션(`23_50_03`)의 BLOCK: YES 해소됨.

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
세션: `review/consistency/2026/05/15/23_58_15`
재검토 사유: 1차 BLOCK 의 Critical 2건 해소를 위해 draft 를 6 파일로 확장 + Rationale 보강 후 재제출.

## 전체 위험도

**MEDIUM** — Critical 없음. WARNING 5건은 모두 "6 파일 원자 PR" 또는 개별 확인 사항으로 검토 후 단계에서 처리 가능.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | 해소 방법 |
|---|---------|------|----------|
| W-1 | Naming Collision | `GET /:id/graph/stats` 엔드포인트 spec 정의 확인 필요 | **확인 완료**: `spec/2-navigation/5-knowledge-base.md:175` + `spec/5-system/10-graph-rag.md:510` 양쪽 정의 존재. |
| W-2 | Cross-Spec | `data-flow/knowledge-base.md` 이벤트 목록 4개씩 → 6개씩 정합화 필요 | draft §6 가 갱신 대상. 6 파일 원자 PR 로 해소. |
| W-3 | Cross-Spec | `data-flow/knowledge-base.md:94` 의 `document:graph_extracted` 잔존 | draft §6 가 `document:graph_completed` 로 정정 명시. |
| W-4 | Cross-Spec | `5-knowledge-base.md §2.4.1` 의 `retry-failed scope` 가 `embedding\|graph` 만, `'all'` 누락 | draft §3 가 `'all'` 추가. |
| W-5 | Cross-Spec | `kb:graph_stats_updated` 제거 시 `10-graph-rag.md §6:527` 도 함께 제거되어야 — 원자성 미보장 시 CRITICAL 전환 | draft §5 가 line 527 삭제 + §2.3/§4.2 갱신 명시. PR 단계에서 `grep -r "kb:graph_stats_updated" spec/` 검증. |

## 참고 (INFO)

I-1 ~ I-17 (17건) — Rationale 완결성 보강, 마이그레이션 번호 검증, 옛 경로 참조 제거 이행 확인, parent plan frontmatter 갱신, dead-path 후속 plan 종속 명시 등. 모두 검토 후 단계에서 처리 가능.

**개별 확인 완료**:
- **I-12** (Plan Coherence): `cafe24-data-model-strengthen.md` 는 `spec/1-data-model.md §2.10/§3` 만 건드림. 본 draft 는 §2.12.1 — **충돌 영역 아님, 직렬화 불필요**.
- **I-15** (Naming Collision): `grep -r "graph_extracted" spec/` → `data-flow/knowledge-base.md:94` 한 곳. draft §6 가 갱신 대상으로 이미 포함.
- **I-17** (Naming Collision): `ls backend/migrations` → V022·V023·V030·V031·V032 존재. **V033 은 미존재** → draft 의 `V030~V033` 표기를 `V030~V032` 로 수정 필요.

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|-----|
| Cross-Spec | MEDIUM | WARNING 4건 — draft 가 해소하는 대상. 6 파일 원자 PR 이 안전 조건. |
| Rationale Continuity | LOW | INFO 4건 — Rationale 보강 제안. |
| Convention Compliance | LOW | INFO 3건 — 옛 경로 참조 제거 이행 확인. |
| Plan Coherence | LOW | INFO 3건 — parent plan frontmatter, dead-path 후속 plan 종속, cafe24 직렬화 확인 (이미 해소). |
| Naming Collision | LOW | WARNING 1건 해소 + INFO 6건. |

## 권장 조치사항

1. **[PR 단계 필수]** 6개 spec 파일을 단일 원자적 PR 로 묶어 적용. PR checklist 에 `10-graph-rag.md §6:527 삭제`, `data-flow/knowledge-base.md:94 graph_extracted → graph_completed`, `5-knowledge-base.md §2.4.1 scope:'all' 추가` 를 명시.
2. **[I-17]** draft 의 마이그레이션 번호를 `V030~V033` → `V030~V032` 로 수정 (V033 미존재 검증).
3. **[I-10]** `plan/in-progress/spec-update-embedding-pipeline-consistency.md` frontmatter 의 `worktree` 필드를 `spec-pipeline-consistency-4c9e1f` 로 갱신.
4. **[I-4, I-6, I-7]** spec 본문 반영 시 Rationale 완결성 보강 — 본 draft 의 "Rationale 보강" 절 그대로 이행.
5. **[후속]** spec 반영 완료 후 `plan/in-progress/kb-graph-stats-dead-path.md` 신규 plan 생성하여 backend `kb-stats.helper.ts:42-46` dead path 처리를 dev 에 위임.

## BLOCK 해소 판정

이전 세션 BLOCK: YES 의 Critical 2건이 이번 재검토에서 Critical 등급으로 발견되지 않았다. draft 를 6 파일 + Rationale 보강 + dead path 후속 plan 분리로 확장한 결과, 구조적 결함이 해소되었다. 현재 WARNING 5건은 모두 PR 원자성 또는 개별 확인 사항으로 spec 본문 반영 시 자동 해소된다.
