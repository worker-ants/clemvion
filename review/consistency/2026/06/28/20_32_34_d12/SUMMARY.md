# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

검토 모드: `--impl-prep`
검토 범위: `spec/5-system/` (연관: `spec/7-channel-web-chat/4-security.md`)
검토 일시: 2026-06-28

---

## 전체 위험도
**LOW** — Critical/Warning 위배 없음. 발견된 6건 전부 INFO 수준의 형식·문서 완전성 제안이며 구현을 차단하지 않는다.

> 참고: cross_spec 검토가 WARNING 으로 분류한 에러 코드 설명 누락(W-1)은 구현 행동을 변경하지 않고 문서 완전성만 영향받으므로 BLOCK 사유로 격상하지 않았다.

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `PUBLIC_WEBHOOK_RATE_LIMIT` / `PUBLIC_WEBHOOK_HOURLY_LIMIT` 에러 코드 설명이 "IP 단위"로만 기술되어 공유 버킷(`UNIDENTIFIED_IP_BUCKET`) 초과 케이스 누락 | `spec/5-system/3-error-handling.md` 라인 136–137 | `spec/5-system/12-webhook.md §6` 신규 공유 버킷 동작 및 `spec/7-channel-web-chat/4-security.md §R6` | 설명에 "또는 IP 미식별 시 공유 버킷" 구문 추가 → **반영함** |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 | 처리 |
|---|---------|------|------|------|------|
| I-1 | Cross-Spec | `D-12` 결정 식별자가 spec 내 레지스트리 없이 참조됨 | `4-security.md §R6`, `1-auth.md Rationale 2.3.B m-3` | R6 앵커 대체 또는 레지스트리 신설 | **미변경** — spec Rationale 의 작업 ID 참조는 기존 관례(예 `PR #738 W3`·`refactor 04 m-3`)와 일치하므로 D-12 유지 |
| I-2 | Cross-Spec | `1-auth.md §2.3` 표 "클라이언트 IP" 셀이 공유 버킷 완화 한도 미반영 | `1-auth.md §2.3` 표 라인 321 | 셀 끝에 한 줄 추가 | **반영함** |
| I-3 | Convention Compliance | `10-graph-rag.md`·`12-webhook.md` 의 `## Overview (제품 정의)` 헤더가 `1-auth.md` `## Overview` 와 형식 불일치 | 각 파일 헤더 | 통일 | **미변경** — 본 PR 무관 pre-existing, 별도 정비 |
| I-4 | Convention Compliance | `1-auth.md §4.1` Planned `model_config.*` 목록이 `audit-actions.md §3` 와 중복 소유 | `1-auth.md §4.1` | 포인터 축약 | **미변경** — 본 PR 무관 pre-existing |
| I-5 | Convention Compliance | `12-webhook.md §6` 본문에 fail-open 근거 설명 포함(본문/Rationale 경계 혼재) | `12-webhook.md §6` | 근거 Rationale 이관 | **미변경** — #763 부터 존재한 pre-existing, 본 PR 범위 밖 |
| I-6 | Plan Coherence | Phase A S-1~S-4 가 `[ ]` 인데 워크트리 spec 는 반영 완료 | plan §Phase A | `[x]` 체크 | **반영함** |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 에러 코드 설명 공유 버킷 케이스 누락 (WARNING 1건); `D-12` 레지스트리 미등록, §2.3 표 미갱신 (INFO 2건) |
| Rationale Continuity | NONE | 신규 결정(R6, Rationale 2.3.B 보강, WH-SC-05 명시화) 모두 기존 Rationale 번복 없이 보완·보강 |
| Convention Compliance | NONE | 심각한 규약 위반 없음. 헤더 수식어 불일치·카탈로그 중복·본문-Rationale 경계 혼재 3건 모두 INFO |
| Plan Coherence | LOW | Phase A S-1~S-4 tick 누락 — 실제 spec 은 완료 상태이므로 구현 차단 없음 |
| Naming Collision | NONE | `R6`(per-file 로컬 번호), `UNIDENTIFIED_IP_BUCKET`(신규 상수), `D-12`(기존 plan 백로그 참조) 모두 충돌 없음 |

---

## 권장 조치사항 (처리 결과)

1. **(W-1)** error-handling §1.7 에 공유 버킷 케이스 명시 → **반영**.
2. **(I-6)** plan Phase A S-1~S-4 `[x]` → **반영**.
3. **(I-1)** `D-12` → 기존 작업-ID 참조 관례와 일치하여 유지.
4. **(I-2)** 1-auth §2.3 표 "클라이언트 IP" 셀 한 줄 추가 → **반영**.
5. **(I-3, I-4, I-5)** pre-existing·본 PR 무관 → 다음 spec 정비 시 일괄 처리.
