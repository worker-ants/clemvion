# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 진행 가능.

## 전체 위험도
**LOW** — WARNING 2건(미결 분기·중복 편집 위험), INFO 다수. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `reset-password` → `login_history` 라우팅이 현행 LoginHistory event enum 7종 밖이며, "(또는 미기록)" 이분지 미결 | 결정 1 reset-password 엣지 | `spec/1-data-model.md §2.18.2` (enum 7종 + `chk_login_history_event` CHECK 제약) · `spec/5-system/1-auth.md §4.3` | 결정 1 에서 "미기록" 으로 명확히 확정하거나, 기록 시 신규 enum 값·마이그레이션 V번호까지 함께 결정한다. "(또는 미기록)" 이분지를 제거한 뒤 `spec/1-data-model.md §2.18.2` · `spec/5-system/1-auth.md §4.3` 을 동기 갱신한다. |
| 2 | Plan-Coherence | 결정 2 "반영 위치: `§Rationale 2.3.B` 에 1~2줄" 는 PR #570 MERGED 로 이미 해당 내용이 반영된 상태 — 중복 편집 위험 | 결정 2 "반영 위치" 항목 | `spec/5-system/1-auth.md §Rationale 2.3.B` (L576, PR #570 신설) | 착수 전 `spec/5-system/1-auth.md §2.3.B` (L570–580) 현재 내용을 먼저 확인한다. 이미 충분히 기재됐다면 "이미 반영됨 — §2.3.B L576 참조" 로 수정하고 편집 skip. 추가할 각도(예: `extractClientIp` XFF 전용임이 의도임을 코드 리뷰어에게 공지하는 문장)가 있다면 그 부분만 보충한다. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 결정 1 세션-workspaceId 귀속 규칙은 기존 §4.1 분류와 정합 — 모순 없음 | 결정 1 전체 | 해당 없음 |
| 2 | Cross-Spec | 결정 2 IP 헤더 기반 방향은 §Rationale 2.3.B 와 동일 방향 — 충돌 아님. 단 코드 `extractClientIp` 의 `req.ip` 폴백 유지 여부에 따라 §2.3 표 폴백 순서 서술 동기화 필요 가능 | 결정 2 · `spec/5-system/1-auth.md §2.3` 표 | `extractClientIp` 가 `req.ip` 폴백을 제거했다면 §2.3 표에서 "`req.ip(trust proxy)` 폴백" 항목도 함께 제거 |
| 3 | Rationale-Continuity | 결정 2 추가 내용이 기존 2.3.B 와 실질 중복 — 별도 Rationale 항 신설보다 기존 항 보강이 더 간결 | 결정 2 반영 위치 | 2.3.B "클라이언트 IP 신뢰 (m-3)" 마지막에 CF Tunnel 구체 설명 한 문장 보강으로 충분 |
| 4 | Rationale-Continuity | 결정 1 4.1.B 신규 항 신설은 기존 §4.1 L379 invariant 구체화 — 번복 아님 | 결정 1 4.1.B | 4.1.B 작성 시 "reset-password 경로 제외 근거 — 세션/workspace 없음 → §4.1 L379 기존 분류 원칙 적용" 을 명확히 기술 |
| 5 | Convention-Compliance | plan frontmatter 필수 3필드 완전 충족 | frontmatter lines 1-5 | 변경 불요 |
| 6 | Convention-Compliance | `complete/` 이동 시 Gate C(`spec_impact` frontmatter 선언) 의무 발생 — `started: 2026-06-12` 는 cutoff 이후 | 미래 완료 시점 | 이동 commit 시 `spec_impact: [spec/5-system/1-auth.md, spec/data-flow/1-audit.md]` (또는 `spec_impact: none`) 추가 |
| 7 | Plan-Coherence | `data-flow/1-audit.md §1.1` 편집 시 기존 "미구현" 표기 제거 금지 — 귀속 규칙을 기존 기술에 병기해야 정합 유지 | 결정 1 `data-flow/1-audit.md §1.1` 반영 | 귀속 규칙을 "미구현이지만 구현 시 이 규칙을 따른다" 형태로 병기 |
| 8 | Plan-Coherence | `plan/in-progress/spec-draft-refactor-04-security-drift.md` 는 PR #570 MERGED 후 stale — 정리 권고 | `plan/in-progress/spec-draft-refactor-04-security-drift.md` | `plan/complete/` 로 이동하고 `spec_impact` 포함 Gate C 충족 |
| 9 | Naming-Collision | **재시도 필요** — checker 가 fatal 종료하여 output 파일 없음 | — | naming_collision checker 를 재실행해 결과 확보 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | reset-password → login_history 라우팅이 현행 enum 범위 밖; 결정 미확정 이분지 해소 필요 |
| Rationale-Continuity | NONE | 두 결정 모두 기존 Rationale 와 충돌 없음. 결정 2 는 기존 2.3.B 보강으로 충분 |
| Convention-Compliance | NONE | frontmatter 완전 충족. complete 이동 시 Gate C 의무 상기 필요 |
| Plan-Coherence | LOW | 결정 2 반영 대상이 PR #570 으로 이미 반영됨 — 착수 전 현황 확인 필수. stale plan 정리 권고 |
| Naming-Collision | 재시도 필요 | fatal 종료 — 결과 없음 |

## 권장 조치사항

1. **(WARNING 1 해소)** 결정 1 의 `reset-password` 감사 기록 여부를 "미기록" 으로 확정하거나 기록 시 신규 enum 값·마이그레이션 계획까지 함께 spec 에 기술한다. "(또는 미기록)" 이분지를 plan 에서 제거한 뒤 착수한다.
2. **(WARNING 2 해소)** 착수 전 `spec/5-system/1-auth.md §2.3.B` (L570–580) 를 읽어 결정 2 추가 내용이 이미 반영됐는지 확인한다. 반영됐다면 plan 내 "반영 위치" 항목을 "이미 반영됨" 으로 수정하고 편집을 skip 한다.
3. **(Naming-Collision 재시도)** naming_collision checker 가 fatal 종료했으므로 재실행해 명명 충돌 결과를 확보한다. 단 현재 발견된 위배 중 Critical 이 없으므로 재시도 완료 전에도 진행은 가능하나 결과 확인 권장.
4. **(stale plan 정리)** `plan/in-progress/spec-draft-refactor-04-security-drift.md` 를 `plan/complete/` 로 이동하고 Gate C `spec_impact` 를 선언한다.
5. **(complete 이동 대비)** 본 plan 완료 시 frontmatter 에 `spec_impact: [spec/5-system/1-auth.md, spec/data-flow/1-audit.md]` 를 추가해 Gate C 를 충족한다.