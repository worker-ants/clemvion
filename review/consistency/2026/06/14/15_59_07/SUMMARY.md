# Consistency Check 통합 보고서 (재검토 — BLOCK 해소 확인)

**BLOCK: NO** — Critical 0건. 직전 15_42_23 의 Critical 2건(`VALIDATION_FAILED`·details object)은 `VALIDATION_ERROR`+배열 정합으로 해소됨.

## 전체 위험도
**MEDIUM** — WARNING 7건. 다수가 본 PR 의 D3(reconciliation sweep) 추가로 인한 cross-spec 미반영(data-flow/15) + 선존 카탈로그/네이밍 nit.

## Critical 위배
없음.

## 경고 (WARNING)

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Cross-Spec | EIA-RL-06 sweep 가 `data-flow/15` §2.2 BullMQ 표·§1.4 시퀀스에 미반영 | **본 PR 수정** — data-flow/15 에 sweep 큐+흐름 추가 |
| 2 | Cross-Spec | at-least-once worst-case 불일치 (data-flow "TTL 1h" vs R15 "≤1분") | **본 PR 수정** — data-flow Rationale 동기화 |
| 3 | Convention | EIA 전용 코드 8종(`STATE_MISMATCH` 등) 3-error-handling 미카탈로그 | **본 PR 수정** — §1.6 EIA REST 코드 절 신설(EIA §5.1 SoT 포인터) |
| 4 | Convention | `execution.ai_message` SSE 필드명 drift §11 미반영 | 선존 nit — §11 footnote 후속(별도) |
| 5 | Rationale | §5/§5.4 202 no-content→ack body 전환 Rationale 부재 | **본 PR 수정** — R16 추가 |
| 6 | Naming | `TOKEN_INVALID`/`TOKEN_EXPIRED` 워크스페이스 JWT 와 동일 문자열 — "의도적 결정으로 명시됨"(§5.1 note·R14) | 이미 §5.1 note 반영 — 조치 불요 |
| 7 | Naming | `NotificationDispatcher` 클래스명 충돌(EIA outbound vs in-app) | 선존·코드 rename 범위 밖 — 별도 |

## 참고 (INFO) — 선택/후속
- I1 `execution_token` 엔티티 1-data-model 미등재 → 후속(데이터 모델 정비).
- I2~I6 Rationale Continuity: R14·R15·R8 로 전부 근거 충족(처리 완료).
- I7~I9 Convention(Overview 번호·requestId note·Swagger 헬퍼) 선택.
- I10 plan 체크박스(본 PR 에서 complete 이동 완료). I11~I15 조치 불요/후속.

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | MEDIUM (EIA-RL-06 data-flow 미반영) |
| Rationale Continuity | LOW (R16 부재만) |
| Convention Compliance | LOW (코드 카탈로그·필드명) |
| Plan Coherence | LOW |
| Naming Collision | LOW (런타임 충돌 없음) |

---

## main Claude 후속 처리 (resolution, 2026-06-14)
- **W1·W2 (본 PR D3 유발)** → `data-flow/15-external-interaction.md` 에 reconciliation sweep(BullMQ 큐·흐름·worst-case ≤1분) 반영.
- **W3** → `3-error-handling.md §1.6` 신설 — EIA REST 전용 코드 카탈로그(도메인 SoT=EIA §5.1, §1.5 WS 선례와 동형).
- **W5** → EIA §Rationale R16(202 no-content→ack body 전환 근거).
- **W4·W6·W7 + I1** → 선존/별도 범위. W6 은 §5.1 note·R14 로 이미 반영. 나머지는 후속(데이터 모델·§11 footnote·클래스 rename).
- BLOCK: NO → push 진행.
