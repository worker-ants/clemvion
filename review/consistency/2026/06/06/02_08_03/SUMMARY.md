# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

- 검토 대상: `plan/in-progress/rag-eval-harness.md` (RAG 평가 하베스 P0 Phase 0+1)
- 검토 모드: `--impl-prep`
- 검토 일시: 2026-06-06
- 5 checker 전부 완료 (rationale_continuity·plan_coherence 는 1차 workflow 에서 output 누락 → main 이 재실행해 보강).

---

## 전체 위험도

**LOW~MEDIUM** — Critical 위배 없음. WARNING 5건(plan frontmatter 형식 2 + plan coherence 3) 은 모두 비차단·후속 조치 권고 수준.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | 제안 | 상태 |
|---|---------|------|------|------|
| 1 | Convention Compliance | plan frontmatter 비표준 키 `spec_refs` (`plan-lifecycle §4` 정의 밖) | 본문 `## 참조 spec` 섹션으로 이동 | **해소함** (frontmatter→본문) |
| 2 | Convention Compliance | 신규 `spec/conventions/rag-evaluation.md` frontmatter(`id/status/code`) 가이드 미안내 | Phase B 에 frontmatter 1줄 가이드 추가 | **해소함** (plan §2 Phase B 갱신) |
| 3 | Plan Coherence | `rag-quality-improvement.md §P0` 미완 항목과 범위 중복 — 체크박스 상태 불일치 가능 | 본 plan 이 P0 의 **부분집합(자동합성 골든셋 + 순수-TS 검색지표)** 임을 명시, 완료 시 상위 P0 체크리스트 분리 갱신 | **해소함** (plan §0 명시) |
| 4 | Plan Coherence | 미결 결정 "평가셋 규모·합성 비율" 일방 확정 위험 | 사용자 확인 포인트로 유지 | 이미 plan §4 에 flag |
| 5 | Plan Coherence | `rag-rerank-followup.md` conditional escalate 의존 연결 미명시 | 본 하베스가 escalate 임계 튜닝의 선행조건임을 OUT 블록에 명시 | 이미 plan §0 OUT 에 기재 |

---

## 참고 (INFO 주요)

- Cross-Spec: 기존 spec 계약 미변경(신규 isolated eval 레이어). `9-rag-search.md pending_plans` 등재·`0-overview §4` 문서맵 링크는 Phase B(project-planner) 판단.
- Rationale Continuity: 기각 대안 재도입·invariant 위반 없음(NONE). `chunkId` 결정성·PII·절대점수금지 원칙은 Phase B spec 에 기록 예정(미착수 정상).
- Naming Collision: 신규 식별자(`GoldenEntry`/`GoldenSet`/`EvalReport`, eval npm scripts, 파일경로) 충돌 없음. `D-E1~D-E6` vs 상위 `D1~D7` 구분됨.

---

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | NONE | 기존 spec 모순 없음. INFO 4건 |
| Rationale Continuity | NONE | 기각대안 재도입 없음. INFO 6건 |
| Convention Compliance | LOW | WARNING 2(frontmatter) → 해소 |
| Plan Coherence | MEDIUM | WARNING 3 → 비차단, plan 갱신으로 해소/flag |
| Naming Collision | NONE | 충돌 없음 |

---

## 결론

**구현 착수 허용.** WARNING 은 plan 갱신으로 해소했거나 사용자 확인 포인트로 유지. Phase B(spec) 착수 시 `9-rag-search.md pending_plans` 등재·`rag-evaluation.md` Rationale 섹션·상위 P0 체크리스트 분리 갱신 수행.
