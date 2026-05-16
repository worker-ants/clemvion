# Consistency Check 통합 보고서 (impl-prep)

**Mode**: `--impl-prep spec/2-navigation/4-integration.md`
**Target**: 구현 착수 전 검토 — 통합 페이지 Attention 필터 신설
**BLOCK: NO** — Critical 발견 없음. WARNING 7건 해소 또는 수용 결정 후 구현 착수 권장.

## 전체 위험도
**MEDIUM** — spec 갱신 선행 미완료 상태에서 구현이 착수될 경우 spec-코드 불일치 구간 발생, 동일 spec 파일을 손대는 다수 활성 plan 과의 section-level 충돌 위험.

## Critical 위배 (BLOCK 사유)
없음

## 경고 (WARNING)

| # | Checker | 위배 | 제안 |
|---|---------|------|------|
| W1 | Cross-Spec / Rationale | `status='attention'` 가상 집계값의 API 계약 미기재 | spec §9.1 + Rationale 에 "가상 필터값" 규약 신설 |
| W2 | Cross-Spec / Rationale | 배너 클릭 동작이 spec §2.4 텍스트와 구현 의도 불일치 | spec §2.3/§2.4 개정 선행 |
| W3 | Cross-Spec | `Expiring` 도 가상 필터값인데 규약 부재 | §9.1 규약 신설 시 `expiring` 도 포함 |
| W4 | Plan-Coherence | 동일 spec 파일 동시 수정 plan 3개 존재 | 진행 상태 확인 후 직렬화 |
| W5 | Plan-Coherence | spec 갱신이 "외부 위임" 한 줄로 처리됨 | plan 에 spec 갱신 phase 격상 |
| W6 | Naming-Collision | `attentionBreakdown` 함수명 vs i18n 키 혼재 | 함수명 `computeAttentionBreakdown` 으로 분리 |
| W7 | Naming-Collision | `needsAttention` 단건 vs `attentionBreakdown` 집계 이원화 위험 | `computeAttentionBreakdown` 이 `needsAttention` 재사용 |

## 처리 결과 (developer skill 내)

- W1/W2/W3: spec/2-navigation/4-integration.md §2.1/§2.3/§2.4/§9.1/§11.4 + Rationale "Attention 가상 필터값" 항으로 즉시 해소 → `/consistency-check --spec` 재검토 통과 (review/consistency/2026/05/16/13_36_06/SUMMARY.md, BLOCK: NO).
- W4: `cafe24-pending-polish` 는 PR #18 머지 대기 + followup 으로 split 됨 — §2.4 텍스트 작업이 끝난 상태. 다른 두 plan(`cafe24-background-refresh`, `cafe24-app-url-reuse`) 은 §2.4 와 무관. 실재 충돌 risk 낮음.
- W5: plan/in-progress/integration-attention-filter.md 에 spec 갱신을 명시적 체크리스트 phase 로 격상.
- W6/W7: 구현 단계에서 `computeAttentionBreakdown` 명칭 + `needsAttention` 재사용 구조로 처리 예정 (plan 체크리스트에 명시).

## 산출물 위치
- `cross_spec/review.md` (5)
- `rationale_continuity/review.md` (4)
- `convention_compliance/review.md` (4)
- `plan_coherence/review.md` (5)
- `naming_collision/review.md` (5)
- `_retry_state.json` — 모든 checker success
