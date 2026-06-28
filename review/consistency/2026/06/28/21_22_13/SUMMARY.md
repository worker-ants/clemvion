# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음. WARNING 4건은 차단 사유 아니며, 본 PR(D-12) 관점에서 대부분 pre-existing/false-positive/이미 해소.

## 전체 위험도
**MEDIUM** (checker 집계) — 단, MEDIUM 을 끌어올린 W-1/W-2 는 본 PR 무관 pre-existing 통합 spec drift다. 핵심 변경(공개 webhook 공유 버킷 완화 한도 D-12)은 spec 간 일관성 양호.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING) — 본 PR 처분

| # | Checker | 위배 | 본 PR 처분 |
|---|---------|------|-----------|
| W-1 | Cross-Spec / Naming | `spec/2-navigation/4-integration.md` §9.2 `preview-test` body `service` vs 코드 `serviceType` 불일치 | **범위 밖 (pre-existing)** — 본 PR 은 `4-integration.md` 미수정. 통합 spec drift 로 별도 followup(`spec-sync-integration-*`) 대상. |
| W-2 | Cross-Spec | `INTEGRATION_INVALID_SERVICE` spec 삭제됐으나 코드 잔존 | **범위 밖 (pre-existing)** — 통합 도메인. 별도 followup. |
| W-3 | Convention | 12-webhook fail-open 근거가 `## Rationale` 아닌 본문 subsection | **false-positive** — 해당 `### 공개 webhook throttle Guard …`(L433)는 `## Rationale`(L412) 하위 `###` subsection 으로 규약 정합. 조치 불필요. |
| W-4 | Plan-Coherence | plan "결정 필요" 3항 미결 잔존 | **이미 해소** — 본 PR working tree plan 은 "## 결정 (사용자 확정 2026-06-28)" 로 갱신됨. 완료 이동은 PR 머지 후. |

## 참고 (INFO) — 본 PR 처분

| # | 항목 | 처분 |
|---|------|------|
| I-1 | `spec/data-flow/10-triggers.md` L98 guard 설명에 공유 버킷 미반영 | **반영** — SoT 포인터 1줄 추가(일관성). |
| I-2·I-3·I-4 | Rationale 2.3.B/R6/구현이 기각 결정 준수 | 조치 불필요(확인). |
| I-5·I-6 | 1-auth §2.3 인라인 근거 중복·12-webhook Overview `---` | pre-existing·필수 아님 → 미변경. |
| I-7·I-8·I-9 | `UNIDENTIFIED_IP_BUCKET`·R6·D-12 신규 식별자 충돌 없음 | 조치 불필요. |
| I-10 | plan 후속 항목 완료 미반영 | plan 완료 이동 시 해소. |
| I-11 | webhook-hardening-cleanup §범위 밖 C 잔여 추적 | **stale** — C 잔여는 #766(단위 1)에서 이미 처리 완료. |

## Checker별 위험도
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | MEDIUM (W-1/W-2 — 본 PR 무관 통합 spec drift) |
| Rationale-Continuity | NONE |
| Convention-Compliance | LOW (W-3 false-positive) |
| Plan-Coherence | LOW (W-4 이미 해소) |
| Naming-Collision | LOW (W-1 통합 / 나머지 충돌 없음) |

## 결론
본 PR(D-12) 변경에 대한 Critical 없음, BLOCK: NO. W-1/W-2 는 pre-existing 통합 spec drift 로 범위 밖(별도 followup), W-3 false-positive, W-4 해소, I-1 반영. push 가드 통과 가능.
