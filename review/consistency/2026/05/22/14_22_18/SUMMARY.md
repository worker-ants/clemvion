# Consistency Check (impl-prep) 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

**스코프**: `spec/conventions/cafe24-api-metadata.md` (Phase A commit 36a8f16e 직후, Phase B 착수 직전)

---

## 전체 위험도
**MEDIUM** — CRITICAL 0건, WARNING 3건, INFO 6건. WARNING 3건은 본 세션 안에서 해소.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING) — 모두 본 세션에서 해소

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W1 | Convention Compliance / Cross-Spec / Naming Collision | `Cafe24McpBridge` vs `Cafe24McpToolProvider` 이름 혼용 | **처리 완료** — Phase A 의 §2 신규 단락 3곳에서 `Cafe24McpBridge` 로 통일 (spec canonical 명) |
| W2 | Naming Collision | `CAFE24_MISSING_FIELDS` SoT 분열 (4-cafe24.md 미반영) | **처리 완료** — 사실은 Phase A 의 4-cafe24.md §4 단계 5 + §5.3 bullet + §6 표 row 3곳에서 이미 갱신됨. 분석기가 detection 미스. |
| W3 | Convention Compliance | §6 step 7 의 `constraints[*]` invariant bullet 이 catalog-sync 와 metadata.spec.ts 가 혼재 | **처리 완료** — 각 bullet 에 담당 spec 파일 (`metadata.spec.ts` / `catalog-sync.spec.ts`) 명시 |

---

## 참고 (INFO)

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| I1 | Cross-Spec | `oneOf` 이름 주의 박스가 폐기된 `requiredWhen.oneOf` 미언급 | **미처리** — 폐기된 DSL 이라 현행 유지 (불필요) |
| I2 | Cross-Spec | "두 채널" 표현 후 세 번째 채널 나열 — 표현 불일치 | **처리 완료** — "두 의무 채널 + 선택적 schema 변환" 으로 재정리 |
| I3 | Cross-Spec | §6 step 8 "조건부 제약 확인" 이 step 7 (단위 테스트) 뒤에 위치 | **처리 완료** — step 5 (등재 단계) 로 이동, 기존 step 6/7/8 → 7/8 으로 +1 |
| I4 | Convention Compliance | `implies.then` 타입 `string[]` 이 invariant "길이 1 이상" 과 불일치 | **처리 완료** — `[string, ...string[]]` tuple 로 변경 |
| I5 | Plan Coherence | `cafe24-backlog-residual-batch` worktree 가 `order.ts` 수정 중 — Phase C 시 conflict 가능 | **미처리 — Phase C 착수 시 조율** (plan 본문에 이미 명시) |
| I6 | Plan Coherence | `0-unimplemented-overview.md` 인덱스에 `cafe24-conditional-required-impl.md` 미등재 | **처리 완료** — 인덱스 1줄 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 연관 spec 4종 동일 커밋 갱신으로 데이터/계약/상태 충돌 없음 |
| Rationale Continuity | NONE | 채택 결정·기각 대안·과거 선례 인용 완비 |
| Convention Compliance | LOW | WARNING 2건 모두 해소 |
| Plan Coherence | LOW | impl plan 과 spec 1:1 정합 |
| Naming Collision | MEDIUM → LOW (처리 후) | 클래스명 통일·`CAFE24_MISSING_FIELDS` SoT 일치 완료 |

---

## 결론

Phase B 구현 착수 가능. 모든 WARNING 해소·대부분의 INFO 처리 완료.
